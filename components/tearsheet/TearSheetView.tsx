"use client";

import { Check, Copy, FileText, Printer } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { CompanyAvatar } from "@/components/CompanyAvatar";
import { ThemeSwatch } from "@/components/statistics/ThemeSwatch";
import {
  Badge,
  Button,
  EmptyState,
  Footnote,
  Panel,
  PanelHeader,
  PageHeader,
  Segmented,
  TogglePill,
  cx,
} from "@/components/ui";
import type { StagedCompany } from "@/lib/aggregate";
import { STAGE_LABELS, STAGE_LISTS, type StageKey } from "@/lib/constants";
import {
  buildTearSheets,
  tearSheetToText,
  type TearSheetEntry,
  type TearSheetGroup,
  type TearSheetGrouping,
} from "@/lib/tearsheet";

/**
 * Tear sheets — the written fields, assembled for reading before a meeting.
 *
 * Deliberately a document rather than a dashboard: no filters beyond scope and
 * grouping, generous measure, and a print stylesheet so it can go on paper. Search
 * finds one company; this is for reading a whole theme start to finish.
 */
export function TearSheetView({
  companies,
  generatedAt,
}: {
  companies: StagedCompany[];
  generatedAt: string;
}) {
  const [grouping, setGrouping] = useState<TearSheetGrouping>("theme");
  // Pipeline + Portfolio by default: Archive is 340 passed-on companies and would turn
  // a document meant to be read into one nobody finishes.
  const [stages, setStages] = useState<StageKey[]>(["pipeline", "portfolio"]);

  const report = useMemo(
    () => buildTearSheets(companies, stages, grouping),
    [companies, stages, grouping],
  );

  function toggleStage(stage: StageKey) {
    setStages((prev) =>
      prev.includes(stage) ? prev.filter((s) => s !== stage) : [...prev, stage],
    );
  }

  return (
    <div>
      <div className="ws-no-print">
        <PageHeader
          eyebrow="Explore"
          title="Tear sheets"
          description={
            <>
              Everything written about each company, grouped for reading before a partner
              meeting. Assembled from the four free-text fields the team actually
              maintains — {report.coveragePct.toFixed(0)}% of blocks are filled across{" "}
              {report.total} companies.
            </>
          }
          actions={
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer className="size-3.5" /> Print
            </Button>
          }
        />

        <div className="ws-enter mb-4 flex flex-wrap items-center gap-3">
          <Segmented<TearSheetGrouping>
            ariaLabel="Group by"
            value={grouping}
            onChange={setGrouping}
            options={[
              { value: "theme", label: "By theme" },
              { value: "sector", label: "By sector" },
            ]}
          />
          <div className="flex items-center gap-1.5">
            {STAGE_LISTS.map((stage) => (
              <TogglePill
                key={stage}
                active={stages.includes(stage)}
                onClick={() => toggleStage(stage)}
                disabled={stages.length === 1 && stages.includes(stage)}
              >
                {STAGE_LABELS[stage]}
              </TogglePill>
            ))}
          </div>
        </div>
      </div>

      {report.groups.length === 0 ? (
        <Panel>
          <EmptyState title="Nothing in scope" icon={<FileText className="size-6" />}>
            Select at least one list to assemble tear sheets from.
          </EmptyState>
        </Panel>
      ) : (
        <div className="space-y-6">
          {report.groups.map((group, index) => (
            <GroupSection key={group.name} group={group} index={index} />
          ))}
        </div>
      )}

      <div className="ws-no-print">
        <Footnote>
          Cards show only the blocks that have text — a card with no
          &ldquo;Founders &amp; team&rdquo; is missing it in the CRM, not hidden by a
          filter. Each block names the field it came from, because the written fields are
          maintained on <strong>Pipeline</strong> and thin on Portfolio (team notes 97%
          vs 41%, relationships 91% vs 35%), the opposite of most enrichment fields. Snapshot
          taken {new Date(generatedAt).toLocaleString()}.
        </Footnote>
      </div>
    </div>
  );
}

function GroupSection({ group, index }: { group: TearSheetGroup; index: number }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(tearSheetToText(group));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — the print path still works */
    }
  }

  return (
    <section
      className="ws-settle ws-stagger"
      style={{ "--i": index } as React.CSSProperties}
    >
      <div className="ws-waterline mb-3 flex items-end justify-between gap-4 pb-2">
        <div className="flex items-center gap-2">
          <ThemeSwatch theme={group.theme} size={10} />
          <h2 className="text-[16px] font-semibold text-ink">{group.name}</h2>
          <Badge tone="neutral">
            {group.entries.length}{" "}
            {group.entries.length === 1 ? "company" : "companies"}
          </Badge>
          <Badge tone={group.complete === group.entries.length ? "positive" : "neutral"}>
            {group.complete} complete
          </Badge>
        </div>
        <Button variant="ghost" onClick={copy} className="ws-no-print">
          {copied ? (
            <>
              <Check className="size-3.5" /> Copied
            </>
          ) : (
            <>
              <Copy className="size-3.5" /> Copy as text
            </>
          )}
        </Button>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        {group.entries.map((entry, i) => (
          <TearSheetCard key={entry.company.recordId} entry={entry} index={i} />
        ))}
      </div>
    </section>
  );
}

function TearSheetCard({ entry, index }: { entry: TearSheetEntry; index: number }) {
  const company = entry.company;

  const meta = [
    company.canonicalSector,
    company.pipelineStage,
    company.location,
    company.yearFounded ? `Founded ${company.yearFounded}` : null,
    company.employeeRange ? `${company.employeeRange} staff` : null,
  ].filter(Boolean);

  return (
    <article
      className="ws-settle ws-stagger ws-card ws-break-inside rounded-[var(--radius-panel)] border border-line bg-surface p-4 shadow-[var(--shadow-panel)] hover:border-line-strong"
      style={{ "--i": index } as React.CSSProperties}
    >
      <header className="flex items-start gap-3">
        <CompanyAvatar name={company.name} logoUrl={company.logoUrl} size={34} />
        <div className="min-w-0 flex-1">
          <Link
            href={`/company/${company.recordId}`}
            className="text-[14px] font-semibold text-ink hover:text-accent"
          >
            {company.name ?? "Unnamed company"}
          </Link>
          {meta.length > 0 && (
            <p className="mt-0.5 text-[11px] text-ink-subtle">{meta.join(" · ")}</p>
          )}
        </div>
        <div className="flex shrink-0 gap-1">
          {entry.stages.map((stage) => (
            <Badge key={stage} tone={stage === "portfolio" ? "accent" : "neutral"}>
              {STAGE_LABELS[stage]}
            </Badge>
          ))}
        </div>
      </header>

      <div className="mt-3 space-y-3">
        {entry.fields.map((field) => (
          <div key={field.key}>
            <p className="mb-0.5 flex items-baseline gap-2">
              <span className="text-[11px] font-medium tracking-[0.04em] text-ink-subtle uppercase">
                {field.label}
              </span>
              <span className="font-mono text-[10px] text-ink-subtle/70">
                {field.source}
              </span>
            </p>
            <p className="text-[12.5px] leading-relaxed text-ink-muted">{field.value}</p>
          </div>
        ))}
      </div>

      {entry.missing.length > 0 && (
        <p className="mt-3 border-t border-line pt-2 text-[11px] text-ink-subtle">
          Not recorded in the CRM: {entry.missing.join(", ").toLowerCase()}.
        </p>
      )}
    </article>
  );
}
