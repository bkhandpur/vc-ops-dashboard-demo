"use client";

import { ArrowUpRight, ChevronRight, Info } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { CompanyAvatar } from "@/components/CompanyAvatar";
import { ThemeSwatch } from "@/components/statistics/ThemeSwatch";
import {
  Badge,
  Callout,
  cx,
  EmptyState,
  Footnote,
  Input,
  Meter,
  Panel,
  PanelHeader,
  PageHeader,
  Segmented,
  StatTile,
  TogglePill,
} from "@/components/ui";
import { useCountUp } from "@/components/useCountUp";
import type { StagedCompany } from "@/lib/aggregate";
import { crmRecordUrl, STAGE_LABELS, STAGE_LISTS, type StageKey } from "@/lib/constants";
import { computeHealth, STAGE_WEIGHT, type CheckResult, type HealthSort } from "@/lib/health";
import { findCorruptedText, type TrackedPerson } from "@/lib/people-derive";

/**
 * Data Health — what is missing from the CRM, ranked by how much it is worth fixing.
 *
 * Every row opens into the actual records that are missing the field, each linking
 * straight into the CRM. A completeness percentage nobody can act on is a scoreboard; the
 * drill-down is what makes this a tool.
 *
 * Filtering re-runs the pure `computeHealth()` in the browser, so stage toggles and sort
 * changes are instant and never touch the CRM.
 */
