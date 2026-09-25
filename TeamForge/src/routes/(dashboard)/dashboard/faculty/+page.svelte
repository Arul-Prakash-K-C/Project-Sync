<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth.svelte';
  import { db, type Project, type WeeklyReport } from '$lib/services/db';
  import { BookOpen, Clock, AlertTriangle, Users, ArrowRight, Inbox } from 'lucide-svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import StatCard from '$lib/components/ui/StatCard.svelte';
  import EmptyState from '$lib/components/ui/EmptyState.svelte';
  import ProgressBar from '$lib/components/ui/ProgressBar.svelte';

  let projects = $state<Project[]>([]);
  let weeklyReports = $state<WeeklyReport[]>([]);
  let loaded = $state(false);

  onMount(() => {
    loadData();
    loaded = true;
  });

  function loadData() {
    if (auth.user) {
      projects = db.getSupervisedProjects(auth.user!);
      weeklyReports = db.getWeeklyReports();
    }
  }

  const today = new Date().toISOString().split('T')[0];

  let pendingProjects = $derived(projects.filter((p) => p.status === 'pending'));
  let departmentReports = $derived(
    weeklyReports.filter((rep) => projects.some((p) => p.id === rep.projectId))
  );
  let pendingReports = $derived(departmentReports.filter((r) => r.status === 'pending'));
  let activeProjects = $derived(projects.filter((p) => p.status === 'active'));
  let totalStudents = $derived(activeProjects.reduce((sum, p) => sum + p.members.length, 0));
  let overdueMilestones = $derived(
    activeProjects.reduce((count, p) => {
      const overdue = p.milestones.filter((m) => !m.completed && m.deadline < today);
      return count + overdue.length;
    }, 0)
  );

  /** Teams with something wrong are listed first — a supervision dashboard is a
      queue of exceptions, not an alphabetical roster. */
  const rankedProjects = $derived(
    [...activeProjects].sort((a, b) => overdueCount(b) - overdueCount(a) || calculateProgress(a) - calculateProgress(b))
  );

  function overdueCount(p: Project): number {
    return p.milestones.filter((m) => !m.completed && m.deadline < today).length;
  }

  function calculateProgress(p: Project): number {
    if (p.milestones.length === 0) return 0;
    const completed = p.milestones.filter((m) => m.completed).length;
    return Math.round((completed / p.milestones.length) * 100);
  }

  const reportTone = { approved: 'success', pending: 'warning', revision_requested: 'danger' } as const;
</script>

<svelte:head>
  <title>Faculty Dashboard — TeamForge</title>
</svelte:head>

