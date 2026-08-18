<script lang="ts">
  import { onMount, getContext } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { auth } from '$lib/stores/auth.svelte';
  import { db, type Notification } from '$lib/services/db';
  import { toast } from '$lib/stores/toast.svelte';
  import {
    LogOut,
    Bell,
    Menu,
    X,
    Sun,
    Moon,
    Compass,
    GraduationCap,
    LayoutGrid,
    CheckSquare,
    PanelLeftClose,
    PanelLeftOpen,
    Check,
    Lightbulb,
    Calendar,
    Clock,
    BarChart3,
    Megaphone,
    Notebook,
    FileText,
    History,
    Trash2
  } from 'lucide-svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Avatar from '$lib/components/ui/Avatar.svelte';
  import EmptyState from '$lib/components/ui/EmptyState.svelte';

  let { children } = $props();

  const themeCtx = getContext<{ isDark: boolean; toggleTheme: () => void }>('theme');

  let sidebarOpen = $state(true);
  let mobileSidebarOpen = $state(false);
  let notifOpen = $state(false);
  let notifications = $state<Notification[]>([]);
  let unreadCount = $derived(notifications.filter((n) => !n.read).length);

  onMount(() => {
    // Auth route guard
    if (!auth.user) {
      toast.warning('Please sign in to access the dashboard.');
      goto('/auth');
      return;
    }
    const storedRail = localStorage.getItem('teamforge_sidebar');
    if (storedRail === 'collapsed') sidebarOpen = false;
    loadNotifications();
  });

  function toggleSidebar() {
    sidebarOpen = !sidebarOpen;
    localStorage.setItem('teamforge_sidebar', sidebarOpen ? 'expanded' : 'collapsed');
  }

  function loadNotifications() {
    if (auth.user) {
      notifications = db.getNotifications(auth.user.id);
    }
  }

  function handleLogout() {
    auth.logout();
    toast.success('Logged out successfully');
    goto('/');
  }

  function markAllAsRead() {
    try {
      notifications = notifications.map((n) => ({ ...n, read: true }));
      db.saveNotifications(notifications);
    } catch (err) {
      toast.error('Failed to update notifications');
    }
  }

  function deleteNotification(id: string) {
    try {
      notifications = notifications.filter((n) => n.id !== id);
      if (auth.user) {
        const all = db.getNotifications(auth.user.id);
        const remaining = all.filter((n) => n.id !== id);
        db.saveNotifications(remaining);
      }
    } catch (err) {
      toast.error('Failed to delete notification');
    }
  }

  /*
    Navigation is grouped by the job the person is doing rather than listed flat.
    Ten faculty destinations in one undifferentiated column forces a linear read
    on every visit; three labelled groups let the eye jump straight to the right
    neighbourhood. Every original route is still present and unchanged.
  */
  const studentNav = [
    {
      group: 'Workspace',
      items: [{ href: '/dashboard/student', label: 'Overview', icon: LayoutGrid }]
    },
    {
      group: 'Discover',
      items: [
        { href: '/dashboard/student/team-finder', label: 'Team Finder', icon: Compass },
        { href: '/dashboard/student/ideas', label: 'Project Ideas', icon: Lightbulb }
      ]
    },
    {
      group: 'Account',
      items: [{ href: '/dashboard/student/profile', label: 'My Profile', icon: GraduationCap }]
    }
  ];

  const facultyNav = [
    {
      group: 'Overview',
      items: [{ href: '/dashboard/faculty', label: 'Dashboard', icon: LayoutGrid }]
    },
    {
      group: 'Supervision',
      items: [
        { href: '/dashboard/faculty/approvals', label: 'Project Approvals', icon: CheckSquare },
        { href: '/dashboard/faculty/milestones', label: 'Milestones', icon: Calendar },
        { href: '/dashboard/faculty/reviews', label: 'Weekly Reviews', icon: Clock },
        { href: '/dashboard/faculty/meetings', label: 'Review Scheduler', icon: Calendar }
      ]
    },
    {
      group: 'Insight',
      items: [
        { href: '/dashboard/faculty/analytics', label: 'Student Analytics', icon: BarChart3 },
        { href: '/dashboard/faculty/reports', label: 'Reports Hub', icon: FileText },
        { href: '/dashboard/faculty/activity-log', label: 'Activity Log', icon: History }
      ]
    },
    {
      group: 'Communication',
      items: [
        { href: '/dashboard/faculty/announcements', label: 'Announcements', icon: Megaphone },
        { href: '/dashboard/faculty/notes', label: 'Private Notes', icon: Notebook }
      ]
    }
  ];

  const adminNav = [
    {
      group: 'Administration',
      items: [{ href: '/dashboard/admin', label: 'Admin Dashboard', icon: LayoutGrid }]
    }
  ];

  const nav = $derived(
    auth.user?.role === 'student' ? studentNav : auth.user?.role === 'faculty' ? facultyNav : adminNav
  );

  const flatNav = $derived(nav.flatMap((section) => section.items));

  /*
    The header used to read a fixed "Workspace" on every route. Naming the
    current destination is the cheapest possible answer to "where am I?".
    Nested routes (a project workspace) fall back to a sensible parent label.
  */
  const currentLabel = $derived(
    flatNav.find((item) => item.href === $page.url.pathname)?.label ??
      ($page.url.pathname.includes('/project/') ? 'Project Workspace' : 'Workspace')
  );

  const roleLabel = $derived(
    auth.user?.role === 'faculty' ? 'Faculty' : auth.user?.role === 'admin' ? 'Administrator' : 'Student'
  );

  function isActive(href: string) {
    return $page.url.pathname === href;
  }

  function handleDrawerKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      notifOpen = false;
      mobileSidebarOpen = false;
    }
  }
