// Community posts, comments and flags (M3 step 1).
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useFakeAuth0 } from "../helpers/authSeam.js";
import { useTestDb, seedUser } from "../helpers/testDb.js";
import { as, seedIssueWorld } from "../helpers/issueWorld.js";

vi.mock("../../src/middleware/auth.js", async (orig) =>
  (await import("../helpers/authSeam.js")).authModule(await orig()),
);

const { createApp } = await import("../../src/app.js");
const { Pincode } = await import("../../src/models/Pincode.js");
const { Post } = await import("../../src/models/Post.js");
const { Comment } = await import("../../src/models/Comment.js");
const { AuditLog } = await import("../../src/models/AuditLog.js");

useTestDb();
useFakeAuth0();
const app = createApp();

const PIN = "144601";
const POST = {
  title: "Streetlights out on Mall Road",
  body: "Three lights near the market are dark at night.",
};
let w;
let resident;
let neighbours;

beforeEach(async () => {
  w = await seedIssueWorld();
  await Pincode.create({
    pin: PIN,
    district: "Kapurthala",
    state: "Punjab",
    cityId: w.city._id,
    isServed: true,
    centroid: { type: "Point", coordinates: [75.38, 31.38] },
    radiusM: 4000,
  });
  resident = await seedUser("citizen", {}, { defaultPincode: PIN, name: "Asha" });
  neighbours = await Promise.all(
    [1, 2, 3].map(() => seedUser("citizen", {}, { defaultPincode: PIN })),
  );
});

const newPost = async (user = resident) =>
  (await as(app, user).post("/api/community/posts").send(POST)).body;

describe("posts", () => {
  it("creates a post in the author's pincode and lists it in that feed only", async () => {
    const res = await as(app, resident).post("/api/community/posts").send(POST);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      pincode: PIN,
      author: "Asha",
      mine: true,
      status: "published",
    });
    const feed = await as(app, w.citizen).get(`/api/community/posts?pincode=${PIN}`);
    expect(feed.body.items.map((p) => p.id)).toEqual([res.body.id]);
    expect(feed.body.items[0].mine).toBe(false);
    const other = await as(app, w.citizen).get("/api/community/posts?pincode=110001");
    expect(other.body.items).toEqual([]);
  });

  it("needs a served home pincode to post", async () => {
    const none = await as(app, w.citizen).post("/api/community/posts").send(POST);
    expect(none.body.error.code).toBe("PINCODE_REQUIRED");
    const far = await seedUser("citizen", {}, { defaultPincode: "110001" });
    const unserved = await as(app, far).post("/api/community/posts").send(POST);
    expect(unserved.body.error.code).toBe("PINCODE_NOT_SERVED");
  });

  it("refuses extra keys and short text", async () => {
    const extra = await as(app, resident)
      .post("/api/community/posts")
      .send({ ...POST, status: "hidden" });
    expect(extra.status).toBe(400);
    const short = await as(app, resident)
      .post("/api/community/posts")
      .send({ title: "Hi", body: "short" });
    expect(short.status).toBe(400);
  });

  it("lets only the author delete, and a deleted post is 404 for everyone", async () => {
    const p = await newPost();
    expect((await as(app, w.citizen).delete(`/api/community/posts/${p.id}`)).status).toBe(404);
    expect((await as(app, resident).delete(`/api/community/posts/${p.id}`)).body.status).toBe(
      "deleted",
    );
    expect((await as(app, resident).get(`/api/community/posts/${p.id}`)).status).toBe(404);
  });
});

describe("comments", () => {
  it("adds comments and one level of replies, and keeps commentCount right", async () => {
    const p = await newPost();
    const top = await as(app, w.citizen)
      .post(`/api/community/posts/${p.id}/comments`)
      .send({ body: "Same here" });
    expect(top.status).toBe(201);
    const reply = await as(app, resident)
      .post(`/api/community/posts/${p.id}/comments`)
      .send({ body: "Reported it", parentId: top.body.id });
    expect(reply.body.parentId).toBe(top.body.id);
    const deep = await as(app, w.citizen)
      .post(`/api/community/posts/${p.id}/comments`)
      .send({ body: "Too deep", parentId: reply.body.id });
    expect(deep.status).toBe(400);
    const list = await as(app, w.citizen).get(`/api/community/posts/${p.id}/comments`);
    expect(list.body.items.map((c) => c.body)).toEqual(["Same here", "Reported it"]);
    await as(app, resident).delete(`/api/community/comments/${reply.body.id}`);
    expect((await Post.findById(p.id)).commentCount).toBe(1);
  });
});

