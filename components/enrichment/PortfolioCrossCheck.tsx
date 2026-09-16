"use client";

import { AlertTriangle, ArrowUpRight, Check, HelpCircle } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { CompanyAvatar } from "@/components/CompanyAvatar";
import { ThemeSwatch } from "@/components/statistics/ThemeSwatch";
import {
  Badge,
  Callout,
  EmptyState,
  Footnote,
  Panel,
  PanelHeader,
  PageHeader,
  StatTile,
} from "@/components/ui";
import type { StagedCompany } from "@/lib/aggregate";
import { crmRecordUrl } from "@/lib/constants";
import {
  buildCrossCheck,
  type CrossCheckRow,
  type EnrichedInvestorFact,
} from "@/lib/portfolio-crosscheck";

/**
 * CRM portfolio records compared with reported investor data.
 *
 * ⚠️ Read-only. It surfaces disagreements and corrects neither system. A row where
 * The enrichment source not crediting us is not evidence of a CRM error; it only sees
 * publicly reported rounds, and plenty of real positions never get reported.
 */
export function PortfolioCrossCheck({
  portfolio,
  facts,
  generatedAt,
  enrichmentGeneratedAt,
}: {
  portfolio: StagedCompany[];
  facts: EnrichedInvestorFact[];
  generatedAt: string;
  enrichmentGeneratedAt: string | null;
}) {
  const report = useMemo(() => buildCrossCheck(portfolio, facts), [portfolio, facts]);

  if (!enrichmentGeneratedAt) {
    return (
      <>
        <PageHeader
          eyebrow="Data Health"
          title="Portfolio investor cross-check"
          description="Compare portfolio records with reported investor data."
        />
        <Panel>
          <EmptyState title="No enrichment snapshot yet" icon={<HelpCircle className="size-6" />}>
            Use Refresh in the top bar to build one.
          </EmptyState>
        </Panel>
      </>
    );
  }

  const discrepancies = report.notCredited + report.unresolved;

  return (
    <div>
      <PageHeader
        eyebrow="Data Health"
        title="Portfolio investor cross-check"
        description="Compare the portfolio list with independently reported investors."
        actions={
          <Link href="/data-health" className="text-[13px] text-accent hover:underline">
            Data Health
          </Link>
        }
      />

      <div className="ws-enter mb-4 grid gap-3 sm:grid-cols-4">
        <StatTile label="Portfolio companies" value={report.total} />
        <StatTile
          label="Confirmed"
          value={report.confirmed}
          tone="positive"
          hint={`${Math.round((report.confirmed / Math.max(report.total, 1)) * 100)}% agreement`}
        />
        <StatTile
          label="Not credited"
          value={report.notCredited}
          tone={report.notCredited > 0 ? "warning" : "default"}
        />
        <StatTile
          label="Not found in enrichment"
          value={report.unresolved}
          tone={report.unresolved > 0 ? "warning" : "default"}
        />
      </div>

      <Callout tone="info">
        Firm-name aliases are normalized before investor lists are compared.
      </Callout>

      <Panel className="ws-enter ws-delay-1 mt-4 overflow-hidden">
        <PanelHeader
          title={discrepancies > 0 ? `${discrepancies} to look at` : "No discrepancies"}
          description="Disagreements appear first."
        />
        {report.rows.length === 0 ? (
          <EmptyState title="Nothing on the Portfolio list" />
        ) : (
          <ul className="divide-y divide-line">
            {report.rows.map((row, index) => (
              <Row key={row.company.recordId} row={row} index={index} />
            ))}
          </ul>
        )}
        <div className="px-4 pb-3">
          <Footnote>
            A missing credit is not proof of a CRM error. The comparison only includes
            publicly reported rounds.
          </Footnote>
        </div>
      </Panel>

      <p className="mt-4 text-[11px] text-ink-subtle">
        CRM snapshot {new Date(generatedAt).toLocaleString()} · enrichment snapshot{" "}
        {new Date(enrichmentGeneratedAt).toLocaleString()}.
      </p>
    </div>
  );
}

function Row({ row, index }: { row: CrossCheckRow; index: number }) {
  const { company, status } = row;

  const badge =
    status === "confirmed" ? (
      <Badge tone="positive">
        <Check className="size-3" /> Confirmed
      </Badge>
    ) : status === "not-credited" ? (
      <Badge tone="warning">
        <AlertTriangle className="size-3" /> Not credited
      </Badge>
    ) : (
      <Badge tone="neutral">
        <HelpCircle className="size-3" /> Not found
      </Badge>
    );

  return (
    <li
      className="ws-settle ws-stagger flex items-start gap-3 px-4 py-2.5"
      style={{ "--i": index } as React.CSSProperties}
    >
      <CompanyAvatar name={company.name} logoUrl={company.logoUrl} size={26} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/company/${company.recordId}`}
            className="text-[13px] font-medium text-ink hover:text-accent"
          >
            {company.name ?? "Unnamed"}
          </Link>
          {company.theme && <ThemeSwatch theme={company.theme} />}
          {badge}
        </div>

        {status === "not-credited" && (
          <p className="mt-0.5 text-[11px] text-ink-subtle">
            {row.enrichedInvestors.length > 0 ? (
              <>
                Enrichment data lists {row.enrichedInvestors.length} investor
                {row.enrichedInvestors.length === 1 ? "" : "s"} on this company, none of
                them us: {row.enrichedInvestors.slice(0, 6).join(", ")}
                {row.enrichedInvestors.length > 6 ? "…" : ""}
              </>
            ) : (
              "The company was found, but no investors were reported."
            )}
          </p>
        )}
        {status === "unresolved" && (
          <p className="mt-0.5 text-[11px] text-ink-subtle">
            No enrichment record matched this company&rsquo;s domain
            {company.domains[0] ? ` (${company.domains[0]})` : " — it has no domain in the CRM"}.
          </p>
        )}
      </div>

      <a
        href={crmRecordUrl("companies", company.recordId)}
        target="_blank"
        rel="noreferrer"
        className="shrink-0 text-ink-subtle hover:text-accent"
        aria-label="Open in the CRM"
      >
        <ArrowUpRight className="size-3.5" />
      </a>
    </li>
  );
}
