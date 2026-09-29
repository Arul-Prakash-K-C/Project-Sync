/**
 * Fuzzy matching for the command palette. The query's characters must appear
 * in order in the text ("tfnd" finds "Team Finder"). Matches score higher when
 * they are contiguous, start a word, or start the text, so the obvious result
 * sorts first. Returns null when the text does not match.
 */
export interface FuzzyMatch {
  score: number;
  /** Indexes of the matched characters in `text`, for highlighting. */
  positions: number[];
}

function isWordStart(text: string, i: number): boolean {
  if (i === 0) return true;
  const prev = text[i - 1];
  return /[\s\-_/.·(]/.test(prev) || (prev === prev.toLowerCase() && text[i] !== text[i].toLowerCase());
}

export function fuzzyMatch(query: string, text: string): FuzzyMatch | null {
  const q = query.trim().toLowerCase();
  if (!q) return { score: 0, positions: [] };
  const t = text.toLowerCase();

  // A plain substring is the strongest signal; prefer it outright.
  const at = t.indexOf(q);
  if (at !== -1) {
    const positions = Array.from({ length: q.length }, (_, i) => at + i);
    return { score: 100 + (at === 0 ? 50 : isWordStart(text, at) ? 25 : 0) - at * 0.1, positions };
  }

  const positions: number[] = [];
  let score = 0;
  let ti = 0;
  let prev = -2;
  for (const ch of q) {
    if (ch === ' ') continue;
    const found = t.indexOf(ch, ti);
    if (found === -1) return null;
    positions.push(found);
    score += 1;
    if (found === prev + 1) score += 3;
    if (isWordStart(text, found)) score += 5;
    prev = found;
    ti = found + 1;
  }
  // Letters strewn across a long title are coincidence, not a match.
  const spread = positions[positions.length - 1] - positions[0];
  if (spread > positions.length * 4) return null;
  // Spread-out matches are weaker.
  score -= spread * 0.05;
  return { score, positions };
}

/** Best match of a query against several fields (title, keywords…), or null. */
export function fuzzyMatchAny(query: string, fields: string[]): FuzzyMatch | null {
  let best: FuzzyMatch | null = null;
  fields.forEach((f, i) => {
    const m = fuzzyMatch(query, f);
    // Secondary fields (subtitles, keywords, descriptions) must contain the
    // query outright: scattered letters across a long description are noise.
    if (m && i > 0 && m.score < 100) return;
    // They also count for a little less, and their positions don't refer to
    // the title, so they aren't highlighted.
    if (m && i > 0) {
      m.score -= 10;
      m.positions = [];
    }
    if (m && (!best || m.score > best.score)) best = m;
  });
  return best;
}
