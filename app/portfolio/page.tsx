import { withDemoPage } from "@/lib/demo-session";
import { LogoWall } from "@/components/portfolio/LogoWall";
import { EmptyState, Panel } from "@/components/ui";
import { readOrBuildSnapshot } from "@/lib/stats";

export const metadata = { title: "Portfolio" };

/** Cached snapshot only — never calls the CRM on page load. */
async function PortfolioPage() {
  const cached = await readOrBuildSnapshot();

  if (!cached) {
    return (
      <Panel>
        <EmptyState title="No snapshot yet">
          The logo wall reads the cached snapshot. Hit <strong>Refresh</strong> in the top bar to
          build one.
        </EmptyState>
      </Panel>
    );
  }

  return <LogoWall companies={cached.data.companies} />;
}

export default withDemoPage(PortfolioPage);
