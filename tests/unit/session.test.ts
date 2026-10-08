import { it, expect, vi } from "vitest";
import { deflateSync } from "node:zlib";
const jar = { get: vi.fn(), set: vi.fn() };
vi.mock("next/headers", () => ({ cookies: async () => jar }));
import { decodeState, withDemoSession, demoSession } from "@/lib/demo-session";
import { recordWrite, applyOverlay, demoWriteLog } from "@/lib/demo-store";
const seed = {
  id: { record_id: "seed" },
  created_at: "2026-01-01",
  values: {
    domains: [{ active_from: "2026-01-01", active_until: null, domain: "seed.example" }],
    name: [{ active_from: "2026-01-01", active_until: null, value: "Seed" }],
  },
};
it("upsert matches immutable seed records and preserves unpatched fields", async () => {
  jar.get.mockReturnValue(undefined);
  await withDemoSession(async () => {
    const updated = recordWrite.upsertRecord(
      "companies",
      "domains",
      "SEED.EXAMPLE",
      { name: "Updated" },
      [seed],
    );
    expect(updated.id.record_id).toBe("seed");
    expect(applyOverlay.records("companies", [seed])).toHaveLength(1);
    expect(seed.values.name[0]?.value).toBe("Seed");
  });
});
it("patches created records and bounds the mutation log across cookie round trips", async () => {
  jar.get.mockReturnValue(undefined);
  await withDemoSession(async () => {
    const created = recordWrite.upsertRecord("companies", "domains", "new.example", {
      domains: [{ domain: "new.example" }],
      name: "New",
    });
    for (let i = 0; i < 25; i++)
      recordWrite.patchRecord("companies", created.id.record_id, { name: `Name ${i}` }, created);
    expect(demoWriteLog()).toHaveLength(20);
    expect(applyOverlay.records("companies", [])[0]?.values.name?.[0]?.value).toBe("Name 24");
  }, true);
  const encoded = jar.set.mock.calls.at(-1)?.[1];
  expect(decodeState(encoded).overlay).toBeTruthy();
});
it("parallel request contexts cannot see each other's edits", async () => {
  jar.get.mockReturnValue(undefined);
  await Promise.all([
    withDemoSession(async () => {
      recordWrite.upsertRecord("companies", "domains", "private.example", { name: "Private" });
      await Promise.resolve();
      expect(applyOverlay.records("companies", [])).toHaveLength(1);
    }),
    withDemoSession(async () => {
      await Promise.resolve();
      expect(applyOverlay.records("companies", [])).toHaveLength(0);
      expect(demoSession().digests).toEqual({});
    }),
  ]);
});
it("rejects corrupt, oversized and malformed digest cookies", () => {
  expect(() => decodeState("x".repeat(3801))).toThrow();
  expect(() => decodeState("broken")).toThrow();
  const raw = deflateSync(
    JSON.stringify({ overlay: {}, digests: { broken: { id: "x" } } }),
  ).toString("base64url");
  expect(() => decodeState(raw)).toThrow();
});
