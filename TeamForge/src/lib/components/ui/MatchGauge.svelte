<script lang="ts">
  import { onMount } from 'svelte';
  import Odometer from './Odometer.svelte';

  /**
   * A pressure-gauge dial for a 0–100 score: a 270° arc with tick marks that
   * sweeps up to the value on mount, the figure rolling up on an odometer in
   * the middle. The arc colour runs cool to hot with the score.
   */
  let { value, size = 76, label }: { value: number; size?: number; label: string } = $props();

  const R = 30;
  const C = 2 * Math.PI * R;
  const SWEEP = 0.75; // 270° of the circle
  let armed = $state(false);
  onMount(() => requestAnimationFrame(() => requestAnimationFrame(() => (armed = true))));

  const shown = $derived(armed ? Math.max(0, Math.min(100, value)) : 0);
  const color = $derived(value >= 75 ? 'var(--success)' : value >= 50 ? 'var(--ember)' : 'var(--muted-foreground)');
  const ticks = Array.from({ length: 11 }, (_, i) => i);
</script>

<div class="relative shrink-0" style="width: {size}px; height: {size}px" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} aria-label={label}>
  <svg viewBox="0 0 80 80" class="w-full h-full" aria-hidden="true">
    <!-- Rotated so the 270° opening sits at the bottom. -->
    <g transform="rotate(135 40 40)">
      <circle
        cx="40"
        cy="40"
        r={R}
        fill="none"
        stroke="var(--border)"
        stroke-width="5"
        stroke-linecap="round"
        stroke-dasharray="{C * SWEEP} {C}"
      />
      <circle
        class="gauge-arc"
        cx="40"
        cy="40"
        r={R}
        fill="none"
        stroke={color}
        stroke-width="5"
        stroke-linecap="round"
        stroke-dasharray="{C * SWEEP} {C}"
        stroke-dashoffset={C * SWEEP * (1 - shown / 100)}
        style="filter: drop-shadow(0 0 3px {color})"
      />
      {#each ticks as t (t)}
        {@const a = (t / 10) * 270 * (Math.PI / 180)}
        <line
          x1={40 + Math.cos(a) * 36.5}
          y1={40 + Math.sin(a) * 36.5}
          x2={40 + Math.cos(a) * (t % 5 === 0 ? 39.5 : 38.5)}
          y2={40 + Math.sin(a) * (t % 5 === 0 ? 39.5 : 38.5)}
          stroke="var(--muted-foreground)"
          stroke-opacity={t / 10 <= shown / 100 ? 0.9 : 0.3}
          stroke-width="1"
        />
      {/each}
    </g>
  </svg>
  <span class="absolute inset-0 flex flex-col items-center justify-center leading-none">
    <span class="font-display text-lg text-foreground"><Odometer value={Math.round(value)} /></span>
    <span class="font-mono text-[8px] tracking-[0.18em] text-muted-foreground mt-0.5" aria-hidden="true">MATCH</span>
  </span>
</div>
