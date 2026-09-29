<script lang="ts">
  import { tick } from 'svelte';
  import { RotateCw, UserPlus, PieChart, Undo2 } from 'lucide-svelte';
  import type { User } from '$lib/services/db';
  import type { CompatibilityBreakdown } from '$lib/utils/compatibility';
  import Avatar from '$lib/components/ui/Avatar.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import MatchGauge from '$lib/components/ui/MatchGauge.svelte';

  /**
   * A candidate as an archive dossier. The front is the profile with a match
   * gauge; flipping it (a 3D turn, or a crossfade under reduced motion) shows
   * the three factors that earned the most points. Only the visible face is
   * reachable by keyboard and screen reader; focus follows the flip.
   */
  let {
    user,
    breakdown,
    mySkills,
    neededSkills = [],
    onbreakdown,
    oninvite
  }: {
    user: User;
    breakdown: CompatibilityBreakdown;
    mySkills: string[];
    neededSkills?: string[];
    onbreakdown: () => void;
    oninvite: () => void;
  } = $props();

  let flipped = $state(false);
  let root = $state<HTMLElement | null>(null);

  const first = $derived(user.name.split(' ')[0]);
  const deptCode = $derived(
    user.department
      .split(/\s|&/)
      .filter((w) => w.length > 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase()
  );
  const top = $derived([...breakdown.factors].filter((f) => f.points > 0).sort((a, b) => b.points - a.points).slice(0, 3));

  async function flip(to: boolean) {
    flipped = to;
    await tick();
    root?.querySelector<HTMLElement>(to ? '[data-face="back"] button' : '[data-face="front"] [data-flip]')?.focus();
  }
</script>

<article bind:this={root} class="dossier h-full" data-flipped={flipped || undefined} aria-label="{user.name}, {breakdown.total}% match">
  <div class="dossier-inner">
    <!-- Front: the profile. -->
    <div class="dossier-face dossier-front forge-card quench p-5 flex flex-col" data-face="front" data-lift inert={flipped}>
      <p class="font-mono text-[9px] tracking-[0.2em] text-muted-foreground flex items-center gap-2" aria-hidden="true">
        <span>DOSSIER</span>
        <span class="flex-1 border-t border-dotted border-border"></span>
        <span>{deptCode}</span>
        <span>·</span>
        <span>{(user.academicYear ?? '—').replace('Year ', 'Y')}</span>
      </p>

      <div class="flex items-start gap-3.5 mt-3">
        <Avatar src={user.avatar} userId={user.id} name={user.name} size="lg" />
        <div class="flex-1 min-w-0">
          <h2 class="text-base font-bold text-foreground truncate">{user.name}</h2>
          <p class="text-xs text-muted-foreground truncate mt-0.5">{user.department}</p>
          <p class="eyebrow mt-1">{user.academicYear}</p>
        </div>
        <MatchGauge value={breakdown.total} label="Compatibility with {user.name}" />
      </div>

      <p class="text-xs text-muted-foreground mt-3.5 line-clamp-2 leading-relaxed">
        {user.bio || 'No biography provided yet.'}
      </p>

      <div class="flex flex-wrap gap-1.5 mt-3">
        {#each user.skills.slice(0, 5) as s (s)}
          <!-- Shared skills are tinted; skills your team still needs are green. -->
          <Badge variant={mySkills.includes(s) ? 'primary' : neededSkills.includes(s) ? 'success' : 'secondary'} size="sm">
            {s}
          </Badge>
        {:else}
          <span class="text-2xs text-muted-foreground">No skills listed</span>
        {/each}
        {#if user.skills.length > 5}
          <Badge variant="outline" size="sm">+{user.skills.length - 5}</Badge>
        {/if}
      </div>

      <div class="mt-auto pt-4 flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" data-flip onclick={() => flip(true)} aria-label="Why {first} fits: flip the card">
          <RotateCw class="w-3.5 h-3.5" />
          Why {first} fits
        </Button>
        <Button variant="outline" size="sm" onclick={oninvite}>
          <UserPlus class="w-3.5 h-3.5" />
          Invite
        </Button>
      </div>
    </div>

    <!-- Back: the evidence. -->
    <div class="dossier-face dossier-back forge-card p-5 flex flex-col" data-variant="blueprint" data-face="back" inert={!flipped}>
      <p class="font-mono text-[9px] tracking-[0.2em] text-muted-foreground flex items-center gap-2" aria-hidden="true">
        <span>EVIDENCE</span>
        <span class="flex-1 border-t border-dotted border-border"></span>
        <span>{breakdown.total}/100</span>
      </p>
      <h3 class="font-display text-lg text-foreground mt-3">Why {first} fits</h3>

      <ol class="flex flex-col gap-3 mt-3">
        {#each top as f, i (f.key)}
          <li class="grid grid-cols-[1.25rem_1fr_auto] gap-x-2 items-baseline">
            <span class="font-mono text-2xs text-accent">{String(i + 1).padStart(2, '0')}</span>
            <span class="min-w-0">
              <span class="block text-xs font-semibold text-foreground">{f.label}</span>
              <span class="block text-2xs text-muted-foreground leading-snug mt-0.5 line-clamp-2">{f.detail}</span>
              <span class="block h-1 mt-1.5 rounded-full bg-border overflow-hidden" aria-hidden="true">
                <span
                  class="block h-full rounded-full transition-[width] duration-1000 ease-out"
                  style="width: {flipped ? (f.points / f.max) * 100 : 0}%; background: linear-gradient(90deg, var(--ember), var(--ember-hot)); transition-delay: {300 + i * 120}ms"
                ></span>
              </span>
            </span>
            <span class="font-mono text-2xs font-semibold text-foreground">+{f.points}</span>
          </li>
        {:else}
          <li class="text-xs text-muted-foreground">Nothing in common yet. Every factor scored zero.</li>
        {/each}
      </ol>

      <div class="mt-auto pt-4 flex flex-wrap items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onclick={() => flip(false)} aria-label="Back to {first}'s profile">
          <Undo2 class="w-3.5 h-3.5" />
          Back
        </Button>
        <Button variant="ghost" size="sm" onclick={onbreakdown}>
          <PieChart class="w-3.5 h-3.5" />
          Full breakdown
        </Button>
        <Button variant="primary" size="sm" onclick={oninvite}>
          <UserPlus class="w-3.5 h-3.5" />
          Invite
        </Button>
      </div>
    </div>
  </div>
</article>
