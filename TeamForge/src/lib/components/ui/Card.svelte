<script lang="ts">
  import type { Snippet } from 'svelte';

  /**
   * A forged plate (see src/routes/forge.css): it quenches in on mount, an
   * ember arc runs its edge and drafting marks open at the corners on hover.
   */
  let {
    children,
    title = '',
    /** Optional short line under the title. */
    description = '',
    /** Controls rendered on the right of the card header. */
    actions,
    class: className = '',
    bodyClass = '',
    /** Rises and casts a warm shadow on hover: for cards that are links or pickable. */
    hoverable = false,
    /** Drops the default padding so tables and lists can run edge to edge. */
    flush = false,
    /** `plate` (default), `blueprint` (dashed drafting grid) or `ember` (warm, for emphasis). */
    variant = 'plate',
    /** Play the quench entrance. Turn off for cards that re-render often. */
    enter = true,
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
    variant?: 'plate' | 'blueprint' | 'ember';
    enter?: boolean;
    [key: string]: any;
  } = $props();

  const hasHeader = $derived(Boolean(title) || Boolean(actions));
</script>

{#snippet content()}
  {#if hasHeader}
    <div class="flex items-start justify-between gap-4 pb-3 {flush ? 'px-5 pt-5' : ''}">
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
    <div class="forge-rule mb-4" aria-hidden="true"></div>
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
{/snippet}

<div
  class="forge-card text-card-foreground {enter ? 'quench' : ''} {flush ? '' : 'p-5'} {className}"
  data-variant={variant === 'plate' ? undefined : variant}
  data-lift={hoverable || undefined}
  {...rest}
>
  {#if flush}
    <!-- Flush content is clipped to the plate's corners by an inner layer, so
         the drafting marks outside the edge stay visible. -->
    <div class="rounded-[inherit] overflow-hidden">
      {@render content()}
    </div>
  {:else}
    {@render content()}
  {/if}
</div>
