import { describe, it, expect } from 'vitest';
import { burndown, activityCalendar, statusCounts } from './analytics';
import type { Project, Task } from '$lib/services/db';

const project: Project = {
  id: 'p',
  name: 'P',
  description: '',
  department: 'CSE',
  status: 'active',
  ownerId: 'a',
  ownerName: 'A',
  members: [],
  milestones: [{ id: 'm', title: 'Final', deadline: '2026-09-10', completed: false }],
  pendingInvites: [],
  pendingRequests: [],
  createdAt: '2026-09-01T00:00:00.000Z'
};

function task(over: Partial<Task>): Task {
  return {
    id: Math.random().toString(36),
    projectId: 'p',
    title: 'T',
    description: '',
    column: 'todo',
    priority: 'low',
    deadline: '2026-09-10',
    assignees: [],
    comments: [],
    attachments: [],
    ...over
  };
}

describe('burndown', () => {
  const tasks = [
    task({ createdAt: '2026-09-01T09:00:00.000Z', column: 'completed', completedAt: '2026-09-03T09:00:00.000Z' }),
    task({ createdAt: '2026-09-01T09:00:00.000Z' }),
    task({ createdAt: '2026-09-04T09:00:00.000Z' })
  ];
  const series = burndown([project], tasks, '2026-09-05');

  it('runs from the first task to the final deadline', () => {
    expect(series[0].day).toBe('2026-09-01');
    expect(series.at(-1)!.day).toBe('2026-09-10');
  });

  it('counts open tasks per day, including scope added later', () => {
    const at = (d: string) => series.find((p) => p.day === d)!.remaining;
    expect(at('2026-09-01')).toBe(2);
    expect(at('2026-09-03')).toBe(1);
    expect(at('2026-09-04')).toBe(2);
  });

  it('leaves the future blank and draws the ideal line down to zero', () => {
    expect(series.find((p) => p.day === '2026-09-06')!.remaining).toBeNull();
    expect(series[0].ideal).toBe(3);
    expect(series.at(-1)!.ideal).toBe(0);
  });

  it('estimates legacy tasks from the project start and their deadline', () => {
    const legacy = burndown([project], [task({ column: 'completed', deadline: '2026-09-02' })], '2026-09-05');
    expect(legacy.find((p) => p.day === '2026-09-01')!.remaining).toBe(1);
    expect(legacy.find((p) => p.day === '2026-09-02')!.remaining).toBe(0);
  });
});

describe('activityCalendar', () => {
  it('returns whole Monday-first weeks ending with the current week', () => {
    // 2026-09-29 is a Tuesday.
    const days = activityCalendar({ tasks: [], threads: [], files: [], reports: [], projects: [] }, '2026-09-29', 2);
    expect(days).toHaveLength(14);
    expect(days[0].day).toBe('2026-09-21');
    expect(days.at(-1)!.day).toBe('2026-10-04');
  });

  it('counts every kind of activity on its day', () => {
    const days = activityCalendar(
      {
        tasks: [task({ createdAt: '2026-09-28T10:00:00.000Z', completedAt: '2026-09-28T12:00:00.000Z' })],
        threads: [],
        files: [],
        reports: [],
        projects: [{ ...project, milestones: [{ id: 'm', title: 'M', deadline: 'x', completed: true, completedAt: '2026-09-28' }] }]
      },
      '2026-09-29',
      1
    );
    expect(days.find((d) => d.day === '2026-09-28')!.count).toBe(3);
  });
});

describe('statusCounts', () => {
  it('counts tasks per column', () => {
    expect(statusCounts([task({ column: 'review' }), task({ column: 'review' }), task({})])).toEqual({
      todo: 1,
      inprogress: 0,
      review: 2,
      completed: 0
    });
  });
});
