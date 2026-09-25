-- TeamForge — initial schema for cloud mode.
--
-- Design
--   * One table per app collection. Each row keeps the app's record verbatim in
--     `data jsonb`, so the client's synchronous data layer maps 1:1 onto rows.
--   * Every field a policy needs (project, owner, role, members, …) is a
--     GENERATED column derived from `data` by the database itself — a client
--     can never send a forged value for it.
--   * Row Level Security is the real authorization layer. Rules that compare a
--     row's old and new values (e.g. "members may not approve their own
--     project") are enforced by BEFORE UPDATE guard triggers.
--   * Profile creation, demo-account claiming and first-run seeding go through
--     SECURITY DEFINER functions that validate their inputs.

-- ============================================================ identity & config

create table public.accounts (
  auth_uid uuid primary key references auth.users (id) on delete cascade,
  user_id text not null unique,
  email text not null,
  created_at timestamptz not null default now()
);

-- Operator-managed settings. Row 'bootstrap' (edit in the SQL editor):
--   { "adminEmails": [], "facultyEmails": [], "allowFacultySignup": false, "allowDemoSeed": false }
-- Row 'seed' is written once by seed_database().
create table public.app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.app_config (key, value) values
  ('bootstrap', '{"adminEmails": [], "facultyEmails": [], "allowFacultySignup": false, "allowDemoSeed": false}');

-- ================================================================ collections

create table public.users (
  id text primary key,
  data jsonb not null,
  role text generated always as (data ->> 'role') stored,
  email text generated always as (lower(data ->> 'email')) stored,
  updated_at timestamptz not null default now()
);
create index users_email_idx on public.users (email);

create table public.departments (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.projects (
  id text primary key,
  data jsonb not null,
  owner_id text generated always as (data ->> 'ownerId') stored,
  status text generated always as (data ->> 'status') stored,
  mentor_id text generated always as (data ->> 'mentorId') stored,
  member_ids jsonb generated always as (jsonb_path_query_array(data, '$.members[*].userId')) stored,
  pending_invites jsonb generated always as (coalesce(data -> 'pendingInvites', '[]'::jsonb)) stored,
  updated_at timestamptz not null default now()
);
create index projects_member_ids_idx on public.projects using gin (member_ids);

create table public.tasks (
  id text primary key,
  data jsonb not null,
  project_id text generated always as (data ->> 'projectId') stored,
  updated_at timestamptz not null default now()
);
create index tasks_project_idx on public.tasks (project_id);

create table public.threads (
  id text primary key,
  data jsonb not null,
  project_id text generated always as (data ->> 'projectId') stored,
  updated_at timestamptz not null default now()
);
create index threads_project_idx on public.threads (project_id);

create table public.files (
  id text primary key,
  data jsonb not null,
  project_id text generated always as (data ->> 'projectId') stored,
  updated_at timestamptz not null default now()
);
create index files_project_idx on public.files (project_id);

create table public.project_ideas (
  id text primary key,
  data jsonb not null,
  owner_id text generated always as (data ->> 'ownerId') stored,
  visibility text generated always as (data ->> 'visibility') stored,
  updated_at timestamptz not null default now()
);

create table public.notifications (
  id text primary key,
  data jsonb not null,
  user_id text generated always as (data ->> 'userId') stored,
  updated_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id);

create table public.weekly_reports (
  id text primary key,
  data jsonb not null,
  project_id text generated always as (data ->> 'projectId') stored,
  submitted_by text generated always as (data ->> 'submittedBy') stored,
  status text generated always as (data ->> 'status') stored,
  updated_at timestamptz not null default now()
);
create index weekly_reports_project_idx on public.weekly_reports (project_id);

create table public.categorized_feedback (
  id text primary key,
  data jsonb not null,
  project_id text generated always as (data ->> 'projectId') stored,
  updated_at timestamptz not null default now()
);

create table public.meetings (
  id text primary key,
  data jsonb not null,
  project_id text generated always as (data ->> 'projectId') stored,
  updated_at timestamptz not null default now()
);

create table public.announcements (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.faculty_notes (
  id text primary key,
  data jsonb not null,
  project_id text generated always as (data ->> 'projectId') stored,
  updated_at timestamptz not null default now()
);

create table public.audit_log (
  id text primary key,
  data jsonb not null,
  actor_id text generated always as (data ->> 'actorId') stored,
  created_at timestamptz not null default now()
);

-- Every record must carry the same id inside `data` as its primary key.
do $$
declare t text;
begin
  foreach t in array array['users','departments','projects','tasks','threads','files','project_ideas',
    'notifications','weekly_reports','categorized_feedback','meetings','announcements','faculty_notes','audit_log']
  loop
    execute format('alter table public.%I add constraint %I check (data ->> ''id'' = id)', t, t || '_id_matches');
  end loop;
end $$;

-- ==================================================================== helpers
-- SECURITY DEFINER so they read identity tables without tripping RLS (and
-- without policies recursing into themselves).

create function public.my_user_id() returns text
language sql stable security definer set search_path = public as $$
  select user_id from public.accounts where auth_uid = auth.uid()
$$;

create function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select u.role from public.users u where u.id = public.my_user_id()
$$;

create function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() in ('faculty', 'admin'), false)
$$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() = 'admin', false)
$$;

