<script lang="ts">
  import { onMount } from 'svelte';

  /*
    "Team constellation" — the product's idea drawn in 3D. Students are points on
    a sphere; teams are clusters that pull together around a wireframe core.
    Drag to spin it, hover a point to light up its team, click (or press the
    button) to re-match everyone and watch the clusters re-form.

    three.js is imported on mount only, so it never weighs on first paint or on
    pages that do not show the scene.
  */

  let {
    class: className = '',
    /** Show the "re-match" control and hint line. */
    controls = true,
    /** Number of student points. */
    count = 140,
    /** Radius multiplier — smaller for compact placements. */
    scale = 1
  }: { class?: string; controls?: boolean; count?: number; scale?: number } = $props();

  let host: HTMLDivElement;
  let canvas: HTMLCanvasElement;
  let ready = $state(false);
  let failed = $state(false);
  let rematch: (() => void) | null = null;

  onMount(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;

    (async () => {
      let THREE: typeof import('three');
      try {
        THREE = await import('three');
      } catch {
        failed = true;
        return;
      }
      if (disposed) return;

      let renderer: import('three').WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
      } catch {
        failed = true; // no WebGL — the static backdrop stays
        return;
      }

      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
      camera.position.set(0, 0, 6.2);

      const world = new THREE.Group();
      scene.add(world);

      // ------------------------------------------------------------ palette
      const palette = () => {
        const css = getComputedStyle(document.documentElement);
        const read = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
        return {
          accent: new THREE.Color(read('--accent', '#A8481B')),
          ink: new THREE.Color(read('--foreground', '#12151C')),
          bg: new THREE.Color(read('--background', '#F5F6F8')),
          dark: document.documentElement.classList.contains('dark')
        };
      };
      let colors = palette();

      // ------------------------------------------------------------ geometry
      const R = 1.75 * scale;
      const N = count;
      const base: import('three').Vector3[] = [];
      const golden = Math.PI * (3 - Math.sqrt(5));
      for (let i = 0; i < N; i++) {
        const y = 1 - (i / (N - 1)) * 2;
        const r = Math.sqrt(1 - y * y);
        const t = golden * i;
        base.push(new THREE.Vector3(Math.cos(t) * r, y, Math.sin(t) * r).multiplyScalar(R));
      }
      const current = base.map((v) => v.clone());
      const target = base.map((v) => v.clone());
      /** team index per point, or -1 for students not yet matched */
      let team = new Int16Array(N).fill(-1);
      let teams: number[][] = [];

      function formTeams() {
        team = new Int16Array(N).fill(-1);
        teams = [];
        const free = new Set(base.map((_, i) => i));
        const teamCount = Math.max(4, Math.round(N / 20));
        for (let t = 0; t < teamCount && free.size > 6; t++) {
          const pool = [...free];
          const seed = pool[Math.floor(Math.random() * pool.length)];
          const size = 4 + Math.floor(Math.random() * 3);
          const members = pool
            .sort((a, b) => base[a].distanceToSquared(base[seed]) - base[b].distanceToSquared(base[seed]))
            .slice(0, size);
          members.forEach((m) => {
            team[m] = t;
            free.delete(m);
          });
          teams.push(members);
        }
        // Team members gather toward their shared centre on the sphere.
        base.forEach((v, i) => target[i].copy(v));
        teams.forEach((members) => {
          const centre = new THREE.Vector3();
          members.forEach((m) => centre.add(base[m]));
          centre.normalize().multiplyScalar(R * 1.04);
          members.forEach((m) => target[m].copy(base[m]).lerp(centre, 0.55).setLength(R * 1.04));
        });
      }
      formTeams();

      // Round, soft-edged sprite for the points.
      const sprite = (() => {
        const c = document.createElement('canvas');
        c.width = c.height = 64;
        const g = c.getContext('2d')!;
        const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        grad.addColorStop(0, 'rgba(255,255,255,1)');
        grad.addColorStop(0.55, 'rgba(255,255,255,0.95)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grad;
        g.fillRect(0, 0, 64, 64);
        const tex = new THREE.CanvasTexture(c);
        tex.colorSpace = THREE.SRGBColorSpace;
        return tex;
      })();

      const pointPositions = new Float32Array(N * 3);
      const pointColors = new Float32Array(N * 3);
      const pointGeo = new THREE.BufferGeometry();
      pointGeo.setAttribute('position', new THREE.BufferAttribute(pointPositions, 3));
      pointGeo.setAttribute('color', new THREE.BufferAttribute(pointColors, 3));
      const pointMat = new THREE.PointsMaterial({
        size: 0.105 * scale,
        map: sprite,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        sizeAttenuation: true
      });
      const points = new THREE.Points(pointGeo, pointMat);
      world.add(points);

      // Team links: every member joined to the team's hub, plus a ring.
      const MAX_LINKS = N * 2;
      const linkPositions = new Float32Array(MAX_LINKS * 2 * 3);
      const linkColors = new Float32Array(MAX_LINKS * 2 * 3);
      const linkGeo = new THREE.BufferGeometry();
      linkGeo.setAttribute('position', new THREE.BufferAttribute(linkPositions, 3));
      linkGeo.setAttribute('color', new THREE.BufferAttribute(linkColors, 3));
      const linkMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9 });
      const links = new THREE.LineSegments(linkGeo, linkMat);
      world.add(links);

      // The forge core.
      const coreGeo = new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(0.62 * scale, 1));
      const coreMat = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.55 });
      const core = new THREE.LineSegments(coreGeo, coreMat);
      world.add(core);

      // Faint latitude rings give the sphere its volume without filling it in.
      const ringMat = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.08 });
      const rings = new THREE.Group();
      [-0.5, 0, 0.5].forEach((lat) => {
        const r = Math.sqrt(1 - lat * lat) * R;
        const curve = new THREE.EllipseCurve(0, 0, r, r, 0, Math.PI * 2);
        const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(96));
        const ring = new THREE.LineLoop(geo, ringMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = lat * R;
        rings.add(ring);
      });
      world.add(rings);

      let hovered = -1;

      /*
        Per-theme tuning. Mixing toward a near-black background (and drawing
        dark accents at low opacity) turns the scene muddy, so dark mode mixes
        far less, draws brighter and larger, and blends additively so points and
        links glow against the page instead of sinking into it.
      */
      const look = () =>
        colors.dark
          ? { neutralMix: 0.28, linkMix: 0.05, fadedMix: 0.8, core: 0.85, rings: 0.2, size: 0.12, links: 1, blend: THREE.AdditiveBlending }
          : { neutralMix: 0.55, linkMix: 0.35, fadedMix: 0.85, core: 0.45, rings: 0.08, size: 0.105, links: 0.9, blend: THREE.NormalBlending };
      let tuning = look();

      function paint() {
        const { accent, ink, bg } = colors;
        tuning = look();
        pointMat.size = tuning.size * scale;
        pointMat.blending = tuning.blend;
        linkMat.blending = tuning.blend;
        linkMat.opacity = tuning.links;
        ringMat.opacity = tuning.rings;
        pointMat.needsUpdate = linkMat.needsUpdate = true;
        const neutral = ink.clone().lerp(bg, tuning.neutralMix);
        const hoverTeam = hovered >= 0 ? team[hovered] : -1;
        for (let i = 0; i < N; i++) {
          const c = team[i] >= 0 ? accent.clone() : neutral;
          if (hoverTeam >= 0 && team[i] >= 0 && team[i] !== hoverTeam) c.lerp(bg, 0.55);
          if (i === hovered) c.lerp(new THREE.Color(colors.dark ? '#ffffff' : '#000000'), 0.25);
          pointColors.set([c.r, c.g, c.b], i * 3);
        }
        pointGeo.attributes.color.needsUpdate = true;
        coreMat.color.copy(accent);
        ringMat.color.copy(ink);
      }

      function writeLinks() {
        const { accent, bg } = colors;
        const hoverTeam = hovered >= 0 ? team[hovered] : -1;
        let n = 0;
        const push = (a: number, b: number, t: number) => {
          if (n >= MAX_LINKS) return;
          const faded = hoverTeam >= 0 && t !== hoverTeam;
          const c = accent.clone().lerp(bg, faded ? tuning.fadedMix : tuning.linkMix);
          linkPositions.set([current[a].x, current[a].y, current[a].z, current[b].x, current[b].y, current[b].z], n * 6);
          linkColors.set([c.r, c.g, c.b, c.r, c.g, c.b], n * 6);
          n++;
        };
        teams.forEach((members, t) => {
          const hub = members[0];
          members.forEach((m, i) => {
            if (m !== hub) push(hub, m, t);
            const next = members[(i + 1) % members.length];
            if (members.length > 2 && next !== hub && m !== hub) push(m, next, t);
          });
        });
        linkGeo.setDrawRange(0, n * 2);
        linkGeo.attributes.position.needsUpdate = true;
        linkGeo.attributes.color.needsUpdate = true;
      }

      paint();

      // ----------------------------------------------------------- interaction
      const pointer = new THREE.Vector2(10, 10);
      const tilt = { x: 0, y: 0 };
      let dragging = false;
      let lastX = 0;
      let lastY = 0;
      let velocity = { x: 0, y: reduceMotion ? 0 : 0.0016 };
      let spin = { x: 0.35, y: 0 };
      let pulse = 0;
      let downAt = 0;
      const raycaster = new THREE.Raycaster();
      raycaster.params.Points = { threshold: 0.09 * scale };

      function setPointer(e: PointerEvent) {
        const rect = canvas.getBoundingClientRect();
        pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
        tilt.x = pointer.y * 0.18;
        tilt.y = pointer.x * 0.25;
      }

      function onPointerDown(e: PointerEvent) {
        dragging = true;
        downAt = performance.now();
        lastX = e.clientX;
        lastY = e.clientY;
        canvas.setPointerCapture(e.pointerId);
      }
      function onPointerMove(e: PointerEvent) {
        setPointer(e);
        if (!dragging) return;
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        lastX = e.clientX;
        lastY = e.clientY;
        velocity = { x: dy * 0.0035, y: dx * 0.0035 };
        spin.x += velocity.x;
        spin.y += velocity.y;
      }
      function onPointerUp(e: PointerEvent) {
        dragging = false;
        canvas.releasePointerCapture?.(e.pointerId);
        // A short press without much movement is a click: re-match.
        if (performance.now() - downAt < 220 && Math.abs(velocity.x) + Math.abs(velocity.y) < 0.02) {
          rematch?.();
        }
      }
      function onPointerLeave() {
        pointer.set(10, 10);
        tilt.x = tilt.y = 0;
      }

      canvas.addEventListener('pointerdown', onPointerDown);
      canvas.addEventListener('pointermove', onPointerMove);
      canvas.addEventListener('pointerup', onPointerUp);
      canvas.addEventListener('pointerleave', onPointerLeave);

      rematch = () => {
        formTeams();
        pulse = 1;
        velocity.y += reduceMotion ? 0 : 0.04;
        paint();
      };

      // Follow the app's theme toggle.
      const themeObserver = new MutationObserver(() => {
        colors = palette();
        paint();
      });
      themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

      // ----------------------------------------------------------- sizing
      function resize() {
        const { width, height } = host.getBoundingClientRect();
        if (width === 0 || height === 0) return;
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        // Keep the whole sphere in frame on narrow placements.
        camera.position.z = width / height < 0.9 ? 6.2 / Math.max(width / height, 0.55) : 6.2;
        camera.updateProjectionMatrix();
      }
      const resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(host);
      resize();

      // Only animate while visible.
      let visible = true;
      const io = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        if (visible) loop();
      });
      io.observe(host);

      // ----------------------------------------------------------- frame loop
      let frame = 0;
      let running = false;
      function loop() {
        if (running || disposed) return;
        running = true;
        frame = requestAnimationFrame(tick);
      }

      function tick() {
        running = false;
        if (disposed || !visible || document.hidden) return;

        if (!dragging) {
          spin.x += velocity.x;
          spin.y += velocity.y;
          // Momentum decays back toward a slow idle drift.
          velocity.x *= 0.94;
          velocity.y = velocity.y * 0.96 + (reduceMotion ? 0 : 0.0016) * 0.04;
          spin.x += (0.35 - spin.x) * 0.01;
        }
        world.rotation.x += (spin.x + tilt.x - world.rotation.x) * 0.08;
        world.rotation.y += (spin.y + tilt.y - world.rotation.y) * 0.08;

        const ease = reduceMotion ? 1 : 0.06;
        for (let i = 0; i < N; i++) {
          current[i].lerp(target[i], ease);
          pointPositions.set([current[i].x, current[i].y, current[i].z], i * 3);
        }
        pointGeo.attributes.position.needsUpdate = true;
        writeLinks();

        pulse *= 0.93;
        const s = 1 + pulse * 0.35;
        core.scale.setScalar(s);
        core.rotation.y -= reduceMotion ? 0 : 0.004;
        core.rotation.x += reduceMotion ? 0 : 0.002;
        coreMat.opacity = Math.min(1, tuning.core + pulse * 0.5);

        // Hover: light up the team under the pointer.
        raycaster.setFromCamera(pointer, camera);
        const hit = raycaster.intersectObject(points)[0];
        const next = hit?.index ?? -1;
        if (next !== hovered) {
          hovered = next;
          canvas.style.cursor = hovered >= 0 ? 'pointer' : 'grab';
          paint();
        }

        renderer.render(scene, camera);
        ready = true;
        loop();
      }
      loop();

      document.addEventListener('visibilitychange', loop);

      cleanup = () => {
        cancelAnimationFrame(frame);
        document.removeEventListener('visibilitychange', loop);
        canvas.removeEventListener('pointerdown', onPointerDown);
        canvas.removeEventListener('pointermove', onPointerMove);
        canvas.removeEventListener('pointerup', onPointerUp);
        canvas.removeEventListener('pointerleave', onPointerLeave);
        themeObserver.disconnect();
        resizeObserver.disconnect();
        io.disconnect();
        pointGeo.dispose();
        pointMat.dispose();
        linkGeo.dispose();
        linkMat.dispose();
        coreGeo.dispose();
        coreMat.dispose();
        ringMat.dispose();
        rings.children.forEach((r) => (r as import('three').LineLoop).geometry.dispose());
        sprite.dispose();
        renderer.dispose();
      };
    })();

    return () => {
      disposed = true;
      cleanup?.();
    };
  });
