"use client";

import { useMemo } from "react";
import Link from "next/link";

import { Badge, Callout, Footnote, Panel, PanelHeader } from "@/components/ui";
import type { EnrichedCompanyFact } from "@/lib/enrichment-snapshot";
import { normaliseCompanyName, type TrackedPerson } from "@/lib/people-derive";

/**
 * Per-round syndicate composition, from the enrichment provider.
 *
 * This is the first place in the app that shows **which round we were in and who
 * else was in it**. the CRM records a single `total_raised_usd` total and nothing about
 * round membership, so none of this was previously visible anywhere in the stack.
 *
 * ⚠️  IT IS STILL NOT OUR CHEQUE SIZE. "We appear as an investor in this $6M
 * seed" says nothing about how much of that $6M was ours, and the panel says so
 * explicitly. the CRM records no invested amount (0% on both fields, confirmed three
 * ways), and the enrichment provider does not break rounds down by investor either.
 */
export function SyndicatePanel({
  fact,
  coInvestors,
}: {
  fact: EnrichedCompanyFact | null;
  coInvestors: TrackedPerson[];
}) {
  /** Cross-link generated investor names to the co-investor directory. */
  const coInvestorByName = useMemo(() => {
    const map = new Map<string, TrackedPerson>();
    for (const person of coInvestors) {
      const label = person.fundFirm ?? person.name;
      if (label) map.set(normaliseCompanyName(label), person);
    }
    return map;
  }, [coInvestors]);

  if (!fact || fact.ourRounds.length === 0) return null;

  return (
    <Panel className="ws-enter ws-delay-5 mt-4 overflow-hidden">
      <PanelHeader
        title="Rounds we were in"
        description="From the provider's record of publicly reported funding rounds."
        actions={<Badge tone="neutral">Enrichment</Badge>}
      />

      <ul className="divide-y divide-line">
        {fact.ourRounds.map((round, index) => (
          <li
            key={`${round.roundType}-${round.announcementDate}-${index}`}
            className="ws-settle ws-stagger px-4 py-3"
            style={{ "--i": index } as React.CSSProperties}
          >
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-[13px] font-semibold text-ink">
                {round.roundType?.replace(/_/g, " ") ?? "Round"}
              </span>
              {round.amount !== null && (
                <span className="ws-nums text-[13px] text-ink">
                  {formatMoney(round.amount, round.currency)}
                </span>
              )}
              {round.announcementDate && (
                <span className="text-[11px] text-ink-subtle">
                  announced {round.announcementDate.slice(0, 10)}
                </span>
              )}
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5">
              {round.investors.map((investor, i) => {
                const match = coInvestorByName.get(normaliseCompanyName(investor.name));
                const chip = (
                  <span
                    className={
                      investor.isOurFirm
                        ? "inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent"
                        : "inline-flex items-center gap-1 rounded-full border border-line bg-surface-sunken px-2 py-0.5 text-[11px] text-ink-muted"
                    }
                  >
                    {investor.name}
                    {investor.isLead && (
                      <span className="text-[10px] tracking-wide uppercase opacity-70">lead</span>
                    )}
                  </span>
                );
                return match ? (
                  <Link
                    key={`${investor.name}-${i}`}
                    href={`/co-investors?q=${encodeURIComponent(investor.name)}`}
                    title="On our Co-Investors list"
                    className="underline decoration-dotted underline-offset-4"
                  >
                    {chip}
                  </Link>
                ) : (
                  <span key={`${investor.name}-${i}`}>{chip}</span>
                );
              })}
            </div>
          </li>
        ))}
      </ul>

      {fact.valuation && (
        <div className="px-4 pb-3">
          <Callout tone="warn">
            <span className="block font-medium">
              The enrichment provider puts the valuation at{" "}
              {formatMoney(fact.valuation.value, "USD")}, attributed to{" "}
              {fact.valuation.source.toLowerCase()}, not to us.
            </span>
            The provider&rsquo;s figure, carried through with its own attribution rather than
            restated as fact.
            {fact.valuation.isPotentiallyStale &&
              " It also flags this value as possibly out of date, which is exactly the qualifier that gets dropped when a number is quoted in a meeting."}
          </Callout>
        </div>
      )}

      <div className="px-4 pb-3">
        <Footnote>
          Round amounts are the <strong>total raised in that round from all investors</strong>.
          Neither the CRM nor the enrichment provider records how much of it was ours, so nothing
          here represents the workspace’s investment size. Underlined investors appear in the sample
          Co-Investors list. Click through to the directory.
        </Footnote>
      </div>
    </Panel>
  );
}

function formatMoney(value: number, currency: string | null): string {
  const prefix = !currency || currency === "USD" ? "$" : `${currency} `;
  if (value >= 1_000_000_000) return `${prefix}${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${prefix}${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${prefix}${(value / 1_000).toFixed(0)}K`;
  return `${prefix}${value}`;
}
