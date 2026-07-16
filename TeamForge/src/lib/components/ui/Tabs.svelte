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
</script>

<div class="flex items-center gap-1 p-1 rounded-xl border border-border bg-muted/40 {className}">
  {#each items as item}
    <button
      onclick={() => active = item.value}
      class="flex-1 py-2 px-4 text-sm font-medium rounded-lg transition-all duration-200 cursor-pointer
        {active === item.value 
          ? 'bg-card text-foreground shadow-xs border border-border/80' 
          : 'text-muted-foreground hover:text-foreground hover:bg-muted/65'}"
    >
      {item.label}
    </button>
  {/each}
</div>
