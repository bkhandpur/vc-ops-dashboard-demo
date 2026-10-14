import { test, expect, type Page } from "@playwright/test";
async function prepareCompany(page: Page, name: string, domain: string) {
  await page.goto("/statistics");
  await expect(page.locator("[data-shell-ready=true]")).toBeVisible();
  await page.keyboard.press("Control+k");
  await page.getByRole("button", { name: /Add company to Pipeline/ }).click();
  await page.getByPlaceholder("Acme Health").fill(name);
  await page.getByPlaceholder("acmehealth.com").fill(domain);
  await page.getByRole("button", { name: "Review", exact: true }).click();
}
test("supported cross-tab disjoint UI writers retain both records", async ({ page, context }) => {
  const other = await context.newPage();
  await Promise.all([
    prepareCompany(page, "Concurrent sample A", "concurrent-a.example"),
    prepareCompany(other, "Concurrent sample B", "concurrent-b.example"),
  ]);
  await Promise.all([
    page.getByRole("button", { name: "Confirm & add to Pipeline" }).click(),
    other.getByRole("button", { name: "Confirm & add to Pipeline" }).click(),
  ]);
  await expect(page.getByRole("button", { name: "Done", exact: true })).toBeVisible();
  await expect(other.getByRole("button", { name: "Done", exact: true })).toBeVisible();
  const records = (await (await page.request.get("/api/crm/companies/search?q=Concurrent")).json())
    .companies;
  expect(records.map((r: { name: string }) => r.name).sort()).toEqual([
    "Concurrent sample A",
    "Concurrent sample B",
  ]);
  const cookie = (await context.cookies()).find((c) => c.name === "vc-demo-state-v1")!;
  expect(cookie.value.length).toBeLessThanOrEqual(3800);
  expect(cookie.expires - Date.now() / 1000).toBeLessThanOrEqual(7 * 86400);
});
test("unsupported locks show a safe no-write result", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, "locks", { value: undefined }));
  await prepareCompany(page, "Unsupported sample", "unsupported.example");
  await page.getByRole("button", { name: "Confirm & add to Pipeline" }).click();
  await expect(page.getByRole("dialog")).toContainText("Web Locks support");
  expect(
    (await (await page.request.get("/api/crm/companies/search?q=Unsupported")).json()).companies,
  ).toEqual([]);
});
