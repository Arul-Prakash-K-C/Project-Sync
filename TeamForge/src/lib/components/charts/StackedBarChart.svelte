<script lang="ts" module>
  export interface Series {
    key: string;
    label: string;
    /** Any CSS colour, usually a theme token such as `var(--info)`. */
    color: string;
  }
  export interface Row {
    id: string;
    label: string;
    sublabel?: string;
    values: Record<string, number>;
  }
</script>

<script lang="ts">
  import ChartTooltip from './ChartTooltip.svelte';

  /**
   * Horizontal stacked bars, one row per entity. Rows share one scale so bar
   * lengths compare across rows; the total sits at the bar's end. Each
   * segment is its own hover target, and a visually hidden table carries
   * every value for screen readers.
   */
  let {
    rows,
    series,
    caption,
    unit = 'tasks'
  }: { rows: Row[]; series: Series[]; caption: string; unit?: string } = $props();

  const totals = $derived(rows.map((r) => series.reduce((s, x) => s + (r.values[x.key] ?? 0), 0)));
  const max = $derived(Math.max(1, ...totals));

  let width = $state(0);
  let hover = $state<{ row: Row; series: Series; x: number; y: number } | null>(null);
  let box = $state<HTMLDivElement | null>(null);

  function show(e: PointerEvent | FocusEvent, row: Row, s: Series) {
    if (!box) return;
    const target = e.currentTarget as HTMLElement;
    const r = target.getBoundingClientRect();
    const b = box.getBoundingClientRect();
    const x = 'clientX' in e ? e.clientX - b.left : r.left + r.width / 2 - b.left;
    hover = { row, series: s, x, y: r.top + r.height / 2 - b.top };
  }
</script>

<div class="flex flex-col gap-4">
  <!-- Legend: always present for two or more series. -->
  <ul class="flex flex-wrap gap-x-4 gap-y-1.5" aria-hidden="true">
    {#each series as s (s.key)}
      <li class="inline-flex items-center gap-1.5 text-2xs text-muted-foreground">
        <span class="w-2.5 h-2.5 rounded-[3px]" style="background: {s.color}"></span>
        {s.label}
      </li>
    {/each}
  </ul>

  <div class="relative flex flex-col gap-3" bind:this={box} bind:clientWidth={width}>
    {#each rows as row, i (row.id)}
      <div class="grid grid-cols-[minmax(0,9rem)_1fr] sm:grid-cols-[minmax(0,12rem)_1fr] items-center gap-3">
        <div class="min-w-0 leading-tight">
          <p class="text-xs font-semibold text-foreground truncate" title={row.label}>{row.label}</p>
          {#if row.sublabel}
            <p class="text-3xs text-muted-foreground truncate">{row.sublabel}</p>
          {/if}
        </div>
        <div class="flex items-center gap-2 min-w-0" aria-hidden="true">
          <div class="flex h-5 gap-0.5 min-w-0" style="width: {(totals[i] / max) * 88}%">
            {#each series.filter((s) => (row.values[s.key] ?? 0) > 0) as s, si (s.key)}
              {@const isLast = si === series.filter((x) => (row.values[x.key] ?? 0) > 0).length - 1}
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div
                class="h-full transition-opacity {hover && (hover.row.id !== row.id || hover.series.key !== s.key)
                  ? 'opacity-55'
                  : ''} {isLast ? 'rounded-r-[4px]' : ''}"
                style="flex: {row.values[s.key]} 1 0; background: {s.color}; min-width: 3px"
                onpointermove={(e) => show(e, row, s)}
                onpointerleave={() => (hover = null)}
              ></div>
            {/each}
          </div>
          <span class="text-2xs font-bold text-foreground tabular shrink-0">{totals[i]}</span>
        </div>
      </div>
    {/each}

    {#if hover}
      <ChartTooltip x={hover.x} y={hover.y} containerWidth={width}>
        <p class="text-sm font-bold text-foreground tabular">
          {hover.row.values[hover.series.key]}
          <span class="text-2xs font-normal text-muted-foreground">{unit}</span>
        </p>
        <p class="flex items-center gap-1.5 text-muted-foreground mt-0.5">
          <span class="w-2.5 h-0.5 rounded-full" style="background: {hover.series.color}"></span>
          {hover.series.label} · {hover.row.label}
        </p>
      </ChartTooltip>
    {/if}
  </div>

  <table class="sr-only">
    <caption>{caption}</caption>
    <thead>
      <tr>
        <th scope="col">Name</th>
        {#each series as s (s.key)}<th scope="col">{s.label}</th>{/each}
        <th scope="col">Total</th>
      </tr>
    </thead>
    <tbody>
      {#each rows as row, i (row.id)}
        <tr>
          <th scope="row">{row.label}</th>
          {#each series as s (s.key)}<td>{row.values[s.key] ?? 0}</td>{/each}
          <td>{totals[i]}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>
