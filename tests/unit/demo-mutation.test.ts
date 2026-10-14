import { expect, test, vi } from "vitest";
import { mutateDemo } from "@/lib/demo-mutation";
test("unsupported browser fails before a simulated write", async () => {
  vi.stubGlobal("navigator", {});
  const action = vi.fn(async () => true);
  await expect(mutateDemo(action)).rejects.toThrow("Web Locks");
  expect(action).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});
test("supported writers use the shared lock", async () => {
  const request = vi.fn(async (_name: string, fn: () => Promise<unknown>) => fn());
  vi.stubGlobal("navigator", { locks: { request } });
  const action = vi.fn(async () => 42);
  expect(await mutateDemo(action)).toBe(42);
  expect(request).toHaveBeenCalledWith("vc-demo-mutation", action);
  vi.unstubAllGlobals();
});

import { dateOnlyYear } from "@/lib/date-only";
test("date-only foundation years preserve January first", () => {
  expect(dateOnlyYear("2020-01-01")).toBe(2020);
  expect(dateOnlyYear("2020-02-30")).toBeNull();
  expect(dateOnlyYear("missing")).toBeNull();
});
