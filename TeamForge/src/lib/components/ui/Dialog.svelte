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

  const titleId = `dialog-title-${Math.random().toString(36).slice(2, 9)}`;

  let panelEl = $state<HTMLDivElement | null>(null);
  let previouslyFocused: HTMLElement | null = null;

  function close() {
    open = false;
    if (onclose) onclose();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!open) return;
    if (e.key === 'Escape') {
      close();
      return;
    }
    if (e.key === 'Tab' && panelEl) {
      const focusable = panelEl.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  $effect(() => {
    if (open) {
      previouslyFocused = document.activeElement as HTMLElement | null;
      // Wait for the panel to mount before focusing it.
      requestAnimationFrame(() => panelEl?.focus());
    } else {
      previouslyFocused?.focus?.();
      previouslyFocused = null;
    }
  });
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
      bind:this={panelEl}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabindex="-1"
      transition:scale={{ duration: 150, start: 0.96 }}
      class="relative w-full max-w-lg border rounded-lg shadow-xl bg-card text-card-foreground p-6 z-10 flex flex-col gap-4 max-h-[85vh] overflow-y-auto focus:outline-none {className}"
    >
      <div class="flex items-center justify-between border-b border-border pb-3">
        <h3 id={titleId} class="font-display text-lg text-foreground">{title}</h3>
        <button
          onclick={close}
          aria-label="Close dialog"
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
