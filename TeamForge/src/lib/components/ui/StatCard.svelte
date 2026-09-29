<script lang="ts">
  import type { Snippet } from 'svelte';
  import Odometer from './Odometer.svelte';

  /** Any lucide-svelte icon. See PageHeader for why this isn't `Component`. */
  type IconComponent = any;

  let {
    label,
    value,
    icon,
    tone = 'neutral',
    /** Short line under the figure explaining what it counts. */
    hint = '',
    href = '',
    children,
    class: className = ''
  }: {
    label: string;
    value: string | number;
    icon?: IconComponent;
    tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';
    hint?: string;
    href?: string;
    children?: Snippet;
    class?: string;
  } = $props();

  const Icon = $derived(icon);

  const toneVar = {
    neutral: 'var(--muted-foreground)',
    accent: 'var(--accent)',
    success: 'var(--success)',
    warning: 'var(--warning)',
    danger: 'var(--destructive)',
    info: 'var(--info)'
  };
</script>

<!--
  An ingot: the figure rolls in on an odometer, the tone sits in a hot corner
  and a ghosted icon, and a band of light passes across on hover. The label
  stays small above the number so a row of these reads as figures first.
-->
<svelte:element
  this={href ? 'a' : 'div'}
  href={href || undefined}
  class="forge-card ingot quench p-4 flex items-start gap-3 {className}"
  style="--tone: {toneVar[tone]}; --heat-color: {toneVar[tone]}"
  data-lift={href ? '' : undefined}
>
  <!-- Decoration is clipped by its own layer so the drafting marks outside the edge stay visible. -->
  <span class="ingot-clip" aria-hidden="true">
    <span class="ingot-corner"></span>
    <span class="ingot-sheen"></span>
    {#if Icon}<span class="ingot-ghost"><Icon class="w-full h-full" strokeWidth={1.25} /></span>{/if}
  </span>
  {#if Icon}
    <div class="w-5 h-5 mt-0.5 flex items-center justify-center shrink-0" style="color: var(--tone)" aria-hidden="true">
      <Icon class="w-4.5 h-4.5" />
    </div>
  {/if}

  <div class="min-w-0 flex-1 relative">
    <p class="eyebrow">{label}</p>
    <p class="font-display text-2xl text-foreground mt-1 leading-none"><Odometer {value} /></p>
    {#if hint}
      <p class="text-2xs text-muted-foreground mt-1.5">{hint}</p>
    {/if}
    {#if children}
      <div class="mt-2">{@render children()}</div>
    {/if}
  </div>
</svelte:element>
