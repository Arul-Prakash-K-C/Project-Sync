<script lang="ts">
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores/auth.svelte';
  import { getDashboardRoute } from '$lib/utils/navigation';

  // Waits for a cloud session to finish restoring before deciding where to go.
  $effect(() => {
    if (auth.loading) return;
    goto(auth.user ? getDashboardRoute(auth.user.role) : '/auth', { replaceState: true });
  });
</script>

<svelte:head>
  <title>Redirecting — TeamForge</title>
</svelte:head>

<!-- Role-based redirect. It is on screen for a frame or two, so it says what it
     is doing rather than showing a bare spinner on an empty page. -->
<div
  class="min-h-screen flex flex-col items-center justify-center gap-4 bg-background"
  role="status"
  aria-live="polite"
>
  <span
    class="w-6 h-6 rounded-full border-2 border-accent border-r-transparent animate-spin"
    aria-hidden="true"
  ></span>
  <p class="text-sm font-semibold text-muted-foreground">Taking you to your dashboard…</p>
</div>
