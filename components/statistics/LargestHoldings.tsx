"use client";

import { ArrowUpRight } from "lucide-react";
import { useMemo, useState } from "react";

import type { StagedCompany } from "@/lib/aggregate";
import { crmRecordUrl, UNCLASSIFIED, type StageKey } from "@/lib/constants";
import { CompanyAvatar } from "../CompanyAvatar";
import { Panel } from "../ui";
import { useColorMode } from "../theme/ThemeProvider";
import { fillFor } from "./colors";

const SHOW = 10;

/**
 * Named "by capital raised", not "largest holdings", on purpose.
 *
 * `total_raised_usd` is the total the company has raised from EVERY investor — the CRM
 * holds no field for our own cheque, so we cannot rank by position size and must
 * not imply that we can. Ranking by it answers "which of our companies have raised the
 * most", which is genuinely useful and is a different question.
 *
 * Coverage is ~38% of Pipeline and ~55% of Portfolio, so the count of companies with no
 * figure is shown rather than quietly dropped — otherwise this reads as a complete
 * ranking when it is a ranking of the half we have data for.
 */
export function LargestHoldings({
  companies,
  stages,
}: {
  companies: StagedCompany[];
  stages: StageKey[];
}) {
  const mode = useColorMode();
  const [expanded, setExpanded] = useState(false);

  const { ranked, missing, inScope } = useMemo(() => {
    const scope = companies.filter((c) => c.stages.some((s) => stages.includes(s)));
    const withFigure = scope.filter(
      (c) => typeof c.fundingRaisedUsd === "number" && c.fundingRaisedUsd > 0,
    );
    return {
      ranked: [...withFigure].sort(
        (a, b) => (b.fundingRaisedUsd ?? 0) - (a.fundingRaisedUsd ?? 0),
      ),
      missing: scope.length - withFigure.length,
      inScope: scope.length,
    };
  }, [companies, stages]);

  if (inScope === 0) return null;

  const visible = expanded ? ranked.slice(0, 40) : ranked.slice(0, SHOW);
  const max = ranked[0]?.fundingRaisedUsd ?? 0;

  return (
    <Panel className="p-5">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[13px] font-medium text-ink">Largest by capital raised</h2>
        <span className="text-[11px] text-ink-subtle">
          {ranked.length} of {inScope} companies have a figure
        </span>
      </div>
      <p className="mb-4 text-[11px] leading-relaxed text-ink-subtle">
        Generated capital raised from all investors. These values are company fundraising
        totals, not investment positions.
      </p>

      {ranked.length === 0 ? (
        <p className="text-[13px] text-ink-subtle">
          No company in scope has a funding figure recorded.
        </p>
      ) : (
        <ol className="space-y-0.5">
          {visible.map((company, index) => {
            const amount = company.fundingRaisedUsd ?? 0;
            const theme = company.theme ?? UNCLASSIFIED;
            return (
              <li key={company.recordId}>
                <a
                  href={crmRecordUrl("companies", company.recordId)}
                  target="_blank"
                  rel="noreferrer"
                  className="ws-rise group flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-surface-sunken"
                  style={{
                    // Staggered reveal, capped so a long list never feels like a queue.
                    animationDelay: `${Math.min(index, 12) * 28}ms`,
                  }}
                >
                  <span className="w-4 shrink-0 text-right text-[11px] tabular-nums text-ink-subtle">
                    {index + 1}
                  </span>
                  <CompanyAvatar name={company.name} logoUrl={company.logoUrl} size={24} />

                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-[13px] text-ink">
                        {company.name ?? "(unnamed)"}
                      </span>
                      <ArrowUpRight className="size-3 shrink-0 text-ink-subtle opacity-0 transition-opacity group-hover:opacity-100" />
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span
                        aria-hidden
                        className="size-2 shrink-0 rounded-sm"
                        style={{ backgroundColor: fillFor(theme, 0, mode) }}
                      />
                      <span className="truncate text-[11px] text-ink-subtle">
                        {theme}
                        {company.canonicalSector ? ` · ${company.canonicalSector}` : ""}
                      </span>
                    </span>
                  </span>

                  {/* A hairline bar makes the spread between the top and the tail legible
                      without turning this list into a second chart. */}
                  <span className="hidden h-1 w-24 shrink-0 overflow-hidden rounded-full bg-surface-sunken sm:block">
                    <span
                      className="block h-full rounded-full"
                      style={{
                        width: `${max > 0 ? (amount / max) * 100 : 0}%`,
                        transition: "width 520ms cubic-bezier(0.22, 1, 0.36, 1)",
                        backgroundColor: fillFor(theme, 1, mode),
                      }}
                    />
                  </span>

                  <span className="w-16 shrink-0 text-right text-[12.5px] font-medium tabular-nums text-ink">
                    {formatUsd(amount)}
                  </span>
                </a>
              </li>
            );
          })}
        </ol>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
        {ranked.length > SHOW && (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="text-[12px] text-accent hover:underline"
          >
            {expanded ? "Show top 10" : `Show more (${Math.min(ranked.length, 40) - SHOW})`}
          </button>
        )}
        {missing > 0 && (
          <span className="text-[11px] text-ink-subtle">
            {missing} in scope have no funding figure and are not ranked here.
          </span>
        )}
      </div>
    </Panel>
  );
}

/** Compact USD: $4.3M, $180M, $1.2B. Never a bare 8-digit number in a narrow column. */
function formatUsd(value: number): string {
  if (value >= 1_000_000_000) return `$${trim(value / 1_000_000_000)}B`;
  if (value >= 1_000_000) return `$${trim(value / 1_000_000)}M`;
  if (value >= 1_000) return `$${trim(value / 1_000)}K`;
  return `$${Math.round(value)}`;
}

function trim(n: number): string {
  return n >= 100 ? String(Math.round(n)) : n.toFixed(1).replace(/\.0$/, "");
}
