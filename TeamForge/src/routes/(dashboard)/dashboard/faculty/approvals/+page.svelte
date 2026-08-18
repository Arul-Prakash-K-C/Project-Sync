<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth.svelte';
  import { db, type Project } from '$lib/services/db';
  import { toast } from '$lib/stores/toast.svelte';
  import { CheckSquare, AlertTriangle, X, Check, MessageSquare } from 'lucide-svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import Dialog from '$lib/components/ui/Dialog.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import EmptyState from '$lib/components/ui/EmptyState.svelte';
  import Avatar from '$lib/components/ui/Avatar.svelte';

  let projects = $state<Project[]>([]);
  let loaded = $state(false);
  let proposalCommentDialogOpen = $state(false);
  let selectedProposalForComment = $state<Project | null>(null);
  let proposalCommentText = $state('');

  onMount(() => {
    loadData();
    loaded = true;
  });

  function loadData() {
    if (auth.user) {
      projects = db.getProjects().filter((p) => p.department === auth.user!.department);
    }
  }

  let pendingProjects = $derived(projects.filter((p) => p.status === 'pending'));

  function approveProject(id: string) {
    try {
      db.updateProject(id, { status: 'active' });
      toast.success('Project proposal approved!');

      const p = db.getProjects().find((proj) => proj.id === id);
      if (p) {
        db.logAudit(auth.user!.id, auth.user!.name, 'Approved project proposal', 'project', p.id, p.name);

        // Add initial milestone
        const updated = [
          ...p.milestones,
          {
            id: `m_${Date.now()}`,
            title: 'System Requirements Specification',
            deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            completed: false
          }
        ];
        db.updateProject(p.id, { milestones: updated });

        db.saveNotifications([
          {
            id: `notif_${Date.now()}`,
            userId: p.ownerId,
            title: 'Project Approved!',
            description: `Your project proposal "${p.name}" has been approved by ${auth.user!.name}.`,
            type: 'project',
            read: false,
            createdAt: new Date().toISOString(),
            actionUrl: `/dashboard/student/project/${p.id}`
          }
        ]);
      }
      loadData();
    } catch (err) {
      toast.error('Failed to approve project');
    }
  }

  function rejectProject(id: string) {
    try {
      db.updateProject(id, { status: 'rejected' });
      toast.success('Project proposal rejected');

      const p = db.getProjects().find((proj) => proj.id === id);
      if (p) {
        db.logAudit(auth.user!.id, auth.user!.name, 'Rejected project proposal', 'project', p.id, p.name);

        db.saveNotifications([
          {
            id: `notif_${Date.now()}`,
            userId: p.ownerId,
            title: 'Project Proposal Rejected',
            description: `Your project proposal "${p.name}" was rejected by ${auth.user!.name}.`,
            type: 'project',
            read: false,
            createdAt: new Date().toISOString()
          }
        ]);
      }
      loadData();
    } catch (err) {
      toast.error('Failed to reject project');
    }
  }

  function requestRevision(proj: Project) {
    selectedProposalForComment = proj;
    proposalCommentText = '';
    proposalCommentDialogOpen = true;
  }

  function submitRevisionRequest(e: SubmitEvent) {
    e.preventDefault();
    if (!selectedProposalForComment) return;
    try {
      db.logAudit(
        auth.user!.id,
        auth.user!.name,
        'Requested revision on project proposal',
        'project',
        selectedProposalForComment.id,
        selectedProposalForComment.name
      );

      db.saveNotifications([
        {
          id: `notif_${Date.now()}`,
          userId: selectedProposalForComment.ownerId,
          title: 'Revision Requested on Proposal',
          description: `Supervisor "${auth.user!.name}" requested changes on "${selectedProposalForComment.name}": "${proposalCommentText}"`,
          type: 'project',
          read: false,
          createdAt: new Date().toISOString(),
          actionUrl: `/dashboard/student`
        }
      ]);
      toast.success('Revision request sent to the student team.');
      proposalCommentDialogOpen = false;
      selectedProposalForComment = null;
      loadData();
    } catch (err) {
      toast.error('Failed to request revision');
    }
  }
</script>

<svelte:head>
  <title>Project Approvals — TeamForge</title>
</svelte:head>

