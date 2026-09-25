<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth.svelte';
  import { db, type Project } from '$lib/services/db';
  import { toast } from '$lib/stores/toast.svelte';
  import { downloadCsv } from '$lib/utils/csv';
  import { downloadPdf } from '$lib/utils/pdf';
  import { BarChart3, CheckSquare, Award, FileText, FileDown, FileType } from 'lucide-svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import EmptyState from '$lib/components/ui/EmptyState.svelte';

  type Row = Record<string, string | number>;

  let projects = $state<Project[]>([]);
  let loaded = $state(false);
  /** `${key}:${format}` of the export currently rendering, for the button spinner. */
  let busy = $state('');

  onMount(() => {
    if (auth.user) {
      projects = db.getSupervisedProjects(auth.user!);
    }
    loaded = true;
  });

  const pct = (done: number, total: number) => (total ? Math.round((done / total) * 100) : 0);

  function buildTeamsProgress(): Row[] {
    const tasks = db.getTasks();
    const weeklyReports = db.getWeeklyReports();
    return projects.map((p) => {
      const projTasks = tasks.filter((t) => t.projectId === p.id);
      const done = p.milestones.filter((m) => m.completed).length;
      return {
        Project: p.name,
        Status: p.status,
        'Milestones Completed': done,
        'Milestones Total': p.milestones.length,
        'Milestone %': pct(done, p.milestones.length),
        'Tasks Completed': projTasks.filter((t) => t.column === 'completed').length,
        'Tasks Total': projTasks.length,
        'Weekly Reports Pending': weeklyReports.filter((r) => r.projectId === p.id && r.status === 'pending').length
      };
    });
  }

  function buildMilestones(): Row[] {
    const today = new Date().toISOString().slice(0, 10);
    return projects.flatMap((p) =>
      p.milestones.map((m) => ({
        Project: p.name,
        Milestone: m.title,
        Deadline: m.extendedDeadline ?? m.deadline,
        Status: m.completed ? 'Completed' : m.locked ? 'Locked' : (m.extendedDeadline ?? m.deadline) < today ? 'Overdue' : 'Pending',
        Extended: m.extendedDeadline ? 'Yes' : 'No'
      }))
    );
  }

  function buildStudentEvaluation(): Row[] {
    const tasks = db.getTasks();
    const weeklyReports = db.getWeeklyReports();
    const feedback = db.getFeedback();
    return projects.flatMap((p) => {
      const projFeedback = feedback.filter((f) => f.projectId === p.id).length;
      return p.members.map((member) => {
        const memberTasks = tasks.filter((t) => t.projectId === p.id && t.assignees.includes(member.userId));
        const memberReports = weeklyReports.filter((r) => r.projectId === p.id && r.submittedBy === member.userId);
        const att = db.getAttendanceSummary(p.id, member.userId);
        return {
          Student: member.name,
          Project: p.name,
          Role: member.role,
          'Tasks Assigned': memberTasks.length,
          'Tasks Completed': memberTasks.filter((t) => t.column === 'completed').length,
          'Reports Approved': memberReports.filter((r) => r.status === 'approved').length,
          'Reports Pending': memberReports.filter((r) => r.status === 'pending').length,
          Attendance: att.rate === null ? 'Not recorded' : `${att.rate}% (${att.recorded} mtg)`,
          'Feedback Entries': projFeedback
        };
      });
    });
  }

  function buildProjectStatus(): Row[] {
    return projects.map((p) => ({
      Project: p.name,
      Status: p.status,
      Department: p.department,
      Owner: p.ownerName,
      Members: p.members.length,
      'Pending Invites': p.pendingInvites.length,
      'Created At': p.createdAt.slice(0, 10)
    }));
  }

  /*
    Each card states how many rows the export will contain — downloading a file
    to find out whether it has anything in it is a wasted round trip, and an
    empty file reads as a broken button.
  */
  const milestoneCount = $derived(projects.reduce((n, p) => n + p.milestones.length, 0));
  const studentCount = $derived(projects.reduce((n, p) => n + p.members.length, 0));

  const reports = $derived([
    {
      key: 'teams-progress',
      title: 'Teams progress report',
      description: 'Milestone completion, task distribution and outstanding weekly reports for every supervised team.',
      icon: BarChart3,
      rows: projects.length,
      unit: 'team',
      build: buildTeamsProgress
    },
    {
      key: 'milestone-clearing',
      title: 'Milestone clearing report',
      description: 'Every milestone with its deadline and whether it is completed, locked, overdue or pending.',
      icon: CheckSquare,
      rows: milestoneCount,
      unit: 'milestone',
      build: buildMilestones
    },
    {
      key: 'student-evaluation',
      title: 'Student performance evaluation',
      description: 'Per-student task load, weekly report outcomes and meeting attendance, for grading.',
      icon: Award,
      rows: studentCount,
      unit: 'student',
      build: buildStudentEvaluation
    },
    {
      key: 'project-status',
      title: 'Project lifecycle status',
      description: 'Registry of every project with ownership, membership, invitations and creation date.',
      icon: FileText,
      rows: projects.length,
      unit: 'project',
      build: buildProjectStatus
    }
  ]);

  async function runExport(report: (typeof reports)[number], format: 'csv' | 'pdf') {
    const rows = report.build();
    if (rows.length === 0) {
      toast.warning('Nothing to export yet.');
      return;
    }
    const stamp = new Date().toISOString().slice(0, 10);
    busy = `${report.key}:${format}`;
    try {
      if (format === 'csv') {
        downloadCsv(`${report.key}-${stamp}.csv`, rows);
      } else {
        await downloadPdf({
          title: report.title.replace(/^./, (c) => c.toUpperCase()),
          subtitle: `${auth.user?.department ?? ''} · ${auth.user?.name ?? ''}`,
          filename: `${report.key}-${stamp}.pdf`,
          rows
        });
      }
      toast.success(`${report.title} exported as ${format.toUpperCase()}`);
    } catch (err) {
      console.error(err);
      toast.error(`Could not generate the ${format.toUpperCase()}`);
    } finally {
      busy = '';
    }
  }
