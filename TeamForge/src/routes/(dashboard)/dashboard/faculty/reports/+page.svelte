<script lang="ts">
  import { auth } from '$lib/stores/auth.svelte';
  import { toast } from '$lib/stores/toast.svelte';
  import { 
    BarChart3, 
    CheckSquare, 
    Award, 
    FileText, 
    FileDown 
  } from 'lucide-svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Card from '$lib/components/ui/Card.svelte';

  function simulateExport(reportName: string) {
    toast.success(`Exporting ${reportName} as PDF (Simulated download)...`);
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
          <Button variant="outline" size="sm" onclick={() => simulateExport('Teams Progress Report')}>
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
          <Button variant="outline" size="sm" onclick={() => simulateExport('Milestone Clearing Report')}>
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
            <p class="text-xs text-muted-foreground mt-1 leading-relaxed">Performance analytics for grading students based on task share, weekly review feedback, and meeting attendance.</p>
          </div>
        </div>
        <div class="flex justify-end mt-4">
          <Button variant="outline" size="sm" onclick={() => simulateExport('Student Performance Evaluation')}>
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
            <p class="text-xs text-muted-foreground mt-1 leading-relaxed">General project workspace registry showing timelines, supervisor remarks, and final qualification states.</p>
          </div>
        </div>
        <div class="flex justify-end mt-4">
          <Button variant="outline" size="sm" onclick={() => simulateExport('Project Lifecycle Status Report')}>
            <FileDown class="w-4 h-4" />
            Export Status CSV
          </Button>
        </div>
      </Card>

    </div>
  </div>
{/if}
