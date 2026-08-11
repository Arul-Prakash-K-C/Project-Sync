<script lang="ts">
  let {
    items = [],
    active = $bindable(''),
    class: className = '',
    variant = 'pills'
  }: {
    items: { value: string; label: string }[];
    active: string;
    class?: string;
    variant?: 'pills' | 'underline';
  } = $props();

  function selectByOffset(offset: number) {
    const idx = items.findIndex((i) => i.value === active);
    const next = items[(idx + offset + items.length) % items.length];
    if (next) active = next.value;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      selectByOffset(1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      selectByOffset(-1);
    }
  }
</script>

<div role="tablist" class="flex items-center gap-1 p-1 rounded-md border border-border bg-muted/40 {className}">
  {#each items as item}
    <button
      role="tab"
      aria-selected={active === item.value}
      tabindex={active === item.value ? 0 : -1}
      onclick={() => (active = item.value)}
      onkeydown={handleKeydown}
      class="flex-1 py-2 px-4 text-sm font-semibold rounded-sm transition-all duration-200 cursor-pointer
        {active === item.value
          ? 'bg-card text-foreground shadow-xs border border-border/80'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted/65'}"
    >
      {item.label}
    </button>
  {/each}
</div>
