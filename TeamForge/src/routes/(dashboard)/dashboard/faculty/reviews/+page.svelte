<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth.svelte';
  import { db, type Project, type WeeklyReport } from '$lib/services/db';
  import { toast } from '$lib/stores/toast.svelte';
  import { Clock } from 'lucide-svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';

  let projects = $state<Project[]>([]);
  let weeklyReports = $state<WeeklyReport[]>([]);
  let reviewingReport = $state<WeeklyReport | null>(null);
  let reviewFeedbackText = $state('');

  onMount(() => {
    loadData();
  });

  function loadData() {
    if (auth.user) {
      projects = db.getProjects().filter(p => p.department === auth.user!.department);
      weeklyReports = db.getWeeklyReports();
    }
  }

  function reviewReportAction(report: WeeklyReport, status: 'approved' | 'revision_requested') {
    try {
      db.updateWeeklyReportStatus(report.id, status, reviewFeedbackText);
      
      const p = projects.find(proj => proj.id === report.projectId);
      if (p) {
        db.saveNotifications([
          {
            id: `notif_${Date.now()}`,
            userId: report.submittedBy,
            title: status === 'approved' ? 'Weekly Report Approved' : 'Changes Requested on Weekly Report',
            description: `Weekly Report for Week {report.weekNumber} has been updated to "${status}" by supervisor. Feedback: "${reviewFeedbackText}"`,
            type: 'project',
            read: false,
            createdAt: new Date().toISOString(),
            actionUrl: `/dashboard/student/project/${p.id}`
          }
        ]);
      }
      
      toast.success(`Weekly Report marked as ${status}`);
      reviewingReport = null;
      reviewFeedbackText = '';
      loadData();
    } catch (err) {
      toast.error('Failed to submit weekly review');
    }
  }
</script>

{#if auth.user}
  <div class="flex flex-col gap-8 text-left">
    <div class="flex flex-col border-b border-border/40 pb-4">
      <h2 class="text-3xl font-extrabold tracking-tight text-foreground">Weekly Progress Reviews</h2>
      <p class="text-sm text-muted-foreground mt-1">Review weekly reports submitted by student teams and provide guidance feedback.</p>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
      <!-- List reports -->
      <Card class="lg:col-span-2 flex flex-col gap-4">
        <div class="border-b border-border/40 pb-2 mb-2">
          <h3 class="text-lg font-bold text-foreground">Submitted Weekly Reports</h3>
        </div>
        
        <div class="flex flex-col gap-4">
          {#each weeklyReports as rep}
            {@const proj = projects.find(p => p.id === rep.projectId)}
            {#if proj}
              <div 
                onclick={() => reviewingReport = rep}
                onkeydown={(e) => e.key === 'Enter' && (reviewingReport = rep)}
                role="button"
                tabindex="0"
                class="p-4 border rounded-2xl hover:border-primary/20 bg-card cursor-pointer transition-all flex justify-between items-center"
              >
                <div class="flex flex-col min-w-0">
                  <span class="text-sm font-extrabold text-foreground truncate">Week {rep.weekNumber} Report - {proj.name}</span>
                  <span class="text-3xs text-muted-foreground mt-1">Submitted by {rep.submittedByName} on {new Date(rep.submittedAt).toLocaleDateString()}</span>
                </div>
                <Badge variant={rep.status === 'approved' ? 'success' : rep.status === 'pending' ? 'warning' : 'danger'}>
                  {rep.status}
                </Badge>
              </div>
            {/if}
          {:else}
            <div class="py-12 text-center text-xs text-muted-foreground italic border border-dashed rounded-2xl">
              No weekly progress reports submitted yet.
            </div>
          {/each}
        </div>
      </Card>

      <!-- Review details & feedback panel -->
      <Card>
        {#if reviewingReport}
          {@const reviewingProj = projects.find(p => p.id === reviewingReport.projectId)}
          <div class="flex flex-col gap-4">
            <div class="flex justify-between items-start border-b border-border/40 pb-2">
              <div class="flex flex-col min-w-0">
                <span class="font-extrabold text-sm text-foreground truncate">Reviewing Week {reviewingReport.weekNumber} Report</span>
                <span class="text-3xs text-muted-foreground mt-0.5">{reviewingProj?.name}</span>
              </div>
              <button onclick={() => reviewingReport = null} class="text-xs text-muted-foreground hover:text-foreground cursor-pointer">Close</button>
            </div>

            <div class="flex flex-col gap-3 text-xs">
              <div class="p-3 bg-muted/10 border rounded-xl">
                <span class="font-bold text-foreground/80 block mb-0.5">Key Achievements:</span>
                <p class="text-muted-foreground whitespace-pre-wrap leading-relaxed">{reviewingReport.achievements}</p>
              </div>
              <div class="p-3 bg-muted/10 border rounded-xl">
                <span class="font-bold text-foreground/80 block mb-0.5">Planned Work:</span>
                <p class="text-muted-foreground whitespace-pre-wrap leading-relaxed">{reviewingReport.plannedTasks}</p>
              </div>
              <div class="p-3 bg-muted/10 border rounded-xl">
                <span class="font-bold text-foreground/80 block mb-0.5">Blockers:</span>
                <p class="text-muted-foreground whitespace-pre-wrap leading-relaxed">{reviewingReport.blockers || 'None'}</p>
              </div>
            </div>

            <div class="flex flex-col gap-2 mt-2 border-t border-border/40 pt-4">
              <label for="rev-fb" class="text-xs font-bold text-foreground">Supervisor Evaluation & Feedback</label>
              <textarea 
                id="rev-fb"
                placeholder="Provide guidance, note modifications, or approve weekly report details..." 
                bind:value={reviewFeedbackText}
                rows="3"
                class="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none resize-none"
              ></textarea>
              
              <div class="flex gap-2 justify-end mt-1">
                <Button variant="danger" size="sm" onclick={() => reviewReportAction(reviewingReport!, 'revision_requested')}>
                  Request Changes
                </Button>
                <Button variant="primary" size="sm" onclick={() => reviewReportAction(reviewingReport!, 'approved')}>
                  Approve Report
                </Button>
              </div>
            </div>
          </div>
        {:else}
          <div class="h-44 flex flex-col items-center justify-center text-center text-xs text-muted-foreground/60 italic">
            Select a weekly report on the left to read details and submit evaluation.
          </div>
        {/if}
      </Card>
    </div>
  </div>
{/if}
