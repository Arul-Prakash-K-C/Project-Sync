<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth.svelte';
  import { db, type Project, type WeeklyReport } from '$lib/services/db';
  import { 
    BookOpen, 
    Clock, 
    Award, 
    AlertTriangle, 
    Users,
    Activity
  } from 'lucide-svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';

  let projects = $state<Project[]>([]);
  let weeklyReports = $state<WeeklyReport[]>([]);

  onMount(() => {
    loadData();
  });

  function loadData() {
    if (auth.user) {
      projects = db.getProjects().filter(p => p.department === auth.user!.department);
      weeklyReports = db.getWeeklyReports();
    }
  }

  let pendingProjects = $derived(projects.filter(p => p.status === 'pending'));
  let departmentReports = $derived(weeklyReports.filter(rep => projects.some(p => p.id === rep.projectId)));
  let activeProjects = $derived(projects.filter(p => p.status === 'active'));
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
        <div class="w-12 h-12 rounded-md bg-primary/10 flex items-center justify-center text-primary shrink-0">
          <BookOpen class="w-6 h-6" />
        </div>
        <div>
          <p class="text-2xs font-bold text-muted-foreground uppercase tracking-widest">Active Projects</p>
          <p class="text-2xl font-black text-foreground mt-1">{activeProjects.length}</p>
        </div>
      </Card>

      <Card hoverable class="flex items-center gap-4 py-5 px-6">
        <div class="w-12 h-12 rounded-md bg-warning/10 flex items-center justify-center text-warning shrink-0">
          <Clock class="w-6 h-6" />
        </div>
        <div>
          <p class="text-2xs font-bold text-muted-foreground uppercase tracking-widest">Pending Approvals</p>
          <p class="text-2xl font-black text-foreground mt-1">{pendingProjects.length}</p>
        </div>
      </Card>

      <Card hoverable class="flex items-center gap-4 py-5 px-6">
        <div class="w-12 h-12 rounded-md bg-destructive/10 flex items-center justify-center text-destructive shrink-0">
          <AlertTriangle class="w-6 h-6" />
        </div>
        <div>
          <p class="text-2xs font-bold text-muted-foreground uppercase tracking-widest">Overdue Milestones</p>
          <p class="text-2xl font-black text-foreground mt-1">{overdueMilestones}</p>
        </div>
      </Card>

      <Card hoverable class="flex items-center gap-4 py-5 px-6">
        <div class="w-12 h-12 rounded-md bg-success/10 flex items-center justify-center text-success shrink-0">
          <Users class="w-6 h-6" />
        </div>
        <div>
          <p class="text-2xs font-bold text-muted-foreground uppercase tracking-widest">Students Monitored</p>
          <p class="text-2xl font-black text-foreground mt-1">{totalStudents}</p>
        </div>
      </Card>
    </div>

    <!-- Main Overview Content -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
      
      <!-- Supervised teams list -->
      <div class="lg:col-span-2 flex flex-col gap-6">
        <Card>
          <h3 class="text-lg font-bold text-foreground mb-4">Assigned Student Teams Statistics</h3>
          
          <div class="flex flex-col gap-5">
            {#each activeProjects as p}
              <div class="p-4 border rounded-md hover:bg-muted/10 transition-colors flex flex-col gap-3">
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
              <div class="py-12 border border-dashed rounded-md flex flex-col items-center justify-center text-center text-xs text-muted-foreground/60 italic">
                No active projects currently under supervision in {auth.user.department}.
              </div>
            {/each}
          </div>
        </Card>
      </div>

      <!-- Recent activities list -->
      <Card class="flex flex-col gap-4">
        <h3 class="text-lg font-bold text-foreground border-b border-border/40 pb-2">Recent Submissions Activity</h3>
        
        <div class="flex flex-col gap-4 max-h-[400px] overflow-y-auto pr-1">
          {#each departmentReports.slice().reverse() as rep}
            {@const proj = projects.find(pr => pr.id === rep.projectId)}
            <div class="p-3 border rounded-md bg-card flex flex-col gap-1">
              <div class="flex justify-between items-center">
                <span class="text-xs font-bold text-foreground">Weekly Report Week {rep.weekNumber}</span>
                <Badge variant={rep.status === 'approved' ? 'success' : rep.status === 'pending' ? 'warning' : 'danger'}>
                  {rep.status}
                </Badge>
              </div>
              <p class="text-3xs text-muted-foreground truncate">Project: {proj?.name}</p>
              <p class="text-3xs text-muted-foreground">Submitted by: {rep.submittedByName}</p>
            </div>
          {:else}
            <div class="py-8 text-center text-xs text-muted-foreground italic">No recent submission activities found.</div>
          {/each}
        </div>
      </Card>

    </div>
  </div>
{/if}
