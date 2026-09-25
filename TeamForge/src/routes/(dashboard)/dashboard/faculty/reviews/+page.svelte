<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth.svelte';
  import { newId } from '$lib/utils/id';
  import { db, type Project, type WeeklyReport } from '$lib/services/db';
  import { toast } from '$lib/stores/toast.svelte';
  import { Clock, ClipboardList, Check, RotateCcw } from 'lucide-svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import Tabs from '$lib/components/ui/Tabs.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import EmptyState from '$lib/components/ui/EmptyState.svelte';

  let projects = $state<Project[]>([]);
  let weeklyReports = $state<WeeklyReport[]>([]);
  let reviewingReport = $state<WeeklyReport | null>(null);
  let reviewFeedbackText = $state('');
  /** Pending work is the default view — an inbox opens on what is unread. */
  let filter = $state<'pending' | 'all'>('pending');

  onMount(() => {
    loadData();
  });

  function loadData() {
    if (auth.user) {
      projects = db.getProjects().filter((p) => p.department === auth.user!.department);
      weeklyReports = db.getWeeklyReports().filter((rep) => projects.some((p) => p.id === rep.projectId));
    }
  }

  const pendingCount = $derived(weeklyReports.filter((r) => r.status === 'pending').length);
  const visibleReports = $derived(
    filter === 'pending' ? weeklyReports.filter((r) => r.status === 'pending') : weeklyReports
  );

  const statusTone = { approved: 'success', pending: 'warning', revision_requested: 'danger' } as const;
  const statusLabel = {
    approved: 'Approved',
    pending: 'Pending',
    revision_requested: 'Revision requested'
  } as const;

  function reviewReportAction(report: WeeklyReport, status: 'approved' | 'revision_requested') {
    try {
      db.updateWeeklyReportStatus(report.id, status, reviewFeedbackText);

      const p = projects.find((proj) => proj.id === report.projectId);

      db.logAudit(
        auth.user!.id,
        auth.user!.name,
        status === 'approved' ? 'Approved weekly report' : 'Requested revision on weekly report',
        'weekly_report',
        report.id,
        `Week ${report.weekNumber}${p ? ` — ${p.name}` : ''}`
      );

      if (p) {
        db.saveNotifications([
          {
            id: newId('notif'),
            userId: report.submittedBy,
            title: status === 'approved' ? 'Weekly Report Approved' : 'Changes Requested on Weekly Report',
            // The week number was interpolated with single braces, so students
            // were notified about "Week {report.weekNumber}" verbatim.
            description: `Weekly Report for Week ${report.weekNumber} has been updated to "${status}" by supervisor. Feedback: "${reviewFeedbackText}"`,
            type: 'project',
            read: false,
            createdAt: new Date().toISOString(),
            actionUrl: `/dashboard/student/project/${p.id}`
          }
        ]);
      }

      toast.success(`Weekly Report marked as ${status.replace('_', ' ')}`);
      reviewingReport = null;
      reviewFeedbackText = '';
      loadData();
    } catch (err) {
      toast.error('Failed to submit weekly review');
    }
  }
</script>

<svelte:head>
  <title>Weekly Reviews — TeamForge</title>
</svelte:head>

