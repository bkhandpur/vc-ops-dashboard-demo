"use client";

import { Search, Users } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useDeferredValue, useMemo, useState } from "react";

import { CompanyAvatar } from "@/components/CompanyAvatar";
import { ThemeSwatch } from "@/components/statistics/ThemeSwatch";
import {
  EmptyState,
  Input,
  Panel,
  PanelHeader,
  PageHeader,
  Badge,
  cx,
} from "@/components/ui";
import type { StagedCompany } from "@/lib/aggregate";
import { matchCoInvestors, topMatches } from "@/lib/matchmaking";
import type { TrackedPerson } from "@/lib/people-derive";
import { fuzzyScore } from "@/lib/fuzzy";

import { MatchList } from "./MatchList";

/**
 * Standalone matchmaking view: pick a company, see who to bring into the round.
 *
 * Everything is computed client-side from the two cached snapshots, so switching
 * company is instant and no page load ever touches the CRM. The scoring function is pure
 * and deterministic — see the header of lib/matchmaking.ts.
 */
export function MatchView({
  companies,
  coInvestors,
  generatedAt,
  initialRecordId,
}: {
  companies: StagedCompany[];
  coInvestors: TrackedPerson[];
  generatedAt: string;
  initialRecordId: string | null;
}) {
  const router = useRouter();
  const params = useSearchParams();

  const selectedId = params.get("company") ?? initialRecordId;
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  // Matchmaking is for deals we could still bring investors into, so the picker is
  // Pipeline-first. Portfolio is included because a follow-on round is a real case;
  // Archive is not — we passed on those.
  const selectable = useMemo(
    () =>
      companies
        .filter((c) => c.stages.includes("pipeline") || c.stages.includes("portfolio"))
        .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "")),
    [companies],
  );

  const results = useMemo(() => {
    const q = deferredQuery.trim();
    if (!q) return selectable.slice(0, 40);
    return selectable
      .map((c) => ({ company: c, score: fuzzyScore(q, c.name ?? "")?.score ?? -1 }))
      .filter((r) => r.score >= 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 40)
      .map((r) => r.company);
  }, [deferredQuery, selectable]);

  const selected = useMemo(
    () => selectable.find((c) => c.recordId === selectedId) ?? null,
    [selectable, selectedId],
  );

  const report = useMemo(
    () => (selected ? matchCoInvestors(selected, coInvestors, companies) : null),
    [selected, coInvestors, companies],
  );

  const matches = useMemo(() => (report ? topMatches(report, 12) : []), [report]);

  function select(recordId: string) {
    router.replace(`/co-investors/match?company=${recordId}`, { scroll: false });
  }

  return (
    <div>
      <PageHeader
        eyebrow="Co-Investors"
        title="Syndicate matchmaking"
        description="Co-investors ranked by thesis, stage fit and prior syndicate history."
        actions={
          <Link
            href="/co-investors"
            className="text-[13px] text-accent hover:underline"
          >
            Full directory
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Panel className="ws-enter h-fit overflow-hidden">
          <PanelHeader
            title="Company"
            description={`${selectable.length} on Pipeline or Portfolio`}
          />
          <div className="px-3 pt-3">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-ink-subtle" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find a company"
                className="pl-8"
                aria-label="Find a company"
              />
            </div>
          </div>
          <ul className="mt-2 max-h-[560px] overflow-y-auto p-2">
            {results.map((company, index) => {
              const active = company.recordId === selectedId;
              return (
                <li key={company.recordId}>
                  <button
                    type="button"
                    onClick={() => select(company.recordId)}
                    className={cx(
                      "ws-settle ws-stagger flex w-full items-center gap-2 rounded-[var(--radius-control)] px-2 py-1.5 text-left transition-colors duration-[var(--dur-quick)]",
                      active
                        ? "bg-accent-soft text-accent"
                        : "text-ink-muted hover:bg-surface-sunken hover:text-ink",
                    )}
                    style={{ "--i": index } as React.CSSProperties}
                  >
                    <CompanyAvatar
                      name={company.name}
                      logoUrl={company.logoUrl}
                      size={20}
                    />
                    <span className="min-w-0 flex-1 truncate text-[13px]">
                      {company.name ?? "Unnamed"}
                    </span>
                    {company.theme && <ThemeSwatch theme={company.theme} />}
                  </button>
                </li>
              );
            })}
            {results.length === 0 && (
              <li className="px-2 py-6 text-center text-[12px] text-ink-subtle">
                No company matches “{deferredQuery}”.
              </li>
            )}
          </ul>
        </Panel>

        <Panel className="ws-enter ws-delay-1 overflow-hidden">
          {selected && report ? (
            <>
              <PanelHeader
                title={
                  <span className="flex items-center gap-2">
                    {selected.name ?? "Unnamed company"}
                    {selected.theme && <ThemeSwatch theme={selected.theme} />}
                  </span>
                }
                description={
                  [
                    selected.canonicalSector,
                    selected.pipelineStage,
                    selected.rounds.join(", ") || null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "No sector, stage or round recorded"
                }
                actions={
                  <Badge tone={matches.length ? "accent" : "neutral"}>
                    {matches.length} shown
                  </Badge>
                }
              />
              <MatchList report={report} matches={matches} />
            </>
          ) : (
            <EmptyState
              title="Pick a company"
              icon={<Users className="size-6" />}
            >
              Choose a Pipeline or Portfolio company on the left to see which
              co-investors fit its sector and stage.
            </EmptyState>
          )}
        </Panel>
      </div>

      <p className="mt-4 text-[11px] text-ink-subtle">
        Snapshot taken {new Date(generatedAt).toLocaleString()}.
      </p>
    </div>
  );
}
