<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth.svelte';
  import { newId } from '$lib/utils/id';
  import { db, type Project, type Milestone } from '$lib/services/db';
  import { toast } from '$lib/stores/toast.svelte';
  import { Calendar, Trash2, Pencil, Lock, Unlock, Clock, CheckCircle2, Circle } from 'lucide-svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import Dialog from '$lib/components/ui/Dialog.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import EmptyState from '$lib/components/ui/EmptyState.svelte';
  import ProgressBar from '$lib/components/ui/ProgressBar.svelte';

  let projects = $state<Project[]>([]);
  let selectedMilestoneProjectId = $state('');
  let milestoneTitle = $state('');
  let milestoneDeadline = $state('');
  let editingMilestoneId = $state<string | null>(null);

  /** Extending a deadline used to go through `window.prompt`, which is
      unstyled, unlabelled, and impossible to validate as a date. */
  let extendDialogOpen = $state(false);
  let extendTarget = $state<{ projId: string; milestone: Milestone } | null>(null);
  let extendDeadline = $state('');

  const today = new Date().toISOString().split('T')[0];

  onMount(() => {
    loadData();
  });

  function loadData() {
    if (auth.user) {
      projects = db.getSupervisedProjects(auth.user!);
      const activeP = projects.filter((p) => p.status === 'active');
      if (activeP.length > 0 && !selectedMilestoneProjectId) {
        selectedMilestoneProjectId = activeP[0].id;
      }
    }
  }

  let activeProjects = $derived(projects.filter((p) => p.status === 'active'));
  let activeProj = $derived(projects.find((p) => p.id === selectedMilestoneProjectId));
  let completedCount = $derived(activeProj ? activeProj.milestones.filter((m) => m.completed).length : 0);

  function handleMilestoneSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!selectedMilestoneProjectId) return;
    const proj = projects.find((p) => p.id === selectedMilestoneProjectId);
    if (!proj) return;

    try {
      if (editingMilestoneId) {
        const updated = proj.milestones.map((m) =>
          m.id === editingMilestoneId ? { ...m, title: milestoneTitle, deadline: milestoneDeadline } : m
        );
        db.updateProject(proj.id, { milestones: updated });
        db.logAudit(
          auth.user!.id,
          auth.user!.name,
          'Updated milestone',
          'milestone',
          editingMilestoneId,
          `${milestoneTitle} (${proj.name})`
        );
        toast.success('Milestone updated successfully');
        editingMilestoneId = null;
      } else {
        const newM: Milestone = {
          id: newId('m'),
          title: milestoneTitle,
          deadline: milestoneDeadline || new Date().toISOString().split('T')[0],
          completed: false,
          locked: false
        };
        db.updateProject(proj.id, { milestones: [...proj.milestones, newM] });
        db.logAudit(
          auth.user!.id,
          auth.user!.name,
          'Created milestone',
          'milestone',
          newM.id,
          `${milestoneTitle} (${proj.name})`
        );

        proj.members.forEach((member) => {
          db.saveNotifications([
            {
              id: newId('notif'),
              userId: member.userId,
              title: 'New Milestone Assigned',
              description: `A new milestone "${milestoneTitle}" has been added to project "${proj.name}".`,
              type: 'project',
              read: false,
              createdAt: new Date().toISOString(),
              actionUrl: `/dashboard/student/project/${proj.id}`
            }
          ]);
        });
        toast.success('Milestone assigned to team');
      }

      milestoneTitle = '';
      milestoneDeadline = '';
      loadData();
    } catch (err) {
      toast.error('Failed to save milestone');
    }
  }

  function cancelEdit() {
    editingMilestoneId = null;
    milestoneTitle = '';
    milestoneDeadline = '';
  }

  function deleteMilestone(projId: string, mId: string) {
    const proj = projects.find((p) => p.id === projId);
    if (!proj) return;
    try {
      const deleted = proj.milestones.find((m) => m.id === mId);
      const updated = proj.milestones.filter((m) => m.id !== mId);
      db.updateProject(proj.id, { milestones: updated });
      db.logAudit(
        auth.user!.id,
        auth.user!.name,
        'Deleted milestone',
        'milestone',
        mId,
        `${deleted?.title ?? mId} (${proj.name})`
      );
      toast.success('Milestone deleted');
      loadData();
    } catch (err) {
      toast.error('Failed to delete milestone');
    }
  }

  function toggleLockMilestone(projId: string, mId: string) {
    const proj = projects.find((p) => p.id === projId);
    if (!proj) return;
    try {
      const target = proj.milestones.find((m) => m.id === mId);
      const nowLocked = !target?.locked;
      const updated = proj.milestones.map((m) => (m.id === mId ? { ...m, locked: nowLocked } : m));
      db.updateProject(proj.id, { milestones: updated });
      db.logAudit(
        auth.user!.id,
        auth.user!.name,
        nowLocked ? 'Locked milestone' : 'Unlocked milestone',
        'milestone',
        mId,
        `${target?.title ?? mId} (${proj.name})`
      );
      toast.success('Milestone lock state updated');
      loadData();
    } catch (err) {
      toast.error('Failed to update milestone lock status');
    }
  }

  function openExtendDialog(projId: string, milestone: Milestone) {
    extendTarget = { projId, milestone };
    extendDeadline = milestone.deadline;
    extendDialogOpen = true;
  }

  function submitExtend(e: SubmitEvent) {
    e.preventDefault();
    if (!extendTarget || !extendDeadline) return;
    const { projId, milestone } = extendTarget;
    const proj = projects.find((p) => p.id === projId);
    if (!proj) return;

    try {
      const updated = proj.milestones.map((m) =>
        m.id === milestone.id ? { ...m, deadline: extendDeadline, extendedDeadline: extendDeadline } : m
      );
      db.updateProject(proj.id, { milestones: updated });
      db.logAudit(
        auth.user!.id,
        auth.user!.name,
        'Extended milestone deadline',
        'milestone',
        milestone.id,
        `${milestone.title} (${proj.name}) → ${extendDeadline}`
      );

      proj.members.forEach((member) => {
        db.saveNotifications([
          {
            id: newId('notif'),
            userId: member.userId,
            title: 'Milestone Deadline Extended',
            description: `Deadline for "${milestone.title}" has been updated to ${extendDeadline}.`,
            type: 'project',
            read: false,
            createdAt: new Date().toISOString(),
            actionUrl: `/dashboard/student/project/${proj.id}`
          }
        ]);
      });

      toast.success('Milestone deadline extended');
      extendDialogOpen = false;
      extendTarget = null;
      loadData();
    } catch (err) {
      toast.error('Failed to extend milestone');
    }
  }
