<script lang="ts">
  import { toast } from '$lib/stores/toast.svelte';
  import { fly } from 'svelte/transition';
  import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-svelte';
</script>

<div class="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
  {#each toast.toasts as t (t.id)}
    <div
      in:fly={{ x: 100, duration: 300 }}
      out:fly={{ x: 100, duration: 200 }}
      class="pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-lg glass-card transition-all duration-300"
      class:border-emerald-500={t.type === 'success'}
      class:border-rose-500={t.type === 'error'}
      class:border-amber-500={t.type === 'warning'}
      class:border-indigo-500={t.type === 'info'}
    >
      <div class="mt-0.5 shrink-0">
        {#if t.type === 'success'}
          <CheckCircle2 class="w-5 h-5 text-emerald-500" />
        {:else if t.type === 'error'}
          <XCircle class="w-5 h-5 text-rose-500" />
        {:else if t.type === 'warning'}
          <AlertTriangle class="w-5 h-5 text-amber-500" />
        {:else}
          <Info class="w-5 h-5 text-indigo-500" />
        {/if}
      </div>

      <div class="flex-1">
        <p class="text-sm font-medium text-foreground">{t.message}</p>
      </div>

      <button
        onclick={() => toast.dismiss(t.id)}
        class="shrink-0 text-muted-foreground hover:text-foreground hover:bg-secondary p-1 rounded-lg transition-colors cursor-pointer"
      >
        <X class="w-4 h-4" />
      </button>
    </div>
  {/each}
</div>
