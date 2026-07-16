<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth.svelte';
  import { db, type Project } from '$lib/services/db';
  import { toast } from '$lib/stores/toast.svelte';
  import { BookOpen, CheckSquare, Clock, ArrowRight, Check, X, Award } from 'lucide-svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';

  let projects = $state<Project[]>([]);
  let pendingProjects = $derived(projects.filter(p => p.status === 'pending'));
  let activeProjects = $derived(projects.filter(p => p.status === 'active'));

  onMount(() => {
    loadData();
  });

  // Load supervision details
  function loadData() {
    if (auth.user) {
      projects = db.getProjects().filter(p => p.department === auth.user!.department);
    }
  }

  function approveProject(id: string) {
    try {
      db.updateProject(id, { status: 'active' });
      toast.success('Project proposal approved!');
      
      const p = db.getProjects().find(proj => proj.id === id);
      if (p) {
        const notifs = db.getNotifications(p.ownerId);
        db.saveNotifications([
          ...notifs,
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
        const notifs = db.getNotifications(p.ownerId);
        db.saveNotifications([
          ...notifs,
          {
            id: `notif_${Date.now()}`,
            userId: p.ownerId,
            title: 'Project Proposal Update',
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

  function calculateProgress(p: Project): number {
    if (p.milestones.length === 0) return 0;
    const completed = p.milestones.filter(m => m.completed).length;
    return Math.round((completed / p.milestones.length) * 100);
  }
</script>

{#if auth.user}
  <div class="flex flex-col gap-8">
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-4">
      <div>
        <h2 class="text-3xl font-extrabold tracking-tight text-foreground">Faculty Dashboard</h2>
        <p class="text-sm text-muted-foreground mt-1">Supervise student progress, review team proposals, and access analytics.</p>
      </div>
    </div>

    <!-- Quick Stats -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card class="flex items-center gap-4 py-5 px-6">
        <div class="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
          <BookOpen class="w-6 h-6" />
        </div>
        <div>
          <p class="text-2xs font-bold text-muted-foreground uppercase tracking-widest">Active Projects</p>
          <p class="text-2xl font-black text-foreground mt-1">{activeProjects.length}</p>
        </div>
      </Card>

      <Card class="flex items-center gap-4 py-5 px-6">
        <div class="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
          <Clock class="w-6 h-6" />
        </div>
        <div>
          <p class="text-2xs font-bold text-muted-foreground uppercase tracking-widest">Pending Proposals</p>
          <p class="text-2xl font-black text-foreground mt-1">{pendingProjects.length}</p>
        </div>
      </Card>

      <Card class="flex items-center gap-4 py-5 px-6">
        <div class="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
          <Award class="w-6 h-6" />
        </div>
        <div>
          <p class="text-2xs font-bold text-muted-foreground uppercase tracking-widest">Avg Completion Rate</p>
          <p class="text-2xl font-black text-foreground mt-1">
            {#if activeProjects.length > 0}
              {Math.round(activeProjects.reduce((sum, p) => sum + calculateProgress(p), 0) / activeProjects.length)}%
            {:else}
              0%
            {/if}
          </p>
        </div>
      </Card>
    </div>

    <div class="flex flex-col gap-4">
      <h3 class="text-xl font-bold text-foreground">Project Proposals Pending Approval</h3>

      {#if pendingProjects.length === 0}
        <div class="py-12 border border-dashed rounded-2xl flex flex-col items-center justify-center text-center">
          <CheckSquare class="w-12 h-12 text-muted-foreground/30 mb-3" />
          <p class="text-sm font-bold text-muted-foreground">All proposals reviewed</p>
        </div>
      {:else}
        <div class="grid grid-cols-1 gap-4">
          {#each pendingProjects as p}
            <div class="p-6 border border-border bg-card rounded-2xl shadow-2xs flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div class="flex-1 flex flex-col gap-1 min-w-0">
                <div class="flex items-center gap-3">
                  <span class="font-extrabold text-foreground text-lg truncate">{p.name}</span>
                  <Badge variant="warning">{p.status}</Badge>
                </div>
                <p class="text-xs text-muted-foreground line-clamp-2 leading-relaxed mt-1">{p.description}</p>
                <span class="text-3xs font-bold text-muted-foreground uppercase tracking-wider mt-1">Proposed By: {p.ownerName}</span>
              </div>

              <div class="flex items-center gap-2 self-end md:self-auto shrink-0">
                <Button variant="danger" size="sm" onclick={() => rejectProject(p.id)}>
                  <X class="w-4 h-4" />
                  Decline
                </Button>
                <Button variant="primary" size="sm" onclick={() => approveProject(p.id)}>
                  <Check class="w-4 h-4" />
                  Approve Proposal
                </Button>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <div class="flex flex-col gap-4">
      <h3 class="text-xl font-bold text-foreground">Active Supervised Project Teams</h3>

      {#if activeProjects.length === 0}
        <div class="py-12 border border-dashed rounded-2xl flex flex-col items-center justify-center text-center">
          <BookOpen class="w-12 h-12 text-muted-foreground/30 mb-3" />
          <p class="text-sm font-bold text-muted-foreground">No active supervised teams</p>
        </div>
      {:else}
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          {#each activeProjects as p}
            <Card hoverable class="p-6 flex flex-col justify-between h-56 text-left">
              <div>
                <div class="flex justify-between items-start gap-4">
                  <h4 class="text-lg font-bold text-foreground truncate">{p.name}</h4>
                  <Badge variant="success">Active</Badge>
                </div>
                <p class="text-3xs font-bold text-muted-foreground uppercase tracking-wider mt-1">Leader: {p.ownerName}</p>

                <div class="mt-4 flex flex-col gap-1">
                  <div class="flex justify-between text-3xs font-bold text-muted-foreground">
                    <span>Milestones Completed</span>
                    <span>{calculateProgress(p)}%</span>
                  </div>
                  <div class="w-full h-2 bg-secondary rounded-full overflow-hidden border border-border mt-1">
                    <div class="h-full bg-primary transition-all duration-500" style="width: {calculateProgress(p)}%"></div>
                  </div>
                </div>
              </div>

              <div class="mt-6 pt-4 border-t border-border flex items-center justify-between">
                <span class="text-3xs font-bold text-muted-foreground uppercase tracking-widest">{p.members.length} members active</span>
                
                <a href="/dashboard/student/project/{p.id}">
                  <Button variant="outline" size="sm">
                    Monitor Team
                    <ArrowRight class="w-4 h-4" />
                  </Button>
                </a>
              </div>
            </Card>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}
