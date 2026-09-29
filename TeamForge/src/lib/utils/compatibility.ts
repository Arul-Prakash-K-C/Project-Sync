import type { User } from '$lib/services/db';
import {
  FAMILY_LABELS,
  bestMatch,
  cosine,
  coverSkills,
  coverageRatio,
  familyVector,
  normalizeSkill,
  skillFamily,
  type SkillCoverage,
  type SkillFamily
} from './skillGraph';

/**
 * Teammate matching. A good teammate is not a copy of you: the score rewards
 * common ground (skills in the same families, so you can review each other's
 * work) *and* complement (families you don't cover), and, when you are
 * building a specific team, how well they fill that team's missing skills.
 *
 * Each factor has a ceiling. Without a project in mind the project-fit factor
 * is left out and the total is scaled over the remaining ceilings, so a score
 * always reads as a percentage. Every point is listed in the breakdown.
 */

export interface MatchContext {
  projectName: string;
  /** Required skills nobody on the team has yet. */
  neededSkills: string[];
}

export interface MatchFactor {
  key: 'common' | 'complement' | 'project' | 'interests' | 'department' | 'year';
  label: string;
  points: number;
  max: number;
  detail: string;
}

export interface CompatibilityBreakdown {
  /** 0–100. */
  total: number;
  factors: MatchFactor[];
  /** Skills you both list. */
  sharedSkills: string[];
  /** Their skills that are related to (same family as) one of yours, but not identical. */
  relatedSkills: { theirs: string; mine: string }[];
  /** Skill families they bring that you have none of. */
  newFamilies: { family: SkillFamily; label: string; skills: string[] }[];
  /** Present only when matching for a project. */
  projectFit?: { projectName: string; coverage: SkillCoverage[] };
  commonInterests: string[];
  departmentMatch: boolean;
  yearMatch: boolean;
}

const MAX = { common: 20, complement: 25, project: 25, interests: 10, department: 10, year: 5 } as const;

function words(s: string): string[] {
  return normalizeSkill(s).split(/[^a-z0-9+#.]+/).filter(Boolean);
}

/** Interests match when one's words are all found in the other ("Machine Learning" ⊂ "AI/Machine Learning"). */
function interestsOverlap(a: string[], b: string[]): string[] {
  const bw = b.map(words);
  return a.filter((x) => {
    const xw = words(x);
    return bw.some((yw) => xw.every((w) => yw.includes(w)) || yw.every((w) => xw.includes(w)));
  });
}

export function calculateCompatibilityBreakdown(
  me: User,
  target: User,
  context?: MatchContext
): CompatibilityBreakdown {
  const mine = me.skills;
  const theirs = target.skills;
  const mineNorm = new Set(mine.map(normalizeSkill));

  const sharedSkills = theirs.filter((s) => mineNorm.has(normalizeSkill(s)));
  const relatedSkills = theirs
    .filter((s) => !mineNorm.has(normalizeSkill(s)))
    .map((s) => ({ theirs: s, match: bestMatch(s, mine) }))
    .filter((r) => r.match && r.match.score < 1)
    .map((r) => ({ theirs: r.theirs, mine: r.match!.skill }));

  const myFamilies = familyVector(mine);
  const theirFamilies = familyVector(theirs);

  // Common ground: how aligned the two family profiles are.
  const commonPoints = Math.round(cosine(myFamilies, theirFamilies) * MAX.common);

  // Complement: families they cover that you don't. Three new families is the most that counts.
  const newFamilies = [...theirFamilies.keys()]
    .filter((f) => !myFamilies.has(f))
    .map((family) => ({
      family,
      label: FAMILY_LABELS[family],
      skills: theirs.filter((s) => skillFamily(s) === family)
    }));
  const complementPoints = Math.round((Math.min(newFamilies.length, 3) / 3) * MAX.complement);

  const factors: MatchFactor[] = [
    {
      key: 'common',
      label: 'Common ground',
      points: commonPoints,
      max: MAX.common,
      detail:
        sharedSkills.length || relatedSkills.length
          ? `${sharedSkills.length} shared and ${relatedSkills.length} related skill${relatedSkills.length === 1 ? '' : 's'}, so you can review each other's work.`
          : 'Your skills sit in different areas.'
    },
    {
      key: 'complement',
      label: 'Fills your gaps',
      points: complementPoints,
      max: MAX.complement,
      detail: newFamilies.length
        ? `Brings ${newFamilies.map((f) => f.label).join(', ')}, which you don't cover.`
        : 'Adds no skill areas you lack.'
    }
  ];

  let projectFit: CompatibilityBreakdown['projectFit'];
  if (context && context.neededSkills.length > 0) {
    const coverage = coverSkills(context.neededSkills, theirs);
    const exact = coverage.filter((c) => c.score === 1).length;
    const related = coverage.filter((c) => c.score > 0 && c.score < 1).length;
    projectFit = { projectName: context.projectName, coverage };
    factors.push({
      key: 'project',
      label: `Fit for ${context.projectName}`,
      points: Math.round(coverageRatio(coverage) * MAX.project),
      max: MAX.project,
      detail:
        exact || related
          ? `Covers ${exact} of the team's ${context.neededSkills.length} missing skills directly${related ? ` and ${related} with a related skill` : ''}.`
          : "Doesn't cover any of the team's missing skills."
    });
  }

  const commonInterests = interestsOverlap(target.interests, me.interests);
  factors.push({
    key: 'interests',
    label: 'Shared interests',
    points: Math.min(commonInterests.length * 5, MAX.interests),
    max: MAX.interests,
    detail: commonInterests.length ? commonInterests.join(', ') : 'No overlapping interests listed.'
  });

  const departmentMatch = target.department === me.department;
  factors.push({
    key: 'department',
    label: 'Department',
    points: departmentMatch ? MAX.department : 0,
    max: MAX.department,
    detail: departmentMatch ? `Both in ${target.department}.` : 'Different departments.'
  });

  const yearMatch = !!target.academicYear && target.academicYear === me.academicYear;
  factors.push({
    key: 'year',
    label: 'Academic year',
    points: yearMatch ? MAX.year : 0,
    max: MAX.year,
    detail: yearMatch ? `Both ${target.academicYear}.` : 'Different standing.'
  });

  const earned = factors.reduce((s, f) => s + f.points, 0);
  const possible = factors.reduce((s, f) => s + f.max, 0);
  const total = Math.round((earned / possible) * 100);

  return {
    total,
    factors,
    sharedSkills,
    relatedSkills,
    newFamilies,
    projectFit,
    commonInterests,
    departmentMatch,
    yearMatch
  };
}

export function calculateCompatibility(me: User, target: User, context?: MatchContext): number {
  return calculateCompatibilityBreakdown(me, target, context).total;
}

/** Required skills that no current team member has (exact match, any spelling case). */
export function missingTeamSkills(requiredSkills: string[], teamSkills: string[]): string[] {
  const have = new Set(teamSkills.map(normalizeSkill));
  return requiredSkills.filter((s) => !have.has(normalizeSkill(s)));
}

/**
 * Ranks candidates by how well they cover a team's missing skills, counting a
 * related skill as half. Candidates who cover nothing are dropped.
 */
export function rankCandidatesForNeeds<T extends Pick<User, 'skills'>>(
  needs: string[],
  candidates: T[]
): { user: T; coverage: SkillCoverage[]; score: number }[] {
  return candidates
    .map((user) => {
      const coverage = coverSkills(needs, user.skills);
      return { user, coverage, score: coverageRatio(coverage) };
    })
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score);
}
