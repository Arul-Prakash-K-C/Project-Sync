import { describe, it, expect, beforeEach } from 'vitest';
import { db, type NewProjectInput, TEAM_LEADER_ROLE, isTeamLeader, memberRoleLabel } from './db';

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

describe('supervised projects', () => {
  it("include the faculty member's department and projects that name them as mentor elsewhere", () => {
    const julian = db.getUser('faculty_julian')!; // Software Engineering
    const p = db.createProject(input({ department: 'Computer Science & Engineering', mentorId: julian.id }), owner());
    const supervised = db.getSupervisedProjects(julian).map((x) => x.id);
    expect(supervised).toContain(p.id);
    // Evelyn is in the project's department but isn't its mentor, so she doesn't see it.
    expect(db.getSupervisedProjects(db.getUser('faculty_evelyn')!).map((x) => x.id)).not.toContain(p.id);
  });
});

describe('team leader', () => {
  it('makes the creator the Team Leader', () => {
    const p = db.createProject(input(), owner());
    expect(p.members[0]).toMatchObject({ userId: 'student_alex', role: TEAM_LEADER_ROLE });
    expect(isTeamLeader(p, 'student_alex')).toBe(true);
    expect(memberRoleLabel(p, p.members[0])).toBe('Team Leader');
  });

  it('labels the owner of an older project as Team Leader too', () => {
    const legacy = db.getProjects().find((x) => x.id === 'project_studyhub')!;
    const ownerMember = legacy.members.find((m) => m.userId === legacy.ownerId)!;
    expect(memberRoleLabel(legacy, ownerMember)).toBe('Team Leader');
  });

  it('lets only the team leader invite', () => {
    const p = db.createProject(input({ teamSize: 4 }), owner());
    db.inviteToProject(p.id, 'sarah@teamforge.edu', { id: 'student_alex' });
    db.acceptInvite(p.id, 'student_sarah');
    expect(() => db.inviteToProject(p.id, 'marcus@teamforge.edu', { id: 'student_sarah' })).toThrow(/team leader/);
  });
});

describe('mentor-only supervision', () => {
  it("shows a project only to the faculty member chosen as its mentor", () => {
    const julian = db.getUser('faculty_julian')!;
    const evelyn = db.getUser('faculty_evelyn')!; // same department as the project, but not its mentor
    const p = db.createProject(input({ department: 'Computer Science & Engineering', mentorId: julian.id }), owner());
    expect(db.getSupervisedProjects(julian).map((x) => x.id)).toContain(p.id);
    expect(db.getSupervisedProjects(evelyn).map((x) => x.id)).not.toContain(p.id);
  });

  it("falls back to the department's faculty for projects with no mentor", () => {
    const evelyn = db.getUser('faculty_evelyn')!;
    const legacy = { ...db.getProjects()[0], id: 'p_legacy', mentorId: undefined, mentorName: undefined };
    db.saveProjects([...db.getProjects(), legacy]);
    expect(db.getSupervisedProjects(evelyn).map((x) => x.id)).toContain('p_legacy');
  });

  it('delivers announcements only to the teams they list', () => {
    expect(db.announcementReaches({ targetType: 'all', targetIds: ['p1'] }, 'p1')).toBe(true);
    expect(db.announcementReaches({ targetType: 'all', targetIds: ['p1'] }, 'p2')).toBe(false);
    expect(db.announcementReaches({ targetType: 'all', targetIds: [] }, 'p2')).toBe(true); // legacy broadcast
  });
});
