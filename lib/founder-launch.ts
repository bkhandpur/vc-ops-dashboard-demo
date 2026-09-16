/** Deterministic launch suggestions for generated founder records. */

/** A founder's enrichment-derived launch state, as carried in the cached snapshot. */
export interface FounderLaunchSignal {
  /** Local record id used to join the generated founder list. */
  recordId: string;
  /** The provider's person id, for a deep link. */
  providerPersonId: string | null;
  /** Current company name as the provider has it. */
  companyName: string | null;
  /** The provider's company id, when the position carries one. */
  providerCompanyId: string | null;
  /** FOUNDER / EXECUTIVE / EMPLOYEE / … */
  roleType: string | null;
  title: string | null;
  /** When they started the current role. */
  startDate: string | null;
  /** True when the current company is still a `Stealth Company (X)` placeholder. */
  stillStealth: boolean;
  /** Corroboration from `prior_stealth_association`, when the provider has it. */
  emergenceDate: string | null;
  previouslyKnownAs: string[];
  /** Generated categories used by the quality signal. */
  highlights: string[];
}

/**
 * The provider represents an unnamed stealth company as `Stealth Company (Person Name)`.
 * A founder whose current employer still looks like that has not launched anything we
 * can point at.
 *
 * Deliberately conservative: anything starting with "stealth" counts as a placeholder,
 * so a real company genuinely called "Stealth Mode Robotics" would be treated as not-yet
 * launched. That direction of error produces a missing suggestion, which is recoverable;
 * the other direction produces a confident wrong link into the CRM, which is not.
 */
export function isStealthPlaceholder(name: string | null | undefined): boolean {
  if (!name) return true;
  return /^\s*stealth\b/i.test(name.trim());
}

export type LaunchConfidence = "confirmed" | "likely" | "possible";

export interface LaunchSuggestion {
  signal: FounderLaunchSignal;
  /**
   * `confirmed` — the provider corroborates with a prior-stealth record naming the old
   * placeholder and an emergence date.
   * `likely`    — a FOUNDER role at a real named company.
   * `possible`  — a real named company, but not in a founder role (they may simply have
   *               taken a job rather than launched).
   */
  confidence: LaunchConfidence;
  /** The human-readable case for this suggestion, rendered as bullet points. */
  evidence: string[];
}

export function classifyLaunch(signal: FounderLaunchSignal): LaunchSuggestion | null {
  if (signal.stillStealth || !signal.companyName) return null;

  const evidence: string[] = [];
  let confidence: LaunchConfidence;

  if (signal.emergenceDate || signal.previouslyKnownAs.length > 0) {
    confidence = "confirmed";
    if (signal.emergenceDate) {
      evidence.push(
        `The provider records this company emerging from stealth on ${signal.emergenceDate.slice(0, 10)}.`,
      );
    }
    if (signal.previouslyKnownAs.length > 0) {
      evidence.push(`Previously listed as ${signal.previouslyKnownAs.join(", ")}.`);
    }
  } else if (signal.roleType === "FOUNDER") {
    confidence = "likely";
  } else {
    confidence = "possible";
  }

  evidence.unshift(
    signal.roleType === "FOUNDER"
      ? `Currently a founder at ${signal.companyName}${
          signal.startDate ? `, since ${signal.startDate.slice(0, 7)}` : ""
        }.`
      : `Currently ${signal.title ?? signal.roleType ?? "working"} at ${signal.companyName}.`,
  );

  if (confidence === "possible") {
    evidence.push(
      "Not a founder role, so this may be a job rather than a company of their own.",
    );
  }

  return { signal, confidence, evidence };
}

const CONFIDENCE_RANK: Record<LaunchConfidence, number> = {
  confirmed: 0,
  likely: 1,
  possible: 2,
};

export interface LaunchReport {
  suggestions: LaunchSuggestion[];
  /** Founders whose current employer is still a stealth placeholder. */
  stillStealth: number;
  /** Founders we have an enrichment signal for at all. */
  resolved: number;
  total: number;
}

export function buildLaunchReport(
  signals: readonly FounderLaunchSignal[],
  totalFounders: number,
): LaunchReport {
  const suggestions = signals
    .map(classifyLaunch)
    .filter((s): s is LaunchSuggestion => s !== null)
    .sort(
      (a, b) =>
        CONFIDENCE_RANK[a.confidence] - CONFIDENCE_RANK[b.confidence] ||
        (b.signal.startDate ?? "").localeCompare(a.signal.startDate ?? ""),
    );

  return {
    suggestions,
    stillStealth: signals.filter((s) => s.stillStealth).length,
    resolved: signals.length,
    total: totalFounders,
  };
}
