<script lang="ts">
  import type { ActivityDay } from '$lib/utils/analytics';
  import ChartTooltip from './ChartTooltip.svelte';

  /**
   * Contribution calendar: one column per week (Monday on top), one cell per
   * day, shaded on a single-hue sequential ramp of the accent. Days after
   * today are drawn as empty outlines.
   */
  let { days, today }: { days: ActivityDay[]; today: string } = $props();

  const CELL = 13;
  const GAP = 3;
  const LABEL_W = 28;
  const TOP = 16;

  const weeks = $derived(Array.from({ length: Math.ceil(days.length / 7) }, (_, w) => days.slice(w * 7, w * 7 + 7)));
  const max = $derived(Math.max(0, ...days.filter((d) => d.day <= today).map((d) => d.count)));
  const total = $derived(days.filter((d) => d.day <= today).reduce((s, d) => s + d.count, 0));
  const activeDays = $derived(days.filter((d) => d.day <= today && d.count > 0).length);
  const busiest = $derived(
    days.filter((d) => d.day <= today).reduce<ActivityDay | null>((b, d) => (!b || d.count > b.count ? d : b), null)
  );

  /** Five steps: none, then four quartiles of the busiest day. */
  function level(count: number): number {
    if (count === 0 || max === 0) return 0;
    return Math.min(4, Math.ceil((count / max) * 4));
  }
  const SHADES = [
    'var(--muted)',
    'color-mix(in oklab, var(--accent) 30%, var(--card))',
    'color-mix(in oklab, var(--accent) 55%, var(--card))',
    'color-mix(in oklab, var(--accent) 78%, var(--card))',
    'var(--accent)'
  ];

  const fmt = (day: string, opts: Intl.DateTimeFormatOptions) =>
    new Date(day + 'T00:00:00Z').toLocaleDateString([], { ...opts, timeZone: 'UTC' });

  const svgW = $derived(LABEL_W + weeks.length * (CELL + GAP));
  const svgH = TOP + 7 * (CELL + GAP);

  let width = $state(0);
  let hover = $state<{ d: ActivityDay; x: number; y: number } | null>(null);
</script>

<div class="flex flex-col gap-3">
  <div class="relative overflow-x-auto" bind:clientWidth={width}>
    <svg
      width={svgW}
      height={svgH}
      role="img"
      aria-label="{total} activities over {weeks.length} weeks, on {activeDays} active days{busiest && busiest.count
        ? `; busiest day ${fmt(busiest.day, { month: 'long', day: 'numeric' })} with ${busiest.count}`
        : ''}."
      class="block"
    >
      {#each weeks as week, w (week[0].day)}
        {#if w === 0 || fmt(week[0].day, { month: 'short' }) !== fmt(weeks[w - 1][0].day, { month: 'short' })}
          <text x={LABEL_W + w * (CELL + GAP)} y="10" class="fill-muted-foreground text-3xs">
            {fmt(week[0].day, { month: 'short' })}
          </text>
        {/if}
        {#each week as d, i (d.day)}
          {@const future = d.day > today}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <rect
            x={LABEL_W + w * (CELL + GAP)}
            y={TOP + i * (CELL + GAP)}
            width={CELL}
            height={CELL}
            rx="3"
            fill={future ? 'transparent' : SHADES[level(d.count)]}
            class={future ? 'stroke-border' : d.day === today ? 'stroke-foreground/50' : ''}
            stroke-width={future || d.day === today ? 1 : 0}
            onpointerenter={() =>
              !future && (hover = { d, x: LABEL_W + w * (CELL + GAP) + CELL / 2, y: TOP + i * (CELL + GAP) + CELL / 2 })}
            onpointerleave={() => (hover = null)}
          />
        {/each}
      {/each}
      {#each [['Mon', 0], ['Wed', 2], ['Fri', 4]] as [label, row] (label)}
        <text x="0" y={TOP + (row as number) * (CELL + GAP) + CELL - 3} class="fill-muted-foreground text-3xs">{label}</text>
      {/each}
    </svg>

    {#if hover}
      <ChartTooltip x={hover.x} y={hover.y} containerWidth={width}>
        <p class="text-sm font-bold text-foreground tabular">
          {hover.d.count} <span class="text-2xs font-normal text-muted-foreground">activit{hover.d.count === 1 ? 'y' : 'ies'}</span>
        </p>
        <p class="text-muted-foreground">{fmt(hover.d.day, { weekday: 'short', month: 'short', day: 'numeric' })}</p>
      </ChartTooltip>
    {/if}
  </div>

  <div class="flex flex-wrap items-center justify-between gap-2 text-2xs text-muted-foreground">
    <span>
      <span class="font-bold text-foreground tabular">{total}</span> activities ·
      <span class="font-bold text-foreground tabular">{activeDays}</span> active days
    </span>
    <span class="inline-flex items-center gap-1" aria-hidden="true">
      Less
      {#each SHADES as shade (shade)}
        <span class="w-2.5 h-2.5 rounded-[3px]" style="background: {shade}"></span>
      {/each}
      More
    </span>
  </div>
</div>
