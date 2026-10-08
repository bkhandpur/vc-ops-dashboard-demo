/**
 * Shared API response and scheduled-request helpers for the public demo.
 */

import { withDemoSession } from "@/lib/demo-session";
import { NextResponse } from "next/server";

export async function guarded<T>(handler: () => Promise<T>): Promise<NextResponse> {
  try {
    return NextResponse.json(await withDemoSession(handler, true), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected server error";
    console.error("[api]", message, err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
