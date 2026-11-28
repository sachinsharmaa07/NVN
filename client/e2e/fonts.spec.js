// HLD §7 / UI.md §1: an English first visit downloads only latin font files; the Devanagari subsets
// (Mukta, Anek) load once the app itself is in Hindi. The हिन्दी label alone uses the system font.
import { ME, expect, test } from "./fixtures.js";

// The Devanagari subset files, e.g. mukta-devanagari-400-normal or anek-devanagari-devanagari-wght-normal.
const DEVANAGARI_FONT = /(mukta|anek-devanagari)-devanagari-[^/]*\.woff2/;

function fontRequests(page) {
  const urls = [];
  page.on("request", (request) => {
    if (DEVANAGARI_FONT.test(request.url())) urls.push(request.url());
  });
  return urls;
}

test("English home requests no Devanagari font", async ({ page }) => {
  const devanagari = fontRequests(page);
  await page.goto("/");
  await expect(page.getByRole("button", { name: "हिन्दी" })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  expect(devanagari).toEqual([]);
});

// The fixture's profile save does not change the language, so the Hindi user is set up front (as hindi.spec.js).
test("Hindi home loads the Devanagari fonts", async ({ page, api }) => {
  api.answers.me = { ...ME, preferredLanguage: "hi" };
  const devanagari = fontRequests(page);
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "hi");
  await expect.poll(() => devanagari.length).toBeGreaterThan(0);
});