{#if auth.user}
  <div class="flex flex-col gap-6 max-w-5xl">
    <PageHeader
      title="Project approvals"
      icon={CheckSquare}
      description="Student proposals from {auth.user.department} waiting on a decision. Approving one opens its workspace and seeds a first milestone."
    />

    {#if !loaded}
      <div class="flex flex-col gap-4" aria-busy="true">
        {#each { length: 2 } as _, i (i)}
          <div class="rounded-lg border border-border bg-card p-5 flex flex-col gap-3">
            <div class="skeleton h-5 w-1/3"></div>
            <div class="skeleton h-3 w-full"></div>
            <div class="skeleton h-3 w-4/5"></div>
          </div>
        {/each}
      </div>
    {:else if pendingProjects.length === 0}
      <EmptyState
        icon={CheckSquare}
        title="All proposals reviewed"
        description="Nothing in {auth.user.department} is waiting on you. New student proposals appear here as they are submitted."
      />
    {:else}
      <ul class="flex flex-col gap-4">
        {#each pendingProjects as p (p.id)}
          <li>
            <Card>
              <header class="flex flex-col gap-3 border-b border-border pb-4">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <h2 class="text-base font-bold text-foreground">{p.name}</h2>
                    <p class="text-2xs text-muted-foreground mt-1">
                      Proposed by {p.ownerName} ·
                      <span class="tabular">{new Date(p.createdAt).toLocaleDateString()}</span>
                    </p>
                  </div>
                  <Badge variant="warning" dot class="shrink-0 capitalize">{p.status}</Badge>
                </div>

                <!--
                  Three outcomes, ordered by how often they are the right one and
                  weighted so the destructive option cannot be hit by momentum.
                -->
                <div class="flex flex-wrap items-center gap-2">
                  <Button variant="success" size="sm" onclick={() => approveProject(p.id)}>
                    <Check class="w-3.5 h-3.5" />
                    Approve
                  </Button>
                  <Button variant="outline" size="sm" onclick={() => requestRevision(p)}>
                    <MessageSquare class="w-3.5 h-3.5" />
                    Request revision
                  </Button>
                  <Button variant="ghost" size="sm" onclick={() => rejectProject(p.id)}>
                    <X class="w-3.5 h-3.5" />
                    Reject
                  </Button>
                </div>
              </header>

              <section class="mt-4">
                <h3 class="eyebrow">Proposal</h3>
                <p
                  class="text-sm text-muted-foreground leading-relaxed mt-1.5 p-3.5 bg-muted/30 border border-border rounded-md whitespace-pre-wrap"
                >
                  {p.description}
                </p>
              </section>

              <section class="mt-4">
                <h3 class="eyebrow">Team ({p.members.length})</h3>
                <ul class="flex flex-wrap gap-2 mt-2">
                  {#each p.members as member (member.userId)}
                    <li
                      class="flex items-center gap-2 bg-muted/40 pl-1.5 pr-3 py-1.5 rounded-md border border-border"
                    >
                      <Avatar src={member.avatar} name={member.name} size="xs" />
                      <span class="text-2xs font-bold text-foreground">
                        {member.name}
                        <span class="font-normal text-muted-foreground">· {member.role}</span>
                      </span>
                    </li>
                  {/each}
                </ul>
              </section>
            </Card>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
{/if}

<!-- Request Revision Comment Dialog -->
<Dialog
  bind:open={proposalCommentDialogOpen}
  title="Request revision"
  description={selectedProposalForComment?.name}
  onclose={() => (selectedProposalForComment = null)}
>
  <form id="revision-form" onsubmit={submitRevisionRequest} class="flex flex-col gap-4">
    <div
      class="p-3 bg-warning/10 border border-warning/25 text-warning rounded-md flex gap-2.5 text-xs leading-relaxed"
    >
      <AlertTriangle class="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
      <span>
        The proposal stays pending. Say what has to change before you can approve it — the team gets
        this verbatim.
      </span>
    </div>

    <div class="field">
      <label for="dlg-rev-text" class="field-label">Supervisor remarks</label>
      <textarea
        id="dlg-rev-text"
        placeholder="e.g. Please refine the tech stack, and specify each member's responsibilities…"
        bind:value={proposalCommentText}
        required
        rows="4"
        class="field-textarea"
      ></textarea>
    </div>
  </form>

  {#snippet footer()}
    <Button
      type="button"
      variant="outline"
      onclick={() => {
        proposalCommentDialogOpen = false;
        selectedProposalForComment = null;
      }}
    >
      Cancel
    </Button>
    <Button type="submit" form="revision-form" variant="primary">Send request</Button>
  {/snippet}
</Dialog>
