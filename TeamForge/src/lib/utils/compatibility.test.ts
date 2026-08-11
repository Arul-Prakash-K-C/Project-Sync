import { describe, it, expect } from 'vitest';
import { calculateCompatibilityBreakdown } from './compatibility';
import type { User } from '$lib/services/db';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'u1',
    name: 'Test User',
    email: 'test@teamforge.edu',
    avatar: '',
    role: 'student',
    department: 'Computer Science & Engineering',
    academicYear: 'Year 3',
    skills: [],
    interests: [],
    availability: true,
    ...overrides
  };
}

describe('calculateCompatibilityBreakdown', () => {
  it('gives the base score alone when nothing matches', () => {
    const me = makeUser({ department: 'A', academicYear: 'Year 1', skills: [], interests: [] });
    const target = makeUser({ department: 'B', academicYear: 'Year 4', skills: ['X'], interests: ['Y'] });
    const result = calculateCompatibilityBreakdown(me, target);
    expect(result.total).toBe(20);
    expect(result.departmentMatch).toBe(false);
    expect(result.yearMatch).toBe(false);
    expect(result.commonSkills).toEqual([]);
    expect(result.commonInterests).toEqual([]);
  });

  it('adds department and year bonuses when they match', () => {
    const me = makeUser({ department: 'CSE', academicYear: 'Year 3' });
    const target = makeUser({ department: 'CSE', academicYear: 'Year 3' });
    const result = calculateCompatibilityBreakdown(me, target);
    expect(result.total).toBe(20 + 25 + 15);
    expect(result.departmentMatch).toBe(true);
    expect(result.yearMatch).toBe(true);
  });

  it('caps skill overlap points at 30 even with many shared skills', () => {
    const skills = ['A', 'B', 'C', 'D', 'E'];
    const me = makeUser({ department: 'X', academicYear: 'Y1', skills });
    const target = makeUser({ department: 'Z', academicYear: 'Y2', skills });
    const result = calculateCompatibilityBreakdown(me, target);
    expect(result.commonSkills).toHaveLength(5);
    expect(result.skillPoints).toBe(30); // 5 * 15 = 75, capped at 30
  });

  it('caps interest overlap points at 10', () => {
    const interests = ['AI', 'Web', 'Cloud', 'Design'];
    const me = makeUser({ department: 'X', academicYear: 'Y1', interests });
    const target = makeUser({ department: 'Z', academicYear: 'Y2', interests });
    const result = calculateCompatibilityBreakdown(me, target);
    expect(result.interestPoints).toBe(10); // 4 * 5 = 20, capped at 10
  });

  it('never exceeds a total of 100', () => {
    const me = makeUser({
      department: 'CSE',
      academicYear: 'Year 3',
      skills: ['A', 'B', 'C', 'D'],
      interests: ['X', 'Y', 'Z']
    });
    const target = makeUser({
      department: 'CSE',
      academicYear: 'Year 3',
      skills: ['A', 'B', 'C', 'D'],
      interests: ['X', 'Y', 'Z']
    });
    const result = calculateCompatibilityBreakdown(me, target);
    expect(result.total).toBeLessThanOrEqual(100);
  });

  it('does not count a year match when either user has no academic year set', () => {
    const me = makeUser({ academicYear: undefined });
    const target = makeUser({ academicYear: 'Year 3' });
    const result = calculateCompatibilityBreakdown(me, target);
    expect(result.yearMatch).toBe(false);
    expect(result.yearPoints).toBe(0);
  });
});
