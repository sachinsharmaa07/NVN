// One filled primary button per screen (UI.md §6), on a laptop where the sidebar's Report button is visible.
// Overlays are left out: a dialog brings its own primary while the page behind it is inert.
import { expect, test } from "./fixtures.js";
import { ROUTES, STATES } from "./routes.js";

const filledPrimaries = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('[data-slot="button"][data-variant="default"]')]
      .filter((el) => !el.closest('[role="dialog"], [role="alertdialog"]'))
      .filter((el) => el.checkVisibility?.() ?? el.offsetParent !== null)
      .map((el) => el.textContent.trim()),
  );

for (const route of [...ROUTES, ...STATES].filter((r) => !r.act)) {
  test(`${route.name}: at most one filled primary button`, async ({ page, api }) => {
    test.skip(test.info().project.name !== "desktop", "the sidebar shows from 1024px");
    route.setup?.(api);
    await page.goto(route.path);
    await expect(page.locator("h1").first()).toBeVisible();
    await page.waitForLoadState("networkidle");
    const found = await filledPrimaries(page);
    expect(found.length, found.join(" | ")).toBeLessThanOrEqual(1);
  });
}