{#if auth.user}
  <div class="flex flex-col gap-7 max-w-7xl">
    <PageHeader
      title="Faculty overview"
      description="Supervision summary for {auth.user.department} — what needs your decision, and how the teams under you are tracking."
    />

    <!-- What needs a decision, ahead of what merely exists. -->
    {#if pendingProjects.length > 0 || pendingReports.length > 0}
      <section
        aria-label="Awaiting your review"
        class="rounded-lg border border-accent/30 bg-accent/6 p-4 flex flex-col sm:flex-row sm:items-center gap-3"
      >
        <p class="text-sm text-foreground flex-1">
          <span class="font-bold">Awaiting your review:</span>
          {#if pendingProjects.length > 0}
            {pendingProjects.length} project proposal{pendingProjects.length === 1 ? '' : 's'}
          {/if}
          {#if pendingProjects.length > 0 && pendingReports.length > 0}·{/if}
          {#if pendingReports.length > 0}
            {pendingReports.length} weekly report{pendingReports.length === 1 ? '' : 's'}
          {/if}
        </p>
        <div class="flex flex-wrap gap-2 shrink-0">
          {#if pendingProjects.length > 0}
            <a href="/dashboard/faculty/approvals">
              <Button variant="primary" size="sm">
                Review proposals
                <ArrowRight class="w-3.5 h-3.5" />
              </Button>
            </a>
          {/if}
          {#if pendingReports.length > 0}
            <a href="/dashboard/faculty/reviews">
              <Button variant="outline" size="sm">
                Review reports
                <ArrowRight class="w-3.5 h-3.5" />
              </Button>
            </a>
          {/if}
        </div>
      </section>
    {/if}

    <section aria-label="Summary" class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <StatCard
        label="Active projects"
        value={activeProjects.length}
        icon={BookOpen}
        tone="accent"
        hint="Approved and in progress"
      />
      <StatCard
        label="Pending approvals"
        value={pendingProjects.length}
        icon={Clock}
        tone="warning"
        hint="Proposals waiting on you"
      />
      <StatCard
        label="Overdue milestones"
        value={overdueMilestones}
        icon={AlertTriangle}
        tone={overdueMilestones > 0 ? 'danger' : 'success'}
        hint={overdueMilestones > 0 ? 'Past deadline, not completed' : 'Every team is on schedule'}
      />
      <StatCard
        label="Students supervised"
        value={totalStudents}
        icon={Users}
        tone="info"
        hint="Across active teams"
      />
    </section>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
      <div class="lg:col-span-2">
        <Card title="Team progress" description="Teams needing attention are listed first.">
          {#if !loaded}
            <div class="flex flex-col gap-4" aria-busy="true">
              {#each { length: 3 } as _, i (i)}
                <div class="flex flex-col gap-2">
                  <div class="skeleton h-4 w-1/3"></div>
                  <div class="skeleton h-2 w-full"></div>
                </div>
              {/each}
            </div>
          {:else}
            <ul class="flex flex-col gap-3">
              {#each rankedProjects as p (p.id)}
                {@const overdue = overdueCount(p)}
                {@const progress = calculateProgress(p)}
                <li class="p-3.5 border border-border rounded-md hover:bg-muted/30 transition-colors">
                  <div class="flex justify-between items-start gap-3">
                    <div class="min-w-0">
                      <h3 class="text-sm font-bold text-foreground truncate">{p.name}</h3>
                      <p class="text-2xs text-muted-foreground mt-0.5">
                        Lead {p.ownerName} · {p.members.length} member{p.members.length === 1 ? '' : 's'}
                      </p>
                    </div>
                    {#if overdue > 0}
                      <Badge variant="danger" dot size="sm" class="shrink-0">
                        {overdue} overdue
                      </Badge>
                    {:else}
                      <Badge variant="success" dot size="sm" class="shrink-0">On track</Badge>
                    {/if}
                  </div>

                  <ProgressBar
                    class="mt-3"
                    value={progress}
                    label="Milestones completed"
                    valueLabel="{progress}%"
                    tone={overdue > 0 ? 'warning' : progress === 100 ? 'success' : 'accent'}
                    size="sm"
                  />
                </li>
              {:else}
                <li>
                  <EmptyState
                    icon={BookOpen}
                    title="No active projects"
                    description="Nothing is under supervision in {auth.user.department} yet. Approved proposals appear here."
                    size="sm"
                  />
                </li>
              {/each}
            </ul>
          {/if}
        </Card>
      </div>

      <Card title="Recent submissions" bodyClass="flex flex-col gap-2.5 max-h-[26rem] overflow-y-auto">
        {#each departmentReports.slice().reverse() as rep (rep.id)}
          {@const proj = projects.find((pr) => pr.id === rep.projectId)}
          <article class="p-3 border border-border rounded-md">
            <div class="flex justify-between items-start gap-2">
              <h3 class="text-xs font-bold text-foreground">Week {rep.weekNumber} report</h3>
              <Badge variant={reportTone[rep.status]} size="sm" class="shrink-0 capitalize">
                {rep.status.replace('_', ' ')}
              </Badge>
            </div>
            <p class="text-2xs text-muted-foreground truncate mt-1">{proj?.name}</p>
            <p class="text-2xs text-muted-foreground">by {rep.submittedByName}</p>
          </article>
        {:else}
          <EmptyState
            icon={Inbox}
            title="No submissions yet"
            description="Weekly reports from your teams land here as they arrive."
            size="sm"
          />
        {/each}
      </Card>
    </div>
  </div>
{/if}
