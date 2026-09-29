<script lang="ts">
  import { ShieldCheck, ShieldAlert, AlertTriangle } from 'lucide-svelte';
  import type { TeamRisk } from '$lib/utils/risk';
  import Badge from '$lib/components/ui/Badge.svelte';

  /** Risk level as icon + label + colour, so the state never rests on colour alone. */
  let { risk, showScore = true, size = 'sm' }: { risk: TeamRisk; showScore?: boolean; size?: 'sm' | 'md' } = $props();

  const meta = {
    low: { variant: 'success', label: 'Low risk', icon: ShieldCheck },
    medium: { variant: 'warning', label: 'Medium risk', icon: ShieldAlert },
    high: { variant: 'danger', label: 'High risk', icon: AlertTriangle }
  } as const;
  const m = $derived(meta[risk.level]);
</script>

<Badge
  variant={m.variant}
  {size}
  class="shrink-0 gap-1"
  title={risk.factors
    .filter((f) => f.points > 0)
    .map((f) => `${f.label}: +${f.points}`)
    .join('\n') || 'No risk signals'}
>
  <m.icon class="w-3 h-3" aria-hidden="true" />
  {m.label}{#if showScore}<span class="tabular opacity-80">· {risk.score}</span>{/if}
</Badge>
