<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    type = 'button',
    variant = 'primary',
    size = 'md',
    disabled = false,
    loading = false,
    onclick,
    children,
    class: className = '',
    ...rest
  }: {
    type?: 'button' | 'submit' | 'reset';
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
    size?: 'sm' | 'md' | 'lg' | 'icon';
    disabled?: boolean;
    /** Shows a spinner and blocks interaction without collapsing the layout. */
    loading?: boolean;
    onclick?: (e: MouseEvent) => void;
    children?: Snippet;
    class?: string;
    [key: string]: any;
  } = $props();

  const variantStyles = {
    primary: 'bg-accent text-accent-foreground hover:bg-accent/90 active:bg-accent/95 border border-transparent shadow-e1',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/70 border border-border',
    outline: 'bg-card text-foreground border border-border hover:border-accent/45 hover:bg-secondary/60',
    ghost: 'bg-transparent text-muted-foreground border border-transparent hover:bg-secondary hover:text-foreground',
    danger: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 border border-transparent shadow-e1',
    success: 'bg-success text-success-foreground hover:bg-success/90 border border-transparent shadow-e1'
  };

  const sizeStyles = {
    sm: 'h-9 px-3 text-xs rounded-md gap-1.5',
    md: 'h-10 px-4 text-sm rounded-md gap-2',
    lg: 'h-11 px-5 text-sm rounded-md gap-2',
    icon: 'h-10 w-10 justify-center rounded-md'
  };

  const isDisabled = $derived(disabled || loading);
</script>

<button
  {type}
  disabled={isDisabled}
  aria-busy={loading || undefined}
  {onclick}
  class="relative inline-flex items-center justify-center whitespace-nowrap font-semibold
    transition-[background-color,border-color,color,transform] duration-150
    active:translate-y-px disabled:pointer-events-none disabled:opacity-50 cursor-pointer
    {variantStyles[variant]} {sizeStyles[size]} {className}"
  {...rest}
>
  {#if loading}
    <span
      class="absolute inset-0 flex items-center justify-center"
      aria-hidden="true"
    >
      <span class="w-4 h-4 rounded-full border-2 border-current border-r-transparent animate-spin"></span>
    </span>
  {/if}
  <span class="inline-flex items-center justify-center gap-[inherit] {loading ? 'invisible' : ''}">
    {#if children}
      {@render children()}
    {/if}
  </span>
</button>
