<script lang="ts">
  import type { Snippet } from 'svelte';
  
  let {
    children,
    variant = 'secondary',
    class: className = '',
    ...rest
  }: {
    children?: Snippet;
    variant?: 'primary' | 'secondary' | 'outline' | 'success' | 'warning' | 'danger' | 'info';
    class?: string;
    [key: string]: any;
  } = $props();

  const variantStyles = {
    primary: 'bg-accent/10 text-accent border border-accent/25',
    secondary: 'bg-secondary text-secondary-foreground border border-border',
    outline: 'bg-transparent text-foreground border border-border',
    success: 'bg-success/10 text-success border border-success/25',
    warning: 'bg-warning/10 text-warning border border-warning/25',
    danger: 'bg-destructive/10 text-destructive border border-destructive/25',
    info: 'bg-info/10 text-info border border-info/25'
  };
</script>

<span
  class="inline-flex items-center px-2 py-0.5 rounded-sm font-mono text-[10.5px] font-semibold select-none transition-colors {variantStyles[variant]} {className}"
  {...rest}
>
  {#if children}
    {@render children()}
  {/if}
</span>
