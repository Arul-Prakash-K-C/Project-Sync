/*
  Motion primitives for the Forge language (see src/routes/forge.css).
  Every one of them is a no-op under `prefers-reduced-motion`.
*/

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const finePointer = () => typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/**
 * Numbers each child with `--i` so `.quench` plates arrive one after another.
 * Re-numbers when children change (filters, new items).
 */
export function stagger(node: HTMLElement, opts: { max?: number } = {}) {
  const max = opts.max ?? 12;
  const apply = () => {
    Array.from(node.children).forEach((el, i) => (el as HTMLElement).style.setProperty('--i', String(Math.min(i, max))));
  };
  apply();
  const mo = new MutationObserver(apply);
  mo.observe(node, { childList: true });
  return { destroy: () => mo.disconnect() };
}

/**
 * Pulls an element a few pixels towards the pointer while it hovers nearby,
 * and springs it back on leave: a small physical "attraction" for key CTAs.
 */
export function magnetic(node: HTMLElement, opts: { strength?: number } = {}) {
  if (prefersReducedMotion() || !finePointer()) return {};
  const strength = opts.strength ?? 0.28;
  node.style.transition = 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)';
  let frame = 0;

  function onMove(e: PointerEvent) {
    const r = node.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      node.style.transition = 'transform 0.15s ease-out';
      node.style.transform = `translate(${dx * strength}px, ${dy * strength}px)`;
    });
  }
  function onLeave() {
    cancelAnimationFrame(frame);
    node.style.transition = 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)';
    node.style.transform = '';
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

/**
 * Calls `onEnter` once, the first time the element scrolls into view.
 * Without IntersectionObserver (or with reduced motion) it fires at once.
 */
export function inView(node: HTMLElement, onEnter: () => void) {
  if (typeof IntersectionObserver === 'undefined' || prefersReducedMotion()) {
    onEnter();
    return {};
  }
  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        onEnter();
        io.disconnect();
      }
    },
    { rootMargin: '0px 0px -12% 0px', threshold: 0.15 }
  );
  io.observe(node);
  return { destroy: () => io.disconnect() };
}

/**
 * Throws a burst of sparks from a screen point: short glowing streaks that
 * fly out and fall under gravity. Purely decorative (aria-hidden) and
 * removed as soon as the burst ends.
 */
export function emitSparks(x: number, y: number, opts: { count?: number; color?: string; power?: number } = {}) {
  if (typeof document === 'undefined' || prefersReducedMotion()) return;
  const count = opts.count ?? 12;
  const power = opts.power ?? 1;
  const burst = document.createElement('div');
  burst.className = 'spark-burst';
  burst.setAttribute('aria-hidden', 'true');
  burst.style.left = `${x}px`;
  burst.style.top = `${y}px`;
  if (opts.color) burst.style.setProperty('--spark-color', opts.color);

  let longest = 0;
  for (let i = 0; i < count; i++) {
    const s = document.createElement('span');
    s.className = 'spark';
    // Mostly upward fan: angle measured from "down", so 180° is straight up.
    const angle = 180 + (Math.random() - 0.5) * 200;
    const life = 450 + Math.random() * 350;
    longest = Math.max(longest, life);
    s.style.setProperty('--rot', `${angle}deg`);
    s.style.setProperty('--dist', `${(28 + Math.random() * 46) * power}px`);
    s.style.setProperty('--gy', `${14 + Math.random() * 22}px`);
    s.style.setProperty('--gx', `${(Math.random() - 0.5) * 8}px`);
    s.style.setProperty('--len', `${5 + Math.random() * 7}px`);
    s.style.setProperty('--life', `${life}ms`);
    burst.appendChild(s);
  }
  document.body.appendChild(burst);
  setTimeout(() => burst.remove(), longest + 50);
}

/**
 * Orders the quench entrance across a whole page. Every batch of `.quench`
 * plates that mounts together (the page itself, a newly opened tab, a
 * filtered list) is numbered in document order, so plates arrive as one
 * choreographed sweep rather than all at once.
 */
export function sequence(node: HTMLElement, opts: { max?: number } = {}) {
  const max = opts.max ?? 10;
  const number = (els: Element[]) =>
    els.forEach((el, i) => (el as HTMLElement).style.setProperty('--i', String(Math.min(i, max))));

  number(Array.from(node.querySelectorAll('.quench')));
  const mo = new MutationObserver((records) => {
    const batch: Element[] = [];
    for (const r of records) {
      r.addedNodes.forEach((n) => {
        if (!(n instanceof HTMLElement)) return;
        if (n.classList.contains('quench')) batch.push(n);
        batch.push(...Array.from(n.querySelectorAll('.quench')));
      });
    }
    if (batch.length) number(batch);
  });
  mo.observe(node, { childList: true, subtree: true });
  return { destroy: () => mo.disconnect() };
}

/**
 * Direction of travel for a page change, from the order of the sidebar links
 * (down the list = forward) or, failing that, from route depth.
 */
export function navDirection(from: string | undefined, to: string | undefined): 1 | -1 {
  if (!from || !to) return 1;
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('aside nav a[href]')).map((a) =>
    a.getAttribute('href')
  );
  const a = links.indexOf(from);
  const b = links.indexOf(to);
  if (a !== -1 && b !== -1) return b >= a ? 1 : -1;
  return to.split('/').length >= from.split('/').length ? 1 : -1;
}

/** A spark that scans across the top of the viewport: the page-change signature. */
export function navSpark() {
  if (typeof document === 'undefined' || prefersReducedMotion()) return;
  const el = document.createElement('div');
  el.className = 'nav-spark';
  el.setAttribute('aria-hidden', 'true');
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 760);
}
