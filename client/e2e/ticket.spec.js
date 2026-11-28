// The ticket page (UI.md §7): one hierarchy, the decision first, a ticket that loads before you land,
// and a designed "not found".
import { RESOLVED, expect, test } from "./fixtures.js";

const ID = RESOLVED.ticketId;

test("a missing ticket says so and offers My issues", async ({ page, api }) => {
  api.answers.detail = [404, { error: { code: "NOT_FOUND", message: "Not found" } }];
  await page.goto(`/issues/${ID}`);
  await expect(
    page.getByRole("heading", { level: 1, name: "We couldn't find that ticket" }),
  ).toBeVisible();
  await expect(page.getByText("Check the ticket ID, or open it from My issues.")).toBeVisible();
  await page.getByRole("link", { name: "Go to My issues" }).click();
  await expect(page).toHaveURL(/\/issues$/);
});

test("the title is the only h1; the ticket ID is not a heading", async ({ page }) => {
  await page.goto(`/issues/${ID}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(RESOLVED.title);
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("heading", { name: ID })).toHaveCount(0);
});

test("on a resolved ticket at 360x740, Is it fixed? is on the first screen", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto(`/issues/${ID}`);
  await expect(page.getByRole("heading", { name: "Is it fixed?" })).toBeInViewport();
  await expect(page.getByRole("button", { name: "Yes, it's fixed" })).toBeInViewport({ ratio: 1 });
});

test("hovering a card loads the ticket, so the click shows it with no skeleton", async ({
  page,
  api,
}) => {
  await page.goto("/issues");
  const card = page.getByRole("link", { name: /Deep pothole/ });
  await card.hover();
  await expect.poll(() => api.count("GET", `/api/issues/${ID}`)).toBe(1);
  await card.click();
  await expect(page.getByRole("heading", { level: 1, name: RESOLVED.title })).toBeVisible();
  // Already in the cache from the hover: no second request, and the page never showed its skeleton.
  expect(api.count("GET", `/api/issues/${ID}`)).toBe(1);
  await expect(page.locator('[data-slot="skeleton"]')).toHaveCount(0);
});

test("photos are requested at their rendered size, not the full upload (HLD §7)", async ({
  page,
}) => {
  const photos = [];
  page.on("request", (request) => {
    if (request.url().startsWith("https://res.cloudinary.com/")) photos.push(request.url());
  });
  await page.goto(`/issues/${ID}`);
  // Lazy images load only near the viewport.
  await page.getByRole("img", { name: "Photo from the report, photo 1" }).scrollIntoViewIfNeeded();
  await expect.poll(() => photos.length).toBeGreaterThan(0);
  for (const url of photos) expect(url).toMatch(/\/image\/upload\/c_limit,w_\d+\/f_auto\/q_auto\//);
});

test("at 375 the before and after photos sit side by side (review m10)", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`/issues/${ID}`);
  const before = page.getByRole("img", { name: "Photo from the report, photo 1" });
  const after = page.getByRole("img", { name: "Photo after the fix, photo 1" });
  await before.scrollIntoViewIfNeeded();
  const a = await before.boundingBox();
  const b = await after.boundingBox();
  expect(Math.abs(a.y - b.y)).toBeLessThan(1);
  expect(b.x).toBeGreaterThan(a.x + a.width);
});
