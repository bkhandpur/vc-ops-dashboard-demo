"use client";

import { BarChart3, ChevronRight, Grid3x3, PieChart } from "lucide-react";
import { useMemo, useState } from "react";

import { aggregate, type StagedCompany, type StatsNode } from "@/lib/aggregate";
import type { ColorMode } from "./colors";
import { STAGE_LABELS, type StageKey } from "@/lib/constants";
import { Panel, TogglePill, cx } from "../ui";
import { ConcentrationBars, resolveLevel } from "./ConcentrationBars";
import { StageMatrix } from "./StageMatrix";
import { Sunburst } from "./Sunburst";
import { fillFor, rampForTheme } from "./colors";
import { useColorMode } from "../theme/ThemeProvider";
import { useCountUp } from "../useCountUp";
import { LargestHoldings } from "./LargestHoldings";
import { StatsTable } from "./StatsTable";

/**
 * Three views, each answering a question the others can't:
 *   sunburst — what is the overall shape of the book?
 *   bars     — precisely which of these is bigger? (and it copes with long names)
 *   matrix   — how does this break down across Pipeline / Portfolio / Archive?
 * Deliberately not more than three: another view of the same numbers would be
 * decoration, and the table below is always the exact answer.
 */
type ChartView = "sunburst" | "bars" | "matrix";

/**
 * All filtering and drilling happens client-side against the cached snapshot —
 * nothing here calls the CRM except the explicit Refresh button.
 */
export function StatisticsView({
  companies,
  counts,
  generatedAt,
}: {
  companies: StagedCompany[];
  counts: Record<StageKey, number>;
  generatedAt: string;
}) {
  const mode = useColorMode();
  const [stages, setStages] = useState<StageKey[]>(["pipeline", "portfolio"]);
  const [view, setView] = useState<ChartView>("sunburst");
  const [path, setPath] = useState<string[]>([]);

  const result = useMemo(() => aggregate(companies, stages), [companies, stages]);
  const { level, themeOfLevel, walked } = useMemo(
    () => resolveLevel(result.tree, path),
    [result.tree, path],
  );

  const sectorCount = useMemo(
    () => result.tree.reduce((sum, theme) => sum + (theme.children?.length ?? 0), 0),
    [result.tree],
  );
  const subSectorCount = useMemo(
    () => new Set(result.rows.map((row) => row.subSector)).size,
    [result.rows],
  );
  const leader = result.tree[0];

  function toggleStage(stage: StageKey) {
    setStages((current) =>
      current.includes(stage) ? current.filter((s) => s !== stage) : [...current, stage],
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters stay with the chart; refresh and snapshot age are global controls. */}
      <div className="ws-enter ws-delay-1 flex flex-wrap items-center gap-1.5 border-b border-line pb-3">
        <span className="mr-1 text-[11px] font-medium tracking-wide text-ink-subtle uppercase">
          Stage
        </span>
        {(["pipeline", "portfolio", "archive"] as StageKey[]).map((stage) => (
          <TogglePill
            key={stage}
            active={stages.includes(stage)}
            onClick={() => toggleStage(stage)}
          >
            {STAGE_LABELS[stage]}
            <span className="ws-nums ml-1.5 opacity-60">{counts[stage]}</span>
          </TogglePill>
        ))}
      </div>

      {/* Stat tiles — deliberately not repeating the hero number in the chart centre. */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Themes" value={result.tree.length} />
        <StatTile label="Canonical sectors" value={sectorCount} />
        <StatTile label="Sub-sectors" value={subSectorCount} />
        <StatTile
          label="Largest theme"
          value={leader ? leader.name : "—"}
          detail={
            leader && result.total > 0
              ? `${leader.value} companies · ${Math.round((leader.value / result.total) * 100)}%`
              : undefined
          }
          swatch={leader ? fillFor(leader.name, 0, mode) : undefined}
        />
      </div>

      <Panel className="p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Breadcrumb walked={walked} onNavigate={setPath} />
          <div className="flex items-center gap-1 rounded-lg border border-line bg-surface-sunken p-0.5">
            <ViewTab
              active={view === "sunburst"}
              onClick={() => setView("sunburst")}
              icon={<PieChart className="size-3.5" />}
              label="Radial"
            />
            <ViewTab
              active={view === "bars"}
              onClick={() => setView("bars")}
              icon={<BarChart3 className="size-3.5" />}
              label="Bars"
            />
            <ViewTab
              active={view === "matrix"}
              onClick={() => setView("matrix")}
              icon={<Grid3x3 className="size-3.5" />}
              label="By stage"
            />
          </div>
        </div>

        {view === "sunburst" && (
          <Sunburst tree={result.tree} path={walked} onDrill={setPath} />
        )}
        {view === "bars" && (
          <ConcentrationBars tree={result.tree} path={walked} onDrill={setPath} />
        )}
        {view === "matrix" && (
          <StageMatrix companies={companies} stages={stages} path={walked} />
        )}

        {/* The matrix carries its own sequential legend, so the theme key would clash. */}
        {view !== "matrix" && (
          <Legend
            tree={result.tree}
            themeOfLevel={themeOfLevel}
            total={result.total}
            walked={walked}
            view={view}
            mode={mode}
          />
        )}

        <p className="mt-4 border-t border-line pt-3 text-[11px] leading-relaxed text-ink-subtle">
          Theme and Canonical Sector are single-select fields, so those levels use exact
          distinct-company counts.{" "}
          {view === "matrix" ? (
            <>
              The stage toggles above pick both the scope and the columns here, so
              unchecking a list removes its column rather than quietly rescoping the rows.
            </>
          ) : (
            <>
              Sub-Sector is a multiselect, so at that level the numbers count tags. A
              company with three sub-sectors is counted in each.
            </>
          )}{" "}
          Charts are sized by company count. Funding values are generated company totals,
          not investment positions.{" "}
          {view !== "matrix" &&
            (walked.length === 0
              ? "Click a theme to drill into its sectors and sub-sectors."
              : "Use the breadcrumb above to go back up.")}
        </p>
      </Panel>

      <LargestHoldings companies={companies} stages={stages} />

      <Panel className="p-5">
        <h2 className="mb-3 text-[13px] font-medium text-ink">
          Theme → Canonical Sector → Sub-Sector
        </h2>
        <StatsTable result={result} />
      </Panel>
    </div>
  );
}

function Breadcrumb({
  walked,
  onNavigate,
}: {
  walked: string[];
  onNavigate: (path: string[]) => void;
}) {
  return (
    <nav aria-label="Drill-down path" className="flex items-center gap-1 text-[13px]">
      <button
        type="button"
        onClick={() => onNavigate([])}
        className={cx(
          walked.length > 0 ? "text-accent hover:underline" : "font-medium text-ink",
        )}
      >
        All themes
      </button>
      {walked.map((name, index) => (
        <span key={name} className="flex items-center gap-1">
          <ChevronRight className="size-3.5 text-ink-subtle" />
          <button
            type="button"
            onClick={() => onNavigate(walked.slice(0, index + 1))}
            className={cx(
              index === walked.length - 1
                ? "font-medium text-ink"
                : "text-accent hover:underline",
            )}
          >
            {name}
          </button>
        </span>
      ))}
    </nav>
  );
}

function ViewTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] transition-colors",
        active
          ? "bg-surface text-ink shadow-sm"
          : "text-ink-muted hover:text-ink",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

