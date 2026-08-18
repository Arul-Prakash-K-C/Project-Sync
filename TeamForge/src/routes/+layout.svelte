<script lang="ts">
  import { setContext, onMount } from 'svelte';
  import './layout.css';
  import favicon from '$lib/assets/favicon.svg';
  import ToastContainer from '$lib/components/ToastContainer.svelte';

  let { children } = $props();
  let isDark = $state(false);

  function applyTheme(dark: boolean) {
    isDark = dark;
    if (typeof document === 'undefined') return;
    document.documentElement.classList.toggle('dark', dark);
    // Keep the browser chrome (address bar, form controls) in step with the page.
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  }

  function toggleTheme() {
    applyTheme(!isDark);
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
    }
  }

  setContext('theme', {
    get isDark() {
      return isDark;
    },
    toggleTheme
  });

  onMount(() => {
    // app.html has already set the class to avoid a flash; this syncs the
    // component's own state with whatever it decided.
    const saved = localStorage.getItem('theme');
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(saved === 'dark' || (!saved && systemDark));
  });
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
  <link rel="manifest" href="/manifest.webmanifest" />
  <meta name="theme-color" content={isDark ? '#0A0D12' : '#F5F6F8'} />
  <meta
    name="description"
    content="TeamForge is an intelligent project team finder and collaboration platform for academic capstone teams — form teams, track milestones and tasks, and manage faculty review in one place."
  />
  <title>TeamForge – Intelligent Project Team Finder & Collaboration Platform</title>
</svelte:head>

<div class="min-h-screen flex flex-col font-sans">
  {@render children()}
</div>

<ToastContainer />
