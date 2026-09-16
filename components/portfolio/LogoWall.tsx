"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { CompanyAvatar } from "@/components/CompanyAvatar";
import { ThemeSwatch } from "@/components/statistics/ThemeSwatch";
import {
  EmptyState,
  Footnote,
  PageHeader,
  Panel,
  Segmented,
  StatTile,
  TogglePill,
} from "@/components/ui";
import type { StagedCompany } from "@/lib/aggregate";
import { STAGE_LABELS, UNCLASSIFIED, type StageKey } from "@/lib/constants";

type Grouping = "none" | "theme";

/**
 * The portfolio as a wall of marks — the view a partner actually wants to see first.
 *
 * Logo coverage on Portfolio is 90%, so roughly three of the 29 tiles are monograms. That
 * is why `CompanyAvatar`'s monogram had to look deliberate: on a wall, one broken-looking
 * tile spoils the whole grid.
 *
 * Defaults to Portfolio, but the stage toggles let it show Pipeline too — at 54% logo
 * coverage that grid is roughly half monograms, which is itself a useful thing to see.
 */
export function LogoWall({ companies }: { companies: StagedCompany[] }) {
  const [stages, setStages] = useState<StageKey[]>(["portfolio"]);
  const [grouping, setGrouping] = useState<Grouping>("theme");

  const inScope = useMemo(
    () =>
      companies
        .filter((c) => c.stages.some((s) => stages.includes(s)))
        .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "")),
    [companies, stages],
  );

  const withLogo = inScope.filter((c) => c.logoUrl).length;

  const groups = useMemo(() => {
    if (grouping === "none") return [{ label: null as string | null, companies: inScope }];
    const byTheme = new Map<string, StagedCompany[]>();
    for (const company of inScope) {
      const theme = company.theme ?? UNCLASSIFIED;
      byTheme.set(theme, [...(byTheme.get(theme) ?? []), company]);
    }
    return [...byTheme.entries()]
      .map(([label, list]) => ({ label, companies: list }))
      .sort((a, b) => {
        // Unclassified is a bucket, not a theme — it sorts last regardless of size.
        if (a.label === UNCLASSIFIED) return 1;
        if (b.label === UNCLASSIFIED) return -1;
        return b.companies.length - a.companies.length;
      });
  }, [inScope, grouping]);

  function toggleStage(stage: StageKey) {
    setStages((current) =>
      current.includes(stage)
        ? current.length === 1
          ? current
          : current.filter((s) => s !== stage)
        : [...current, stage],
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Explore"
        title="Portfolio"
        description="Every company we hold, as a wall of marks. Click through for the detail."
      />

      <div className="ws-enter ws-delay-1 mb-5 flex flex-wrap items-center gap-2">
        {(["portfolio", "pipeline", "archive"] as const).map((stage) => (
          <TogglePill
            key={stage}
            active={stages.includes(stage)}
            onClick={() => toggleStage(stage)}
          >
            {STAGE_LABELS[stage]}
          </TogglePill>
        ))}
        <span className="ml-auto">
          <Segmented<Grouping>
            ariaLabel="Group the logo wall"
            value={grouping}
            onChange={setGrouping}
            options={[
              { value: "theme", label: "By theme" },
              { value: "none", label: "A–Z" },
            ]}
          />
        </span>
      </div>

      <div className="ws-enter ws-delay-2 mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatTile label="Companies" value={inScope.length.toLocaleString()} />
        <StatTile
          label="With a logo"
          value={`${inScope.length === 0 ? 0 : Math.round((withLogo / inScope.length) * 100)}%`}
          hint={`${withLogo} of ${inScope.length} · the rest show a monogram`}
        />
        <StatTile
          label="Themes represented"
          value={new Set(inScope.map((c) => c.theme ?? UNCLASSIFIED)).size.toString()}
        />
      </div>

      {inScope.length === 0 ? (
        <Panel>
          <EmptyState title="Nothing on this list">
            Select another stage above.
          </EmptyState>
        </Panel>
      ) : (
        groups.map((group, groupIndex) => (
          <section key={group.label ?? "all"} className="mb-6">
            {group.label && (
              <h2 className="ws-waterline mb-3 flex items-center gap-2 pb-1.5 text-[12px] font-semibold text-ink">
                <ThemeSwatch theme={group.label} />
                {group.label}
                <span className="ws-nums font-normal text-ink-subtle">
                  {group.companies.length}
                </span>
              </h2>
            )}
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {group.companies.map((company, index) => (
                <li
                  key={company.recordId}
                  className="ws-enter"
                  style={{
                    // Stagger within a group, capped so a 340-tile archive grid does not
                    // take ten seconds to finish arriving.
                    animationDelay: `${Math.min(index + groupIndex * 2, 14) * 22}ms`,
                  }}
                >
                  <Link href={`/company/${company.recordId}`} className="block h-full">
                    <Panel
                      interactive
                      className="flex h-full flex-col items-center gap-2.5 px-3 py-4 text-center"
                    >
                      <CompanyAvatar
                        name={company.name}
                        logoUrl={company.logoUrl}
                        size={48}
                        className="rounded-lg"
                        theme={company.theme}
                      />
                      <span className="min-w-0 w-full">
                        <span className="block truncate text-[12px] font-medium text-ink">
                          {company.name ?? "Untitled"}
                        </span>
                        {(company.pipelineStage ?? company.canonicalSector) && (
                          <span className="mt-0.5 block truncate text-[10px] text-ink-subtle">
                            {company.pipelineStage ?? company.canonicalSector}
                          </span>
                        )}
                      </span>
                    </Panel>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <Footnote>
        Logos come from the CRM&rsquo;s own enrichment and are rendered with
        <code className="mx-1 text-[10px]">referrerPolicy=&quot;no-referrer&quot;</code>;
        we never construct a logo URL from a company&rsquo;s domain ourselves. Companies
        without one show a monogram. Set
        <code className="mx-1 text-[10px]">NEXT_PUBLIC_DISABLE_REMOTE_LOGOS=1</code> to
        force monograms everywhere.
      </Footnote>
    </>
  );
}
