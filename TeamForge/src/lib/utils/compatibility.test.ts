import { describe, it, expect } from 'vitest';
import {
  calculateCompatibilityBreakdown,
  missingTeamSkills,
  rankCandidatesForNeeds
} from './compatibility';
import { skillFamily, skillSimilarity, coverSkills } from './skillGraph';
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

function factor(result: ReturnType<typeof calculateCompatibilityBreakdown>, key: string) {
  return result.factors.find((f) => f.key === key);
}

describe('skill graph', () => {
  it('groups skills into families, case-insensitively', () => {
    expect(skillFamily('React')).toBe('frontend');
    expect(skillFamily('  postgresql ')).toBe('backend');
    expect(skillFamily('TensorFlow')).toBe('data');
  });

  it('falls back to keywords for skills it does not list', () => {
    expect(skillFamily('Motion Design')).toBe('design');
    expect(skillFamily('Something Unheard Of')).toBeNull();
  });

  it('rates the same skill 1, a related skill 0.5 and an unrelated one 0', () => {
    expect(skillSimilarity('Svelte', 'svelte')).toBe(1);
    expect(skillSimilarity('Svelte', 'React')).toBe(0.5);
    expect(skillSimilarity('Svelte', 'Docker')).toBe(0);
  });

  it('covers a need with the closest skill available', () => {
    const [c] = coverSkills(['React'], ['Docker', 'Vue']);
    expect(c).toEqual({ need: 'React', by: 'Vue', score: 0.5 });
  });
});

describe('calculateCompatibilityBreakdown', () => {
  it('scores two strangers with nothing in common near zero', () => {
    const me = makeUser({ department: 'A', academicYear: 'Year 1', skills: [], interests: [] });
    const target = makeUser({ department: 'B', academicYear: 'Year 4', skills: [], interests: ['Y'] });
    const result = calculateCompatibilityBreakdown(me, target);
    expect(result.total).toBe(0);
    expect(result.departmentMatch).toBe(false);
    expect(result.yearMatch).toBe(false);
  });

  it('finds shared and related skills', () => {
    const me = makeUser({ skills: ['Svelte', 'TypeScript'] });
    const target = makeUser({ skills: ['TypeScript', 'React'] });
    const result = calculateCompatibilityBreakdown(me, target);
    expect(result.sharedSkills).toEqual(['TypeScript']);
    expect(result.relatedSkills).toEqual([{ theirs: 'React', mine: 'Svelte' }]);
    expect(factor(result, 'common')!.points).toBe(20); // identical family profiles
  });

  it('rewards a teammate who brings skill areas you lack', () => {
    const me = makeUser({ skills: ['Svelte', 'CSS'] });
    const clone = makeUser({ skills: ['React', 'HTML'] });
    const complement = makeUser({ skills: ['Docker', 'PostgreSQL', 'Figma'] });
    const cloneScore = factor(calculateCompatibilityBreakdown(me, clone), 'complement')!.points;
    const result = calculateCompatibilityBreakdown(me, complement);
    expect(cloneScore).toBe(0);
    expect(factor(result, 'complement')!.points).toBe(25);
    expect(result.newFamilies.map((f) => f.family).sort()).toEqual(['backend', 'cloud', 'design']);
  });

  it('adds project fit only when matching for a project', () => {
    const me = makeUser({ skills: ['Svelte'] });
    const target = makeUser({ skills: ['Python', 'PyTorch'] });
    expect(factor(calculateCompatibilityBreakdown(me, target), 'project')).toBeUndefined();

    const withProject = calculateCompatibilityBreakdown(me, target, {
      projectName: 'Campus AI',
      neededSkills: ['Python', 'TensorFlow']
    });
    const fit = factor(withProject, 'project')!;
    expect(fit.points).toBe(19); // (1 + 0.5) / 2 × 25 = 18.75
    expect(withProject.projectFit!.coverage.map((c) => c.by)).toEqual(['Python', 'PyTorch']);
  });

  it('matches interests on whole words only', () => {
    const me = makeUser({ interests: ['AI/Machine Learning', 'Blockchain'] });
    const target = makeUser({ interests: ['Machine Learning', 'AI'] });
    const result = calculateCompatibilityBreakdown(me, target);
    expect(result.commonInterests).toEqual(['Machine Learning', 'AI']);

    const noFalseHit = calculateCompatibilityBreakdown(makeUser({ interests: ['Blockchain'] }), makeUser({ interests: ['AI'] }));
    expect(noFalseHit.commonInterests).toEqual([]);
  });

  it('never exceeds 100', () => {
    const skills = ['Svelte', 'Node.js', 'Docker', 'Figma'];
    const me = makeUser({ skills, interests: ['Web', 'Cloud'] });
    const result = calculateCompatibilityBreakdown(me, makeUser({ skills, interests: ['Web', 'Cloud'] }));
    expect(result.total).toBeLessThanOrEqual(100);
  });

  it('does not count a year match when either user has no academic year set', () => {
    const result = calculateCompatibilityBreakdown(makeUser({ academicYear: undefined }), makeUser());
    expect(result.yearMatch).toBe(false);
    expect(factor(result, 'year')!.points).toBe(0);
  });
});

describe('team gaps', () => {
  it('lists required skills nobody on the team has', () => {
    expect(missingTeamSkills(['Svelte', 'NLP', 'Figma'], ['svelte', 'Docker'])).toEqual(['NLP', 'Figma']);
  });

  it('ranks candidates by coverage and drops those who cover nothing', () => {
    const ranked = rankCandidatesForNeeds(
      ['NLP', 'Figma'],
      [
        { id: 'a', skills: ['Go'] },
        { id: 'b', skills: ['TensorFlow'] },
        { id: 'c', skills: ['NLP', 'Figma'] }
      ]
    );
    expect(ranked.map((r) => r.user.id)).toEqual(['c', 'b']);
  });
});
