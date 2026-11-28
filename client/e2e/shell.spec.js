// The shell's "Manage" group (UI.md §5): only the admin pages a person may open, absent for citizens.
import { ADMIN_ME, MOD_ME, STAFF_ME, expect, test } from "./fixtures.js";

// The sidebar shows from 1024px, so these run on the desktop project only.
test.beforeEach(() => {
  test.skip(test.info().project.name !== "desktop", "the sidebar is desktop only");
});

const manage = (page) => page.getByRole("navigation", { name: "Manage" });

test("a citizen has no Manage group", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "Main" }).first()).toBeVisible();
  await expect(manage(page)).toHaveCount(0);
});

test("a moderator sees Moderation only", async ({ page, api }) => {
  api.answers.me = MOD_ME;
  await page.goto("/");
  await expect(manage(page).getByRole("link")).toHaveText(["Moderation"]);
});

test("a city admin sees Users and City settings", async ({ page, api }) => {
  api.answers.me = ADMIN_ME;
  await page.goto("/");
  await expect(manage(page).getByRole("link", { name: "Users" })).toHaveAttribute(
    "href",
    "/admin/users",
  );
  await expect(manage(page).getByRole("link", { name: "City settings" })).toBeVisible();
});

// Review m12: narrow pages keep their narrow column but share the wide pages' frame, so the title does
// not jump between pages.
test("at 1440 every page title starts at the same x", async ({ page, api }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const lefts = {};
  for (const path of ["/", "/issues", "/profile", "/report", "/staff"]) {
    if (path === "/staff") api.answers.me = STAFF_ME;
    await page.goto(path);
    const h1 = page.getByRole("heading", { level: 1 });
    await expect(h1).toBeVisible();
    lefts[path] = Math.round((await h1.boundingBox()).x);
  }
  expect(new Set(Object.values(lefts)).size, JSON.stringify(lefts)).toBe(1);
});
