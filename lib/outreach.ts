/**
 * Stealth-founder outreach queue. Pure, isomorphic, deterministic.
 *
 * ⚠️  THIS IS NOT AN AGENT AND MUST NEVER BECOME ONE.
 * The queue is a sort. It runs on page load over the cached people snapshot, calls no
 * model, and writes nothing. The one write in this feature — marking a founder as
 * reached out — happens only when a human clicks the button and confirms the payload,
 * exactly like every other mutation in the app. Nothing here decides to contact anyone;
 * it decides what order to *show* them in, and a person decides the rest.
 *
 * ── WHAT THIS IS AND IS NOT ──────────────────────────────────────────────────
 * This is a "never contacted yet" queue. It is NOT a staleness or engagement tracker.
 * Every interaction field on the people object is 0% populated across all 276 records
 * on both people lists, so there is no recency signal to rank on and no honest way to
 * say a relationship has gone cold. See the header of lib/people-derive.ts.
 *
 * The headline fact it exists to act on:
 *   `reached_out` is TRUE on 0 founders, FALSE on 132, and unset on 48.
 * Nobody has been contacted. The queue's job is to make the first 5-a-week tractable.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ── WHY ROTATION RATHER THAN A TOP-N ─────────────────────────────────────────
 * A straight "most complete profile first" ranking favors the largest sourcing lists,
 * while
 * the other three teammates' sourcing never surfaced at all.
 *
 * So the queue round-robins across sourcers and ranks *within* each. Completeness is a
 * tiebreaker inside a teammate's own backlog, never a cross-teammate ranking — this
 * orders whose turn it is, and it is explicitly not a judgement of founder quality.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { scoreFounderQuality, type QualityScore } from "./founder-quality";
import { outreachState, UNATTRIBUTED, type TrackedPerson } from "./people-derive";

/**
 * What makes a founder actually reachable, and how much each field is worth.
 *
 * Weighted by what you need to *write the message*, not by how impressive the founder
 * is. A LinkedIn URL and a current role are what let someone open a tab and send a
 * note; an avatar does not, so it is not scored at all.
 *
 * Coverage across the 180 founders:
 *   linkedin 100% · linkedinCompany/Position 78% · location 85% · education 69% ·
 *   highlights 61% · email 63%
 */
export interface CompletenessFactor {
  key: string;
  label: string;
  weight: number;
  present: (person: TrackedPerson) => boolean;
}

export const COMPLETENESS_FACTORS: CompletenessFactor[] = [
  {
    key: "linkedin",
    label: "LinkedIn",
    weight: 3,
    present: (p) => Boolean(p.linkedin),
  },
  {
    key: "role",
    label: "Role & employer",
    weight: 3,
    present: (p) => Boolean(p.linkedinPosition ?? p.jobTitle) && Boolean(p.linkedinCompany),
  },
  {
    key: "highlights",
    label: "Highlights",
    weight: 2,
    present: (p) => p.highlights.length > 0,
  },
  {
    key: "email",
    label: "Email",
    weight: 2,
    present: (p) => Boolean(p.email),
  },
  {
    key: "education",
    label: "Education",
    weight: 1,
    present: (p) => Boolean(p.education),
  },
  {
    key: "location",
    label: "Location",
    weight: 1,
    present: (p) => Boolean(p.location),
  },
];

const MAX_COMPLETENESS = COMPLETENESS_FACTORS.reduce((s, f) => s + f.weight, 0);

export interface CompletenessResult {
  /** 0–100. */
  pct: number;
  present: CompletenessFactor[];
  missing: CompletenessFactor[];
}

export function completeness(person: TrackedPerson): CompletenessResult {
  const present: CompletenessFactor[] = [];
  const missing: CompletenessFactor[] = [];
  let score = 0;

  for (const factor of COMPLETENESS_FACTORS) {
    if (factor.present(person)) {
      present.push(factor);
      score += factor.weight;
    } else {
      missing.push(factor);
    }
  }

  return { pct: (score / MAX_COMPLETENESS) * 100, present, missing };
}

export interface QueueEntry {
  person: TrackedPerson;
  /** Which teammate's backlog this came from. */
  sourcer: string;
  completeness: CompletenessResult;
  /** Generated quality signal. Missing data is distinct from a low score. */
  quality: QualityScore;
  /** 1-based position in the final rotation. */
  position: number;
}

export interface OutreachQueue {
  entries: QueueEntry[];
  /** Teammates represented in this queue, in rotation order. */
  sourcers: string[];
  /** Founders eligible (never contacted) but not selected this round. */
  remaining: number;
  /** Total never-contacted founders. */
  eligible: number;
}

/**
 * Eligible = not yet contacted. Both `false` (triaged, not contacted) and `null`
 * (untriaged) qualify — the distinction is preserved and shown in the UI, but neither
 * has been reached out to, and both are things somebody should act on.
 */
export function isEligible(person: TrackedPerson): boolean {
  return outreachState(person) !== "contacted";
}

