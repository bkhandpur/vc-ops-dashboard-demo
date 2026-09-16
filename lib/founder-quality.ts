/** Deterministic labels used to sort the synthetic outreach queue. */

/** Normalise `PRIOR_EXIT`, `Prior Exit` and `prior exit` to one key. */
export function normaliseHighlight(category: string): string {
  return category.toLowerCase().replace(/[_\s]+/g, " ").trim();
}

export interface QualitySignalDef {
  /** Normalised category key. */
  key: string;
  label: string;
  /** Points added when present. Counted once even if the provider repeats the category. */
  weight: number;
  /** Plain-language explanation, shown in the UI and the help article. */
  meaning: string;
}

/**
 * The signals worth weighting, and why each one.
 *
 * Every tag here describes the same underlying thing: this person has built a company
 * before. That is the only claim the queue is trying to make.
 *
 * Everything not listed scores 0, on purpose. That includes `Top University` (see the
 * header — it is 43% of all instances), `Notable Followers` (a social metric, not a
 * building signal), and every `Seasoned Executive` / `Prior VC Backed Executive`
 * variant, which describe operators rather than founders and are among the most common
 * tags in the set. A scoring system that fires for most of the population is not a
 * scoring system.
 */
export const QUALITY_SIGNALS: QualitySignalDef[] = [
  {
    key: "prior exit",
    label: "Prior exit",
    weight: 5,
    meaning: "The provider records a company this person founded being acquired or going public.",
  },
  {
    key: "prior vc backed founder",
    label: "Prior VC-backed founder",
    weight: 4,
    meaning: "They founded a company that raised institutional venture funding.",
  },
  {
    key: "seasoned founder",
    label: "Seasoned founder",
    weight: 3,
    meaning: "The provider's marker for someone with substantial prior founding experience.",
  },
  {
    key: "founder turned operator",
    label: "Founder turned operator",
    weight: 2,
    meaning: "They founded before, then took an operating role — often a repeat founder in waiting.",
  },
];

/**
 * The `$N Club` tiers — total raised by a person's prior company.
 *
 * Parsed rather than enumerated, because the observed set is wider than any
 * documentation listed: $5M, $10M, $15M, $20M, $25M, $30M, $35M and $50M+ all appeared
 * in live responses. A hardcoded list would silently miss whichever tier the provider
 * adds next, and "silently" is the problem — the feature would keep working and quietly
 * stop counting.
 *
 * Only the largest tier a person holds is counted — the tiers are cumulative in meaning,
 * so adding $5M + $30M + $50M+ together would trip-count one achievement.
 */
const CLUB_PATTERN = /^\$(\d+)m\+?\s*club$/;

export function clubTierMillions(category: string): number | null {
  const match = CLUB_PATTERN.exec(normaliseHighlight(category));
  return match ? Number(match[1]) : null;
}

/** Club points, banded so a $50M+ alum outscores a $5M one without dominating. */
function clubWeight(millions: number): number {
  if (millions >= 50) return 5;
  if (millions >= 25) return 4;
  if (millions >= 10) return 3;
  return 2;
}

export interface QualityHit {
  label: string;
  points: number;
  meaning: string;
}

export interface QualityScore {
  /** Sum of all hits. Unbounded in principle; ~14 is high in practice. */
  points: number;
  hits: QualityHit[];
  /** True when the provider returned no tags at all — distinct from scoring zero. */
  noData: boolean;
}

export function scoreFounderQuality(highlights: readonly string[]): QualityScore {
  if (highlights.length === 0) {
    return { points: 0, hits: [], noData: true };
  }

  const present = new Set(highlights.map(normaliseHighlight));
  const hits: QualityHit[] = [];

  for (const signal of QUALITY_SIGNALS) {
    if (present.has(signal.key)) {
      hits.push({ label: signal.label, points: signal.weight, meaning: signal.meaning });
    }
  }

  // Highest club tier only — see the note above CLUB_PATTERN.
  const tiers = highlights
    .map(clubTierMillions)
    .filter((t): t is number => t !== null);
  if (tiers.length > 0) {
    const best = Math.max(...tiers);
    hits.push({
      label: `$${best}M+ club`,
      points: clubWeight(best),
      meaning: `A company this person previously founded raised at least $${best}M in total.`,
    });
  }

  return {
    points: hits.reduce((sum, h) => sum + h.points, 0),
    hits: hits.sort((a, b) => b.points - a.points),
    noData: false,
  };
}

/**
 * The maximum realistically attainable score, used to scale the display bar.
 *
 * Derived rather than hardcoded so adding a signal cannot leave the bar mis-scaled.
 */
export const MAX_QUALITY_POINTS =
  QUALITY_SIGNALS.reduce((sum, s) => sum + s.weight, 0) + clubWeight(50);