export function DataHealthView({
  founders = [],
  companies,
  generatedAt,
}: {
  /** Stealth Founders, for the corrupted-text panel. Optional — empty disables it. */
  founders?: TrackedPerson[];
  companies: StagedCompany[];
  generatedAt: string;
}) {
  const [stages, setStages] = useState<StageKey[]>(["pipeline", "portfolio"]);
  const [sort, setSort] = useState<HealthSort>("priority");
  const [openKey, setOpenKey] = useState<string | null>(null);

  const result = useMemo(() => computeHealth(companies, stages, sort), [companies, stages, sort]);

  const coverage = useCountUp(result.overallCoveragePct);
  const worst = result.checks[0];

  function toggleStage(stage: StageKey) {
    setStages((current) =>
      current.includes(stage)
        ? current.length === 1
          ? current // never allow an empty scope — the page would say nothing
          : current.filter((s) => s !== stage)
        : [...current, stage],
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Analyze"
        title="Data Health"
        description={
          <>
            Where the CRM is incomplete, ranked by what is most worth fixing. Every row opens into
            the records themselves, so a gap is one click from being closed.
          </>
        }
      />

      <div className="ws-enter ws-delay-1 mb-5 flex flex-wrap items-center gap-2">
        {STAGE_LISTS.map((stage) => (
          <TogglePill
            key={stage}
            active={stages.includes(stage)}
            onClick={() => toggleStage(stage)}
          >
            {STAGE_LABELS[stage]}
          </TogglePill>
        ))}
        <span className="ml-auto flex items-center gap-2">
          <span className="text-[12px] text-ink-subtle">Sort</span>
          <Segmented<HealthSort>
            ariaLabel="Sort data health checks"
            value={sort}
            onChange={setSort}
            options={[
              {
                value: "priority",
                label: "Most valuable",
                title: "Weighted by list and field importance",
              },
              { value: "coverage", label: "Least complete" },
              { value: "missing", label: "Most missing" },
              { value: "label", label: "A–Z" },
            ]}
          />
        </span>
      </div>

      <div className="ws-enter ws-delay-2 mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Overall completeness"
          value={`${coverage.toFixed(0)}%`}
          hint={`Across ${result.checks.length} checks on ${result.total} companies`}
          tone={result.overallCoveragePct >= 75 ? "positive" : "warning"}
        />
        <StatTile
          label="Companies in scope"
          value={result.total.toLocaleString("en-US")}
          hint={stages.map((s) => STAGE_LABELS[s]).join(" + ")}
        />
        <StatTile
          label="Biggest gap"
          value={worst ? `${worst.missingTotal.toLocaleString("en-US")}` : "—"}
          hint={worst ? `missing ${worst.check.label.toLowerCase()}` : undefined}
          tone="warning"
        />
        <StatTile
          label="Fully complete"
          value={result.checks.filter((c) => c.missingTotal === 0).length.toString()}
          hint={`of ${result.checks.length} checks`}
          tone="positive"
        />
      </div>

      <Panel className="ws-enter ws-delay-3 overflow-hidden">
        <PanelHeader
          title="Completeness by field"
          description="Click a row to see the records that are missing it."
        />
        <ul>
          {result.checks.map((check) => (
            <CheckRow
              key={check.check.key}
              result={check}
              stages={stages}
              open={openKey === check.check.key}
              onToggle={() => setOpenKey((k) => (k === check.check.key ? null : check.check.key))}
            />
          ))}
        </ul>
        <div className="px-4 pb-4">
          <Footnote>
            <strong>&ldquo;Most valuable&rdquo;</strong> weights each missing value by the list it
            is on — Portfolio ×{STAGE_WEIGHT.portfolio}, Pipeline ×{STAGE_WEIGHT.pipeline}, Archive
            ×{STAGE_WEIGHT.archive} — and by how much the product depends on the field. Without that
            weighting the ranking would simply follow the Archive, which is 340 records we have
            already passed on. The number has no meaning on its own; only the ordering does.
            Snapshot taken {new Date(generatedAt).toLocaleString("en-US", { timeZone: "UTC" })}.
          </Footnote>
        </div>
      </Panel>

      <RelationshipsPanel companies={companies} stages={stages} />

      <CorruptedTextPanel founders={founders} />
    </>
  );
}

function CheckRow({
  result,
  stages,
  open,
  onToggle,
}: {
  result: CheckResult;
  stages: StageKey[];
  open: boolean;
  onToggle: () => void;
}) {
  const { check, coveragePct, missingTotal } = result;
  const tone = coveragePct >= 90 ? "positive" : coveragePct >= 50 ? "warning" : "negative";

  return (
    <li className="border-t border-line first:border-t-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-4 px-4 py-3 text-left transition-colors duration-[var(--dur-quick)] hover:bg-surface-sunken"
      >
        <ChevronRight
          className={cx(
            "size-4 shrink-0 text-ink-subtle transition-transform duration-[var(--dur-quick)]",
            open && "rotate-90",
          )}
        />

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="text-[13px] font-medium text-ink">{check.label}</span>
            <code className="rounded bg-surface-sunken px-1 py-0.5 text-[10px] text-ink-subtle">
              {check.slug}
            </code>
            {check.note && <Info className="size-3.5 shrink-0 text-warning" />}
          </span>
          <span className="mt-0.5 block truncate text-[11px] text-ink-subtle">{check.why}</span>
        </span>

        <span className="hidden w-56 shrink-0 items-center gap-2 lg:flex">
          <Meter pct={coveragePct} tone={tone} />
          <span className="ws-nums w-11 shrink-0 text-right text-[12px] font-medium text-ink-muted">
            {coveragePct.toFixed(0)}%
          </span>
        </span>

        <span className="ws-nums w-32 shrink-0 text-right text-[12px] text-ink-muted">
          {missingTotal === 0 ? (
            <Badge tone="positive">complete</Badge>
          ) : (
            <>
              <span className="font-medium text-ink">{missingTotal.toLocaleString("en-US")}</span>{" "}
              missing
            </>
          )}
        </span>
      </button>

      {open && (
        <div className="border-t border-line bg-surface-sunken/50 px-4 py-3">
          {check.note && (
            <div className="mb-3">
              <Callout tone="warn">{check.note}</Callout>
            </div>
          )}

          <div className="mb-3 flex flex-wrap gap-4 text-[11px] text-ink-muted">
            {STAGE_LISTS.filter((s) => stages.includes(s)).map((stage) => {
              const missing = result.missingByStage[stage];
              const total = result.totalByStage[stage];
              return (
                <span key={stage} className="ws-nums">
                  {STAGE_LABELS[stage]}:{" "}
                  <strong className="text-ink">{missing.toLocaleString("en-US")}</strong> of{" "}
                  {total.toLocaleString("en-US")} missing
                </span>
              );
            })}
          </div>

          {result.missingCompanies.length === 0 ? (
            <p className="py-3 text-[12px] text-ink-subtle">
              Nothing is missing this field in the current scope.
            </p>
          ) : (
            <MissingList companies={result.missingCompanies} />
          )}
        </div>
      )}
    </li>
  );
}

/**
 * Portfolio-first list of records to fix, capped until expanded. A baseline scope can
 * put 500+ archive rows behind one check; unbounded, that is a wall nobody reads.
 */
function MissingList({ companies }: { companies: StagedCompany[] }) {
  const [showAll, setShowAll] = useState(false);
  const LIMIT = 12;
  const visible = showAll ? companies : companies.slice(0, LIMIT);

  return (
    <>
      <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((company, index) => (
          <li
            key={company.recordId}
            className="ws-enter"
            // Capped at 12 steps — past that the stagger reads as lag, not choreography.
            style={{ animationDelay: `${Math.min(index, 12) * 18}ms` }}
          >
            <div className="flex items-center gap-2 rounded-[var(--radius-control)] border border-line bg-surface px-2 py-1.5">
              <CompanyAvatar name={company.name} logoUrl={company.logoUrl} size={20} />
              <Link
                href={`/company/${company.recordId}`}
                className="min-w-0 flex-1 truncate text-[12px] text-ink hover:text-accent hover:underline"
              >
                {company.name ?? "Untitled"}
              </Link>
              {company.theme && <ThemeSwatch theme={company.theme} />}
              <a
                href={crmRecordUrl("companies", company.recordId)}
                target="_blank"
                rel="noopener noreferrer"
                title="Open in the CRM"
                className="shrink-0 text-ink-subtle transition-colors hover:text-accent"
              >
                <ArrowUpRight className="size-3.5" />
              </a>
            </div>
          </li>
        ))}
      </ul>

      {companies.length > LIMIT && (
        <button
          type="button"
          onClick={() => setShowAll((s) => !s)}
          className="mt-2 text-[12px] font-medium text-accent hover:underline"
        >
          {showAll ? "Show fewer" : `Show all ${companies.length.toLocaleString("en-US")}`}
        </button>
      )}
    </>
  );
}

