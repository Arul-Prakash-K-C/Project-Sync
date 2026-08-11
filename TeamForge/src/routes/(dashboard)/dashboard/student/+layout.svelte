<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores/auth.svelte';
  import { toast } from '$lib/stores/toast.svelte';
  import { getDashboardRoute } from '$lib/utils/navigation';

  let { children } = $props();

  onMount(() => {
    if (auth.user && auth.user.role !== 'student') {
      toast.error("You don't have access to the student dashboard.");
      goto(getDashboardRoute(auth.user.role));
    }
  });
</script>

{#if auth.user?.role === 'student'}
  {@render children()}
{/if}
