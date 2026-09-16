/**
 * Scheduled entry point — Mondays 07:00 UTC (see vercel.json).
 *
 * ⚠️  DETERMINISTIC DATA PIPELINE, NOT AN AGENT.
 *     It reads the CRM state, diffs it against last week's stored snapshot, writes a
 *     structured digest row, and refreshes the Statistics cache. That is all it may
 *     do. Prose summaries are generated separately from the stored digest.
 *
 * Auth: this path was exempt from the app's auth middleware, so it authenticates itself
 * with a shared secret and fails closed when none is set — see isAuthorizedCron().
 */

import { NextResponse } from "next/server";

import { isAuthorizedCron } from "@/app/api/_lib/route-helpers";
import { runDigestJob } from "@/lib/digest";
import { refreshAllSnapshots } from "@/lib/refresh";

// The demo refresh is local
// work over a few hundred records and completes in well under a second.
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }

  try {
    // Order matters: the digest records a Data Health figure read from the cached
    // stats snapshot, so the refresh has to happen first or the digest stores last
    // week's completeness. (These two used to run the other way round.)
    const snapshots = await refreshAllSnapshots();
    const digest = await runDigestJob();

    return NextResponse.json({
      ok: true,
      digestId: digest.id,
      baseline: digest.comparedTo === null,
      newInPipeline: digest.newInPipeline.length,
      stageMoves: digest.stageMoves.length,
      newStealthFounders: digest.newStealthFounders.length,
      newNotes: digest.newNotes.length,
      statsGeneratedAt: snapshots.generatedAt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Digest job failed";
    console.error("[cron/digest]", message, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
