<script lang="ts">
  import type { Snippet } from 'svelte';

  /**
   * Floating readout for a chart. Positioned in the chart's own coordinate
   * box (the parent must be `relative`); it flips to the left of the pointer
   * near the right edge so it never runs off the card.
   */
  let {
    x,
    y,
    containerWidth,
    children
  }: { x: number; y: number; containerWidth: number; children: Snippet } = $props();

  const flip = $derived(x > containerWidth - 200);
</script>

<div
  class="absolute z-10 pointer-events-none min-w-36 max-w-60 px-3 py-2 rounded-md border border-border bg-popover
    text-popover-foreground shadow-e3 text-2xs"
  style="left: {x}px; top: {y}px; transform: translate({flip ? 'calc(-100% - 12px)' : '12px'}, -50%);"
  role="presentation"
>
  {@render children()}
</div>
