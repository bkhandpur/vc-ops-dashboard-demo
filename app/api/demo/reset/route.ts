import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { DEMO_COOKIE } from "@/lib/demo-session";
export async function POST() {
  (await cookies()).delete(DEMO_COOKIE);
  return NextResponse.json({ ok: true });
}
