-- TeamForge — mentor-scoped faculty access.
--
-- Until now every faculty member could read (and supervise) every team. From
-- here on a faculty member sees and supervises only the projects whose
-- students chose them as mentor. Admins still see everything; students see the
-- teams they lead, belong to or were invited to.
--
-- A project with no mentor (created before mentors existed) falls back to the
-- faculty of its department, so it is never left without a supervisor.

-- ==================================================================== helpers

create function public.my_department() returns text
language sql stable security definer set search_path = public as $$
  select u.data ->> 'department' from public.users u where u.id = public.my_user_id()
$$;

-- True when the signed-in person supervises the project: an admin, the chosen
-- mentor, or (for mentor-less legacy projects) faculty of the same department.
create function public.supervises(p_project text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.projects p
    where p.id = p_project
      and (
        p.mentor_id = public.my_user_id()
        or (p.mentor_id is null and public.my_role() = 'faculty'
            and p.data ->> 'department' = public.my_department())
      )
  )
$$;

-- True when the signed-in person may see the project at all.
create function public.can_see_project(p_project text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.supervises(p_project)
    or public.is_member(p_project)
    or exists (
      select 1 from public.projects p
      where p.id = p_project and p.pending_invites ? public.my_user_id()
    )
$$;

-- ================================================================== projects

drop policy projects_select on public.projects;
create policy projects_select on public.projects for select to authenticated using (
  public.supervises(id)
  or owner_id = public.my_user_id()
  or member_ids ? public.my_user_id()
  or pending_invites ? public.my_user_id()
);

drop policy projects_insert on public.projects;
create policy projects_insert on public.projects for insert to authenticated with check (
  public.is_admin()
  or (
    owner_id = public.my_user_id()
    and status = 'pending'
    and exists (select 1 from public.users u where u.id = mentor_id and u.role = 'faculty')
  )
);

drop policy projects_delete on public.projects;
create policy projects_delete on public.projects for delete to authenticated
  using (public.supervises(id) or owner_id = public.my_user_id());

-- Only the project's own mentor (or an admin) bypasses the member rules; any
-- other faculty member is treated like an outsider.
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

-- ==================================================== project-scoped content

drop policy tasks_select on public.tasks;
drop policy tasks_write on public.tasks;
create policy tasks_select on public.tasks for select to authenticated
  using (public.can_see_project(project_id));
create policy tasks_write on public.tasks for all to authenticated
  using (public.supervises(project_id) or public.is_member(project_id))
  with check (public.supervises(project_id) or public.is_member(project_id));

drop policy threads_select on public.threads;
drop policy threads_write on public.threads;
create policy threads_select on public.threads for select to authenticated
  using (public.can_see_project(project_id));
create policy threads_write on public.threads for all to authenticated
  using (public.supervises(project_id) or public.is_member(project_id))
  with check (public.supervises(project_id) or public.is_member(project_id));

drop policy files_select on public.files;
drop policy files_write on public.files;
create policy files_select on public.files for select to authenticated
  using (public.can_see_project(project_id));
create policy files_write on public.files for all to authenticated
  using (public.supervises(project_id) or public.is_member(project_id))
  with check (public.supervises(project_id) or public.is_member(project_id));

drop policy weekly_reports_select on public.weekly_reports;
drop policy weekly_reports_insert on public.weekly_reports;
drop policy weekly_reports_update on public.weekly_reports;
drop policy weekly_reports_delete on public.weekly_reports;
create policy weekly_reports_select on public.weekly_reports for select to authenticated
  using (public.can_see_project(project_id));
create policy weekly_reports_insert on public.weekly_reports for insert to authenticated with check (
  public.supervises(project_id)
  or (submitted_by = public.my_user_id() and public.is_member(project_id) and status = 'pending')
);
create policy weekly_reports_update on public.weekly_reports for update to authenticated
  using (public.supervises(project_id) or submitted_by = public.my_user_id())
  with check (public.supervises(project_id) or submitted_by = public.my_user_id());
create policy weekly_reports_delete on public.weekly_reports for delete to authenticated
  using (public.supervises(project_id));

-- Only the project's mentor reviews its reports.
create or replace function public.weekly_reports_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.supervises(old.project_id) then
    if new.data ->> 'status' is distinct from old.status
       or new.data -> 'feedback' is distinct from old.data -> 'feedback' then
      raise exception 'Only the project''s mentor can review a weekly report' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

drop policy feedback_select on public.categorized_feedback;
drop policy feedback_write on public.categorized_feedback;
create policy feedback_select on public.categorized_feedback for select to authenticated
  using (public.can_see_project(project_id));
create policy feedback_write on public.categorized_feedback for all to authenticated
  using (public.supervises(project_id)) with check (public.supervises(project_id));

drop policy meetings_select on public.meetings;
drop policy meetings_write on public.meetings;
create policy meetings_select on public.meetings for select to authenticated
  using (public.can_see_project(project_id));
create policy meetings_write on public.meetings for all to authenticated
  using (public.supervises(project_id)) with check (public.supervises(project_id));

drop policy faculty_notes_all on public.faculty_notes;
create policy faculty_notes_all on public.faculty_notes for all to authenticated
  using (public.supervises(project_id)) with check (public.supervises(project_id));

-- ============================================================= announcements
-- An announcement reaches the teams it lists. Faculty may only address their
-- own teams. Legacy broadcasts (targetType 'all' with no recorded targets)
-- stay visible to everyone signed in.

alter table public.announcements
  add column target_ids jsonb generated always as (coalesce(data -> 'targetIds', '[]'::jsonb)) stored;

create function public.announcement_visible(p_target_type text, p_targets jsonb) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin()
    or (p_target_type = 'all' and jsonb_array_length(p_targets) = 0)
    or exists (select 1 from jsonb_array_elements_text(p_targets) t where public.can_see_project(t))
$$;

create function public.may_address(p_targets jsonb) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or (
    public.is_staff()
    and jsonb_array_length(p_targets) > 0
    and not exists (select 1 from jsonb_array_elements_text(p_targets) t where not public.supervises(t))
  )
$$;

drop policy announcements_select on public.announcements;
drop policy announcements_write on public.announcements;
create policy announcements_select on public.announcements for select to authenticated
  using (public.announcement_visible(data ->> 'targetType', target_ids));
create policy announcements_write on public.announcements for all to authenticated
  using (public.may_address(target_ids)) with check (public.may_address(target_ids));

-- ==================================================================== storage

drop policy project_files_read on storage.objects;
create policy project_files_read on storage.objects for select to authenticated
  using (
    bucket_id = 'project-files'
    and exists (
      select 1 from public.files f
      where f.id = split_part(name, '/', 2) and public.can_see_project(f.project_id)
    )
  );

drop policy project_files_upload on storage.objects;
create policy project_files_upload on storage.objects for insert to authenticated
  with check (
    bucket_id = 'project-files'
    and exists (
      select 1 from public.files f
      where f.id = split_part(name, '/', 2)
        and (public.supervises(f.project_id) or public.is_member(f.project_id))
    )
  );

drop policy project_files_delete on storage.objects;
create policy project_files_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'project-files'
    and (
      owner = auth.uid()
      or exists (
        select 1 from public.files f
        where f.id = split_part(name, '/', 2) and public.supervises(f.project_id)
      )
    )
  );
