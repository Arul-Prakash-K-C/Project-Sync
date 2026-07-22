<script lang="ts">
  import { onMount, getContext } from 'svelte';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores/auth.svelte';
  import { db, type Notification } from '$lib/services/db';
  import { toast } from '$lib/stores/toast.svelte';
  import { 
    Users, 
    BookOpen, 
    Settings, 
    LogOut, 
    Bell, 
    Menu, 
    X,
    Sun,
    Moon,
    FolderKanban,
    Compass,
    GraduationCap,
    Grid,
    CheckSquare,
    ChevronLeft,
    Check,
    Lightbulb,
    Calendar,
    Clock,
    BarChart3,
    Megaphone,
    Notebook,
    FileText
  } from 'lucide-svelte';
  import Button from '$lib/components/ui/Button.svelte';

  let { children } = $props();

  const themeCtx = getContext<{ isDark: boolean; toggleTheme: () => void }>('theme');

  let sidebarOpen = $state(true);
  let notifOpen = $state(false);
  let notifications = $state<Notification[]>([]);
  let unreadCount = $derived(notifications.filter(n => !n.read).length);

  onMount(() => {
    // Auth route guard
    if (!auth.user) {
      toast.warning('Please sign in to access the dashboard.');
      goto('/auth');
      return;
    }
    loadNotifications();
  });

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
    notifications = notifications.map(n => ({ ...n, read: true }));
    db.saveNotifications(notifications);
  }

  function deleteNotification(id: string) {
    notifications = notifications.filter(n => n.id !== id);
    if (auth.user) {
      const all = db.getNotifications(auth.user.id);
      const remaining = all.filter(n => n.id !== id);
      db.saveNotifications(remaining);
    }
  }

  // Navigation Links based on role
  const studentLinks = [
    { href: '/dashboard/student', label: 'Overview', icon: Grid },
    { href: '/dashboard/student/team-finder', label: 'Team Finder', icon: Compass },
    { href: '/dashboard/student/ideas', label: 'Project Ideas', icon: Lightbulb },
    { href: '/dashboard/student/profile', label: 'My Profile', icon: GraduationCap }
  ];

  const facultyLinks = [
    { href: '/dashboard/faculty', label: 'Dashboard', icon: Grid },
    { href: '/dashboard/faculty/approvals', label: 'Project Approvals', icon: CheckSquare },
    { href: '/dashboard/faculty/milestones', label: 'Milestones', icon: Calendar },
    { href: '/dashboard/faculty/reviews', label: 'Weekly Reviews', icon: Clock },
    { href: '/dashboard/faculty/analytics', label: 'Student Analytics', icon: BarChart3 },
    { href: '/dashboard/faculty/meetings', label: 'Review Scheduler', icon: Clock },
    { href: '/dashboard/faculty/announcements', label: 'Announcements', icon: Megaphone },
    { href: '/dashboard/faculty/notes', label: 'Private Notes', icon: Notebook },
    { href: '/dashboard/faculty/reports', label: 'Reports Hub', icon: FileText }
  ];

  const adminLinks = [
    { href: '/dashboard/admin', label: 'Admin Dashboard', icon: Grid }
  ];

  const links = $derived(
    auth.user?.role === 'student' ? studentLinks :
    auth.user?.role === 'faculty' ? facultyLinks :
    adminLinks
  );
</script>

