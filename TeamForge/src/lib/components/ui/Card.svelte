<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    children,
    title = '',
    /** Optional short line under the title. */
    description = '',
    /** Controls rendered on the right of the card header. */
    actions,
    class: className = '',
    bodyClass = '',
    hoverable = false,
    /** Drops the default padding so tables and lists can run edge to edge. */
    flush = false,
    ...rest
  }: {
    children?: Snippet;
    title?: string;
    description?: string;
    actions?: Snippet;
    class?: string;
    bodyClass?: string;
    hoverable?: boolean;
    flush?: boolean;
    [key: string]: any;
  } = $props();

  const hasHeader = $derived(Boolean(title) || Boolean(actions));
</script>

<div
  class="rounded-lg border border-border bg-card text-card-foreground shadow-e1
    {flush ? 'overflow-hidden' : 'p-5'}
    {hoverable ? 'transition-[box-shadow,border-color,transform] duration-300 hover:shadow-e2 hover:border-accent/30 hover:-translate-y-0.5' : ''}
    {className}"
  {...rest}
>
  {#if hasHeader}
    <div
      class="flex items-start justify-between gap-4 border-b border-border pb-3 mb-4
        {flush ? 'px-5 pt-5' : ''}"
    >
      <div class="min-w-0">
        {#if title}
          <h3 class="text-sm font-bold text-foreground">{title}</h3>
        {/if}
        {#if description}
          <p class="text-2xs text-muted-foreground mt-1">{description}</p>
        {/if}
      </div>
      {#if actions}
        <div class="flex items-center gap-2 shrink-0">
          {@render actions()}
        </div>
      {/if}
    </div>
  {/if}

  <!-- Without a header the children are rendered directly, so a caller can make
       the card itself the flex/grid container via `class`. -->
  {#if bodyClass}
    <div class={bodyClass}>
      {#if children}{@render children()}{/if}
    </div>
  {:else if children}
    {@render children()}
  {/if}
</div>
