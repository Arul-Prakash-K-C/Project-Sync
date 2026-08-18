<script lang="ts">
  import type { Snippet } from 'svelte';
  import { ChevronRight } from 'lucide-svelte';

  /** Any lucide-svelte icon; the library's exports don't satisfy Svelte's
      `Component` generic, so the slot is structural. */
  type IconComponent = any;

  let {
    title,
    description = '',
    icon,
    /** Trail of ancestor links; the current page is added by the caller's title. */
    breadcrumbs = [],
    actions,
    class: className = ''
  }: {
    title: string;
    description?: string;
    icon?: IconComponent;
    breadcrumbs?: { label: string; href?: string }[];
    actions?: Snippet;
    class?: string;
  } = $props();

  const Icon = $derived(icon);
</script>

<header class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between {className}">
  <div class="min-w-0">
    {#if breadcrumbs.length > 0}
      <nav aria-label="Breadcrumb" class="mb-2">
        <ol class="flex items-center gap-1.5 text-2xs font-semibold text-muted-foreground">
          {#each breadcrumbs as crumb, i}
            <li class="flex items-center gap-1.5">
              {#if crumb.href}
                <a href={crumb.href} class="hover:text-accent transition-colors rounded-sm">{crumb.label}</a>
              {:else}
                <span>{crumb.label}</span>
              {/if}
              <ChevronRight class="w-3 h-3 shrink-0" aria-hidden="true" />
            </li>
            {#if i === breadcrumbs.length - 1}
              <li aria-current="page" class="text-foreground truncate">{title}</li>
            {/if}
          {/each}
        </ol>
      </nav>
    {/if}

    <h1 class="font-display text-2xl sm:text-[1.75rem] leading-tight text-foreground flex items-center gap-2.5">
      {#if Icon}
        <Icon class="w-6 h-6 text-accent shrink-0" aria-hidden="true" />
      {/if}
      <span class="min-w-0">{title}</span>
    </h1>

    {#if description}
      <p class="text-sm text-muted-foreground mt-1.5 max-w-2xl leading-relaxed">{description}</p>
    {/if}
  </div>

  {#if actions}
    <div class="flex flex-wrap items-center gap-2 shrink-0">
      {@render actions()}
    </div>
  {/if}
</header>
