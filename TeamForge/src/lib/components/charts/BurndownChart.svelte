<script lang="ts">
  import type { BurndownPoint } from '$lib/utils/analytics';
  import ChartTooltip from './ChartTooltip.svelte';

  /**
   * Remaining open tasks per day against the ideal straight-line burn to the
   * final deadline. A crosshair snaps to the nearest day and reads out both
   * series; a marker shows today. Future days have no "remaining" value.
   */
  let { points, today }: { points: BurndownPoint[]; today: string } = $props();

  const HEIGHT = 220;
  const PAD = { top: 12, right: 16, bottom: 26, left: 32 };

  let width = $state(0);
  let hoverIndex = $state<number | null>(null);

  const plotW = $derived(Math.max(0, width - PAD.left - PAD.right));
  const plotH = HEIGHT - PAD.top - PAD.bottom;

  const t0 = $derived(points.length ? Date.parse(points[0].day) : 0);
  const t1 = $derived(points.length ? Date.parse(points[points.length - 1].day) : 1);
  const yMax = $derived(
    Math.max(1, ...points.map((p) => Math.max(p.ideal, p.remaining ?? 0)))
  );
  /** Clean integer ticks: 0, step, 2·step … covering yMax. */
  const yTicks = $derived.by(() => {
    const step = Math.max(1, Math.ceil(yMax / 4));
    const top = Math.ceil(yMax / step) * step;
    return Array.from({ length: top / step + 1 }, (_, i) => i * step);
  });
  const yTop = $derived(yTicks[yTicks.length - 1] || 1);

  const x = (day: string) => PAD.left + (t1 === t0 ? 0 : ((Date.parse(day) - t0) / (t1 - t0)) * plotW);
  const y = (v: number) => PAD.top + plotH - (v / yTop) * plotH;

  const idealPath = $derived(points.map((p, i) => `${i ? 'L' : 'M'}${x(p.day)},${y(p.ideal)}`).join(''));
  const actual = $derived(points.filter((p) => p.remaining !== null));
  const actualPath = $derived(actual.map((p, i) => `${i ? 'L' : 'M'}${x(p.day)},${y(p.remaining!)}`).join(''));
  const actualArea = $derived(
    actual.length > 1
      ? `${actualPath}L${x(actual[actual.length - 1].day)},${y(0)}L${x(actual[0].day)},${y(0)}Z`
      : ''
  );

  /** A handful of date labels along the x axis. */
  const xTicks = $derived.by(() => {
    if (points.length < 2) return points;
    const count = Math.max(2, Math.min(6, Math.floor(plotW / 90)));
    return Array.from({ length: count }, (_, i) => points[Math.round((i / (count - 1)) * (points.length - 1))]);
  });

  const fmt = (day: string) =>
    new Date(day + 'T00:00:00Z').toLocaleDateString([], { month: 'short', day: 'numeric', timeZone: 'UTC' });

  function onMove(e: PointerEvent) {
    const svg = e.currentTarget as SVGElement;
    const px = e.clientX - svg.getBoundingClientRect().left;
    let best = 0;
    points.forEach((p, i) => {
      if (Math.abs(x(p.day) - px) < Math.abs(x(points[best].day) - px)) best = i;
    });
    hoverIndex = best;
  }

  const hovered = $derived(hoverIndex !== null ? points[hoverIndex] : null);
  const todayPoint = $derived(points.find((p) => p.day === today));
  const latest = $derived(actual[actual.length - 1]);
</script>

<div class="flex flex-col gap-3">
  <ul class="flex flex-wrap gap-x-4 gap-y-1.5" aria-hidden="true">
    <li class="inline-flex items-center gap-1.5 text-2xs text-muted-foreground">
      <span class="w-3 h-0.5 rounded-full bg-accent"></span>Remaining tasks
    </li>
    <li class="inline-flex items-center gap-1.5 text-2xs text-muted-foreground">
      <span class="w-3 h-0.5 rounded-full bg-muted-foreground/60"></span>Ideal burn to final deadline
    </li>
  </ul>

  <div class="relative" bind:clientWidth={width}>
    {#if width > 0}
      <svg
        {width}
        height={HEIGHT}
        role="img"
        aria-label="Burndown: {latest ? `${latest.remaining} tasks open today` : 'no data'}, ideal line reaches zero on {fmt(points[points.length - 1].day)}."
        onpointermove={onMove}
        onpointerleave={() => (hoverIndex = null)}
        class="block touch-none"
      >
        {#each yTicks as t (t)}
          <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} class="stroke-border" stroke-width="1" />
          <text x={PAD.left - 8} y={y(t)} dy="0.32em" text-anchor="end" class="fill-muted-foreground text-3xs tabular">
            {t}
          </text>
        {/each}
        {#each xTicks as p (p.day)}
          <text x={x(p.day)} y={HEIGHT - 6} text-anchor="middle" class="fill-muted-foreground text-3xs">
            {fmt(p.day)}
          </text>
        {/each}

        {#if todayPoint}
          <line
            x1={x(today)}
            x2={x(today)}
            y1={PAD.top}
            y2={PAD.top + plotH}
            class="stroke-muted-foreground/40"
            stroke-width="1"
          />
          <text x={x(today) + 4} y={PAD.top + 8} class="fill-muted-foreground text-3xs font-semibold">Today</text>
        {/if}

        <path d={idealPath} fill="none" class="stroke-muted-foreground/60" stroke-width="2" stroke-linecap="round" />
        {#if actualArea}
          <path d={actualArea} class="fill-accent/10" />
        {/if}
        <path
          d={actualPath}
          fill="none"
          class="stroke-accent"
          stroke-width="2"
          stroke-linejoin="round"
          stroke-linecap="round"
        />
        {#if latest}
          <circle cx={x(latest.day)} cy={y(latest.remaining!)} r="4.5" class="fill-accent stroke-card" stroke-width="2" />
        {/if}

        {#if hovered}
          <line
            x1={x(hovered.day)}
            x2={x(hovered.day)}
            y1={PAD.top}
            y2={PAD.top + plotH}
            class="stroke-foreground/30"
            stroke-width="1"
          />
          {#if hovered.remaining !== null}
            <circle cx={x(hovered.day)} cy={y(hovered.remaining)} r="4" class="fill-accent stroke-card" stroke-width="2" />
          {/if}
          <circle cx={x(hovered.day)} cy={y(hovered.ideal)} r="3.5" class="fill-muted-foreground stroke-card" stroke-width="2" />
        {/if}
      </svg>

      {#if hovered}
        <ChartTooltip x={x(hovered.day)} y={PAD.top + plotH / 2} containerWidth={width}>
          <p class="font-semibold text-muted-foreground">{fmt(hovered.day)}</p>
          <p class="flex items-center justify-between gap-3 mt-1">
            <span class="flex items-center gap-1.5 text-muted-foreground">
              <span class="w-2.5 h-0.5 rounded-full bg-accent"></span>Remaining
            </span>
            <span class="text-xs font-bold text-foreground tabular">{hovered.remaining ?? '—'}</span>
          </p>
          <p class="flex items-center justify-between gap-3">
            <span class="flex items-center gap-1.5 text-muted-foreground">
              <span class="w-2.5 h-0.5 rounded-full bg-muted-foreground/60"></span>Ideal
            </span>
            <span class="text-xs font-bold text-foreground tabular">{hovered.ideal}</span>
          </p>
        </ChartTooltip>
      {/if}
    {/if}
  </div>
</div>
