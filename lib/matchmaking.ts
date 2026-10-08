/** Deterministic company and co-investor matching over synthetic data. */

import type { StagedCompany } from "./aggregate";
import type { TrackedPerson } from "./people-derive";
import { normaliseCompanyName, parseThesisFocus } from "./people-derive";

// ---------------------------------------------------------------------------
// The crosswalk
// ---------------------------------------------------------------------------

/**
 * An enrichment thesis term → our own canonical sectors, with a confidence 0–1.
 *
 * A weight below 1 means "related, not the same thing", and it is what stops
 * "Industrial Technology" scoring like a direct hit on Freight & Mobility. Terms map to
 * more than one sector where the source term is genuinely broader than anything in the
 * taxonomy ("Deep Tech" is the clearest case).
 *
 * ⚠️ **Built Environment has no confident inbound mapping.** No co-investor describes a
 * thesis that lands there, yet a real slice of the book sits in that sector. Matching
 * one of those companies therefore falls back to stage and syndicate history alone, and
 * `sectorFitIsBlind` flags it so the UI can say so — rather than quietly presenting a
 * weak ranking as though it were a considered one.
 */
export const THESIS_TO_SECTOR: Record<string, Record<string, number>> = {
  "Digital Health": { "Clinical Care": 1, "Consumer Wellbeing": 0.6 },
  "Care Delivery": { "Clinical Care": 1 },
  "Biotech Tools": { "Life Sciences Tools": 1 },
  "Consumer Subscription": { "Consumer Wellbeing": 0.8, "Commerce Enablement": 0.5 },
  "Future of Work": { "Workforce Software": 1, "Learning & Skills": 0.6 },
  "Vertical Software": { "Workforce Software": 0.7, "Commerce Enablement": 0.5 },
  "Commerce Infrastructure": { "Commerce Enablement": 1 },
  "Education Technology": { "Learning & Skills": 1 },
  "Climate Technology": { "Energy Systems": 1, "Built Environment": 0.3 },
  "Industrial Technology": { "Freight & Mobility": 0.5, "Energy Systems": 0.3 },
  "Supply Chain": { "Freight & Mobility": 1 },
  Mobility: { "Freight & Mobility": 0.9 },
  // Genuinely broader than anything in the taxonomy, so it maps weakly to two sectors
  // rather than strongly to a guess.
  "Deep Tech": { "Life Sciences Tools": 0.4, "Energy Systems": 0.4 },
  "Frontier Hardware": { "Energy Systems": 0.4, "Built Environment": 0.2 },
  Marketplaces: { "Commerce Enablement": 0.7, "Freight & Mobility": 0.3 },
};

/**
 * Sectors no thesis term maps onto with real confidence. Used to warn rather than
 * mislead.
 *
 * The bar is a weight of **0.5 or better**, not merely "appears somewhere in the
 * crosswalk". Built Environment is the case that forced the distinction: its only
 * inbound mappings are 0.3 and 0.2, which together contribute a fraction of the sector
 * component and leave the ranking driven entirely by stage and syndicate history.
 * Counting that as covered would have suppressed the warning on exactly the sector that
 * most needs it.
 */
const CONFIDENT_MAPPING = 0.5;

export const SECTORS_WITHOUT_THESIS_COVERAGE: string[] = (() => {
  const mapped = new Set<string>();
  for (const sectors of Object.values(THESIS_TO_SECTOR)) {
    for (const [s, weight] of Object.entries(sectors)) {
      if (weight >= CONFIDENT_MAPPING) mapped.add(s);
    }
  }
  return [
    "Clinical Care",
    "Consumer Wellbeing",
    "Life Sciences Tools",
    "Workforce Software",
    "Learning & Skills",
    "Commerce Enablement",
    "Energy Systems",
    "Built Environment",
    "Freight & Mobility",
  ].filter((s) => !mapped.has(s));
})();

/** Map the many round spellings in the CRM onto a ladder rung. */
function ladderIndex(raw: string): number | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  if (s.includes("pre-seed") || s.includes("pre seed") || s === "preseed") return 0;
  if (s.includes("series a")) return 2;
  if (s.includes("series b")) return 3;
  if (s.includes("series c")) return 4;
  if (s.includes("series d") || s.includes("series e")) return 5;
  if (s.includes("growth") || s.includes("private equity")) return 5;
  // "Seed", "Seed Extension", "Bridge (pre-Series A)" all sit at the seed rung.
  if (s.includes("seed") || s.includes("bridge")) return 1;
  return null;
}

// ---------------------------------------------------------------------------
// Score shape
// ---------------------------------------------------------------------------

/**
 * One weighted contributor to a match score. The UI renders every one of these, present
 * or absent, so the ranking is never a black box.
 */
