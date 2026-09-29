<script lang="ts">
  let {
    items = [],
    active = $bindable(''),
    class: className = '',
    variant = 'pills',
    /** Accessible name for the tab strip, read before the tab list. */
    label = 'Sections',
    /** 1 when the last change moved right, -1 when it moved left; panels use it to slide in from that side. */
    direction = $bindable(1)
  }: {
    items: { value: string; label: string; badge?: string | number }[];
    active: string;
    class?: string;
    variant?: 'pills' | 'underline';
    label?: string;
    direction?: number;
  } = $props();

  let listEl = $state<HTMLDivElement | null>(null);
  let indicator = $state<HTMLSpanElement | null>(null);
  /** Last painted indicator box, the starting point of the next stretch. */
  let from: { left: number; width: number } | null = null;

  function select(value: string) {
    active = value;
  }

  /*
    The molten indicator. On a change it first stretches to span both the old
    and the new tab, then contracts onto the new one, like a drop of metal
    flowing across. Positions come from the tab buttons themselves, so it
    follows label widths, badges and horizontal scroll.
  */
  function box(value: string) {
    const btn = listEl?.querySelector<HTMLElement>(`[data-tab="${CSS.escape(value)}"]`);
    return btn ? { left: btn.offsetLeft, width: btn.offsetWidth } : null;
  }

  function place(el: HTMLElement, b: { left: number; width: number }) {
    el.style.left = `${b.left}px`;
    el.style.width = `${b.width}px`;
  }

  $effect(() => {
    const value = active;
    const el = indicator;
    if (!el || !listEl) return;
    const to = box(value);
    if (!to) return;
    const previous = from;
    from = to;
    if (!previous || previous.left === to.left || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      place(el, to);
      return;
    }
    direction = to.left > previous.left ? 1 : -1;
    const left = Math.min(previous.left, to.left);
    const right = Math.max(previous.left + previous.width, to.left + to.width);
    el.animate(
      [
        { left: `${previous.left}px`, width: `${previous.width}px` },
        { left: `${left}px`, width: `${right - left}px`, offset: 0.4 },
        { left: `${to.left}px`, width: `${to.width}px` }
      ],
      { duration: 460, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }
    );
    place(el, to);
  });

  // Label widths change with fonts loading and badge counts; keep the indicator seated.
  $effect(() => {
    if (!listEl || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      const b = box(active);
      if (b && indicator) {
        from = b;
        place(indicator, b);
      }
    });
    ro.observe(listEl);
    return () => ro.disconnect();
  });

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
  class="relative flex items-center overflow-x-auto
    {variant === 'pills'
      ? 'gap-1 p-1 rounded-md border border-border bg-muted/50'
      : 'gap-1 border-b border-border'}
    {className}"
>
  <span
    bind:this={indicator}
    class="tab-molten {variant === 'pills' ? 'top-1 bottom-1' : 'bottom-0 h-0.5'}"
    data-variant={variant}
    aria-hidden="true"
  ></span>
  {#each items as item (item.value)}
    {@const isActive = active === item.value}
    <button
      role="tab"
      data-tab={item.value}
      aria-selected={isActive}
      tabindex={isActive ? 0 : -1}
      onclick={() => select(item.value)}
      onkeydown={handleKeydown}
      class="relative z-1 inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-semibold
        transition-colors duration-300 cursor-pointer shrink-0
        {variant === 'pills'
          ? `flex-1 min-w-max px-3.5 py-2 rounded-sm border border-transparent ${
              isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`
          : `px-3.5 py-2.5 ${isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}"
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
