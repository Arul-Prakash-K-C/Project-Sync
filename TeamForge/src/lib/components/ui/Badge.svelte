<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    children,
    variant = 'secondary',
    size = 'md',
    /** Renders a small filled dot in the badge colour — useful for row status. */
    dot = false,
    class: className = '',
    ...rest
  }: {
    children?: Snippet;
    variant?: 'primary' | 'secondary' | 'outline' | 'success' | 'warning' | 'danger' | 'info';
    size?: 'sm' | 'md';
    dot?: boolean;
    class?: string;
    [key: string]: any;
  } = $props();

  const variantStyles = {
    primary: 'bg-accent/12 text-accent border-accent/30',
    secondary: 'bg-secondary text-secondary-foreground border-border',
    outline: 'bg-transparent text-muted-foreground border-border',
    success: 'bg-success/12 text-success border-success/30',
    warning: 'bg-warning/12 text-warning border-warning/30',
    danger: 'bg-destructive/12 text-destructive border-destructive/30',
    info: 'bg-info/12 text-info border-info/30'
  };

  const dotStyles = {
    primary: 'bg-accent',
    secondary: 'bg-muted-foreground',
    outline: 'bg-muted-foreground',
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-destructive',
    info: 'bg-info'
  };

  const sizeStyles = {
    sm: 'px-1.5 py-0.5 text-3xs gap-1',
    md: 'px-2 py-0.5 text-2xs gap-1.5'
  };
</script>

<span
  class="inline-flex items-center rounded-sm border font-semibold tracking-wide select-none align-middle
    {variantStyles[variant]} {sizeStyles[size]} {className}"
  {...rest}
>
  {#if dot}
    <span class="w-1.5 h-1.5 rounded-full shrink-0 {dotStyles[variant]}" aria-hidden="true"></span>
  {/if}
  {#if children}
    {@render children()}
  {/if}
</span>
