<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth.svelte';
  import { newId } from '$lib/utils/id';
  import { db, type Project, type Meeting, type AttendanceStatus } from '$lib/services/db';
  import { toast } from '$lib/stores/toast.svelte';
  import { Plus, Calendar, Clock, MessageSquare, MapPin, AlertTriangle, UserCheck } from 'lucide-svelte';
  import Avatar from '$lib/components/ui/Avatar.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import Dialog from '$lib/components/ui/Dialog.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import EmptyState from '$lib/components/ui/EmptyState.svelte';

  let projects = $state<Project[]>([]);
  let meetings = $state<Meeting[]>([]);

  // Meeting scheduler states
  let scheduleProjectId = $state('');
  let meetingTitle = $state('');
  let meetingDate = $state('');
  let meetingTime = $state('');
  let meetingLocation = $state('');
  let editingMeeting = $state<Meeting | null>(null);
  let scheduleDialogOpen = $state(false);

  // Feedback states
  let feedbackProjectId = $state('');
  let feedbackCategory = $state<'code' | 'documentation' | 'ui' | 'testing' | 'presentation'>('code');
  let feedbackText = $state('');
  let feedbackDialogOpen = $state(false);

  /** Cancelling used to go through `window.confirm`, which cannot say which
      meeting is about to be cancelled or who gets notified. */
  let cancelDialogOpen = $state(false);
  let meetingToCancel = $state<Meeting | null>(null);

  onMount(() => {
    loadData();
  });

  function loadData() {
    if (auth.user) {
      projects = db.getSupervisedProjects(auth.user!);
      // Only meetings for this supervisor's department's teams.
      const projectIds = new Set(projects.map((p) => p.id));
      meetings = db.getMeetings().filter((m) => projectIds.has(m.projectId));

      const activeP = projects.filter((p) => p.status === 'active');
      if (activeP.length > 0) {
        if (!scheduleProjectId) scheduleProjectId = activeP[0].id;
        if (!feedbackProjectId) feedbackProjectId = activeP[0].id;
      }
    }
  }

  let activeProjects = $derived(projects.filter((p) => p.status === 'active'));
  let upcomingMeetings = $derived(meetings.filter((m) => m.status === 'scheduled'));

  function openScheduleDialog() {
    editingMeeting = null;
    meetingTitle = '';
    meetingDate = '';
    meetingTime = '';
    meetingLocation = '';
    scheduleDialogOpen = true;
  }

  function editMeeting(meet: Meeting) {
    editingMeeting = meet;
    scheduleProjectId = meet.projectId;
    meetingTitle = meet.title;
    meetingDate = meet.date;
    meetingTime = meet.time;
    meetingLocation = meet.linkOrLocation;
    scheduleDialogOpen = true;
  }

  function handleScheduleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!scheduleProjectId || !meetingTitle || !meetingDate || !meetingTime || !meetingLocation) return;
    const proj = projects.find((p) => p.id === scheduleProjectId);
    if (!proj) return;

    try {
      if (editingMeeting) {
        db.updateMeeting(editingMeeting.id, {
          title: meetingTitle,
          date: meetingDate,
          time: meetingTime,
          linkOrLocation: meetingLocation
        });
        toast.success('Review meeting rescheduled!');

        proj.members.forEach((member) => {
          db.saveNotifications([
            {
              id: newId('notif'),
              userId: member.userId,
              title: 'Review Meeting Rescheduled',
              description: `Meeting "${meetingTitle}" rescheduled for ${meetingDate} at ${meetingTime}.`,
              type: 'project',
              read: false,
              createdAt: new Date().toISOString(),
              actionUrl: `/dashboard/student`
            }
          ]);
        });
        editingMeeting = null;
      } else {
        db.scheduleMeeting(
          scheduleProjectId,
          proj.name,
          meetingTitle,
          meetingDate,
          meetingTime,
          meetingLocation
        );
        toast.success('Review meeting scheduled!');

        proj.members.forEach((member) => {
          db.saveNotifications([
            {
              id: newId('notif'),
              userId: member.userId,
              title: 'New Review Meeting Scheduled',
              description: `Supervisor scheduled a meeting: "${meetingTitle}" for ${meetingDate} at ${meetingTime}.`,
              type: 'project',
              read: false,
              createdAt: new Date().toISOString(),
              actionUrl: `/dashboard/student`
            }
          ]);
        });
      }

      meetingTitle = '';
      meetingDate = '';
      meetingTime = '';
      meetingLocation = '';
      scheduleDialogOpen = false;
      loadData();
    } catch (err) {
      toast.error('Failed to schedule meeting');
    }
  }

  function requestCancel(meet: Meeting) {
    meetingToCancel = meet;
    cancelDialogOpen = true;
  }

  function confirmCancel() {
    const meet = meetingToCancel;
    if (!meet) return;
    try {
      db.updateMeeting(meet.id, { status: 'cancelled' });
      toast.success('Meeting cancelled.');

      const proj = projects.find((p) => p.id === meet.projectId);
      if (proj) {
        proj.members.forEach((member) => {
          db.saveNotifications([
            {
              id: newId('notif'),
              userId: member.userId,
              title: 'Review Meeting Cancelled',
              description: `Meeting "${meet.title}" has been cancelled.`,
              type: 'project',
              read: false,
              createdAt: new Date().toISOString()
            }
          ]);
        });
      }
      cancelDialogOpen = false;
      meetingToCancel = null;
      loadData();
    } catch (err) {
      toast.error('Failed to cancel meeting');
    }
  }

  function handleFeedbackSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!feedbackProjectId || !feedbackText) return;
    const proj = projects.find((p) => p.id === feedbackProjectId);
    if (!proj) return;

    try {
      const fb = db.addFeedback(feedbackProjectId, feedbackCategory, feedbackText, auth.user!.name);
      db.logAudit(
        auth.user!.id,
        auth.user!.name,
        `Added ${feedbackCategory} feedback`,
        'feedback',
        fb.id,
        proj.name
      );

      proj.members.forEach((member) => {
        db.saveNotifications([
          {
            id: newId('notif'),
            userId: member.userId,
            title: 'New Categorized Feedback Added',
            description: `Your supervisor added feedback for category "${feedbackCategory}".`,
            type: 'project',
            read: false,
            createdAt: new Date().toISOString(),
            actionUrl: `/dashboard/student/project/${proj.id}`
          }
        ]);
      });

      toast.success('Feedback recorded!');
      feedbackText = '';
      feedbackDialogOpen = false;
      loadData();
    } catch (err) {
      toast.error('Failed to submit feedback');
    }
  }

  const today = new Date().toISOString().split('T')[0];

  // ---------------------------------------------------------------- attendance
  let attendanceDialogOpen = $state(false);
  let attendanceMeeting = $state<Meeting | null>(null);
  let attendanceDraft = $state<Record<string, AttendanceStatus>>({});

  const attendanceOptions: { value: AttendanceStatus; label: string; tone: string }[] = [
    { value: 'present', label: 'Present', tone: 'bg-success text-success-foreground border-success' },
    { value: 'late', label: 'Late', tone: 'bg-warning text-warning-foreground border-warning' },
    { value: 'excused', label: 'Excused', tone: 'bg-info text-info-foreground border-info' },
    { value: 'absent', label: 'Absent', tone: 'bg-destructive text-destructive-foreground border-destructive' }
  ];

  const attendanceMembers = $derived(
    attendanceMeeting ? (projects.find((p) => p.id === attendanceMeeting!.projectId)?.members ?? []) : []
  );

  function openAttendance(meet: Meeting) {
    attendanceMeeting = meet;
    const project = projects.find((p) => p.id === meet.projectId);
    // Start from the saved register, defaulting everyone else to present.
    attendanceDraft = Object.fromEntries(
      (project?.members ?? []).map((m) => [m.userId, meet.attendance?.[m.userId] ?? 'present'])
    );
    attendanceDialogOpen = true;
  }

  function saveAttendance() {
    if (!attendanceMeeting || !auth.user) return;
    try {
      db.recordAttendance(attendanceMeeting.id, { ...attendanceDraft });
      const absent = Object.values(attendanceDraft).filter((v) => v === 'absent').length;
      db.logAudit(
        auth.user.id,
        auth.user.name,
        'Recorded meeting attendance',
        'meeting',
        attendanceMeeting.id,
        `${attendanceMeeting.title} — ${attendanceMeeting.projectName}`
      );
      toast.success(absent > 0 ? `Attendance saved · ${absent} absent` : 'Attendance saved · full attendance');
      attendanceDialogOpen = false;
      loadData();
    } catch (err) {
      toast.error('Failed to save attendance');
    }
  }

  function attendanceSummary(meet: Meeting) {
    if (!meet.attendance) return null;
    const values = Object.values(meet.attendance);
    const attended = values.filter((v) => v === 'present' || v === 'late').length;
    return `${attended}/${values.length} attended`;
  }

  /** Soonest first — a scheduler is read in date order, not insertion order. */
  const sortedMeetings = $derived(
    [...upcomingMeetings].sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
  );
