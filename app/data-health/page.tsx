import { withDemoPage } from "@/lib/demo-session";
import { DataHealthView } from "@/components/health/DataHealthView";
import { EmptyState, Panel } from "@/components/ui";
import { readOrBuildPeople } from "@/lib/people";
import { readOrBuildSnapshot } from "@/lib/stats";

export const metadata = { title: "Data Health" };

/**
 * Reads the CACHED snapshot only — never calls the CRM on page load. Refresh is the
 * top-bar button (POST /api/stats/refresh) or the weekly cron.
 */
async function DataHealthPage() {
  const [cached, people] = await Promise.all([readOrBuildSnapshot(), readOrBuildPeople()]);

  if (!cached) {
    return (
      <Panel>
        <EmptyState title="No snapshot yet">
          Data Health reads the same cached snapshot as Statistics. Hit <strong>Refresh</strong> in
          the top bar to build one.
        </EmptyState>
      </Panel>
    );
  }

  return (
    <DataHealthView
      companies={cached.data.companies}
      founders={people?.data.stealthFounders ?? []}
      generatedAt={cached.generatedAt}
    />
  );
}

export default withDemoPage(DataHealthPage);