{#if auth.user}
  <div class="min-h-screen flex bg-background text-foreground overflow-hidden">
    
    <!-- Sidebar -->
    <aside 
      class="border-r border-border/40 backdrop-blur-md bg-card/60 transition-all duration-300 z-30 flex flex-col shrink-0 relative
        {sidebarOpen ? 'w-64' : 'w-20'}"
    >
      <!-- Sidebar Header -->
      <div class="h-16 border-b border-border/30 flex items-center justify-between px-5 {sidebarOpen ? '' : 'justify-center px-0'}">
        <a href="/" class="flex items-center gap-3 overflow-hidden">
          <div class="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-black shrink-0 text-lg shadow-md">
            TF
          </div>
          {#if sidebarOpen}
            <span class="text-lg font-bold tracking-tight text-foreground transition-opacity">TeamForge</span>
          {/if}
        </a>
        <button 
          onclick={() => sidebarOpen = !sidebarOpen}
          class="p-1 rounded-lg hover:bg-secondary cursor-pointer text-muted-foreground hover:text-foreground hidden md:block
            {sidebarOpen ? '' : 'absolute -right-3 top-8 -translate-y-1/2 bg-background border border-border rounded-full p-1 shadow-xs'}"
        >
          <ChevronLeft class="w-4.5 h-4.5 transition-transform duration-300 {sidebarOpen ? '' : 'rotate-180'}" />
        </button>
      </div>

      <!-- Navigation Links -->
      <nav class="flex-1 px-3 py-4 flex flex-col gap-1 overflow-y-auto">
        {#each links as item}
          <a
            href={item.href}
            class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all group hover:bg-secondary
              text-muted-foreground hover:text-foreground {sidebarOpen ? '' : 'justify-center px-0'}"
          >
            <item.icon class="w-5 h-5 shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
            {#if sidebarOpen}
              <span class="truncate">{item.label}</span>
            {/if}
          </a>
        {/each}
      </nav>

      <!-- Sidebar Footer User Profile -->
      <div class="p-4 border-t border-border/30 flex flex-col gap-2">
        <div class="flex items-center gap-3">
          <img 
            src={auth.user.avatar} 
            alt={auth.user.name} 
            class="w-10 h-10 rounded-xl border border-primary/20 shrink-0 bg-muted"
          />
          {#if sidebarOpen}
            <div class="flex flex-col min-w-0">
              <span class="text-sm font-bold text-foreground truncate">{auth.user.name}</span>
              <span class="text-xs text-muted-foreground capitalize truncate">{auth.user.role}</span>
            </div>
          {/if}
        </div>

        {#if sidebarOpen}
          <button 
            onclick={handleLogout}
            class="w-full flex items-center justify-center gap-2 mt-2 py-2 border border-destructive/20 text-destructive bg-destructive/5 hover:bg-destructive hover:text-destructive-foreground rounded-xl text-xs font-semibold transition-all cursor-pointer"
          >
            <LogOut class="w-4 h-4" />
            Sign Out
          </button>
        {:else}
          <button 
            onclick={handleLogout}
            class="w-full flex items-center justify-center py-2 text-destructive hover:bg-destructive/10 rounded-xl transition-colors cursor-pointer"
            title="Sign Out"
          >
            <LogOut class="w-5 h-5" />
          </button>
        {/if}
      </div>
    </aside>

    <!-- Main Workspace -->
    <div class="flex-1 flex flex-col overflow-hidden">
      <!-- Sticky Topbar Header -->
      <header class="h-16 border-b border-border/40 backdrop-blur-md bg-background/60 flex items-center justify-between px-6 z-20">
        <div class="flex items-center gap-3">
          <!-- Mobile Sidebar Toggle -->
          <button 
            onclick={() => sidebarOpen = !sidebarOpen}
            class="p-2 border border-border rounded-xl hover:bg-secondary cursor-pointer md:hidden text-foreground"
          >
            <Menu class="w-5 h-5" />
          </button>
          <div class="flex flex-col">
            <h1 class="text-sm font-bold text-foreground">Workspace</h1>
            <p class="text-xs text-muted-foreground">{auth.user.department}</p>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <!-- Notification Bell -->
          <button 
            onclick={() => notifOpen = true}
            class="relative p-2.5 rounded-xl border border-border hover:bg-secondary cursor-pointer text-foreground"
          >
            <Bell class="w-4.5 h-4.5" />
            {#if unreadCount > 0}
              <span class="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-primary border-2 border-background animate-pulse"></span>
            {/if}
          </button>

          <!-- Theme Toggle -->
          <button 
            onclick={() => themeCtx?.toggleTheme()} 
            class="p-2.5 rounded-xl border border-border hover:bg-secondary transition-colors cursor-pointer text-foreground"
          >
            {#if themeCtx?.isDark}
              <Sun class="w-4.5 h-4.5 text-amber-400" />
            {:else}
              <Moon class="w-4.5 h-4.5" />
            {/if}
          </button>
        </div>
      </header>

      <!-- Main Nested View Content -->
      <main class="flex-1 overflow-y-auto p-6 md:p-8 bg-muted/20 relative">
        {@render children()}
      </main>
    </div>

    <!-- Notification Side Drawer Overlay -->
    {#if notifOpen}
      <!-- Backdrop -->
      <div 
        onclick={() => notifOpen = false}
        onkeydown={(e) => e.key === 'Enter' && (notifOpen = false)}
        role="button"
        tabindex="-1"
        aria-label="Close notification sidebar drawer"
        class="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 cursor-pointer"
      ></div>

      <!-- Drawer Panel -->
      <div class="fixed right-0 top-0 bottom-0 w-80 max-w-full bg-card border-l border-border shadow-2xl z-50 flex flex-col">
        <div class="h-16 border-b border-border/40 px-5 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <Bell class="w-5 h-5 text-primary" />
            <span class="font-bold text-foreground">Notifications</span>
            {#if unreadCount > 0}
              <span class="text-xs bg-primary text-primary-foreground font-black px-2 py-0.5 rounded-full">{unreadCount}</span>
            {/if}
          </div>
          <button 
            onclick={() => notifOpen = false}
            class="p-1 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg cursor-pointer"
          >
            <X class="w-5 h-5" />
          </button>
        </div>

        <div class="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {#if notifications.length === 0}
            <div class="h-48 flex flex-col items-center justify-center text-center">
              <Bell class="w-8 h-8 text-muted-foreground/30 mb-2" />
              <p class="text-xs font-semibold text-muted-foreground">All caught up!</p>
              <p class="text-2xs text-muted-foreground/60">No pending updates found.</p>
            </div>
          {:else}
            {#each notifications as n}
              <div 
                class="p-3 border rounded-xl flex flex-col gap-1 transition-all relative group
                  {n.read ? 'border-border/60 bg-muted/10' : 'border-primary/20 bg-primary/5'}"
              >
                <div class="flex justify-between items-start">
                  <span class="text-xs font-bold text-foreground">{n.title}</span>
                  <button 
                    onclick={() => deleteNotification(n.id)}
                    class="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-opacity cursor-pointer"
                    title="Delete Notification"
                  >
                    <X class="w-3.5 h-3.5" />
                  </button>
                </div>
                <p class="text-xs text-muted-foreground leading-relaxed">{n.description}</p>
                <span class="text-[10px] text-muted-foreground/70 mt-1">{new Date(n.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
              </div>
            {/each}
          {/if}
        </div>

        {#if notifications.length > 0}
          <div class="p-4 border-t border-border/40">
            <Button variant="outline" size="sm" class="w-full text-xs" onclick={markAllAsRead}>
              <Check class="w-3.5 h-3.5" />
              Mark all as read
            </Button>
          </div>
        {/if}
      </div>
    {/if}
  </div>
{/if}
