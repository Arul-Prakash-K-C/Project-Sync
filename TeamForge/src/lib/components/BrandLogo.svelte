<script lang="ts">
  /**
   * The Project-Sync logo: a chamfered tile holding two arrows that chase
   * round a project node (a project kept in sync), with the wordmark beside
   * it. Drawn inline in theme colours so it follows light and dark mode.
   * When its link is hovered, the arrows turn half a revolution.
   */
  let {
    size = 'md',
    wordmark = true,
    class: className = ''
  }: { size?: 'sm' | 'md' | 'lg'; wordmark?: boolean; class?: string } = $props();

  const px = $derived({ sm: 28, md: 34, lg: 40 }[size]);
  const text = $derived({ sm: "text-sm", md: "text-base", lg: "text-lg" }[size]);
</script>

<span class="brand inline-flex items-center gap-2.5 min-w-0 {className}">
  <svg width={px} height={px} viewBox="0 0 64 64" class="shrink-0" aria-hidden="true">
    <path d="M12 0H60a4 4 0 0 1 4 4V52L52 64H4a4 4 0 0 1-4-4V12Z" fill="var(--accent)" />
    <g class="brand-glyph" transform="translate(32 32) scale(1.22) translate(-32 -32)">
      <g fill="none" stroke="var(--accent-foreground)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M17.6 29.2A14.6 14.6 0 0 1 44.2 24" />
        <path d="M45 18.4 44.2 24 38.6 22" />
        <path d="M46.4 34.8A14.6 14.6 0 0 1 19.8 40" />
        <path d="M19 45.6 19.8 40 25.4 42" />
      </g>
      <circle cx="32" cy="32" r="4.6" fill="var(--accent-foreground)" />
    </g>
  </svg>
  {#if wordmark}
    <span class="font-display {text} text-foreground truncate tracking-tight">
      Project<span class="text-accent">-</span>Sync
    </span>
  {/if}
</span>

<style>
  .brand-glyph > :global(g),
  .brand-glyph > :global(circle) {
    transition: transform 0.7s cubic-bezier(0.16, 1, 0.3, 1);
    transform-origin: 32px 32px;
  }
  @media (prefers-reduced-motion: no-preference) {
    :global(a:hover) > .brand .brand-glyph > :global(g),
    :global(a:focus-visible) > .brand .brand-glyph > :global(g) {
      transform: rotate(180deg);
    }
  }
</style>
