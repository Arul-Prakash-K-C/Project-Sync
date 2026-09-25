<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth.svelte';
  import { db, type Project, type Task, memberRoleLabel } from '$lib/services/db';
  import { BarChart3, Users } from 'lucide-svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import EmptyState from '$lib/components/ui/EmptyState.svelte';
  import ProgressBar from '$lib/components/ui/ProgressBar.svelte';
  import Avatar from '$lib/components/ui/Avatar.svelte';

  let projects = $state<Project[]>([]);
  let allTasks = $state<Task[]>([]);
  let loaded = $state(false);

  onMount(() => {
    loadData();
    loaded = true;
  });

  function loadData() {
    if (auth.user) {
      projects = db.getSupervisedProjects(auth.user!);
      allTasks = db.getTasks();
    }
  }

  let activeProjects = $derived(projects.filter((p) => p.status === 'active'));

  function calculateProgress(p: Project): number {
    if (p.milestones.length === 0) return 0;
    const completed = p.milestones.filter((m) => m.completed).length;
    return Math.round((completed / p.milestones.length) * 100);
  }

  /** One flat row per student, built once so the table and the mobile card list
      render exactly the same numbers. */
  const rows = $derived(
    activeProjects.flatMap((p) =>
      p.members.map((member) => {
        const studentTasks = allTasks.filter(
          (t) => t.projectId === p.id && t.assignees.includes(member.userId)
        );
        const projectTaskCount = allTasks.filter((t) => t.projectId === p.id).length;
        return {
          key: `${p.id}-${member.userId}`,
          member,
          project: p,
          tasksTotal: studentTasks.length,
          tasksDone: studentTasks.filter((t) => t.column === 'completed').length,
          milestonesDone: p.milestones.filter((m) => m.completed).length,
          milestonesTotal: p.milestones.length,
          progress: calculateProgress(p),
          attendance: db.getAttendanceSummary(p.id, member.userId),
          contribution: projectTaskCount > 0 ? Math.round((studentTasks.length / projectTaskCount) * 100) : 0
        };
      })
    )
  );
</script>

<svelte:head>
  <title>Student Analytics — TeamForge</title>
</svelte:head>