/**
 * Identity is never colour-alone. At the top level the legend keys the theme hues;
 * drilled in, every mark is one theme's hue and the two lightness steps mean depth,
 * so the legend keys that instead.
 */
function Legend({
  tree,
  themeOfLevel,
  total,
  walked,
  view,
  mode,
}: {
  tree: StatsNode[];
  themeOfLevel: string | null;
  total: number;
  walked: string[];
  view: ChartView;
  mode: ColorMode;
}) {
  // Drilled in, every mark wears one theme's hue and the lightness steps mean depth,
  // so key the depth — and only the steps actually on screen.
  if (walked.length > 0 && themeOfLevel) {
    const ramp = rampForTheme(themeOfLevel, mode);
    const items =
      view === "sunburst"
        ? [
            { swatch: ramp.base, label: "Canonical sector" },
            { swatch: ramp.light, label: "Sub-sector" },
          ]
        : walked.length >= 2
          ? [{ swatch: ramp.light, label: "Sub-sector" }]
          : [{ swatch: ramp.base, label: "Canonical sector" }];

    return (
      <ul className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
        {items.map((item) => (
          <LegendItem key={item.label} swatch={item.swatch} label={item.label} />
        ))}
        <li className="text-[11px] text-ink-subtle">within {themeOfLevel}</li>
      </ul>
    );
  }

  return (
    <ul className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
      {tree.map((theme) => (
        <LegendItem
          key={theme.name}
          swatch={fillFor(theme.name, 0, mode)}
          label={theme.name}
          detail={
            total === 0 ? undefined : `${theme.value} · ${Math.round((theme.value / total) * 100)}%`
          }
        />
      ))}
    </ul>
  );
}

function LegendItem({
  swatch,
  label,
  detail,
}: {
  swatch: string;
  label: string;
  detail?: string;
}) {
  return (
    <li className="flex items-center gap-2">
      <span
        aria-hidden
        className="size-2.5 shrink-0 rounded-sm"
        style={{ backgroundColor: swatch }}
      />
      <span className="text-[12px] text-ink">{label}</span>
      {detail && <span className="text-[11px] tabular-nums text-ink-subtle">{detail}</span>}
    </li>
  );
}

/** Stat-tile contract: label in sentence case, value in proportional figures. */
/** Numeric tile values count up; string values (a theme name) obviously don't. */
function CountUp({ value }: { value: number }) {
  return <>{useCountUp(value)}</>;
}

function StatTile({
  label,
  value,
  detail,
  swatch,
}: {
  label: string;
  value: number | string;
  detail?: string;
  swatch?: string;
}) {
  return (
    <Panel className="px-4 py-3">
      <p className="text-[11px] text-ink-subtle">{label}</p>
      <p className="mt-0.5 flex items-center gap-2 text-[17px] leading-tight font-semibold text-ink">
        {swatch && (
          <span
            aria-hidden
            className="size-2.5 shrink-0 rounded-sm"
            style={{ backgroundColor: swatch }}
          />
        )}
        <span className="truncate" title={typeof value === "string" ? value : undefined}>
          {typeof value === "number" ? <CountUp value={value} /> : value}
        </span>
      </p>
      {detail && <p className="mt-0.5 text-[11px] text-ink-subtle">{detail}</p>}
    </Panel>
  );
}
