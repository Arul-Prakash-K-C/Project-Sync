import type { User } from '$lib/services/db';

export interface CompatibilityBreakdown {
  total: number;
  base: number;
  departmentMatch: boolean;
  departmentPoints: number;
  yearMatch: boolean;
  yearPoints: number;
  commonSkills: string[];
  skillPoints: number;
  commonInterests: string[];
  interestPoints: number;
}

/**
 * Weighted teammate-compatibility score. Base score gives everyone a floor;
 * department/year matches are flat bonuses; skill/interest overlap scales
 * with count but is capped so a single shared tag can't dominate the score.
 */
export function calculateCompatibilityBreakdown(me: User, target: User): CompatibilityBreakdown {
  const base = 20;

  const departmentMatch = target.department === me.department;
  const departmentPoints = departmentMatch ? 25 : 0;

  const yearMatch = !!target.academicYear && target.academicYear === me.academicYear;
  const yearPoints = yearMatch ? 15 : 0;

  const commonSkills = target.skills.filter((s) => me.skills.includes(s));
  const skillPoints = Math.min(commonSkills.length * 15, 30);

  const commonInterests = target.interests.filter((i) => me.interests.includes(i));
  const interestPoints = Math.min(commonInterests.length * 5, 10);

  const total = Math.min(base + departmentPoints + yearPoints + skillPoints + interestPoints, 100);

  return { total, base, departmentMatch, departmentPoints, yearMatch, yearPoints, commonSkills, skillPoints, commonInterests, interestPoints };
}

export function calculateCompatibility(me: User, target: User): number {
  return calculateCompatibilityBreakdown(me, target).total;
}
