import { withDemoPage } from "@/lib/demo-session";
import { FounderTracker } from "@/components/people/FounderTracker";
import { EmptyState, Panel } from "@/components/ui";
import { readOrBuildEnrichment } from "@/lib/enrichment-snapshot";
import { readOrBuildPeople } from "@/lib/people";

export const metadata = { title: "Stealth Founders" };

/** Cached snapshot only — never calls the CRM on page load. */
async function FoundersPage() {
  const [cached, enrichment] = await Promise.all([readOrBuildPeople(), readOrBuildEnrichment()]);

  if (!cached) {
    return (
      <Panel>
        <EmptyState title="No people snapshot yet">
          Hit <strong>Refresh</strong> in the top bar to fetch the Stealth Founders and Co-Investors
          lists from the CRM.
        </EmptyState>
      </Panel>
    );
  }

  return (
    <FounderTracker
      people={cached.data.stealthFounders}
      enrichedHighlights={(enrichment?.data.founders ?? []).map((f) => ({
        recordId: f.recordId,
        highlights: f.highlights,
      }))}
      generatedAt={cached.generatedAt}
    />
  );
}

export default withDemoPage(FoundersPage);
