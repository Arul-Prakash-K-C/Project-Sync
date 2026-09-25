-- TeamForge — staff (faculty) sign-up approvals, and team leaders.
--
-- 1. Faculty sign-ups outside the bootstrap allow-list no longer fail: they
--    become a pending row in staff_requests, every admin is notified, and an
--    admin approves (which creates the account) or rejects it.
-- 2. The student who creates a project is its team leader: only they may
--    invite teammates, and only faculty may change who leads.

-- ================================================================ staff_requests

create table public.staff_requests (
  id text primary key,
  data jsonb not null,
  auth_uid uuid unique references auth.users (id) on delete cascade,
  status text generated always as (data ->> 'status') stored,
  email text generated always as (lower(data ->> 'email')) stored,
  updated_at timestamptz not null default now(),
  constraint staff_requests_id_matches check (data ->> 'id' = id)
);

create trigger staff_requests_touch before update on public.staff_requests
  for each row execute function public.touch_updated_at();

alter table public.staff_requests enable row level security;

-- Admins only. Requests are created and decided through the functions below.
create policy staff_requests_admin_select on public.staff_requests for select to authenticated
  using (public.is_admin());
create policy staff_requests_admin_delete on public.staff_requests for delete to authenticated
  using (public.is_admin());

alter publication supabase_realtime add table public.staff_requests;

-- Notify every administrator (used for new sign-ups).
create function public.notify_admins(title text, description text, action_url text) returns void
language plpgsql security definer set search_path = public as $$
declare
  admin_id text;
  nid text;
begin
  for admin_id in select id from public.users where role = 'admin' loop
    nid := 'notif_' || replace(gen_random_uuid()::text, '-', '');
    insert into public.notifications (id, data) values (nid, jsonb_build_object(
      'id', nid, 'userId', admin_id, 'title', title, 'description', description,
      'type', 'project', 'read', false, 'createdAt', now(), 'actionUrl', action_url));
  end loop;
end $$;

revoke execute on function public.notify_admins(text, text, text) from public, anon, authenticated;

-- ============================================================ register_profile
-- Same contract as before, except a faculty sign-up that is not allow-listed
-- is queued for an admin instead of refused. Returns either the new profile, or
-- {"status": "pending"} / {"status": "rejected", "reason": …}.

create or replace function public.register_profile(profile jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  jwt_email text := lower(auth.jwt() ->> 'email');
  requested_role text := profile ->> 'role';
  boot jsonb := public.bootstrap();
  row_data jsonb;
  existing record;
  req_id text;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if exists (select 1 from public.accounts where auth_uid = uid) then
    raise exception 'Profile already exists' using errcode = '23505';
  end if;
  if requested_role not in ('student', 'faculty', 'admin') then
    raise exception 'Unknown role' using errcode = '22023';
  end if;

  -- Every allow-list test is coalesced to a real boolean. A missing key used to
  -- yield NULL, and `IF NOT (… OR NULL)` is NULL — which skipped the refusal and
  -- let anyone self-register as faculty (or admin) once the key was absent.
  if requested_role = 'faculty' and not (
    public.is_demo()
    or coalesce((boot ->> 'allowFacultySignup')::boolean, false)
    or coalesce(boot -> 'facultyEmails' ? jwt_email, false)
  ) then
    select id, data, status into existing from public.staff_requests where auth_uid = uid;
    if existing.id is not null then
      return jsonb_build_object('status', existing.status, 'reason', existing.data ->> 'reason');
    end if;
    req_id := 'staffreq_' || replace(uid::text, '-', '');
    insert into public.staff_requests (id, auth_uid, data) values (req_id, uid, jsonb_build_object(
      'id', req_id,
      'authUid', uid::text,
      'name', coalesce(profile ->> 'name', jwt_email),
      'email', jwt_email,
      'department', coalesce(profile ->> 'department', ''),
      'role', 'faculty',
      'profile', profile - 'passwordHash' - 'id' - 'email' - 'role',
      'status', 'pending',
      'createdAt', now()));
    perform public.notify_admins(
      'Faculty sign-up to approve',
      coalesce(profile ->> 'name', jwt_email) || ' (' || jwt_email || ') asked for a faculty account in '
        || coalesce(profile ->> 'department', 'an unspecified department') || '.',
      '/dashboard/admin');
    return jsonb_build_object('status', 'pending');
  end if;

  if requested_role = 'admin' and not coalesce(boot -> 'adminEmails' ? jwt_email, false) then
    raise exception 'Admin accounts must be granted by an administrator' using errcode = '42501';
  end if;

  row_data := (profile - 'passwordHash')
    || jsonb_build_object('id', uid::text, 'email', jwt_email);

  insert into public.users (id, data) values (uid::text, row_data);
  insert into public.accounts (auth_uid, user_id, email) values (uid, uid::text, jwt_email);
  return row_data;
end $$;

-- ================================================================ decisions

create function public.approve_staff_request(request_id text) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  req record;
  admin_id text := public.my_user_id();
  new_id text;
  profile_data jsonb;
  nid text;
begin
  if not public.is_admin() then
    raise exception 'Only an administrator can approve staff accounts' using errcode = '42501';
  end if;
  select id, data, auth_uid, status into req from public.staff_requests where id = request_id for update;
  if req.id is null or req.status <> 'pending' then
    raise exception 'This request is no longer pending' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.accounts where auth_uid = req.auth_uid) then
    raise exception 'An account is already linked to this sign-in' using errcode = '23505';
  end if;

  new_id := req.auth_uid::text;
  profile_data := coalesce(req.data -> 'profile', '{}'::jsonb) || jsonb_build_object(
    'id', new_id,
    'name', req.data ->> 'name',
    'email', req.data ->> 'email',
    'department', req.data ->> 'department',
    'role', 'faculty');
  profile_data := jsonb_build_object('avatar', '', 'skills', '[]'::jsonb, 'interests', '[]'::jsonb, 'availability', true)
    || profile_data;

  insert into public.users (id, data) values (new_id, profile_data);
  insert into public.accounts (auth_uid, user_id, email) values (req.auth_uid, new_id, req.data ->> 'email');

  update public.staff_requests
    set data = data || jsonb_build_object('status', 'approved', 'decidedAt', now(), 'decidedBy', admin_id)
    where id = request_id;

  nid := 'notif_' || replace(gen_random_uuid()::text, '-', '');
  insert into public.notifications (id, data) values (nid, jsonb_build_object(
    'id', nid, 'userId', new_id, 'title', 'Faculty account approved',
    'description', 'An administrator approved your faculty account. Welcome to TeamForge.',
    'type', 'project', 'read', false, 'createdAt', now(), 'actionUrl', '/dashboard/faculty'));
  return true;
