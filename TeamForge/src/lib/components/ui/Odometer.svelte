<script lang="ts">
  import { onMount } from 'svelte';

  /**
   * Renders a value with each digit on a rolling drum, like a mechanical
   * counter. Digits spin up from zero on mount (or when `play` turns true)
   * and roll to new values when the figure changes. Non-digits ("/", "%")
   * sit still. Screen readers get the plain value.
   */
  let { value, play = true }: { value: string | number; play?: boolean } = $props();

  const text = $derived(String(value));
  const chars = $derived([...text]);
  let armed = $state(false);

  onMount(() => {
    // One frame at zero so the drums have somewhere to roll from.
    requestAnimationFrame(() => requestAnimationFrame(() => (armed = true)));
  });

  const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
</script>

<span class="sr-only">{text}</span>
<span class="odo tabular" aria-hidden="true">
  {#each chars as ch, i (i)}
    {#if /\d/.test(ch)}
      <span class="odo-col" aria-hidden="true">
        <span
          class="odo-strip"
          style="--d: {armed && play ? Number(ch) : 0}; transition-delay: {(chars.length - 1 - i) * 70}ms"
        >
          {#each DIGITS as d (d)}<span>{d}</span>{/each}
        </span>
      </span>
    {:else}
      <span aria-hidden="true">{ch}</span>
    {/if}
  {/each}
</span>
