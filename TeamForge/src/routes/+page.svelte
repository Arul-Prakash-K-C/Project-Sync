<script lang="ts">
  import { onMount, getContext } from 'svelte';
  import { db } from '$lib/services/db';
  import {
    Users,
    Sparkles,
    ArrowRight,
    Layers,
    MessageSquare,
    FolderGit2,
    FileCheck,
    ShieldCheck,
    Cpu,
    Sun,
    Moon,
    Menu,
    X
  } from 'lucide-svelte';
  import Button from '$lib/components/ui/Button.svelte';

  const themeCtx = getContext<{ isDark: boolean; toggleTheme: () => void }>('theme');

  let titleRef: HTMLElement;
  let subRef: HTMLElement;
  let buttonsRef: HTMLElement;
  let cardRefs: HTMLElement[] = $state([]);
  let canvasRef: HTMLCanvasElement;
  let destroyCanvasAnim: (() => void) | undefined;
  let mobileNavOpen = $state(false);

  /*
    The figures below are read from the platform's own store rather than being
    written into the markup. A landing page that claims "1,200+ students" while
    the product knows exactly how many it has is quietly lying to its visitors.
    They load on mount because the store is browser-local.
  */
  let stats = $state<{ label: string; value: string }[] | null>(null);

  function loadStats() {
    const users = db.getUsers();
    const projects = db.getProjects();
    const departments = db.getDepartments();
    const allMilestones = projects.flatMap((p) => p.milestones);
    const completion =
      allMilestones.length > 0
        ? Math.round((allMilestones.filter((m) => m.completed).length / allMilestones.length) * 100)
        : 0;

    stats = [
      { label: 'Registered students', value: String(users.filter((u) => u.role === 'student').length) },
      { label: 'Teams formed', value: String(projects.filter((p) => p.status === 'active').length) },
      { label: 'Milestones cleared', value: `${completion}%` },
      { label: 'Departments', value: String(departments.length) }
    ];
  }

  const featureCards = [
    {
      icon: Cpu,
      tone: 'bg-accent/12 text-accent',
      title: 'Explainable matching',
      body: 'Compatibility is scored on department, standing, shared skills and interests — and every score opens to show the arithmetic behind it.'
    },
    {
      icon: Layers,
      tone: 'bg-info/12 text-info',
      title: 'One workspace per project',
      body: 'Milestones, a task board, threaded discussion, files and weekly reports live together, so nothing about a project lives somewhere else.'
    },
    {
      icon: ShieldCheck,
      tone: 'bg-success/12 text-success',
      title: 'Faculty in the loop',
      body: 'Supervisors approve proposals, set deadlines, review weekly progress and file categorised feedback against the work itself.'
    }
  ];

  const capabilities = [
    {
      icon: Users,
      tone: 'bg-accent/12 text-accent',
      title: 'Rule-based team finder',
      body: 'Filter by department, standing and skill, then sort by a compatibility score you can inspect.'
    },
    {
      icon: Layers,
      tone: 'bg-info/12 text-info',
      title: 'Task board',
      body: 'To do, in progress, review and completed — with priorities, deadlines, assignees and comments.'
    },
    {
      icon: MessageSquare,
      tone: 'bg-secondary text-foreground',
      title: 'Threaded discussion',
      body: 'Keep decisions and links attached to the project instead of scattered across chat apps.'
    },
    {
      icon: FolderGit2,
      tone: 'bg-success/12 text-success',
      title: 'Project files',
      body: 'Specs, diagrams and code drops stored with version numbers and upload history.'
    },
    {
      icon: FileCheck,
      tone: 'bg-warning/12 text-warning',
      title: 'Approval workflow',
      body: 'Proposals are approved, rejected or sent back with the changes a supervisor needs.'
    },
    {
      icon: ShieldCheck,
      tone: 'bg-secondary text-foreground',
      title: 'Administration',
      body: 'Manage accounts and departments, and export or restore the whole dataset.'
    }
  ];

  onMount(() => {
    loadStats();

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;

    let cancelled = false;

    (async () => {
      // 1. Entrance animation
      const { gsap } = await import('gsap');
      if (cancelled) return;

      gsap.fromTo(titleRef, { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' });
      gsap.fromTo(
        subRef,
        { opacity: 0, y: 18 },
        { opacity: 1, y: 0, duration: 0.7, delay: 0.15, ease: 'power3.out' }
      );
      gsap.fromTo(
        buttonsRef,
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.6, delay: 0.3, ease: 'power3.out' }
      );
      gsap.fromTo(
        cardRefs,
        { opacity: 0, y: 28 },
        { opacity: 1, y: 0, duration: 0.6, delay: 0.4, stagger: 0.1, ease: 'power3.out' }
      );

      // 2. Lenis smooth scroll
      const LenisModule = await import('lenis');
      if (cancelled) return;
      const Lenis = LenisModule.default || LenisModule;
      const lenis = new Lenis();

      function raf(time: number) {
        lenis.raf(time);
        requestAnimationFrame(raf);
      }
      requestAnimationFrame(raf);
    })();

    // 3. Dot-matrix backdrop — a drafting grid that responds to the pointer.
    if (canvasRef) {
      const ctx = canvasRef.getContext('2d')!;
      let width = (canvasRef.width = window.innerWidth);
      let height = (canvasRef.height = window.innerHeight);

      const gap = 38;
      let particles: Array<{ x: number; y: number; baseX: number; baseY: number; size: number }> = [];

      function initGrid() {
        width = canvasRef.width = window.innerWidth;
        height = canvasRef.height = window.innerHeight;
        const cols = Math.floor(width / gap) + 1;
        const rows = Math.floor(height / gap) + 1;
        particles = [];

        for (let i = 0; i < cols; i++) {
          for (let j = 0; j < rows; j++) {
            particles.push({ x: i * gap, y: j * gap, baseX: i * gap, baseY: j * gap, size: 1.0 });
          }
        }
      }

      initGrid();
      window.addEventListener('resize', initGrid);

      const mouse = { x: -1000, y: -1000 };
      function onMouseMove(e: MouseEvent) {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
      }
      window.addEventListener('mousemove', onMouseMove);

      let time = 0;
      let animationFrameId: number;

      function render() {
        ctx.clearRect(0, 0, width, height);
        time += 0.012;

        const isDarkTheme = document.documentElement.classList.contains('dark');
        const particleColor = isDarkTheme ? '237, 239, 243' : '18, 21, 28';

        particles.forEach((p) => {
          const breathing = Math.sin(time + p.baseX * 0.005 + p.baseY * 0.005) * 0.5 + 0.5;

          const dx = mouse.x - p.x;
          const dy = mouse.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          let forceX = 0;
          let forceY = 0;

          if (dist < 180) {
            const force = (180 - dist) / 180;
            forceX = dx * force * 0.12;
            forceY = dy * force * 0.12;
          }

          p.x += (p.baseX + forceX - p.x) * 0.08;
          p.y += (p.baseY + forceY - p.y) * 0.08;

          ctx.fillStyle = `rgba(${particleColor}, ${0.05 + breathing * 0.09})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size + breathing * 0.5, 0, Math.PI * 2);
          ctx.fill();
        });

        animationFrameId = requestAnimationFrame(render);
      }

      render();

      destroyCanvasAnim = () => {
        window.removeEventListener('resize', initGrid);
        window.removeEventListener('mousemove', onMouseMove);
        cancelAnimationFrame(animationFrameId);
      };
    }

    return () => {
      cancelled = true;
      destroyCanvasAnim?.();
    };
  });
</script>

<div class="relative min-h-screen bg-background">
  <!-- Decorative backdrop; skipped entirely under reduced-motion. -->
  <canvas
    bind:this={canvasRef}
    aria-hidden="true"
    class="fixed inset-0 w-full h-full pointer-events-none z-0"
  ></canvas>

  <!-- Landing Navbar -->
  <header class="sticky top-0 z-40 border-b border-border chrome-blur">
    <div class="max-w-7xl mx-auto px-5 sm:px-6 h-16 flex items-center justify-between gap-4">
      <a href="/" class="flex items-center gap-2.5 rounded-sm" aria-label="TeamForge home">
        <span
          class="chamfer w-9 h-9 bg-accent flex items-center justify-center text-accent-foreground font-display text-sm"
          aria-hidden="true">TF</span
        >
        <span class="font-display text-lg text-foreground">TeamForge</span>
      </a>

      <nav aria-label="Sections" class="hidden md:flex items-center gap-7">
        <a href="#features" class="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors rounded-sm">
          Features
        </a>
        <a href="#platform" class="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors rounded-sm">
          Platform
        </a>
        <a href="#about" class="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors rounded-sm">
          About
        </a>
      </nav>

      <div class="flex items-center gap-2">
        <button
          onclick={() => themeCtx?.toggleTheme()}
          class="icon-action"
          aria-label={themeCtx?.isDark ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {#if themeCtx?.isDark}
            <Sun class="w-4 h-4" />
          {:else}
            <Moon class="w-4 h-4" />
          {/if}
        </button>

        <a href="/auth" class="hidden sm:block">
          <Button variant="outline" size="sm">Sign in</Button>
        </a>
        <a href="/auth?tab=register">
          <Button variant="primary" size="sm">Get started</Button>
        </a>

        <button
          onclick={() => (mobileNavOpen = !mobileNavOpen)}
          class="icon-action md:hidden"
          aria-label="Toggle section navigation"
          aria-expanded={mobileNavOpen}
        >
          {#if mobileNavOpen}
            <X class="w-4 h-4" />
          {:else}
            <Menu class="w-4 h-4" />
          {/if}
        </button>
      </div>
    </div>

    {#if mobileNavOpen}
      <nav aria-label="Sections" class="md:hidden border-t border-border px-5 py-3 flex flex-col gap-1 bg-card">
        <a href="#features" onclick={() => (mobileNavOpen = false)} class="py-2 text-sm font-semibold text-foreground rounded-sm">
          Features
        </a>
        <a href="#platform" onclick={() => (mobileNavOpen = false)} class="py-2 text-sm font-semibold text-foreground rounded-sm">
          Platform
        </a>
        <a href="#about" onclick={() => (mobileNavOpen = false)} class="py-2 text-sm font-semibold text-foreground rounded-sm">
          About
        </a>
        <a href="/auth" class="py-2 text-sm font-semibold text-accent rounded-sm">Sign in</a>
      </nav>
    {/if}
  </header>

  <main class="relative z-10">
    <!-- Hero -->
    <section class="max-w-4xl mx-auto px-5 sm:px-6 pt-20 pb-20 sm:pt-28 sm:pb-24 text-center">
      <p
        class="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-accent/30 bg-accent/8
          text-accent font-mono text-3xs font-semibold uppercase tracking-widest"
      >
        <Sparkles class="w-3.5 h-3.5" aria-hidden="true" />
        Intelligent teammate recommendation
      </p>

      <h1
        bind:this={titleRef}
        class="font-display text-4xl sm:text-5xl lg:text-6xl text-foreground leading-[1.08] mt-7"
      >
        Build teams the way you build
        <span class="text-accent">anything worth building</span>.
      </h1>

      <p
        bind:this={subRef}
        class="mt-6 text-base text-muted-foreground max-w-xl mx-auto leading-relaxed"
      >
        Form project teams on evidence rather than luck, track the work on a shared board, and keep
        faculty review in the same place as the project.
      </p>

      <div bind:this={buttonsRef} class="mt-9 flex flex-wrap justify-center gap-3">
        <a href="/auth?tab=register">
          <Button variant="primary" size="lg">
            Get started
            <ArrowRight class="w-4 h-4" />
          </Button>
        </a>
        <a href="/auth">
          <Button variant="outline" size="lg">Sign in</Button>
        </a>
      </div>
    </section>

    <!-- Three pillars -->
    <section id="features" class="max-w-6xl mx-auto px-5 sm:px-6 pb-20 sm:pb-24 scroll-mt-20">
      <ul class="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
        {#each featureCards as card, i (card.title)}
          <li bind:this={cardRefs[i]}>
            <div class="h-full rounded-lg border border-border bg-card p-6 shadow-e1">
              <span
                class="w-10 h-10 rounded-md flex items-center justify-center {card.tone}"
                aria-hidden="true"
              >
                <card.icon class="w-5 h-5" />
              </span>
              <h2 class="font-display text-base text-foreground mt-5">{card.title}</h2>
              <p class="text-xs text-muted-foreground leading-relaxed mt-2">{card.body}</p>
            </div>
          </li>
        {/each}
      </ul>
    </section>

    <!-- Live platform numbers -->
    <section id="platform" class="border-y border-border bg-secondary/40 py-14 scroll-mt-20">
      <div class="max-w-6xl mx-auto px-5 sm:px-6">
        <h2 class="eyebrow text-center">On this instance right now</h2>
        <dl class="grid grid-cols-2 md:grid-cols-4 gap-8 text-center mt-6">
          {#if stats}
            {#each stats as stat (stat.label)}
              <div>
                <dd class="font-display text-3xl sm:text-4xl text-foreground tabular">{stat.value}</dd>
                <dt class="text-2xs font-semibold text-muted-foreground uppercase tracking-widest mt-2">
                  {stat.label}
                </dt>
              </div>
            {/each}
          {:else}
            {#each { length: 4 } as _, i (i)}
              <div class="flex flex-col items-center gap-2" aria-hidden="true">
                <div class="skeleton h-9 w-16"></div>
                <div class="skeleton h-3 w-24"></div>
              </div>
            {/each}
          {/if}
        </dl>
      </div>
    </section>

    <!-- Capability grid -->
    <section class="max-w-6xl mx-auto px-5 sm:px-6 py-20 sm:py-24">
      <div class="max-w-xl mb-12">
        <h2 class="font-display text-2xl sm:text-3xl text-foreground">
          Everything a capstone team actually needs
        </h2>
        <p class="mt-3 text-sm text-muted-foreground leading-relaxed">
          Six pieces of a project's life, in one place, with the same vocabulary for students, faculty
          and administrators.
        </p>
      </div>

      <ul class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-9">
        {#each capabilities as item (item.title)}
          <li class="flex gap-4">
            <span
              class="shrink-0 w-10 h-10 rounded-md flex items-center justify-center {item.tone}"
              aria-hidden="true"
            >
              <item.icon class="w-5 h-5" />
            </span>
            <div>
              <h3 class="text-sm font-bold text-foreground">{item.title}</h3>
              <p class="mt-1.5 text-xs text-muted-foreground leading-relaxed">{item.body}</p>
            </div>
          </li>
        {/each}
      </ul>
    </section>

    <!-- Closing -->
    <section id="about" class="max-w-4xl mx-auto px-5 sm:px-6 pb-24 scroll-mt-20">
      <div class="rounded-lg border border-border bg-card p-10 sm:p-12 text-center shadow-e1">
        <h2 class="font-display text-2xl sm:text-3xl text-foreground">
          Ready to build your next project?
        </h2>
        <p class="mt-4 text-sm text-muted-foreground max-w-lg mx-auto leading-relaxed">
          TeamForge was built for academic capstone work: register with your department, set out your
          skills, and start matching with classmates in a couple of minutes.
        </p>
        <div class="mt-8">
          <a href="/auth?tab=register">
            <Button variant="primary" size="lg">
              Create your account
              <ArrowRight class="w-4 h-4" />
            </Button>
          </a>
        </div>
      </div>
    </section>
  </main>

  <footer class="relative z-10 border-t border-border py-10">
    <div
      class="max-w-7xl mx-auto px-5 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4"
    >
      <a href="/" class="flex items-center gap-2.5 rounded-sm">
        <span
          class="chamfer w-8 h-8 bg-accent flex items-center justify-center text-accent-foreground font-display text-xs"
          aria-hidden="true">TF</span
        >
        <span class="font-display text-base text-foreground">TeamForge</span>
      </a>

      <p class="text-2xs text-muted-foreground">© 2026 TeamForge · Built for academic teams</p>

      <nav aria-label="Footer" class="flex gap-5">
        <a href="#features" class="text-2xs font-semibold text-muted-foreground hover:text-foreground rounded-sm">
          Features
        </a>
        <a href="#platform" class="text-2xs font-semibold text-muted-foreground hover:text-foreground rounded-sm">
          Platform
        </a>
        <a href="/auth" class="text-2xs font-semibold text-muted-foreground hover:text-foreground rounded-sm">
          Sign in
        </a>
      </nav>
    </div>
  </footer>
</div>
