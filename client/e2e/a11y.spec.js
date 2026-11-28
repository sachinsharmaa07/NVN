// Step 13, accessibility and responsive pass (UI.md §4.3, §5, §9): axe on every visual route and state, in
// light and dark, on both projects; no horizontal scroll at 320px; the keyboard path; reduced motion.
import AxeBuilder from "@axe-core/playwright";
import { ME, PIN, RESOLVED, SUPER_ME, expect, test } from "./fixtures.js";
import { ROUTES, STATES, THEME_KEY } from "./routes.js";
import { toMapStep } from "./steps.js";

const TAGS = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];

async function open(page, api, route, theme) {
  route.setup?.(api);
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [THEME_KEY, theme]);
  await page.goto(route.path);
  await expect(page.locator("h1").first()).toBeVisible();
  await page.waitForLoadState("networkidle");
  await route.act?.(page);
}

// One line per violation: rule, then the offending selectors, so a failure reads without the trace.
const summary = (violations) =>
  violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);

for (const route of [...ROUTES, ...STATES]) {
  for (const theme of ["light", "dark"]) {
    test(`axe ${route.name} ${theme}`, async ({ page, api }) => {
      // Reduced motion so axe reads settled colours, not ones caught mid-fade.
      await page.emulateMedia({ reducedMotion: "reduce" });
      await open(page, api, route, theme);
      const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
      expect(summary(violations)).toEqual([]);
    });
  }

  test(`320px ${route.name}: no horizontal scroll`, async ({ page, api }) => {
    test.skip(test.info().project.name !== "mobile", "one width check is enough");
    await page.setViewportSize({ width: 320, height: 740 });
    await open(page, api, route, "light");
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBeLessThanOrEqual(320);
  });
}

// Keyboard (UI.md §9): the skip link is first and lands in <main>; overlays trap focus, close on Escape and give
// focus back to their trigger; a drawer that can be dragged away also has a button that closes it.
test("skip link is the first stop and moves focus into main", async ({ page }) => {
  await page.goto("/issues");
  await expect(page.locator("h1").first()).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main$/);
  await expect
    .poll(() => page.evaluate(() => document.activeElement?.closest("main")?.id ?? null))
    .toBe("main");
});

const OVERLAYS = [
  {
    name: "add city",
    path: "/admin/cities",
    setup: (api) => (api.answers.me = SUPER_ME),
    trigger: (page) => page.getByRole("button", { name: "Add city" }),
  },
  {
    name: "write a post",
    path: "/community",
    setup: (api) => (api.answers.me = { ...ME, defaultPincode: PIN }),
    trigger: (page) => page.getByRole("button", { name: "Write a post" }),
  },
];

for (const o of OVERLAYS) {
  test(`${o.name}: focus stays inside, Escape returns it to the trigger`, async ({ page, api }) => {
    o.setup(api);
    await page.goto(o.path);
    const trigger = o.trigger(page);
    await trigger.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    for (let i = 0; i < 12; i += 1) {
      await page.keyboard.press("Tab");
      expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
    }
    // Drag to dismiss is never the only way out: a real button closes it too.
    await expect(dialog.getByRole("button", { name: /close|cancel/i }).first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });
}

// Reduced motion (UI.md §4.3): while each moment runs, nothing slides or scales, and no CSS animation or
// transition lasts longer than the 0.01ms floor. Opacity-only fades from Motion are allowed by §4.3.
function recordMotion() {
  window.__motion = [];
  const MOVING = /transform|translate|scale|rotate/;
  const scan = () => {
    for (const a of document.getAnimations()) {
      const { duration } = a.effect?.getComputedTiming() ?? {};
      if (!(duration > 1) || duration === Infinity) continue;
      const props = (a.effect?.getKeyframes?.() ?? []).flatMap((k) => Object.keys(k));
      const css = a instanceof CSSAnimation || a instanceof CSSTransition;
      if (css || props.some((p) => MOVING.test(p))) {
        const target = a.effect?.target;
        const name = a.animationName ?? a.transitionProperty ?? props.join("+");
        window.__motion.push(`${target?.tagName ?? "?"}.${target?.className ?? ""} ${name}`);
      }
    }
    requestAnimationFrame(scan);
  };
  requestAnimationFrame(scan);
}

const MOMENTS = [
  {
    name: "page change",
    act: async (page) => {
      await page.goto("/");
      await page.getByRole("link", { name: "My issues" }).first().click();
      await expect(page).toHaveURL(/\/issues$/);
    },
  },
  {
    name: "ticket opens",
    act: async (page) => {
      await page.goto("/issues");
      await page
        .getByRole("link", { name: new RegExp(RESOLVED.title) })
        .first()
        .click();
      await expect(page.getByRole("heading", { level: 1, name: RESOLVED.title })).toBeVisible();
    },
  },
  { name: "wizard step", act: (page) => toMapStep(page) },
  {
    name: "dialog or drawer opens",
    setup: (api) => (api.answers.me = SUPER_ME),
    act: async (page) => {
      await page.goto("/admin/cities");
      await page.getByRole("button", { name: "Add city" }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
    },
  },
];

for (const m of MOMENTS) {
  test(`reduced motion: ${m.name} is instant`, async ({ page, api }) => {
    m.setup?.(api);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(recordMotion);
    await m.act(page);
    await page.waitForTimeout(400); // let anything that would animate, animate
    expect([...new Set(await page.evaluate(() => window.__motion))]).toEqual([]);
  });
}
