<script lang="ts">
  import { X } from 'lucide-svelte';

  /*
    Chip-style skill entry. Enter or comma adds the typed skill, Backspace on an
    empty field removes the last one, and suggestions come from skills already
    used on the platform so spellings stay consistent (and matching works).
  */
  let {
    skills = $bindable<string[]>([]),
    suggestions = [],
    id,
    placeholder = 'Type a skill and press Enter',
    invalid = false,
    describedby
  }: {
    skills?: string[];
    suggestions?: string[];
    id: string;
    placeholder?: string;
    invalid?: boolean;
    describedby?: string;
  } = $props();

  let draft = $state('');
  let inputEl = $state<HTMLInputElement | null>(null);

  const listId = $derived(`${id}-suggestions`);
  const available = $derived(
    suggestions.filter((s) => !skills.some((k) => k.toLowerCase() === s.toLowerCase()))
  );
  /** Up to six quick picks that match what is being typed. */
  const quickPicks = $derived(
    (draft.trim()
      ? available.filter((s) => s.toLowerCase().includes(draft.trim().toLowerCase()))
      : available
    ).slice(0, 6)
  );

  function add(raw: string) {
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((skill) => {
        // Reuse the platform's spelling when it matches case-insensitively.
        const canonical = suggestions.find((s) => s.toLowerCase() === skill.toLowerCase()) ?? skill;
        if (!skills.some((k) => k.toLowerCase() === canonical.toLowerCase())) {
          skills = [...skills, canonical];
        }
      });
    draft = '';
  }

  function remove(skill: string) {
    skills = skills.filter((s) => s !== skill);
    inputEl?.focus();
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ',') {
      if (draft.trim()) {
        e.preventDefault();
        add(draft);
      } else if (e.key === 'Enter') {
        e.preventDefault(); // don't submit the surrounding form by accident
      }
    } else if (e.key === 'Backspace' && !draft && skills.length > 0) {
      skills = skills.slice(0, -1);
    }
  }
</script>

<div class="flex flex-col gap-2">
  <div
    class="min-h-10 w-full flex flex-wrap items-center gap-1.5 px-2 py-1.5 rounded-md border bg-surface
      transition-colors focus-within:border-accent/60
      {invalid ? 'border-destructive/60' : 'border-input'}"
  >
    {#each skills as skill (skill)}
      <span class="inline-flex items-center gap-1 h-6 pl-2 pr-1 rounded-sm bg-accent/10 text-foreground text-2xs font-semibold">
        {skill}
        <button
          type="button"
          onclick={() => remove(skill)}
          aria-label="Remove {skill}"
          class="p-0.5 rounded-sm text-muted-foreground hover:text-destructive cursor-pointer"
        >
          <X class="w-3 h-3" />
        </button>
      </span>
    {/each}
    <input
      bind:this={inputEl}
      {id}
      type="text"
      bind:value={draft}
      onkeydown={onKeydown}
      onblur={() => draft.trim() && add(draft)}
      list={listId}
      placeholder={skills.length === 0 ? placeholder : 'Add another…'}
      aria-describedby={describedby}
      aria-invalid={invalid || undefined}
      autocomplete="off"
      class="flex-1 min-w-32 h-7 border-0! bg-transparent! px-1 text-sm focus:outline-none shadow-none!"
    />
  </div>
  <datalist id={listId}>
    {#each available as s (s)}<option value={s}></option>{/each}
  </datalist>

  {#if quickPicks.length > 0}
    <div class="flex flex-wrap gap-1.5" aria-label="Suggested skills">
      {#each quickPicks as s (s)}
        <button
          type="button"
          onclick={() => add(s)}
          class="h-6 px-2 rounded-sm border border-dashed border-border text-2xs text-muted-foreground
            hover:border-accent/50 hover:text-foreground transition-colors cursor-pointer"
        >
          + {s}
        </button>
      {/each}
    </div>
  {/if}
</div>
