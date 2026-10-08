import { withDemoPage } from "@/lib/demo-session";
import { StatisticsView } from "@/components/statistics/StatisticsView";
import { PageHeader } from "@/components/ui";
import { readOrBuildSnapshot } from "@/lib/stats";

export const metadata = { title: "Statistics" };

// Read the cache on every request, and never call anything external from a page load.
export const dynamic = "force-dynamic";

async function StatisticsPage() {
  const cached = await readOrBuildSnapshot();

  return (
    <div>
      <PageHeader
        eyebrow="Analyze"
        title="Statistics"
        description="Deal concentration by theme, sector and sub-sector across the Pipeline, Portfolio and Archive lists."
      />
      <StatisticsView
        companies={cached.data.companies}
        counts={cached.data.counts}
        generatedAt={cached.generatedAt}
      />
    </div>
  );
}

export default withDemoPage(StatisticsPage);
