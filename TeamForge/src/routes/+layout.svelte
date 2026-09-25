<script lang="ts">
  import { setContext, onMount } from 'svelte';
  import { onNavigate } from '$app/navigation';
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

  /*
    Route changes cross-fade through the View Transitions API. The dashboard's
    sidebar and header carry their own transition names, so they hold still
    while only the page content moves. Browsers without the API navigate
    instantly, and the dashboard falls back to a CSS entrance.
  */
  onNavigate((navigation) => {
    if (!document.startViewTransition) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // A transition in a background tab is aborted by the browser; skip it.
    if (document.hidden) return;
    // Same-page hash jumps and query tweaks are not page changes.
    if (navigation.from?.url.pathname === navigation.to?.url.pathname) return;

    return new Promise((resolve) => {
      const transition = document.startViewTransition(async () => {
        resolve();
        await navigation.complete;
      });
      // An aborted transition (tab hidden mid-way, rapid double navigation) is
      // harmless — the navigation itself still happens — so don't report it.
      transition.ready.catch(() => {});
      transition.finished.catch(() => {});
    });
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
