// Step 14, INP check (UI.md §5.2: INP < 150 ms) for the two interactions the plan names: typing a pincode and
// opening the staff drawer. Reads the browser's Event Timing entries (what INP is built from) on the production
// bundle. Opt-in, since timings depend on the machine: `PERF=1 npx playwright test perf`.
import { STAFF_ME, expect, test } from "./fixtures.js";

test.skip(process.env.PERF !== "1", "perf checks run only with PERF=1");

// Every interaction's longest event (input delay + processing + paint), as INP counts it.
const observe = () => {
  window.__interactions = new Map();
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) {
      if (!e.interactionId) continue;
      const prev = window.__interactions.get(e.interactionId) ?? 0;
      window.__interactions.set(e.interactionId, Math.max(prev, e.duration));
    }
  }).observe({ type: "event", durationThreshold: 16, buffered: true });
};
const worst = (page) =>
  page.evaluate(async () => {
    await new Promise((r) => setTimeout(r, 300)); // entries are delivered after the next paint
    return Math.max(0, ...window.__interactions.values());
  });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(observe);
  // The phone project runs with the CPU slowed 4x, roughly a mid-range Android (Lighthouse's mobile setting).
  if (test.info().project.name === "mobile") {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  }
});

test("typing a pincode stays under 150 ms per key", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("textbox", { name: "Your pincode", exact: true }).click();
  await page.keyboard.type("144601", { delay: 60 });
  const ms = await worst(page);
  console.log(`pincode typing: worst interaction ${ms} ms (${test.info().project.name})`);
  expect(ms).toBeLessThan(150);
});

test("opening the staff drawer stays under 150 ms", async ({ page, api }) => {
  api.answers.me = STAFF_ME;
  await page.goto("/staff");
  await page
    .getByRole("button", { name: /Deep pothole/ })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const ms = await worst(page);
  console.log(`staff drawer: worst interaction ${ms} ms (${test.info().project.name})`);
  expect(ms).toBeLessThan(150);
});
