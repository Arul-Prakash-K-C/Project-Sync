<script lang="ts">
  let {
    value,
    max = 100,
    label = '',
    /** Text shown on the right of the label row, e.g. "3 / 8". */
    valueLabel = '',
    tone = 'accent',
    size = 'md',
    class: className = ''
  }: {
    value: number;
    max?: number;
    label?: string;
    valueLabel?: string;
    tone?: 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
    size?: 'sm' | 'md';
    class?: string;
  } = $props();

  const pct = $derived(max > 0 ? Math.min(100, Math.max(0, Math.round((value / max) * 100))) : 0);

  const tones = {
    accent: 'bg-accent',
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-destructive',
    info: 'bg-info',
    neutral: 'bg-muted-foreground'
  };
</script>

<div class="flex flex-col gap-1.5 {className}">
  {#if label || valueLabel}
    <div class="flex justify-between items-baseline gap-3">
      {#if label}<span class="text-2xs font-semibold text-muted-foreground">{label}</span>{/if}
      {#if valueLabel}<span class="text-2xs font-bold text-foreground tabular">{valueLabel}</span>{/if}
    </div>
  {/if}

  <div
    role="progressbar"
    aria-valuenow={pct}
    aria-valuemin="0"
    aria-valuemax="100"
    aria-label={label || 'Progress'}
    class="w-full rounded-full bg-secondary overflow-hidden {size === 'sm' ? 'h-1.5' : 'h-2'}"
  >
    <div
      class="h-full rounded-full transition-[width] duration-500 ease-out {tones[tone]}"
      style="width: {pct}%"
    ></div>
  </div>
</div>
