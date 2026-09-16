/**
 * Shared API response and scheduled-request helpers for the public demo.
 */

import { NextResponse } from "next/server";

export async function guarded<T>(handler: () => Promise<T>): Promise<NextResponse> {
  try {
    return NextResponse.json(await handler());
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected server error";
    console.error("[api]", message, err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

/**
 * Verify a scheduled request.
 *
 * The cron route is the one path that cannot be behind a user session, so it
 * authenticates itself with a shared secret. If the secret is unset the route refuses
 * every request — failing closed rather than open, because an unauthenticated job
 * endpoint that triggers a full refresh is a free denial-of-service.
 *
 * In this build there is nothing expensive behind it and no secret configured, so it
 * simply refuses everything unless one is set. The refresh is reachable from the UI
 * button, which is where a human triggers it anyway.
 */
export function isAuthorizedCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}
