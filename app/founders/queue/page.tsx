import { OutreachQueue } from "@/components/people/OutreachQueue";
import { BuildSnapshotButton } from "@/components/statistics/BuildSnapshotButton";
import { EmptyState, Panel } from "@/components/ui";
import { readOrBuildEnrichment } from "@/lib/enrichment-snapshot";
import { readOrBuildPeople } from "@/lib/people";

export const metadata = { title: "Outreach queue" };

/** Reads the CACHED people snapshot — no external call on page load. */
export default async function OutreachQueuePage() {
  const [people, enrichment] = await Promise.all([readOrBuildPeople(), readOrBuildEnrichment()]);

  if (!people) {
    return (
      <Panel>
        <EmptyState title="No snapshot yet" action={<BuildSnapshotButton />}>
          The outreach queue reads the cached people snapshot. Build one to get started.
        </EmptyState>
      </Panel>
    );
  }

  return (
    <OutreachQueue
      founders={people.data.stealthFounders}
      enrichedHighlights={(enrichment?.data.founders ?? []).map((f) => ({
        recordId: f.recordId,
        highlights: f.highlights,
      }))}
      generatedAt={people.generatedAt}
      enrichmentGeneratedAt={enrichment?.generatedAt ?? null}
    />
  );
}
