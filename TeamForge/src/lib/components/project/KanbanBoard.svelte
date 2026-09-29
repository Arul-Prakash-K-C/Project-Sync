<script lang="ts">
  import { tick } from 'svelte';
  import { flip } from 'svelte/animate';
  import { Calendar, GripVertical, MessageCircle } from 'lucide-svelte';
  import { byBoardOrder, type ProjectMember, type Task, type TaskColumn } from '$lib/services/db';
  import Avatar from '$lib/components/ui/Avatar.svelte';
  import { emitSparks } from '$lib/actions/forge';

  /**
   * The project task board. People who manage the board drag cards between
   * columns and reorder them within a column; a drop line shows where the
   * card will land. Dragging needs a mouse, so every card also keeps its
   * labelled status select: the board works the same from a keyboard, a
   * screen reader or a touch screen. Everyone else sees the board read-only.
   */
  let {
    tasks,
    members,
    canManage,
    today,
    onopen,
    onmove
  }: {
    tasks: Task[];
    members: ProjectMember[];
    canManage: boolean;
    today: string;
    onopen: (task: Task) => void;
    /** `index` is the position among the column's other tasks. */
    onmove: (taskId: string, column: TaskColumn, index: number) => void;
  } = $props();

  /* The lanes run cold to hot like a forge line: a blueprint to-do, work
     warming up, review at heat, and completed work quenched. */
  const columns = [
    { key: 'todo', label: 'To do', rule: 'bg-muted-foreground', stage: 'cold' },
    { key: 'inprogress', label: 'In progress', rule: 'bg-info', stage: 'warm' },
    { key: 'review', label: 'In review', rule: 'bg-warning', stage: 'hot' },
    { key: 'completed', label: 'Completed', rule: 'bg-success', stage: 'quenched' }
  ] as const;

  const priorityHeat = {
    high: 'var(--ember)',
    medium: 'var(--warning)',
    low: 'color-mix(in oklab, var(--info) 70%, transparent)'
  } as const;

  /** Short, stable ticket code from the task id, e.g. "T·4F2". */
  const code = (id: string) => `T·${id.replace(/[^a-z0-9]/gi, '').slice(-3).toUpperCase()}`;

  let landedId = $state<string | null>(null);
  let landTimer: ReturnType<typeof setTimeout>;

  /** The moved ticket lands with a clank; sparks fly, green and bigger when work is completed. */
  async function land(taskId: string, column: TaskColumn, point?: { x: number; y: number }) {
    clearTimeout(landTimer);
    landedId = null;
    await tick();
    landedId = taskId;
    landTimer = setTimeout(() => (landedId = null), 1200);
    let at = point;
    if (!at) {
      await tick();
      const el = document.querySelector(`[data-task-id="${CSS.escape(taskId)}"]`);
      const r = el?.getBoundingClientRect();
      if (r) at = { x: r.left + r.width / 2, y: r.top + 8 };
    }
    if (at) {
      const done = column === 'completed';
      emitSparks(at.x, at.y, {
        count: done ? 22 : 10,
        power: done ? 1.35 : 0.9,
        color: done ? 'var(--success)' : undefined
      });
    }
  }

  const lanes = $derived(
    Object.fromEntries(columns.map((c) => [c.key, tasks.filter((t) => t.column === c.key).sort(byBoardOrder)])) as Record<
      TaskColumn,
      Task[]
    >
  );

  let dragId = $state<string | null>(null);
  let drop = $state<{ column: TaskColumn; index: number } | null>(null);
  let announcement = $state('');

  const memberById = $derived(new Map(members.map((m) => [m.userId, m])));

  function onDragStart(e: DragEvent, task: Task) {
    if (!canManage || !e.dataTransfer) return;
    dragId = task.id;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', task.id);

    // Drag a tilted copy of the ticket, as if lifted off the board with tongs.
    const shell = e.currentTarget as HTMLElement;
    const r = shell.getBoundingClientRect();
    const wrap = document.createElement('div');
    wrap.style.cssText = `position:fixed;left:-2000px;top:0;padding:28px;width:${r.width + 56}px;pointer-events:none`;
    const ghost = shell.cloneNode(true) as HTMLElement;
    ghost.removeAttribute('data-dragging');
    ghost.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
    ghost.style.transform = 'rotate(-3deg)';
    ghost.style.filter = 'drop-shadow(0 18px 22px rgba(0,0,0,0.28))';
    wrap.appendChild(ghost);
    document.body.appendChild(wrap);
    e.dataTransfer.setDragImage(wrap, e.clientX - r.left + 28, e.clientY - r.top + 28);
    setTimeout(() => wrap.remove(), 0);
  }

  function reset() {
    dragId = null;
    drop = null;
  }

  /** Works out the insertion index from the pointer's height against each card's midpoint. */
  function onDragOver(e: DragEvent, column: TaskColumn) {
    if (!dragId) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    const cards = [...(e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('[data-task-id]')].filter(
      (el) => el.dataset.taskId !== dragId
    );
    let index = cards.length;
    for (let i = 0; i < cards.length; i++) {
      const r = cards[i].getBoundingClientRect();
      if (e.clientY < r.top + r.height / 2) {
        index = i;
        break;
      }
    }
    if (drop?.column !== column || drop.index !== index) drop = { column, index };
  }

  function onDragLeave(e: DragEvent, column: TaskColumn) {
    const into = e.relatedTarget as Node | null;
    if (drop?.column === column && !(e.currentTarget as HTMLElement).contains(into)) drop = null;
  }

  function onDrop(e: DragEvent, column: TaskColumn) {
    e.preventDefault();
    if (dragId && drop && drop.column === column) {
      const task = tasks.find((t) => t.id === dragId);
      const current = lanes[column].filter((t) => t.id !== dragId);
      const unchanged = task?.column === column && lanes[column].indexOf(task) === drop.index;
      if (task && !unchanged) {
        onmove(task.id, column, drop.index);
        announce(task, column, drop.index, current.length + 1);
        land(task.id, column, { x: e.clientX, y: e.clientY });
      }
    }
    reset();
  }

  function moveWithSelect(task: Task, column: TaskColumn) {
    // A status change from the select puts the card at the bottom of its new column.
    const index = lanes[column].filter((t) => t.id !== task.id).length;
    onmove(task.id, column, index);
    announce(task, column, index, index + 1);
    land(task.id, column);
  }

  function announce(task: Task, column: TaskColumn, index: number, count: number) {
    const label = columns.find((c) => c.key === column)!.label;
    announcement = `Moved "${task.title}" to ${label}, position ${index + 1} of ${count}.`;
  }

  /** Index of a card among the column's cards, not counting the one being dragged. */
  function slotOf(column: TaskColumn, task: Task): number {
    return lanes[column].filter((t) => t.id !== dragId).indexOf(task);
  }
</script>

<p class="sr-only" role="status" aria-live="polite">{announcement}</p>

<!-- Four lanes side by side on desktop; on narrow screens they stack so the
     cards stay readable instead of shrinking to a sliver. -->
<div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 items-start">
  {#each columns as col (col.key)}
    {@const colTasks = lanes[col.key]}
    {@const isTarget = drop?.column === col.key}
    <section
      aria-label="{col.label} column"
      data-stage={col.stage}
      class="lane flex flex-col gap-3 p-3 border rounded-lg xl:min-h-112 transition-[border-color,background-color] duration-300
        {isTarget ? 'border-accent/50 lane-target' : 'border-border'}"
      ondragover={(e) => onDragOver(e, col.key)}
      ondragleave={(e) => onDragLeave(e, col.key)}
      ondrop={(e) => onDrop(e, col.key)}
    >
      <div class="flex items-center gap-2 pb-2.5 border-b border-border">
        <span class="w-1.5 h-1.5 rounded-full {col.rule}" aria-hidden="true"></span>
        <h3 class="text-2xs font-bold uppercase tracking-wider text-foreground">{col.label}</h3>
        <span class="ml-auto font-mono text-2xs font-semibold text-muted-foreground">
          {String(colTasks.length).padStart(2, '0')}
        </span>
      </div>

      <ul class="flex flex-col gap-3">
        {#each colTasks as t (t.id)}
          {@const overdue = t.deadline < today && t.column !== 'completed'}
          <li
            data-task-id={t.id}
            animate:flip={{ duration: 220 }}
            draggable={canManage}
            ondragstart={(e) => onDragStart(e, t)}
            ondragend={reset}
            data-grab={canManage || undefined}
            data-dragging={dragId === t.id || undefined}
            data-landed={landedId === t.id || undefined}
            class="ticket-shell {canManage ? 'cursor-grab active:cursor-grabbing' : ''}
              {isTarget && dragId !== t.id && slotOf(col.key, t) === drop?.index ? 'drop-before' : ''}"
          >
            <div class="ticket">
              <span
                class="ticket-heat"
                style="--heat: {priorityHeat[t.priority]}"
                data-hot={t.priority === 'high' || undefined}
                data-overdue={(overdue && t.priority === 'high') || undefined}
                aria-hidden="true"
              ></span>

              <!-- Stub: code, priority and due date, torn off from the body by a perforation. -->
              <div class="ticket-stub">
                {#if canManage}
                  <GripVertical class="w-3.5 h-3.5 -ml-1.5 shrink-0 text-muted-foreground/50" aria-hidden="true" />
                {/if}
                <span class="font-mono text-3xs font-semibold tracking-wider text-muted-foreground">{code(t.id)}</span>
                <span
                  class="font-mono text-3xs font-bold uppercase tracking-wider"
                  style="color: {t.priority === 'low' ? 'var(--info)' : priorityHeat[t.priority]}"
                >
                  {t.priority}<span class="sr-only"> priority</span>
                </span>
                <span
                  class="ml-auto inline-flex items-center gap-1 font-mono text-3xs font-semibold
                    {overdue ? 'text-destructive' : 'text-muted-foreground'}"
                >
                  <Calendar class="w-3 h-3" aria-hidden="true" />
                  {t.deadline.slice(5).replace('-', '/')}
                  {#if overdue}<span class="sr-only">(overdue)</span>{/if}
                </span>
              </div>
              <div class="ticket-perf" aria-hidden="true"></div>

              <button onclick={() => onopen(t)} class="block w-full text-left px-3.5 pt-2.5 pb-3 cursor-pointer rounded-b-md">
                <span class="block text-sm font-bold text-foreground line-clamp-2 leading-snug">{t.title}</span>
                {#if t.description}
                  <span class="block text-2xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">{t.description}</span>
                {/if}
                <span class="mt-3 flex items-center gap-3">
                  {#if t.comments.length > 0}
                    <span class="inline-flex items-center gap-1 text-3xs font-semibold text-muted-foreground tabular">
                      <MessageCircle class="w-3 h-3" aria-hidden="true" />
                      {t.comments.length}
                      <span class="sr-only">comments</span>
                    </span>
                  {/if}
                  <span class="ml-auto flex -space-x-1.5">
                    {#each t.assignees.slice(0, 3) as uid (uid)}
                      {@const m = memberById.get(uid)}
                      {#if m}
                        <Avatar src={m.avatar} userId={uid} name={m.name} size="xs" class="ring-2 ring-card" title={m.name} />
                      {/if}
                    {/each}
                  </span>
                </span>
              </button>

              {#if canManage}
                <div class="px-3.5 pb-3 pt-0">
                  <label for="move-{t.id}" class="sr-only">Status of "{t.title}"</label>
                  <select
                    id="move-{t.id}"
                    value={t.column}
                    onchange={(e) => moveWithSelect(t, (e.target as HTMLSelectElement).value as TaskColumn)}
                    class="field-select h-8 w-full text-2xs font-semibold"
                  >
                    {#each columns as target (target.key)}
                      <option value={target.key}>{target.label}</option>
                    {/each}
                  </select>
                </div>
              {/if}
            </div>
          </li>
        {/each}
      </ul>

      {#if colTasks.filter((t) => t.id !== dragId).length === 0}
        <p
          class="py-6 text-center text-2xs border border-dashed rounded-md font-mono uppercase tracking-wider
            {isTarget ? 'border-accent text-accent font-semibold' : 'border-border text-muted-foreground'}"
        >
          {dragId ? 'Drop to place' : 'Empty'}
        </p>
      {:else if isTarget && drop?.index === colTasks.filter((t) => t.id !== dragId).length}
        <div class="drop-end" aria-hidden="true"></div>
      {/if}
    </section>
  {/each}
</div>

<style>
  /* Lanes, cold to hot. */
  .lane {
    background-color: color-mix(in oklab, var(--muted) 45%, transparent);
  }
  .lane[data-stage='cold'] {
    background-image:
      linear-gradient(to right, color-mix(in oklab, var(--info) 6%, transparent) 1px, transparent 1px),
      linear-gradient(to bottom, color-mix(in oklab, var(--info) 6%, transparent) 1px, transparent 1px);
    background-size: 18px 18px;
  }
  .lane[data-stage='warm'] {
    background-image: linear-gradient(to bottom, color-mix(in oklab, var(--info) 8%, transparent), transparent 40%);
  }
  .lane[data-stage='hot'] {
    background-image: linear-gradient(to bottom, color-mix(in oklab, var(--ember) 10%, transparent), transparent 45%);
  }
  .lane[data-stage='quenched'] {
    background-image: linear-gradient(to bottom, color-mix(in oklab, var(--success) 9%, transparent), transparent 40%);
  }
  .lane-target {
    background-color: color-mix(in oklab, var(--ember) 7%, transparent);
  }

  /* Drop line above the ticket the dragged task will be inserted before, and at a lane's end. */
  .drop-before::before,
  .drop-end {
    content: '';
    display: block;
    height: 3px;
    border-radius: 9999px;
    background: linear-gradient(90deg, transparent, var(--ember) 20%, var(--ember-hot) 50%, var(--ember) 80%, transparent);
    box-shadow: 0 0 10px color-mix(in oklab, var(--ember) 60%, transparent);
  }
  .drop-before::before {
    position: absolute;
    left: 0;
    right: 0;
    top: -8px;
  }
  .drop-end {
    margin-top: -0.25rem;
  }
</style>
