<script lang="ts">
  let {
    class: className = 'h-4 w-full',
    /** Renders `count` stacked bars — handy for list and table placeholders. */
    count = 1
  }: {
    class?: string;
    count?: number;
  } = $props();
</script>

<!-- Purely decorative: the surrounding region carries aria-busy so assistive
     tech announces "loading" once rather than per bar. -->
{#if count === 1}
  <div class="skeleton {className}" aria-hidden="true"></div>
{:else}
  <div class="flex flex-col gap-2" aria-hidden="true">
    {#each { length: count } as _, i (i)}
      <div class="skeleton {className}"></div>
    {/each}
  </div>
{/if}
