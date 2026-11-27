// The public landing page (UI.md §5.1, §6): honest stats, the pincode slip, and a first screen that
// shows what matters on a small phone.
import { PIN, expect, test } from "./fixtures.js";

const stats = (page) => page.getByRole("region", { name: "Reports at a glance" });

test("before the first report, the stats are one sentence, not four zeros", async ({ page }) => {
  await page.goto("/");
  await expect(stats(page)).toContainText("Counts appear here once the first reports are in.");
  await expect(stats(page).getByRole("listitem")).toHaveCount(0);
});

test("with reports, the stats are four tiles", async ({ page, api }) => {
  api.answers.stats = [
    200,
    { totalReports: 6, resolved: 3, medianResolutionHours: 20, openByCategory: { pothole: 3 } },
  ];
  await page.goto("/");
  await expect(stats(page).getByRole("listitem")).toHaveCount(4);
  await expect(stats(page)).toContainText("Issues reported");
});

test("a served pincode shows its area, then Report in opens the wizard with it", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("textbox", { name: "Your pincode", exact: true }).fill(PIN);
  await expect(page.getByText(/Kapurthala, Punjab/)).toBeVisible();
  await page.getByRole("button", { name: `Report in ${PIN}` }).click();
  await expect(page).toHaveURL(new RegExp(`/report\\?pincode=${PIN}`));
});

test("with reduced motion, every section is visible at once, below the fold too", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const trust = page.getByRole("region", { name: "What you can count on" });
  await expect(trust).toHaveCSS("opacity", "1");
  await expect(page.getByRole("region", { name: "Reports at a glance" })).toHaveCSS("opacity", "1");
});

test("a section below the fold fades in once it scrolls into view", async ({ page }) => {
  await page.goto("/");
  const trust = page.getByRole("region", { name: "What you can count on" });
  await trust.scrollIntoViewIfNeeded();
  await expect(trust).toHaveCSS("opacity", "1");
});

test("at 360x740 the headline and the pincode label are on the first screen", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeInViewport({ ratio: 1 });
  await expect(page.getByText("Your pincode", { exact: true })).toBeInViewport({ ratio: 1 });
});
