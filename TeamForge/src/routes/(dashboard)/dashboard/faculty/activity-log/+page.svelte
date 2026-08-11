<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth.svelte';
  import { db, type AuditLogEntry } from '$lib/services/db';
  import { downloadCsv } from '$lib/utils/csv';
  import { History, FileDown } from 'lucide-svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';

  let entries = $state<AuditLogEntry[]>([]);
  let filterType = $state<'all' | AuditLogEntry['targetType']>('all');

  onMount(() => {
    if (auth.user) {
      entries = db.getAuditLog(auth.user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
  });

  const filtered = $derived(filterType === 'all' ? entries : entries.filter((e) => e.targetType === filterType));

  const typeBadge: Record<AuditLogEntry['targetType'], 'primary' | 'success' | 'warning' | 'info' | 'secondary'> = {
    project: 'primary',
    milestone: 'warning',
    weekly_report: 'success',
    announcement: 'info',
    feedback: 'secondary'
  };

  function exportLog() {
    if (filtered.length === 0) return;
    downloadCsv(
      `activity-log-${new Date().toISOString().slice(0, 10)}.csv`,
      filtered.map((e) => ({
        Timestamp: e.createdAt,
        Action: e.action,
        Type: e.targetType,
        Target: e.targetLabel ?? ''
      }))
    );
  }
</script>

{#if auth.user}
  <div class="flex flex-col gap-8 text-left">
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-4">
      <div>
        <h2 class="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
          <History class="w-7 h-7 text-primary" />
          Activity Log
        </h2>
        <p class="text-sm text-muted-foreground mt-1">A record of your supervisory actions — approvals, milestone changes, reviews, feedback, and announcements.</p>
      </div>
      <div class="flex items-center gap-2">
        <select
          bind:value={filterType}
          class="px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none cursor-pointer"
        >
          <option value="all">All Actions</option>
          <option value="project">Project Approvals</option>
          <option value="milestone">Milestones</option>
          <option value="weekly_report">Weekly Reports</option>
          <option value="feedback">Feedback</option>
          <option value="announcement">Announcements</option>
        </select>
        <Button variant="outline" size="sm" onclick={exportLog} disabled={filtered.length === 0}>
          <FileDown class="w-4 h-4" />
          Export CSV
        </Button>
      </div>
    </div>

    <Card class="p-0 overflow-hidden border border-border">
      {#if filtered.length === 0}
        <div class="py-16 flex flex-col items-center justify-center text-center">
          <History class="w-12 h-12 text-muted-foreground/30 mb-3" />
          <p class="text-sm font-bold text-muted-foreground">No activity recorded yet</p>
          <p class="text-xs text-muted-foreground/60 max-w-xs mt-1">Actions you take across approvals, milestones, reviews, feedback, and announcements will show up here.</p>
        </div>
      {:else}
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="border-b border-border bg-muted/30 text-3xs font-black uppercase tracking-wider text-muted-foreground">
                <th class="p-4">When</th>
                <th class="p-4">Action</th>
                <th class="p-4">Type</th>
                <th class="p-4">Target</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border text-xs">
              {#each filtered as e}
                <tr class="hover:bg-muted/10 transition-colors">
                  <td class="p-4 text-muted-foreground whitespace-nowrap">{new Date(e.createdAt).toLocaleString()}</td>
                  <td class="p-4 font-bold text-foreground">{e.action}</td>
                  <td class="p-4">
                    <Badge variant={typeBadge[e.targetType]} class="capitalize">{e.targetType.replace('_', ' ')}</Badge>
                  </td>
                  <td class="p-4 text-muted-foreground truncate max-w-sm">{e.targetLabel ?? '—'}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </Card>
  </div>
{/if}