describe("flags", () => {
  it("hides a post at the third flag, audits it as the system, and ignores repeats", async () => {
    const p = await newPost();
    const flag = (u) =>
      as(app, u)
        .post("/api/community/flags")
        .send({ targetType: "post", targetId: p.id, reason: "spam" });
    await flag(neighbours[0]);
    expect((await flag(neighbours[0])).body).toEqual({ flagged: true }); // repeat: no change
    await flag(neighbours[1]);
    expect((await Post.findById(p.id)).status).toBe("published");
    await flag(neighbours[2]);
    expect((await Post.findById(p.id)).toObject()).toMatchObject({
      status: "hidden",
      flagCount: 3,
    });
    const feed = await as(app, w.citizen).get(`/api/community/posts?pincode=${PIN}`);
    expect(feed.body.items).toEqual([]);
    expect((await as(app, w.citizen).get(`/api/community/posts/${p.id}`)).status).toBe(404);
    expect((await as(app, resident).get(`/api/community/posts/${p.id}`)).body.status).toBe(
      "hidden",
    );
    const audit = await AuditLog.findOne({ action: "post.hide" }).lean();
    expect(audit).toMatchObject({
      actorType: "system",
      actorLabel: "community-flags",
      targetType: "post",
    });
  });

  it("refuses flagging your own post", async () => {
    const p = await newPost();
    const res = await as(app, resident)
      .post("/api/community/flags")
      .send({ targetType: "post", targetId: p.id, reason: "spam" });
    expect(res.status).toBe(400);
  });
});

describe("moderation", () => {
  async function hiddenPost() {
    const p = await newPost();
    await Post.updateOne({ _id: p.id }, { status: "hidden", flagCount: 3 });
    return p;
  }

  it("lists hidden posts of the moderator's city only", async () => {
    const p = await hiddenPost();
    const q = await as(app, w.admin).get("/api/moderation/queue");
    expect(q.status).toBe(200);
    expect(q.body.items.map((i) => i.id)).toEqual([p.id]);
    expect((await as(app, w.admin2).get("/api/moderation/queue")).body.items).toEqual([]);
  });

  it("lists hidden comments with the post they belong to", async () => {
    const p = await newPost();
    const c = await as(app, w.citizen)
      .post(`/api/community/posts/${p.id}/comments`)
      .send({ body: "Call me on my number" });
    await Comment.updateOne({ _id: c.body.id }, { status: "hidden", flagCount: 3 });
    const q = await as(app, w.admin).get("/api/moderation/queue?type=comment");
    expect(q.body.items).toEqual([
      expect.objectContaining({ id: c.body.id, postId: p.id, status: "hidden", flagCount: 3 }),
    ]);
  });

  it("restores with flags cleared, deletes with a reason, and audits both", async () => {
    const p = await hiddenPost();
    const restore = await as(app, w.admin)
      .post(`/api/moderation/post/${p.id}`)
      .send({ action: "restore" });
    expect(restore.body).toEqual({ id: p.id, status: "published", flagCount: 0 });
    const noReason = await as(app, w.admin)
      .post(`/api/moderation/post/${p.id}`)
      .send({ action: "delete" });
    expect(noReason.status).toBe(400);
    const del = await as(app, w.admin)
      .post(`/api/moderation/post/${p.id}`)
      .send({ action: "delete", reason: "Shares a phone number" });
    expect(del.body.status).toBe("deleted");
    const actions = (await AuditLog.find({ targetId: p.id }).sort({ at: 1 }).lean()).map(
      (a) => a.action,
    );
    expect(actions).toEqual(["post.restore", "post.delete"]);
  });

  it("is 404 outside the city and 403 without post:moderate", async () => {
    const p = await hiddenPost();
    expect(
      (await as(app, w.admin2).post(`/api/moderation/post/${p.id}`).send({ action: "restore" }))
        .status,
    ).toBe(404);
    expect((await as(app, w.citizen).get("/api/moderation/queue")).status).toBe(403);
  });
});
