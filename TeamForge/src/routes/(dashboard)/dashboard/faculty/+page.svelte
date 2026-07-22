<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth.svelte';
  import { db, type Project, type ProjectIdea, type WeeklyReport } from '$lib/services/db';
  import { toast } from '$lib/stores/toast.svelte';
  import { 
    BookOpen, CheckSquare, Clock, ArrowRight, Check, X, Award, Lightbulb, 
    MessageSquare, Send, AlertTriangle, Users, Activity 
  } from 'lucide-svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import Dialog from '$lib/components/ui/Dialog.svelte';

  let projects = $state<Project[]>([]);
  let projectIdeas = $state<ProjectIdea[]>([]);
  let weeklyReports = $state<WeeklyReport[]>([]);

  // Derived states
  let pendingProjects = $derived(projects.filter(p => p.status === 'pending'));
  let activeProjects = $derived(projects.filter(p => p.status === 'active'));
  let adviceRequestIdeas = $derived(
    projectIdeas.filter(idea => 
      idea.advisingFaculty && 
      idea.advisingFaculty === (auth.user?.id || '')
    )
  );

  // Dialog for advice
  let adviceDialogOpen = $state(false);
  let selectedIdea = $state<ProjectIdea | null>(null);
  let adviceFeedback = $state('');

  onMount(() => {
    loadData();
  });

  function loadData() {
    if (auth.user) {
      projects = db.getProjects().filter(p => p.department === auth.user!.department);
      projectIdeas = db.getProjectIdeas();
      weeklyReports = db.getWeeklyReports();
    }
  }

  function openAdviceDialog(idea: ProjectIdea) {
    selectedIdea = idea;
    adviceFeedback = '';
    adviceDialogOpen = true;
  }

  function submitAdvice(e: SubmitEvent) {
    e.preventDefault();
    if (!selectedIdea || !auth.user) return;

    try {
      db.addIdeaAdvice(selectedIdea.id, auth.user, adviceFeedback);
      toast.success(`Advice submitted for "${selectedIdea.title}"!`);
      adviceDialogOpen = false;
      selectedIdea = null;
      adviceFeedback = '';
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit advice');
    }
  }

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

  let totalStudents = $derived(activeProjects.reduce((sum, p) => sum + p.members.length, 0));
  let overdueMilestones = $derived(
    activeProjects.reduce((count, p) => {
      const today = new Date().toISOString().split('T')[0];
      const overdue = p.milestones.filter(m => !m.completed && m.deadline < today);
      return count + overdue.length;
    }, 0)
  );

  function calculateProgress(p: Project): number {
    if (p.milestones.length === 0) return 0;
    const completed = p.milestones.filter(m => m.completed).length;
    return Math.round((completed / p.milestones.length) * 100);
  }
</script>

