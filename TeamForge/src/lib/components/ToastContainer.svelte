<script lang="ts">
  import { toast } from '$lib/stores/toast.svelte';
  import { fly } from 'svelte/transition';
  import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-svelte';

  const accents = {
    success: 'border-l-success',
    error: 'border-l-destructive',
    warning: 'border-l-warning',
    info: 'border-l-info'
  };
</script>

<!--
  Toasts are announced as a live region so screen-reader users learn that an
  action succeeded or failed. Errors interrupt (assertive); everything else
  waits for a pause (polite).
-->
<div
  class="fixed z-50 flex flex-col gap-2 pointer-events-none
    inset-x-3 bottom-3 sm:inset-x-auto sm:bottom-auto sm:top-4 sm:right-4 sm:w-full sm:max-w-sm"
>
  {#each toast.toasts as t (t.id)}
    <div
      in:fly={{ y: 12, duration: 200 }}
      out:fly={{ x: 24, duration: 160 }}
      role={t.type === 'error' ? 'alert' : 'status'}
      aria-live={t.type === 'error' ? 'assertive' : 'polite'}
      class="pointer-events-auto flex items-start gap-3 p-3.5 rounded-md border border-border border-l-3
        bg-card text-card-foreground shadow-e3 {accents[t.type]}"
    >
      <div class="mt-0.5 shrink-0" aria-hidden="true">
        {#if t.type === 'success'}
          <CheckCircle2 class="w-4.5 h-4.5 text-success" />
        {:else if t.type === 'error'}
          <XCircle class="w-4.5 h-4.5 text-destructive" />
        {:else if t.type === 'warning'}
          <AlertTriangle class="w-4.5 h-4.5 text-warning" />
        {:else}
          <Info class="w-4.5 h-4.5 text-info" />
        {/if}
      </div>

      <p class="flex-1 text-sm text-foreground leading-snug">{t.message}</p>

      <button
        onclick={() => toast.dismiss(t.id)}
        aria-label="Dismiss notification"
        class="shrink-0 -mt-0.5 -mr-1 p-1 rounded-sm text-muted-foreground hover:text-foreground
          hover:bg-secondary transition-colors cursor-pointer"
      >
        <X class="w-3.5 h-3.5" />
      </button>
    </div>
  {/each}
</div>
