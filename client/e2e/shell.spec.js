// The shell's "Manage" group (UI.md §5): only the admin pages a person may open, absent for citizens.
import { ADMIN_ME, MOD_ME, expect, test } from "./fixtures.js";
import { ROUTES } from "./routes.js";

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

// HLD §7: page-only English strings load with the page (i18n/enDeferred.js). A key that slipped out of
// its dictionary would show raw ("report.wizard.next"); no route may show one, in English or Hindi.
const RAW_KEY =
  /\b(admin|app|auth|chat|citySettings|common|community|errors|issues|landing|moderation|notifications|profile|report|shell|staff|system)\.[a-z]\w*(\.\w+)+\b/;

for (const lang of ["en", "hi"]) {
  // A route's act() clicks English labels, so Hindi covers the routes reached by URL alone.
  for (const route of ROUTES.filter((r) => lang === "en" || !r.act)) {
    test(`no raw i18n key on ${route.name} (${lang})`, async ({ page, api }) => {
      route.setup?.(api);
      api.answers.me = { ...api.answers.me, preferredLanguage: lang };
      await page.goto(route.path);
      await expect(page.locator("h1").first()).toBeVisible();
      await route.act?.(page);
      const text = await page.evaluate(() =>
        [
          document.body.innerText,
          ...[...document.querySelectorAll("[aria-label]")].map((el) => el.ariaLabel),
        ].join("\n"),
      );
      expect(text.match(RAW_KEY)?.[0] ?? null).toBeNull();
    });
  }
}

// HLD §7: the menus' code is not in the first download. On a slow network a click on the trigger before
// the chunk arrives must still open the menu once it lands (no lost first click). The theme menu shows
// only signed out, which the fixtures never are; LazyMenu.test.jsx covers the shared mechanism.
const SLOW_MENUS = [
  { chunk: "AccountMenuDropdown", trigger: "Your account" },
  { chunk: "NotificationMenu", trigger: /^Notifications/ },
];
for (const { chunk, trigger } of SLOW_MENUS) {
  test(`${chunk}: a click before its chunk arrives still opens the menu`, async ({ page }) => {
    let requested = false;
    await page.route(`**/assets/${chunk}-*.js`, async (route) => {
      requested = true;
      await new Promise((done) => setTimeout(done, 500));
      await route.continue();
    });
    await page.goto("/");
    await page.getByRole("button", { name: trigger }).click();
    await expect(page.getByRole("menu")).toBeVisible();
    expect(requested).toBe(true);
  });
}
