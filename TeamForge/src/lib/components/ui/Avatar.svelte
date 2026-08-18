<script lang="ts">
  let {
    src,
    name,
    size = 'md',
    class: className = '',
    ...rest
  }: {
    src?: string;
    name: string;
    size?: 'xs' | 'sm' | 'md' | 'lg';
    class?: string;
    [key: string]: any;
  } = $props();

  const sizes = {
    xs: 'w-6 h-6 text-3xs',
    sm: 'w-8 h-8 text-2xs',
    md: 'w-10 h-10 text-xs',
    lg: 'w-14 h-14 text-sm'
  };

  // Initials stand in until the remote avatar loads, and stay if it never does.
  const initials = $derived(
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('')
  );

  let failed = $state(false);
</script>

<span
  class="relative inline-flex items-center justify-center shrink-0 overflow-hidden rounded-md
    bg-secondary text-muted-foreground font-bold border border-border {sizes[size]} {className}"
  {...rest}
>
  {#if src && !failed}
    <img
      {src}
      alt={name}
      loading="lazy"
      onerror={() => (failed = true)}
      class="w-full h-full object-cover"
    />
  {:else}
    <span aria-hidden="true">{initials}</span>
    <span class="sr-only">{name}</span>
  {/if}
</span>
