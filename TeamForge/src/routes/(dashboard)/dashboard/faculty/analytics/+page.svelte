<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth.svelte';
  import {
    db,
    type Project,
    type Task,
    type Meeting,
    type WeeklyReport,
    type Thread,
    type ProjectFile,
    memberRoleLabel
  } from '$lib/services/db';
  import { BarChart3, Users, ShieldAlert, TrendingDown, Activity, LayoutList } from 'lucide-svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import EmptyState from '$lib/components/ui/EmptyState.svelte';
  import Avatar from '$lib/components/ui/Avatar.svelte';
  import RiskCard from '$lib/components/RiskCard.svelte';
  import StackedBarChart, { type Series } from '$lib/components/charts/StackedBarChart.svelte';
  import BurndownChart from '$lib/components/charts/BurndownChart.svelte';
  import ActivityHeatmap from '$lib/components/charts/ActivityHeatmap.svelte';
  import { calculateTeamRisk } from '$lib/utils/risk';
  import { burndown, activityCalendar, statusCounts, isoDay } from '$lib/utils/analytics';

  let projects = $state<Project[]>([]);
  let allTasks = $state<Task[]>([]);
  let meetings = $state<Meeting[]>([]);
  let reports = $state<WeeklyReport[]>([]);
  let threads = $state<Thread[]>([]);
  let files = $state<ProjectFile[]>([]);
  let loaded = $state(false);

  /** 'all' or a project id; scopes every chart and table below the filter row. */
  let scope = $state('all');

  const today = isoDay(new Date());

  onMount(() => {
    loadData();
    loaded = true;
  });

  function loadData() {
    if (auth.user) {
      projects = db.getSupervisedProjects(auth.user!);
      allTasks = db.getTasks();
      meetings = db.getMeetings();
      reports = db.getWeeklyReports();
      threads = db.getThreads();
      files = db.getFiles();
    }
  }

  let activeProjects = $derived(projects.filter((p) => p.status === 'active'));
  const scoped = $derived(scope === 'all' ? activeProjects : activeProjects.filter((p) => p.id === scope));
  const scopedIds = $derived(new Set(scoped.map((p) => p.id)));
  const scopedTasks = $derived(allTasks.filter((t) => scopedIds.has(t.projectId)));

  const tasksOf = (p: Project) => allTasks.filter((t) => t.projectId === p.id);

  const risks = $derived(
    scoped
      .map((p) => ({
        project: p,
        risk: calculateTeamRisk({
          project: p,
          tasks: tasksOf(p),
          meetings: meetings.filter((m) => m.projectId === p.id),
          reports: reports.filter((r) => r.projectId === p.id),
          today
        })
      }))
      .sort((a, b) => b.risk.score - a.risk.score)
  );

  const burn = $derived(burndown(scoped, scopedTasks, today));

  const activity = $derived(
    activityCalendar(
      {
        tasks: scopedTasks,
        threads: threads.filter((t) => scopedIds.has(t.projectId)),
        files: files.filter((f) => scopedIds.has(f.projectId)),
        reports: reports.filter((r) => scopedIds.has(r.projectId)),
        projects: scoped
      },
      today
    )
  );

  /** Task-state colours match the dots on the Kanban board's column headers. */
  const statusSeries: Series[] = [
    { key: 'completed', label: 'Completed', color: 'var(--success)' },
    { key: 'review', label: 'In review', color: 'var(--warning)' },
    { key: 'inprogress', label: 'In progress', color: 'var(--info)' },
    { key: 'todo', label: 'To do', color: 'color-mix(in oklab, var(--muted-foreground) 55%, var(--card))' }
  ];

  const statusRows = $derived(
    scoped.map((p) => ({
      id: p.id,
      label: p.name,
      sublabel: `${tasksOf(p).length} tasks`,
      values: statusCounts(tasksOf(p))
    }))
  );

  const workloadRows = $derived(
    scoped.flatMap((p) => {
      const projectTasks = tasksOf(p);
      return p.members.map((m) => {
        const mine = projectTasks.filter((t) => t.assignees.includes(m.userId));
        const share = projectTasks.length ? Math.round((mine.length / projectTasks.length) * 100) : 0;
        return {
          id: `${p.id}-${m.userId}`,
          label: m.name,
          sublabel: scope === 'all' ? `${p.name} · ${share}% of tasks` : `${share}% of the team's tasks`,
          values: statusCounts(mine)
        };
      });
    })
  );

  function calculateProgress(p: Project): number {
    if (p.milestones.length === 0) return 0;
    const completed = p.milestones.filter((m) => m.completed).length;
    return Math.round((completed / p.milestones.length) * 100);
  }

  /** One flat row per student, built once so the table and the mobile card list
      render exactly the same numbers. */
  const rows = $derived(
    scoped.flatMap((p) =>
      p.members.map((member) => {
        const studentTasks = allTasks.filter(
          (t) => t.projectId === p.id && t.assignees.includes(member.userId)
        );
        return {
          key: `${p.id}-${member.userId}`,
          member,
          project: p,
          tasksTotal: studentTasks.length,
          tasksDone: studentTasks.filter((t) => t.column === 'completed').length,
          milestonesDone: p.milestones.filter((m) => m.completed).length,
          milestonesTotal: p.milestones.length,
          progress: calculateProgress(p),
          attendance: db.getAttendanceSummary(p.id, member.userId)
        };
      })
    )
  );