create function public.is_member(p_project text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.projects p
    where p.id = p_project
      and (p.member_ids ? public.my_user_id() or p.owner_id = public.my_user_id())
  )
$$;

create function public.bootstrap() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce((select value from public.app_config where key = 'bootstrap'), '{}'::jsonb)
$$;

create function public.is_demo() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select (value ->> 'demo')::boolean from public.app_config where key = 'seed'), false)
$$;

-- ============================================================ guard triggers

create function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['users','departments','projects','tasks','threads','files','project_ideas',
    'notifications','weekly_reports','categorized_feedback','meetings','announcements','faculty_notes']
  loop
    execute format('create trigger %I before update on public.%I for each row execute function public.touch_updated_at()',
      t || '_touch', t);
  end loop;
end $$;

-- NOTE: in a BEFORE trigger, generated columns on NEW are not computed yet
-- (they read as NULL), so the guards below always read values from new.data.

-- Credentials belong to Supabase Auth; a password hash never lands in a row.
create function public.users_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.data := new.data - 'passwordHash';
  if tg_op = 'UPDATE' and not public.is_admin() and auth.uid() is not null then
    if new.data ->> 'role' is distinct from old.role
       or lower(new.data ->> 'email') is distinct from old.email then
      raise exception 'Only an administrator can change a role or email' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

create trigger users_guard before insert or update on public.users
  for each row execute function public.users_guard();

-- Projects: who may change what, compared against the previous row.
create function public.projects_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  me text := public.my_user_id();
  new_members jsonb := jsonb_path_query_array(new.data, '$.members[*].userId');
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
    -- Members run the project but cannot approve it or swap its mentor.
    if new.data ->> 'status' is distinct from old.status
       or new.data ->> 'mentorId' is distinct from old.mentor_id then
      raise exception 'Only faculty can change a project''s status or mentor' using errcode = '42501';
    end if;
  elsif old.pending_invites ? me then
    -- An invitee may only accept (add themselves) or decline.
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
    -- Anyone else may only ask to join.
    if not changed <@ array['pendingRequests'] then
      raise exception 'Not a member of this project' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

create trigger projects_guard before update on public.projects
  for each row execute function public.projects_guard();

-- Weekly reports: only supervisors move a report through review.
create function public.weekly_reports_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() and auth.uid() is not null then
    if new.data ->> 'status' is distinct from old.status
       or new.data -> 'feedback' is distinct from old.data -> 'feedback' then
      raise exception 'Only faculty can review a weekly report' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

create trigger weekly_reports_guard before update on public.weekly_reports
  for each row execute function public.weekly_reports_guard();

-- ===================================================================== RLS

alter table public.accounts enable row level security;
alter table public.app_config enable row level security;
alter table public.users enable row level security;
alter table public.departments enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.threads enable row level security;
alter table public.files enable row level security;
alter table public.project_ideas enable row level security;
alter table public.notifications enable row level security;
alter table public.weekly_reports enable row level security;
alter table public.categorized_feedback enable row level security;
alter table public.meetings enable row level security;
alter table public.announcements enable row level security;
alter table public.faculty_notes enable row level security;
alter table public.audit_log enable row level security;

-- accounts: read your own link; everything else goes through functions.
create policy accounts_select on public.accounts for select to authenticated
  using (auth_uid = auth.uid() or public.is_admin());
create policy accounts_admin on public.accounts for delete to authenticated
  using (public.is_admin());

-- app_config: no direct access (bootstrap holds operator emails).

