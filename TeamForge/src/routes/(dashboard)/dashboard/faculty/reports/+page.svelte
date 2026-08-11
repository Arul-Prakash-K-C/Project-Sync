<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth.svelte';
  import { db, type Project } from '$lib/services/db';
  import { toast } from '$lib/stores/toast.svelte';
  import { downloadCsv } from '$lib/utils/csv';
  import {
    BarChart3,
    CheckSquare,
    Award,
    FileText,
    FileDown
  } from 'lucide-svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Card from '$lib/components/ui/Card.svelte';

  let projects = $state<Project[]>([]);

  onMount(() => {
    if (auth.user) {
      projects = db.getProjects().filter((p) => p.department === auth.user!.department);
    }
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
        const memberReports = weeklyReports.filter((r) => r.projectId === p.id && r.submittedBy === member.userId);
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
</script>

{#if auth.user}
  <div class="flex flex-col gap-8 text-left font-sans">
    <div class="flex flex-col border-b border-border/40 pb-4">
      <h2 class="text-3xl font-extrabold tracking-tight text-foreground">Reports Hub</h2>
      <p class="text-sm text-muted-foreground mt-1">Generate, visualize, and export evaluation progress reports for administrative and academic reviews.</p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">

      <!-- Progress Report Card -->
      <Card class="flex flex-col justify-between h-48">
        <div class="flex gap-4">
          <div class="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <BarChart3 class="w-6 h-6" />
          </div>
          <div class="flex flex-col min-w-0">
            <h4 class="font-extrabold text-foreground text-sm">Teams Progress Report</h4>
            <p class="text-xs text-muted-foreground mt-1 leading-relaxed">Aggregated progress status showing milestones completed, task distributions, and submission health.</p>
          </div>
        </div>
        <div class="flex justify-end mt-4">
          <Button variant="outline" size="sm" onclick={exportTeamsProgress}>
            <FileDown class="w-4 h-4" />
            Export Progress CSV
          </Button>
        </div>
      </Card>

      <!-- Milestone Report Card -->
      <Card class="flex flex-col justify-between h-48">
        <div class="flex gap-4">
          <div class="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0">
            <CheckSquare class="w-6 h-6" />
          </div>
          <div class="flex flex-col min-w-0">
            <h4 class="font-extrabold text-foreground text-sm">Milestone Clearing Report</h4>
            <p class="text-xs text-muted-foreground mt-1 leading-relaxed">List of all active, completed, locked, and overdue milestones across all supervised projects.</p>
          </div>
        </div>
        <div class="flex justify-end mt-4">
          <Button variant="outline" size="sm" onclick={exportMilestones}>
            <FileDown class="w-4 h-4" />
            Export Milestone CSV
          </Button>
        </div>
      </Card>

      <!-- Student Evaluation Report Card -->
      <Card class="flex flex-col justify-between h-48">
        <div class="flex gap-4">
          <div class="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0">
            <Award class="w-6 h-6" />
          </div>
          <div class="flex flex-col min-w-0">
            <h4 class="font-extrabold text-foreground text-sm">Student Performance Evaluation</h4>
            <p class="text-xs text-muted-foreground mt-1 leading-relaxed">Performance analytics for grading students based on task share and weekly review feedback.</p>
          </div>
        </div>
        <div class="flex justify-end mt-4">
          <Button variant="outline" size="sm" onclick={exportStudentEvaluation}>
            <FileDown class="w-4 h-4" />
            Export Evaluation CSV
          </Button>
        </div>
      </Card>

      <!-- Project Status Card -->
      <Card class="flex flex-col justify-between h-48">
        <div class="flex gap-4">
          <div class="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500 shrink-0">
            <FileText class="w-6 h-6" />
          </div>
          <div class="flex flex-col min-w-0">
            <h4 class="font-extrabold text-foreground text-sm">Project Lifecycle Status Report</h4>
            <p class="text-xs text-muted-foreground mt-1 leading-relaxed">General project workspace registry showing timelines, ownership, and current qualification states.</p>
          </div>
        </div>
        <div class="flex justify-end mt-4">
          <Button variant="outline" size="sm" onclick={exportProjectStatus}>
            <FileDown class="w-4 h-4" />
            Export Status CSV
          </Button>
        </div>
      </Card>

    </div>
  </div>
{/if}
