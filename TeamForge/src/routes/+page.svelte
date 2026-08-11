<script lang="ts">
  import { onMount, getContext } from 'svelte';
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
    ArrowUpRight,
    Sun,
    Moon
  } from 'lucide-svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';

  const themeCtx = getContext<{ isDark: boolean; toggleTheme: () => void }>('theme');

  let titleRef: HTMLElement;
  let subRef: HTMLElement;
  let buttonsRef: HTMLElement;
  let cardRefs: HTMLElement[] = $state([]);
  let canvasRef: HTMLCanvasElement;
  let destroyCanvasAnim: (() => void) | undefined;

  onMount(async () => {
    // 1. GSAP animations
    const { gsap } = await import('gsap');
    
    gsap.fromTo(titleRef, 
      { opacity: 0, y: 40 }, 
      { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out' }
    );
    
    gsap.fromTo(subRef, 
      { opacity: 0, y: 25 }, 
      { opacity: 1, y: 0, duration: 0.9, delay: 0.25, ease: 'power3.out' }
    );
    
    gsap.fromTo(buttonsRef, 
      { opacity: 0, y: 15 }, 
      { opacity: 1, y: 0, duration: 0.7, delay: 0.45, ease: 'power3.out' }
    );

    gsap.fromTo(cardRefs,
      { opacity: 0, y: 50 },
      { opacity: 1, y: 0, duration: 0.8, delay: 0.6, stagger: 0.12, ease: 'power3.out' }
    );

    // 2. Lenis smooth scroll
    const LenisModule = await import('lenis');
    const Lenis = LenisModule.default || LenisModule;
    const lenis = new Lenis();
    
    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    // 3. Dot-matrix background animation
    if (canvasRef) {
      const ctx = canvasRef.getContext('2d')!;
      let width = canvasRef.width = window.innerWidth;
      let height = canvasRef.height = window.innerHeight;

      // Create Grid particles
      const gap = 38;
      let cols = Math.floor(width / gap) + 1;
      let rows = Math.floor(height / gap) + 1;
      let particles: Array<{x: number; y: number; baseX: number; baseY: number; size: number}> = [];

      function initGrid() {
        width = canvasRef.width = window.innerWidth;
        height = canvasRef.height = window.innerHeight;
        cols = Math.floor(width / gap) + 1;
        rows = Math.floor(height / gap) + 1;
        particles = [];
        
        for (let i = 0; i < cols; i++) {
          for (let j = 0; j < rows; j++) {
            particles.push({
              x: i * gap,
              y: j * gap,
              baseX: i * gap,
              baseY: j * gap,
              size: 1.0
            });
          }
        }
      }

      initGrid();
      window.addEventListener('resize', initGrid);

      let mouse = { x: -1000, y: -1000 };
      window.addEventListener('mousemove', (e) => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
      });

      let time = 0;
      let animationFrameId: number;

      function render() {
        ctx.clearRect(0, 0, width, height);
        time += 0.012;

        const isDarkTheme = document.documentElement.classList.contains('dark');
        const particleColor = isDarkTheme ? '250, 250, 250' : '24, 24, 27'; // Zinc Light vs Zinc Dark

        particles.forEach(p => {
          // Slow breathing pulse
          const breathing = Math.sin(time + p.baseX * 0.005 + p.baseY * 0.005) * 0.5 + 0.5;
          
          // Pointer displacement drift
          const dx = mouse.x - p.x;
          const dy = mouse.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          let forceX = 0;
          let forceY = 0;

          if (dist < 180) {
            const force = (180 - dist) / 180;
            // Pull particles slightly towards the cursor
            forceX = dx * force * 0.12;
            forceY = dy * force * 0.12;
          }

          const targetX = p.baseX + forceX;
          const targetY = p.baseY + forceY;

          p.x += (targetX - p.x) * 0.08;
          p.y += (targetY - p.y) * 0.08;

          ctx.fillStyle = `rgba(${particleColor}, ${0.06 + breathing * 0.12})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size + breathing * 0.6, 0, Math.PI * 2);
          ctx.fill();
        });

        animationFrameId = requestAnimationFrame(render);
      }

      render();

      destroyCanvasAnim = () => {
        window.removeEventListener('resize', initGrid);
        cancelAnimationFrame(animationFrameId);
      };
    }
  });

  onMount(() => {
    return () => destroyCanvasAnim?.();
  });
</script>

<div class="relative min-h-screen bg-background overflow-hidden">
  
  <!-- Full-bleed background interactive Canvas -->
  <canvas 
    bind:this={canvasRef} 
    class="fixed inset-0 w-full h-full pointer-events-none" 
    style="z-index: 1;"
  ></canvas>

  <!-- Glowing Blurs -->
  <div class="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-accent/15 rounded-full blur-[140px] pointer-events-none animate-pulse-slow z-0"></div>
  <div class="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-info/10 rounded-full blur-[140px] pointer-events-none animate-pulse-slow z-0"></div>

  <!-- Landing Navbar -->
  <header class="sticky top-0 z-40 border-b border-border/40 backdrop-blur-md bg-background/60" style="z-index: 10;">
    <div class="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="chamfer w-9 h-9 bg-accent flex items-center justify-center text-accent-foreground font-display text-base shadow-lg">
          TF
        </div>
        <span class="font-display text-xl text-foreground">TeamForge</span>
      </div>

      <nav class="hidden md:flex items-center gap-8">
        <a href="#features" class="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Features</a>
        <a href="#stats" class="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Platform Stats</a>
        <a href="#about" class="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">About Us</a>
      </nav>

      <div class="flex items-center gap-3">
        <button
          onclick={() => themeCtx?.toggleTheme()}
          class="p-2 rounded-md border border-border hover:bg-secondary transition-colors cursor-pointer text-foreground"
          aria-label="Toggle Theme"
        >
          {#if themeCtx?.isDark}
            <Sun class="w-4 h-4 text-accent" />
          {:else}
            <Moon class="w-4 h-4" />
          {/if}
        </button>

        <a href="/auth">
          <Button variant="outline" size="sm" class="hidden sm:inline-flex">Sign In</Button>
        </a>
        <a href="/auth?tab=register">
          <Button variant="primary" size="sm">Get Started</Button>
        </a>
      </div>
    </div>
  </header>

  <!-- Hero Section -->
  <section class="max-w-7xl mx-auto px-6 pt-24 pb-28 text-center relative" style="z-index: 10;">
    <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-accent/30 bg-accent/8 text-accent font-mono text-2xs font-semibold mb-8 uppercase tracking-widest">
      <Sparkles class="w-3.5 h-3.5" />
      Intelligent Teammate Recommendation Algorithm
    </div>

    <h1
      bind:this={titleRef}
      class="font-display text-5xl md:text-7xl text-foreground max-w-4xl mx-auto leading-[1.05]"
    >
      Build teams the way you build <span class="text-accent">anything worth building</span>.
    </h1>

    <p
      bind:this={subRef}
      class="mt-8 text-base md:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed"
    >
      Form project teams dynamically, track tasks on smart boards, converse in threads, share files, and monitor milestones — all backed by a matching score you can see the reasoning behind.
    </p>

    <div
      bind:this={buttonsRef}
      class="mt-10 flex flex-wrap justify-center gap-4"
    >
      <a href="/auth?tab=register">
        <Button variant="primary" size="lg">
          Find Teammates Now
          <ArrowRight class="w-4 h-4" />
        </Button>
      </a>
      <a href="/auth">
        <Button variant="outline" size="lg">
          Explore Projects
        </Button>
      </a>
    </div>

    <!-- Feature Grid Cards -->
    <div class="mt-24 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
      <div bind:this={cardRefs[0]}>
        <Card hoverable glass class="h-full flex flex-col justify-between">
          <div>
            <div class="w-11 h-11 rounded-md bg-accent/10 flex items-center justify-center text-accent mb-5">
              <Cpu class="w-5 h-5" />
            </div>
            <h3 class="font-display text-base text-foreground mb-2">Smart Compatibility Matching</h3>
            <p class="text-xs text-muted-foreground leading-relaxed">
              Find partners automatically based on skill vectors, class standing, departmental overlap, and availability metrics.
            </p>
          </div>
          <div class="mt-6 pt-4 border-t border-border/40 flex items-center justify-between text-2xs text-accent font-bold">
            <span>Explore Finder</span>
            <ArrowUpRight class="w-3.5 h-3.5" />
          </div>
        </Card>
      </div>

      <div bind:this={cardRefs[1]}>
        <Card hoverable glass class="h-full flex flex-col justify-between">
          <div>
            <div class="w-11 h-11 rounded-md bg-info/10 flex items-center justify-center text-info mb-5">
              <Layers class="w-5 h-5" />
            </div>
            <h3 class="font-display text-base text-foreground mb-2">Kanban Task Tracker</h3>
            <p class="text-xs text-muted-foreground leading-relaxed">
              Track project milestones, tasks, dependencies, priorities, comments, and file cards inside collaborative workspace lanes.
            </p>
          </div>
          <div class="mt-6 pt-4 border-t border-border/40 flex items-center justify-between text-2xs text-info font-bold">
            <span>Explore Kanban</span>
            <ArrowUpRight class="w-3.5 h-3.5" />
          </div>
        </Card>
      </div>

      <div bind:this={cardRefs[2]}>
        <Card hoverable glass class="h-full flex flex-col justify-between">
          <div>
            <div class="w-11 h-11 rounded-md bg-secondary flex items-center justify-center text-foreground mb-5">
              <ShieldCheck class="w-5 h-5" />
            </div>
            <h3 class="font-display text-base text-foreground mb-2">Faculty & Admin Overviews</h3>
            <p class="text-xs text-muted-foreground leading-relaxed">
              Faculty members verify project scopes, monitor task progress analytics, and approve team submissions easily.
            </p>
          </div>
          <div class="mt-6 pt-4 border-t border-border/40 flex items-center justify-between text-2xs text-foreground font-bold">
            <span>Explore Monitoring</span>
            <ArrowUpRight class="w-3.5 h-3.5" />
          </div>
        </Card>
      </div>
    </div>
  </section>

  <!-- Stats Showcase Section -->
  <section id="stats" class="border-y border-border/40 bg-muted/20 relative py-16" style="z-index: 10;">
    <div class="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
      <div>
        <div class="font-display text-4xl md:text-5xl text-foreground">1,200+</div>
        <div class="text-xs font-semibold text-muted-foreground uppercase tracking-widest mt-2">Active Students</div>
      </div>
      <div>
        <div class="font-display text-4xl md:text-5xl text-accent">340+</div>
        <div class="text-xs font-semibold text-muted-foreground uppercase tracking-widest mt-2">Teams Formed</div>
      </div>
      <div>
        <div class="font-display text-4xl md:text-5xl text-foreground">98%</div>
        <div class="text-xs font-semibold text-muted-foreground uppercase tracking-widest mt-2">Completion Rate</div>
      </div>
      <div>
        <div class="font-display text-4xl md:text-5xl text-accent">15+</div>
        <div class="text-xs font-semibold text-muted-foreground uppercase tracking-widest mt-2">Supported Departments</div>
      </div>
    </div>
  </section>

  <!-- Detailed Features Section -->
  <section id="features" class="max-w-7xl mx-auto px-6 py-24 relative" style="z-index: 10;">
    <div class="text-center max-w-2xl mx-auto mb-16">
      <h2 class="font-display text-3xl text-foreground sm:text-4xl">
        All-in-One Collaboration Hub
      </h2>
      <p class="mt-4 text-sm text-muted-foreground leading-relaxed">
        Everything you need to successfully execute academic assignments, capstone programs, and research proposals.
      </p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      <div class="flex gap-4">
        <div class="shrink-0 w-10 h-10 rounded-md bg-accent/10 text-accent flex items-center justify-center">
          <Users class="w-5 h-5" />
        </div>
        <div>
          <h4 class="text-sm font-bold text-foreground">Rule-Based Team Finder</h4>
          <p class="mt-2 text-xs text-muted-foreground leading-relaxed">
            Analyzes year, skill sets, overlaps, and department tags to find classmates with matching academic goals.
          </p>
        </div>
      </div>

      <div class="flex gap-4">
        <div class="shrink-0 w-10 h-10 rounded-md bg-info/10 text-info flex items-center justify-center">
          <Layers class="w-5 h-5" />
        </div>
        <div>
          <h4 class="text-sm font-bold text-foreground">Interactive Kanban Boards</h4>
          <p class="mt-2 text-xs text-muted-foreground leading-relaxed">
            Move tasks across To Do, In Progress, Review, and Completed columns. Log comments, timelines, and priority status.
          </p>
        </div>
      </div>

      <div class="flex gap-4">
        <div class="shrink-0 w-10 h-10 rounded-md bg-secondary text-foreground flex items-center justify-center">
          <MessageSquare class="w-5 h-5" />
        </div>
        <div>
          <h4 class="text-sm font-bold text-foreground">Threaded Discussions</h4>
          <p class="mt-2 text-xs text-muted-foreground leading-relaxed">
            Engage in project brainstorming sessions. Support multiple channels, replies, markdown text, and mentions.
          </p>
        </div>
      </div>

      <div class="flex gap-4">
        <div class="shrink-0 w-10 h-10 rounded-md bg-success/10 text-success flex items-center justify-center">
          <FolderGit2 class="w-5 h-5" />
        </div>
        <div>
          <h4 class="text-sm font-bold text-foreground">Project File Storage</h4>
          <p class="mt-2 text-xs text-muted-foreground leading-relaxed">
            Keep track of PDF guidelines, images, and codebase drafts, stored right in the browser with full version history.
          </p>
        </div>
      </div>

      <div class="flex gap-4">
        <div class="shrink-0 w-10 h-10 rounded-md bg-warning/10 text-warning flex items-center justify-center">
          <FileCheck class="w-5 h-5" />
        </div>
        <div>
          <h4 class="text-sm font-bold text-foreground">Faculty Approval Flows</h4>
          <p class="mt-2 text-xs text-muted-foreground leading-relaxed">
            Faculty monitors teams, views performance metrics, handles pending proposals, and issues announcement updates.
          </p>
        </div>
      </div>

      <div class="flex gap-4">
        <div class="shrink-0 w-10 h-10 rounded-md bg-secondary text-foreground flex items-center justify-center">
          <ShieldCheck class="w-5 h-5" />
        </div>
        <div>
          <h4 class="text-sm font-bold text-foreground">Admin Controls</h4>
          <p class="mt-2 text-xs text-muted-foreground leading-relaxed">
            Manage student databases, register department catalogs, adjust parameters, and review system-wide audit reports.
          </p>
        </div>
      </div>
    </div>
  </section>

  <!-- CTA section -->
  <section class="max-w-6xl mx-auto px-6 mb-24 relative" style="z-index: 10;">
    <div class="rounded-lg border border-accent/25 bg-muted/30 p-12 text-center flex flex-col items-center max-w-4xl mx-auto glass-card">
      <h2 class="font-display text-2xl md:text-3xl text-foreground">
        Ready to build your next big project?
      </h2>
      <p class="mt-4 text-xs text-muted-foreground max-w-xl">
        Register in seconds, pick your academic department, and join forces with fellow students today.
      </p>
      <div class="mt-8">
        <a href="/auth?tab=register">
          <Button variant="primary" size="lg">
            Create Free Account
            <ArrowRight class="w-4 h-4" />
          </Button>
        </a>
      </div>
    </div>
  </section>

  <!-- Footer -->
  <footer class="border-t border-border/40 py-12 bg-muted/10 relative" style="z-index: 10;">
    <div class="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
      <div class="flex items-center gap-3">
        <div class="chamfer w-8 h-8 bg-accent flex items-center justify-center text-accent-foreground font-display text-xs">
          TF
        </div>
        <span class="font-display text-base text-foreground">TeamForge</span>
      </div>
      <p class="text-xs text-muted-foreground">
        © 2026 TeamForge. Crafted for Academic Excellence.
      </p>
      <div class="flex gap-4">
        <a href="#features" class="text-3xs text-muted-foreground hover:text-foreground">Terms</a>
        <a href="#stats" class="text-3xs text-muted-foreground hover:text-foreground">Privacy</a>
      </div>
    </div>
  </footer>
</div>
