import { NextResponse } from "next/server";
export function GET() {
  return NextResponse.json(
    {
      error: "Scheduled collection is not configured in this demo. Use the browser's sample diff.",
    },
    { status: 410 },
  );
}
