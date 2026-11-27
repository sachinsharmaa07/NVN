// Visual QA harness: full-page shots of every route at three widths in light and dark, plus a reduced-motion
// pass, against the fake backend. Opt-in only: `SHOTS=1 npx playwright test visual --project=desktop`.
import { ADMIN_ME, HEAD_ME, MOD_ME, POST, RESOLVED, STAFF_ME, expect, test } from "./fixtures.js";
import { fillDetails, toDetailsStep, toMapStep } from "./steps.js";

// Must match THEME_STORAGE_KEY in src/components/theme/themeContext.js.
const THEME_KEY = "nivaran-theme";
const WIDTHS = [360, 768, 1440];
const THEMES = ["light", "dark"];

// Later steps extend this. `setup(api)` changes fixture answers, `act(page)` reaches a state before the shot.
const ROUTES = [
  { name: "landing", path: "/" },
  { name: "report", path: "/report" },
  // The wizard's later steps and its receipt, reached the way a person gets there.
  { name: "report-pin", path: "/report", act: toMapStep },
  { name: "report-details", path: "/report", act: toDetailsStep },
  {
    name: "report-done",
    path: "/report",
    act: async (page) => {
      await toDetailsStep(page);
      await fillDetails(page);
      await page.getByRole("button", { name: "Submit report" }).click();
      await expect(page.getByRole("heading", { name: "Report submitted" })).toBeVisible();
    },
  },
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
  // A full-page capture neither advances scroll timelines nor fires in-view observers, so content
  // below the fold would show at its reveal start (invisible). Scroll through once so motion's
  // whileInView reveals run (they run once and stay), wait for them, and turn the CSS reveal off.
  await page.evaluate(async () => {
    const frame = () =>
      new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    for (let y = 0; y < document.documentElement.scrollHeight; y += window.innerHeight / 2) {
      window.scrollTo({ top: y, behavior: "instant" });
      await frame();
    }
    window.scrollTo({ top: 0, behavior: "instant" });
  });
  // Only animations with an end: a spinner or a looping effect never finishes.
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .filter((a) => a.timeline === document.timeline)
      .filter((a) => a.effect?.getComputedTiming().endTime !== Infinity)
      .every((a) => a.playState !== "running"),
  );
  await page.addStyleTag({ content: ".reveal-on-scroll { animation: none !important; }" });
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
