import { withDemoPage } from "@/lib/demo-session";
import { MomentumView } from "@/components/momentum/MomentumView";
import { BuildSnapshotButton } from "@/components/statistics/BuildSnapshotButton";
import { EmptyState, Panel } from "@/components/ui";
import { readOrBuildEnrichment } from "@/lib/enrichment-snapshot";
import { readOrBuildSnapshot } from "@/lib/stats";

export const metadata = { title: "Momentum" };

/** Reads cached CRM and enrichment snapshots. */
async function MomentumPage() {
  const [cached, enrichment] = await Promise.all([readOrBuildSnapshot(), readOrBuildEnrichment()]);

  if (!cached) {
    return (
      <Panel>
        <EmptyState title="No snapshot yet" action={<BuildSnapshotButton />}>
          Momentum reads the cached company snapshot. Build one to get started.
        </EmptyState>
      </Panel>
    );
  }

  return (
    <MomentumView
      companies={cached.data.companies}
      enrichedFacts={enrichment?.data.companies ?? []}
      generatedAt={cached.generatedAt}
      enrichmentGeneratedAt={enrichment?.generatedAt ?? null}
    />
  );
}

export default withDemoPage(MomentumPage);
