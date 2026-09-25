<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth.svelte';
  import {
    db,
    TEAM_SIZE_MIN,
    TEAM_SIZE_MAX,
    type Project,
    type Task,
    type Announcement,
    type Meeting,
    type User, memberRoleLabel } from '$lib/services/db';
  import { toast } from '$lib/stores/toast.svelte';
  import {
    Plus,
    FolderKanban,
    CheckSquare,
    Clock,
    ArrowRight,
    UserPlus,
    Check,
    X,
    ShieldAlert,
    Megaphone,
    Calendar,
    MapPin,
    Compass
  } from 'lucide-svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import Dialog from '$lib/components/ui/Dialog.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import StatCard from '$lib/components/ui/StatCard.svelte';
  import EmptyState from '$lib/components/ui/EmptyState.svelte';
  import ProgressBar from '$lib/components/ui/ProgressBar.svelte';
  import Avatar from '$lib/components/ui/Avatar.svelte';
  import SkillInput from '$lib/components/ui/SkillInput.svelte';

  let projects = $state<Project[]>([]);
  let invitations = $state<Project[]>([]);
  let allTasks = $state<Task[]>([]);
  let announcements = $state<Announcement[]>([]);
  let meetings = $state<Meeting[]>([]);
  let createDialogOpen = $state(false);
  let submitting = $state(false);
  /** Data comes from browser storage on mount; until then the page shows its
      own shape rather than an empty screen that looks like "you have nothing". */
  let loaded = $state(false);

  // Form states
  let newProjectName = $state('');
  let newProjectDesc = $state('');
  let newProjectDept = $state('');
  let newProjectSkills = $state<string[]>([]);
  let newProjectTeamSize = $state(4);
  let newProjectMentorId = $state('');
  /** Only flag missing skills after someone has tried to submit. */
  let triedSubmit = $state(false);

  const departments = db.getDepartments();
  const teamSizes = Array.from({ length: TEAM_SIZE_MAX - TEAM_SIZE_MIN + 1 }, (_, i) => TEAM_SIZE_MIN + i);

  let mentors = $state<User[]>([]);
  /** Every skill already in use on the platform, for suggestions. */
  let skillSuggestions = $state<string[]>([]);

  /** Mentors from the chosen department first, then everyone else. */
  const mentorGroups = $derived([
    { label: `${newProjectDept || 'This department'}`, items: mentors.filter((m) => m.department === newProjectDept) },
    { label: 'Other departments', items: mentors.filter((m) => m.department !== newProjectDept) }
  ].filter((g) => g.items.length > 0));

  const selectedMentor = $derived(mentors.find((m) => m.id === newProjectMentorId));

  function resetCreateForm() {
    newProjectName = '';
    newProjectDesc = '';
    newProjectSkills = [];
    newProjectTeamSize = 4;
    newProjectDept = auth.user?.department && departments.some((d) => d.name === auth.user!.department)
      ? auth.user.department
      : (departments[0]?.name ?? '');
    newProjectMentorId = mentors.find((m) => m.department === newProjectDept)?.id ?? mentors[0]?.id ?? '';
    triedSubmit = false;
  }

  function openCreateDialog() {
    mentors = db.getMentors();
    skillSuggestions = [
      ...new Set([
        ...db.getUsers().filter((u) => u.role === 'student').flatMap((u) => u.skills),
        ...db.getProjectIdeas().flatMap((i) => i.requiredSkills),
        ...db.getProjects().flatMap((p) => p.requiredSkills ?? [])
      ])
    ].sort((a, b) => a.localeCompare(b));
    resetCreateForm();
    createDialogOpen = true;
  }

  onMount(() => {
    loadData();
    mentors = db.getMentors();
    resetCreateForm();
    loaded = true;
  });

  function loadData() {
    if (auth.user) {
      // Load student projects
      projects = db.getProjects().filter((p) => p.members.some((m) => m.userId === auth.user!.id));
      // Load invites
      invitations = db.getProjects().filter((p) => p.pendingInvites.includes(auth.user!.id));
      // Load tasks
      allTasks = db.getTasks().filter((t) => t.assignees.includes(auth.user!.id));

      // Load announcements for any project the student is part of
      const studentProjectIds = projects.map((p) => p.id);
      announcements = db
        .getAnnouncements()
        .filter((a) => studentProjectIds.some((id) => db.announcementReaches(a, id)));

      // Load scheduled meetings for student's projects
      meetings = db
        .getMeetings()
        .filter((m) => studentProjectIds.includes(m.projectId) && m.status === 'scheduled');
    }
  }

  function handleCreateProject(e: SubmitEvent) {
    e.preventDefault();
    if (!auth.user) return;
    triedSubmit = true;
    if (newProjectSkills.length === 0) {
      toast.error('List at least one skill the team needs.');
      document.getElementById('p-skills')?.focus();
      return;
    }
    submitting = true;
    try {
      const newP = db.createProject(
        {
          name: newProjectName,
          description: newProjectDesc,
          department: newProjectDept,
          requiredSkills: newProjectSkills,
          teamSize: newProjectTeamSize,
          mentorId: newProjectMentorId
        },
        auth.user
      );
      toast.success(`"${newP.name}" sent to ${newP.mentorName} for approval.`);
      createDialogOpen = false;
      resetCreateForm();
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create project');
    } finally {
      submitting = false;
    }
  }

  function acceptInvitation(projId: string) {
    if (!auth.user) return;
    try {
      db.acceptInvite(projId, auth.user.id);
      toast.success('Invitation accepted!');
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to accept invitation');
    }
  }

  function declineInvitation(projId: string) {
    if (!auth.user) return;
    try {
      db.declineInvite(projId, auth.user.id);
      toast.success('Invitation declined');
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to decline invitation');
    }
  }

  // Derived stats
  const activeCount = $derived(projects.filter((p) => p.status === 'active').length);
  const pendingCount = $derived(projects.filter((p) => p.status === 'pending').length);
  const completedTaskCount = $derived(allTasks.filter((t) => t.column === 'completed').length);
  const totalTaskCount = $derived(allTasks.length);

  function milestoneProgress(p: Project) {
    if (p.milestones.length === 0) return 0;
    return Math.round((p.milestones.filter((m) => m.completed).length / p.milestones.length) * 100);
  }

  const statusTone = {
    active: 'success',
    pending: 'warning',
    rejected: 'danger',
    archived: 'secondary'
  } as const;
