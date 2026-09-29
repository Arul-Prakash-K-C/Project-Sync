<script lang="ts" module>
  /** Any lucide-svelte icon; the library's exports don't satisfy Svelte's
      `Component` generic, so the slot is structural (as in PageHeader). */
  type IconComponent = any;

  export interface PaletteAction {
    id: string;
    title: string;
    subtitle?: string;
    icon: IconComponent;
    keywords?: string[];
    run: () => void;
  }

  export interface PalettePage {
    href: string;
    label: string;
    group: string;
    icon: IconComponent;
  }
</script>

<script lang="ts">
  import { tick } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { goto } from '$app/navigation';
  import { Search, FolderKanban, CheckSquare, User as UserIcon, CornerDownLeft, History } from 'lucide-svelte';
  import { auth } from '$lib/stores/auth.svelte';
  import { db } from '$lib/services/db';
  import { fuzzyMatchAny } from '$lib/utils/fuzzy';

  /**
   * Command palette (Ctrl+K / ⌘K). One search box over every page, project,
   * task and person the signed-in user can reach, plus quick actions. Results
   * are fuzzy-matched ("tfnd" finds Team Finder) and grouped by kind; recently
   * chosen items come first when the box is empty.
   *
   * Follows the ARIA combobox pattern: focus stays in the input, arrow keys
   * move the active option, Enter runs it, Escape closes.
   */
  let {
    open = $bindable(false),
    pages,
    actions
  }: { open: boolean; pages: PalettePage[]; actions: PaletteAction[] } = $props();

  type Kind = 'recent' | 'page' | 'project' | 'task' | 'person' | 'action';
  interface Item {
    id: string;
    kind: Kind;
    title: string;
    subtitle?: string;
    icon: IconComponent;
    keywords: string[];
    run: () => void;
  }
  interface Result extends Item {
    score: number;
    positions: number[];
  }

  const GROUP_LABEL: Record<Kind, string> = {
    recent: 'Recent',
    action: 'Actions',
    page: 'Pages',
    project: 'Projects',
    task: 'Tasks',
    person: 'People'
  };
  const GROUP_ORDER: Kind[] = ['recent', 'page', 'project', 'task', 'person', 'action'];
  const PER_GROUP = 6;
  const RECENT_KEY = 'teamforge_palette_recent';

  let query = $state('');
  let active = $state(0);
  let items = $state<Item[]>([]);
  let recentIds = $state<string[]>([]);
  let inputEl = $state<HTMLInputElement | null>(null);
  let listEl = $state<HTMLUListElement | null>(null);
  let previouslyFocused: HTMLElement | null = null;

  function nav(href: string) {
    return () => goto(href);
  }

  /** Everything this user can jump to, read fresh each time the palette opens. */
  function buildItems(): Item[] {
    const user = auth.user;
    if (!user) return [];
    const out: Item[] = [];

    for (const p of pages) {
      out.push({ id: `page:${p.href}`, kind: 'page', title: p.label, subtitle: p.group, icon: p.icon, keywords: [p.group], run: nav(p.href) });
    }

    const all = db.getProjects();
    const projects =
      user.role === 'student'
        ? all.filter((p) => p.members.some((m) => m.userId === user.id) || p.pendingInvites.includes(user.id))
        : user.role === 'faculty'
          ? db.getSupervisedProjects(user)
          : all;
    const projectHref = (id: string, status: string) =>
      user.role === 'student'
        ? `/dashboard/student/project/${id}`
        : user.role === 'faculty'
          ? status === 'pending'
            ? '/dashboard/faculty/approvals'
            : `/dashboard/faculty/milestones?project=${id}`
          : '/dashboard/admin';
    for (const p of projects) {
      out.push({
        id: `project:${p.id}`,
        kind: 'project',
        title: p.name,
        subtitle: `${p.status} · lead ${p.ownerName}`,
        icon: FolderKanban,
        keywords: [p.description, ...(p.requiredSkills ?? [])],
        run: nav(projectHref(p.id, p.status))
      });
    }

    // The task board lives in the student workspace.
    if (user.role === 'student') {
      const ids = new Set(projects.filter((p) => p.members.some((m) => m.userId === user.id)).map((p) => p.id));
      const names = new Map(projects.map((p) => [p.id, p.name]));
      const columnLabel = { todo: 'To do', inprogress: 'In progress', review: 'In review', completed: 'Completed' };
      for (const t of db.getTasks().filter((t) => ids.has(t.projectId))) {
        out.push({
          id: `task:${t.id}`,
          kind: 'task',
          title: t.title,
          subtitle: `${names.get(t.projectId)} · ${columnLabel[t.column]} · due ${t.deadline}`,
          icon: CheckSquare,
          keywords: [t.description, t.assignees.includes(user.id) ? 'mine assigned to me' : ''],
          run: nav(`/dashboard/student/project/${t.projectId}?tab=kanban&task=${t.id}`)
        });
      }

      for (const u of db.getUsers().filter((u) => u.role === 'student' && u.id !== user.id)) {
        out.push({
          id: `person:${u.id}`,
          kind: 'person',
          title: u.name,
          subtitle: `${u.department}${u.availability ? '' : ' · not taking projects'}`,
          icon: UserIcon,
          keywords: u.skills,
          run: nav(`/dashboard/student/team-finder?q=${encodeURIComponent(u.name)}`)
        });
      }
    }

    for (const a of actions) {
      out.push({ id: `action:${a.id}`, kind: 'action', title: a.title, subtitle: a.subtitle, icon: a.icon, keywords: a.keywords ?? [], run: a.run });
    }
    return out;
  }

  const results = $derived.by((): Result[] => {
    if (!query.trim()) {
      const byId = new Map(items.map((i) => [i.id, i]));
      const recent = recentIds
        .map((id) => byId.get(id))
        .filter((i): i is Item => !!i)
        .map((i) => ({ ...i, kind: 'recent' as Kind, score: 0, positions: [] }));
      const shown = new Set(recent.map((r) => r.id));
      const rest = items
        .filter((i) => (i.kind === 'page' || i.kind === 'action') && !shown.has(i.id))
        .map((i) => ({ ...i, score: 0, positions: [] }));
      return [...recent, ...rest];
    }
    const matched: Result[] = [];
    for (const i of items) {
      const m = fuzzyMatchAny(query, [i.title, i.subtitle ?? '', ...i.keywords]);
      if (m) matched.push({ ...i, score: m.score, positions: m.positions });
    }
    // Best matches first within each group, and the group holding the best
    // match first, so Enter always runs the strongest hit.
    const grouped = GROUP_ORDER.map((kind) =>
      matched
        .filter((r) => r.kind === kind)
        .sort((a, b) => b.score - a.score)
        .slice(0, PER_GROUP)
    ).filter((g) => g.length);
    return grouped.sort((a, b) => b[0].score - a[0].score).flat();
  });

  /** Groups in the order their rows appear in `results`. */
  const groups = $derived(
    [...new Set(results.map((r) => r.kind))].map((kind) => ({ kind, rows: results.filter((r) => r.kind === kind) }))
  );

  $effect(() => {
    // Any change to the query resets the active row to the top.
    query;
    active = 0;
  });

  $effect(() => {
    if (open) {
      previouslyFocused = document.activeElement as HTMLElement | null;
      items = buildItems();
      try {
        recentIds = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
      } catch {
        recentIds = [];
      }
      query = '';
      tick().then(() => inputEl?.focus());
    } else if (previouslyFocused) {
      previouslyFocused.focus?.();
      previouslyFocused = null;
    }
  });

  function choose(r: Result) {
    const id = r.id;
    recentIds = [id, ...recentIds.filter((x) => x !== id)].slice(0, 5);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(recentIds));
    } catch {
      // Private mode: recents just won't persist.
    }
    open = false;
    r.run();
  }

  function onKeydown(e: KeyboardEvent) {
    const n = results.length;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      active = n ? (active + 1) % n : 0;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      active = n ? (active - 1 + n) % n : 0;
    } else if (e.key === 'Home' && e.ctrlKey) {
      active = 0;
    } else if (e.key === 'End' && e.ctrlKey) {
      active = Math.max(0, n - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[active]) choose(results[active]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      open = false;
    } else if (e.key === 'Tab') {
      // Focus stays in the search box while the palette is open.
      e.preventDefault();
    }
    tick().then(() => listEl?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' }));
  }

  /** Splits a title into matched / unmatched runs for highlighting. */
  function segments(text: string, positions: number[]) {
    if (!positions.length) return [{ text, hit: false }];
    const set = new Set(positions);
    const out: { text: string; hit: boolean }[] = [];
    for (let i = 0; i < text.length; i++) {
      const hit = set.has(i);
      if (out.length && out[out.length - 1].hit === hit) out[out.length - 1].text += text[i];
      else out.push({ text: text[i], hit });
    }
    return out;
  }
</script>

{#if open}
  <button
    class="fixed inset-0 z-60 bg-black/45 cursor-default"
    aria-label="Close command palette"
    tabindex="-1"
    onclick={() => (open = false)}
    transition:fade={{ duration: 120 }}
  ></button>

  <div
    role="dialog"
    aria-modal="true"
    aria-label="Command palette"
    class="fixed z-61 left-1/2 top-[12vh] -translate-x-1/2 w-[calc(100%-2rem)] max-w-xl rounded-lg border border-border
      bg-popover text-popover-foreground shadow-e3 overflow-hidden flex flex-col max-h-[70vh]"
    transition:scale={{ start: 0.97, duration: 160, easing: cubicOut }}
  >
    <div class="flex items-center gap-2.5 px-4 h-13 border-b border-border shrink-0">
      <Search class="w-4.5 h-4.5 text-muted-foreground shrink-0" aria-hidden="true" />
      <input
        bind:this={inputEl}
        bind:value={query}
        onkeydown={onKeydown}
        type="text"
        role="combobox"
        aria-expanded="true"
        aria-controls="palette-list"
        aria-activedescendant={results[active] ? `palette-opt-${active}` : undefined}
        aria-autocomplete="list"
        autocomplete="off"
        spellcheck="false"
        placeholder="Search pages, projects, tasks, people…"
        class="palette-input flex-1 min-w-0 h-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
      />
      <kbd class="hidden sm:inline-flex h-5 px-1.5 items-center rounded-sm border border-border text-3xs font-semibold text-muted-foreground">
        Esc
      </kbd>
    </div>

    <ul id="palette-list" role="listbox" aria-label="Results" bind:this={listEl} class="flex-1 overflow-y-auto p-2">
      {#each groups as g (g.kind)}
        <li role="presentation" class="px-2 pt-2 pb-1 eyebrow flex items-center gap-1.5">
          {#if g.kind === 'recent'}<History class="w-3 h-3" aria-hidden="true" />{/if}
          {GROUP_LABEL[g.kind]}
        </li>
        {#each g.rows as r (r.id + g.kind)}
          {@const index = results.indexOf(r)}
          <li
            id="palette-opt-{index}"
            data-index={index}
            role="option"
            aria-selected={index === active}
            class="flex items-center gap-3 px-2.5 py-2 rounded-md cursor-pointer
              {index === active ? 'bg-accent/10' : 'hover:bg-secondary'}"
            onpointermove={() => (active = index)}
            onclick={() => choose(r)}
            onkeydown={() => {}}
          >
            <span
              class="w-7 h-7 rounded-md border flex items-center justify-center shrink-0
                {index === active ? 'border-accent/40 text-accent' : 'border-border text-muted-foreground'}"
            >
              <r.icon class="w-3.5 h-3.5" aria-hidden="true" />
            </span>
            <span class="flex-1 min-w-0 leading-tight">
              <span class="block text-sm text-foreground truncate">
                {#each segments(r.title, r.positions) as seg, si (si)}
                  {#if seg.hit}<mark class="bg-transparent text-accent font-bold">{seg.text}</mark>{:else}{seg.text}{/if}
                {/each}
              </span>
              {#if r.subtitle}
                <span class="block text-2xs text-muted-foreground truncate capitalize-first">{r.subtitle}</span>
              {/if}
            </span>
            {#if index === active}
              <CornerDownLeft class="w-3.5 h-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
            {/if}
          </li>
        {/each}
      {:else}
        <li role="presentation" class="px-3 py-10 text-center text-sm text-muted-foreground">
          Nothing matches “{query}”.
        </li>
      {/each}
    </ul>

    <div class="hidden sm:flex items-center gap-4 px-4 h-9 border-t border-border text-3xs text-muted-foreground shrink-0">
      <span><kbd class="font-semibold">↑↓</kbd> move</span>
      <span><kbd class="font-semibold">Enter</kbd> open</span>
      <span><kbd class="font-semibold">Esc</kbd> close</span>
      <span class="ml-auto"><kbd class="font-semibold">Ctrl K</kbd> anywhere</span>
    </div>
  </div>
{/if}

<style>
  /* The open palette is itself the focus indicator; the global ring would
     draw a second box inside it. */
  .palette-input:focus-visible {
    box-shadow: none;
  }

  .capitalize-first::first-letter {
    text-transform: uppercase;
  }
</style>
