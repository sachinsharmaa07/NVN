// M3 community end to end against the fake backend in fixtures.js (ADR 0003).
import { COMMENTS, ME, PIN, POST, expect, test } from "./fixtures.js";

// Set SHOTS=<folder> to save full-page screenshots for a design review.
const shot = (page, name) =>
  process.env.SHOTS
    ? page.screenshot({
        path: `${process.env.SHOTS}/${name}-${test.info().project.name}.png`,
        fullPage: true,
      })
    : null;
const sentBody = (api, part) =>
  JSON.parse(api.requests.findLast((r) => r.method !== "GET" && r.url.includes(part)).body);

test.beforeEach(({ api }) => {
  api.answers.me = { ...ME, defaultPincode: PIN };
});

test("a) resident reads the pincode feed and publishes a post", async ({ page, api }) => {
  await page.goto("/community");
  await expect(
    page.getByRole("heading", { level: 1, name: "Neighbourhood notices" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: new RegExp(POST.title) })).toBeVisible();
  await shot(page, "feed");

  await page.getByRole("button", { name: "Write a post" }).click();
  await page.getByLabel("Title", { exact: true }).fill("Garbage pickup skipped on Sunday");
  await page
    .getByLabel("Post", { exact: true })
    .fill("The truck didn't come to Model Town this week. Anyone else?");
  await shot(page, "composer");
  await page.getByRole("button", { name: "Publish post" }).click();
  await expect(page.getByText("Post published")).toBeVisible();
  expect(sentBody(api, "/api/community/posts")).toEqual({
    title: "Garbage pickup skipped on Sunday",
    body: "The truck didn't come to Model Town this week. Anyone else?",
  });
});

test("b) resident opens a post, reads the thread, comments and reports it", async ({
  page,
  api,
}) => {
  await page.goto("/community");
  await page.getByRole("link", { name: new RegExp(POST.title) }).click();
  await expect(page).toHaveURL(`/community/${POST.id}`);
  await expect(page.getByText(COMMENTS[1].body)).toBeVisible();
  await shot(page, "post");

  await page.getByLabel("Add a comment").fill("Thanks, I'll check tonight.");
  await page.getByRole("button", { name: "Post comment" }).click();
  await expect.poll(() => api.count("POST", "/comments")).toBe(1);
  expect(sentBody(api, "/comments")).toEqual({ body: "Thanks, I'll check tonight." });

  await page.getByRole("button", { name: "Post actions" }).first().click();
  await page.getByRole("menuitem", { name: "Report" }).click();
  await page.getByRole("button", { name: "Send report" }).click();
  await expect(page.getByText("Report sent. Thank you.")).toBeVisible();
  expect(sentBody(api, "/flags")).toEqual({
    targetType: "post",
    targetId: POST.id,
    reason: "spam",
  });
});
