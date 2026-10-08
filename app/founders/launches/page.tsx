import { withDemoPage } from "@/lib/demo-session";
import { LaunchSuggestions } from "@/components/enrichment/LaunchSuggestions";
import { BuildSnapshotButton } from "@/components/statistics/BuildSnapshotButton";
import { EmptyState, Panel } from "@/components/ui";
import { readOrBuildEnrichment } from "@/lib/enrichment-snapshot";
import { readOrBuildPeople } from "@/lib/people";
import { readOrBuildSnapshot } from "@/lib/stats";

export const metadata = { title: "Launch signals" };

/** Reads cached company, people and enrichment snapshots. */
async function LaunchesPage() {
  const [stats, people, enrichment] = await Promise.all([
    readOrBuildSnapshot(),
    readOrBuildPeople(),
    readOrBuildEnrichment(),
  ]);

  if (!stats || !people) {
    return (
      <Panel>
        <EmptyState title="No snapshot yet" action={<BuildSnapshotButton />}>
          Launch signals read the cached company and people snapshots.
        </EmptyState>
      </Panel>
    );
  }

  return (
    <LaunchSuggestions
      signals={enrichment?.data.founders ?? []}
      founders={people.data.stealthFounders}
      companies={stats.data.companies}
      generatedAt={stats.generatedAt}
      enrichmentGeneratedAt={enrichment?.generatedAt ?? null}
    />
  );
}

export default withDemoPage(LaunchesPage);
