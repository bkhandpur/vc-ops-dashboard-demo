import { guarded } from "@/app/api/_lib/route-helpers";
import { runDigestJob } from "@/lib/digest";
import { refreshAllSnapshots } from "@/lib/refresh";

/**
 * Same deterministic job as the cron, run on demand from the "Run diff now" button.
 * Useful for creating the first baseline snapshot without waiting until Monday.
 *
 * Also refreshes every view cache, same as the cron does — all of these jobs walk the
 * same lists, so this is a free second consumer of the one pass.
 */
// The demo refresh is local
// work over a few hundred records and completes in well under a second.
export const maxDuration = 60;

export function POST() {
  return guarded(async () => {
    // Refresh first — the digest reads the stats snapshot to record Data Health
    // completeness, so a stale cache here would store the wrong figure.
    await refreshAllSnapshots();
    const digest = await runDigestJob();
    return { digestId: digest.id, baseline: digest.comparedTo === null };
  });
}
