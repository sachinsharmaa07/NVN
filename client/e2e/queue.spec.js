// The staff queue as a ledger (UI.md §5.1): six columns on a laptop, cards on a phone, filters that never
// blank the list, and a drawer that gives focus back to the row it came from.
import { STAFF_ME, STAFF_ROW, expect, test } from "./fixtures.js";

test.beforeEach(({ api }) => {
  api.answers.me = STAFF_ME;
});

const rowButton = (page) => page.getByRole("button", { name: new RegExp(STAFF_ROW.title) }).first();

test("at 1440 the queue is a table with six columns", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/staff");
  await expect(page.getByRole("columnheader")).toHaveText([
    "Issue",
    "Status",
    "Category",
    "Pincode",
    "SLA due",
    "Reported",
  ]);
  await expect(page.getByText("1 open issue, due soonest first")).toBeVisible();
});

for (const width of [360, 320]) {
  test(`at ${width} the queue is cards with no sideways scroll`, async ({ page }) => {
    await page.setViewportSize({ width, height: 740 });
    await page.goto("/staff");
    await expect(rowButton(page)).toBeVisible();
    await expect(page.getByRole("table")).toHaveCount(0);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  });
}

test("Esc closes the drawer and gives focus back to the same row", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/staff");
  await rowButton(page).click();
  await expect(page.getByRole("dialog", { name: STAFF_ROW.title })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(rowButton(page)).toBeFocused();
});

test("changing a filter keeps the old rows (dimmed) until the new ones arrive, never a skeleton", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  // Hold the filtered answer until released, so the in-between state can be seen; then hand the
  // request back to the fixture's own handler (registered earlier, so it runs after this one).
  let release;
  const held = new Promise((done) => (release = done));
  await page.route(/\/api\/staff\/issues\?.*sla=at_risk/, async (route) => {
    await held;
    await route.fallback();
  });
  await page.goto("/staff");
  await expect(rowButton(page)).toBeVisible();

  await page.getByRole("combobox", { name: "SLA" }).click();
  await page.getByRole("option", { name: "At risk" }).click();
  await expect(page).toHaveURL(/sla=at_risk/);
  await expect(page.locator("[aria-busy=true]")).toBeVisible();
  await expect(rowButton(page)).toBeVisible();
  await expect(page.locator('[data-slot="skeleton"]')).toHaveCount(0);
  release();
  await expect(page.locator("[aria-busy=true]")).toHaveCount(0);
});

test("Clear filters only shows when a filter is set, and resets the URL", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/staff");
  await expect(page.getByRole("button", { name: "Clear filters" })).toHaveCount(0);
  await page.goto("/staff?sla=breached&category=pothole");
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page).toHaveURL(/\/staff$/);
  await expect(page.getByRole("button", { name: "Clear filters" })).toHaveCount(0);
});
