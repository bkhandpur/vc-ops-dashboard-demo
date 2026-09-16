"use client";

import Link from "next/link";
import { useMemo } from "react";

import { MatchList } from "@/components/match/MatchList";
import { Panel, PanelHeader } from "@/components/ui";
import type { StagedCompany } from "@/lib/aggregate";
import { matchCoInvestors, topMatches } from "@/lib/matchmaking";
import type { TrackedPerson } from "@/lib/people-derive";

/**
 * "Who could we bring into this round" on the company detail page.
 *
 * Shows the top few and links to the full view rather than listing a dozen — this is one
 * panel among seven on an already-long page, and the standalone view exists for when
 * someone actually wants to work through the list.
 *
 * Computed from the cached people snapshot on the client.
 */
export function CoInvestorMatchPanel({
  company,
  companies,
  coInvestors,
}: {
  company: StagedCompany;
  companies: StagedCompany[];
  coInvestors: TrackedPerson[];
}) {
  const report = useMemo(
    () => matchCoInvestors(company, coInvestors, companies),
    [company, coInvestors, companies],
  );
  const matches = useMemo(() => topMatches(report, 4), [report]);

  // Archived companies are ones we passed on — a syndicate panel there is noise.
  if (!company.stages.includes("pipeline") && !company.stages.includes("portfolio")) {
    return null;
  }

  return (
    <Panel className="ws-enter ws-delay-5 mt-4 overflow-hidden">
      <PanelHeader
        title="Co-investors who fit this round"
        description="Ranked by sector and stage fit, with prior syndicate history as a secondary signal."
        actions={
          <Link
            href={`/co-investors/match?company=${company.recordId}`}
            className="text-[12px] text-accent hover:underline"
          >
            See all
          </Link>
        }
      />
      <MatchList report={report} matches={matches} />
    </Panel>
  );
}
