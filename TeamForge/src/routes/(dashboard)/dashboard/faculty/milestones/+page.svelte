<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth.svelte';
  import { db, type Project, type Milestone } from '$lib/services/db';
  import { toast } from '$lib/stores/toast.svelte';
  import { 
    Calendar, 
    Plus, 
    Trash2, 
    Edit3, 
    Lock, 
    Unlock, 
    Clock, 
    CheckCircle2, 
    Circle 
  } from 'lucide-svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';

  let projects = $state<Project[]>([]);
  let selectedMilestoneProjectId = $state('');
  let milestoneTitle = $state('');
  let milestoneDeadline = $state('');
  let editingMilestoneId = $state<string | null>(null);

  onMount(() => {
    loadData();
  });

  function loadData() {
    if (auth.user) {
      projects = db.getProjects().filter(p => p.department === auth.user!.department);
      const activeP = projects.filter(p => p.status === 'active');
      if (activeP.length > 0 && !selectedMilestoneProjectId) {
        selectedMilestoneProjectId = activeP[0].id;
      }
    }
  }

  let activeProjects = $derived(projects.filter(p => p.status === 'active'));

  function handleMilestoneSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!selectedMilestoneProjectId) return;
    const proj = projects.find(p => p.id === selectedMilestoneProjectId);
    if (!proj) return;

    try {
      if (editingMilestoneId) {
        const updated = proj.milestones.map(m => m.id === editingMilestoneId ? { ...m, title: milestoneTitle, deadline: milestoneDeadline } : m);
        db.updateProject(proj.id, { milestones: updated });
        db.logAudit(auth.user!.id, auth.user!.name, 'Updated milestone', 'milestone', editingMilestoneId, `${milestoneTitle} (${proj.name})`);
        toast.success('Milestone updated successfully');
        editingMilestoneId = null;
      } else {
        const newM: Milestone = {
          id: `m_${Date.now()}`,
          title: milestoneTitle,
          deadline: milestoneDeadline || new Date().toISOString().split('T')[0],
          completed: false,
          locked: false
        };
        db.updateProject(proj.id, { milestones: [...proj.milestones, newM] });
        db.logAudit(auth.user!.id, auth.user!.name, 'Created milestone', 'milestone', newM.id, `${milestoneTitle} (${proj.name})`);

        proj.members.forEach(member => {
          db.saveNotifications([
            {
              id: `notif_${Date.now()}_${member.userId}`,
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

  function deleteMilestone(projId: string, mId: string) {
    const proj = projects.find(p => p.id === projId);
    if (!proj) return;
    try {
      const deleted = proj.milestones.find(m => m.id === mId);
      const updated = proj.milestones.filter(m => m.id !== mId);
      db.updateProject(proj.id, { milestones: updated });
      db.logAudit(auth.user!.id, auth.user!.name, 'Deleted milestone', 'milestone', mId, `${deleted?.title ?? mId} (${proj.name})`);
      toast.success('Milestone deleted');
      loadData();
    } catch (err) {
      toast.error('Failed to delete milestone');
    }
  }

  function toggleLockMilestone(projId: string, mId: string) {
    const proj = projects.find(p => p.id === projId);
    if (!proj) return;
    try {
      const target = proj.milestones.find(m => m.id === mId);
      const nowLocked = !target?.locked;
      const updated = proj.milestones.map(m => m.id === mId ? { ...m, locked: nowLocked } : m);
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

  function extendMilestone(projId: string, mId: string) {
    const proj = projects.find(p => p.id === projId);
    const milestone = proj?.milestones.find(m => m.id === mId);
    if (!proj || !milestone) return;
    
    const newDeadline = prompt('Enter extended deadline date (YYYY-MM-DD):', milestone.deadline);
    if (newDeadline) {
      try {
        const updated = proj.milestones.map(m => m.id === mId ? { ...m, deadline: newDeadline, extendedDeadline: newDeadline } : m);
        db.updateProject(proj.id, { milestones: updated });
        db.logAudit(auth.user!.id, auth.user!.name, 'Extended milestone deadline', 'milestone', mId, `${milestone.title} (${proj.name}) → ${newDeadline}`);

        proj.members.forEach(member => {
          db.saveNotifications([
            {
              id: `notif_${Date.now()}_${member.userId}`,
              userId: member.userId,
              title: 'Milestone Deadline Extended',
              description: `Deadline for "${milestone.title}" has been updated to ${newDeadline}.`,
              type: 'project',
              read: false,
              createdAt: new Date().toISOString(),
              actionUrl: `/dashboard/student/project/${proj.id}`
            }
          ]);
        });

        toast.success('Milestone deadline extended');
        loadData();
      } catch (err) {
        toast.error('Failed to extend milestone');
      }
    }
  }
</script>

{#if auth.user}
  <div class="flex flex-col gap-8 text-left">
    <div class="flex flex-col border-b border-border/40 pb-4">
      <h2 class="text-3xl font-extrabold tracking-tight text-foreground">Milestones Management</h2>
      <p class="text-sm text-muted-foreground mt-1">Assign deliverables, extend deadlines, or lock milestones for active teams.</p>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
      <!-- Milestone definition card -->
      <Card class="flex flex-col gap-4">
        <h3 class="text-lg font-bold text-foreground border-b border-border/40 pb-2">
          {editingMilestoneId ? 'Edit Milestone Details' : 'Create New Milestone'}
        </h3>
        
        <form onsubmit={handleMilestoneSubmit} class="flex flex-col gap-4">
          <div class="flex flex-col gap-1.5">
            <label for="mil-proj" class="text-xs font-semibold text-foreground">Select Project Team</label>
            <select 
              id="mil-proj"
              bind:value={selectedMilestoneProjectId}
              required
              class="w-full px-4 py-2.5 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none cursor-pointer"
            >
              {#each activeProjects as p}
                <option value={p.id}>{p.name}</option>
              {/each}
            </select>
          </div>

          <div class="flex flex-col gap-1.5">
            <label for="mil-title" class="text-xs font-semibold text-foreground">Milestone Title</label>
            <input 
              id="mil-title"
              type="text" 
              placeholder="e.g. Setup API Endpoints" 
              bind:value={milestoneTitle}
              required
              class="w-full px-4 py-2.5 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none"
            />
          </div>

          <div class="flex flex-col gap-1.5">
            <label for="mil-deadline" class="text-xs font-semibold text-foreground">Target Deadline</label>
            <input 
              id="mil-deadline"
              type="date" 
              bind:value={milestoneDeadline}
              required
              class="w-full px-4 py-2.5 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none"
            />
          </div>

          <div class="flex justify-end gap-2 mt-2">
            {#if editingMilestoneId}
              <Button type="button" variant="outline" size="sm" onclick={() => { editingMilestoneId = null; milestoneTitle = ''; milestoneDeadline = ''; }}>Cancel</Button>
            {/if}
              <Button type="submit" variant="primary" size="sm">
                {editingMilestoneId ? 'Save Changes' : 'Assign Milestone'}
              </Button>
          </div>
        </form>
      </Card>

      <!-- Milestones List -->
      <div class="lg:col-span-2 flex flex-col gap-6">
        <Card>
          <div class="flex justify-between items-center border-b border-border/40 pb-2 mb-4">
            <h3 class="text-lg font-bold text-foreground">Assigned Milestones Checklist</h3>
            <select 
              bind:value={selectedMilestoneProjectId}
              class="px-3 py-1.5 rounded-md border border-border bg-background text-xs font-semibold text-foreground focus:outline-none cursor-pointer"
              aria-label="Filter milestones by project"
            >
              {#each activeProjects as p}
                <option value={p.id}>{p.name}</option>
              {/each}
            </select>
          </div>

          {@const activeProj = projects.find(p => p.id === selectedMilestoneProjectId)}
          {#if activeProj}
            <div class="flex flex-col gap-3">
              {#each activeProj.milestones as m}
                <div class="p-4 border rounded-md bg-card flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-primary/20 transition-all">
                  <div class="flex items-center gap-3">
                    {#if m.completed}
                      <CheckCircle2 class="w-5 h-5 text-success fill-success/10 shrink-0" />
                    {:else}
                      <Circle class="w-5 h-5 text-muted-foreground shrink-0" />
                    {/if}
                    <div class="flex flex-col">
                      <span class="text-sm font-bold text-foreground {m.completed ? 'line-through text-muted-foreground' : ''}">
                        {m.title}
                      </span>
                      <span class="text-3xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Calendar class="w-3.5 h-3.5" />
                        Deadline: {m.deadline} {m.extendedDeadline ? '(Extended)' : ''}
                      </span>
                    </div>
                  </div>

                  <div class="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                    <button 
                      onclick={() => toggleLockMilestone(activeProj.id, m.id)}
                      class="p-2 border rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                      title={m.locked ? 'Unlock Milestone' : 'Lock Milestone'}
                    >
                      {#if m.locked}
                        <Lock class="w-3.5 h-3.5 text-destructive" />
                      {:else}
                        <Unlock class="w-3.5 h-3.5" />
                      {/if}
                    </button>

                    <button 
                      onclick={() => extendMilestone(activeProj.id, m.id)}
                      class="p-2 border rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                      title="Extend Milestone Deadline"
                    >
                      <Clock class="w-3.5 h-3.5" />
                    </button>

                    <button 
                      onclick={() => { editingMilestoneId = m.id; milestoneTitle = m.title; milestoneDeadline = m.deadline; }}
                      class="p-2 border rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                      title="Edit Milestone"
                    >
                      <Edit3 class="w-3.5 h-3.5" />
                    </button>

                    <button 
                      onclick={() => deleteMilestone(activeProj.id, m.id)}
                      class="p-2 border rounded-lg hover:bg-destructive/10 text-destructive cursor-pointer transition-colors"
                      title="Delete Milestone"
                    >
                      <Trash2 class="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              {:else}
                <div class="py-8 text-center text-xs text-muted-foreground italic">No milestones defined for this project. Use the form on the left to add one.</div>
              {/each}
            </div>
          {:else}
            <div class="py-8 text-center text-xs text-muted-foreground italic">Select or launch an active project.</div>
          {/if}
        </Card>
      </div>
    </div>
  </div>
{/if}