/** Relationship notes and connection gaps for generated company records. */
function RelationshipsPanel({
  companies,
  stages,
}: {
  companies: StagedCompany[];
  stages: StageKey[];
}) {
  const [query, setQuery] = useState("");

  const inScope = useMemo(
    () => companies.filter((c) => c.stages.some((s) => stages.includes(s))),
    [companies, stages],
  );

  const withNotes = useMemo(() => inScope.filter((c) => c.primaryRelationships), [inScope]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? withNotes.filter(
          (c) =>
            c.primaryRelationships!.toLowerCase().includes(q) ||
            (c.name ?? "").toLowerCase().includes(q),
        )
      : withNotes;
    return [...list].sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
  }, [withNotes, query]);

  return (
    <Panel className="ws-enter ws-delay-4 mt-5 overflow-hidden">
      <PanelHeader
        title="Relationships"
        description={`Generated relationship notes. ${withNotes.length} of ${inScope.length} records in scope.`}
      />

      <div className="border-b border-line px-4 py-2.5">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search relationship notes by name, referrer or firm…"
        />
      </div>

      {shown.length === 0 ? (
        <EmptyState title="No relationship notes match">
          Clear the search to see all {withNotes.length}.
        </EmptyState>
      ) : (
        <ul className="max-h-[30rem] divide-y divide-line overflow-y-auto">
          {shown.slice(0, 60).map((company) => (
            <li key={company.recordId} className="flex items-start gap-3 px-4 py-2.5">
              <CompanyAvatar
                name={company.name}
                logoUrl={company.logoUrl}
                size={24}
                className="mt-0.5"
              />
              <span className="min-w-0 flex-1">
                <Link
                  href={`/company/${company.recordId}`}
                  className="block truncate text-[13px] font-medium text-ink hover:text-accent hover:underline"
                >
                  {company.name ?? "Untitled"}
                </Link>
                <span className="mt-0.5 block text-[11px] leading-relaxed text-ink-muted">
                  {company.primaryRelationships}
                </span>
              </span>
              {company.theme && <ThemeSwatch theme={company.theme} />}
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-line px-4 py-3">
        <Footnote>
          This panel uses generated <code className="text-[10px]">relationship_notes</code>. Sparse
          structured fields remain visible in Data Health so the demo includes realistic
          incomplete-data states.
          {shown.length > 60 && ` Showing the first 60 of ${shown.length}.`}
        </Footnote>
      </div>
    </Panel>
  );
}

/** Generated records containing the Unicode replacement character. */
function CorruptedTextPanel({ founders }: { founders: TrackedPerson[] }) {
  const rows = useMemo(() => findCorruptedText(founders), [founders]);
  if (rows.length === 0) return null;

  return (
    <Panel className="ws-enter ws-delay-5 mt-4 overflow-hidden">
      <PanelHeader
        title="Damaged characters in founder text"
        description="Text where a character was lost before it reached the CRM. Not repairable from here."
        actions={<Badge tone="warning">{rows.length} records</Badge>}
      />
      <ul className="divide-y divide-line">
        {rows.map((row, index) => (
          <li
            key={row.person.recordId}
            className="ws-settle ws-stagger flex items-center gap-3 px-4 py-2"
            style={{ "--i": index } as React.CSSProperties}
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] text-ink">
                {row.person.name ?? "Unnamed"}
              </span>
              <span className="block truncate font-mono text-[11px] text-ink-subtle">
                {row.fields.join(", ")}
              </span>
            </span>
            <a
              href={crmRecordUrl("people", row.person.recordId)}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 text-ink-subtle hover:text-accent"
              title="Fix in the CRM"
            >
              <ArrowUpRight className="size-3.5" />
            </a>
          </li>
        ))}
      </ul>
      <div className="px-4 pb-3">
        <Footnote>
          These show as <code>&#xFFFD;</code> where an apostrophe or accented letter should be
          &mdash; &ldquo;hasn&#xFFFD;t&rdquo;, &ldquo;Ren&#xFFFD; Kelvara&rdquo;. The character was
          destroyed before the CRM stored it (verified by inspecting the raw API bytes), so it
          cannot be recovered here and this app deliberately does not guess at it &mdash; guessing
          would invent a person&rsquo;s name. Fix the value in the CRM and it clears on the next
          refresh. Most originate in the LinkedIn export that seeded these records.
        </Footnote>
      </div>
    </Panel>
  );
}
