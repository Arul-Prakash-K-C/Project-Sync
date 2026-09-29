import type { Project, Task, Thread, ProjectFile, WeeklyReport, TaskColumn } from '$lib/services/db';

/** Chart-ready figures derived from project data. Pure, so they are testable. */

const DAY_MS = 86_400_000;

export function isoDay(d: Date | string): string {
  return (typeof d === 'string' ? d : d.toISOString()).slice(0, 10);
}

export function addDays(day: string, n: number): string {
  return isoDay(new Date(Date.parse(day) + n * DAY_MS));
}

function dayDiff(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS);
}

// ------------------------------------------------------------------ burndown

export interface BurndownPoint {
  day: string;
  /** Open tasks at the end of that day; null past today (the future isn't known). */
  remaining: number | null;
  /** Straight line from the full scope on day one to zero on the final deadline. */
  ideal: number;
}

/**
 * Remaining-work series for a set of projects. Tasks recorded before board
 * history existed have no timestamps: they are treated as created with their
 * project and, if finished, completed on their deadline, which is the best
 * available estimate.
 */
export function burndown(projects: Project[], tasks: Task[], today: string): BurndownPoint[] {
  if (projects.length === 0 || tasks.length === 0) return [];
  const projectStart = new Map(projects.map((p) => [p.id, isoDay(p.createdAt)]));
  const spans = tasks.map((t) => {
    const created = isoDay(t.createdAt ?? projectStart.get(t.projectId) ?? today);
    const done = t.column === 'completed' ? isoDay(t.completedAt ?? t.deadline ?? today) : null;
    return { created, done };
  });

  const start = spans.reduce((min, s) => (s.created < min ? s.created : min), today);
  const deadlines = projects.flatMap((p) => p.milestones.map((m) => m.extendedDeadline ?? m.deadline));
  const finalDeadline = deadlines.reduce((max, d) => (d > max ? d : max), today);
  const end = finalDeadline;

  const total = tasks.length;
  const idealSpan = Math.max(1, dayDiff(start, end));
  const days = dayDiff(start, end);
  // Keep the series to at most ~120 points so long projects stay light to draw.
  const step = Math.max(1, Math.ceil(days / 120));

  const points: BurndownPoint[] = [];
  for (let i = 0; i <= days; i += step) {
    const day = addDays(start, i);
    points.push({ day, remaining: day <= today ? openOn(day) : null, ideal: idealAt(day) });
  }
  // Always include today and the last day exactly, whatever the step.
  for (const day of [today, end]) {
    if (day >= start && day <= end && !points.some((p) => p.day === day)) {
      points.push({ day, remaining: day <= today ? openOn(day) : null, ideal: idealAt(day) });
    }
  }
  return points.sort((a, b) => a.day.localeCompare(b.day));

  function openOn(day: string): number {
    return spans.filter((s) => s.created <= day && (!s.done || s.done > day)).length;
  }
  function idealAt(day: string): number {
    return Math.max(0, Math.round((total * (1 - dayDiff(start, day) / idealSpan)) * 10) / 10);
  }
}

// ------------------------------------------------------------------ activity

export interface ActivityDay {
  day: string;
  count: number;
}

export interface ActivitySources {
  tasks: Task[];
  threads: Thread[];
  files: ProjectFile[];
  reports: WeeklyReport[];
  projects: Project[];
}

/**
 * Daily activity for a calendar heatmap: tasks created and completed, task
 * comments, discussion posts and replies, uploads, weekly reports and
 * milestones ticked off. Returns `weeks` whole weeks (Monday first) ending
 * with the week that contains `today`.
 */
export function activityCalendar(src: ActivitySources, today: string, weeks = 12): ActivityDay[] {
  const counts = new Map<string, number>();
  const bump = (iso?: string) => {
    if (!iso) return;
    const d = isoDay(iso);
    counts.set(d, (counts.get(d) ?? 0) + 1);
  };
  src.tasks.forEach((t) => {
    bump(t.createdAt);
    bump(t.completedAt);
    t.comments.forEach((c) => bump(c.createdAt));
  });
  src.threads.forEach((t) => {
    bump(t.createdAt);
    t.replies.forEach((r) => bump(r.createdAt));
  });
  src.files.forEach((f) => bump(f.createdAt));
  src.reports.forEach((r) => bump(r.submittedAt));
  src.projects.forEach((p) => p.milestones.forEach((m) => bump(m.completedAt)));

  // getUTCDay: 0 = Sunday. Shift so Monday starts the week.
  const weekday = (new Date(today).getUTCDay() + 6) % 7;
  const last = addDays(today, 6 - weekday);
  const first = addDays(last, -(weeks * 7 - 1));
  return Array.from({ length: weeks * 7 }, (_, i) => {
    const day = addDays(first, i);
    return { day, count: counts.get(day) ?? 0 };
  });
}

// ------------------------------------------------------------------ board

export const COLUMN_ORDER: TaskColumn[] = ['todo', 'inprogress', 'review', 'completed'];

export function statusCounts(tasks: Task[]): Record<TaskColumn, number> {
  const counts: Record<TaskColumn, number> = { todo: 0, inprogress: 0, review: 0, completed: 0 };
  tasks.forEach((t) => counts[t.column]++);
  return counts;
}