export interface ScoreComponent {
  key: "sector" | "stage" | "syndicate" | "keyword";
  label: string;
  /** 0–1, before weighting. */
  raw: number;
  /** Max points this component can contribute. */
  weight: number;
  /** raw × weight — what actually lands in the total. */
  points: number;
  /** Human-readable reason, e.g. "Digital Health → Clinical Care". */
  detail: string | null;
}

export interface MatchResult {
  person: TrackedPerson;
  /** Firm name where we have one, otherwise the person's name. */
  label: string;
  /** 0–100. Only the ordering is meaningful — see the UI footnote. */
  score: number;
  components: ScoreComponent[];
  /** Deals this investor has co-invested with us on that share the target's theme. */
  sharedThemeDeals: string[];
  /** All deals they have co-invested with us on. */
  allDeals: string[];
}

export interface MatchReport {
  company: StagedCompany;
  matches: MatchResult[];
  /**
   * True when the company's canonical sector is one no co-investor thesis maps onto, so
   * the sector component is structurally 0 for everyone and the ranking rests on stage
   * and syndicate history alone.
   */
  sectorFitIsBlind: boolean;
  /** How many co-investors carry no usable thesis text at all (the 14%). */
  investorsWithoutThesis: number;
  /**
   * The noise floor. Scores at or below this are not meaningfully different from an
   * unranked list, and the UI refuses to present them as recommendations.
   */
  noiseFloor: number;
}

const WEIGHTS = {
  sector: 45,
  stage: 25,
  syndicate: 20,
  keyword: 10,
} as const;

/**
 * Anything at or below this total is treated as "no real signal".
 *
 * The floor requires a confident sector hit plus another matching axis. A single weak
 * agreement should not fill the shortlist.
 */
const NOISE_FLOOR = 48;

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

/**
 * Sector fit via the crosswalk. Takes the investor's best-matching thesis term rather
 * than averaging across all of their terms: a generalist listing six sectors should not
 * be penalised for the five that are irrelevant to this company.
 */
function sectorComponent(company: StagedCompany, focuses: string[]): ScoreComponent {
  const target = company.canonicalSector;
  let best = 0;
  let bestDetail: string | null = null;

  if (target) {
    for (const focus of focuses) {
      const weight = THESIS_TO_SECTOR[focus]?.[target];
      if (weight !== undefined && weight > best) {
        best = weight;
        bestDetail = `${focus} → ${target}`;
      }
    }
  }

  return {
    key: "sector",
    label: "Sector thesis",
    raw: best,
    weight: WEIGHTS.sector,
    points: best * WEIGHTS.sector,
    detail:
      bestDetail ??
      (focuses.length === 0
        ? "No thesis recorded"
        : target
          ? `No thesis term maps to ${target}`
          : "Company has no canonical sector"),
  };
}

/**
 * Stage fit on the six-rung ladder. Exact rung = 1, one rung away = 0.5, two = 0.2,
 * further = 0. Adjacency matters because a Seed investor is a real candidate for a
 * Series A round and a useless one for a Series C.
 */
function stageComponent(company: StagedCompany, person: TrackedPerson): ScoreComponent {
  const investorRung = person.stageFocus ? ladderIndex(person.stageFocus) : null;

  // The company's own stage: prefer its recorded round, fall back to nothing. The
  // Pipeline `stage` column is a deal stage ("Sourcing", "Due Diligence"), not a
  // funding stage, so it deliberately does not feed this.
  const companyRungs = company.rounds.map(ladderIndex).filter((r): r is number => r !== null);

  if (investorRung === null || companyRungs.length === 0) {
    return {
      key: "stage",
      label: "Stage focus",
      raw: 0,
      weight: WEIGHTS.stage,
      points: 0,
      detail: investorRung === null ? "No stage focus recorded" : "Company has no recorded round",
    };
  }

  const distance = Math.min(...companyRungs.map((r) => Math.abs(r - investorRung)));
  const raw = distance === 0 ? 1 : distance === 1 ? 0.5 : distance === 2 ? 0.2 : 0;

  return {
    key: "stage",
    label: "Stage focus",
    raw,
    weight: WEIGHTS.stage,
    points: raw * WEIGHTS.stage,
    detail:
      distance === 0
        ? `${person.stageFocus} — exact match`
        : `${person.stageFocus} · ${distance} rung${distance === 1 ? "" : "s"} away`,
  };
}

/**
 * Syndicate history is a secondary signal, not the ranking itself.
 *
 * Deals in the same theme as the target count double, because "we have been in three
 * Care & Longevity rounds together" is a far better predictor for a Care & Longevity
 * company than three unrelated ones. Saturates at 4 weighted deals so a hyper-active
 * co-investor cannot dominate the board on history alone.
 */