/**
 * Build the weekly rotation.
 *
 * Deterministic by construction: sourcers are ordered by backlog size (largest first,
 * `Unattributed` pinned last because it is a bucket rather than a teammate), founders
 * within a sourcer by completeness then by name. Same snapshot in, same queue out — no
 * randomness, so two partners looking at the same page see the same five names.
 *
 * A founder carrying several `sourced_by` values is assigned to the sourcer with the
 * smallest backlog among them, so a multiply-attributed founder helps the teammate who
 * has least to show rather than padding the largest queue. Each founder appears once.
 */
export function buildOutreachQueue(
  people: readonly TrackedPerson[],
  size: number,
  /** Optional generated highlights used as a tiebreak within one source group. */
  highlightsByRecordId: ReadonlyMap<string, string[]> = new Map(),
): OutreachQueue {
  const eligible = people.filter(isEligible);

  // Backlog size per sourcer, used both for ordering and for the assignment tiebreak.
  const backlog = new Map<string, number>();
  for (const person of eligible) {
    for (const name of person.sourcedBy.length ? person.sourcedBy : [UNATTRIBUTED]) {
      backlog.set(name, (backlog.get(name) ?? 0) + 1);
    }
  }

  const bySourcer = new Map<string, TrackedPerson[]>();
  for (const person of eligible) {
    const candidates = person.sourcedBy.length ? person.sourcedBy : [UNATTRIBUTED];
    const owner = [...candidates].sort(
      (a, b) => (backlog.get(a) ?? 0) - (backlog.get(b) ?? 0) || a.localeCompare(b),
    )[0]!;
    const list = bySourcer.get(owner) ?? [];
    list.push(person);
    bySourcer.set(owner, list);
  }

  const sourcers = [...bySourcer.keys()].sort((a, b) => {
    if (a === UNATTRIBUTED) return 1;
    if (b === UNATTRIBUTED) return -1;
    return (bySourcer.get(b)?.length ?? 0) - (bySourcer.get(a)?.length ?? 0) || a.localeCompare(b);
  });

  // Rank within each teammate's own backlog. Both signals are tiebreakers *here*, never
  // across teammates — they order one person's list, they do not rate founders globally.
  //
  // Quality leads completeness: given two of the same teammate's founders, "this one has
  // a prior exit" is a better reason to write to them first than "we have their
  // education". Completeness still breaks quality ties, and it is the only signal for
  // the founders with no tags at all.
  const qualityOf = (p: TrackedPerson) =>
    scoreFounderQuality(highlightsByRecordId.get(p.recordId) ?? []).points;

  const ranked = new Map<string, TrackedPerson[]>();
  for (const [name, list] of bySourcer) {
    ranked.set(
      name,
      [...list].sort(
        (a, b) =>
          qualityOf(b) - qualityOf(a) ||
          completeness(b).pct - completeness(a).pct ||
          (a.name ?? "").localeCompare(b.name ?? ""),
      ),
    );
  }

  // Round-robin: one from each teammate per pass, so a queue of 5 across 6 teammates
  // reads as "one each" rather than "five from whoever sources most".
  const entries: QueueEntry[] = [];
  const cursors = new Map<string, number>(sourcers.map((s) => [s, 0]));

  while (entries.length < size) {
    let progressed = false;
    for (const sourcer of sourcers) {
      if (entries.length >= size) break;
      const list = ranked.get(sourcer)!;
      const cursor = cursors.get(sourcer)!;
      const person = list[cursor];
      if (!person) continue;
      cursors.set(sourcer, cursor + 1);
      entries.push({
        person,
        sourcer,
        completeness: completeness(person),
        quality: scoreFounderQuality(highlightsByRecordId.get(person.recordId) ?? []),
        position: entries.length + 1,
      });
      progressed = true;
    }
    if (!progressed) break;
  }

  return {
    entries,
    sourcers,
    remaining: Math.max(eligible.length - entries.length, 0),
    eligible: eligible.length,
  };
}

export interface OutreachSummary {
  total: number;
  contacted: number;
  notContacted: number;
  untriaged: number;
  /** Never-contacted founders per teammate, largest first. */
  backlogBySourcer: { name: string; count: number }[];
}

export function outreachSummary(people: readonly TrackedPerson[]): OutreachSummary {
  const backlog = new Map<string, number>();
  for (const person of people) {
    if (!isEligible(person)) continue;
    for (const name of person.sourcedBy.length ? person.sourcedBy : [UNATTRIBUTED]) {
      backlog.set(name, (backlog.get(name) ?? 0) + 1);
    }
  }

  return {
    total: people.length,
    contacted: people.filter((p) => outreachState(p) === "contacted").length,
    notContacted: people.filter((p) => outreachState(p) === "not-contacted").length,
    untriaged: people.filter((p) => outreachState(p) === "unset").length,
    backlogBySourcer: [...backlog.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => {
        if (a.name === UNATTRIBUTED) return 1;
        if (b.name === UNATTRIBUTED) return -1;
        return b.count - a.count;
      }),
  };
}
