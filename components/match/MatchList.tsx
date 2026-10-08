"use client";

import { ArrowUpRight, Users } from "lucide-react";

import { Badge, Callout, EmptyState, Footnote } from "@/components/ui";
import { crmRecordUrl } from "@/lib/constants";
import type { MatchReport, MatchResult } from "@/lib/matchmaking";

import { ScoreBreakdown, SharedDeals } from "./ScoreBreakdown";

/**
 * Ranked co-investor matches for one company.
 *
 * Shared by the panel on the company detail page and the standalone /co-investors/match
 * view, so the two can never drift into showing different rankings for the same company.
 */
export function MatchList({
  report,
  matches,
  /** Compact mode drops the per-component breakdown — used inside the palette. */
  compact = false,
}: {
  report: MatchReport;
  matches: MatchResult[];
  compact?: boolean;
}) {
  if (matches.length === 0) {
    return (
      <EmptyState title="No strong matches" icon={<Users className="size-6" />}>
        No co-investor clears the signal threshold for {report.company.name ?? "this company"}.
        {report.sectorFitIsBlind && (
          <>
            {" "}
            It is also expected here: no co-investor in the workspace describes a{" "}
            <strong>{report.company.canonicalSector}</strong> thesis, so the sector component scores
            zero for everyone.
          </>
        )}
      </EmptyState>
    );
  }

  return (
    <div>
      {report.sectorFitIsBlind && (
        <div className="px-4 pt-3">
          <Callout tone="warn">
            No co-investor thesis maps confidently onto{" "}
            <strong>{report.company.canonicalSector}</strong>, so the sector component scores zero
            for every investor below and this ranking rests on stage focus and syndicate history
            alone. Treat it as a shortlist, not a recommendation.
          </Callout>
        </div>
      )}

      <ul className="divide-y divide-line">
        {matches.map((match, index) => (
          <li
            key={match.person.recordId}
            className="ws-settle ws-stagger px-4 py-3"
            style={{ "--i": index } as React.CSSProperties}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <a
                    href={crmRecordUrl("people", match.person.recordId)}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate text-[13px] font-medium text-ink hover:text-accent"
                  >
                    {match.label}
                  </a>
                  <ArrowUpRight className="size-3 shrink-0 text-ink-subtle" />
                </div>
                <p className="mt-0.5 text-[11px] text-ink-subtle">
                  {[
                    match.person.stageFocus,
                    match.person.checkSizeRange,
                    match.allDeals.length
                      ? `${match.allDeals.length} prior deal${match.allDeals.length === 1 ? "" : "s"}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "No stage or cheque size recorded"}
                </p>
              </div>

              <div className="shrink-0 text-right">
                <span className="ws-nums text-[18px] leading-none font-semibold text-ink">
                  {match.score.toFixed(0)}
                </span>
                <p className="mt-0.5 text-[10px] tracking-[0.06em] text-ink-subtle uppercase">
                  score
                </p>
              </div>
            </div>

            {!compact && (
              <div className="mt-2.5">
                <ScoreBreakdown components={match.components} index={index} />
                <SharedDeals deals={match.sharedThemeDeals} theme={report.company.theme} />
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="px-4 pb-3">
        <Footnote>
          Score is 0–100 from four weighted components — sector thesis (45), stage focus (25),
          syndicate history (20) and keyword overlap (10). Only the ordering is meaningful. Scores
          at or below {report.noiseFloor} are hidden.
        </Footnote>
      </div>
    </div>
  );
}

/** The "N matches" badge used in panel headers. */
export function MatchCountBadge({ count }: { count: number }) {
  return (
    <Badge tone={count > 0 ? "accent" : "neutral"}>
      {count} {count === 1 ? "match" : "matches"}
    </Badge>
  );
}
