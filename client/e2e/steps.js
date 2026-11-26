// Shared moves through the report wizard, written the way a resident would do them.
import { expect } from "@playwright/test";
import { PIN } from "./fixtures.js";

// A tiny real PNG: the browser can decode it, so it goes through the canvas resize like a phone photo.
export const SMALL_PHOTO = {
  name: "pothole.png",
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
    "base64",
  ),
};

export const map = (page) => page.getByLabel(/^Map of pincode/);
export const pins = (page) => page.locator(".leaflet-marker-icon");
export const liveStatus = (page) => page.getByRole("status").filter({ hasText: /\S/ });
export const nextButton = (page) => page.getByRole("button", { name: "Next" });

export async function toMapStep(page) {
  await page.goto(`/report?pincode=${PIN}`);
  await expect(page.getByText("Kapurthala, Punjab")).toBeVisible();
  await nextButton(page).click();
  await expect(page.getByText("Step 2 of 3: Place the pin")).toBeVisible();
  await expect(map(page)).toBeVisible();
}

/** Taps the map at a point given as fractions of its box (0.5, 0.5 is the centre, inside the circle). */
export async function tapMap(page, fx, fy) {
  const box = await map(page).boundingBox();
  await map(page).click({ position: { x: box.width * fx, y: box.height * fy } });
}
// The bottom-left corner: outside the circle, clear of the zoom buttons and the attribution.
export const tapOutside = (page) => tapMap(page, 0.03, 0.96);

export async function toDetailsStep(page) {
  await toMapStep(page);
  await tapMap(page, 0.5, 0.5);
  await expect(pins(page)).toHaveCount(1);
  await nextButton(page).click();
  await expect(page.getByText("Step 3 of 3: Photo and details")).toBeVisible();
}

export async function fillDetails(page, { photo = true } = {}) {
  await page.getByText("Pothole or broken road").click();
  await page.getByLabel("Short title").fill("Deep pothole");
  await page
    .getByLabel("What's wrong, and where exactly?")
    .fill("A deep pothole outside the bus stand, two feet wide.");
  if (photo) {
    await page.getByLabel("Add a photo").setInputFiles(SMALL_PHOTO);
    await expect(page.getByText("Uploaded")).toBeVisible();
  }
}

/** Presses Tab until `locator` has focus (keyboard only; fails after 40 presses). */
export async function tabTo(page, locator) {
  for (let i = 0; i < 40; i += 1) {
    if (await locator.evaluate((el) => el === document.activeElement).catch(() => false)) return;
    await page.keyboard.press("Tab");
  }
  throw new Error("Tab never reached the element");
}
