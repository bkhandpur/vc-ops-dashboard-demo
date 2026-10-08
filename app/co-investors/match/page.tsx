import { withDemoPage } from "@/lib/demo-session";
import { Suspense } from "react";

import { MatchView } from "@/components/match/MatchView";
import { BuildSnapshotButton } from "@/components/statistics/BuildSnapshotButton";
import { EmptyState, Panel } from "@/components/ui";
import { readOrBuildPeople } from "@/lib/people";
import { readOrBuildSnapshot } from "@/lib/stats";

export const metadata = { title: "Syndicate matchmaking" };

/**
 * Co-investor matchmaking. Reads the two CACHED snapshots — no external call on page load,
 * per the project rule. All scoring happens client-side from those snapshots.
 */
async function MatchPage({ searchParams }: { searchParams: Promise<{ company?: string }> }) {
  const [{ company }, cached, people] = await Promise.all([
    searchParams,
    readOrBuildSnapshot(),
    readOrBuildPeople(),
  ]);

  if (!cached || !people) {
    return (
      <Panel>
        <EmptyState title="No snapshot yet" action={<BuildSnapshotButton />}>
          Matchmaking reads the cached company and people snapshots. Build one to get started.
        </EmptyState>
      </Panel>
    );
  }

  return (
    <Suspense fallback={null}>
      <MatchView
        companies={cached.data.companies}
        coInvestors={people.data.coInvestors}
        generatedAt={cached.generatedAt}
        initialRecordId={company ?? null}
      />
    </Suspense>
  );
}

export default withDemoPage(MatchPage);
