import { guarded } from "@/app/api/_lib/route-helpers";
import { runDigestJob } from "@/lib/digest";
import { refreshAllSnapshots } from "@/lib/refresh";

/** Compare this browser’s sample edits with the seed, then store its bounded digest. */
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