</script>

<div bind:this={host} class="forge-scene relative {className}">
  <canvas
    bind:this={canvas}
    aria-hidden="true"
    class="absolute inset-0 w-full h-full touch-none cursor-grab transition-opacity duration-700
      {ready ? 'opacity-100' : 'opacity-0'}"
  ></canvas>

  {#if !ready && !failed}
    <!-- Holds the space with a soft disc while three.js loads. -->
    <div class="absolute inset-0 flex items-center justify-center" aria-hidden="true">
      <div class="w-1/2 aspect-square rounded-full border border-border/70 animate-pulse-slow"></div>
    </div>
  {/if}

  {#if controls && !failed}
    <div class="absolute bottom-2 inset-x-0 flex items-center justify-center gap-3 pointer-events-none">
      <span class="hidden sm:inline text-3xs font-mono uppercase tracking-widest text-muted-foreground">
        Drag to explore
      </span>
      <span class="hidden sm:inline w-1 h-1 rounded-full bg-border" aria-hidden="true"></span>
      <button
        type="button"
        onclick={() => rematch?.()}
        class="pointer-events-auto text-3xs font-mono uppercase tracking-widest text-muted-foreground
          hover:text-accent transition-colors rounded-sm px-1 cursor-pointer"
      >
        Re-match teams
      </button>
    </div>
  {/if}
</div>

<style>
  /* A faint accent backlight gives the sphere depth on a near-black page. */
  :global(.dark) .forge-scene::before {
    content: '';
    position: absolute;
    inset: 12%;
    border-radius: 9999px;
    background: radial-gradient(circle, color-mix(in srgb, var(--accent) 16%, transparent), transparent 68%);
    pointer-events: none;
  }
</style>
