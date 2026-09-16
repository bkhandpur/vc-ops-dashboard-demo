import { guarded } from "@/app/api/_lib/route-helpers";
import { refreshAllSnapshots } from "@/lib/refresh";

/**
 * Recompute every cached snapshot (companies, people, enrichment) and store them.
 * Triggered by the "Refresh" button in the app header, and by the cron entry point.
 * Page loads never call this — they read the cache.
 */
// The demo refresh is local
// work over a few hundred records and completes in well under a second.
export const maxDuration = 60;

export function POST() {
  return guarded(() => refreshAllSnapshots());
}
