<script lang="ts">
  import type { Snippet } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { X } from 'lucide-svelte';

  let {
    open = $bindable(false),
    title = '',
    /** Optional supporting line under the title. */
    description = '',
    size = 'md',
    children,
    footer,
    class: className = '',
    onclose
  }: {
    open: boolean;
    title?: string;
    description?: string;
    size?: 'sm' | 'md' | 'lg';
    children?: Snippet;
    footer?: Snippet;
    class?: string;
    onclose?: () => void;
  } = $props();

  const titleId = `dialog-title-${Math.random().toString(36).slice(2, 9)}`;
  const descId = `dialog-desc-${Math.random().toString(36).slice(2, 9)}`;

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl'
  };

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

  // The page behind a modal must not scroll away under it.
  $effect(() => {
    if (typeof document === 'undefined') return;
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  });
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
  <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
    <!-- Overlay -->
    <div
      transition:fade={{ duration: 120 }}
      onclick={close}
      onkeydown={(e) => e.key === 'Enter' && close()}
      role="button"
      tabindex="-1"
      aria-label="Close dialog"
      class="fixed inset-0 bg-black/55 cursor-pointer"
    ></div>

    <!-- Panel. On small screens it docks to the bottom as a sheet, which keeps
         the primary action inside thumb reach. -->
    <div
      bind:this={panelEl}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      tabindex="-1"
      transition:scale={{ duration: 140, start: 0.97 }}
      class="relative w-full {sizes[size]} border border-border rounded-t-lg sm:rounded-lg shadow-e3
        bg-card text-card-foreground z-10 flex flex-col max-h-[92vh] sm:max-h-[85vh]
        focus:outline-none {className}"
    >
      <div class="flex items-start justify-between gap-4 border-b border-border px-5 py-4 shrink-0">
        <div class="min-w-0">
          <h2 id={titleId} class="font-display text-base text-foreground">{title}</h2>
          {#if description}
            <p id={descId} class="text-2xs text-muted-foreground mt-1">{description}</p>
          {/if}
        </div>
        <button
          onclick={close}
          aria-label="Close dialog"
          class="icon-action shrink-0"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <div class="flex-1 overflow-y-auto px-5 py-4 text-sm text-foreground">
        {#if children}
          {@render children()}
        {/if}
      </div>

      {#if footer}
        <div class="flex items-center justify-end gap-2 border-t border-border px-5 py-3.5 shrink-0">
          {@render footer()}
        </div>
      {/if}
    </div>
  </div>
{/if}
