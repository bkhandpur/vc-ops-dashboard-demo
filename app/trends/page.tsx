import { withDemoPage } from "@/lib/demo-session";
import { TrendsView } from "@/components/trends/TrendsView";
import { ensureDigestHistory } from "@/lib/digest-history";
import { buildTrendSeries } from "@/lib/trends";

export const metadata = { title: "Trends" };

/** Render deterministic illustrative history. */
async function TrendsPage() {
  const digests = await ensureDigestHistory();
  const series = buildTrendSeries(digests);

  return <TrendsView series={series} storedDigests={digests.length} />;
}

export default withDemoPage(TrendsPage);
