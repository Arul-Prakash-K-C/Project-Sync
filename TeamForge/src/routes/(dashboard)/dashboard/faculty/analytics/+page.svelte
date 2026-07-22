<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth.svelte';
  import { db, type Project, type Task } from '$lib/services/db';
  import { BarChart3, Users } from 'lucide-svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';

  let projects = $state<Project[]>([]);
  let allTasks = $state<Task[]>([]);

  onMount(() => {
    loadData();
  });

  function loadData() {
    if (auth.user) {
      projects = db.getProjects().filter(p => p.department === auth.user!.department);
      allTasks = db.getTasks();
    }
  }

  let activeProjects = $derived(projects.filter(p => p.status === 'active'));

  function calculateProgress(p: Project): number {
    if (p.milestones.length === 0) return 0;
    const completed = p.milestones.filter(m => m.completed).length;
    return Math.round((completed / p.milestones.length) * 100);
  }
</script>

{#if auth.user}
  <div class="flex flex-col gap-8 text-left">
    <div class="flex flex-col border-b border-border/40 pb-4">
      <h2 class="text-3xl font-extrabold tracking-tight text-foreground">Student Progress & Analytics</h2>
      <p class="text-sm text-muted-foreground mt-1">Monitor milestones completion, task allocations, and individual contribution analytics.</p>
    </div>

    <!-- Student tracking grid -->
    <Card>
      <div class="flex justify-between items-center border-b border-border/40 pb-3 mb-4">
        <h3 class="text-lg font-bold text-foreground">Individual Student Progress Monitor</h3>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-sm text-left border-collapse">
          <thead>
            <tr class="border-b border-border text-muted-foreground font-black text-2xs uppercase tracking-wider">
              <th class="py-3 px-4">Student</th>
              <th class="py-3 px-4">Project Workspace</th>
              <th class="py-3 px-4 text-center">Milestones Done</th>
              <th class="py-3 px-4 text-center">Tasks Handled</th>
              <th class="py-3 px-4 text-center">Attendance</th>
              <th class="py-3 px-4 text-right">Completion Rate</th>
            </tr>
          </thead>
          <tbody>
            {#each activeProjects as p}
              {#each p.members as member}
                {@const studentTasks = allTasks.filter(t => t.projectId === p.id && t.assignees.includes(member.userId))}
                {@const completedTasks = studentTasks.filter(t => t.column === 'completed').length}
                {@const mProg = calculateProgress(p)}
                <tr class="border-b border-border hover:bg-muted/10 transition-colors">
                  <td class="py-3.5 px-4 flex items-center gap-3">
                    <img src={member.avatar} alt={member.name} class="w-8 h-8 rounded-full bg-muted shrink-0" />
                    <div class="flex flex-col min-w-0">
                      <span class="font-extrabold text-foreground truncate">{member.name}</span>
                      <span class="text-3xs text-muted-foreground font-semibold uppercase tracking-wider">{member.role}</span>
                    </div>
                  </td>
                  <td class="py-3.5 px-4 text-xs font-semibold text-foreground/80">{p.name}</td>
                  <td class="py-3.5 px-4 text-center text-xs font-bold text-foreground">
                    {p.milestones.filter(m => m.completed).length} / {p.milestones.length}
                  </td>
                  <td class="py-3.5 px-4 text-center text-xs font-semibold text-muted-foreground">
                    {completedTasks} <span class="text-3xs text-muted-foreground/60">completed</span> / {studentTasks.length} total
                  </td>
                  <td class="py-3.5 px-4 text-center">
                    <Badge variant="success">95% (Mocked)</Badge>
                  </td>
                  <td class="py-3.5 px-4 text-right">
                    <span class="text-xs font-black text-foreground">{mProg}%</span>
                  </td>
                </tr>
              {/each}
            {:else}
              <tr>
                <td colspan="6" class="py-8 text-center text-xs text-muted-foreground italic">No student tracking information available.</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </Card>

    <!-- Team analytics -->
    <Card>
      <h3 class="text-lg font-bold text-foreground border-b border-border/40 pb-3 mb-4">Team Contribution Analytics</h3>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        {#each activeProjects as p}
          <div class="p-4 border rounded-xl bg-card flex flex-col gap-4">
            <h4 class="font-extrabold text-foreground text-sm border-b border-border/40 pb-2">{p.name} Breakdown</h4>
            
            <div class="flex flex-col gap-3">
              {#each p.members as member}
                {@const studentTasks = allTasks.filter(t => t.projectId === p.id && t.assignees.includes(member.userId))}
                {@const totalPTasks = allTasks.filter(t => t.projectId === p.id).length}
                {@const contribution = totalPTasks > 0 ? Math.round((studentTasks.length / totalPTasks) * 100) : 0}
                
                <div class="flex flex-col gap-1">
                  <div class="flex justify-between items-center text-2xs font-bold text-muted-foreground">
                    <span>{member.name}</span>
                    <span>{contribution}% Work Share</span>
                  </div>
                  <div class="w-full h-1.5 bg-secondary rounded-full overflow-hidden border border-border mt-0.5">
                    <div class="h-full bg-primary" style="width: {contribution}%"></div>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    </Card>
  </div>
{/if}