end $$;

create function public.reject_staff_request(request_id text, reason text default '') returns boolean
language plpgsql security definer set search_path = public as $$
declare
  req record;
begin
  if not public.is_admin() then
    raise exception 'Only an administrator can reject staff accounts' using errcode = '42501';
  end if;
  select id, status into req from public.staff_requests where id = request_id for update;
  if req.id is null or req.status <> 'pending' then
    raise exception 'This request is no longer pending' using errcode = 'P0002';
  end if;
  update public.staff_requests
    set data = data || jsonb_build_object(
      'status', 'rejected', 'decidedAt', now(), 'decidedBy', public.my_user_id(), 'reason', coalesce(reason, ''))
    where id = request_id;
  return true;
end $$;

revoke execute on function public.approve_staff_request(text) from public, anon;
revoke execute on function public.reject_staff_request(text, text) from public, anon;
grant execute on function public.approve_staff_request(text) to authenticated;
grant execute on function public.reject_staff_request(text, text) to authenticated;

-- ================================================================ team leader
-- projects_guard, extended: members still can't approve or re-mentor a
-- project, and now only the owner (team leader) may invite, and nobody but
-- faculty may hand the leadership to someone else.

create or replace function public.projects_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  me text := public.my_user_id();
  new_members jsonb := jsonb_path_query_array(new.data, '$.members[*].userId');
  new_invites jsonb := coalesce(new.data -> 'pendingInvites', '[]'::jsonb);
  changed text[];
begin
  if public.is_staff() or auth.uid() is null then
    return new; -- supervisors, and trusted server-side code
  end if;

  select coalesce(array_agg(k), '{}') into changed
  from (
    select key as k from jsonb_each(new.data)
    where new.data -> key is distinct from old.data -> key
    union
    select key from jsonb_each(old.data) where not new.data ? key
  ) diff;

  if old.member_ids ? me or old.owner_id = me then
    if new.data ->> 'status' is distinct from old.status
       or new.data ->> 'mentorId' is distinct from old.mentor_id then
      raise exception 'Only faculty can change a project''s status or mentor' using errcode = '42501';
    end if;
    if new.data ->> 'ownerId' is distinct from old.owner_id then
      raise exception 'Only faculty can change the team leader' using errcode = '42501';
    end if;
    if old.owner_id is distinct from me and exists (
      select 1 from jsonb_array_elements_text(new_invites) i where not old.pending_invites ? i
    ) then
      raise exception 'Only the team leader can invite teammates' using errcode = '42501';
    end if;
  elsif old.pending_invites ? me then
    if not changed <@ array['members', 'pendingInvites'] then
      raise exception 'Invitees can only accept or decline' using errcode = '42501';
    end if;
    if exists (
      select 1 from jsonb_array_elements_text(new_members) m
      where m <> me and not old.member_ids ? m
    ) then
      raise exception 'Invitees can only add themselves' using errcode = '42501';
    end if;
  else
    if not changed <@ array['pendingRequests'] then
      raise exception 'Not a member of this project' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
