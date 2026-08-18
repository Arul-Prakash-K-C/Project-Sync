<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth.svelte';
  import { db, type Project } from '$lib/services/db';
  import { toast } from '$lib/stores/toast.svelte';
  import { downloadCsv } from '$lib/utils/csv';
  import { BarChart3, CheckSquare, Award, FileText, FileDown } from 'lucide-svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import EmptyState from '$lib/components/ui/EmptyState.svelte';

  let projects = $state<Project[]>([]);
  let loaded = $state(false);

  onMount(() => {
    if (auth.user) {
      projects = db.getProjects().filter((p) => p.department === auth.user!.department);
    }
    loaded = true;
  });

  function exportTeamsProgress() {
    const tasks = db.getTasks();
    const weeklyReports = db.getWeeklyReports();
    const rows = projects.map((p) => {
      const projTasks = tasks.filter((t) => t.projectId === p.id);
      const projReports = weeklyReports.filter((r) => r.projectId === p.id);
      return {
        Project: p.name,
        Status: p.status,
        'Milestones Completed': p.milestones.filter((m) => m.completed).length,
        'Milestones Total': p.milestones.length,
        'Milestone %': p.milestones.length
          ? Math.round((p.milestones.filter((m) => m.completed).length / p.milestones.length) * 100)
          : 0,
        'Tasks Completed': projTasks.filter((t) => t.column === 'completed').length,
        'Tasks Total': projTasks.length,
        'Weekly Reports Pending': projReports.filter((r) => r.status === 'pending').length
      };
    });
    if (rows.length === 0) {
      toast.warning('No supervised teams to report on yet.');
      return;
    }
    downloadCsv(`teams-progress-report-${new Date().toISOString().slice(0, 10)}.csv`, rows);
    toast.success('Teams Progress Report exported');
  }

  function exportMilestones() {
    const today = new Date().toISOString().slice(0, 10);
    const rows = projects.flatMap((p) =>
      p.milestones.map((m) => ({
        Project: p.name,
        Milestone: m.title,
        Deadline: m.deadline,
        Status: m.completed ? 'Completed' : m.locked ? 'Locked' : m.deadline < today ? 'Overdue' : 'Pending',
        Extended: m.extendedDeadline ? 'Yes' : 'No'
      }))
    );
    if (rows.length === 0) {
      toast.warning('No milestones found across supervised teams.');
      return;
    }
    downloadCsv(`milestone-clearing-report-${new Date().toISOString().slice(0, 10)}.csv`, rows);
    toast.success('Milestone Clearing Report exported');
  }

  function exportStudentEvaluation() {
    const tasks = db.getTasks();
    const weeklyReports = db.getWeeklyReports();
    const feedback = db.getFeedback();
    const rows = projects.flatMap((p) => {
      const projFeedback = feedback.filter((f) => f.projectId === p.id).length;
      return p.members.map((member) => {
        const memberTasks = tasks.filter((t) => t.projectId === p.id && t.assignees.includes(member.userId));
        const memberReports = weeklyReports.filter(
          (r) => r.projectId === p.id && r.submittedBy === member.userId
        );
        return {
          Student: member.name,
          Project: p.name,
          Role: member.role,
          'Tasks Assigned': memberTasks.length,
          'Tasks Completed': memberTasks.filter((t) => t.column === 'completed').length,
          'Weekly Reports Approved': memberReports.filter((r) => r.status === 'approved').length,
          'Weekly Reports Pending': memberReports.filter((r) => r.status === 'pending').length,
          'Project Feedback Entries': projFeedback
        };
      });
    });
    if (rows.length === 0) {
      toast.warning('No students found across supervised teams.');
      return;
    }
    downloadCsv(`student-evaluation-report-${new Date().toISOString().slice(0, 10)}.csv`, rows);
    toast.success('Student Performance Evaluation exported');
  }

  function exportProjectStatus() {
    const rows = projects.map((p) => ({
      Project: p.name,
      Status: p.status,
      Department: p.department,
      Owner: p.ownerName,
      Members: p.members.length,
      'Pending Invites': p.pendingInvites.length,
      'Created At': p.createdAt.slice(0, 10)
    }));
    if (rows.length === 0) {
      toast.warning('No projects found in your department yet.');
      return;
    }
    downloadCsv(`project-status-report-${new Date().toISOString().slice(0, 10)}.csv`, rows);
    toast.success('Project Lifecycle Status Report exported');
  }

  /*
    Each card states how many rows the export will actually contain. Downloading
    a CSV to find out whether it has anything in it is a wasted round trip —
    and an empty file reads as a broken button.
  */
  const milestoneCount = $derived(projects.reduce((n, p) => n + p.milestones.length, 0));
  const studentCount = $derived(projects.reduce((n, p) => n + p.members.length, 0));

  const reports = $derived([
    {
      key: 'progress',
      title: 'Teams progress report',
      description:
        'Milestone completion, task distribution and outstanding weekly reports for every supervised team.',
      icon: BarChart3,
      tone: 'bg-accent/12 text-accent',
      rows: projects.length,
      unit: 'team',
      run: exportTeamsProgress
    },
    {
      key: 'milestones',
      title: 'Milestone clearing report',
      description: 'Every milestone with its deadline and whether it is completed, locked, overdue or pending.',
      icon: CheckSquare,
      tone: 'bg-success/12 text-success',
      rows: milestoneCount,
      unit: 'milestone',
      run: exportMilestones
    },
    {
      key: 'evaluation',
      title: 'Student performance evaluation',
      description: 'Per-student task load, completion counts and weekly report outcomes for grading.',
      icon: Award,
      tone: 'bg-warning/12 text-warning',
      rows: studentCount,
      unit: 'student',
      run: exportStudentEvaluation
    },
    {
      key: 'status',
      title: 'Project lifecycle status',
      description: 'Registry of every project with ownership, membership, invitations and creation date.',
      icon: FileText,
      tone: 'bg-info/12 text-info',
      rows: projects.length,
      unit: 'project',
      run: exportProjectStatus
    }
  ]);
