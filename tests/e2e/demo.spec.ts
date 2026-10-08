import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const paths = [
  "/statistics",
  "/momentum",
  "/portfolio",
  "/founders",
  "/founders/queue",
  "/founders/launches",
  "/co-investors",
  "/co-investors/match",
  "/data-health",
  "/data-health/cross-check",
  "/tear-sheets",
  "/digest",
  "/trends",
  "/help/what-this-demo-is",
];
for (const setting of [
  { locale: "en-US", timezoneId: "America/New_York", theme: "light" },
  { locale: "de-DE", timezoneId: "Europe/Berlin", theme: "dark" },
  { locale: "ja-JP", timezoneId: "Asia/Tokyo", theme: "system" },
])
  test(`initial hydration in ${setting.locale} and ${setting.theme}`, async ({ browser }) => {
    const context = await browser.newContext({
      locale: setting.locale,
      timezoneId: setting.timezoneId,
    });
    await context.addInitScript((theme) => {
      localStorage.setItem("vc-ops-theme", theme);
    }, setting.theme);
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(`${page.url()}: ${e.message}`));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(`${page.url()}: ${m.text()}`);
    });
    await page.goto("/statistics");
    await expect(page.getByRole("heading", { name: "Statistics", exact: true })).toBeVisible();
    await page.reload();
    await page.goto("/momentum");
    await page.goBack();
    await expect(page.getByRole("heading", { name: "Statistics", exact: true })).toBeVisible();
    expect(errors).toEqual([]);
    await context.close();
  });
for (const width of [390, 768, 1280, 1440])
  test(`operating views fit width ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    expect(page.viewportSize()?.width).toBe(width);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(`${page.url()}: ${e.message}`));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(`${page.url()}: ${m.text()}`);
    });
    for (const path of paths) {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.locator("main")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
    await page.goto("/statistics");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.screenshot({ path: `docs/screenshots/statistics-${width}.png`, fullPage: true });
    const violations = (await new AxeBuilder({ page }).analyze()).violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    );
    expect(
      violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => ({ html: n.html, reason: n.failureSummary })),
      })),
    ).toEqual([]);
    expect(errors).toEqual([]);
  });
test("browser-owned edits persist, upsert matches created records, and another visitor stays clean", async ({
  page,
  browser,
}) => {
  await page.goto("/statistics");
  const second = await browser.newContext();
  const other = await second.newPage();
  await other.goto("/statistics");
  const payload = {
    name: "Research sample",
    domain: "research-fixture.example",
    theme: "AI",
    canonicalSector: "Software",
  };
  const first = await page.request.post("/api/crm/pipeline/add-company", { data: payload });
  expect(first.ok()).toBe(true);
  const added = await first.json();
  const repeated = await page.request.post("/api/crm/pipeline/add-company", {
    data: { ...payload, name: "Updated sample" },
  });
  expect(repeated.ok()).toBe(true);
  expect((await repeated.json()).company.recordId).toBe(added.company.recordId);
  const query = "/api/crm/companies/search?q=Updated";
  expect(
    (await (await page.request.get(query)).json()).companies.some(
      (c: { name: string }) => c.name === "Updated sample",
    ),
  ).toBe(true);
  expect(
    (await (await other.request.get(query)).json()).companies.some(
      (c: { name: string }) => c.name === "Updated sample",
    ),
  ).toBe(false);
  await page.goto(`/company/${added.company.recordId}`);
  await expect(page.locator("main")).toContainText("Updated sample");
  await page.reload();
  await expect(page.locator("main")).toContainText("Updated sample");
  await page.getByRole("button", { name: "Reset demo", exact: true }).click();
  await expect
    .poll(async () =>
      (await (await page.request.get(query)).json()).companies.some(
        (c: { name: string }) => c.name === "Updated sample",
      ),
    )
    .toBe(false);
  await second.close();
});
test("invalid relations and malformed browser data remain recoverable", async ({
  page,
  context,
}) => {
  await page.goto("/statistics");
  const invalid = await page.request.post("/api/crm/people/link-company", {
    data: { personRecordId: "missing", companyRecordId: "missing" },
  });
  expect(invalid.status()).toBe(400);
  await context.addCookies([
    { name: "vc-demo-state-v1", value: "broken", url: new URL(page.url()).origin },
  ]);
  await page.reload();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Saved demo data could not be read",
  );
  await page.getByRole("button", { name: "Reset demo", exact: true }).click();
  await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
  expect((await page.request.get("/api/cron/digest")).status()).toBe(410);
});

test("keyboard palette edit, filtering and manual diff reach the visible result", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/statistics");
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("dialog", { name: "Command palette" })).toBeVisible();
  await page.getByRole("button", { name: /Add company to Pipeline/ }).click();
  await page.getByPlaceholder("Acme Health").fill("Palette sample");
  await page.getByPlaceholder("acmehealth.com").fill("palette-sample.example");
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await page.getByRole("button", { name: "Confirm & add to Pipeline" }).click();
  await expect(page.getByRole("dialog")).toContainText("Palette sample");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.reload();
  await page.goto("/digest");
  await page.getByRole("button", { name: "Run diff now" }).click();
  await expect(page.locator("main")).toContainText("Palette sample");
  await page.reload();
  await expect(page.locator("main")).toContainText("Palette sample");
  await page.goto("/statistics");
  await page.getByRole("button", { name: "Bars", exact: true }).click();
  await page.getByRole("button", { name: "By stage", exact: true }).click();
  await page.getByRole("button", { name: "Reset demo", exact: true }).click();
});

// Slow hydration exposes responsive shell changes before nested page boundaries settle.
test("mobile hydration tolerates a slower client", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  const session = await page.context().newCDPSession(page);
  await session.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`${page.url()}: ${e.message}`));
  for (const path of ["/statistics", "/digest", "/trends"]) {
    await page.goto(path);
    await expect(page.locator("main")).toBeVisible();
    await page.getByRole("button", { name: "Open navigation", exact: true }).waitFor();
  }
  await page.reload();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("main")).toBeVisible();
  expect(errors).toEqual([]);
  await session.detach();
});
