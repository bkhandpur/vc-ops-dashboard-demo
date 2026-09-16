import { BuildSnapshotButton } from "@/components/statistics/BuildSnapshotButton";
import { TearSheetView } from "@/components/tearsheet/TearSheetView";
import { EmptyState, Panel } from "@/components/ui";
import { readOrBuildSnapshot } from "@/lib/stats";

export const metadata = { title: "Tear sheets" };

/** Reads the CACHED company snapshot — no external call on page load. */
export default async function TearSheetsPage() {
  const cached = await readOrBuildSnapshot();

  if (!cached) {
    return (
      <Panel>
        <EmptyState title="No snapshot yet" action={<BuildSnapshotButton />}>
          Tear sheets read the cached company snapshot. Build one to get started.
        </EmptyState>
      </Panel>
    );
  }

  return (
    <TearSheetView
      companies={cached.data.companies}
      generatedAt={cached.generatedAt}
    />
  );
}