</script>

<svelte:head>
  <title>Student Analytics — Project-Sync</title>
</svelte:head>

{#if auth.user}
  <div class="flex flex-col gap-6 max-w-7xl">
    <PageHeader
      title="Student analytics"
      icon={BarChart3}
      description="Risk, burndown, activity and workload across the teams you mentor, down to each student."
    />

    {#if loaded && activeProjects.length === 0}
      <EmptyState
        icon={BarChart3}
        title="No active teams"
        description="Charts appear once you approve a proposal and the team starts creating tasks."
      />
    {:else}
      <!-- One filter row, above everything it scopes. -->
      <div class="flex flex-wrap items-center gap-2.5">
        <label for="an-scope" class="eyebrow">Team</label>
        <select id="an-scope" bind:value={scope} class="field-select w-auto min-w-56">
          <option value="all">All active teams ({activeProjects.length})</option>
          {#each activeProjects as p (p.id)}
            <option value={p.id}>{p.name}</option>
          {/each}
        </select>
      </div>

      <section aria-labelledby="risk-heading" class="flex flex-col gap-3">
        <div class="flex items-baseline justify-between gap-3">
          <h2 id="risk-heading" class="font-display text-lg text-foreground inline-flex items-center gap-2">
            <ShieldAlert class="w-4.5 h-4.5 text-accent" aria-hidden="true" />
            Team risk
          </h2>
          <p class="text-2xs text-muted-foreground hidden sm:block">
            0–100 from overdue work, attendance, idle members, reporting and schedule. 25+ medium, 50+ high.
          </p>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {#each risks as r (r.project.id)}
            <RiskCard project={r.project} risk={r.risk} />
          {/each}
        </div>
      </section>

      <div class="grid grid-cols-1 xl:grid-cols-5 gap-4 items-start">
        <Card
          class="xl:col-span-3"
          title="Burndown"
          description="Open tasks each day against a straight-line burn to the final milestone."
        >
          {#snippet actions()}<TrendingDown class="w-4 h-4 text-muted-foreground" aria-hidden="true" />{/snippet}
          {#if burn.length > 1}
            <BurndownChart points={burn} {today} />
          {:else}
            <EmptyState icon={TrendingDown} title="No tasks yet" description="The burndown starts with the first task." size="sm" />
          {/if}
        </Card>

        <Card class="xl:col-span-2" title="Task status by team" description="Where each team's tasks sit on the board.">
          {#snippet actions()}<LayoutList class="w-4 h-4 text-muted-foreground" aria-hidden="true" />{/snippet}
          <StackedBarChart rows={statusRows} series={statusSeries} caption="Tasks per board column for each team" />
        </Card>
      </div>

      <div class="grid grid-cols-1 xl:grid-cols-5 gap-4 items-start">
        <Card
          class="xl:col-span-2"
          title="Team activity"
          description="Tasks, comments, posts, uploads and reports over the last 12 weeks."
        >
          {#snippet actions()}<Activity class="w-4 h-4 text-muted-foreground" aria-hidden="true" />{/snippet}
          <ActivityHeatmap days={activity} {today} />
        </Card>

        <Card
          class="xl:col-span-3"
          title="Workload by member"
          description="Assigned tasks per student, by status. An empty row is someone with no work assigned."
        >
          {#snippet actions()}<Users class="w-4 h-4 text-muted-foreground" aria-hidden="true" />{/snippet}
          <StackedBarChart rows={workloadRows} series={statusSeries} caption="Assigned tasks per student by board column" />
        </Card>
      </div>

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
                Progress per student across active projects
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
                        <Avatar src={r.member.avatar} userId={r.member.userId} name={r.member.name} size="sm" />
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
                  <Avatar src={r.member.avatar} userId={r.member.userId} name={r.member.name} size="sm" />
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
    {/if}
  </div>
{/if}
