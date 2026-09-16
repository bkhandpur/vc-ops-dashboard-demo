/**
 * Dependency-free subsequence fuzzy matcher, shared by the command palette and the
 * Help search box. Isomorphic — safe to import in client components.
 *
 * Scoring favours: earlier matches, consecutive runs, and word-boundary hits — so
 * "acp" ranks "Add Company to Pipeline" above an incidental a…c…p elsewhere.
 */

export interface FuzzyMatch<T> {
  item: T;
  score: number;
  /** Indices in the haystack that matched, for highlight rendering. */
  indices: number[];
}

export function fuzzyScore(
  needle: string,
  haystack: string,
): { score: number; indices: number[] } | null {
  const n = needle.toLowerCase().trim();
  const h = haystack.toLowerCase();
  if (!n) return { score: 0, indices: [] };
  if (n.length > h.length) return null;

  const indices: number[] = [];
  let score = 0;
  let hi = 0;
  let previousMatch = -2;

  for (const char of n) {
    if (char === " ") continue;
    const found = h.indexOf(char, hi);
    if (found === -1) return null;

    indices.push(found);
    score += 1;
    if (found === previousMatch + 1) score += 6; // consecutive run
    const prev = found > 0 ? h[found - 1] : undefined;
    if (found === 0 || prev === " " || prev === "-" || prev === "/") score += 4; // word start
    score -= Math.min(found - hi, 8) * 0.2; // penalise gaps, but mildly

    previousMatch = found;
    hi = found + 1;
  }

  // Prefer shorter haystacks when scores are otherwise equal.
  score -= h.length * 0.01;
  if (h.startsWith(n)) score += 12;
  return { score, indices };
}

/**
 * Rank items by the best score across their searchable strings. `keys` earlier in the
 * array are weighted higher (title beats body).
 */
export function fuzzySearch<T>(
  query: string,
  items: readonly T[],
  toStrings: (item: T) => string[],
): FuzzyMatch<T>[] {
  if (!query.trim()) {
    return items.map((item) => ({ item, score: 0, indices: [] }));
  }

  const results: FuzzyMatch<T>[] = [];
  for (const item of items) {
    let best: FuzzyMatch<T> | null = null;
    toStrings(item).forEach((str, fieldIndex) => {
      const match = fuzzyScore(query, str);
      if (!match) return;
      const weighted = match.score - fieldIndex * 5;
      if (!best || weighted > best.score) {
        best = { item, score: weighted, indices: match.indices };
      }
    });
    if (best) results.push(best);
  }
  return results.sort((a, b) => b.score - a.score);
}
