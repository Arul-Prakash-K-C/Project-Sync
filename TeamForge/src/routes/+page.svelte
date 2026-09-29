<script lang="ts">
  import { onMount, getContext } from 'svelte';
  import { db } from '$lib/services/db';
  import { inView, magnetic } from '$lib/actions/forge';
  import ForgeScene from '$lib/components/three/ForgeScene.svelte';
  import EmberCursor from '$lib/components/EmberCursor.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Odometer from '$lib/components/ui/Odometer.svelte';
  import BrandLogo from '$lib/components/BrandLogo.svelte';
  import {
    ArrowRight,
    ArrowUpRight,
    ArrowDown,
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

  const headline = 'Build teams on evidence, not luck.'.split(' ');

  /* The three steps are the three states of the forge: drawn, heated, finished. */
  const steps = [
    {
      n: '01',
      stage: 'blueprint',
      tag: 'Blueprint',
      title: 'Match on evidence',
      body: 'A skill graph scores every classmate on common ground, the gaps they fill and what your project still needs, and every score opens to show its arithmetic.'
    },
    {
      n: '02',
      stage: 'heat',
      tag: 'Heat',
      title: 'Build in one place',
      body: 'Milestones, a drag-and-drop task board, threaded discussion, files and weekly reports share one workspace per project.'
    },
    {
      n: '03',
      stage: 'forged',
      tag: 'Forged',
      title: 'Review in the loop',
      body: 'Mentors approve proposals, set deadlines, take attendance and see an explainable risk score for every team they supervise.'
    }
  ];

  const capabilities = [
    { icon: Users, title: 'Team finder', body: 'Filter by department, standing and skill; flip any match to see the evidence.' },
    { icon: Layers, title: 'Task board', body: 'Drag tickets across a forge line from to-do to quenched and done.' },
    { icon: MessageSquare, title: 'Discussion', body: 'Decisions and links stay attached to the project, not lost in chat.' },
    { icon: FolderGit2, title: 'Project files', body: 'Specs, diagrams and code drops with versions and upload history.' },
    { icon: FileCheck, title: 'Approvals', body: 'Proposals approved, rejected or returned with the changes needed.' },
    { icon: ShieldCheck, title: 'Team risk', body: 'Burndown, activity and a six-factor risk score for every team.' }
  ];

  let heroIn = $state(false);
  let statsIn = $state(false);
  let capsIn = $state(false);
  let howIn = $state(false);
  let deckEl = $state<HTMLOListElement | null>(null);
  let rail = $state<HTMLDivElement | null>(null);

  onMount(() => {
    loadStats();
    heroIn = true;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /*
      Scroll-linked choreography, computed once per frame:
      - each step card sinks back (scales, dims) as the next one slides over it;
      - the heat rail fills with how far down the page you are.
    */
    let ticking = false;
    const update = () => {
      ticking = false;
      const doc = document.documentElement;
      const progress = doc.scrollTop / Math.max(1, doc.scrollHeight - window.innerHeight);
      rail?.style.setProperty('--progress', String(Math.min(1, Math.max(0, progress))));
      if (!deckEl || reduced) return;
      const cards = Array.from(deckEl.querySelectorAll<HTMLElement>('.deck-card'));
      cards.forEach((card, i) => {
        const next = cards[i + 1];
        if (!next) return card.style.setProperty('--p', '0');
        const stickTop = parseFloat(getComputedStyle(next).top) || 0;
        const distance = next.getBoundingClientRect().top - stickTop;
        const p = Math.min(1, Math.max(0, 1 - distance / card.offsetHeight));
        card.style.setProperty('--p', p.toFixed(3));
      });
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();

    if (reduced) {
      return () => {
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', onScroll);
      };
    }

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
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  });
</script>

<svelte:head>
  <title>Project-Sync — Build teams on evidence, not luck</title>
</svelte:head>

<EmberCursor />

<!-- Heat rail: fills with scroll progress, a coal glowing at its tip. -->
<div bind:this={rail} class="heat-rail hidden md:block" aria-hidden="true"><div class="heat-rail-fill"></div></div>

<div class="relative min-h-screen bg-background overflow-x-clip">
  <header class="sticky top-0 z-40 chrome-blur">
    <div class="max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between gap-4">
      <a href="/" class="flex items-center rounded-sm" aria-label="Project-Sync home">
        <BrandLogo size="sm" />
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
        <a href="/auth?tab=register" use:magnetic={{ strength: 0.2 }} class="inline-block">
          <Button variant="primary" size="sm">Get started</Button>
        </a>
      </div>
    </div>
  </header>

  <main>
    <!-- Hero: the headline arrives white-hot and cools to ink. -->
    <section
      class="max-w-6xl mx-auto px-5 sm:px-8 pt-10 pb-16 lg:py-0 lg:min-h-[calc(100svh-4rem)] grid lg:grid-cols-[1fr_1.05fr] gap-6 lg:gap-10 items-center relative"
    >
      <div>
        <p class="font-mono text-3xs uppercase tracking-[0.2em] text-accent inline-flex items-center gap-2">
          <span class="relative flex w-1.5 h-1.5" aria-hidden="true">
            <span class="absolute inset-0 rounded-full bg-accent animate-ping opacity-60"></span>
            <span class="relative w-1.5 h-1.5 rounded-full bg-accent"></span>
          </span>
          Capstone team platform
        </p>
        <h1 class="font-display text-[2.6rem] sm:text-6xl leading-[1.04] text-foreground mt-5" aria-label={headline.join(' ')}>
          {#if heroIn}
            {#each headline as word, i (i)}
              <span class="heat-word" style="--w: {i}" aria-hidden="true"><span>{word}</span></span>{' '}
            {/each}
          {:else}
            <span class="opacity-0">{headline.join(' ')}</span>
          {/if}
        </h1>
        <p class="mt-6 text-base text-muted-foreground max-w-md leading-relaxed fade-up" data-in={heroIn || undefined} style="--delay: 650ms">
          Find teammates who fit, run the work on one shared board, and keep faculty review beside the project it
          is about.
        </p>
        <div class="mt-9 flex flex-wrap items-center gap-3 fade-up" data-in={heroIn || undefined} style="--delay: 800ms">
          <a href="/auth?tab=register" use:magnetic class="inline-block">
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
            <ArrowUpRight
              class="w-4 h-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
            />
          </a>
        </div>
      </div>

      <div class="relative fade-up" data-in={heroIn || undefined} style="--delay: 300ms" data-cursor="drag">
        <ForgeScene class="w-full aspect-square max-h-[560px] mx-auto" />
      </div>

      <a
        href="#how"
        class="hidden lg:inline-flex absolute left-8 bottom-8 items-center gap-2 font-mono text-3xs uppercase tracking-[0.2em] text-muted-foreground hover:text-accent transition-colors rounded-sm fade-up"
        data-in={heroIn || undefined}
        style="--delay: 1400ms"
      >
        <ArrowDown class="w-3.5 h-3.5 animate-bounce" aria-hidden="true" />
        Scroll to see how it works
      </a>
    </section>

    <!-- How it works: a deck of three plates. Each new step slides over the
         last, which sinks back; the plates go from blueprint to heat to forged. -->
    <section id="how" class="max-w-6xl mx-auto px-5 sm:px-8 pt-20 sm:pt-28 scroll-mt-16">
      <div
        use:inView={() => (howIn = true)}
        data-in={howIn || undefined}
        class="flex items-end justify-between gap-6 flex-wrap"
      >
        <h2 class="font-display text-3xl sm:text-5xl text-foreground max-w-lg leading-[1.02]">
          <span class="rise-line"><span>From blueprint to</span></span>
          <span class="rise-line" style="--l: 1"><span>finished project.</span></span>
        </h2>
        <p class="text-sm text-muted-foreground max-w-sm leading-relaxed fade-up" style="--delay: 250ms">
          The same vocabulary for students, supervisors and administrators, from the first match to the final
          review.
        </p>
      </div>
      <div class="rule-accent mt-8" aria-hidden="true"></div>

      <ol bind:this={deckEl} class="mt-12 flex flex-col gap-6 pb-[18vh]">
        {#each steps as step, i (step.n)}
          <li class="deck-card" style="--i: {i}" data-stage={step.stage}>
            <article
              class="forge-card relative min-h-[22rem] grid md:grid-cols-[1.1fr_1fr] gap-6 p-7 sm:p-10"
              data-variant={step.stage === 'blueprint' ? 'blueprint' : step.stage === 'forged' ? 'ember' : undefined}
              style={step.stage === 'heat'
                ? 'background: radial-gradient(120% 100% at 50% 120%, color-mix(in oklab, var(--ember) 16%, transparent), transparent 60%), var(--card)'
                : ''}
            >
              <div class="flex flex-col">
                <div class="flex items-center gap-3">
                  <span class="font-mono text-3xs uppercase tracking-[0.2em] text-muted-foreground">Step {step.n}</span>
                  <span class="h-px w-8 bg-border" aria-hidden="true"></span>
                  <span class="font-mono text-3xs uppercase tracking-[0.2em] text-accent">{step.tag}</span>
                </div>
                <h3 class="font-display text-2xl sm:text-4xl text-foreground mt-6 leading-tight">{step.title}</h3>
                <p class="text-sm sm:text-base text-muted-foreground leading-relaxed mt-4 max-w-md">{step.body}</p>
                <span class="deck-numeral text-[6rem] sm:text-[9rem] mt-auto pt-6 select-none" aria-hidden="true">{step.n}</span>
              </div>

              <!-- Each stage draws its own small scene. -->
              <div class="relative hidden md:flex items-center justify-center" aria-hidden="true">
                {#if step.stage === 'blueprint'}
                  <svg viewBox="0 0 280 220" class="w-full max-w-sm">
                    {#each [[140, 110, 60, 50], [140, 110, 230, 60], [140, 110, 50, 170], [140, 110, 220, 175]] as [x1, y1, x2, y2], k (k)}
                      <line {x1} {y1} {x2} {y2} stroke="var(--blueprint-line)" stroke-dasharray="4 5" />
                    {/each}
                    <line x1="140" y1="110" x2="230" y2="60" stroke="var(--ember)" stroke-width="2" />
                    {#each [[60, 50, 'UX'], [230, 60, 'API'], [50, 170, 'ML'], [220, 175, 'OPS']] as [cx, cy, label] (label)}
                      <circle cx={cx} cy={cy} r="17" fill="var(--card)" stroke={label === 'API' ? 'var(--ember)' : 'var(--blueprint-line)'} stroke-width="1.5" />
                      <text x={cx} y={Number(cy) + 3} text-anchor="middle" font-size="9" font-family="var(--font-mono)" fill="var(--muted-foreground)">{label}</text>
                    {/each}
                    <circle cx="140" cy="110" r="24" fill="var(--accent)" />
                    <text x="140" y="114" text-anchor="middle" font-size="10" font-weight="700" font-family="var(--font-mono)" fill="var(--accent-foreground)">YOU</text>
                    <rect x="164" y="66" width="52" height="18" rx="9" fill="var(--card)" stroke="var(--ember)" />
                    <text x="190" y="78" text-anchor="middle" font-size="9" font-weight="700" font-family="var(--font-mono)" fill="var(--ember)">86%</text>
                  </svg>
                {:else if step.stage === 'heat'}
                  <div class="relative w-64 h-72">
                    {#each [['T·4F2', 'HIGH', 'Realtime sync', -5, 0], ['T·9C1', 'MED', 'Wireframes', 3, 92], ['T·2A7', 'LOW', 'Usability test', -2, 184]] as [c, p, title, rot, top] (c)}
                      <div
                        class="ticket-shell absolute left-0 right-0"
                        style="top: {top}px; transform: rotate({rot}deg) translateX({Number(rot) * 4}px); filter: drop-shadow(0 10px 14px color-mix(in oklab, var(--foreground) 10%, transparent))"
                      >
                        <div class="ticket">
                          <span class="ticket-heat" data-hot={p === 'HIGH' || undefined} style="--heat: var(--warning)"></span>
                          <div class="ticket-stub">
                            <span class="font-mono text-3xs text-muted-foreground">{c}</span>
                            <span class="font-mono text-3xs font-bold" style="color: {p === 'HIGH' ? 'var(--ember)' : 'var(--muted-foreground)'}">{p}</span>
                          </div>
                          <div class="ticket-perf"></div>
                          <p class="px-3.5 py-2.5 text-xs font-bold text-foreground">{title}</p>
                        </div>
                      </div>
                    {/each}
                  </div>
                {:else}
                  <div class="relative w-56 h-56 stamp-scene">
                    <svg viewBox="0 0 200 200" class="stamp w-full h-full">
                      <defs>
                        <path id="stamp-ring" d="M100,100 m-72,0 a72,72 0 1,1 144,0 a72,72 0 1,1 -144,0" />
                      </defs>
                      <circle cx="100" cy="100" r="92" fill="none" stroke="var(--ember)" stroke-width="3" />
                      <circle cx="100" cy="100" r="60" fill="none" stroke="var(--ember)" stroke-width="1.5" />
                      <!-- Only the lettering turns; the check stays upright. -->
                      <g class="stamp-ring">
                        <text font-size="13" font-weight="800" letter-spacing="4" font-family="var(--font-mono)" fill="var(--ember)">
                          <textPath href="#stamp-ring">REVIEWED · APPROVED · PROJECT-SYNC ·</textPath>
                        </text>
                      </g>
                      <path d="M76 101 l16 16 l33 -35" fill="none" stroke="var(--ember)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                  </div>
                {/if}
              </div>
              <div class="deck-shade" aria-hidden="true"></div>
            </article>
          </li>
        {/each}
      </ol>
    </section>

    <!-- Live figures, rolling up on odometers as they scroll in. -->
    <section id="platform" class="border-y border-border scroll-mt-16 relative">
      <div class="max-w-6xl mx-auto px-5 sm:px-8 py-14">
        <p class="eyebrow">On this instance right now</p>
        <dl class="grid grid-cols-2 md:grid-cols-4 gap-y-10 gap-x-8 mt-8" use:inView={() => (statsIn = true)}>
          {#if stats}
            {#each stats as stat (stat.label)}
              <div class="flex flex-col-reverse gap-2">
                <dt class="text-xs text-muted-foreground">{stat.label}</dt>
                <dd class="font-display text-4xl sm:text-6xl text-foreground"><Odometer value={stat.value} play={statsIn} /></dd>
              </div>
            {/each}
          {/if}
        </dl>
      </div>
    </section>

    <!-- Capabilities: drawn as blueprints, forged solid as they arrive. -->
    <section class="max-w-6xl mx-auto px-5 sm:px-8 py-20 sm:py-28">
      <div use:inView={() => (capsIn = true)} data-in={capsIn || undefined}>
        <h2 class="font-display text-3xl sm:text-5xl text-foreground max-w-xl leading-[1.02]">
          <span class="rise-line"><span>Everything a capstone</span></span>
          <span class="rise-line" style="--l: 1"><span>team actually needs.</span></span>
        </h2>
      </div>
      <ul class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-12">
        {#each capabilities as item, i (item.title)}
          <li
            class="bp-plate p-7"
            data-forged={capsIn || undefined}
            style="--delay: {i * 110}ms"
          >
            <div class="flex items-center justify-between">
              <item.icon class="w-6 h-6 text-accent" strokeWidth={1.5} aria-hidden="true" />
              <span class="bp-coord" aria-hidden="true">GRID {String.fromCharCode(65 + Math.floor(i / 3))}·{(i % 3) + 1}</span>
            </div>
            <h3 class="text-sm font-bold text-foreground mt-8">{item.title}</h3>
            <p class="mt-1.5 text-xs text-muted-foreground leading-relaxed">{item.body}</p>
          </li>
        {/each}
      </ul>
    </section>

    <!-- Closing -->
    <section class="max-w-6xl mx-auto px-5 sm:px-8 pb-24">
      <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-8 border-t border-foreground/80 pt-10">
        <h2 class="font-display text-3xl sm:text-6xl text-foreground max-w-2xl leading-[1.02]">
          Your next project starts with the <span class="text-accent">right team</span>.
        </h2>
        <a href="/auth?tab=register" class="shrink-0 inline-block" use:magnetic>
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
      <p class="text-2xs text-muted-foreground">© 2026 Project-Sync · Built for academic teams</p>
      <nav aria-label="Footer" class="flex gap-6">
        <a href="#how" class="text-2xs font-semibold text-muted-foreground hover:text-foreground rounded-sm">How it works</a>
        <a href="/auth" class="text-2xs font-semibold text-muted-foreground hover:text-foreground rounded-sm">Sign in</a>
      </nav>
    </div>
  </footer>
</div>

<style>
  /* The approval stamp slams down when the forged plate comes to the front. */
  .stamp {
    transform: rotate(-14deg);
    filter: drop-shadow(0 0 18px color-mix(in oklab, var(--ember) 35%, transparent));
  }
  .stamp-ring {
    transform-origin: 100px 100px;
    transform-box: view-box;
  }
  @media (prefers-reduced-motion: no-preference) {
    .stamp-ring {
      animation: stamp-spin 30s linear infinite;
    }
  }
  @keyframes stamp-spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