-- users
create policy users_select on public.users for select to authenticated using (true);
create policy users_insert on public.users for insert to authenticated with check (public.is_admin());
create policy users_update on public.users for update to authenticated
  using (public.is_admin() or id = public.my_user_id())
  with check (public.is_admin() or id = public.my_user_id());
create policy users_delete on public.users for delete to authenticated using (public.is_admin());

-- departments: public read (the registration form needs them before sign-in).
create policy departments_select on public.departments for select to anon, authenticated using (true);
create policy departments_write on public.departments for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- projects
create policy projects_select on public.projects for select to authenticated using (true);
create policy projects_insert on public.projects for insert to authenticated with check (
  public.is_staff()
  or (
    owner_id = public.my_user_id()
    and status = 'pending'
    and exists (select 1 from public.users u where u.id = mentor_id and u.role = 'faculty')
  )
);
-- Fine-grained rules live in projects_guard.
create policy projects_update on public.projects for update to authenticated
  using (public.my_user_id() is not null) with check (public.my_user_id() is not null);
create policy projects_delete on public.projects for delete to authenticated
  using (public.is_staff() or owner_id = public.my_user_id());

-- project-scoped work: members and supervisors
create policy tasks_select on public.tasks for select to authenticated using (true);
create policy tasks_write on public.tasks for all to authenticated
  using (public.is_staff() or public.is_member(project_id))
  with check (public.is_staff() or public.is_member(project_id));

create policy threads_select on public.threads for select to authenticated using (true);
create policy threads_write on public.threads for all to authenticated
  using (public.is_staff() or public.is_member(project_id))
  with check (public.is_staff() or public.is_member(project_id));

create policy files_select on public.files for select to authenticated using (true);
create policy files_write on public.files for all to authenticated
  using (public.is_staff() or public.is_member(project_id))
  with check (public.is_staff() or public.is_member(project_id));

-- weekly reports
create policy weekly_reports_select on public.weekly_reports for select to authenticated using (true);
create policy weekly_reports_insert on public.weekly_reports for insert to authenticated with check (
  public.is_staff()
  or (submitted_by = public.my_user_id() and public.is_member(project_id) and status = 'pending')
);
create policy weekly_reports_update on public.weekly_reports for update to authenticated
  using (public.is_staff() or submitted_by = public.my_user_id())
  with check (public.is_staff() or submitted_by = public.my_user_id());
create policy weekly_reports_delete on public.weekly_reports for delete to authenticated
  using (public.is_staff());

-- project ideas
create policy ideas_select on public.project_ideas for select to authenticated
  using (visibility = 'public' or owner_id = public.my_user_id() or public.is_staff());
create policy ideas_insert on public.project_ideas for insert to authenticated
  with check (owner_id = public.my_user_id());
create policy ideas_update on public.project_ideas for update to authenticated
  using (owner_id = public.my_user_id() or public.is_staff())
  with check (owner_id = public.my_user_id() or public.is_staff());
create policy ideas_delete on public.project_ideas for delete to authenticated
  using (owner_id = public.my_user_id() or public.is_staff());

-- supervision
create policy feedback_select on public.categorized_feedback for select to authenticated using (true);
create policy feedback_write on public.categorized_feedback for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy meetings_select on public.meetings for select to authenticated using (true);
create policy meetings_write on public.meetings for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy announcements_select on public.announcements for select to authenticated using (true);
create policy announcements_write on public.announcements for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy faculty_notes_all on public.faculty_notes for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- audit log: append-only record of one's own actions
create policy audit_select on public.audit_log for select to authenticated using (public.is_staff());
create policy audit_insert on public.audit_log for insert to authenticated
  with check (public.is_staff() and actor_id = public.my_user_id());
create policy audit_delete on public.audit_log for delete to authenticated using (public.is_admin());

-- notifications: yours to read and manage; anyone signed in may notify someone.
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = public.my_user_id());
create policy notifications_insert on public.notifications for insert to authenticated
  with check (public.my_user_id() is not null);
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = public.my_user_id()) with check (user_id = public.my_user_id());
create policy notifications_delete on public.notifications for delete to authenticated
  using (user_id = public.my_user_id());

-- ================================================================== functions

