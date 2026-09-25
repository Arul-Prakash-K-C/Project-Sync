<script lang="ts">
  import { onMount, getContext } from 'svelte';
  import { db } from '$lib/services/db';
  import { reveal, tilt } from '$lib/actions/motion';
  import ForgeScene from '$lib/components/three/ForgeScene.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import {
    ArrowRight,
    ArrowUpRight,
    Users,
    Layers,
    MessageSquare,
    FolderGit2,
    FileCheck,
    ShieldCheck,
    Sun,
    Moon
  } from 'lucide-svelte';

  const themeCtx = getContext<{ isDark: boolean; toggleTheme: () => void }>('theme');

  /*
    Figures are read from the platform's own data rather than written into the
    markup — a landing page claiming "1,200+ students" while the product knows
    the real number is quietly lying to its visitors.
  */
  let stats = $state<{ label: string; value: string }[] | null>(null);

  function loadStats() {
    const users = db.getUsers();
    const projects = db.getProjects();
    const milestones = projects.flatMap((p) => p.milestones);
    const completion = milestones.length
      ? Math.round((milestones.filter((m) => m.completed).length / milestones.length) * 100)
      : 0;
    stats = [
      { label: 'Students', value: String(users.filter((u) => u.role === 'student').length) },
      { label: 'Active teams', value: String(projects.filter((p) => p.status === 'active').length) },
      { label: 'Milestones cleared', value: `${completion}%` },
      { label: 'Departments', value: String(db.getDepartments().length) }
    ];
  }

  const steps = [
    {
      n: '01',
      title: 'Match on evidence',
      body: 'Compatibility is scored on department, standing, skills and interests — and every score opens to show its arithmetic.'
    },
    {
      n: '02',
      title: 'Build in one place',
      body: 'Milestones, a task board, threaded discussion, files and weekly reports share one workspace per project.'
    },
    {
      n: '03',
      title: 'Review in the loop',
      body: 'Supervisors approve proposals, set deadlines, take attendance and file feedback against the work itself.'
    }
  ];

  const capabilities = [
    { icon: Users, title: 'Team finder', body: 'Filter by department, standing and skill; sort by a score you can inspect.' },
    { icon: Layers, title: 'Task board', body: 'Four columns, priorities, deadlines, assignees and comments.' },
    { icon: MessageSquare, title: 'Discussion', body: 'Decisions and links stay attached to the project, not lost in chat.' },
    { icon: FolderGit2, title: 'Project files', body: 'Specs, diagrams and code drops with versions and upload history.' },
    { icon: FileCheck, title: 'Approvals', body: 'Proposals approved, rejected or returned with the changes needed.' },
    { icon: ShieldCheck, title: 'Administration', body: 'Accounts, departments, analytics, and full data export.' }
  ];

  onMount(() => {
    loadStats();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    // Smooth, weighted scrolling — landing page only; torn down on leave.
    let lenis: { raf: (t: number) => void; destroy: () => void } | null = null;
    let frame = 0;
    let cancelled = false;
    import('lenis').then(({ default: Lenis }) => {
      if (cancelled) return;
      lenis = new Lenis({ lerp: 0.12 });
      const raf = (t: number) => {
        lenis?.raf(t);
        frame = requestAnimationFrame(raf);
      };
      frame = requestAnimationFrame(raf);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      lenis?.destroy();
    };
  });
</script>

<svelte:head>
  <title>TeamForge — Build teams on evidence, not luck</title>
</svelte:head>

<div class="relative min-h-screen bg-background overflow-hidden">
  <header class="sticky top-0 z-40 chrome-blur">
    <div class="max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between gap-4">
      <a href="/" class="flex items-center gap-2.5 rounded-sm" aria-label="TeamForge home">
        <span
          class="chamfer w-8 h-8 bg-accent flex items-center justify-center text-accent-foreground font-display text-xs"
          aria-hidden="true">TF</span
        >
        <span class="font-display text-base text-foreground">TeamForge</span>
      </a>

      <nav aria-label="Sections" class="hidden md:flex items-center gap-8">
        <a href="#how" class="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors rounded-sm">
          How it works
        </a>
        <a href="#platform" class="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors rounded-sm">
          Platform
        </a>
      </nav>

      <div class="flex items-center gap-1.5">
        <button
          onclick={() => themeCtx?.toggleTheme()}
          class="icon-action border-transparent"
          aria-label={themeCtx?.isDark ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {#if themeCtx?.isDark}<Sun class="w-4 h-4" />{:else}<Moon class="w-4 h-4" />{/if}
        </button>
        <a href="/auth" class="hidden sm:block">
          <Button variant="ghost" size="sm">Sign in</Button>
        </a>
        <a href="/auth?tab=register">
          <Button variant="primary" size="sm">Get started</Button>
        </a>
      </div>
    </div>
  </header>

  <main>
    <!-- Hero -->
    <section class="max-w-6xl mx-auto px-5 sm:px-8 pt-10 pb-16 lg:py-0 lg:min-h-[calc(100svh-4rem)] grid lg:grid-cols-[1fr_1.05fr] gap-6 lg:gap-10 items-center">
      <div>
        <p use:reveal class="font-mono text-3xs uppercase tracking-[0.2em] text-accent">
          Capstone team platform
        </p>
        <h1 use:reveal={{ delay: 60 }} class="font-display text-[2.6rem] sm:text-6xl leading-[1.02] text-foreground mt-5">
          Build teams on evidence, not luck.
        </h1>
        <p use:reveal={{ delay: 120 }} class="mt-6 text-base text-muted-foreground max-w-md leading-relaxed">
          Find teammates who fit, run the work on one shared board, and keep faculty review beside
          the project it is about.
        </p>
        <div use:reveal={{ delay: 180 }} class="mt-9 flex flex-wrap items-center gap-3">
          <a href="/auth?tab=register">
            <Button variant="primary" size="lg">
              Start a team
              <ArrowRight class="w-4 h-4" />
            </Button>
          </a>
          <a
            href="/auth"
            class="group inline-flex items-center gap-1.5 h-11 px-3 text-sm font-semibold text-foreground rounded-md"
          >
            Try the demo
            <ArrowUpRight class="w-4 h-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </a>
        </div>
      </div>

      <div use:reveal={{ delay: 120 }} class="relative">
        <ForgeScene class="w-full aspect-square max-h-[560px] mx-auto" />
      </div>
    </section>

    <!-- How it works -->
    <section id="how" class="max-w-6xl mx-auto px-5 sm:px-8 py-20 sm:py-28 scroll-mt-16">
      <div use:reveal class="flex items-end justify-between gap-6 flex-wrap">
        <h2 class="font-display text-3xl sm:text-4xl text-foreground max-w-md leading-tight">
          Three steps, one place.
        </h2>
        <p class="text-sm text-muted-foreground max-w-sm leading-relaxed">
          The same vocabulary for students, supervisors and administrators, from the first match
          to the final review.
        </p>
      </div>
      <div class="rule-accent mt-8" aria-hidden="true"></div>

      <ol class="grid md:grid-cols-3 gap-4 mt-10">
        {#each steps as step, i (step.n)}
          <li use:reveal={{ delay: i * 90 }}>
            <div use:tilt class="h-full rounded-lg border border-border bg-card p-7">
              <span class="font-mono text-xs text-accent tabular">{step.n}</span>
              <h3 class="font-display text-lg text-foreground mt-8">{step.title}</h3>
              <p class="text-sm text-muted-foreground leading-relaxed mt-3">{step.body}</p>
            </div>
          </li>
        {/each}
      </ol>
    </section>

    <!-- Live figures -->
    <section id="platform" class="border-y border-border scroll-mt-16">
      <div class="max-w-6xl mx-auto px-5 sm:px-8 py-14">
        <p class="eyebrow">On this instance right now</p>
        <dl class="grid grid-cols-2 md:grid-cols-4 gap-y-10 gap-x-8 mt-8">
          {#if stats}
            {#each stats as stat, i (stat.label)}
              <div use:reveal={{ delay: i * 70 }} class="flex flex-col-reverse gap-2">
                <dt class="text-xs text-muted-foreground">{stat.label}</dt>
                <dd class="font-display text-4xl sm:text-5xl text-foreground tabular">{stat.value}</dd>
              </div>
            {/each}
          {:else}
            {#each { length: 4 } as _, i (i)}
              <div class="flex flex-col gap-2" aria-hidden="true">
                <div class="skeleton h-11 w-20"></div>
                <div class="skeleton h-3 w-24"></div>
              </div>
            {/each}
          {/if}
        </dl>
      </div>
    </section>

    <!-- Capabilities -->
    <section class="max-w-6xl mx-auto px-5 sm:px-8 py-20 sm:py-28">
      <h2 use:reveal class="font-display text-3xl sm:text-4xl text-foreground max-w-lg leading-tight">
        Everything a capstone team actually needs.
      </h2>
      <ul class="grid sm:grid-cols-2 lg:grid-cols-3 mt-12 border-t border-l border-border">
        {#each capabilities as item, i (item.title)}
          <li
            use:reveal={{ delay: (i % 3) * 70 }}
            class="group border-r border-b border-border p-7 transition-colors hover:bg-card"
          >
            <item.icon
              class="w-5 h-5 text-muted-foreground transition-colors group-hover:text-accent"
              aria-hidden="true"
            />
            <h3 class="text-sm font-bold text-foreground mt-6">{item.title}</h3>
            <p class="mt-1.5 text-xs text-muted-foreground leading-relaxed">{item.body}</p>
          </li>
        {/each}
      </ul>
    </section>

    <!-- Closing -->
    <section class="max-w-6xl mx-auto px-5 sm:px-8 pb-24">
      <div use:reveal class="flex flex-col sm:flex-row sm:items-end justify-between gap-8 border-t border-foreground/80 pt-10">
        <h2 class="font-display text-3xl sm:text-5xl text-foreground max-w-xl leading-[1.05]">
          Your next project starts with the right team.
        </h2>
        <a href="/auth?tab=register" class="shrink-0">
          <Button variant="primary" size="lg">
            Create your account
            <ArrowRight class="w-4 h-4" />
          </Button>
        </a>
      </div>
    </section>
  </main>

  <footer class="border-t border-border">
    <div class="max-w-6xl mx-auto px-5 sm:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
      <p class="text-2xs text-muted-foreground">© 2026 TeamForge · Built for academic teams</p>
      <nav aria-label="Footer" class="flex gap-6">
        <a href="#how" class="text-2xs font-semibold text-muted-foreground hover:text-foreground rounded-sm">How it works</a>
        <a href="/auth" class="text-2xs font-semibold text-muted-foreground hover:text-foreground rounded-sm">Sign in</a>
      </nav>
    </div>
  </footer>
</div>
