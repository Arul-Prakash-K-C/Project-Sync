<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores/auth.svelte';
  
  onMount(() => {
    if (auth.user) {
      if (auth.user.role === 'student') {
        goto('/dashboard/student');
      } else if (auth.user.role === 'faculty') {
        goto('/dashboard/faculty');
      } else if (auth.user.role === 'admin') {
        goto('/dashboard/admin');
      }
    } else {
      goto('/auth');
    }
  });
</script>

<div class="h-96 flex items-center justify-center">
  <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
</div>
