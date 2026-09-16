import { TrendsView } from "@/components/trends/TrendsView";
import { ensureDigestHistory } from "@/lib/digest-history";
import { buildTrendSeries } from "@/lib/trends";

export const metadata = { title: "Trends" };

/**
 * Reads the stored digest history — the same records the scheduled job writes. No new
 * pipeline, and no external call on page load.
 *
 * History accrues and is never backfilled: it starts when the job first runs, because the
 * past states were never recorded. In this public build the store is seeded with ten
 * weekly points so the page has something to draw — see lib/digest-history.ts, which
 * explains what that does and does not claim.
 */
export default async function TrendsPage() {
  const digests = await ensureDigestHistory();
  const series = buildTrendSeries(digests);

  return <TrendsView series={series} storedDigests={digests.length} />;
}
