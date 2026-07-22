<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth.svelte';
  import { db, type Project } from '$lib/services/db';
  import { toast } from '$lib/stores/toast.svelte';
  import { CheckSquare, AlertTriangle, X, Check } from 'lucide-svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import Dialog from '$lib/components/ui/Dialog.svelte';

  let projects = $state<Project[]>([]);
  let proposalCommentDialogOpen = $state(false);
  let selectedProposalForComment = $state<Project | null>(null);
  let proposalCommentText = $state('');

  onMount(() => {
    loadData();
  });

  function loadData() {
    if (auth.user) {
      projects = db.getProjects().filter(p => p.department === auth.user!.department);
    }
  }

  let pendingProjects = $derived(projects.filter(p => p.status === 'pending'));

  function approveProject(id: string) {
    try {
      db.updateProject(id, { status: 'active' });
      toast.success('Project proposal approved!');
      
      const p = db.getProjects().find(proj => proj.id === id);
      if (p) {
        // Add initial milestone
        const updated = [...p.milestones, {
          id: `m_${Date.now()}`,
          title: 'System Requirements Specification',
          deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          completed: false
        }];
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
      
      const p = db.getProjects().find(proj => proj.id === id);
      if (p) {
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

{#if auth.user}
  <div class="flex flex-col gap-8 text-left">
    <div class="flex flex-col border-b border-border/40 pb-4">
      <h2 class="text-3xl font-extrabold tracking-tight text-foreground">Project Approvals</h2>
      <p class="text-sm text-muted-foreground mt-1">Review student team proposals and approve, reject, or request changes.</p>
    </div>

    {#if pendingProjects.length === 0}
      <div class="py-12 border border-dashed rounded-2xl flex flex-col items-center justify-center text-center">
        <CheckSquare class="w-12 h-12 text-muted-foreground/30 mb-3" />
        <p class="text-sm font-bold text-muted-foreground">All proposals reviewed</p>
      </div>
    {:else}
      <div class="grid grid-cols-1 gap-4">
        {#each pendingProjects as p}
          <div class="p-6 border border-border bg-card rounded-2xl shadow-2xs flex flex-col gap-4">
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-border/40 pb-3">
              <div class="flex-1 flex flex-col gap-1 min-w-0">
                <div class="flex items-center gap-3">
                  <span class="font-extrabold text-foreground text-lg truncate">{p.name}</span>
                  <Badge variant="warning">{p.status}</Badge>
                </div>
                <span class="text-3xs font-bold text-muted-foreground uppercase tracking-wider mt-1">Proposed By: {p.ownerName}</span>
              </div>

              <div class="flex items-center gap-2 self-end md:self-auto shrink-0">
                <button 
                  onclick={() => rejectProject(p.id)}
                  class="px-3 py-1.5 bg-rose-500/10 text-rose-600 hover:bg-rose-500 hover:text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  Reject
                </button>
                <button 
                  onclick={() => requestRevision(p)}
                  class="px-3 py-1.5 bg-amber-500/10 text-amber-600 hover:bg-amber-500 hover:text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  Request Revision
                </button>
                <button 
                  onclick={() => approveProject(p.id)}
                  class="px-3 py-1.5 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500 hover:text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  Approve Proposal
                </button>
              </div>
            </div>

            <div class="text-sm">
              <p class="font-bold text-foreground mb-1">Proposal Details:</p>
              <p class="text-muted-foreground leading-relaxed bg-muted/10 p-3 rounded-xl border">{p.description}</p>
            </div>

            <div class="flex flex-col gap-2">
              <p class="text-xs font-bold text-foreground">Team Composition:</p>
              <div class="flex flex-wrap gap-3">
                {#each p.members as member}
                  <div class="flex items-center gap-2 bg-muted/20 px-3 py-1 rounded-xl border border-border/40">
                    <img src={member.avatar} alt={member.name} class="w-6 h-6 rounded-full" />
                    <span class="text-xs font-bold text-foreground">{member.name} ({member.role})</span>
                  </div>
                {/each}
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<!-- Request Revision Comment Dialog -->
<Dialog bind:open={proposalCommentDialogOpen} title="Request Revision on Project Proposal">
  <form onsubmit={submitRevisionRequest} class="flex flex-col gap-4">
    <div class="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl flex gap-2 text-xs">
      <AlertTriangle class="w-4 h-4 shrink-0 mt-0.5" />
      <span>Detail what changes or clarifications the students need to make before the proposal can be approved.</span>
    </div>

    <div class="flex flex-col gap-1.5">
      <label for="dlg-rev-text" class="text-xs font-semibold text-foreground">Supervisor Remarks / Clarifications</label>
      <textarea 
        id="dlg-rev-text"
        placeholder="e.g. Please refine tech stack or specify team member responsibilities..." 
        bind:value={proposalCommentText}
        required
        rows="4"
        class="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none resize-none"
      ></textarea>
    </div>

    <div class="flex justify-end gap-2 mt-2">
      <Button type="button" variant="outline" onclick={() => { proposalCommentDialogOpen = false; selectedProposalForComment = null; }}>Cancel</Button>
      <Button type="submit" variant="primary">Send Request</Button>
    </div>
  </form>
</Dialog>
