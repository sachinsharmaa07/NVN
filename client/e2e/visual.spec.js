// Visual QA harness: full-page shots of every route at three widths in light and dark, plus a reduced-motion
// pass, against the fake backend. Opt-in only: `SHOTS=1 npx playwright test visual --project=desktop`.
import { expect, test } from "./fixtures.js";
import { ROUTES, STATES, THEME_KEY } from "./routes.js";

const WIDTHS = [360, 768, 1440];
const THEMES = ["light", "dark"];

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
  // Only animations with an end: a spinner or a looping effect never finishes.
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .filter((a) => a.timeline === document.timeline)
      .filter((a) => a.effect?.getComputedTiming().endTime !== Infinity)
      .every((a) => a.playState !== "running"),
  );
  // A full-page capture never advances scroll timelines, so turn the CSS reveal off for below-the-fold content.
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

for (const route of STATES) {
  test(`visual state ${route.name} 360 light`, async ({ page, api }) => {
    await shoot(page, api, route, {
      width: 360,
      theme: "light",
      file: `state-${route.name}-360-light`,
    });
  });
}
