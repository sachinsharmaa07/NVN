// Page view transitions (UI.md §4): a new path cross-fades, a query change (?step=) does not.
import { expect, test } from "./fixtures.js";
import { toMapStep } from "./steps.js";

// Counts the view transitions React starts, so the test can tell a page cross-fade from a plain update.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__viewTransitions = 0;
    const start = document.startViewTransition?.bind(document);
    if (start) {
      document.startViewTransition = (...args) => {
        window.__viewTransitions += 1;
        return start(...args);
      };
    }
  });
});

const transitions = (page) => page.evaluate(() => window.__viewTransitions);

test("moving between wizard steps does not cross-fade the page", async ({ page }) => {
  await toMapStep(page);
  await expect(page).toHaveURL(/step=2/);
  expect(await transitions(page)).toBe(0);
});

test("navigating to another page cross-fades it", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByRole("link", { name: "My issues" }).first().click();
  await expect(page).toHaveURL(/\/issues$/);
  await expect.poll(() => transitions(page)).toBeGreaterThan(0);
});
