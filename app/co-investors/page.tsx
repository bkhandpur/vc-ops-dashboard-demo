import { withDemoPage } from "@/lib/demo-session";
import { CoInvestorDirectory } from "@/components/people/CoInvestorDirectory";
import { EmptyState, Panel } from "@/components/ui";
import { readOrBuildPeople } from "@/lib/people";
import { readOrBuildSnapshot } from "@/lib/stats";

export const metadata = { title: "Co-Investors" };

/** Cached snapshots only — never calls the CRM on page load. */
async function CoInvestorsPage() {
  // The company snapshot is needed to resolve `deals_co_invested` names (free text) to
  // real records, so a shared deal can carry its logo and link through to the detail page.
  const [cached, stats] = await Promise.all([readOrBuildPeople(), readOrBuildSnapshot()]);

  if (!cached) {
    return (
      <Panel>
        <EmptyState title="No people snapshot yet">
          Hit <strong>Refresh</strong> in the top bar to fetch the Co-Investors list from the CRM.
        </EmptyState>
      </Panel>
    );
  }

  return (
    <CoInvestorDirectory
      people={cached.data.coInvestors}
      companies={stats?.data.companies ?? []}
      generatedAt={cached.generatedAt}
    />
  );
}

export default withDemoPage(CoInvestorsPage);
