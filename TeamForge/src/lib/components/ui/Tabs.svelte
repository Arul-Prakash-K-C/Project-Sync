<script lang="ts">
  let {
    items = [],
    active = $bindable(''),
    class: className = '',
    variant = 'pills',
    /** Accessible name for the tab strip, read before the tab list. */
    label = 'Sections'
  }: {
    items: { value: string; label: string; badge?: string | number }[];
    active: string;
    class?: string;
    variant?: 'pills' | 'underline';
    label?: string;
  } = $props();

  let listEl = $state<HTMLDivElement | null>(null);

  function select(value: string) {
    active = value;
  }

  function selectByOffset(offset: number) {
    const idx = items.findIndex((i) => i.value === active);
    const next = items[(idx + offset + items.length) % items.length];
    if (!next) return;
    active = next.value;
    // Roving tabindex: move real focus with the selection so the arrow keys
    // keep working and the newly active tab scrolls into view.
    requestAnimationFrame(() => {
      listEl
        ?.querySelector<HTMLButtonElement>(`[data-tab="${CSS.escape(next.value)}"]`)
        ?.focus();
    });
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      selectByOffset(1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      selectByOffset(-1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      if (items[0]) select(items[0].value);
    } else if (e.key === 'End') {
      e.preventDefault();
      const last = items[items.length - 1];
      if (last) select(last.value);
    }
  }
</script>

<!-- The strip scrolls horizontally rather than wrapping, so a six-tab workspace
     stays one predictable row on a phone. -->
<div
  bind:this={listEl}
  role="tablist"
  aria-label={label}
  class="flex items-center overflow-x-auto
    {variant === 'pills'
      ? 'gap-1 p-1 rounded-md border border-border bg-muted/50'
      : 'gap-1 border-b border-border'}
    {className}"
>
  {#each items as item (item.value)}
    {@const isActive = active === item.value}
    <button
      role="tab"
      data-tab={item.value}
      aria-selected={isActive}
      tabindex={isActive ? 0 : -1}
      onclick={() => select(item.value)}
      onkeydown={handleKeydown}
      class="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-semibold
        transition-colors duration-150 cursor-pointer shrink-0
        {variant === 'pills'
          ? `flex-1 min-w-max px-3.5 py-2 rounded-sm ${
              isActive
                ? 'bg-card text-foreground shadow-e1 border border-border'
                : 'text-muted-foreground hover:text-foreground border border-transparent'
            }`
          : `px-3.5 py-2.5 -mb-px border-b-2 ${
              isActive
                ? 'border-accent text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            }`}"
    >
      {item.label}
      {#if item.badge !== undefined}
        <span
          class="inline-flex items-center justify-center min-w-5 px-1.5 h-5 rounded-full text-3xs font-bold tabular
            {isActive ? 'bg-accent/15 text-accent' : 'bg-muted text-muted-foreground'}"
        >
          {item.badge}
        </span>
      {/if}
    </button>
  {/each}
</div>