{#if auth.user}
  <div class="flex flex-col gap-6 max-w-7xl">
    <PageHeader
      title="Student analytics"
      icon={BarChart3}
      description="Milestone completion, task allocation and individual work share across the active teams in {auth.user.department}."
    />

    <Card title="Individual progress" flush>
      {#if !loaded}
        <div class="p-5 flex flex-col gap-3" aria-busy="true">
          {#each { length: 4 } as _, i (i)}
            <div class="skeleton h-10 w-full"></div>
          {/each}
        </div>
      {:else if rows.length === 0}
        <div class="p-5">
          <EmptyState
            icon={Users}
            title="No students to track"
            description="Once a proposal is approved, every member of that team appears here with their task and milestone counts."
            size="sm"
          />
        </div>
      {:else}
        <!-- Six columns do not survive a phone. Below `md` the same rows render
             as stacked cards with the figures as labelled pairs. -->
        <div class="table-scroll hidden md:block">
          <table class="data-table">
            <caption class="sr-only">
              Progress per student across active projects in {auth.user.department}
            </caption>
            <thead>
              <tr>
                <th scope="col">Student</th>
                <th scope="col">Project</th>
                <th scope="col" class="text-center">Milestones</th>
                <th scope="col" class="text-center">Tasks</th>
                <th scope="col" class="text-center">Attendance</th>
                <th scope="col" class="text-right">Completion</th>
              </tr>
            </thead>
            <tbody>
              {#each rows as r (r.key)}
                <tr>
                  <th scope="row" class="p-4 font-normal">
                    <span class="flex items-center gap-3">
                      <Avatar src={r.member.avatar} name={r.member.name} size="sm" />
                      <span class="flex flex-col min-w-0 leading-tight">
                        <span class="text-sm font-bold text-foreground truncate">{r.member.name}</span>
                        <span class="text-3xs text-muted-foreground uppercase tracking-wider">
                          {memberRoleLabel(r.project, r.member)}
                        </span>
                      </span>
                    </span>
                  </th>
                  <td class="text-xs text-muted-foreground">{r.project.name}</td>
                  <td class="text-center text-sm font-bold text-foreground tabular">
                    {r.milestonesDone}<span class="text-muted-foreground font-normal">/{r.milestonesTotal}</span>
                  </td>
                  <td class="text-center text-sm text-muted-foreground tabular">
                    <span class="font-bold text-foreground">{r.tasksDone}</span>/{r.tasksTotal}
                  </td>
                  <td class="text-center">
                    {#if r.attendance.rate === null}
                      <!-- No register taken yet — say so rather than show a fake 100%. -->
                      <Badge variant="outline" size="sm" title="No attendance recorded for this team's review meetings yet">
                        No register
                      </Badge>
                    {:else}
                      <span
                        class="text-sm font-bold tabular {r.attendance.rate < 75 ? 'text-destructive' : 'text-foreground'}"
                        title="{r.attendance.present} present · {r.attendance.late} late · {r.attendance.excused} excused · {r.attendance.absent} absent"
                      >
                        {r.attendance.rate}%
                      </span>
                      <span class="block text-3xs text-muted-foreground tabular">
                        {r.attendance.recorded} meeting{r.attendance.recorded === 1 ? '' : 's'}
                      </span>
                    {/if}
                  </td>
                  <td class="text-right">
                    <span class="text-sm font-bold text-foreground tabular">{r.progress}%</span>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>

        <ul class="md:hidden divide-y divide-border">
          {#each rows as r (r.key)}
            <li class="p-4">
              <div class="flex items-center gap-3">
                <Avatar src={r.member.avatar} name={r.member.name} size="sm" />
                <div class="min-w-0 leading-tight">
                  <p class="text-sm font-bold text-foreground truncate">{r.member.name}</p>
                  <p class="text-2xs text-muted-foreground truncate">{r.project.name}</p>
                </div>
              </div>

              <dl class="grid grid-cols-4 gap-3 mt-3">
                <div>
                  <dt class="eyebrow">Milestones</dt>
                  <dd class="text-sm font-bold text-foreground tabular mt-0.5">
                    {r.milestonesDone}/{r.milestonesTotal}
                  </dd>
                </div>
                <div>
                  <dt class="eyebrow">Tasks</dt>
                  <dd class="text-sm font-bold text-foreground tabular mt-0.5">
                    {r.tasksDone}/{r.tasksTotal}
                  </dd>
                </div>
                <div>
                  <dt class="eyebrow">Attended</dt>
                  <dd class="text-sm font-bold text-foreground tabular mt-0.5">
                    {r.attendance.rate === null ? '—' : `${r.attendance.rate}%`}
                  </dd>
                </div>
                <div>
                  <dt class="eyebrow">Completion</dt>
                  <dd class="text-sm font-bold text-foreground tabular mt-0.5">{r.progress}%</dd>
                </div>
              </dl>
            </li>
          {/each}
        </ul>
      {/if}
    </Card>

    <Card title="Work share by team" description="Share of each team's tasks assigned to each member.">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        {#each activeProjects as p (p.id)}
          <section class="p-4 border border-border rounded-md">
            <h3 class="text-sm font-bold text-foreground border-b border-border pb-2.5">{p.name}</h3>
            <div class="flex flex-col gap-3 mt-3">
              {#each p.members as member (member.userId)}
                {@const studentTasks = allTasks.filter(
                  (t) => t.projectId === p.id && t.assignees.includes(member.userId)
                )}
                {@const totalPTasks = allTasks.filter((t) => t.projectId === p.id).length}
                {@const contribution =
                  totalPTasks > 0 ? Math.round((studentTasks.length / totalPTasks) * 100) : 0}
                <ProgressBar
                  value={contribution}
                  label={member.name}
                  valueLabel="{contribution}%"
                  tone={contribution === 0 ? 'danger' : 'accent'}
                  size="sm"
                />
              {/each}
              {#if allTasks.filter((t) => t.projectId === p.id).length === 0}
                <p class="text-2xs text-muted-foreground">
                  No tasks created yet, so there is nothing to divide.
                </p>
              {/if}
            </div>
          </section>
        {:else}
          <div class="md:col-span-2">
            <EmptyState
              icon={BarChart3}
              title="No active teams"
              description="Work-share breakdowns appear once you approve a proposal and the team starts creating tasks."
              size="sm"
            />
          </div>
        {/each}
      </div>
    </Card>
  </div>
{/if}
