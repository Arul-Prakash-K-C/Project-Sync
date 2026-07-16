<script lang="ts">
  import { setContext, onMount } from 'svelte';
  import './layout.css';
  import favicon from '$lib/assets/favicon.svg';
  import ToastContainer from '$lib/components/ToastContainer.svelte';

  let { children } = $props();
  let isDark = $state(false);

  function toggleTheme() {
    isDark = !isDark;
    if (typeof window !== 'undefined') {
      if (isDark) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
      }
    }
  }

  setContext('theme', {
    get isDark() { return isDark; },
    toggleTheme
  });

  onMount(() => {
    const saved = localStorage.getItem('theme');
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (saved === 'dark' || (!saved && systemDark)) {
      isDark = true;
      document.documentElement.classList.add('dark');
    } else {
      isDark = false;
      document.documentElement.classList.remove('dark');
    }
  });
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
  <title>TeamForge – Intelligent Project Team Finder & Collaboration Platform</title>
</svelte:head>

<div class="min-h-screen flex flex-col font-sans transition-colors duration-300">
  {@render children()}
</div>

<ToastContainer />
