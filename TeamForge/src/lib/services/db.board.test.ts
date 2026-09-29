import { describe, it, expect, beforeEach } from 'vitest';
import { db, byBoardOrder, type TaskColumn } from './db';

beforeEach(() => {
  localStorage.clear();
});

const lane = (column: TaskColumn) =>
  db
    .getTasks()
    .filter((t) => t.projectId === 'project_studyhub' && t.column === column)
    .sort(byBoardOrder)
    .map((t) => t.id);

describe('task board ordering', () => {
  it('moves a task into another column at the given position and renumbers it', () => {
    expect(lane('todo')).toEqual(['task_4', 'task_9']);
    db.moveTask('task_2', 'todo', 1);
    expect(lane('todo')).toEqual(['task_4', 'task_2', 'task_9']);
    expect(lane('inprogress')).toEqual(['task_8']);
    const orders = db.getTasks().filter((t) => t.column === 'todo').map((t) => t.order).sort();
    expect(orders).toEqual([0, 1, 2]);
  });

  it('reorders within a column', () => {
    db.moveTask('task_9', 'todo', 0);
    expect(lane('todo')).toEqual(['task_9', 'task_4']);
  });

  it('clamps an out-of-range position to the end', () => {
    db.moveTask('task_4', 'review', 99);
    expect(lane('review')).toEqual(['task_1', 'task_4']);
  });

  it('puts new tasks at the bottom of To do, with a creation time', () => {
    const t = db.createTask('project_studyhub', 'New', '', 'low', '2026-10-01', []);
    expect(t.createdAt).toBeTruthy();
    expect(lane('todo').at(-1)).toBe(t.id);
  });
});

describe('completion history', () => {
  it('stamps completedAt when a task reaches Completed and clears it when it moves back', () => {
    const done = db.moveTask('task_4', 'completed', 0);
    expect(done.completedAt).toBeTruthy();
    const reopened = db.updateTask('task_4', { column: 'review' });
    expect(reopened.completedAt).toBeUndefined();
  });

  it('keeps the original completion time when a finished task is only reordered', () => {
    const before = db.getTasks().find((t) => t.id === 'task_3')!.completedAt;
    db.moveTask('task_3', 'completed', 3);
    expect(db.getTasks().find((t) => t.id === 'task_3')!.completedAt).toBe(before);
  });
});
