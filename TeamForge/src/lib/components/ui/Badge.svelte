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
    primary: 'bg-primary/10 text-primary border border-primary/20',
    secondary: 'bg-secondary text-secondary-foreground border border-border',
    outline: 'bg-transparent text-foreground border border-border',
    success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
    danger: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20',
    info: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20'
  };
</script>

<span
  class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold select-none transition-colors {variantStyles[variant]} {className}"
  {...rest}
>
  {#if children}
    {@render children()}
  {/if}
</span>
