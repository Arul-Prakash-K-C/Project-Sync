/**
 * A small skill knowledge graph. Every known skill belongs to one family
 * (frontend, backend, data & AI, …), which gives each person a profile
 * vector over families. Matching then works on meaning rather than exact
 * spelling: "React" and "Svelte" are related frontend skills, and a backend
 * developer fills a gap for a frontend-only student.
 *
 * Skills the graph has never seen still take part: they match themselves
 * exactly and fall into a family by keyword when one fits.
 */

export type SkillFamily =
  | 'frontend'
  | 'backend'
  | 'data'
  | 'mobile'
  | 'cloud'
  | 'design'
  | 'management'
  | 'security'
  | 'hardware'
  | 'quality';

export const FAMILY_LABELS: Record<SkillFamily, string> = {
  frontend: 'Frontend',
  backend: 'Backend & APIs',
  data: 'Data & AI',
  mobile: 'Mobile',
  cloud: 'Cloud & DevOps',
  design: 'Design & UX',
  management: 'Product & management',
  security: 'Security & blockchain',
  hardware: 'IoT & hardware',
  quality: 'Testing & quality'
};

const GRAPH: Record<SkillFamily, string[]> = {
  frontend: [
    'svelte', 'sveltekit', 'react', 'next.js', 'vue', 'nuxt', 'angular', 'javascript', 'typescript',
    'html', 'css', 'tailwind css', 'tailwind', 'sass', 'web development', 'three.js', 'webgl', 'redux'
  ],
  backend: [
    'node.js', 'express', 'go', 'java', 'spring', 'python', 'django', 'flask', 'fastapi', 'php', 'laravel',
    'ruby', 'rails', 'c#', '.net', 'rust', 'graphql', 'rest api', 'api development', 'microservices',
    'sql', 'postgresql', 'mysql', 'mongodb', 'redis', 'firebase', 'supabase', 'backend systems', 'system design'
  ],
  data: [
    'machine learning', 'ai/machine learning', 'deep learning', 'tensorflow', 'pytorch', 'scikit-learn',
    'nlp', 'computer vision', 'opencv', 'data analytics', 'data science', 'data visualization', 'pandas',
    'numpy', 'r', 'statistics', 'big data', 'spark', 'llm', 'prompt engineering', 'algorithms'
  ],
  mobile: ['flutter', 'dart', 'react native', 'swift', 'ios', 'kotlin', 'android', 'mobile development'],
  cloud: [
    'docker', 'kubernetes', 'aws', 'azure', 'gcp', 'google cloud', 'ci/cd', 'devops', 'devops pipelines',
    'terraform', 'linux', 'git', 'cloud architectures', 'serverless', 'nginx'
  ],
  design: ['figma', 'ui/ux design', 'ui design', 'ux research', 'adobe xd', 'prototyping', 'user research', 'illustration'],
  management: [
    'project management', 'agile/scrum', 'agile', 'scrum', 'product management', 'business analysis',
    'technical writing', 'documentation', 'presentation', 'leadership', 'communication'
  ],
  security: ['cryptography', 'cybersecurity', 'penetration testing', 'solidity', 'web3.js', 'blockchain', 'ethereum', 'smart contracts'],
  hardware: ['iot programming', 'iot', 'arduino', 'raspberry pi', 'embedded c', 'c', 'c++', 'robotics', 'edge computing'],
  quality: ['testing', 'unit testing', 'jest', 'vitest', 'playwright', 'cypress', 'selenium', 'quality assurance', 'qa']
};

/** Keyword fallbacks for skills the graph does not list by name. */
const KEYWORDS: [RegExp, SkillFamily][] = [
  [/\b(ui|ux|design|figma)\b/, 'design'],
  [/\b(ml|ai|learning|data|vision|nlp|model)\b/, 'data'],
  [/\b(test|qa|quality)\b/, 'quality'],
  [/\b(cloud|devops|deploy|docker|kube)\b/, 'cloud'],
  [/\b(mobile|android|ios)\b/, 'mobile'],
  [/\b(security|crypto|blockchain|web3)\b/, 'security'],
  [/\b(iot|embedded|hardware|robot)\b/, 'hardware'],
  [/\b(api|server|backend|database|sql)\b/, 'backend'],
  [/\b(frontend|web|css|js)\b/, 'frontend'],
  [/\b(manage|agile|scrum|product|lead)\b/, 'management']
];

const FAMILY_OF = new Map<string, SkillFamily>();
for (const [family, skills] of Object.entries(GRAPH) as [SkillFamily, string[]][]) {
  for (const skill of skills) if (!FAMILY_OF.has(skill)) FAMILY_OF.set(skill, family);
}

export function normalizeSkill(skill: string): string {
  return skill.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function skillFamily(skill: string): SkillFamily | null {
  const key = normalizeSkill(skill);
  const known = FAMILY_OF.get(key);
  if (known) return known;
  return KEYWORDS.find(([re]) => re.test(key))?.[1] ?? null;
}

/**
 * How closely two skills relate: 1 for the same skill, 0.5 for skills in the
 * same family (someone who knows React can pick up Svelte), 0 otherwise.
 */
export function skillSimilarity(a: string, b: string): number {
  const na = normalizeSkill(a);
  const nb = normalizeSkill(b);
  if (na === nb) return 1;
  const fa = skillFamily(na);
  return fa !== null && fa === skillFamily(nb) ? 0.5 : 0;
}

/** Profile vector over skill families: how many of someone's skills fall in each. */
export function familyVector(skills: string[]): Map<SkillFamily, number> {
  const vector = new Map<SkillFamily, number>();
  for (const s of skills) {
    const f = skillFamily(s);
    if (f) vector.set(f, (vector.get(f) ?? 0) + 1);
  }
  return vector;
}

/** Cosine similarity of two family vectors, 0–1. */
export function cosine(a: Map<SkillFamily, number>, b: Map<SkillFamily, number>): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const v of a.values()) na += v * v;
  for (const v of b.values()) nb += v * v;
  for (const [k, v] of a) dot += v * (b.get(k) ?? 0);
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

/** The best match for `need` among `skills`, with its similarity. */
export function bestMatch(need: string, skills: string[]): { skill: string; score: number } | null {
  let best: { skill: string; score: number } | null = null;
  for (const s of skills) {
    const score = skillSimilarity(need, s);
    if (score > 0 && (!best || score > best.score)) best = { skill: s, score };
  }
  return best;
}

export interface SkillCoverage {
  need: string;
  /** The skill that covers it, if any. */
  by?: string;
  /** 1 = exact skill, 0.5 = related skill, 0 = not covered. */
  score: number;
}

/** How well a set of skills covers a list of needed skills, need by need. */
export function coverSkills(needs: string[], skills: string[]): SkillCoverage[] {
  return needs.map((need) => {
    const m = bestMatch(need, skills);
    return m ? { need, by: m.skill, score: m.score } : { need, score: 0 };
  });
}

/** Overall coverage 0–1: the mean of each need's score. */
export function coverageRatio(coverage: SkillCoverage[]): number {
  return coverage.length ? coverage.reduce((s, c) => s + c.score, 0) / coverage.length : 0;
}
