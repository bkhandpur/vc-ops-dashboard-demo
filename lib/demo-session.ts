import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { deflateSync, inflateSync } from "node:zlib";
import { cookies } from "next/headers";
import { z } from "zod";

const fields = z.record(z.array(z.record(z.unknown())).max(20));
const record = z.object({
  id: z.object({ record_id: z.string().max(100) }),
  created_at: z.string().max(40),
  values: fields,
});
const schema = z.object({
  newRecords: z.object({ companies: z.array(record).max(10), people: z.array(record).max(10) }),
  patches: z.object({ companies: z.record(fields), people: z.record(fields) }),
  newEntries: z.record(
    z
      .array(
        z.object({
          id: z.object({ entry_id: z.string().max(100) }),
          parent_record_id: z.string().max(100),
          created_at: z.string().max(40),
          entry_values: fields,
        }),
      )
      .max(10),
  ),
  newNotes: z
    .array(
      z.object({
        id: z.object({ note_id: z.string().max(100) }),
        parent_object: z.enum(["people", "companies"]),
        parent_record_id: z.string().max(100),
        title: z.string().max(200),
        content_plaintext: z.string().max(1200),
        created_at: z.string().max(40),
      }),
    )
    .max(10),
  log: z
    .array(
      z.object({ at: z.string().max(40), action: z.string().max(30), detail: z.string().max(400) }),
    )
    .max(20),
  seq: z.number().int().min(0).max(1000),
});
const text = z.string().max(1200);
const count = z.number().finite().nonnegative().max(10000);
const totals = z.object({ pipeline: count, portfolio: count, archive: count });
const stub = z.object({
  recordId: z.string().max(100),
  name: text.nullable(),
  theme: text,
  canonicalSector: text,
  logoUrl: text.nullable(),
});
const shift = z.object({
  label: text,
  previous: count,
  current: count,
  delta: z.number().finite(),
});
const digestSchema = z.object({
  id: text,
  generatedAt: text,
  comparedTo: text.nullable(),
  periodLabel: text,
  newInPipeline: z.array(stub).max(1000),
  stageMoves: z
    .array(
      z.object({
        recordId: text,
        name: text.nullable(),
        from: z.enum(["pipeline", "portfolio", "archive"]).nullable(),
        to: z.enum(["pipeline", "portfolio", "archive"]).nullable(),
      }),
    )
    .max(1000),
  newStealthFounders: z.array(z.object({ recordId: text, name: text.nullable() })).max(1000),
  newNotes: z
    .array(
      z.object({
        noteId: text,
        title: text,
        parentObject: text,
        parentRecordId: text,
        createdAt: text,
      }),
    )
    .max(10),
  themeShifts: z.array(shift).max(100),
  sectorShifts: z.array(shift).max(100),
  totals,
  metrics: z
    .object({
      totals,
      themeMix: z.object({
        pipeline: z.record(count),
        portfolio: z.record(count),
        archive: z.record(count),
      }),
      sectorCoverage: z.object({
        pipeline: z.object({ covered: count, total: count }),
        portfolio: z.object({ covered: count, total: count }),
        archive: z.object({ covered: count, total: count }),
      }),
      healthPct: z.number().finite().min(0).max(100).optional(),
    })
    .optional(),
  summary: z.string().max(8000).nullable(),
  summaryGeneratedAt: text.nullable(),
  summaryGeneratedBy: text.nullable(),
});
const digestMap = z.record(digestSchema).refine((value) => Object.keys(value).length <= 3);
export const DEMO_COOKIE = "vc-demo-state-v1";
export interface DemoSession {
  overlay: unknown;
  cache: Map<string, unknown>;
  digests: Record<string, unknown>;
  dirty: boolean;
  stateError?: string;
}
const context = new AsyncLocalStorage<DemoSession>();
export function demoSession(): DemoSession {
  const session = context.getStore();
  if (!session) throw new Error("Demo request context missing");
  return session;
}
export function decodeState(raw?: string): { overlay: unknown; digests: Record<string, unknown> } {
  if (!raw) return { overlay: null, digests: {} };
  if (raw.length > 3800) throw new Error("Invalid demo state. Reset the demo.");
  const parsed = JSON.parse(
    inflateSync(Buffer.from(raw, "base64url"), { maxOutputLength: 24000 }).toString(),
  );
  const result = schema.safeParse(parsed.overlay);
  const digests = digestMap.safeParse(parsed.digests);
  if (!result.success || !digests.success) throw new Error("Invalid demo state. Reset the demo.");
  const o = result.data;
  return {
    overlay: {
      ...o,
      patches: {
        companies: new Map(Object.entries(o.patches.companies)),
        people: new Map(Object.entries(o.patches.people)),
      },
      newEntries: new Map(Object.entries(o.newEntries)),
    },
    digests: digests.data,
  };
}
export async function withDemoSession<T>(handler: () => Promise<T>, writable = false): Promise<T> {
  if (context.getStore()) return handler();
  const jar = await cookies();
  const raw = jar.get(DEMO_COOKIE)?.value;
  let initial: ReturnType<typeof decodeState>;
  let stateError: string | undefined;
  try {
    initial = decodeState(raw);
  } catch {
    initial = decodeState();
    stateError = "Saved demo data could not be read. Reset the demo to restore the sample.";
  }
  const session: DemoSession = { ...initial, cache: new Map(), dirty: false, stateError };
  return context.run(session, async () => {
    const result = await handler();
    if (writable && session.dirty) {
      const json = JSON.stringify(
        { overlay: session.overlay, digests: session.digests },
        (_key, value) => (value instanceof Map ? Object.fromEntries(value) : value),
      );
      if (json.length > 24000)
        throw new Error("Demo edit limit reached. Reset the demo to continue.");
      decodeState(deflateSync(json).toString("base64url"));
      const encoded = deflateSync(json).toString("base64url");
      if (encoded.length > 3800)
        throw new Error("Demo edit limit reached. Reset the demo to continue.");
      jar.set(DEMO_COOKIE, encoded, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production" && !!process.env.VERCEL,
        path: "/",
        maxAge: 86400 * 7,
      });
    }
    return result;
  });
}
export function withDemoPage<A extends unknown[], R>(handler: (...args: A) => Promise<R>) {
  return (...args: A) => withDemoSession(() => handler(...args));
}