{#if auth.user}
  <div class="flex flex-col gap-6 max-w-7xl">
    <PageHeader
      title="Weekly reviews"
      icon={Clock}
      description="Reports submitted by teams in {auth.user.department}. Approve them or send them back with guidance."
    />

    <div class="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">
      <div class="lg:col-span-3 flex flex-col gap-3">
        <Tabs
          label="Report filter"
          items={[
            { value: 'pending', label: 'Needs review', badge: pendingCount },
            { value: 'all', label: 'All reports', badge: weeklyReports.length }
          ]}
          bind:active={filter}
        />

        <ul class="flex flex-col gap-2">
          {#each visibleReports as rep (rep.id)}
            {@const proj = projects.find((p) => p.id === rep.projectId)}
            {#if proj}
              {@const isOpen = reviewingReport?.id === rep.id}
              <li>
                <button
                  onclick={() => {
                    reviewingReport = rep;
                    reviewFeedbackText = rep.feedback ?? '';
                  }}
                  aria-current={isOpen ? 'true' : undefined}
                  class="w-full text-left p-4 border rounded-md transition-colors cursor-pointer
                    {isOpen ? 'border-accent bg-accent/8' : 'border-border bg-card hover:bg-muted/30'}"
                >
                  <span class="flex justify-between items-start gap-3">
                    <span class="min-w-0">
                      <span class="block text-sm font-bold text-foreground truncate">
                        Week {rep.weekNumber} — {proj.name}
                      </span>
                      <span class="block text-2xs text-muted-foreground mt-1">
                        {rep.submittedByName} ·
                        <span class="tabular">{new Date(rep.submittedAt).toLocaleDateString()}</span>
                      </span>
                    </span>
                    <Badge variant={statusTone[rep.status]} dot size="sm" class="shrink-0">
                      {statusLabel[rep.status]}
                    </Badge>
                  </span>
                </button>
              </li>
            {/if}
          {:else}
            <li>
              <!-- "All caught up" and "nothing has arrived" are different
                   situations and must not share a message. -->
              <EmptyState
                icon={ClipboardList}
                title={weeklyReports.length === 0
                  ? 'No reports yet'
                  : filter === 'pending'
                    ? 'Nothing to review'
                    : 'No reports match'}
                description={weeklyReports.length === 0
                  ? 'Weekly reports from your teams appear here as students submit them.'
                  : 'Every submitted report has been actioned. Switch to "All reports" to revisit past weeks.'}
              />
            </li>
          {/each}
        </ul>
      </div>

      <div class="lg:col-span-2 lg:sticky lg:top-22">
        <Card>
          {#if reviewingReport}
            {@const reviewingProj = projects.find((p) => p.id === reviewingReport!.projectId)}
            <div class="flex flex-col gap-4">
              <header class="flex justify-between items-start gap-3 border-b border-border pb-3">
                <div class="min-w-0">
                  <h2 class="text-sm font-bold text-foreground">
                    Week {reviewingReport.weekNumber} report
                  </h2>
                  <p class="text-2xs text-muted-foreground mt-0.5 truncate">{reviewingProj?.name}</p>
                </div>
                <button
                  onclick={() => (reviewingReport = null)}
                  class="text-2xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer rounded-sm shrink-0"
                >
                  Close
                </button>
              </header>

              <dl class="flex flex-col gap-2.5">
                <div class="p-3 bg-muted/30 border border-border rounded-md">
                  <dt class="eyebrow">Achievements</dt>
                  <dd class="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed mt-1.5">
                    {reviewingReport.achievements}
                  </dd>
                </div>
                <div class="p-3 bg-muted/30 border border-border rounded-md">
                  <dt class="eyebrow">Planned work</dt>
                  <dd class="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed mt-1.5">
                    {reviewingReport.plannedTasks}
                  </dd>
                </div>
                <div class="p-3 bg-muted/30 border border-border rounded-md">
                  <dt class="eyebrow">Blockers</dt>
                  <dd class="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed mt-1.5">
                    {reviewingReport.blockers || 'None'}
                  </dd>
                </div>
              </dl>

              <div class="field border-t border-border pt-4">
                <label for="rev-fb" class="field-label">Supervisor feedback</label>
                <textarea
                  id="rev-fb"
                  placeholder="Provide guidance, or note what has to change before this week can be approved…"
                  bind:value={reviewFeedbackText}
                  rows="4"
                  aria-describedby="rev-fb-hint"
                  class="field-textarea"
                ></textarea>
                <p id="rev-fb-hint" class="field-hint">
                  Sent to the student who submitted the report, and shown on the project workspace.
                </p>
              </div>

              <div class="flex flex-wrap gap-2 justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onclick={() => reviewReportAction(reviewingReport!, 'revision_requested')}
                >
                  <RotateCcw class="w-3.5 h-3.5" />
                  Request changes
                </Button>
                <Button
                  variant="success"
                  size="sm"
                  onclick={() => reviewReportAction(reviewingReport!, 'approved')}
                >
                  <Check class="w-3.5 h-3.5" />
                  Approve
                </Button>
              </div>
            </div>
          {:else}
            <EmptyState
              icon={ClipboardList}
              title="No report open"
              description="Choose a report on the left to read what the team submitted and record your evaluation."
              size="sm"
            />
          {/if}
        </Card>
      </div>
    </div>
  </div>
{/if}
