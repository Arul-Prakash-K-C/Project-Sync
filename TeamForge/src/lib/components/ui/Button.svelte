<script lang="ts">
  import type { Snippet } from 'svelte';
  
  let {
    type = 'button',
    variant = 'primary',
    size = 'md',
    disabled = false,
    onclick,
    children,
    class: className = '',
    ...rest
  }: {
    type?: 'button' | 'submit' | 'reset';
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg' | 'icon';
    disabled?: boolean;
    onclick?: (e: MouseEvent) => void;
    children?: Snippet;
    class?: string;
    [key: string]: any;
  } = $props();

  const variantStyles = {
    primary: 'bg-accent text-accent-foreground hover:bg-accent/90 shadow-md shadow-accent/25 border border-accent/20',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border',
    outline: 'bg-transparent text-foreground border border-border hover:border-accent/40 hover:bg-secondary/50',
    ghost: 'bg-transparent text-foreground hover:bg-secondary/50',
    danger: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-md shadow-destructive/20'
  };

  const sizeStyles = {
    sm: 'h-9 px-3 text-xs rounded-md gap-1.5',
    md: 'h-10 px-4 text-sm rounded-md gap-2',
    lg: 'h-11 px-5 text-base rounded-lg gap-2.5',
    icon: 'h-10 w-10 justify-center rounded-md'
  };
</script>

<button
  {type}
  {disabled}
  {onclick}
  class="inline-flex items-center justify-center font-semibold transition-all duration-150 active:scale-97 disabled:pointer-events-none disabled:opacity-50 cursor-pointer {variantStyles[variant]} {sizeStyles[size]} {className}"
  {...rest}
>
  {#if children}
    {@render children()}
  {/if}
</button>