</script>

<svelte:window onkeydown={handleDrawerKeydown} />

{#if auth.user}
  <a
    href="#main-content"
    class="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-100
      focus:px-3 focus:py-2 focus:rounded-md focus:bg-card focus:border focus:border-border
      focus:text-sm focus:font-semibold focus:shadow-e3"
  >
    Skip to main content
  </a>

  <div class="min-h-screen flex bg-background text-foreground">
    <!-- Mobile drawer backdrop -->
    {#if mobileSidebarOpen}
      <button
        onclick={() => (mobileSidebarOpen = false)}
        aria-label="Close navigation"
        class="fixed inset-0 bg-black/50 z-30 md:hidden cursor-pointer"
      ></button>
    {/if}

    <!-- Sidebar -->
    <aside
      aria-label="Primary"
      class="fixed md:sticky top-0 inset-y-0 left-0 h-screen border-r border-border bg-card md:bg-card/70 md:chrome-blur
        transition-[width,transform] duration-200 z-40 md:z-20 flex flex-col shrink-0
        w-64 {sidebarOpen ? 'md:w-64' : 'md:w-18'}
        {mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0"
    >
      <div
        class="h-16 border-b border-border flex items-center gap-2 shrink-0
          {sidebarOpen ? 'px-4' : 'px-0 justify-center'}"
      >
        <a
          href="/"
          class="flex items-center gap-2.5 min-w-0 rounded-sm"
          aria-label="TeamForge home"
        >
          <span
            class="chamfer w-9 h-9 bg-accent flex items-center justify-center text-accent-foreground
              font-display text-sm shrink-0"
            aria-hidden="true">TF</span
          >
          {#if sidebarOpen}
            <span class="font-display text-base text-foreground truncate">TeamForge</span>
          {/if}
        </a>

        {#if sidebarOpen}
          <button
            onclick={toggleSidebar}
            aria-label="Collapse sidebar"
            class="icon-action ml-auto hidden md:inline-flex border-transparent"
          >
            <PanelLeftClose class="w-4 h-4" />
          </button>
        {/if}

        <button
          onclick={() => (mobileSidebarOpen = false)}
          aria-label="Close navigation"
          class="icon-action ml-auto md:hidden border-transparent"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      {#if !sidebarOpen}
        <div class="hidden md:flex justify-center pt-3">
          <button onclick={toggleSidebar} aria-label="Expand sidebar" class="icon-action border-transparent">
            <PanelLeftOpen class="w-4 h-4" />
          </button>
        </div>
      {/if}

      <nav class="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-5">
        {#each nav as section (section.group)}
          <div class="flex flex-col gap-1">
            {#if sidebarOpen}
              <p class="eyebrow px-2.5 pb-1">{section.group}</p>
            {:else}
              <span class="sr-only">{section.group}</span>
            {/if}

            {#each section.items as item (item.href)}
              {@const active = isActive(item.href)}
              <a
                href={item.href}
                aria-current={active ? 'page' : undefined}
                title={sidebarOpen ? undefined : item.label}
                onclick={() => (mobileSidebarOpen = false)}
                class="relative flex items-center gap-3 rounded-md text-sm font-semibold transition-colors group
                  {sidebarOpen ? 'px-2.5 py-2' : 'px-0 py-2.5 justify-center'}
                  {active
                    ? 'bg-accent/10 text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'}"
              >
                <!-- A left rule marks the active row so the state survives at a
                     glance even when the tint is subtle. -->
                {#if active}
                  <span
                    class="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-accent"
                    aria-hidden="true"
                  ></span>
                {/if}
                <item.icon
                  class="w-4.5 h-4.5 shrink-0 {active ? 'text-accent' : 'text-muted-foreground group-hover:text-accent'}"
                  aria-hidden="true"
                />
                {#if sidebarOpen}
                  <span class="truncate">{item.label}</span>
                {:else}
                  <span class="sr-only">{item.label}</span>
                {/if}
              </a>
            {/each}
          </div>
        {/each}
      </nav>

      <div class="border-t border-border p-3 shrink-0 flex flex-col gap-2">
        <div class="flex items-center gap-2.5 {sidebarOpen ? '' : 'justify-center'}">
          <Avatar src={auth.user.avatar} name={auth.user.name} size={sidebarOpen ? 'sm' : 'sm'} />
          {#if sidebarOpen}
            <div class="flex flex-col min-w-0 leading-tight">
              <span class="text-xs font-bold text-foreground truncate">{auth.user.name}</span>
              <span class="text-3xs text-muted-foreground truncate">{roleLabel}</span>
            </div>
          {/if}
        </div>

        <button
          onclick={handleLogout}
          title={sidebarOpen ? undefined : 'Sign out'}
          class="flex items-center justify-center gap-2 h-9 rounded-md border border-border text-xs font-semibold
            text-muted-foreground hover:text-destructive hover:border-destructive/40 hover:bg-destructive/8
            transition-colors cursor-pointer"
        >
          <LogOut class="w-4 h-4 shrink-0" aria-hidden="true" />
          {#if sidebarOpen}Sign out{:else}<span class="sr-only">Sign out</span>{/if}
        </button>
      </div>
    </aside>

    <!-- Main column -->
    <div class="flex-1 flex flex-col min-w-0">
      <header
        class="sticky top-0 z-20 h-16 border-b border-border chrome-blur flex items-center justify-between
          gap-3 px-4 sm:px-6 shrink-0"
      >
        <div class="flex items-center gap-3 min-w-0">
          <button
            onclick={() => (mobileSidebarOpen = true)}
            aria-label="Open navigation"
            aria-expanded={mobileSidebarOpen}
            class="icon-action md:hidden"
          >
            <Menu class="w-4.5 h-4.5" />
          </button>

          <div class="flex flex-col min-w-0 leading-tight">
            <span class="text-sm font-bold text-foreground truncate">{currentLabel}</span>
            <span class="text-3xs text-muted-foreground truncate">
              {roleLabel} · {auth.user.department}
            </span>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button
            onclick={() => (notifOpen = true)}
            aria-label={unreadCount > 0
              ? `Notifications, ${unreadCount} unread`
              : 'Notifications'}
            class="icon-action relative"
          >
            <Bell class="w-4.5 h-4.5" />
            {#if unreadCount > 0}
              <span
                class="absolute -top-1 -right-1 min-w-4.5 h-4.5 px-1 rounded-full bg-accent
                  text-accent-foreground text-3xs font-bold flex items-center justify-center tabular"
                aria-hidden="true">{unreadCount > 9 ? '9+' : unreadCount}</span
              >
            {/if}
          </button>

          <button
            onclick={() => themeCtx?.toggleTheme()}
            aria-label={themeCtx?.isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            class="icon-action"
          >
            {#if themeCtx?.isDark}
              <Sun class="w-4.5 h-4.5" />
            {:else}
              <Moon class="w-4.5 h-4.5" />
            {/if}
          </button>
        </div>
      </header>

      <main id="main-content" class="flex-1 p-4 sm:p-6 lg:p-8">
        {@render children()}
      </main>
    </div>

    <!-- Notifications drawer -->
    {#if notifOpen}
      <button
        onclick={() => (notifOpen = false)}
        aria-label="Close notifications"
        class="fixed inset-0 bg-black/50 z-40 cursor-pointer"
      ></button>

      <aside
        aria-label="Notifications"
        class="fixed right-0 top-0 bottom-0 w-full sm:w-96 max-w-full bg-card border-l border-border
          shadow-e3 z-50 flex flex-col"
      >
        <div class="h-16 border-b border-border px-4 flex items-center justify-between gap-3 shrink-0">
          <div class="flex items-center gap-2 min-w-0">
            <Bell class="w-4.5 h-4.5 text-accent shrink-0" aria-hidden="true" />
            <span class="font-display text-base text-foreground">Notifications</span>
            {#if unreadCount > 0}
              <span
                class="text-3xs font-bold bg-accent/12 text-accent px-1.5 py-0.5 rounded-sm tabular"
              >
                {unreadCount} new
              </span>
            {/if}
          </div>
          <button onclick={() => (notifOpen = false)} aria-label="Close notifications" class="icon-action">
            <X class="w-4 h-4" />
          </button>
        </div>

        <div class="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
          {#if notifications.length === 0}
            <EmptyState
              icon={Bell}
              title="You're all caught up"
              description="Approvals, milestone changes and announcements from your supervisor will land here."
              size="sm"
              class="mt-4"
            />
          {:else}
            {#each notifications as n (n.id)}
              <article
                class="relative p-3 pr-9 border rounded-md flex flex-col gap-1 group
                  {n.read ? 'border-border bg-card' : 'border-accent/30 bg-accent/6'}"
              >
                <div class="flex items-center gap-2">
                  {#if !n.read}
                    <span class="w-1.5 h-1.5 rounded-full bg-accent shrink-0" aria-hidden="true"></span>
                    <span class="sr-only">Unread.</span>
                  {/if}
                  <h3 class="text-xs font-bold text-foreground">{n.title}</h3>
                </div>
                <p class="text-2xs text-muted-foreground leading-relaxed">{n.description}</p>
                <div class="flex items-center gap-3 mt-1">
                  <time class="text-3xs text-muted-foreground tabular" datetime={n.createdAt}>
                    {new Date(n.createdAt).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </time>
                  {#if n.actionUrl}
                    <a
                      href={n.actionUrl}
                      onclick={() => (notifOpen = false)}
                      class="text-3xs font-bold text-accent hover:underline rounded-sm"
                    >
                      Open
                    </a>
                  {/if}
                </div>

                <button
                  onclick={() => deleteNotification(n.id)}
                  aria-label="Delete notification: {n.title}"
                  class="absolute top-2 right-2 p-1.5 rounded-sm text-muted-foreground opacity-0
                    group-hover:opacity-100 focus-visible:opacity-100 hover:text-destructive
                    hover:bg-destructive/10 transition-opacity cursor-pointer"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                </button>
              </article>
            {/each}
          {/if}
        </div>

        {#if notifications.length > 0}
          <div class="p-3 border-t border-border shrink-0">
            <Button variant="outline" size="sm" class="w-full" onclick={markAllAsRead} disabled={unreadCount === 0}>
              <Check class="w-3.5 h-3.5" />
              Mark all as read
            </Button>
          </div>
        {/if}
      </aside>
    {/if}
  </div>
{:else}
  <!-- Guard is redirecting; hold the shell's shape so the page does not flash
       an empty white screen on the way to /auth. -->
  <div class="min-h-screen flex bg-background" aria-busy="true">
    <div class="hidden md:block w-64 border-r border-border bg-card/70"></div>
    <div class="flex-1 flex flex-col">
      <div class="h-16 border-b border-border"></div>
      <div class="p-8 flex flex-col gap-4">
        <div class="skeleton h-8 w-64"></div>
        <div class="skeleton h-4 w-96"></div>
      </div>
    </div>
    <span class="sr-only">Loading your workspace…</span>
  </div>
{/if}
