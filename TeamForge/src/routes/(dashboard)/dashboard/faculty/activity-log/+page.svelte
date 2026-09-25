<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth.svelte';
  import { db, type AuditLogEntry } from '$lib/services/db';
  import { downloadCsv } from '$lib/utils/csv';
  import { History, FileDown } from 'lucide-svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import EmptyState from '$lib/components/ui/EmptyState.svelte';

  let entries = $state<AuditLogEntry[]>([]);
  let filterType = $state<'all' | AuditLogEntry['targetType']>('all');
  let loaded = $state(false);

  onMount(() => {
    if (auth.user) {
      entries = db.getAuditLog(auth.user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    loaded = true;
  });

  const filtered = $derived(filterType === 'all' ? entries : entries.filter((e) => e.targetType === filterType));

  const typeBadge: Record<AuditLogEntry['targetType'], 'primary' | 'success' | 'warning' | 'info' | 'secondary'> =
    {
      project: 'primary',
      milestone: 'warning',
      weekly_report: 'success',
      announcement: 'info',
      feedback: 'secondary',
      meeting: 'info'
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

<svelte:head>
  <title>Activity Log — TeamForge</title>
</svelte:head>

{#if auth.user}
  <div class="flex flex-col gap-6 max-w-6xl">
    <PageHeader
      title="Activity log"
      icon={History}
      description="A record of your supervisory actions — approvals, milestone changes, reviews, feedback and announcements."
    >
      {#snippet actions()}
        <label for="log-filter" class="sr-only">Filter by action type</label>
        <select id="log-filter" bind:value={filterType} class="field-select w-48">
          <option value="all">All actions</option>
          <option value="project">Project approvals</option>
          <option value="milestone">Milestones</option>
          <option value="weekly_report">Weekly reports</option>
          <option value="feedback">Feedback</option>
          <option value="meeting">Meetings</option>
          <option value="announcement">Announcements</option>
        </select>
        <Button variant="outline" onclick={exportLog} disabled={filtered.length === 0}>
          <FileDown class="w-4 h-4" />
          Export CSV
        </Button>
      {/snippet}
    </PageHeader>

    <Card flush>
      {#if !loaded}
        <div class="p-5 flex flex-col gap-3" aria-busy="true">
          {#each { length: 5 } as _, i (i)}
            <div class="skeleton h-9 w-full"></div>
          {/each}
        </div>
      {:else if filtered.length === 0}
        <div class="p-5">
          <EmptyState
            icon={History}
            title={entries.length === 0 ? 'No activity recorded yet' : 'Nothing of this type'}
            description={entries.length === 0
              ? 'Approvals, milestone edits, review decisions, feedback and announcements you make are logged here automatically.'
              : 'No entries match this filter. Switch back to "All actions" to see the full history.'}
          />
        </div>
      {:else}
        <div class="table-scroll hidden sm:block">
          <table class="data-table">
            <caption class="sr-only">Your supervisory actions, most recent first</caption>
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Action</th>
                <th scope="col">Type</th>
                <th scope="col">Target</th>
              </tr>
            </thead>
            <tbody>
              {#each filtered as e (e.id)}
                <tr>
                  <td class="text-xs text-muted-foreground whitespace-nowrap tabular">
                    <time datetime={e.createdAt}>{new Date(e.createdAt).toLocaleString()}</time>
                  </td>
                  <td class="font-semibold text-foreground">{e.action}</td>
                  <td>
                    <Badge variant={typeBadge[e.targetType]} size="sm" class="capitalize">
                      {e.targetType.replace('_', ' ')}
                    </Badge>
                  </td>
                  <td class="text-xs text-muted-foreground max-w-sm truncate">{e.targetLabel ?? '—'}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>

        <!-- Four columns of prose do not fit a phone; the same entries become a
             stacked feed where the action leads. -->
        <ul class="sm:hidden divide-y divide-border">
          {#each filtered as e (e.id)}
            <li class="p-4">
              <div class="flex items-start justify-between gap-3">
                <p class="text-sm font-semibold text-foreground">{e.action}</p>
                <Badge variant={typeBadge[e.targetType]} size="sm" class="capitalize shrink-0">
                  {e.targetType.replace('_', ' ')}
                </Badge>
              </div>
              {#if e.targetLabel}
                <p class="text-xs text-muted-foreground mt-1">{e.targetLabel}</p>
              {/if}
              <time class="block text-3xs text-muted-foreground mt-1.5 tabular" datetime={e.createdAt}>
                {new Date(e.createdAt).toLocaleString()}
              </time>
            </li>
          {/each}
        </ul>
      {/if}
    </Card>
  </div>
{/if}
