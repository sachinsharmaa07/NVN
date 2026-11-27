// The M1 report flow end to end in a real browser, against the fake backend in fixtures.js (ADR 0003).
import { CREATED, PIN, expect, test } from "./fixtures.js";
import {
  fillDetails,
  liveStatus,
  map,
  nextButton,
  pins,
  tabTo,
  tapMap,
  tapOutside,
  toDetailsStep,
  toMapStep,
} from "./steps.js";

const submit = (page) => page.getByRole("button", { name: "Submit report" });
const counterfoil = (page) => page.getByRole("heading", { name: "Report submitted" });

test("happy path: pincode, pin, details and a photo give a counterfoil; Copy works", async ({
  page,
  context,
  api,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await toDetailsStep(page);
  await fillDetails(page);
  await submit(page).click();

  await expect(counterfoil(page)).toBeVisible();
  await expect(page.getByText(CREATED.ticketId)).toBeVisible();
  await expect(page.getByText("Roads")).toBeVisible();
  // 11:30 UTC is 5:00 PM IST, although this browser's clock is set to London.
  await expect(page.getByText(/^3 Dec( 2026)?, 5:00 PM$/)).toBeVisible();
  await page.getByRole("button", { name: `Copy ticket ID ${CREATED.ticketId}` }).click();
  await expect(page.getByText("Ticket ID copied")).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(CREATED.ticketId);

  const [sent] = api.requests.filter((r) => r.method === "POST" && r.path === "/api/issues");
  expect(JSON.parse(sent.body)).toMatchObject({
    pincode: PIN,
    category: "pothole",
    title: "Deep pothole",
    photos: ["nivaran/development/reports/e2e-photo"],
  });
});

test("an unknown pincode offers the waitlist, and joining confirms", async ({ page }) => {
  await page.goto("/report");
  await page.getByLabel("Your pincode").fill("999999");
  await expect(page.getByText(/We couldn't find 999999/)).toBeVisible();
  await expect(nextButton(page)).toBeDisabled();
  await page.getByLabel("Your email").fill("asha@example.com");
  await page.getByRole("button", { name: "Join the waitlist" }).click();
  await expect(page.getByText("You're on the waitlist for 999999")).toBeVisible();
});

test("a pin outside the area is refused and announced; a dragged pin snaps back", async ({
  page,
}) => {
  await toMapStep(page);
  await tapOutside(page);
  await expect(liveStatus(page)).toContainText(`This spot is outside pincode ${PIN}`);
  await expect(liveStatus(page)).toHaveAttribute("aria-live", "polite");
  await expect(pins(page)).toHaveCount(0);
  await expect(nextButton(page)).toBeDisabled();

  // Place it inside, then drag it out: it returns to where it was.
  await tapMap(page, 0.5, 0.5);
  const before = await pins(page).boundingBox();
  const box = await map(page).boundingBox();
  await page.mouse.move(before.x + before.width / 2, before.y + before.height - 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 10, box.y + box.height - 10, { steps: 8 });
  await page.mouse.up();
  await expect(liveStatus(page)).toContainText("outside pincode");
  await expect.poll(async () => (await pins(page).boundingBox()).x).toBeCloseTo(before.x, 0);
});

test("a 422 OUTSIDE_PINCODE on submit returns to the map with the message", async ({
  page,
  api,
}) => {
  api.answers.issues = [
    422,
    { error: { code: "OUTSIDE_PINCODE", message: `That spot is outside pincode ${PIN}.` } },
  ];
  await toDetailsStep(page);
  await fillDetails(page, { photo: false });
  await submit(page).click();
  await expect(page.getByText("Step 2 of 3: Place the pin")).toBeVisible();
  await expect(liveStatus(page)).toContainText(`This spot is outside pincode ${PIN}`);
});

test("a double click on Submit sends exactly one POST /api/issues", async ({ page, api }) => {
  api.answers.issuesDelayMs = 800; // keep the first request open while the second click lands
  await toDetailsStep(page);
  await fillDetails(page, { photo: false });
  await submit(page).dblclick();
  await expect(counterfoil(page)).toBeVisible();
  expect(api.count("POST", "/api/issues")).toBe(1);
});

test("a photo over 5 MB that can't be shrunk is refused in the browser, with no upload", async ({
  page,
  api,
}) => {
  await toDetailsStep(page);
  // HEIC: Chromium can't decode it, so it can't be resized and its real size counts.
  await page.getByLabel("Add a photo").setInputFiles({
    name: "big.heic",
    mimeType: "image/heic",
    buffer: Buffer.alloc(6 * 1024 * 1024, 1),
  });
  await expect(page.getByText("This photo is over 5 MB.", { exact: false })).toBeVisible();
  await expect(submit(page)).toBeDisabled();
  expect(api.count("POST", "/api/uploads/sign")).toBe(0);
  expect(api.count("POST", "cloudinary.com")).toBe(0);
});

test("a refresh on step 3 restores the pincode, pin and text, but not photos", async ({ page }) => {
  await toDetailsStep(page);
  await fillDetails(page);
  await page.reload();

  await expect(page.getByText("Step 3 of 3: Photo and details")).toBeVisible();
  await expect(page.getByLabel("Short title")).toHaveValue("Deep pothole");
  await expect(page.getByLabel("What's wrong, and where exactly?")).toHaveValue(/deep pothole/);
  await expect(page.getByRole("radio", { name: "Pothole or broken road" })).toBeChecked();
  await expect(page.getByText(PIN, { exact: true })).toBeVisible();
  await expect(page.getByText("0 uploaded")).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();
  await expect(pins(page)).toHaveCount(1); // the saved pin is back on the map
});

test("keyboard only: pincode, then the pin placed with Enter and nudged with arrows", async ({
  page,
  api,
  isMobile,
}) => {
  test.skip(isMobile, "a keyboard path; the phone project covers touch");
  await page.goto("/report");
  await tabTo(page, page.getByLabel("Your pincode"));
  await page.keyboard.type(PIN);
  await expect(page.getByText("Kapurthala, Punjab")).toBeVisible();
  await tabTo(page, nextButton(page));
  await page.keyboard.press("Enter");

  await expect(page.getByText("Step 2 of 3: Place the pin")).toBeVisible();
  await tabTo(page, map(page));
  await page.keyboard.press("Enter"); // drops the pin at the map's centre
  await expect(pins(page)).toHaveCount(1);
  await tabTo(page, pins(page));
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  await tabTo(page, nextButton(page));
  await page.keyboard.press("Enter");

  await expect(page.getByText("Step 3 of 3: Photo and details")).toBeVisible();
  const check = api.requests.find((r) => r.path.endsWith("/check-point"));
  const { lat, lng } = JSON.parse(check.body);
  // Centre of the 144601 circle (31.38) plus two 0.0002° nudges north.
  expect(lat).toBeGreaterThan(31.3802);
  expect(lat).toBeLessThan(31.3806);
  expect(lng).toBeCloseTo(75.38, 3);
});

test("Start over discards the uploaded photo in one request and returns to an empty step 1", async ({
  page,
  api,
}) => {
  await toDetailsStep(page);
  await fillDetails(page);
  await page.getByRole("button", { name: "Start over" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Start over" }).click();

  await expect(page).toHaveURL(/\/report\?step=1$/);
  await expect(page.getByRole("textbox", { name: "Your pincode", exact: true })).toHaveValue("");
  const discards = api.requests.filter((r) => r.path === "/api/uploads/discard");
  expect(discards).toHaveLength(1);
  expect(JSON.parse(discards[0].body)).toEqual({
    publicIds: ["nivaran/development/reports/e2e-photo"],
  });
});

test("a disabled Next says why", async ({ page }) => {
  await page.goto("/report");
  await page.getByRole("textbox", { name: "Your pincode", exact: true }).fill("1446");
  await expect(nextButton(page)).toBeDisabled();
  await expect(nextButton(page)).toHaveAccessibleDescription("Enter all 6 digits to continue.");
});

test("at 360 the Back/Next bar sits just above the bottom bar on every step", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  // The footer's bottom edge meets the bottom bar's top edge (both fixed), on all three steps.
  const footerOnBar = () =>
    page.evaluate(() => {
      const footer = document.querySelector('[data-slot="wizard-footer"]').getBoundingClientRect();
      const bar = document.querySelector('[data-slot="bottom-bar"]').getBoundingClientRect();
      return Math.abs(footer.bottom - bar.top) <= 1;
    });
  await page.goto(`/report?pincode=${PIN}`);
  await expect(page.getByText("Kapurthala, Punjab")).toBeVisible();
  expect(await footerOnBar()).toBe(true);
  await nextButton(page).click();
  await expect(map(page)).toBeVisible();
  expect(await footerOnBar()).toBe(true);
  await tapMap(page, 0.5, 0.5);
  await nextButton(page).click();
  await expect(page.getByLabel("Short title")).toBeVisible();
  expect(await footerOnBar()).toBe(true);
});