-- Creates the signed-in person's profile. The id is their auth uid, the email
-- comes from their verified token, and the role must be allowed by bootstrap.
create function public.register_profile(profile jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  jwt_email text := lower(auth.jwt() ->> 'email');
  requested_role text := profile ->> 'role';
  boot jsonb := public.bootstrap();
  row_data jsonb;
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
  if requested_role = 'faculty' and not (
    public.is_demo()
    or coalesce((boot ->> 'allowFacultySignup')::boolean, false)
    or boot -> 'facultyEmails' ? jwt_email
  ) then
    raise exception 'Faculty accounts must be approved by an administrator' using errcode = '42501';
  end if;
  if requested_role = 'admin' and not (boot -> 'adminEmails' ? jwt_email) then
    raise exception 'Admin accounts must be granted by an administrator' using errcode = '42501';
  end if;

  row_data := (profile - 'passwordHash')
    || jsonb_build_object('id', uid::text, 'email', jwt_email);

  insert into public.users (id, data) values (uid::text, row_data);
  insert into public.accounts (auth_uid, user_id, email) values (uid, uid::text, jwt_email);
  return row_data;
end $$;

-- Demo deployments: link a new login to the seeded demo profile with the same email.
create function public.claim_demo_profile() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  jwt_email text := lower(auth.jwt() ->> 'email');
  target record;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if not public.is_demo() then
    raise exception 'Demo profiles are not enabled on this deployment' using errcode = '42501';
  end if;
  select id, data into target from public.users where email = jwt_email;
  if target.id is null then
    raise exception 'No demo profile for this email' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.accounts where user_id = target.id) then
    raise exception 'Demo profile already claimed' using errcode = '23505';
  end if;
  insert into public.accounts (auth_uid, user_id, email) values (uid, target.id, jwt_email)
    on conflict (auth_uid) do nothing;
  return target.data;
end $$;

-- First-run seeding, callable once per database by any signed-in user.
-- payload: { "<collection>": [ {record}, … ], … }
create function public.seed_database(payload jsonb, demo boolean default false) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  allowed text[] := array['departments','users','projects','tasks','threads','files','project_ideas','notifications'];
  coll text;
  item jsonb;
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if exists (select 1 from public.app_config where key = 'seed') then
    return false;
  end if;
  if demo and not coalesce((public.bootstrap() ->> 'allowDemoSeed')::boolean, false) then
    raise exception 'Demo seeding is disabled (app_config.bootstrap.allowDemoSeed)' using errcode = '42501';
  end if;

  insert into public.app_config (key, value)
    values ('seed', jsonb_build_object('demo', demo, 'seededBy', auth.uid(), 'at', now()));

  for coll in select jsonb_object_keys(payload) loop
    if not (coll = any (allowed)) or (not demo and coll <> 'departments') then
      continue;
    end if;
    for item in select jsonb_array_elements(payload -> coll) loop
      execute format('insert into public.%I (id, data) values ($1, $2) on conflict (id) do nothing', coll)
        using item ->> 'id', item - 'passwordHash';
    end loop;
  end loop;
  return true;
end $$;

-- Least privilege: only signed-in users may call the functions.
revoke execute on function public.register_profile(jsonb) from public, anon;
revoke execute on function public.claim_demo_profile() from public, anon;
revoke execute on function public.seed_database(jsonb, boolean) from public, anon;
grant execute on function public.register_profile(jsonb) to authenticated;
grant execute on function public.claim_demo_profile() to authenticated;
grant execute on function public.seed_database(jsonb, boolean) to authenticated;

-- ================================================================== realtime

alter publication supabase_realtime add table
  public.users, public.departments, public.projects, public.tasks, public.threads, public.files,
  public.project_ideas, public.notifications, public.weekly_reports, public.categorized_feedback,
  public.meetings, public.announcements, public.faculty_notes, public.audit_log;

-- ================================================================== storage
-- Project files live at project-files/files/<fileId>; the matching `files`
-- row (written first) says which project the bytes belong to.

insert into storage.buckets (id, name, public, file_size_limit)
  values ('project-files', 'project-files', false, 20971520)
  on conflict (id) do nothing;

create policy project_files_read on storage.objects for select to authenticated
  using (bucket_id = 'project-files');

create policy project_files_upload on storage.objects for insert to authenticated
  with check (
    bucket_id = 'project-files'
    and exists (
      select 1 from public.files f
      where f.id = split_part(name, '/', 2)
        and (public.is_staff() or public.is_member(f.project_id))
    )
  );

create policy project_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'project-files' and (public.is_staff() or owner = auth.uid()));
