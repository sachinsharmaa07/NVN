// M3 community end to end against the fake backend in fixtures.js (ADR 0003).
import { COMMENTS, ME, MOD_ME, PIN, POST, expect, test } from "./fixtures.js";

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

test("c) moderator restores a hidden post from the queue", async ({ page, api }) => {
  api.answers.me = MOD_ME;
  await page.goto("/");
  await page.getByRole("button", { name: "Your account" }).click();
  await page.getByRole("menuitem", { name: "Moderation" }).click();
  await expect(page).toHaveURL("/moderation");
  await expect(page.getByRole("heading", { name: "Cheap repairs, call now" })).toBeVisible();
  await shot(page, "moderation");
  api.answers.queue = [200, { items: [], nextCursor: null }];
  await page.getByRole("button", { name: "Restore" }).click();
  await expect(page.getByText("Restored. It's visible again.")).toBeVisible();
  await expect(page.getByText("Nothing waiting for review")).toBeVisible();
  expect(sentBody(api, "/api/moderation/post/")).toEqual({ action: "restore" });
});

test("d) help chat answers a ticket from the records", async ({ page, api }) => {
  api.answers.chat = [
    200,
    {
      kind: "ticket",
      tickets: [
        {
          ticketId: "NIV-2026-000042",
          title: "Deep pothole",
          status: "in_progress",
          expectedBy: "2026-12-03T11:30:00.000Z",
          updatedAt: "2026-11-26T06:30:00.000Z",
          department: "Roads",
        },
      ],
      unknown: [],
    },
  ];
  await page.goto("/issues");
  await page.getByRole("button", { name: "Open help chat" }).click();
  await page.getByLabel("Your question").fill("Where is NIV-2026-000042?");
  await page.getByLabel("Your question").press("Enter");
  await expect(page.getByText("Department: Roads")).toBeVisible();
  // The question box stays on screen after an answer (the log scrolls, not the sheet).
  await expect(page.getByLabel("Your question")).toBeInViewport({ ratio: 1 });
  await shot(page, "chat");
  expect(sentBody(api, "/api/chat")).toEqual({ message: "Where is NIV-2026-000042?" });
});