</script>

<svelte:head>
  <title>Review Scheduler — TeamForge</title>
</svelte:head>

{#if auth.user}
  <div class="flex flex-col gap-6 max-w-5xl">
    <PageHeader
      title="Review scheduler"
      icon={Calendar}
      description="Book mentor reviews with your teams and record categorised quality feedback against a project."
    >
      {#snippet actions()}
        <Button variant="primary" onclick={openScheduleDialog} disabled={activeProjects.length === 0}>
          <Plus class="w-4 h-4" />
          Schedule meeting
        </Button>
        <Button
          variant="outline"
          onclick={() => (feedbackDialogOpen = true)}
          disabled={activeProjects.length === 0}
        >
          <MessageSquare class="w-4 h-4" />
          Add feedback
        </Button>
      {/snippet}
    </PageHeader>

    {#if activeProjects.length === 0}
      <EmptyState
        icon={Calendar}
        title="No active teams"
        description="Meetings and feedback are recorded against approved projects. Approve a proposal to get started."
      >
        {#snippet action()}
          <a href="/dashboard/faculty/approvals">
            <Button variant="outline" size="sm">Go to approvals</Button>
          </a>
        {/snippet}
      </EmptyState>
    {:else}
      <Card title="Scheduled reviews" description="Soonest first.">
        <ul class="flex flex-col gap-2.5">
          {#each sortedMeetings as meet (meet.id)}
            <li
              class="p-4 border border-border rounded-md flex flex-col sm:flex-row sm:items-center
                justify-between gap-4 hover:bg-muted/30 transition-colors"
            >
              <div class="min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <h3 class="text-sm font-bold text-foreground">{meet.title}</h3>
                  {#if meet.date < today}
                    <Badge variant="secondary" size="sm">Past</Badge>
                    {#if attendanceSummary(meet)}
                      <Badge variant="outline" size="sm">{attendanceSummary(meet)}</Badge>
                    {/if}
                  {:else}
                    <Badge variant="success" dot size="sm">Scheduled</Badge>
                  {/if}
                </div>
                <p class="text-2xs text-muted-foreground mt-1">{meet.projectName}</p>
                <dl class="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-2xs text-muted-foreground">
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
              </div>

              <div class="flex items-center gap-2 shrink-0 self-end sm:self-auto flex-wrap justify-end">
                {#if meet.date <= today}
                  <Button variant={meet.attendance ? 'outline' : 'secondary'} size="sm" onclick={() => openAttendance(meet)}>
                    <UserCheck class="w-3.5 h-3.5" />
                    {meet.attendance ? 'Edit attendance' : 'Take attendance'}
                  </Button>
                {/if}
                <Button variant="outline" size="sm" onclick={() => editMeeting(meet)}>Reschedule</Button>
                <Button variant="ghost" size="sm" onclick={() => requestCancel(meet)}>Cancel</Button>
              </div>
            </li>
          {:else}
            <li>
              <EmptyState
                icon={Calendar}
                title="No reviews scheduled"
                description="Book a mentor review and every member of that team is notified with the date, time and location."
              >
                {#snippet action()}
                  <Button variant="outline" size="sm" onclick={openScheduleDialog}>Schedule meeting</Button>
                {/snippet}
              </EmptyState>
            </li>
          {/each}
        </ul>
      </Card>
    {/if}
  </div>
{/if}

<!-- One scheduler dialog serves both booking and rescheduling. -->
<Dialog
  bind:open={scheduleDialogOpen}
  title={editingMeeting ? 'Reschedule review meeting' : 'Schedule review meeting'}
  description="Every member of the selected team is notified."
>
  <form id="schedule-form" onsubmit={handleScheduleSubmit} class="flex flex-col gap-4">
    <div class="field">
      <label for="dlg-sch-proj" class="field-label">Team</label>
      <select id="dlg-sch-proj" bind:value={scheduleProjectId} required class="field-select">
        {#each activeProjects as p (p.id)}
          <option value={p.id}>{p.name}</option>
        {/each}
      </select>
    </div>

    <div class="field">
      <label for="dlg-sch-title" class="field-label">Review topic</label>
      <input
        id="dlg-sch-title"
        type="text"
        placeholder="e.g. Mid-term presentation evaluation"
        bind:value={meetingTitle}
        required
        class="field-input"
      />
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div class="field">
        <label for="dlg-sch-date" class="field-label">Date</label>
        <input id="dlg-sch-date" type="date" bind:value={meetingDate} required class="field-input" />
      </div>

      <div class="field">
        <label for="dlg-sch-time" class="field-label">Time</label>
        <input id="dlg-sch-time" type="time" bind:value={meetingTime} required class="field-input" />
      </div>
    </div>

    <div class="field">
      <label for="dlg-sch-loc" class="field-label">Location or link</label>
      <input
        id="dlg-sch-loc"
        type="text"
        placeholder="e.g. Seminar Room 304, or a Zoom URL"
        bind:value={meetingLocation}
        required
        class="field-input"
      />
    </div>
  </form>

  {#snippet footer()}
    <Button type="button" variant="outline" onclick={() => (scheduleDialogOpen = false)}>Cancel</Button>
    <Button type="submit" form="schedule-form" variant="primary">
      {editingMeeting ? 'Save changes' : 'Schedule'}
    </Button>
  {/snippet}
</Dialog>

<!-- Categorized Feedback Dialog -->
<Dialog
  bind:open={feedbackDialogOpen}
  title="Add categorised feedback"
  description="Filed against the project and shown on its workspace timeline."
>
  <form id="feedback-form" onsubmit={handleFeedbackSubmit} class="flex flex-col gap-4">
    <div class="field">
      <label for="dlg-fb-proj" class="field-label">Team</label>
      <select id="dlg-fb-proj" bind:value={feedbackProjectId} required class="field-select">
        {#each activeProjects as p (p.id)}
          <option value={p.id}>{p.name}</option>
        {/each}
      </select>
    </div>

    <div class="field">
      <label for="dlg-fb-cat" class="field-label">Category</label>
      <select id="dlg-fb-cat" bind:value={feedbackCategory} required class="field-select">
        <option value="code">Code quality &amp; architecture</option>
        <option value="documentation">Documentation &amp; specifications</option>
        <option value="ui">UI / UX &amp; responsiveness</option>
        <option value="testing">Testing, coverage &amp; deployment</option>
        <option value="presentation">Presentation &amp; communication</option>
      </select>
    </div>

    <div class="field">
      <label for="dlg-fb-text" class="field-label">Comments</label>
      <textarea
        id="dlg-fb-text"
        placeholder="Constructive review comments for this category…"
        bind:value={feedbackText}
        required
        rows="4"
        class="field-textarea"
      ></textarea>
    </div>
  </form>

  {#snippet footer()}
    <Button type="button" variant="outline" onclick={() => (feedbackDialogOpen = false)}>Cancel</Button>
    <Button type="submit" form="feedback-form" variant="primary">Submit feedback</Button>
  {/snippet}
</Dialog>

<!-- Cancel confirmation -->
<Dialog
  bind:open={cancelDialogOpen}
  size="sm"
  title="Cancel this review meeting?"
  onclose={() => (meetingToCancel = null)}
>
  <div class="flex gap-3">
    <AlertTriangle class="w-5 h-5 shrink-0 text-warning mt-0.5" aria-hidden="true" />
    <p class="text-sm text-muted-foreground leading-relaxed">
      {#if meetingToCancel}
        <span class="font-bold text-foreground">{meetingToCancel.title}</span>
        with {meetingToCancel.projectName} on
        <span class="tabular">{meetingToCancel.date} at {meetingToCancel.time}</span>
        will be marked cancelled, and every member of the team will be notified.
      {/if}
    </p>
  </div>

  {#snippet footer()}
    <Button variant="outline" onclick={() => (cancelDialogOpen = false)}>Keep meeting</Button>
    <Button variant="danger" onclick={confirmCancel}>Cancel meeting</Button>
  {/snippet}
</Dialog>

<!-- Attendance register -->
<Dialog
  bind:open={attendanceDialogOpen}
  title="Attendance"
  description={attendanceMeeting ? `${attendanceMeeting.title} · ${attendanceMeeting.projectName} · ${attendanceMeeting.date}` : ''}
  onclose={() => (attendanceMeeting = null)}
>
  {#if attendanceMembers.length === 0}
    <p class="text-sm text-muted-foreground">This team has no members to register.</p>
  {:else}
    <ul class="flex flex-col divide-y divide-border">
      {#each attendanceMembers as member (member.userId)}
        <li class="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <span class="flex items-center gap-3 min-w-0">
            <Avatar src={member.avatar} name={member.name} size="sm" />
            <span class="text-sm font-semibold text-foreground truncate">{member.name}</span>
          </span>
          <fieldset class="flex gap-1">
            <legend class="sr-only">Attendance for {member.name}</legend>
            {#each attendanceOptions as opt (opt.value)}
              <label
                class="px-2.5 h-8 inline-flex items-center rounded-md border text-2xs font-semibold cursor-pointer transition-colors
                  {attendanceDraft[member.userId] === opt.value
                  ? opt.tone
                  : 'border-border text-muted-foreground hover:bg-secondary'}"
              >
                <input
                  type="radio"
                  class="sr-only"
                  name="att-{member.userId}"
                  value={opt.value}
                  bind:group={attendanceDraft[member.userId]}
                />
                {opt.label}
              </label>
            {/each}
          </fieldset>
        </li>
      {/each}
    </ul>
  {/if}

  {#snippet footer()}
    <Button variant="outline" onclick={() => (attendanceDialogOpen = false)}>Cancel</Button>
    <Button variant="primary" onclick={saveAttendance} disabled={attendanceMembers.length === 0}>Save register</Button>
  {/snippet}
</Dialog>
