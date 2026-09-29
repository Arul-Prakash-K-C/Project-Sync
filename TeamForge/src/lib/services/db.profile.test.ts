import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './db';
import { PRESET_AVATARS, validateAvatar, avatarKind, coverRect } from '$lib/utils/avatars';

beforeEach(() => {
  localStorage.clear();
});

const tinyWebp = 'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==';

describe('updateOwnProfile', () => {
  it('saves the fields a student may edit, trimmed and de-duplicated', () => {
    const u = db.updateOwnProfile('student_alex', {
      bio: '  Builds things.  ',
      skills: ['Svelte', ' svelte ', 'Go', ''],
      academicYear: 'Year 4',
      avatar: PRESET_AVATARS[3].src,
      links: { github: 'https://github.com/alex' }
    });
    expect(u.bio).toBe('Builds things.');
    expect(u.skills).toEqual(['Svelte', 'Go']);
    expect(u.academicYear).toBe('Year 4');
    expect(u.avatar).toBe('/avatars/preset-04.svg');
    expect(u.links).toEqual({ github: 'https://github.com/alex' });
  });

  it('ignores identity fields and fields outside the role', () => {
    const before = db.getUser('student_alex')!;
    const u = db.updateOwnProfile('student_alex', {
      // @ts-expect-error — identity is not part of a profile patch
      role: 'admin',
      name: 'Someone Else',
      email: 'x@y.z',
      designation: 'Dean',
      maxMentees: 5
    });
    expect(u.role).toBe('student');
    expect(u.name).toBe(before.name);
    expect(u.email).toBe(before.email);
    expect(u.designation).toBeUndefined();
    expect(u.maxMentees).toBeUndefined();
  });

  it('lets faculty set their title, office hours and mentee limit, but not their department', () => {
    const u = db.updateOwnProfile('faculty_evelyn', {
      designation: 'Associate Professor',
      officeHours: 'Tue 14:00–16:00',
      maxMentees: 4,
      availability: false,
      department: 'Information Systems'
    });
    expect(u.designation).toBe('Associate Professor');
    expect(u.officeHours).toBe('Tue 14:00–16:00');
    expect(u.maxMentees).toBe(4);
    expect(u.availability).toBe(false);
    expect(u.department).toBe('Computer Science & Engineering');
  });

  it('rejects invalid values', () => {
    expect(() => db.updateOwnProfile('student_alex', { department: 'Nowhere' })).toThrow(/department/);
    expect(() => db.updateOwnProfile('student_alex', { academicYear: 'Year 9' })).toThrow(/year/);
    expect(() => db.updateOwnProfile('faculty_evelyn', { maxMentees: 0 })).toThrow(/Mentee limit/);
    expect(() => db.updateOwnProfile('student_alex', { links: { github: 'javascript:alert(1)' } })).toThrow(/https/);
    expect(() => db.updateOwnProfile('student_alex', { avatar: 'https://evil.example/x.png' })).toThrow(/preset/);
    expect(() => db.updateOwnProfile('student_alex', { skills: Array.from({ length: 26 }, (_, i) => `S${i}`) })).toThrow(
      /at most 25/
    );
  });

  it('accepts an uploaded photo and initials-only', () => {
    expect(db.updateOwnProfile('student_alex', { avatar: tinyWebp }).avatar).toBe(tinyWebp);
    expect(db.updateOwnProfile('student_alex', { avatar: '' }).avatar).toBe('');
  });
});

describe('mentorLoad', () => {
  it('counts pending and active mentees against the limit', () => {
    // Evelyn mentors one active and one pending project in the demo data.
    expect(db.mentorLoad(db.getUser('faculty_evelyn')!)).toEqual({ count: 2, limit: null, open: true });
    const limited = db.updateOwnProfile('faculty_evelyn', { maxMentees: 2 });
    expect(db.mentorLoad(limited).open).toBe(false);
    const closed = db.updateOwnProfile('faculty_julian', { availability: false });
    expect(db.mentorLoad(closed).open).toBe(false);
  });
});

describe('avatars', () => {
  it('validates avatar values', () => {
    expect(validateAvatar('')).toBeNull();
    expect(validateAvatar(PRESET_AVATARS[0].src)).toBeNull();
    expect(validateAvatar('https://api.dicebear.com/7.x/adventurer/svg?seed=A')).toBeNull();
    expect(validateAvatar(tinyWebp)).toBeNull();
    expect(validateAvatar('data:image/svg+xml;base64,PHN2Zz4=')).toMatch(/PNG, JPEG or WebP/);
    expect(validateAvatar('/avatars/../secrets.svg')).toMatch(/preset/);
    expect(validateAvatar('data:image/png;base64,' + 'A'.repeat(210 * 1024))).toMatch(/too large/);
  });

  it('classifies avatars', () => {
    expect(avatarKind('')).toBe('initials');
    expect(avatarKind(tinyWebp)).toBe('upload');
    expect(avatarKind('/avatars/preset-02.svg')).toBe('preset');
    expect(avatarKind('https://api.dicebear.com/x')).toBe('remote');
  });

  it('covers the crop square and clamps the offset so no edge shows', () => {
    // A 400×200 landscape in a 100px square: scaled to 200×100, 50px spare each side.
    const r = coverRect(400, 200, 100, { zoom: 1, x: 5, y: 5 });
    expect(r.w).toBe(200);
    expect(r.h).toBe(100);
    expect(r.x).toBe(0.5);
    expect(r.y).toBe(0);
    expect(r.left).toBe(0);
  });
});

describe('mentor availability on project creation', () => {
  it('refuses a mentor who has stopped taking mentees', () => {
    db.updateOwnProfile('faculty_julian', { availability: false });
    const owner = db.getUser('student_alex')!;
    expect(() =>
      db.createProject(
        { name: 'X', description: 'Y', department: 'Software Engineering', requiredSkills: ['Go'], teamSize: 3, mentorId: 'faculty_julian' },
        owner
      )
    ).toThrow(/isn't taking new mentees/);
  });
});
