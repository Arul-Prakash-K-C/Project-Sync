<script lang="ts">
  import type { Snippet } from 'svelte';

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

  const tones = {
    neutral: 'bg-secondary text-foreground',
    accent: 'bg-accent/12 text-accent',
    success: 'bg-success/12 text-success',
    warning: 'bg-warning/12 text-warning',
    danger: 'bg-destructive/12 text-destructive',
    info: 'bg-info/12 text-info'
  };
</script>

<!--
  The figure leads, the label sits above it small and quiet, and the icon is a
  scanning aid rather than the focal point — so a row of these reads as numbers
  first, chrome second.
-->
<svelte:element
  this={href ? 'a' : 'div'}
  href={href || undefined}
  class="rounded-lg border border-border bg-card p-4 flex items-start gap-3.5 shadow-e1
    {href ? 'transition-[box-shadow,border-color] hover:shadow-e2 hover:border-accent/30' : ''}
    {className}"
>
  {#if Icon}
    <div class="w-9 h-9 rounded-md flex items-center justify-center shrink-0 {tones[tone]}" aria-hidden="true">
      <Icon class="w-4.5 h-4.5" />
    </div>
  {/if}

  <div class="min-w-0 flex-1">
    <p class="eyebrow">{label}</p>
    <p class="font-display text-2xl text-foreground mt-1 tabular leading-none">{value}</p>
    {#if hint}
      <p class="text-2xs text-muted-foreground mt-1.5">{hint}</p>
    {/if}
    {#if children}
      <div class="mt-2">{@render children()}</div>
    {/if}
  </div>
</svelte:element>