</script>

<svelte:head>
  <title>Reports Hub — TeamForge</title>
</svelte:head>

{#if auth.user}
  <div class="flex flex-col gap-6 max-w-5xl">
    <PageHeader
      title="Reports hub"
      icon={FileText}
      description="Export evaluation and progress data for {auth.user.department} as CSV, ready for administrative and academic review."
    />

    {#if loaded && projects.length === 0}
      <EmptyState
        icon={FileText}
        title="Nothing to report on yet"
        description="Reports are generated from the projects in your department. Approve a proposal and the exports will fill in."
      >
        {#snippet action()}
          <a href="/dashboard/faculty/approvals">
            <Button variant="outline" size="sm">Go to approvals</Button>
          </a>
        {/snippet}
      </EmptyState>
    {:else}
      <ul class="grid grid-cols-1 md:grid-cols-2 gap-4">
        {#each reports as r (r.key)}
          <li>
            <Card class="h-full flex flex-col">
              <div class="flex gap-3.5">
                <span
                  class="w-10 h-10 rounded-md flex items-center justify-center shrink-0 {r.tone}"
                  aria-hidden="true"
                >
                  <r.icon class="w-5 h-5" />
                </span>
                <div class="min-w-0">
                  <h2 class="text-sm font-bold text-foreground">{r.title}</h2>
                  <p class="text-xs text-muted-foreground mt-1 leading-relaxed">{r.description}</p>
                </div>
              </div>

              <div class="mt-auto pt-4 flex items-center justify-between gap-3">
                <p class="text-2xs text-muted-foreground tabular">
                  {#if r.rows === 0}
                    <span class="text-warning font-semibold">No rows yet</span>
                  {:else}
                    <span class="font-bold text-foreground">{r.rows}</span>
                    {r.unit}{r.rows === 1 ? '' : 's'}
                  {/if}
                </p>
                <Button variant="outline" size="sm" onclick={r.run} disabled={r.rows === 0}>
                  <FileDown class="w-3.5 h-3.5" />
                  Export CSV
                </Button>
              </div>
            </Card>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
{/if}
