import type { Meeting, Project, Task, WeeklyReport } from '$lib/services/db';

/**
 * Team risk score: an explainable 0–100 estimate of how likely a team is to
 * miss its goals, built from signals the app already records. Every point is
 * traceable to one factor, so a mentor can see *why* a team is flagged rather
 * than trusting an opaque number.
 *
 * Factor ceilings add up to 100:
 *   overdue milestones 25 · overdue tasks 20 · attendance 20
 *   idle members 15 · reporting gaps 15 · behind schedule 5
 */

export type RiskLevel = 'low' | 'medium' | 'high';

export interface RiskFactor {
  key: 'milestones' | 'tasks' | 'attendance' | 'workload' | 'reporting' | 'schedule';
  label: string;
  points: number;
  max: number;
  /** One line explaining the points, written for the mentor. */
  detail: string;
}

export interface TeamRisk {
  score: number;
  level: RiskLevel;
  /** Every factor, largest contribution first. */
  factors: RiskFactor[];
}

export interface RiskInput {
  project: Project;
  /** This project's tasks. */
  tasks: Task[];
  /** This project's meetings. */
  meetings: Meeting[];
  /** This project's weekly reports. */
  reports: WeeklyReport[];
  /** Today as `YYYY-MM-DD`; injected so the score is testable. */
  today: string;
}

export const RISK_THRESHOLDS = { medium: 25, high: 50 } as const;

const DAY_MS = 86_400_000;

function daysBetween(fromIso: string, toIso: string): number {
  return Math.floor((Date.parse(toIso.slice(0, 10)) - Date.parse(fromIso.slice(0, 10))) / DAY_MS);
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export function riskLevel(score: number): RiskLevel {
  if (score >= RISK_THRESHOLDS.high) return 'high';
  if (score >= RISK_THRESHOLDS.medium) return 'medium';
  return 'low';
}

export function calculateTeamRisk({ project, tasks, meetings, reports, today }: RiskInput): TeamRisk {
  const factors: RiskFactor[] = [];

  // 1. Milestones past their (possibly extended) deadline and not done.
  const overdueMilestones = project.milestones.filter(
    (m) => !m.completed && (m.extendedDeadline ?? m.deadline) < today
  );
  factors.push({
    key: 'milestones',
    label: 'Overdue milestones',
    max: 25,
    points: Math.min(overdueMilestones.length * 12, 25),
    detail:
      overdueMilestones.length === 0
        ? 'Every milestone is on time.'
        : `${plural(overdueMilestones.length, 'milestone')} past deadline: ${overdueMilestones.map((m) => m.title).join(', ')}.`
  });

  // 2. Share of open tasks already past their deadline.
  const openTasks = tasks.filter((t) => t.column !== 'completed');
  const overdueTasks = openTasks.filter((t) => t.deadline && t.deadline < today);
  factors.push({
    key: 'tasks',
    label: 'Overdue tasks',
    max: 20,
    points: openTasks.length ? Math.round((overdueTasks.length / openTasks.length) * 20) : 0,
    detail: openTasks.length
      ? `${overdueTasks.length} of ${plural(openTasks.length, 'open task')} past deadline.`
      : 'No open tasks.'
  });

  // 3. Team attendance at review meetings. Excused absences don't count against it.
  let attended = 0;
  let counted = 0;
  meetings
    .filter((m) => m.status === 'scheduled' && m.attendance)
    .forEach((m) =>
      Object.values(m.attendance!).forEach((status) => {
        if (status === 'excused') return;
        counted++;
        if (status === 'present' || status === 'late') attended++;
      })
    );
  const attendanceRate = counted ? Math.round((attended / counted) * 100) : null;
  factors.push({
    key: 'attendance',
    label: 'Low attendance',
    max: 20,
    points: attendanceRate === null ? 0 : Math.min(20, Math.max(0, Math.round((90 - attendanceRate) / 2))),
    detail:
      attendanceRate === null
        ? 'No meeting register taken yet.'
        : `Team attendance is ${attendanceRate}% (flagged below 90%).`
  });

  // 4. Members with nothing assigned, once there is work to share.
  const idle = tasks.length
    ? project.members.filter((m) => !tasks.some((t) => t.assignees.includes(m.userId)))
    : [];
  factors.push({
    key: 'workload',
    label: 'Idle members',
    max: 15,
    points: project.members.length ? Math.round((idle.length / project.members.length) * 15) : 0,
    detail: idle.length
      ? `${idle.map((m) => m.name).join(', ')} ${idle.length === 1 ? 'has' : 'have'} no tasks assigned.`
      : tasks.length
        ? 'Everyone on the team has assigned work.'
        : 'No tasks created yet.'
  });

  // 5. Weekly reporting: silence, and revisions left unanswered.
  const sorted = [...reports].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  const latest = sorted[0];
  const silentDays = daysBetween(latest?.submittedAt ?? project.createdAt, today);
  const silencePoints = silentDays >= 21 ? 10 : silentDays >= 14 ? 6 : 0;
  const revisionPoints = latest?.status === 'revision_requested' ? 5 : 0;
  factors.push({
    key: 'reporting',
    label: 'Reporting gaps',
    max: 15,
    points: silencePoints + revisionPoints,
    detail: [
      latest
        ? `Last weekly report ${silentDays === 0 ? 'today' : `${plural(silentDays, 'day')} ago`}.`
        : `No weekly report in ${plural(silentDays, 'day')}.`,
      revisionPoints ? 'The latest report is waiting on requested revisions.' : ''
    ]
      .filter(Boolean)
      .join(' ')
  });

  // 6. Milestones completed versus time elapsed towards the final deadline.
  const deadlines = project.milestones.map((m) => m.extendedDeadline ?? m.deadline).sort();
  const finalDeadline = deadlines[deadlines.length - 1];
  let schedulePoints = 0;
  let scheduleDetail = 'No milestones to measure against.';
  if (finalDeadline) {
    const span = Math.max(1, daysBetween(project.createdAt, finalDeadline));
    const elapsed = Math.min(1, Math.max(0, daysBetween(project.createdAt, today) / span));
    const done = project.milestones.filter((m) => m.completed).length / project.milestones.length;
    const gap = elapsed - done;
    schedulePoints = gap > 0.1 ? Math.min(5, Math.round(gap * 10)) : 0;
    scheduleDetail = `${Math.round(elapsed * 100)}% of the timeline used, ${Math.round(done * 100)}% of milestones done.`;
  }
  factors.push({
    key: 'schedule',
    label: 'Behind schedule',
    max: 5,
    points: schedulePoints,
    detail: scheduleDetail
  });

  const score = Math.min(
    100,
    factors.reduce((sum, f) => sum + f.points, 0)
  );
  return { score, level: riskLevel(score), factors: factors.sort((a, b) => b.points - a.points) };
}
