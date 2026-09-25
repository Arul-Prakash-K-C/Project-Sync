import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db, type Notification } from './db';

beforeEach(() => {
  localStorage.clear();
  db.useDemoDefaults = true;
});

afterEach(() => {
  db.useDemoDefaults = true;
});

describe('write hooks and change events', () => {
  it('passes the previous and next collection to write hooks', () => {
    const calls: { key: string; prev: number; next: number }[] = [];
    const stop = db.onWrite((key, prev, next) => calls.push({ key, prev: prev.length, next: next.length }));
    db.saveDepartments(db.getDepartments()); // seeds storage
    const deps = db.getDepartments();
    db.saveDepartments(deps.slice(1));
    stop();
    expect(calls.at(-1)).toEqual({ key: 'departments', prev: deps.length, next: deps.length - 1 });
  });

  it('applyRemote updates the cache and emits a remote change without firing write hooks', () => {
    let writes = 0;
    const origins: string[] = [];
    const stopW = db.onWrite(() => writes++);
    const stopC = db.onChange((_, origin) => origins.push(origin));
    db.applyRemote('meetings', []);
    stopW();
    stopC();
    expect(writes).toBe(0);
    expect(origins).toEqual(['remote']);
  });

  it('returns empty collections (except departments) when demo defaults are off', () => {
    db.useDemoDefaults = false;
    expect(db.getProjects()).toEqual([]);
    expect(db.getUsers()).toEqual([]);
    expect(db.getDepartments().length).toBeGreaterThan(0);
  });

  it('importAllData routes collections through the write path', () => {
    const keys: string[] = [];
    const stop = db.onWrite((key) => keys.push(key));
    db.importAllData({ teamforge_meetings: [], teamforge_current_user: { id: 'x' } });
    stop();
    expect(keys).toEqual(['meetings']);
    expect(localStorage.getItem('teamforge_current_user')).toBeNull();
  });

  it('clearLocalCache drops data but keeps UI preferences', () => {
    db.saveMeetings([]);
    localStorage.setItem('teamforge_sidebar', 'collapsed');
    db.clearLocalCache();
    expect(localStorage.getItem('teamforge_meetings')).toBeNull();
    expect(localStorage.getItem('teamforge_sidebar')).toBe('collapsed');
  });
});

describe('notifications', () => {
  it('deleteNotification actually removes the record', () => {
    const mine = db.getNotifications('student_alex');
    expect(mine.length).toBeGreaterThan(0);
    db.deleteNotification(mine[0].id);
    expect(db.getNotifications('student_alex').some((n: Notification) => n.id === mine[0].id)).toBe(false);
  });
});

describe('meeting attendance', () => {
  it('summarises attendance, excluding excused meetings from the rate', () => {
    const m1 = db.scheduleMeeting('p1', 'P', 'Review 1', '2026-01-01', '10:00', 'Room');
    const m2 = db.scheduleMeeting('p1', 'P', 'Review 2', '2026-01-08', '10:00', 'Room');
    const m3 = db.scheduleMeeting('p1', 'P', 'Review 3', '2026-01-15', '10:00', 'Room');
    db.recordAttendance(m1.id, { s1: 'present' });
    db.recordAttendance(m2.id, { s1: 'absent' });
    db.recordAttendance(m3.id, { s1: 'excused' });
    const summary = db.getAttendanceSummary('p1', 's1');
    expect(summary.recorded).toBe(3);
    expect(summary.rate).toBe(50);
    expect(summary.excused).toBe(1);
  });

  it('reports a null rate when no register was taken', () => {
    db.scheduleMeeting('p2', 'P', 'Kickoff', '2026-01-01', '10:00', 'Room');
    expect(db.getAttendanceSummary('p2', 's1').rate).toBeNull();
  });

  it('attendance survives schema validation on reload', () => {
    const m = db.scheduleMeeting('p3', 'P', 'Review', '2026-01-01', '10:00', 'Room');
    db.recordAttendance(m.id, { s1: 'late' });
    expect(db.getMeetings('p3')[0].attendance).toEqual({ s1: 'late' });
  });
});

describe('record ids', () => {
  it('stay unique when many records are created in the same millisecond', () => {
    const ids = Array.from({ length: 50 }, () =>
      db.scheduleMeeting('p4', 'P', 'Burst', '2026-01-01', '10:00', 'Room').id
    );
    expect(new Set(ids).size).toBe(50);
  });
});
