// Visual QA harness: full-page shots of every route at three widths in light and dark, plus a reduced-motion
// pass, against the fake backend. Opt-in only: `SHOTS=1 npx playwright test visual --project=desktop`.
import { ADMIN_ME, HEAD_ME, MOD_ME, POST, RESOLVED, STAFF_ME, expect, test } from "./fixtures.js";

// Must match THEME_STORAGE_KEY in src/components/theme/themeContext.js.
const THEME_KEY = "nivaran-theme";
const WIDTHS = [360, 768, 1440];
const THEMES = ["light", "dark"];

// Later steps extend this. `setup(api)` changes fixture answers, `act(page)` reaches a state before the shot.
const ROUTES = [
  { name: "landing", path: "/" },
  { name: "report", path: "/report" },
  { name: "issues", path: "/issues" },
  { name: "issue", path: `/issues/${RESOLVED.ticketId}` },
  { name: "community", path: "/community" },
  { name: "post", path: `/community/${POST.id}` },
  { name: "profile", path: "/profile" },
  { name: "notfound", path: "/nope" },
  { name: "staff", path: "/staff", setup: (api) => (api.answers.me = STAFF_ME) },
  { name: "staff-head", path: "/staff", setup: (api) => (api.answers.me = HEAD_ME) },
  { name: "moderation", path: "/moderation", setup: (api) => (api.answers.me = MOD_ME) },
  { name: "admin-users", path: "/admin/users", setup: (api) => (api.answers.me = ADMIN_ME) },
  {
    name: "city-settings",
    path: "/admin/city-settings",
    setup: (api) => (api.answers.me = ADMIN_ME),
  },
];

test.skip(process.env.SHOTS !== "1", "visual shots run only with SHOTS=1");

async function shoot(page, api, route, { width, theme, file }) {
  test.skip(test.info().project.name !== "desktop", "visual shots set their own viewport");
  route.setup?.(api);
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [THEME_KEY, theme]);
  await page.setViewportSize({ width, height: 900 });
  await page.goto(route.path);
  await expect(page.locator("h1").first()).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  await route.act?.(page);
  await page.screenshot({ path: `test-results/visual/${file}.png`, fullPage: true });
}

for (const route of ROUTES) {
  for (const width of WIDTHS) {
    for (const theme of THEMES) {
      test(`visual ${route.name} ${width} ${theme}`, async ({ page, api }) => {
        await shoot(page, api, route, { width, theme, file: `${route.name}-${width}-${theme}` });
      });
    }
  }

  test(`visual ${route.name} 360 reduced motion`, async ({ page, api }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await shoot(page, api, route, {
      width: 360,
      theme: "light",
      file: `${route.name}-360-reduced`,
    });
  });
}