</script>

<svelte:head>
  <title>Dashboard — TeamForge</title>
</svelte:head>

{#if auth.user}
  <div class="flex flex-col gap-7 max-w-7xl">
    <PageHeader
      title="Welcome back, {auth.user.name.split(' ')[0]}"
      description="Your teams, the work assigned to you, and anything your supervisor needs you to see."
    >
      {#snippet actions()}
        <Button variant="primary" onclick={openCreateDialog}>
          <Plus class="w-4 h-4" />
          Create project
        </Button>
      {/snippet}
    </PageHeader>

    <!--
      Invitations sit above everything else because they are the only thing on
      this page that expires: a teammate is waiting on the answer.
    -->
    {#if invitations.length > 0}
      <section
        aria-label="Pending project invitations"
        class="rounded-lg border border-accent/30 bg-accent/6 p-4"
      >
        <div class="flex items-center gap-2 mb-3">
          <UserPlus class="w-4 h-4 text-accent" aria-hidden="true" />
          <h2 class="text-sm font-bold text-foreground">
            {invitations.length} pending invitation{invitations.length === 1 ? '' : 's'}
          </h2>
        </div>
        <ul class="grid grid-cols-1 md:grid-cols-2 gap-3">
          {#each invitations as inv (inv.id)}
            <li
              class="flex items-center justify-between gap-3 p-3 bg-card border border-border rounded-md"
            >
              <div class="flex flex-col min-w-0">
                <span class="text-sm font-bold text-foreground truncate">{inv.name}</span>
                <span class="text-2xs text-muted-foreground">Invited by {inv.ownerName}</span>
              </div>
              <div class="flex items-center gap-1.5 shrink-0">
                <button
                  onclick={() => acceptInvitation(inv.id)}
                  class="icon-action text-success border-success/30 hover:bg-success hover:text-success-foreground hover:border-success"
                  aria-label="Accept invitation to {inv.name}"
                >
                  <Check class="w-4 h-4" />
                </button>
                <button
                  onclick={() => declineInvitation(inv.id)}
                  class="icon-action icon-action-danger"
                  aria-label="Decline invitation to {inv.name}"
                >
                  <X class="w-4 h-4" />
                </button>
              </div>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    <!-- Standing figures -->
    <section aria-label="Summary" class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <StatCard
        label="Active projects"
        value={activeCount}
        icon={FolderKanban}
        tone="accent"
        hint={pendingCount > 0 ? `${pendingCount} awaiting approval` : 'All proposals reviewed'}
      />
      <StatCard
        label="Awaiting approval"
        value={pendingCount}
        icon={Clock}
        tone="warning"
        hint="Faculty reviews proposals before work starts"
      />
      <StatCard label="My tasks done" value="{completedTaskCount}/{totalTaskCount}" icon={CheckSquare} tone="success">
        <ProgressBar
          value={completedTaskCount}
          max={Math.max(totalTaskCount, 1)}
          tone="success"
          size="sm"
          label="Tasks assigned to me"
        />
      </StatCard>
    </section>

    <!-- Main workflow: the teams themselves -->
    <section aria-label="My teams and projects" class="flex flex-col gap-3">
      <h2 class="font-display text-lg text-foreground">My teams &amp; projects</h2>

      {#if !loaded}
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4" aria-busy="true">
          {#each { length: 2 } as _, i (i)}
            <div class="rounded-lg border border-border bg-card p-5 flex flex-col gap-3">
              <div class="skeleton h-5 w-1/2"></div>
              <div class="skeleton h-3 w-full"></div>
              <div class="skeleton h-3 w-4/5"></div>
              <div class="skeleton h-8 w-full mt-4"></div>
            </div>
          {/each}
        </div>
      {:else if projects.length === 0}
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          description="Start a proposal of your own, or head to Team Finder to join a classmate who is already recruiting."
        >
          {#snippet action()}
            <Button variant="primary" size="sm" onclick={openCreateDialog}>
              <Plus class="w-3.5 h-3.5" />
              Create project
            </Button>
            <a href="/dashboard/student/team-finder">
              <Button variant="outline" size="sm">
                <Compass class="w-3.5 h-3.5" />
                Find teammates
              </Button>
            </a>
          {/snippet}
        </EmptyState>
      {:else}
        <ul class="grid grid-cols-1 md:grid-cols-2 gap-4">
          {#each projects as p (p.id)}
            <li>
              <Card hoverable class="h-full flex flex-col">
                <div class="flex items-start justify-between gap-3">
                  <h3 class="text-base font-bold text-foreground leading-snug min-w-0">
                    <a
                      href="/dashboard/student/project/{p.id}"
                      class="hover:text-accent transition-colors rounded-sm"
                    >
                      {p.name}
                    </a>
                  </h3>
                  <div class="flex items-center gap-1.5 shrink-0">
                    {#if p.ownerId === auth.user?.id}
                      <Badge variant="primary" size="sm">Team leader</Badge>
                    {/if}
                    <Badge variant={statusTone[p.status]} dot class="capitalize">{p.status}</Badge>
                  </div>
                </div>

                <p class="text-xs text-muted-foreground mt-2 line-clamp-2 leading-relaxed">
                  {p.description}
                </p>

                {#if p.milestones.length > 0}
                  <ProgressBar
                    class="mt-4"
                    value={p.milestones.filter((m) => m.completed).length}
                    max={p.milestones.length}
                    label="Milestones"
                    valueLabel="{p.milestones.filter((m) => m.completed).length} / {p.milestones.length}"
                    tone={milestoneProgress(p) === 100 ? 'success' : 'accent'}
                    size="sm"
                  />
                {/if}

                <div class="mt-auto pt-4 flex items-center justify-between gap-3">
                  <div class="flex -space-x-2" aria-label="{p.members.length} team members">
                    {#each p.members.slice(0, 4) as member (member.userId)}
                      <Avatar
                        src={member.avatar}
                        name={member.name}
                        size="sm"
                        class="ring-2 ring-card"
                        title="{member.name} ({memberRoleLabel(p, member)})"
                      />
                    {/each}
                    {#if p.members.length > 4}
                      <span
                        class="w-8 h-8 rounded-md ring-2 ring-card bg-secondary border border-border
                          flex items-center justify-center text-3xs font-bold text-muted-foreground"
                      >
                        +{p.members.length - 4}
                      </span>
                    {/if}
                  </div>

                  <a href="/dashboard/student/project/{p.id}" class="shrink-0">
                    <Button variant="outline" size="sm">
                      Open workspace
                      <ArrowRight class="w-3.5 h-3.5" />
                    </Button>
                  </a>
                </div>
              </Card>
            </li>
          {/each}
        </ul>
      {/if}
    </section>

    <!-- Secondary: things sent to you -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card title="Announcements" bodyClass="flex flex-col gap-2.5 max-h-72 overflow-y-auto">
        {#each announcements as ann (ann.id)}
          <article class="p-3 border border-border rounded-md">
            <h3 class="text-sm font-bold text-foreground">{ann.title}</h3>
            <p class="text-xs text-muted-foreground leading-relaxed mt-1 whitespace-pre-wrap">
              {ann.content}
            </p>
            <p class="text-3xs text-muted-foreground mt-2">
              {ann.facultyName} · {new Date(ann.createdAt).toLocaleDateString()}
            </p>
          </article>
        {:else}
          <EmptyState
            icon={Megaphone}
            title="No announcements"
            description="Notices your supervisor broadcasts to the department or to your team appear here."
            size="sm"
          />
        {/each}
      </Card>

      <Card title="Upcoming reviews" bodyClass="flex flex-col gap-2.5 max-h-72 overflow-y-auto">
        {#each meetings as meet (meet.id)}
          <article class="p-3 border border-border rounded-md">
            <div class="flex items-start justify-between gap-3">
              <h3 class="text-sm font-bold text-foreground">{meet.title}</h3>
              <Badge variant="success" size="sm" class="shrink-0">Scheduled</Badge>
            </div>
            <p class="text-2xs text-muted-foreground mt-1">{meet.projectName}</p>
            <dl class="flex flex-col gap-1 mt-2 text-2xs text-muted-foreground">
              <div class="flex items-center gap-1.5">
                <dt class="sr-only">When</dt>
                <Calendar class="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <dd class="tabular">{meet.date} at {meet.time}</dd>
              </div>
              <div class="flex items-center gap-1.5 min-w-0">
                <dt class="sr-only">Where</dt>
                <MapPin class="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <dd class="truncate font-semibold text-foreground">{meet.linkOrLocation}</dd>
              </div>
            </dl>
          </article>
        {:else}
          <EmptyState
            icon={Calendar}
            title="No reviews scheduled"
            description="Your supervisor schedules mentor reviews from the faculty side; they show up here once booked."
            size="sm"
          />
        {/each}
      </Card>
    </div>
  </div>

  <!-- Create Project Dialog -->
  <Dialog
    bind:open={createDialogOpen}
    title="Launch academic project"
    description="Your chosen mentor reviews the proposal before the workspace opens."
    size="lg"
  >
    <form id="create-project-form" onsubmit={handleCreateProject} class="flex flex-col gap-4">
      <div class="field">
        <label for="p-name" class="field-label">Project name</label>
        <input
          id="p-name"
          type="text"
          placeholder="e.g. Decentralized Study Hub"
          bind:value={newProjectName}
          required
          class="field-input"
        />
      </div>

      <div class="field">
        <label for="p-desc" class="field-label">Project description</label>
        <textarea
          id="p-desc"
          placeholder="What is this project about? Highlight core deliverables…"
          bind:value={newProjectDesc}
          required
          rows="4"
          aria-describedby="p-desc-hint"
          class="field-textarea"
        ></textarea>
        <p id="p-desc-hint" class="field-hint">
          Faculty read this first — say what you will build and what you will hand in.
        </p>
      </div>

      <div class="field">
        <label for="p-skills" class="field-label">Required skills</label>
        <SkillInput
          id="p-skills"
          bind:skills={newProjectSkills}
          suggestions={skillSuggestions}
          invalid={triedSubmit && newProjectSkills.length === 0}
          describedby="p-skills-hint"
        />
        <p id="p-skills-hint" class="field-hint">
          What the team needs to deliver this. Used to recommend teammates who fit.
        </p>
      </div>

      <div class="grid sm:grid-cols-2 gap-4">
        <div class="field">
          <label for="p-dept" class="field-label">Department</label>
          <select id="p-dept" bind:value={newProjectDept} class="field-select">
            {#each departments as d (d.id)}
              <option value={d.name}>{d.name}</option>
            {/each}
          </select>
        </div>

        <div class="field">
          <label for="p-mentor" class="field-label">Mentor</label>
          {#if mentors.length === 0}
            <p class="field-hint text-warning py-2.5">
              No faculty are registered yet, so a mentor can't be chosen.
            </p>
          {:else}
            <select id="p-mentor" bind:value={newProjectMentorId} required class="field-select">
              {#each mentorGroups as group (group.label)}
                <optgroup label={group.label}>
                  {#each group.items as m (m.id)}
                    <option value={m.id}>{m.name}</option>
                  {/each}
                </optgroup>
              {/each}
            </select>
          {/if}
        </div>
      </div>

      {#if selectedMentor}
        <div class="flex items-center gap-3 p-3 rounded-md border border-border bg-secondary/40">
          <Avatar src={selectedMentor.avatar} name={selectedMentor.name} size="sm" />
          <div class="min-w-0 leading-tight">
            <p class="text-xs font-bold text-foreground truncate">{selectedMentor.name}</p>
            <p class="text-2xs text-muted-foreground truncate">
              {selectedMentor.department}{selectedMentor.skills.length ? ` · ${selectedMentor.skills.slice(0, 3).join(', ')}` : ''}
            </p>
          </div>
        </div>
      {/if}

      <fieldset class="field border-0 p-0 m-0">
        <legend class="field-label p-0 mb-1.5">Team size <span class="font-normal text-muted-foreground">(including you)</span></legend>
        <div class="grid grid-cols-7 gap-1.5">
          {#each teamSizes as size (size)}
            <label
              class="h-9 flex items-center justify-center rounded-md border text-sm font-semibold tabular cursor-pointer transition-colors
                {newProjectTeamSize === size
                ? 'bg-accent text-accent-foreground border-accent'
                : 'border-border text-muted-foreground hover:bg-secondary hover:text-foreground'}"
            >
              <input type="radio" name="team-size" value={size} bind:group={newProjectTeamSize} class="sr-only" />
              {size}
            </label>
          {/each}
        </div>
        <p class="field-hint mt-1.5">
          You can invite {newProjectTeamSize - 1} teammate{newProjectTeamSize - 1 === 1 ? '' : 's'}. Invitations stop once the team is full.
        </p>
      </fieldset>

      <div
        class="p-3 bg-warning/10 border border-warning/25 text-warning rounded-md flex gap-2.5 text-xs leading-relaxed"
      >
        <ShieldAlert class="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
        <span>
          New projects must be approved by faculty before teams and tasks can be managed.
        </span>
      </div>
    </form>

    {#snippet footer()}
      <Button type="button" variant="outline" onclick={() => (createDialogOpen = false)}>Cancel</Button>
      <Button type="submit" form="create-project-form" variant="primary" loading={submitting} disabled={mentors.length === 0}>
        Submit proposal
      </Button>
    {/snippet}
  </Dialog>
{/if}