{#if auth.user}
  <div class="flex flex-col gap-8 text-left">
    
    <!-- Title / Nav Header -->
    <div class="flex flex-col border-b border-border/40 pb-4">
      <h2 class="text-3xl font-extrabold tracking-tight text-foreground">Faculty Overview Dashboard</h2>
      <p class="text-sm text-muted-foreground mt-1">High-level supervision summary of academic project teams, milestones status, and recent submissions.</p>
    </div>

    <!-- Quick Stats -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      <Card hoverable class="flex items-center gap-4 py-5 px-6">
        <div class="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
          <BookOpen class="w-6 h-6" />
        </div>
        <div>
          <p class="text-2xs font-bold text-muted-foreground uppercase tracking-widest">Active Projects</p>
          <p class="text-2xl font-black text-foreground mt-1">{activeProjects.length}</p>
        </div>
      </Card>

      <Card hoverable class="flex items-center gap-4 py-5 px-6">
        <div class="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0">
          <Clock class="w-6 h-6" />
        </div>
        <div>
          <p class="text-2xs font-bold text-muted-foreground uppercase tracking-widest">Pending Approvals</p>
          <p class="text-2xl font-black text-foreground mt-1">{pendingProjects.length}</p>
        </div>
      </Card>

      <Card hoverable class="flex items-center gap-4 py-5 px-6">
        <div class="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500 shrink-0">
          <AlertTriangle class="w-6 h-6" />
        </div>
        <div>
          <p class="text-2xs font-bold text-muted-foreground uppercase tracking-widest">Overdue Milestones</p>
          <p class="text-2xl font-black text-foreground mt-1">{overdueMilestones}</p>
        </div>
      </Card>

      <Card hoverable class="flex items-center gap-4 py-5 px-6">
        <div class="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0">
          <Users class="w-6 h-6" />
        </div>
        <div>
          <p class="text-2xs font-bold text-muted-foreground uppercase tracking-widest">Students Monitored</p>
          <p class="text-2xl font-black text-foreground mt-1">{totalStudents}</p>
        </div>
      </Card>
    </div>

    <!-- Main Overview Layout (Split 2-Column Grid on large screens) -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
      
      <!-- Main Content Area (Pending Approvals, Advice Requests, Teams List) -->
      <div class="lg:col-span-2 flex flex-col gap-8">
        
        <!-- Proposals Section -->
        <div class="flex flex-col gap-4">
          <h3 class="text-xl font-bold text-foreground">Project Proposals Pending Approval</h3>
          {#if pendingProjects.length === 0}
            <div class="py-12 border border-dashed rounded-2xl flex flex-col items-center justify-center text-center bg-card/10">
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

        <!-- Advice Requests Section -->
        <div class="flex flex-col gap-4">
          <h3 class="text-xl font-bold text-foreground flex items-center gap-2">
            <Lightbulb class="w-5 h-5 text-amber-500 fill-amber-500/10" />
            Project Ideas Requesting Advice
          </h3>

          {#if adviceRequestIdeas.length === 0}
            <div class="py-12 border border-dashed rounded-2xl flex flex-col items-center justify-center text-center bg-card/10">
              <MessageSquare class="w-12 h-12 text-muted-foreground/30 mb-3" />
              <p class="text-sm font-bold text-muted-foreground">No advice requests at this time</p>
              <p class="text-xs text-muted-foreground/60 max-w-xs mt-1">Students will request your feedback here when drafting their initial ideas.</p>
            </div>
          {:else}
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              {#each adviceRequestIdeas as idea}
                <Card class="p-6 flex flex-col justify-between min-h-60 text-left relative overflow-hidden">
                  <div>
                    <div class="flex justify-between items-start gap-4">
                      <div class="flex items-center gap-2 min-w-0">
                        <Lightbulb class="w-5 h-5 text-amber-500 shrink-0" />
                        <h4 class="text-base font-bold text-foreground truncate" title={idea.title}>{idea.title}</h4>
                      </div>
                      <Badge variant="outline" class="text-3xs text-primary shrink-0">{idea.domain}</Badge>
                    </div>
                    <p class="text-3xs font-bold text-muted-foreground uppercase tracking-wider mt-1">Author: {idea.ownerName}</p>
                    <p class="text-xs text-muted-foreground line-clamp-3 leading-relaxed mt-3">{idea.description}</p>
                    
                    <div class="flex flex-wrap gap-1 mt-3">
                      {#each idea.requiredSkills.slice(0, 3) as skill}
                        <Badge variant="primary" class="text-3xs px-1.5 py-0">{skill}</Badge>
                      {/each}
                      {#if idea.requiredSkills.length > 3}
                        <span class="text-3xs text-muted-foreground font-semibold">+{idea.requiredSkills.length - 3}</span>
                      {/if}
                    </div>
                  </div>

                  <div class="mt-6 pt-4 border-t border-border flex items-center justify-between">
                    <span class="text-3xs font-bold text-muted-foreground uppercase tracking-widest">
                      {idea.advice?.length || 0} advice entries
                    </span>
                    
                    <Button variant="primary" size="sm" onclick={() => openAdviceDialog(idea)}>
                      <MessageSquare class="w-3.5 h-3.5" />
                      Provide Advice
                    </Button>
                  </div>
                </Card>
              {/each}
            </div>
          {/if}
        </div>

        <!-- Supervised Teams Statistics Section -->
        <Card>
          <h3 class="text-lg font-bold text-foreground mb-4">Assigned Student Teams Statistics</h3>
          
          <div class="flex flex-col gap-5">
            {#each activeProjects as p}
              <div class="p-4 border rounded-xl hover:bg-muted/10 transition-colors flex flex-col gap-3">
                <div class="flex justify-between items-start gap-4">
                  <div>
                    <h4 class="font-extrabold text-foreground text-sm">{p.name}</h4>
                    <p class="text-3xs text-muted-foreground mt-0.5 uppercase tracking-wider font-bold">Lead: {p.ownerName} • {p.members.length} Members</p>
                  </div>
                  <Badge variant="success">Active</Badge>
                </div>
                
                <div class="flex flex-col gap-1">
                  <div class="flex justify-between text-3xs font-bold text-muted-foreground">
                    <span>Milestones Completed</span>
                    <span>{calculateProgress(p)}%</span>
                  </div>
                  <div class="w-full h-2 bg-secondary rounded-full overflow-hidden border border-border mt-1">
                    <div class="h-full bg-primary transition-all duration-500" style="width: {calculateProgress(p)}%"></div>
                  </div>
                </div>
              </div>
            {:else}
              <div class="py-12 border border-dashed rounded-xl flex flex-col items-center justify-center text-center text-xs text-muted-foreground/60 italic">
                No active projects currently under supervision in {auth.user.department}.
              </div>
            {/each}
          </div>
        </Card>

      </div>

      <!-- Right Column: Sidebar (Recent Submissions Activity) -->
      <Card class="flex flex-col gap-4">
        <h3 class="text-lg font-bold text-foreground border-b border-border/40 pb-2">Recent Submissions Activity</h3>
        
        <div class="flex flex-col gap-4 max-h-[600px] overflow-y-auto pr-1">
          {#each weeklyReports.slice().reverse() as rep}
            {@const proj = projects.find(pr => pr.id === rep.projectId)}
            {#if proj}
              <div class="p-3 border rounded-xl bg-card flex flex-col gap-1">
                <div class="flex justify-between items-center">
                  <span class="text-xs font-bold text-foreground">Weekly Report Week {rep.weekNumber}</span>
                  <Badge variant={rep.status === 'approved' ? 'success' : rep.status === 'pending' ? 'warning' : 'danger'}>
                    {rep.status}
                  </Badge>
                </div>
                <p class="text-3xs text-muted-foreground truncate">Project: {proj.name}</p>
                <p class="text-3xs text-muted-foreground">Submitted by: {rep.submittedByName}</p>
              </div>
            {/if}
          {:else}
            <div class="py-8 text-center text-xs text-muted-foreground italic">No recent submission activities found.</div>
          {/each}
        </div>
      </Card>

    </div>
  </div>
{/if}

<!-- Provide Advice Dialog -->
<Dialog bind:open={adviceDialogOpen} title="Provide Project Advice" class="max-w-md">
  {#if selectedIdea}
    <form onsubmit={submitAdvice} class="flex flex-col gap-4">
      <div class="flex flex-col gap-1">
        <span class="text-xs font-bold text-muted-foreground uppercase tracking-wider">Project Idea</span>
        <span class="text-sm font-extrabold text-foreground">{selectedIdea.title}</span>
        <p class="text-xs text-muted-foreground bg-secondary/35 p-2.5 rounded-lg border border-border mt-1 line-clamp-4 leading-relaxed italic">
          "{selectedIdea.description}"
        </p>
      </div>

      <div class="flex flex-col gap-1.5">
        <label for="advice-feedback" class="text-xs font-semibold text-foreground">Your Advice / Feedback</label>
        <textarea 
          id="advice-feedback"
          placeholder="Write constructive advice, recommendations, or suggestions for tech stack, scope, or requirements..." 
          bind:value={adviceFeedback} 
          required
          rows="5"
          class="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none"
        ></textarea>
      </div>

      <div class="flex justify-end gap-2 mt-2">
        <Button type="button" variant="outline" onclick={() => adviceDialogOpen = false}>Cancel</Button>
        <Button type="submit" variant="primary">
          <Send class="w-3.5 h-3.5" />
          Submit Advice
        </Button>
      </div>
    </form>
  {/if}
</Dialog>
