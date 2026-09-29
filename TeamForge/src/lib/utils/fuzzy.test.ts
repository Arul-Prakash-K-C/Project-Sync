import { describe, it, expect } from 'vitest';
import { fuzzyMatch, fuzzyMatchAny } from './fuzzy';

describe('fuzzyMatch', () => {
  it('matches characters in order and records their positions', () => {
    const m = fuzzyMatch('tfnd', 'Team Finder');
    expect(m).not.toBeNull();
    expect(m!.positions).toEqual([0, 5, 7, 8]);
  });

  it('returns null when the characters are not all present in order', () => {
    expect(fuzzyMatch('xyz', 'Team Finder')).toBeNull();
    expect(fuzzyMatch('rt', 'Team Finder')).toBeNull();
  });

  it('rejects letters strewn thinly across a long title', () => {
    expect(fuzzyMatch('realtm', 'Configure SvelteKit layout styles & theme config')).toBeNull();
  });

  it('ranks a prefix above a mid-word substring above a scattered match', () => {
    const prefix = fuzzyMatch('mil', 'Milestones')!.score;
    const inner = fuzzyMatch('mil', 'Family plan')!.score;
    const scattered = fuzzyMatch('mil', 'Meeting list')!.score;
    expect(prefix).toBeGreaterThan(inner);
    expect(inner).toBeGreaterThan(scattered);
  });

  it('treats an empty query as matching everything', () => {
    expect(fuzzyMatch('  ', 'Anything')).toEqual({ score: 0, positions: [] });
  });
});

describe('fuzzyMatchAny', () => {
  it('prefers a title match over a keyword match', () => {
    const title = fuzzyMatchAny('report', ['Reports Hub', 'export csv'])!;
    const keyword = fuzzyMatchAny('report', ['Analytics', 'reports charts'])!;
    expect(title.score).toBeGreaterThan(keyword.score);
    expect(keyword.positions).toEqual([]);
  });

  it('ignores scattered letter matches in secondary fields', () => {
    expect(fuzzyMatchAny('realtm', ['Study Hub', 'A platform for real students to meet'])).toBeNull();
    expect(fuzzyMatchAny('realtm', ['Realtime sync'])).not.toBeNull();
  });
});
