-- TeamForge — milestones and the task board are managed by the team leader
-- and the mentor.
--
-- Every member of a team still sees the same milestones and tasks (and gets
-- them live through Realtime), and anyone on the team may comment on a task.
-- Creating, editing, moving or deleting milestones and tasks is reserved for
-- the team leader (the project owner), the mentor, and admins.

-- True when the signed-in person leads the project (its owner).
create function public.leads(p_project text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.projects p where p.id = p_project and p.owner_id = public.my_user_id()
  )
$$;

-- True for the people who manage a project's milestones and task board.
create function public.manages(p_project text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.supervises(p_project) or public.leads(p_project)
$$;

-- ================================================================ milestones
-- Milestones live inside the project record, so the rule is added to the
-- project guard: a member who is not the team leader may not touch them.

create or replace function public.projects_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  me text := public.my_user_id();
  new_members jsonb := jsonb_path_query_array(new.data, '$.members[*].userId');
  new_invites jsonb := coalesce(new.data -> 'pendingInvites', '[]'::jsonb);
  changed text[];
begin
  if auth.uid() is null or public.supervises(old.id) then
    return new; -- the team's mentor, admins, and trusted server-side code
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
      raise exception 'Only the mentor can change a project''s status or mentor' using errcode = '42501';
    end if;
    if new.data ->> 'ownerId' is distinct from old.owner_id then
      raise exception 'Only the mentor can change the team leader' using errcode = '42501';
    end if;
    if old.owner_id is distinct from me then
      if 'milestones' = any (changed) then
        raise exception 'Only the team leader and the mentor can change milestones' using errcode = '42501';
      end if;
      if exists (
        select 1 from jsonb_array_elements_text(new_invites) i where not old.pending_invites ? i
      ) then
        raise exception 'Only the team leader can invite teammates' using errcode = '42501';
      end if;
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

-- ===================================================================== tasks

drop policy tasks_write on public.tasks;

create policy tasks_insert on public.tasks for insert to authenticated
  with check (public.manages(project_id));
create policy tasks_delete on public.tasks for delete to authenticated
  using (public.manages(project_id));
-- Members may update a task only to comment on it (checked by tasks_guard).
create policy tasks_update on public.tasks for update to authenticated
  using (public.manages(project_id) or public.is_member(project_id))
  with check (public.manages(project_id) or public.is_member(project_id));

create function public.tasks_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  changed text[];
begin
  if auth.uid() is null or public.manages(old.project_id) then
    return new;
  end if;
  if new.data ->> 'projectId' is distinct from old.project_id then
    raise exception 'A task cannot be moved to another project' using errcode = '42501';
  end if;

  select coalesce(array_agg(k), '{}') into changed
  from (
    select key as k from jsonb_each(new.data)
    where new.data -> key is distinct from old.data -> key
    union
    select key from jsonb_each(old.data) where not new.data ? key
  ) diff;

  -- Anything beyond adding comments is a change to the board itself.
  if not changed <@ array['comments']
     or not coalesce(new.data -> 'comments', '[]'::jsonb) @> coalesce(old.data -> 'comments', '[]'::jsonb) then
    raise exception 'Only the team leader and the mentor can change tasks — you can add comments' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger tasks_guard before update on public.tasks
  for each row execute function public.tasks_guard();
