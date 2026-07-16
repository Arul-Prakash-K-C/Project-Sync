<script lang="ts">
  import type { Snippet } from 'svelte';
  
  let {
    children,
    class: className = '',
    hoverable = false,
    glass = false,
    gradientBorder = false,
    ...rest
  }: {
    children?: Snippet;
    class?: string;
    hoverable?: boolean;
    glass?: boolean;
    gradientBorder?: boolean;
    [key: string]: any;
  } = $props();
</script>

{#if gradientBorder}
  <div class="gradient-shell w-full {hoverable ? 'hover:scale-[1.01] transition-transform duration-300' : ''}">
    <div class="gradient-shell-inner text-foreground w-full {className}" {...rest}>
      {#if children}
        {@render children()}
      {/if}
    </div>
  </div>
{:else}
  <div
    class="rounded-2xl border p-6 transition-all duration-300 shadow-elevated
      {glass ? 'glass-card' : 'bg-card text-card-foreground border-border'}
      {hoverable ? 'hover:shadow-lg hover:border-primary/35 hover:-translate-y-0.5' : ''}
      {className}"
    {...rest}
  >
    {#if children}
      {@render children()}
    {/if}
  </div>
{/if}
