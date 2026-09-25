/*
  Small motion primitives shared by every page. Both respect
  `prefers-reduced-motion`: under it, elements simply appear and stay flat.
*/

const reduced = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Fades and lifts an element in the first time it scrolls into view.
 * `use:reveal={{ delay: 80 }}` staggers siblings.
 */
export function reveal(node: HTMLElement, opts: { delay?: number } = {}) {
  if (reduced() || typeof IntersectionObserver === 'undefined') return {};
  node.classList.add('reveal');
  if (opts.delay) node.style.transitionDelay = `${opts.delay}ms`;

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          node.dataset.revealed = '';
          io.disconnect();
        }
      });
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.05 }
  );
  io.observe(node);
  return { destroy: () => io.disconnect() };
}

/**
 * Tilts a card a few degrees toward the pointer, with a soft highlight that
 * follows it — a tactile hint that the surface is interactive.
 */
export function tilt(node: HTMLElement, opts: { max?: number } = {}) {
  if (reduced() || !window.matchMedia('(hover: hover)').matches) return {};
  const max = opts.max ?? 5;
  node.classList.add('tilt');
  let frame = 0;

  function onMove(e: PointerEvent) {
    const rect = node.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      node.style.setProperty('--tilt-x', `${(0.5 - py) * max}deg`);
      node.style.setProperty('--tilt-y', `${(px - 0.5) * max}deg`);
      node.style.setProperty('--glow-x', `${px * 100}%`);
      node.style.setProperty('--glow-y', `${py * 100}%`);
    });
  }
  function onLeave() {
    cancelAnimationFrame(frame);
    node.style.setProperty('--tilt-x', '0deg');
    node.style.setProperty('--tilt-y', '0deg');
  }

  node.addEventListener('pointermove', onMove);
  node.addEventListener('pointerleave', onLeave);
  return {
    destroy() {
      cancelAnimationFrame(frame);
      node.removeEventListener('pointermove', onMove);
      node.removeEventListener('pointerleave', onLeave);
    }
  };
}