function syndicateComponent(
  dealThemes: Map<string, string | null>,
  person: TrackedPerson,
  targetTheme: string | null,
): { component: ScoreComponent; sharedThemeDeals: string[] } {
  const sharedThemeDeals: string[] = [];
  let weighted = 0;

  for (const deal of person.dealsCoInvested) {
    const theme = dealThemes.get(normaliseCompanyName(deal)) ?? null;
    if (targetTheme && theme === targetTheme) {
      sharedThemeDeals.push(deal);
      weighted += 2;
    } else {
      weighted += 1;
    }
  }

  const raw = Math.min(weighted / 4, 1);
  const total = person.dealsCoInvested.length;

  return {
    component: {
      key: "syndicate",
      label: "Syndicate history",
      raw,
      weight: WEIGHTS.syndicate,
      points: raw * WEIGHTS.syndicate,
      detail:
        total === 0
          ? "No prior co-investments recorded"
          : sharedThemeDeals.length > 0
            ? `${total} prior deal${total === 1 ? "" : "s"}, ${sharedThemeDeals.length} in ${targetTheme}`
            : `${total} prior deal${total === 1 ? "" : "s"}, none in this theme`,
    },
    sharedThemeDeals,
  };
}

/**
 * Direct keyword overlap between the raw thesis text and the company's own sub-sectors
 * and enrichment tags. This is the safety net for anything the hand-written crosswalk
 * misses — it is weighted lowest precisely because it is the fuzziest signal.
 */
const STOP_WORDS = new Set([
  "and",
  "the",
  "for",
  "with",
  "services",
  "products",
  "technology",
  "invests",
  "primarily",
  "in",
  "of",
  "solutions",
  "platform",
]);

function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 3 && !STOP_WORDS.has(t)),
  );
}

function keywordComponent(company: StagedCompany, thesis: string | null): ScoreComponent {
  if (!thesis) {
    return {
      key: "keyword",
      label: "Keyword overlap",
      raw: 0,
      weight: WEIGHTS.keyword,
      points: 0,
      detail: "No thesis recorded",
    };
  }

  const thesisTokens = tokens(thesis);
  const companyTokens = tokens(
    [...company.subSectors, ...company.industry, ...company.investmentThemes].join(" "),
  );

  const hits = [...companyTokens].filter((t) => thesisTokens.has(t));
  const raw = Math.min(hits.length / 2, 1);

  return {
    key: "keyword",
    label: "Keyword overlap",
    raw,
    weight: WEIGHTS.keyword,
    points: raw * WEIGHTS.keyword,
    detail: hits.length ? `Shared terms: ${hits.slice(0, 3).join(", ")}` : "No shared terms",
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build the theme lookup once per report rather than per investor: 96 investors ×
 * ~1.6 deals each would otherwise re-scan 700 companies every time.
 */
function buildDealThemeMap(companies: readonly StagedCompany[]): Map<string, string | null> {
  const map = new Map<string, string | null>();
  for (const c of companies) {
    if (c.name) map.set(normaliseCompanyName(c.name), c.theme);
  }
  return map;
}

/**
 * Rank co-investors for one company. Deterministic and side-effect free — same inputs,
 * same output, every time.
 */
export function matchCoInvestors(
  company: StagedCompany,
  coInvestors: readonly TrackedPerson[],
  companies: readonly StagedCompany[],
): MatchReport {
  const dealThemes = buildDealThemeMap(companies);
  let investorsWithoutThesis = 0;

  const matches: MatchResult[] = coInvestors.map((person) => {
    const focuses = parseThesisFocus(person.sectorThesisFocus);
    if (focuses.length === 0) investorsWithoutThesis += 1;

    const sector = sectorComponent(company, focuses);
    const stage = stageComponent(company, person);
    const { component: syndicate, sharedThemeDeals } = syndicateComponent(
      dealThemes,
      person,
      company.theme,
    );
    const keyword = keywordComponent(company, person.sectorThesisFocus);

    const components = [sector, stage, syndicate, keyword];
    const score = components.reduce((sum, c) => sum + c.points, 0);

    return {
      person,
      label: person.fundFirm ?? person.name ?? "Unnamed investor",
      score,
      components,
      sharedThemeDeals,
      allDeals: person.dealsCoInvested,
    };
  });

  matches.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));

  return {
    company,
    matches,
    sectorFitIsBlind:
      company.canonicalSector !== null &&
      SECTORS_WITHOUT_THESIS_COVERAGE.includes(company.canonicalSector),
    investorsWithoutThesis,
    noiseFloor: NOISE_FLOOR,
  };
}

/** The matches worth showing — above the noise floor, capped. */
export function topMatches(report: MatchReport, limit = 8): MatchResult[] {
  return report.matches.filter((m) => m.score > report.noiseFloor).slice(0, limit);
}
