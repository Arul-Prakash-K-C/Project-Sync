<script lang="ts">
  import type { Snippet } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { X } from 'lucide-svelte';

  let {
    open = $bindable(false),
    title = '',
    children,
    footer,
    class: className = '',
    onclose
  }: {
    open: boolean;
    title?: string;
    children?: Snippet;
    footer?: Snippet;
    class?: string;
    onclose?: () => void;
  } = $props();

  function close() {
    open = false;
    if (onclose) onclose();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && open) {
      close();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <!-- Overlay -->
    <div
      transition:fade={{ duration: 150 }}
      onclick={close}
      onkeydown={(e) => e.key === 'Enter' && close()}
      role="button"
      tabindex="-1"
      aria-label="Close dialog modal backdrop"
      class="fixed inset-0 bg-black/50 backdrop-blur-xs cursor-pointer"
    ></div>

    <!-- Modal Card -->
    <div
      transition:scale={{ duration: 150, start: 0.96 }}
      class="relative w-full max-w-lg border rounded-2xl shadow-xl bg-card text-card-foreground p-6 z-10 flex flex-col gap-4 max-h-[85vh] overflow-y-auto {className}"
    >
      <div class="flex items-center justify-between border-b border-border pb-3">
        <h3 class="text-lg font-semibold tracking-tight text-foreground">{title}</h3>
        <button
          onclick={close}
          class="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-secondary transition-colors cursor-pointer"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <div class="flex-1 text-sm text-foreground">
        {#if children}
          {@render children()}
        {/if}
      </div>

      {#if footer}
        <div class="flex items-center justify-end gap-2 border-t border-border pt-3">
          {@render footer()}
        </div>
      {/if}
    </div>
  </div>
{/if}
