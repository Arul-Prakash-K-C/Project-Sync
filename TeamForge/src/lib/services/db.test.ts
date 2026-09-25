import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './db';

beforeEach(() => {
  localStorage.clear();
});

describe('DatabaseService storage layer', () => {
  it('returns the seeded default users when localStorage is empty', () => {
    const users = db.getUsers();
    expect(users.length).toBeGreaterThan(0);
    expect(users.some((u) => u.email === 'alex@teamforge.edu')).toBe(true);
  });

  it('round-trips saveUsers/getUsers through localStorage', () => {
    const users = db.getUsers();
    const renamed = users.map((u) => (u.id === 'student_alex' ? { ...u, name: 'Renamed Alex' } : u));
    db.saveUsers(renamed);
    const reloaded = db.getUsers();
    expect(reloaded.find((u) => u.id === 'student_alex')?.name).toBe('Renamed Alex');
  });

  it('falls back to defaults when stored JSON fails schema validation', () => {
    // Missing required fields (e.g. "skills", "availability") should be rejected by UserSchema.
    localStorage.setItem('teamforge_users', JSON.stringify([{ id: 'bad', name: 'Bad Data' }]));
    const users = db.getUsers();
    expect(users.some((u) => u.email === 'alex@teamforge.edu')).toBe(true);
    expect(users.some((u) => u.id === 'bad')).toBe(false);
  });

  it('falls back to defaults when stored value is not valid JSON', () => {
    localStorage.setItem('teamforge_users', '{not json');
    const users = db.getUsers();
    expect(users.length).toBeGreaterThan(0);
  });

  it('creates and updates a project', () => {
    const owner = db.getUsers()[0];
    const project = db.createProject(
      {
        name: 'New Project',
        description: 'A description',
        department: owner.department,
        requiredSkills: ['Svelte'],
        teamSize: 3,
        mentorId: 'faculty_evelyn'
      },
      owner
    );
    expect(project.status).toBe('pending');
    expect(project.members).toHaveLength(1);
    expect(project.mentorName).toBe('Dr. Evelyn Sterling');

    const updated = db.updateProject(project.id, { status: 'active' });
    expect(updated.status).toBe('active');
    expect(db.getProjects().find((p) => p.id === project.id)?.status).toBe('active');
  });

  it('creates a task and notifies its assignees', () => {
    const projects = db.getProjects();
    const project = projects[0];
    const assigneeId = project.members[0].userId;

    const task = db.createTask(project.id, 'Write tests', 'Add vitest coverage', 'high', '2026-12-01', [assigneeId]);
    expect(task.column).toBe('todo');

    const notifs = db.getNotifications(assigneeId);
    expect(notifs.some((n) => n.title === 'New Task Assigned')).toBe(true);
  });

  it('logs faculty actions and can filter the log by actor', () => {
    db.logAudit('faculty_evelyn', 'Dr. Evelyn Sterling', 'Approved project proposal', 'project', 'project_studyhub', 'Decentralized Study Hub');
    db.logAudit('faculty_evelyn', 'Dr. Evelyn Sterling', 'Locked milestone', 'milestone', 'm1', 'System Design (Decentralized Study Hub)');
    db.logAudit('admin_sys', 'Admin System', 'Reset demo data', 'project', undefined, undefined);

    const facultyLog = db.getAuditLog('faculty_evelyn');
    expect(facultyLog).toHaveLength(2);
    expect(facultyLog.every((e) => e.actorId === 'faculty_evelyn')).toBe(true);

    const allLog = db.getAuditLog();
    expect(allLog).toHaveLength(3);
  });

  it('exports and re-imports local data', () => {
    const users = db.getUsers();
    db.saveUsers(users.map((u) => (u.id === 'student_alex' ? { ...u, bio: 'Exported bio' } : u)));

    const snapshot = db.exportAllData();
    localStorage.clear();
    expect(db.getUsers().find((u) => u.id === 'student_alex')?.bio).not.toBe('Exported bio');

    db.importAllData(snapshot);
    expect(db.getUsers().find((u) => u.id === 'student_alex')?.bio).toBe('Exported bio');
  });

  it('resetAllData wipes stored app data back to defaults', () => {
    db.saveUsers(db.getUsers().map((u) => ({ ...u, bio: 'Changed' })));
    expect(db.getUsers()[0].bio).toBe('Changed');

    db.resetAllData();
    expect(db.getUsers()[0].bio).not.toBe('Changed');
  });
});
