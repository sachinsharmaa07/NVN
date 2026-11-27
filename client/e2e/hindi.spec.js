// A user who chose Hindi sees the app in Hindi, with <html lang="hi"> for the Devanagari line heights.
import { ME, PIN, expect, test } from "./fixtures.js";

const shot = (page, name) =>
  process.env.SHOTS
    ? page.screenshot({ path: `${process.env.SHOTS}/${name}-${test.info().project.name}.png` })
    : null;

test.beforeEach(({ api }) => {
  api.answers.me = { ...ME, preferredLanguage: "hi", defaultPincode: PIN };
});

test("home, my issues and community render in Hindi", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "hi");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "अपने पिनकोड की समस्या दर्ज करें। ठीक होने तक उस पर नज़र रखें।",
  );
  await shot(page, "hi-home");
  await page.goto("/issues");
  await expect(page.getByRole("heading", { level: 1, name: "मेरी शिकायतें" })).toBeVisible();
  await page.goto("/community");
  await expect(page.getByRole("heading", { level: 1, name: "मोहल्ले की सूचनाएँ" })).toBeVisible();
  await expect(page.getByRole("button", { name: "पोस्ट लिखें" })).toBeVisible();
  await shot(page, "hi-community");
});

test("switching to English in the footer saves it to the profile", async ({ page, api }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "English" }).click();
  await expect.poll(() => api.count("PATCH", "/api/me")).toBe(1);
  const sent = api.requests.findLast((r) => r.method === "PATCH");
  expect(JSON.parse(sent.body)).toEqual({ preferredLanguage: "en" });
});
