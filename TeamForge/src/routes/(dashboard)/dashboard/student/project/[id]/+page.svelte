<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { auth } from '$lib/stores/auth.svelte';
  import { newId } from '$lib/utils/id';
  import {
    db,
    type Project,
    type Task,
    type Thread,
    type ProjectFile,
    type Milestone,
    type WeeklyReport,
    type CategorizedFeedback,
    type Meeting, memberRoleLabel, isTeamLeader, canManageProject } from '$lib/services/db';
  import { toast } from '$lib/stores/toast.svelte';
  import { storeFileBlob, getFileBlob, formatBytes, inferFileCategory } from '$lib/services/fileStorage';
  import {
    FolderKanban,
    UserPlus,
    Plus,
    CheckCircle2,
    Check,
    Circle,
    Calendar,
    FileText,
    FileImage,
    FileCode,
    File as FileIcon,
    Send,
    MessageCircle,
    Upload,
    Clock,
    Download,
    MapPin,
    ClipboardList
  } from 'lucide-svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import Dialog from '$lib/components/ui/Dialog.svelte';
  import Tabs from '$lib/components/ui/Tabs.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import EmptyState from '$lib/components/ui/EmptyState.svelte';
  import ProgressBar from '$lib/components/ui/ProgressBar.svelte';
  import Avatar from '$lib/components/ui/Avatar.svelte';

  const projectId = $derived($page.params.id);

  /*
    `project` used to be derived straight from `db.getProjects()`. Because the
    store is a plain localStorage read rather than reactive state, nothing
    re-ran after a write — ticking a milestone saved it but left the checkbox
    unchanged until a reload. It is loaded alongside the rest of the page data
    now, so every mutation path refreshes it.
  */
  let project = $state<Project | undefined>(undefined);
  let tasks = $state<Task[]>([]);
  let threads = $state<Thread[]>([]);
  let files = $state<ProjectFile[]>([]);
  let weeklyReports = $state<WeeklyReport[]>([]);
  let feedbackList = $state<CategorizedFeedback[]>([]);
  let meetings = $state<Meeting[]>([]);
  let loaded = $state(false);

  const completedMilestones = $derived(project ? project.milestones.filter((m) => m.completed).length : 0);
  const milestoneProg = $derived(
    project && project.milestones.length > 0
      ? Math.round((completedMilestones / project.milestones.length) * 100)
      : 0
  );
  const approvedReps = $derived(weeklyReports.filter((r) => r.status === 'approved').length);
  const allDone = $derived(
    project && project.milestones.length > 0 && project.milestones.every((m) => m.completed)
  );

  const today = new Date().toISOString().split('T')[0];
  const nextMilestone = $derived(
    project
      ? [...project.milestones].filter((m) => !m.completed).sort((a, b) => a.deadline.localeCompare(b.deadline))[0]
      : undefined
  );

  let activeTab = $state('overview');

  let inviteDialogOpen = $state(false);
  let inviteEmail = $state('');

  let taskDialogOpen = $state(false);
  let selectedTask = $state<Task | null>(null);
  let newTaskDialogOpen = $state(false);

  let taskTitle = $state('');
  let taskDesc = $state('');
  let taskPriority = $state<'low' | 'medium' | 'high'>('medium');
  let taskDeadline = $state('');
  let taskAssignee = $state('');

  let commentText = $state('');

  let showMilestoneForm = $state(false);
  let milestoneTitle = $state('');
  let milestoneDeadline = $state('');

  let showThreadForm = $state(false);
  let threadTitle = $state('');
  let threadContent = $state('');
  let selectedThread = $state<Thread | null>(null);
  let replyText = $state('');

  let fileDialogOpen = $state(false);
  let selectedFile = $state<File | null>(null);
  let uploading = $state(false);
  const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB — plenty for a browser-local demo store

  // Weekly Report Forms
  let reportWeekNumber = $state(1);
  let reportAchievements = $state('');
  let reportPlannedTasks = $state('');
  let reportBlockers = $state('');
  let showReportSubmitForm = $state(false);

  const columns = [
    { key: 'todo', label: 'To do', rule: 'bg-muted-foreground' },
    { key: 'inprogress', label: 'In progress', rule: 'bg-info' },
    { key: 'review', label: 'In review', rule: 'bg-warning' },
    { key: 'completed', label: 'Completed', rule: 'bg-success' }
  ] as const;

  const feedbackCategories = [
    { key: 'code', label: 'Code quality' },
    { key: 'documentation', label: 'Documentation' },
    { key: 'ui', label: 'UI / UX' },
    { key: 'testing', label: 'Testing' },
    { key: 'presentation', label: 'Presentation' }
  ] as const;

  onMount(() => {
    loadData();
    loaded = true;
  });

  $effect(() => {
    if (projectId) {
      loadData();
    }
  });

  function loadData() {
    if (projectId) {
      project = db.getProjects().find((p) => p.id === projectId);
      tasks = db.getTasks().filter((t) => t.projectId === projectId);
      threads = db.getThreads().filter((t) => t.projectId === projectId);
      files = db.getFiles().filter((f) => f.projectId === projectId);
      weeklyReports = db.getWeeklyReports(projectId);
      feedbackList = db.getFeedback(projectId);
      meetings = db.getMeetings(projectId);
    }
  }

  function handleWeeklyReportSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!project || !auth.user) return;
    try {
      db.submitWeeklyReport(
        project.id,
        reportWeekNumber,
        auth.user.id,
        auth.user.name,
        reportAchievements,
        reportPlannedTasks,
        reportBlockers
      );
      toast.success('Weekly report submitted successfully!');
      showReportSubmitForm = false;
      reportAchievements = '';
      reportPlannedTasks = '';
      reportBlockers = '';
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit report');
    }
  }

  /** Team leader, mentor or admin — the only people who change milestones and tasks. */
  const canManage = $derived(!!project && canManageProject(project, auth.user));
  const MANAGE_ONLY = 'Only the team leader and the mentor can change milestones and tasks.';

  function toggleMilestone(mId: string) {
    if (!project) return;
    if (!canManage) return toast.error(MANAGE_ONLY);
    try {
      const updated = project.milestones.map((m) => (m.id === mId ? { ...m, completed: !m.completed } : m));
      db.updateProject(project.id, { milestones: updated });
      loadData();
      toast.success('Milestone updated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update milestone');
    }
  }

  function addMilestone(e: SubmitEvent) {
    if (!canManage) {
      e.preventDefault();
      return toast.error(MANAGE_ONLY);
    }
    e.preventDefault();
    if (!project || !milestoneTitle) return;
    try {
      const newM: Milestone = {
        id: newId('m'),
        title: milestoneTitle,
        deadline: milestoneDeadline || new Date().toISOString().split('T')[0],
        completed: false
      };
      db.updateProject(project.id, { milestones: [...project.milestones, newM] });
      toast.success('Milestone added!');
      milestoneTitle = '';
      milestoneDeadline = '';
      showMilestoneForm = false;
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add milestone');
    }
  }

  // ------------------------------------------------ team size, skills, mentor
  /** Open places left, counting outstanding invitations. `null` = no limit (legacy project). */
  const seatsLeft = $derived(project ? db.openSeats(project) : null);
  const mentor = $derived(project?.mentorId ? db.getUser(project.mentorId) : undefined);

  /** Which required skills someone on the team already has. */
  const skillCoverage = $derived.by(() => {
    if (!project?.requiredSkills?.length) return [];
    const teamSkills = new Set(
      project.members.flatMap((m) => db.getUser(m.userId)?.skills ?? []).map((s) => s.toLowerCase())
    );
    return project.requiredSkills.map((skill) => ({ skill, covered: teamSkills.has(skill.toLowerCase()) }));
  });
  const missingSkills = $derived(skillCoverage.filter((c) => !c.covered).map((c) => c.skill));

  /**
   * Classmates worth inviting: available students, not already on or invited
   * to this team, ranked by how many still-missing skills they bring.
   */
  const inviteSuggestions = $derived.by(() => {
    if (!project || missingSkills.length === 0) return [];
    const taken = new Set([...project.members.map((m) => m.userId), ...project.pendingInvites]);
    const wanted = missingSkills.map((s) => s.toLowerCase());
    return db
      .getUsers()
      .filter((u) => u.role === 'student' && u.availability && !taken.has(u.id))
      .map((u) => ({ user: u, brings: u.skills.filter((s) => wanted.includes(s.toLowerCase())) }))
      .filter((c) => c.brings.length > 0)
      .sort((a, b) => b.brings.length - a.brings.length)
      .slice(0, 3);
  });

  function handleInvite(e: SubmitEvent) {
    e.preventDefault();
    if (!project) return;
    try {
      db.inviteToProject(project.id, inviteEmail, auth.user ?? undefined);
      toast.success('Teammate invited successfully!');
      inviteDialogOpen = false;
      inviteEmail = '';
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Invitation failed');
    }
  }

  function handleCreateTask(e: SubmitEvent) {
    if (!canManage) {
      e.preventDefault();
      return toast.error(MANAGE_ONLY);
    }
    e.preventDefault();
    if (!project) return;
    try {
      const assignees = taskAssignee ? [taskAssignee] : [];
      db.createTask(
        project.id,
        taskTitle,
        taskDesc,
        taskPriority,
        taskDeadline || new Date().toISOString().split('T')[0],
        assignees
      );
      toast.success('Task created successfully');
      newTaskDialogOpen = false;
      taskTitle = '';
      taskDesc = '';
      taskPriority = 'medium';
      taskDeadline = '';
      taskAssignee = '';
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create task');
    }
  }

  function updateTaskColumn(taskId: string, col: Task['column']) {
    if (!canManage) return toast.error(MANAGE_ONLY);
    try {
      db.updateTask(taskId, { column: col });
      loadData();
      if (selectedTask && selectedTask.id === taskId) {
        selectedTask.column = col;
      }
    } catch (err) {
      toast.error('Failed to move task');
    }
  }

  function viewTaskDetails(t: Task) {
    selectedTask = t;
    taskDialogOpen = true;
  }

  function postComment(e: SubmitEvent) {
    e.preventDefault();
    if (!selectedTask || !commentText || !auth.user) return;
    try {
      const comment = db.addComment(selectedTask.id, auth.user, commentText);
      selectedTask.comments = [...selectedTask.comments, comment];
      commentText = '';
      loadData();
    } catch (err) {
      toast.error('Failed to submit comment');
    }
  }

  function handleCreateThread(e: SubmitEvent) {
    e.preventDefault();
    if (!project || !auth.user) return;
    try {
      db.createThread(project.id, threadTitle, threadContent, auth.user);
      toast.success('Thread posted successfully!');
      threadTitle = '';
      threadContent = '';
      showThreadForm = false;
      loadData();
    } catch (err) {
      toast.error('Failed to post thread');
    }
  }

  function handleCreateReply(e: SubmitEvent) {
    e.preventDefault();
    if (!selectedThread || !replyText || !auth.user) return;
    try {
      const reply = db.addReply(selectedThread.id, replyText, auth.user);
      selectedThread.replies = [...selectedThread.replies, reply];
      replyText = '';
      loadData();
    } catch (err) {
      toast.error('Failed to reply');
    }
  }

  async function handleUploadFile(e: SubmitEvent) {
    e.preventDefault();
    if (!project || !auth.user || !selectedFile) return;
    if (selectedFile.size > MAX_FILE_BYTES) {
      toast.error(`File is too large (max ${formatBytes(MAX_FILE_BYTES)}).`);
      return;
    }
    uploading = true;
    try {
      const newFile = db.uploadFile(
        project.id,
        selectedFile.name,
        formatBytes(selectedFile.size),
        inferFileCategory(selectedFile),
        auth.user
      );
      try {
        await storeFileBlob(newFile.id, selectedFile);
      } catch (uploadErr) {
        // The bytes never arrived — drop the record so the list doesn't offer
        // a file that can't be downloaded.
        db.saveFiles(db.getFiles().filter((f) => f.id !== newFile.id));
        throw uploadErr;
      }
      toast.success(`"${selectedFile.name}" uploaded successfully`);
      selectedFile = null;
      fileDialogOpen = false;
      loadData();
    } catch (err) {
      toast.error('Failed to upload file');
    } finally {
      uploading = false;
    }
  }

  async function downloadFile(f: ProjectFile) {
    const blob = await getFileBlob(f.id);
    if (!blob) {
      toast.warning('No stored content for this file (seeded demo record).');
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = f.name;
    a.click();
    URL.revokeObjectURL(url);
  }

  function fileIcon(type: string) {
    if (type === 'image') return FileImage;
    if (type === 'code') return FileCode;
    if (type === 'pdf' || type === 'doc') return FileText;
    return FileIcon;
  }

  const priorityTone = { high: 'danger', medium: 'warning', low: 'info' } as const;
  const statusTone = { active: 'success', pending: 'warning', rejected: 'danger', archived: 'secondary' } as const;
  const reportTone = { approved: 'success', pending: 'warning', revision_requested: 'danger' } as const;
  const reportLabel = {
    approved: 'Approved',
    pending: 'Pending review',
    revision_requested: 'Revision requested'
  } as const;
</script>

<svelte:head>
  <title>{project ? `${project.name} — TeamForge` : 'Project Workspace — TeamForge'}</title>
</svelte:head>

{#if !loaded}
  <div class="flex flex-col gap-6 max-w-7xl" aria-busy="true">
    <div class="skeleton h-8 w-72"></div>
    <div class="skeleton h-4 w-96"></div>
    <div class="skeleton h-10 w-full"></div>
    <div class="skeleton h-64 w-full"></div>
    <span class="sr-only">Loading project workspace…</span>
  </div>
{:else if !project}
  <div class="max-w-2xl">
    <EmptyState
      icon={FolderKanban}
      title="Project not found"
      description="This workspace either does not exist or you are no longer a member of the team."
    >
      {#snippet action()}
        <a href="/dashboard/student"><Button variant="outline" size="sm">Back to dashboard</Button></a>
      {/snippet}
    </EmptyState>
  </div>
{:else}
  <div class="flex flex-col gap-6 max-w-7xl">
    <PageHeader
      title={project.name}
      breadcrumbs={[{ label: 'Dashboard', href: '/dashboard/student' }]}
      description={project.description}
    >
      {#snippet actions()}
        <!-- Only the team leader brings people onto the team. -->
        {#if project && isTeamLeader(project, auth.user?.id)}
          <Button
            variant="outline"
            size="sm"
            onclick={() => (inviteDialogOpen = true)}
            disabled={seatsLeft === 0}
            title={seatsLeft === 0 ? 'Every place on the team is filled or invited' : undefined}
          >
            <UserPlus class="w-3.5 h-3.5" />
            {seatsLeft === 0 ? 'Team full' : 'Invite teammates'}
          </Button>
        {/if}
      {/snippet}
    </PageHeader>

    <!--
      A strip of the four facts that decide what to do next in this workspace,
      so the answer does not depend on which tab happens to be open.
    -->
    <dl
      class="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border border border-border rounded-lg overflow-hidden"
    >
      <div class="bg-card p-4">
        <dt class="eyebrow">Status</dt>
        <dd class="mt-1.5">
          <Badge variant={statusTone[project.status]} dot class="capitalize">{project.status}</Badge>
        </dd>
      </div>
      <div class="bg-card p-4">
        <dt class="eyebrow">Milestones</dt>
        <dd class="font-display text-lg text-foreground tabular mt-1 leading-none">
          {completedMilestones}<span class="text-muted-foreground">/{project.milestones.length}</span>
        </dd>
        <ProgressBar
          class="mt-2"
          value={milestoneProg}
          tone={milestoneProg === 100 ? 'success' : 'accent'}
          size="sm"
          label="Milestone completion"
        />
      </div>
      <div class="bg-card p-4">
        <dt class="eyebrow">Next deadline</dt>
        <dd class="text-sm font-bold text-foreground mt-1.5 tabular">
          {#if nextMilestone}
            <span class={nextMilestone.deadline < today ? 'text-destructive' : ''}>
              {nextMilestone.deadline}
            </span>
            <span class="block text-2xs font-normal text-muted-foreground truncate mt-0.5">
              {nextMilestone.title}
            </span>
          {:else}
            <span class="text-muted-foreground font-normal">Nothing outstanding</span>
          {/if}
        </dd>
      </div>
      <div class="bg-card p-4">
        <dt class="eyebrow">Team</dt>
        <dd class="flex -space-x-2 mt-2">
          {#each project.members.slice(0, 5) as member (member.userId)}
            <Avatar
              src={member.avatar}
              name={member.name}
              size="sm"
              class="ring-2 ring-card"
              title="{member.name} ({memberRoleLabel(project, member)})"
            />
          {/each}
          {#if project.members.length > 5}
            <span
              class="w-8 h-8 rounded-md ring-2 ring-card bg-secondary border border-border flex items-center
                justify-center text-3xs font-bold text-muted-foreground"
            >
              +{project.members.length - 5}
            </span>
          {/if}
        </dd>
      </div>
    </dl>

    <Tabs
      label="Project workspace sections"
      variant="underline"
      items={[
        { value: 'overview', label: 'Overview' },
        { value: 'kanban', label: 'Tasks', badge: tasks.length },
        { value: 'discussions', label: 'Discussions', badge: threads.length },
        { value: 'files', label: 'Files', badge: files.length },
        { value: 'weekly-reports', label: 'Weekly reports', badge: weeklyReports.length },
        { value: 'feedback-timeline', label: 'Timeline & feedback' }
      ]}
      bind:active={activeTab}
    />

    {#if activeTab === 'overview'}
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <div class="lg:col-span-2 flex flex-col gap-4">
          <Card title="Project brief">
            <p class="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {project.description}
            </p>
            {#if skillCoverage.length > 0}
              <div class="mt-5 pt-4 border-t border-border">
                <div class="flex items-center justify-between gap-3">
                  <h4 class="eyebrow">Required skills</h4>
                  <span class="text-2xs text-muted-foreground tabular">
                    {skillCoverage.length - missingSkills.length}/{skillCoverage.length} covered by the team
                  </span>
                </div>
                <ul class="flex flex-wrap gap-1.5 mt-2.5">
                  {#each skillCoverage as c (c.skill)}
                    <li
                      class="inline-flex items-center gap-1 h-6 px-2 rounded-sm text-2xs font-semibold
                        {c.covered ? 'bg-success/12 text-success' : 'border border-dashed border-border text-muted-foreground'}"
                      title={c.covered ? 'Someone on the team has this skill' : 'Nobody on the team has this yet'}
                    >
                      {#if c.covered}<Check class="w-3 h-3" aria-hidden="true" />{/if}
                      {c.skill}
                      <span class="sr-only">{c.covered ? '(covered)' : '(still needed)'}</span>
                    </li>
                  {/each}
                </ul>
              </div>
            {/if}
          </Card>

          <Card
            title="Milestones"
            description={canManage ? undefined : 'Set by your team leader and mentor.'}
          >
            {#snippet actions()}
              {#if canManage}
                <Button
                  variant="outline"
                  size="sm"
                  aria-expanded={showMilestoneForm}
                  onclick={() => (showMilestoneForm = !showMilestoneForm)}
                >
                  <Plus class="w-3.5 h-3.5" />
                  Add
                </Button>
              {/if}
            {/snippet}

            {#if showMilestoneForm && canManage}
              <form
                onsubmit={addMilestone}
                class="p-3.5 border border-border rounded-md flex flex-col sm:flex-row gap-3 bg-muted/30 items-end mb-4"
              >
                <div class="field flex-1 w-full">
                  <label for="m-title" class="field-label">Milestone title</label>
                  <input
                    id="m-title"
                    type="text"
                    placeholder="e.g. Set up API routing"
                    bind:value={milestoneTitle}
                    required
                    class="field-input"
                  />
                </div>
                <div class="field w-full sm:w-auto">
                  <label for="m-date" class="field-label">Deadline</label>
                  <input id="m-date" type="date" bind:value={milestoneDeadline} class="field-input" />
                </div>
                <Button type="submit" variant="primary" class="w-full sm:w-auto shrink-0">Create</Button>
              </form>
            {/if}

            <ul class="flex flex-col gap-1.5">
              {#each project.milestones as m (m.id)}
                {@const overdue = !m.completed && m.deadline < today}
                <li
                  class="flex items-center justify-between gap-3 p-3 border border-border rounded-md
                    hover:bg-muted/30 transition-colors"
                >
                  <div class="flex items-center gap-3 min-w-0">
                    {#if canManage}
                      <button
                        onclick={() => toggleMilestone(m.id)}
                        aria-pressed={m.completed}
                        aria-label="{m.completed ? 'Mark incomplete' : 'Mark complete'}: {m.title}"
                        class="shrink-0 rounded-sm text-muted-foreground hover:text-accent cursor-pointer transition-colors"
                      >
                        {#if m.completed}
                          <CheckCircle2 class="w-5 h-5 text-success" />
                        {:else}
                          <Circle class="w-5 h-5" />
                        {/if}
                      </button>
                    {:else}
                      <span class="shrink-0 text-muted-foreground" aria-label={m.completed ? 'Completed' : 'Not completed'}>
                        {#if m.completed}
                          <CheckCircle2 class="w-5 h-5 text-success" />
                        {:else}
                          <Circle class="w-5 h-5" />
                        {/if}
                      </span>
                    {/if}
                    <span
                      class="text-sm font-semibold truncate {m.completed
                        ? 'line-through text-muted-foreground'
                        : 'text-foreground'}"
                    >
                      {m.title}
                    </span>
                  </div>

                  <span
                    class="text-2xs font-semibold shrink-0 flex items-center gap-1.5 tabular
                      {overdue ? 'text-destructive' : 'text-muted-foreground'}"
                  >
                    <Calendar class="w-3.5 h-3.5" aria-hidden="true" />
                    {m.deadline}
                    {#if overdue}<span class="sr-only">(overdue)</span>{/if}
                  </span>
                </li>
              {:else}
                <li>
                  <EmptyState
                    icon={Calendar}
                    title="No milestones yet"
                    description="Break the project into checkpoints — faculty track progress against these."
                    size="sm"
                  />
                </li>
              {/each}
            </ul>
          </Card>
        </div>

        <Card
          title="Team"
          description={project.teamSize
            ? `${project.members.length} of ${project.teamSize} members${seatsLeft ? ` · ${seatsLeft} open` : ''}`
            : `${project.members.length} member${project.members.length === 1 ? '' : 's'}`}
        >
          {#if mentor || project.mentorName}
            <div class="flex items-center gap-3 pb-3 mb-3 border-b border-border">
              <Avatar src={mentor?.avatar ?? ''} name={mentor?.name ?? project.mentorName ?? ''} size="sm" />
              <div class="flex flex-col min-w-0 leading-tight">
                <span class="text-sm font-bold text-foreground truncate">{mentor?.name ?? project.mentorName}</span>
                <span class="text-3xs text-accent uppercase tracking-wider font-semibold">Mentor</span>
              </div>
            </div>
          {/if}
          <ul class="flex flex-col gap-3">
            {#each project.members as member (member.userId)}
              <li class="flex items-center gap-3">
                <Avatar src={member.avatar} name={member.name} size="sm" />
                <div class="flex flex-col min-w-0 leading-tight">
                  <span class="text-sm font-bold text-foreground truncate">{member.name}</span>
                  <span
                    class="text-3xs uppercase tracking-wider
                      {isTeamLeader(project, member.userId) ? 'text-accent font-semibold' : 'text-muted-foreground'}"
                    >{memberRoleLabel(project, member)}</span
                  >
                </div>
              </li>
            {/each}
          </ul>

          {#if project.teamSize}
            <!-- Empty places are drawn so the team's shape is visible at a glance. -->
            <div class="flex gap-1.5 mt-4" aria-hidden="true">
              {#each { length: project.teamSize } as _, i (i)}
                <span
                  class="h-1.5 flex-1 rounded-full
                    {i < project.members.length
                    ? 'bg-accent'
                    : i < project.members.length + project.pendingInvites.length
                      ? 'bg-accent/35'
                      : 'bg-border'}"
                ></span>
              {/each}
            </div>
          {/if}

          {#if project.pendingInvites.length > 0}
            <p class="text-2xs text-muted-foreground mt-4 pt-3 border-t border-border">
              {project.pendingInvites.length} invitation{project.pendingInvites.length === 1 ? '' : 's'} awaiting a reply.
            </p>
          {/if}
        </Card>
      </div>
    {:else if activeTab === 'kanban'}
      <div class="flex flex-col gap-4">
        <div class="flex justify-between items-center gap-3">
          <h2 class="font-display text-lg text-foreground">Task board</h2>
          {#if !canManage}
            <p class="text-2xs text-muted-foreground">
              The task board is managed by your team leader and mentor. You can comment on any task.
            </p>
          {/if}
          {#if canManage}
            <Button variant="primary" size="sm" onclick={() => (newTaskDialogOpen = true)}>
              <Plus class="w-3.5 h-3.5" />
              New task
            </Button>
          {/if}
        </div>

        <!-- Four lanes side by side on desktop; on narrow screens they stack so
             the cards stay readable instead of shrinking to a sliver. -->
        <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 items-start">
          {#each columns as col (col.key)}
            {@const colTasks = tasks.filter((t) => t.column === col.key)}
            <section
              aria-label="{col.label} column"
              class="flex flex-col gap-2.5 p-3 bg-muted/40 border border-border rounded-lg xl:min-h-112"
            >
              <div class="flex items-center gap-2 pb-2 border-b border-border">
                <span class="w-1.5 h-1.5 rounded-full {col.rule}" aria-hidden="true"></span>
                <h3 class="text-2xs font-bold uppercase tracking-wider text-foreground">{col.label}</h3>
                <span class="ml-auto text-2xs font-bold text-muted-foreground tabular">{colTasks.length}</span>
              </div>

              <ul class="flex flex-col gap-2.5">
                {#each colTasks as t (t.id)}
                  <li class="bg-card border border-border rounded-md shadow-e1 hover:border-accent/35 transition-colors">
                    <button
                      onclick={() => viewTaskDetails(t)}
                      class="w-full text-left p-3.5 cursor-pointer rounded-t-md"
                    >
                      <div class="flex justify-between items-start gap-2">
                        <span class="text-sm font-bold text-foreground line-clamp-2 leading-snug">
                          {t.title}
                        </span>
                        <Badge variant={priorityTone[t.priority]} size="sm" class="capitalize shrink-0">
                          {t.priority}
                        </Badge>
                      </div>
                      <p class="text-2xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
                        {t.description}
                      </p>
                      <p
                        class="mt-2.5 inline-flex items-center gap-1.5 text-3xs font-semibold tabular
                          {t.deadline < today && t.column !== 'completed'
                          ? 'text-destructive'
                          : 'text-muted-foreground'}"
                      >
                        <Calendar class="w-3 h-3" aria-hidden="true" />
                        {t.deadline}
                      </p>
                    </button>

                    <!-- Status is a labelled select rather than a drag gesture,
                         so moving a task works with a keyboard and on touch. -->
                    {#if canManage}
                      <div class="px-3.5 pb-3 pt-0">
                        <label for="move-{t.id}" class="sr-only">Status of "{t.title}"</label>
                        <select
                          id="move-{t.id}"
                          value={t.column}
                          onchange={(e) => updateTaskColumn(t.id, (e.target as HTMLSelectElement).value as any)}
                          class="field-select h-8 w-full text-2xs font-semibold"
                        >
                          {#each columns as target (target.key)}
                            <option value={target.key}>{target.label}</option>
                          {/each}
                        </select>
                      </div>
                    {/if}
                  </li>
                {:else}
                  <li
                    class="py-6 text-center text-2xs text-muted-foreground border border-dashed border-border rounded-md"
                  >
                    Nothing here
                  </li>
                {/each}
              </ul>
            </section>
          {/each}
        </div>
      </div>
    {:else if activeTab === 'discussions'}
      <div class="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">
        <Card class="lg:col-span-2" title="Threads">
          {#snippet actions()}
            <Button
              variant="outline"
              size="sm"
              aria-expanded={showThreadForm}
              onclick={() => (showThreadForm = !showThreadForm)}
            >
              <Plus class="w-3.5 h-3.5" />
              New
            </Button>
          {/snippet}

          {#if showThreadForm}
            <form
              onsubmit={handleCreateThread}
              class="p-3.5 border border-border rounded-md flex flex-col gap-3 bg-muted/30 mb-4"
            >
              <div class="field">
                <label for="th-title" class="field-label">Thread title</label>
                <input
                  id="th-title"
                  type="text"
                  placeholder="e.g. Design assets link"
                  bind:value={threadTitle}
                  required
                  class="field-input"
                />
              </div>
              <div class="field">
                <label for="th-content" class="field-label">Opening post</label>
                <textarea
                  id="th-content"
                  placeholder="Discuss ideas…"
                  bind:value={threadContent}
                  required
                  rows="3"
                  class="field-textarea"
                ></textarea>
              </div>
              <div class="flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onclick={() => (showThreadForm = false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm">Publish</Button>
              </div>
            </form>
          {/if}

          <ul class="flex flex-col gap-2">
            {#each threads as th (th.id)}
              {@const isOpen = selectedThread?.id === th.id}
              <li>
                <button
                  onclick={() => (selectedThread = th)}
                  aria-current={isOpen ? 'true' : undefined}
                  class="w-full text-left p-3 border rounded-md transition-colors cursor-pointer
                    {isOpen ? 'border-accent bg-accent/8' : 'border-border hover:bg-muted/40'}"
                >
                  <span class="block text-sm font-bold text-foreground">{th.title}</span>
                  <span class="flex items-center gap-2 text-2xs text-muted-foreground mt-1">
                    <span class="truncate">{th.authorName}</span>
                    <span aria-hidden="true">·</span>
                    <span class="tabular">{new Date(th.createdAt).toLocaleDateString()}</span>
                    <span class="ml-auto inline-flex items-center gap-1 font-bold shrink-0">
                      <MessageCircle class="w-3.5 h-3.5" aria-hidden="true" />
                      {th.replies.length}
                    </span>
                  </span>
                </button>
              </li>
            {:else}
              <li>
                <EmptyState
                  icon={MessageCircle}
                  title="No threads yet"
                  description="Start one to keep decisions and links in the project rather than in chat."
                  size="sm"
                />
              </li>
            {/each}
          </ul>
        </Card>

        <Card class="lg:col-span-3">
          {#if selectedThread}
            <article class="flex flex-col gap-4">
              <header class="flex justify-between items-start gap-3 border-b border-border pb-3">
                <div class="min-w-0">
                  <h2 class="text-base font-bold text-foreground">{selectedThread.title}</h2>
                  <p class="text-2xs text-muted-foreground mt-0.5">
                    Started by {selectedThread.authorName} ·
                    <span class="tabular">{new Date(selectedThread.createdAt).toLocaleDateString()}</span>
                  </p>
                </div>
                <button
                  onclick={() => (selectedThread = null)}
                  class="text-2xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer rounded-sm shrink-0"
                >
                  Close
                </button>
              </header>

              <p
                class="text-sm text-muted-foreground leading-relaxed p-3.5 bg-muted/30 border border-border rounded-md whitespace-pre-wrap"
              >
                {selectedThread.content}
              </p>

              <ul class="flex flex-col gap-2.5 max-h-80 overflow-y-auto">
                {#each selectedThread.replies as rep (rep.id)}
                  <li class="flex gap-2.5">
                    <Avatar src={rep.authorAvatar} name={rep.authorName} size="xs" class="mt-0.5" />
                    <div class="flex-1 min-w-0 p-2.5 border border-border rounded-md bg-card">
                      <div class="flex items-baseline justify-between gap-3">
                        <span class="text-2xs font-bold text-foreground">{rep.authorName}</span>
                        <time class="text-3xs text-muted-foreground tabular shrink-0" datetime={rep.createdAt}>
                          {new Date(rep.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </time>
                      </div>
                      <p class="text-xs text-muted-foreground mt-1 leading-relaxed whitespace-pre-wrap">
                        {rep.content}
                      </p>
                    </div>
                  </li>
                {:else}
                  <li class="text-xs text-muted-foreground py-2">
                    No replies yet — be the first to respond.
                  </li>
                {/each}
              </ul>

              <form onsubmit={handleCreateReply} class="flex gap-2 pt-2 border-t border-border">
                <label for="reply-input" class="sr-only">Write a reply</label>
                <input
                  id="reply-input"
                  type="text"
                  placeholder="Write a reply…"
                  bind:value={replyText}
                  required
                  class="field-input flex-1"
                />
                <Button type="submit" variant="primary" size="icon" aria-label="Send reply">
                  <Send class="w-4 h-4" />
                </Button>
              </form>
            </article>
          {:else}
            <EmptyState
              icon={MessageCircle}
              title="No thread selected"
              description="Pick a thread on the left to read it and reply."
            />
          {/if}
        </Card>
      </div>
    {:else if activeTab === 'files'}
      <div class="flex flex-col gap-4">
        <div class="flex justify-between items-center gap-3">
          <h2 class="font-display text-lg text-foreground">File library</h2>
          <Button variant="primary" size="sm" onclick={() => (fileDialogOpen = true)}>
            <Upload class="w-3.5 h-3.5" />
            Upload file
          </Button>
        </div>

        {#if files.length === 0}
          <EmptyState
            icon={FileText}
            title="No files yet"
            description="Specs, diagrams and code drops live here. Files are stored in this browser, so they stay on this device."
          >
            {#snippet action()}
              <Button variant="outline" size="sm" onclick={() => (fileDialogOpen = true)}>
                <Upload class="w-3.5 h-3.5" />
                Upload file
              </Button>
            {/snippet}
          </EmptyState>
        {:else}
          <!-- A list, not a card grid: file names are the scannable column and
               they were being truncated to fit a fixed tile. -->
          <Card flush>
            <ul class="divide-y divide-border">
              {#each files as f (f.id)}
                {@const Icon = fileIcon(f.type)}
                <li class="flex items-center gap-3.5 p-3.5 hover:bg-muted/30 transition-colors">
                  <span
                    class="w-9 h-9 rounded-md bg-secondary text-muted-foreground flex items-center justify-center shrink-0"
                    aria-hidden="true"
                  >
                    <Icon class="w-4.5 h-4.5" />
                  </span>

                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-semibold text-foreground truncate">{f.name}</p>
                    <p class="text-2xs text-muted-foreground mt-0.5">
                      <span class="tabular">{f.size}</span> · v{f.version} · {f.uploadedByName}
                    </p>
                  </div>

                  <Button variant="outline" size="sm" class="shrink-0" onclick={() => downloadFile(f)}>
                    <Download class="w-3.5 h-3.5" />
                    <span class="hidden sm:inline">Download</span>
                    <span class="sr-only sm:hidden">Download {f.name}</span>
                  </Button>
                </li>
              {/each}
            </ul>
          </Card>
        {/if}
      </div>
    {:else if activeTab === 'weekly-reports'}
      <div class="flex flex-col gap-4">
        <div class="flex justify-between items-center gap-3">
          <h2 class="font-display text-lg text-foreground">Weekly progress reports</h2>
          <Button
            variant="primary"
            size="sm"
            aria-expanded={showReportSubmitForm}
            onclick={() => (showReportSubmitForm = !showReportSubmitForm)}
          >
            <Plus class="w-3.5 h-3.5" />
            Submit report
          </Button>
        </div>

        {#if showReportSubmitForm}
          <Card title="New weekly report">
            <form onsubmit={handleWeeklyReportSubmit} class="flex flex-col gap-4">
              <div class="field max-w-40">
                <label for="rep-week" class="field-label">Week number</label>
                <input
                  id="rep-week"
                  type="number"
                  min="1"
                  max="16"
                  bind:value={reportWeekNumber}
                  required
                  class="field-input"
                />
              </div>

              <div class="field">
                <label for="rep-ach" class="field-label">Key achievements</label>
                <textarea
                  id="rep-ach"
                  placeholder="What did the team accomplish this week?"
                  bind:value={reportAchievements}
                  required
                  rows="3"
                  class="field-textarea"
                ></textarea>
              </div>

              <div class="field">
                <label for="rep-plan" class="field-label">Planned for next week</label>
                <textarea
                  id="rep-plan"
                  placeholder="What does the team plan to execute next week?"
                  bind:value={reportPlannedTasks}
                  required
                  rows="3"
                  class="field-textarea"
                ></textarea>
              </div>

              <div class="field">
                <label for="rep-block" class="field-label">Blockers</label>
                <textarea
                  id="rep-block"
                  placeholder="Any technical blockers or dependencies?"
                  bind:value={reportBlockers}
                  rows="2"
                  aria-describedby="rep-block-hint"
                  class="field-textarea"
                ></textarea>
                <p id="rep-block-hint" class="field-hint">Optional — leave empty if nothing is stuck.</p>
              </div>

              <div class="flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onclick={() => (showReportSubmitForm = false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm">Submit report</Button>
              </div>
            </form>
          </Card>
        {/if}

        <ul class="flex flex-col gap-3">
          {#each weeklyReports as rep (rep.id)}
            <li>
              <Card>
                <header class="flex justify-between items-start gap-3 border-b border-border pb-3">
                  <div class="min-w-0">
                    <h3 class="text-sm font-bold text-foreground">Week {rep.weekNumber}</h3>
                    <p class="text-2xs text-muted-foreground mt-0.5">
                      {rep.submittedByName} ·
                      <span class="tabular">{new Date(rep.submittedAt).toLocaleDateString()}</span>
                    </p>
                  </div>
                  <Badge variant={reportTone[rep.status]} dot class="shrink-0">
                    {reportLabel[rep.status]}
                  </Badge>
                </header>

                <dl class="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                  <div class="p-3 bg-muted/30 rounded-md border border-border">
                    <dt class="eyebrow">Achievements</dt>
                    <dd class="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed mt-1.5">
                      {rep.achievements}
                    </dd>
                  </div>
                  <div class="p-3 bg-muted/30 rounded-md border border-border">
                    <dt class="eyebrow">Planned work</dt>
                    <dd class="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed mt-1.5">
                      {rep.plannedTasks}
                    </dd>
                  </div>
                  <div class="p-3 bg-muted/30 rounded-md border border-border">
                    <dt class="eyebrow">Blockers</dt>
                    <dd class="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed mt-1.5">
                      {rep.blockers || 'None'}
                    </dd>
                  </div>
                </dl>

                {#if rep.feedback}
                  <div class="mt-3 p-3.5 bg-accent/8 border border-accent/25 rounded-md">
                    <p class="eyebrow">Supervisor feedback</p>
                    <p class="text-xs text-foreground leading-relaxed mt-1.5">{rep.feedback}</p>
                  </div>
                {/if}
              </Card>
            </li>
          {:else}
            <li>
              <EmptyState
                icon={ClipboardList}
                title="No reports submitted"
                description="Weekly reports are how faculty follow the project between reviews. Submit the first one for this week."
              >
                {#snippet action()}
                  <Button variant="outline" size="sm" onclick={() => (showReportSubmitForm = true)}>
                    Submit report
                  </Button>
                {/snippet}
              </EmptyState>
            </li>
          {/each}
        </ul>
      </div>
    {:else if activeTab === 'feedback-timeline'}
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <div class="lg:col-span-2 flex flex-col gap-4">
          <Card title="Project lifecycle">
            <ol class="flex flex-col gap-5 relative pl-6 border-l border-border ml-2">
              {#snippet stage(
                state: 'done' | 'active' | 'blocked' | 'todo',
                heading: string,
                detail: string
              )}
                <li class="relative">
                  <span
                    class="absolute left-[-1.9rem] top-0.5 w-3.5 h-3.5 rounded-full border-2 border-card
                      {state === 'done'
                      ? 'bg-success'
                      : state === 'active'
                        ? 'bg-accent'
                        : state === 'blocked'
                          ? 'bg-destructive'
                          : 'bg-muted-foreground/40'}"
                    aria-hidden="true"
                  ></span>
                  <p class="text-sm font-bold text-foreground">{heading}</p>
                  <p class="text-2xs text-muted-foreground mt-1 leading-relaxed">{detail}</p>
                </li>
              {/snippet}

              {@render stage('done', 'Proposal submitted', 'Drafted and sent for faculty verification.')}

              {@render stage(
                project.status === 'active' ? 'done' : project.status === 'rejected' ? 'blocked' : 'active',
                `Faculty review — ${project.status}`,
                project.status === 'active'
                  ? 'Proposal approved. The project is in progress.'
                  : project.status === 'rejected'
                    ? 'Proposal rejected. Speak to your supervisor about next steps.'
                    : 'Waiting on approval from department faculty.'
              )}

              {@render stage(
                milestoneProg === 100 ? 'done' : milestoneProg > 0 ? 'active' : 'todo',
                `Milestones — ${milestoneProg}% done`,
                `${completedMilestones} of ${project.milestones.length} milestones finished.`
              )}

              {@render stage(
                approvedReps > 0 ? 'done' : 'todo',
                `Weekly reviews — ${approvedReps} approved`,
                `${weeklyReports.length} report${weeklyReports.length === 1 ? '' : 's'} submitted, ${approvedReps} approved by faculty.`
              )}

              {@render stage(
                allDone ? 'done' : 'todo',
                'Final submission & evaluation',
                allDone
                  ? 'All milestones cleared — ready for final evaluation.'
                  : 'Complete all milestones and reviews to qualify for final grading.'
              )}
            </ol>
          </Card>

          <Card title="Supervisor review meetings">
            <ul class="flex flex-col gap-2.5">
              {#each meetings as meet (meet.id)}
                <li class="p-3.5 border border-border rounded-md">
                  <div class="flex justify-between items-start gap-3">
                    <h3 class="text-sm font-bold text-foreground">{meet.title}</h3>
                    <Badge variant={meet.status === 'scheduled' ? 'success' : 'danger'} size="sm" class="shrink-0">
                      {meet.status === 'scheduled' ? 'Scheduled' : 'Cancelled'}
                    </Badge>
                  </div>
                  <dl class="flex flex-col gap-1 mt-2 text-2xs text-muted-foreground">
                    <div class="flex items-center gap-1.5">
                      <dt class="sr-only">When</dt>
                      <Clock class="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <dd class="tabular">{meet.date} at {meet.time}</dd>
                    </div>
                    <div class="flex items-center gap-1.5 min-w-0">
                      <dt class="sr-only">Where</dt>
                      <MapPin class="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <dd class="truncate font-semibold text-foreground">{meet.linkOrLocation}</dd>
                    </div>
                  </dl>
                </li>
              {:else}
                <li>
                  <EmptyState
                    icon={Calendar}
                    title="No meetings scheduled"
                    description="Your supervisor books mentor reviews from the faculty side."
                    size="sm"
                  />
                </li>
              {/each}
            </ul>
          </Card>
        </div>

        <Card title="Categorised feedback">
          <div class="flex flex-col gap-3">
            {#each feedbackCategories as cat (cat.key)}
              {@const catFb = feedbackList.filter((f) => f.category === cat.key)}
              <section class="p-3 border border-border rounded-md bg-muted/30">
                <div class="flex justify-between items-center gap-2">
                  <h3 class="text-2xs font-bold uppercase tracking-wider text-foreground">{cat.label}</h3>
                  <Badge variant={catFb.length > 0 ? 'primary' : 'outline'} size="sm">{catFb.length}</Badge>
                </div>

                {#each catFb as fb (fb.id)}
                  <div class="border-t border-border pt-2 mt-2">
                    <p class="text-xs text-foreground leading-relaxed">{fb.feedbackText}</p>
                    <p class="text-3xs text-muted-foreground mt-1">
                      {fb.facultyName} ·
                      <span class="tabular">{new Date(fb.createdAt).toLocaleDateString()}</span>
                    </p>
                  </div>
                {:else}
                  <p class="text-2xs text-muted-foreground mt-1.5">Nothing recorded yet.</p>
                {/each}
              </section>
            {/each}
          </div>
        </Card>
      </div>
    {/if}
  </div>

  <Dialog bind:open={inviteDialogOpen} size="sm" title="Invite a classmate">
    <form id="invite-project-form" onsubmit={handleInvite} class="field">
      <label for="inv-email" class="field-label">Classmate's email address</label>
      <input
        id="inv-email"
        type="email"
        placeholder="classmate@university.edu"
        bind:value={inviteEmail}
        required
        aria-describedby="inv-email-hint"
        class="field-input"
      />
      <p id="inv-email-hint" class="field-hint">
        They will see the invitation on their dashboard and can accept or decline.
        {#if seatsLeft !== null}{seatsLeft} place{seatsLeft === 1 ? '' : 's'} left on the team.{/if}
      </p>

      {#if inviteSuggestions.length > 0}
        <div class="mt-3 pt-3 border-t border-border flex flex-col gap-2">
          <p class="eyebrow">Brings a skill you still need</p>
          {#each inviteSuggestions as s (s.user.id)}
            <button
              type="button"
              onclick={() => (inviteEmail = s.user.email)}
              class="flex items-center gap-3 p-2 rounded-md border text-left transition-colors cursor-pointer
                {inviteEmail === s.user.email ? 'border-accent bg-accent/8' : 'border-border hover:bg-secondary'}"
            >
              <Avatar src={s.user.avatar} name={s.user.name} size="sm" />
              <span class="min-w-0 leading-tight">
                <span class="block text-xs font-bold text-foreground truncate">{s.user.name}</span>
                <span class="block text-2xs text-muted-foreground truncate">{s.brings.join(' · ')}</span>
              </span>
            </button>
          {/each}
        </div>
      {/if}
    </form>

    {#snippet footer()}
      <Button type="button" variant="outline" onclick={() => (inviteDialogOpen = false)}>Cancel</Button>
      <Button type="submit" form="invite-project-form" variant="primary" disabled={seatsLeft === 0}>Send invite</Button>
    {/snippet}
  </Dialog>

  <Dialog bind:open={newTaskDialogOpen} title="Create task">
    <form id="new-task-form" onsubmit={handleCreateTask} class="flex flex-col gap-4">
      <div class="field">
        <label for="t-title" class="field-label">Task title</label>
        <input
          id="t-title"
          type="text"
          placeholder="e.g. Implement user authentication"
          bind:value={taskTitle}
          required
          class="field-input"
        />
      </div>

      <div class="field">
        <label for="t-desc" class="field-label">Description</label>
        <textarea
          id="t-desc"
          placeholder="Detail specifications…"
          bind:value={taskDesc}
          required
          rows="3"
          class="field-textarea"
        ></textarea>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div class="field">
          <label for="t-priority" class="field-label">Priority</label>
          <select id="t-priority" bind:value={taskPriority} class="field-select">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>

        <div class="field">
          <label for="t-date" class="field-label">Deadline</label>
          <input id="t-date" type="date" bind:value={taskDeadline} class="field-input" />
        </div>
      </div>

      <div class="field">
        <label for="t-assign" class="field-label">Assignee</label>
        <select id="t-assign" bind:value={taskAssignee} class="field-select">
          <option value="">Unassigned</option>
          {#each project.members as member (member.userId)}
            <option value={member.userId}>{member.name}</option>
          {/each}
        </select>
      </div>
    </form>

    {#snippet footer()}
      <Button type="button" variant="outline" onclick={() => (newTaskDialogOpen = false)}>Cancel</Button>
      <Button type="submit" form="new-task-form" variant="primary">Create task</Button>
    {/snippet}
  </Dialog>

  <Dialog bind:open={taskDialogOpen} title={selectedTask?.title || 'Task details'}>
    {#if selectedTask}
      <div class="flex flex-col gap-4">
        <div class="flex items-center gap-2">
          <Badge variant={priorityTone[selectedTask.priority]} dot class="capitalize">
            {selectedTask.priority} priority
          </Badge>
          <Badge variant="outline">
            {columns.find((c) => c.key === selectedTask!.column)?.label}
          </Badge>
        </div>

        <p
          class="text-sm text-muted-foreground leading-relaxed bg-muted/30 p-3.5 rounded-md border border-border whitespace-pre-wrap"
        >
          {selectedTask.description}
        </p>

        <dl class="grid grid-cols-2 gap-4 border-y border-border py-3">
          <div>
            <dt class="eyebrow">Assignee</dt>
            <dd class="text-sm font-bold text-foreground mt-1">
              {#if selectedTask.assignees.length > 0}
                {project.members.find((m) => m.userId === selectedTask!.assignees[0])?.name ??
                  'Assigned user'}
              {:else}
                Unassigned
              {/if}
            </dd>
          </div>
          <div>
            <dt class="eyebrow">Due date</dt>
            <dd class="text-sm font-bold text-foreground mt-1 tabular">{selectedTask.deadline}</dd>
          </div>
        </dl>

        <section>
          <h3 class="eyebrow">Comments ({selectedTask.comments.length})</h3>
          <ul class="flex flex-col gap-2 max-h-48 overflow-y-auto mt-2">
            {#each selectedTask.comments as comment (comment.id)}
              <li class="flex gap-2.5 p-2.5 border border-border rounded-md bg-muted/30">
                <Avatar src={comment.userAvatar} name={comment.userName} size="xs" />
                <div class="flex-1 min-w-0">
                  <div class="flex items-baseline justify-between gap-3">
                    <span class="text-2xs font-bold text-foreground">{comment.userName}</span>
                    <time class="text-3xs text-muted-foreground tabular shrink-0" datetime={comment.createdAt}>
                      {new Date(comment.createdAt).toLocaleDateString()}
                    </time>
                  </div>
                  <p class="text-xs text-muted-foreground mt-0.5 leading-relaxed">{comment.text}</p>
                </div>
              </li>
            {:else}
              <li class="text-xs text-muted-foreground py-1">No comments yet.</li>
            {/each}
          </ul>

          <form onsubmit={postComment} class="flex gap-2 mt-3">
            <label for="comment-input" class="sr-only">Add a comment</label>
            <input
              id="comment-input"
              type="text"
              placeholder="Add comment…"
              bind:value={commentText}
              required
              class="field-input flex-1"
            />
            <Button type="submit" variant="primary" size="icon" aria-label="Post comment">
              <Send class="w-4 h-4" />
            </Button>
          </form>
        </section>
      </div>
    {/if}
  </Dialog>

  <Dialog bind:open={fileDialogOpen} size="sm" title="Upload project file">
    <form id="upload-file-form" onsubmit={handleUploadFile} class="field">
      <label for="fl-file" class="field-label">Choose file</label>
      <input
        id="fl-file"
        type="file"
        required
        onchange={(e) => (selectedFile = (e.target as HTMLInputElement).files?.[0] ?? null)}
        aria-describedby="fl-file-hint"
        class="w-full text-sm text-foreground cursor-pointer
          file:mr-3 file:py-2 file:px-3.5 file:rounded-md file:border file:border-border
          file:bg-secondary file:text-secondary-foreground file:text-xs file:font-semibold
          file:cursor-pointer hover:file:bg-muted"
      />
      {#if selectedFile}
        <p class="text-xs font-semibold text-foreground mt-1">
          {selectedFile.name} — <span class="tabular">{formatBytes(selectedFile.size)}</span>
        </p>
      {/if}
      <p id="fl-file-hint" class="field-hint">
        Stored in this browser only (max {formatBytes(MAX_FILE_BYTES)}).
      </p>
    </form>

    {#snippet footer()}
      <Button
        type="button"
        variant="outline"
        onclick={() => {
          fileDialogOpen = false;
          selectedFile = null;
        }}
      >
        Cancel
      </Button>
      <Button
        type="submit"
        form="upload-file-form"
        variant="primary"
        disabled={!selectedFile}
        loading={uploading}
      >
        Upload file
      </Button>
    {/snippet}
  </Dialog>
{/if}
