import { describe, it, expect } from 'vitest';
import { calculateTeamRisk, riskLevel } from './risk';
import type { Meeting, Project, Task, WeeklyReport } from '$lib/services/db';

const TODAY = '2026-09-29';

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    name: 'Test project',
    description: '',
    department: 'CSE',
    status: 'active',
    ownerId: 'a',
    ownerName: 'Ann',
    members: [
      { userId: 'a', name: 'Ann', role: 'Team Leader', avatar: '' },
      { userId: 'b', name: 'Ben', role: 'Team Member', avatar: '' }
    ],
    milestones: [],
    pendingInvites: [],
    pendingRequests: [],
    createdAt: '2026-09-20T00:00:00.000Z',
    ...overrides
  };
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: Math.random().toString(36),
    projectId: 'p1',
    title: 'Task',
    description: '',
    column: 'todo',
    priority: 'medium',
    deadline: '2026-10-30',
    assignees: ['a'],
    comments: [],
    attachments: [],
    ...overrides
  };
}

function report(submittedAt: string, status: WeeklyReport['status'] = 'approved'): WeeklyReport {
  return {
    id: submittedAt,
    projectId: 'p1',
    weekNumber: 1,
    submittedBy: 'a',
    submittedByName: 'Ann',
    submittedAt,
    achievements: '',
    plannedTasks: '',
    blockers: '',
    status,
    feedback: ''
  };
}

function factor(risk: ReturnType<typeof calculateTeamRisk>, key: string) {
  return risk.factors.find((f) => f.key === key)!;
}

describe('calculateTeamRisk', () => {
  it('scores a healthy new team as low risk', () => {
    const risk = calculateTeamRisk({
      project: makeProject({
        createdAt: '2026-09-27T00:00:00.000Z',
        milestones: [{ id: 'm', title: 'M', deadline: '2026-12-01', completed: false }]
      }),
      tasks: [makeTask({ assignees: ['a'] }), makeTask({ assignees: ['b'] })],
      meetings: [],
      reports: [report('2026-09-27T10:00:00.000Z')],
      today: TODAY
    });
    expect(risk.score).toBe(0);
    expect(risk.level).toBe('low');
  });

  it('caps overdue milestones at 25 points and honours extended deadlines', () => {
    const risk = calculateTeamRisk({
      project: makeProject({
        milestones: [
          { id: '1', title: 'A', deadline: '2026-09-01', completed: false },
          { id: '2', title: 'B', deadline: '2026-09-02', completed: false },
          { id: '3', title: 'C', deadline: '2026-09-03', completed: false },
          { id: '4', title: 'Extended', deadline: '2026-09-04', extendedDeadline: '2026-10-30', completed: false }
        ]
      }),
      tasks: [],
      meetings: [],
      reports: [],
      today: TODAY
    });
    const m = factor(risk, 'milestones');
    expect(m.points).toBe(25);
    expect(m.detail).not.toContain('Extended');
  });

  it('scores overdue tasks as a share of open tasks', () => {
    const risk = calculateTeamRisk({
      project: makeProject(),
      tasks: [
        makeTask({ deadline: '2026-09-01' }),
        makeTask({ deadline: '2026-12-01', assignees: ['b'] }),
        makeTask({ deadline: '2026-09-01', column: 'completed' })
      ],
      meetings: [],
      reports: [],
      today: TODAY
    });
    expect(factor(risk, 'tasks').points).toBe(10); // 1 of 2 open tasks
  });

  it('flags attendance below 90% and ignores excused absences', () => {
    const meeting = (attendance: Meeting['attendance']): Meeting => ({
      id: Math.random().toString(36),
      projectId: 'p1',
      projectName: 'Test',
      title: 'Review',
      date: '2026-09-25',
      time: '10:00',
      linkOrLocation: '',
      status: 'scheduled',
      createdAt: '2026-09-20T00:00:00.000Z',
      attendance
    });
    const risk = calculateTeamRisk({
      project: makeProject(),
      tasks: [],
      meetings: [meeting({ a: 'present', b: 'absent' }), meeting({ a: 'late', b: 'excused' })],
      reports: [],
      today: TODAY
    });
    // 2 attended of 3 counted = 67% → (90 - 67) / 2 ≈ 12
    expect(factor(risk, 'attendance').points).toBe(12);
  });

  it('flags members with no assigned work once tasks exist', () => {
    const risk = calculateTeamRisk({
      project: makeProject(),
      tasks: [makeTask({ assignees: ['a'] })],
      meetings: [],
      reports: [],
      today: TODAY
    });
    const w = factor(risk, 'workload');
    expect(w.points).toBe(8); // half the team idle → 7.5 → 8
    expect(w.detail).toContain('Ben');
  });

  it('penalises long reporting silences and unanswered revision requests', () => {
    const risk = calculateTeamRisk({
      project: makeProject({ createdAt: '2026-07-01T00:00:00.000Z' }),
      tasks: [],
      meetings: [],
      reports: [report('2026-09-01T10:00:00.000Z', 'revision_requested')],
      today: TODAY
    });
    expect(factor(risk, 'reporting').points).toBe(15);
  });

  it('never exceeds 100 and lists the biggest factor first', () => {
    const risk = calculateTeamRisk({
      project: makeProject({
        createdAt: '2026-01-01T00:00:00.000Z',
        milestones: [
          { id: '1', title: 'A', deadline: '2026-02-01', completed: false },
          { id: '2', title: 'B', deadline: '2026-03-01', completed: false }
        ]
      }),
      tasks: [makeTask({ deadline: '2026-02-01' })],
      meetings: [],
      reports: [],
      today: TODAY
    });
    expect(risk.score).toBeLessThanOrEqual(100);
    expect(risk.level).toBe('high');
    for (let i = 1; i < risk.factors.length; i++) {
      expect(risk.factors[i - 1].points).toBeGreaterThanOrEqual(risk.factors[i].points);
    }
  });

  it('maps scores to levels at the documented thresholds', () => {
    expect(riskLevel(24)).toBe('low');
    expect(riskLevel(25)).toBe('medium');
    expect(riskLevel(50)).toBe('high');
  });
});
