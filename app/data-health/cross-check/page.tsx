import { PortfolioCrossCheck } from "@/components/enrichment/PortfolioCrossCheck";
import { BuildSnapshotButton } from "@/components/statistics/BuildSnapshotButton";
import { EmptyState, Panel } from "@/components/ui";
import { readOrBuildEnrichment } from "@/lib/enrichment-snapshot";
import { readOrBuildSnapshot } from "@/lib/stats";

export const metadata = { title: "Portfolio cross-check" };

/** Reads cached CRM and enrichment snapshots. */
export default async function CrossCheckPage() {
  const [stats, enrichment] = await Promise.all([readOrBuildSnapshot(), readOrBuildEnrichment()]);

  if (!stats) {
    return (
      <Panel>
        <EmptyState title="No snapshot yet" action={<BuildSnapshotButton />}>
          The cross-check reads the cached company snapshot.
        </EmptyState>
      </Panel>
    );
  }

  const portfolio = stats.data.companies.filter((c) => c.stages.includes("portfolio"));

  return (
    <PortfolioCrossCheck
      portfolio={portfolio}
      facts={enrichment?.data.investorFacts ?? []}
      generatedAt={stats.generatedAt}
      enrichmentGeneratedAt={enrichment?.generatedAt ?? null}
    />
  );
}