</script>

<svelte:head>
  <title>Milestones — TeamForge</title>
</svelte:head>

{#if auth.user}
  <div class="flex flex-col gap-6 max-w-7xl">
    <PageHeader
      title="Milestones"
      icon={Calendar}
      description="Assign deliverables, extend deadlines, or lock a milestone so the team can no longer change it."
    />

    {#if activeProjects.length === 0}
      <EmptyState
        icon={Calendar}
        title="No active teams"
        description="Milestones are assigned to approved projects. Approve a proposal first and it will appear here."
      >
        {#snippet action()}
          <a href="/dashboard/faculty/approvals">
            <Button variant="outline" size="sm">Go to approvals</Button>
          </a>
        {/snippet}
      </EmptyState>
    {:else}
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <Card title={editingMilestoneId ? 'Edit milestone' : 'Create milestone'}>
          <form onsubmit={handleMilestoneSubmit} class="flex flex-col gap-4">
            <div class="field">
              <label for="mil-proj" class="field-label">Project team</label>
              <select id="mil-proj" bind:value={selectedMilestoneProjectId} required class="field-select">
                {#each activeProjects as p (p.id)}
                  <option value={p.id}>{p.name}</option>
                {/each}
              </select>
            </div>

            <div class="field">
              <label for="mil-title" class="field-label">Milestone title</label>
              <input
                id="mil-title"
                type="text"
                placeholder="e.g. Set up API endpoints"
                bind:value={milestoneTitle}
                required
                class="field-input"
              />
            </div>

            <div class="field">
              <label for="mil-deadline" class="field-label">Target deadline</label>
              <input
                id="mil-deadline"
                type="date"
                bind:value={milestoneDeadline}
                required
                aria-describedby="mil-deadline-hint"
                class="field-input"
              />
              <p id="mil-deadline-hint" class="field-hint">
                Every team member is notified when a milestone is created.
              </p>
            </div>

            <div class="flex justify-end gap-2">
              {#if editingMilestoneId}
                <Button type="button" variant="outline" size="sm" onclick={cancelEdit}>Cancel</Button>
              {/if}
              <Button type="submit" variant="primary" size="sm">
                {editingMilestoneId ? 'Save changes' : 'Assign milestone'}
              </Button>
            </div>
          </form>
        </Card>

        <div class="lg:col-span-2">
          <Card title="Assigned milestones">
            {#snippet actions()}
              <label for="mil-filter" class="sr-only">Show milestones for project</label>
              <select
                id="mil-filter"
                bind:value={selectedMilestoneProjectId}
                class="field-select h-9 w-auto max-w-52 text-xs font-semibold"
              >
                {#each activeProjects as p (p.id)}
                  <option value={p.id}>{p.name}</option>
                {/each}
              </select>
            {/snippet}

            {#if activeProj}
              {#if activeProj.milestones.length > 0}
                <ProgressBar
                  class="mb-4"
                  value={completedCount}
                  max={activeProj.milestones.length}
                  label="Completed"
                  valueLabel="{completedCount} / {activeProj.milestones.length}"
                  tone={completedCount === activeProj.milestones.length ? 'success' : 'accent'}
                  size="sm"
                />
              {/if}

              <ul class="flex flex-col gap-2">
                {#each activeProj.milestones as m (m.id)}
                  {@const overdue = !m.completed && m.deadline < today}
                  <li
                    class="p-3.5 border border-border rounded-md flex flex-col sm:flex-row sm:items-center
                      justify-between gap-3 hover:bg-muted/30 transition-colors"
                  >
                    <div class="flex items-start gap-3 min-w-0">
                      {#if m.completed}
                        <CheckCircle2 class="w-5 h-5 text-success shrink-0 mt-0.5" aria-hidden="true" />
                      {:else}
                        <Circle class="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
                      {/if}
                      <div class="min-w-0">
                        <p
                          class="text-sm font-bold truncate {m.completed
                            ? 'line-through text-muted-foreground'
                            : 'text-foreground'}"
                        >
                          {m.title}
                        </p>
                        <p class="flex flex-wrap items-center gap-2 mt-1">
                          <span
                            class="inline-flex items-center gap-1.5 text-2xs font-semibold tabular
                              {overdue ? 'text-destructive' : 'text-muted-foreground'}"
                          >
                            <Calendar class="w-3.5 h-3.5" aria-hidden="true" />
                            {m.deadline}
                          </span>
                          {#if overdue}
                            <Badge variant="danger" size="sm">Overdue</Badge>
                          {/if}
                          {#if m.extendedDeadline}
                            <Badge variant="warning" size="sm">Extended</Badge>
                          {/if}
                          {#if m.locked}
                            <Badge variant="secondary" size="sm">Locked</Badge>
                          {/if}
                        </p>
                      </div>
                    </div>

                    <div class="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                      <button
                        onclick={() => toggleLockMilestone(activeProj.id, m.id)}
                        class="icon-action"
                        aria-pressed={Boolean(m.locked)}
                        aria-label="{m.locked ? 'Unlock' : 'Lock'} milestone: {m.title}"
                        title={m.locked ? 'Unlock milestone' : 'Lock milestone'}
                      >
                        {#if m.locked}
                          <Lock class="w-4 h-4 text-destructive" />
                        {:else}
                          <Unlock class="w-4 h-4" />
                        {/if}
                      </button>

                      <button
                        onclick={() => openExtendDialog(activeProj.id, m)}
                        class="icon-action"
                        aria-label="Extend deadline for: {m.title}"
                        title="Extend deadline"
                      >
                        <Clock class="w-4 h-4" />
                      </button>

                      <button
                        onclick={() => {
                          editingMilestoneId = m.id;
                          milestoneTitle = m.title;
                          milestoneDeadline = m.deadline;
                        }}
                        class="icon-action"
                        aria-label="Edit milestone: {m.title}"
                        title="Edit milestone"
                      >
                        <Pencil class="w-4 h-4" />
                      </button>

                      <button
                        onclick={() => deleteMilestone(activeProj.id, m.id)}
                        class="icon-action icon-action-danger"
                        aria-label="Delete milestone: {m.title}"
                        title="Delete milestone"
                      >
                        <Trash2 class="w-4 h-4" />
                      </button>
                    </div>
                  </li>
                {:else}
                  <li>
                    <EmptyState
                      icon={Calendar}
                      title="No milestones for this team"
                      description="Use the form on the left to assign the first deliverable."
                      size="sm"
                    />
                  </li>
                {/each}
              </ul>
            {:else}
              <EmptyState icon={Calendar} title="Select a project" description="Pick a team to see its milestones." size="sm" />
            {/if}
          </Card>
        </div>
      </div>
    {/if}
  </div>

  <Dialog
    bind:open={extendDialogOpen}
    size="sm"
    title="Extend deadline"
    description={extendTarget?.milestone.title}
    onclose={() => (extendTarget = null)}
  >
    <form id="extend-form" onsubmit={submitExtend} class="field">
      <label for="extend-date" class="field-label">New deadline</label>
      <input
        id="extend-date"
        type="date"
        bind:value={extendDeadline}
        required
        aria-describedby="extend-hint"
        class="field-input"
      />
      <p id="extend-hint" class="field-hint">
        The milestone is flagged as extended and every team member is notified.
      </p>
    </form>

    {#snippet footer()}
      <Button type="button" variant="outline" onclick={() => (extendDialogOpen = false)}>Cancel</Button>
      <Button type="submit" form="extend-form" variant="primary">Extend deadline</Button>
    {/snippet}
  </Dialog>
{/if}
