// The shell's "Manage" group (UI.md §5): only the admin pages a person may open, absent for citizens.
import { ADMIN_ME, MOD_ME, expect, test } from "./fixtures.js";

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
