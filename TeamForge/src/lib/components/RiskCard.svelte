<script lang="ts">
  import type { Project } from '$lib/services/db';
  import type { TeamRisk } from '$lib/utils/risk';
  import RiskBadge from './RiskBadge.svelte';

  /** One team's risk score with the factors behind it, largest first. */
  let { project, risk }: { project: Project; risk: TeamRisk } = $props();

  let expanded = $state(false);
  const visible = $derived(expanded ? risk.factors : risk.factors.filter((f) => f.points > 0).slice(0, 3));
  const meterTone = { low: 'bg-success', medium: 'bg-warning', high: 'bg-destructive' } as const;
  const heatColor = { low: 'var(--success)', medium: 'var(--warning)', high: 'var(--destructive)' } as const;
</script>

<!-- The plate's heat takes the risk colour; a high-risk team slowly breathes heat to draw the eye. -->
<article
  class="forge-card quench p-4 flex flex-col gap-3 {risk.level === 'high' ? 'ember-breathe' : ''}"
  data-variant={risk.level === 'low' ? undefined : 'ember'}
  style="--heat-color: {heatColor[risk.level]}"
>
  <header class="flex items-start justify-between gap-3">
    <div class="min-w-0">
      <h3 class="text-sm font-bold text-foreground truncate">{project.name}</h3>
      <p class="text-2xs text-muted-foreground mt-0.5">
        Lead {project.ownerName} · {project.members.length} member{project.members.length === 1 ? '' : 's'}
      </p>
    </div>
    <RiskBadge {risk} showScore={false} />
  </header>

  <div class="flex items-end gap-3">
    <p class="font-display text-3xl leading-none text-foreground">
      {risk.score}<span class="text-sm text-muted-foreground font-sans">/100</span>
    </p>
    <!-- Meter: the fill carries severity, the track is the same hue lightened. -->
    <div
      class="flex-1 h-1.5 rounded-full mb-1.5 overflow-hidden {risk.level === 'high'
        ? 'bg-destructive/15'
        : risk.level === 'medium'
          ? 'bg-warning/15'
          : 'bg-success/15'}"
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={risk.score}
      aria-label="Risk score for {project.name}"
    >
      <div class="h-full rounded-full {meterTone[risk.level]}" style="width: {Math.max(2, risk.score)}%"></div>
    </div>
  </div>

  {#if visible.length === 0}
    <p class="text-2xs text-muted-foreground">No risk signals. Milestones, tasks, attendance and reporting all look healthy.</p>
  {:else}
    <ul class="flex flex-col gap-2">
      {#each visible as f (f.key)}
        <li class="flex flex-col gap-0.5">
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-semibold text-foreground">{f.label}</span>
            <span class="text-2xs font-bold tabular {f.points > 0 ? 'text-foreground' : 'text-muted-foreground'}">
              +{f.points}<span class="font-normal text-muted-foreground">/{f.max}</span>
            </span>
          </div>
          <p class="text-2xs text-muted-foreground leading-snug">{f.detail}</p>
        </li>
      {/each}
    </ul>
  {/if}

  <button
    type="button"
    onclick={() => (expanded = !expanded)}
    aria-expanded={expanded}
    class="self-start text-2xs font-bold text-accent hover:underline cursor-pointer rounded-sm"
  >
    {expanded ? 'Show top factors' : 'Show all six factors'}
  </button>
</article>
