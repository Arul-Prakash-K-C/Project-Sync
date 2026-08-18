<script lang="ts">
  import type { Snippet } from 'svelte';

  /** Any lucide-svelte icon. See PageHeader for why this isn't `Component`. */
  type IconComponent = any;

  let {
    icon,
    title,
    /** Say why it is empty and what to do next — never just "no data". */
    description = '',
    action,
    size = 'md',
    class: className = ''
  }: {
    icon?: IconComponent;
    title: string;
    description?: string;
    action?: Snippet;
    size?: 'sm' | 'md';
    class?: string;
  } = $props();

  const Icon = $derived(icon);
</script>

<div
  class="flex flex-col items-center justify-center text-center rounded-lg border border-dashed border-border
    bg-muted/25 {size === 'sm' ? 'py-8 px-4' : 'py-12 px-6'} {className}"
>
  {#if Icon}
    <div
      class="flex items-center justify-center rounded-md bg-card border border-border text-muted-foreground mb-3
        {size === 'sm' ? 'w-9 h-9' : 'w-11 h-11'}"
      aria-hidden="true"
    >
      <Icon class={size === 'sm' ? 'w-4.5 h-4.5' : 'w-5 h-5'} />
    </div>
  {/if}

  <p class="text-sm font-bold text-foreground">{title}</p>

  {#if description}
    <p class="text-xs text-muted-foreground max-w-sm mt-1.5 leading-relaxed">{description}</p>
  {/if}

  {#if action}
    <div class="mt-4 flex items-center gap-2">
      {@render action()}
    </div>
  {/if}
</div>
