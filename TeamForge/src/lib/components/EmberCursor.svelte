<script lang="ts">
  import { onMount } from 'svelte';

  /**
   * An ember that trails the pointer: a ring that lags behind on a spring and
   * a dot that tracks exactly. Over links and buttons the ring swells; over
   * anything marked `data-cursor="drag"` (the 3D scene) it widens, dashes and
   * says DRAG. The system cursor stays visible: this is a companion, not a
   * replacement. Desktop pointers only; off under reduced motion.
   */
  let enabled = $state(false);
  let ring = $state<HTMLDivElement | null>(null);
  let dot = $state<HTMLDivElement | null>(null);
  let host = $state<HTMLDivElement | null>(null);

  onMount(() => {
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!fine || reduced) return;
    enabled = true;

    let x = -100;
    let y = -100;
    let rx = x;
    let ry = y;
    let frame = 0;
    let visible = false;

    const loop = () => {
      rx += (x - rx) * 0.2;
      ry += (y - ry) * 0.2;
      if (ring) ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
      if (dot) dot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      // Stop the loop once the ring has caught up; the next move restarts it.
      frame = Math.abs(x - rx) + Math.abs(y - ry) > 0.2 ? requestAnimationFrame(loop) : 0;
    };

    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      x = e.clientX;
      y = e.clientY;
      if (!visible && host) {
        visible = true;
        host.style.opacity = '1';
        rx = x;
        ry = y;
      }
      if (!frame) frame = requestAnimationFrame(loop);
    };
    const over = (e: PointerEvent) => {
      const t = e.target as Element | null;
      const drag = t?.closest('[data-cursor="drag"]');
      const link = t?.closest('a, button, [role="button"], select, label, input, textarea');
      host?.setAttribute('data-state', drag ? 'drag' : link ? 'link' : 'idle');
    };
    const down = () => host?.setAttribute('data-down', '');
    const up = () => host?.removeAttribute('data-down');
    const leave = () => {
      visible = false;
      if (host) host.style.opacity = '0';
    };

    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerover', over, { passive: true });
    window.addEventListener('pointerdown', down);
    window.addEventListener('pointerup', up);
    document.documentElement.addEventListener('pointerleave', leave);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerover', over);
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', up);
      document.documentElement.removeEventListener('pointerleave', leave);
    };
  });
</script>

{#if enabled}
  <div bind:this={host} class="ember-cursor" data-state="idle" aria-hidden="true" style="opacity: 0; transition: opacity 0.3s ease">
    <div bind:this={ring} class="absolute left-0 top-0">
      <div class="ember-cursor-ring"><span class="ember-cursor-label">DRAG</span></div>
    </div>
    <div bind:this={dot} class="absolute left-0 top-0"><div class="ember-cursor-dot"></div></div>
  </div>
{/if}