</script>

<svelte:head>
  <title>Reports Hub — TeamForge</title>
</svelte:head>

{#if auth.user}
  <div class="flex flex-col gap-6 max-w-5xl">
    <PageHeader
      title="Reports hub"
      icon={FileText}
      description="Export evaluation and progress data for {auth.user.department} as CSV for spreadsheets or PDF for review boards."
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
                  class="w-10 h-10 rounded-md flex items-center justify-center shrink-0 bg-secondary text-muted-foreground"
                  aria-hidden="true"
                >
                  <r.icon class="w-5 h-5" />
                </span>
                <div class="min-w-0">
                  <h2 class="text-sm font-bold text-foreground">{r.title}</h2>
                  <p class="text-xs text-muted-foreground mt-1 leading-relaxed">{r.description}</p>
                </div>
              </div>

              <div class="mt-auto pt-5 flex items-center justify-between gap-3 flex-wrap">
                <p class="text-2xs text-muted-foreground tabular">
                  {#if r.rows === 0}
                    <span class="text-warning font-semibold">No rows yet</span>
                  {:else}
                    <span class="font-bold text-foreground">{r.rows}</span>
                    {r.unit}{r.rows === 1 ? '' : 's'}
                  {/if}
                </p>
                <div class="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onclick={() => runExport(r, 'csv')}
                    disabled={r.rows === 0}
                    loading={busy === `${r.key}:csv`}
                  >
                    <FileDown class="w-3.5 h-3.5" />
                    CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onclick={() => runExport(r, 'pdf')}
                    disabled={r.rows === 0}
                    loading={busy === `${r.key}:pdf`}
                  >
                    <FileType class="w-3.5 h-3.5" />
                    PDF
                  </Button>
                </div>
              </div>
            </Card>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
{/if}
