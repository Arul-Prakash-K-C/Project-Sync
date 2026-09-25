import { describe, it, expect, beforeEach } from 'vitest';
import { db, type NewProjectInput } from './db';

beforeEach(() => {
  localStorage.clear();
});

const owner = () => db.getUser('student_alex')!;
const input = (over: Partial<NewProjectInput> = {}): NewProjectInput => ({
  name: 'Campus Carpool',
  description: 'Ride sharing for commuting students.',
  department: 'Computer Science & Engineering',
  requiredSkills: ['Svelte', ' Firebase ', 'svelte'],
  teamSize: 3,
  mentorId: 'faculty_evelyn',
  ...over
});

describe('project creation', () => {
  it('stores skills (trimmed, de-duplicated ignoring case), team size and mentor', () => {
    const p = db.createProject(input(), owner());
    expect(p.requiredSkills).toEqual(['Svelte', 'Firebase']);
    expect(p.teamSize).toBe(3);
    expect(p.mentorId).toBe('faculty_evelyn');
    expect(p.mentorName).toBe('Dr. Evelyn Sterling');
    expect(db.getProjects().find((x) => x.id === p.id)?.teamSize).toBe(3);
  });

  it('notifies the chosen mentor', () => {
    const p = db.createProject(input(), owner());
    const notes = db.getNotifications('faculty_evelyn');
    expect(notes.some((n) => n.description.includes(p.name))).toBe(true);
  });

  it('rejects a mentor who is not faculty', () => {
    expect(() => db.createProject(input({ mentorId: 'student_sarah' }), owner())).toThrow(/mentor/);
    expect(() => db.createProject(input({ mentorId: 'nobody' }), owner())).toThrow(/mentor/);
  });

  it('requires at least one skill and a sensible team size', () => {
    expect(() => db.createProject(input({ requiredSkills: ['  '] }), owner())).toThrow(/skill/);
    expect(() => db.createProject(input({ teamSize: 1 }), owner())).toThrow(/Team size/);
    expect(() => db.createProject(input({ teamSize: 9 }), owner())).toThrow(/Team size/);
  });

  it('lists only faculty as mentors', () => {
    const mentors = db.getMentors();
    expect(mentors.length).toBeGreaterThanOrEqual(2);
    expect(mentors.every((m) => m.role === 'faculty')).toBe(true);
  });
});

describe('team size limits', () => {
  it('stops inviting once members plus pending invites fill the team', () => {
    const p = db.createProject(input({ teamSize: 2 }), owner());
    expect(db.openSeats(p)).toBe(1);
    db.inviteToProject(p.id, 'sarah@teamforge.edu');
    const after = db.getProjects().find((x) => x.id === p.id)!;
    expect(db.openSeats(after)).toBe(0);
    expect(() => db.inviteToProject(p.id, 'marcus@teamforge.edu')).toThrow(/full/);
  });

  it('refuses an acceptance that would overfill the team', () => {
    const p = db.createProject(input({ teamSize: 2 }), owner());
    // Simulate an over-invite that predates the limit.
    db.updateProject(p.id, { pendingInvites: ['student_sarah', 'student_marcus'] });
    db.acceptInvite(p.id, 'student_sarah');
    expect(() => db.acceptInvite(p.id, 'student_marcus')).toThrow(/full/);
  });

  it('treats legacy projects without a team size as unlimited', () => {
    const legacy = db.getProjects().find((x) => x.id === 'project_studyhub')!;
    expect(db.openSeats({ ...legacy, teamSize: undefined })).toBeNull();
  });

  it('still loads projects saved before these fields existed', () => {
    const legacy = db.getProjects().map(({ requiredSkills, teamSize, mentorId, mentorName, ...rest }) => rest);
    localStorage.setItem('teamforge_projects', JSON.stringify(legacy));
    expect(db.getProjects().some((p) => p.id === 'project_studyhub')).toBe(true);
  });
});
