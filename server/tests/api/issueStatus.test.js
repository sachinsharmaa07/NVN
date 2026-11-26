// PATCH /api/issues/:ticketId/status and .../assign (M2 step 4).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useFakeAuth0 } from "../helpers/authSeam.js";
import { useTestDb } from "../helpers/testDb.js";
import { as, makeIssue, seedIssueWorld, PHOTO } from "../helpers/issueWorld.js";

vi.mock("../../src/middleware/auth.js", async (orig) =>
  (await import("../helpers/authSeam.js")).authModule(await orig()),
);

const { createApp } = await import("../../src/app.js");
const { Issue } = await import("../../src/models/Issue.js");
const { AuditLog } = await import("../../src/models/AuditLog.js");
const { Notification } = await import("../../src/models/Notification.js");

useTestDb();
useFakeAuth0();
const app = createApp();

let w;
beforeEach(async () => {
  w = await seedIssueWorld();
});
afterEach(() => vi.unstubAllGlobals());

const patch = (user, issue, path, body) =>
  as(app, user).patch(`/api/issues/${issue.ticketId}/${path}`).send(body);
const code = (res) => res.body.error?.code;
/** Cloudinary Admin API knows our after photo. */
const cloudinaryHasPhoto = () =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url) =>
      String(url).endsWith(PHOTO)
        ? new Response(JSON.stringify({ bytes: 1000, format: "jpg", width: 800, height: 600 }))
        : new Response("{}", { status: 404 }),
    ),
  );

describe("PATCH /api/issues/:ticketId/status", () => {
  it("moves the issue, bumps the version, and writes history, audit and notification together", async () => {
    const issue = await makeIssue(w);
    const res = await patch(w.staff, issue, "status", {
      status: "assigned",
      note: "Crew booked",
      version: 0,
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "assigned", version: 1 });
    expect(res.body.timeline.at(-1)).toMatchObject({
      status: "assigned",
      role: "staff",
      note: "Crew booked",
    });
    const audit = await AuditLog.findOne({ action: "issue.status_change" }).lean();
    expect(audit).toMatchObject({
      actorId: w.staff._id,
      actorRole: "staff",
      targetType: "issue",
      targetId: issue._id,
      reason: "Crew booked",
      before: { ticketId: issue.ticketId, status: "submitted" },
      after: { ticketId: issue.ticketId, status: "assigned" },
    });
    const note = await Notification.findOne({ userId: w.reporter._id }).lean();
    expect(note).toMatchObject({
      type: "status_changed",
      status: "assigned",
      ticketId: issue.ticketId,
    });
  });

  it("resolved needs an after photo, checked with Cloudinary, and sets resolvedAt", async () => {
    const issue = await makeIssue(w, { status: "in_progress" });
    const none = await patch(w.staff, issue, "status", { status: "resolved", version: 0 });
    expect(none.status).toBe(400);
    expect(code(none)).toBe("VALIDATION_ERROR");

    cloudinaryHasPhoto();
    const res = await patch(w.staff, issue, "status", {
      status: "resolved",
      afterPhotoPublicIds: [PHOTO],
      version: 0,
    });
    expect(res.status).toBe(200);
    expect(res.body.afterPhotos).toEqual([
      {
        publicId: PHOTO,
        width: 800,
        height: 600,
        url: `https://res.cloudinary.com/nivaran-test/image/upload/${PHOTO}`,
      },
    ]);
    expect((await Issue.findById(issue._id).lean()).resolvedAt).toBeInstanceOf(Date);
  });

  it("after photos with any other status are refused", async () => {
    const issue = await makeIssue(w);
    const res = await patch(w.staff, issue, "status", {
      status: "assigned",
      afterPhotoPublicIds: [PHOTO],
      version: 0,
    });
    expect(code(res)).toBe("VALIDATION_ERROR");
  });

  it("rejected needs a note and a dept_head or city_admin", async () => {
    const issue = await makeIssue(w);
    const noNote = await patch(w.head, issue, "status", { status: "rejected", version: 0 });
    expect(code(noNote)).toBe("VALIDATION_ERROR");
    const byStaff = await patch(w.staff, issue, "status", {
      status: "rejected",
      note: "Duplicate",
      version: 0,
    });
    expect(byStaff.status).toBe(403);
    const ok = await patch(w.head, issue, "status", {
      status: "rejected",
      note: "Duplicate of NIV-2026-000001",
      version: 0,
    });
    expect(ok.body.status).toBe("rejected");
  });

  it("is 400 INVALID_TRANSITION for an edge that doesn't exist", async () => {
    const issue = await makeIssue(w);
    const res = await patch(w.staff, issue, "status", { status: "resolved", version: 0 });
    expect(res.status).toBe(400);
    expect(code(res)).toBe("INVALID_TRANSITION");
    const closing = await patch(w.staff, issue, "status", { status: "closed", version: 0 });
    expect(code(closing)).toBe("INVALID_TRANSITION");
  });

  it("is 403 for the reporter's own close through the staff route", async () => {
    const issue = await makeIssue(w, { status: "resolved" });
    expect((await patch(w.staff, issue, "status", { status: "closed", version: 0 })).status).toBe(
      403,
    );
  });

  it("is 403 for a citizen, the same 404 out of scope or missing", async () => {
    const issue = await makeIssue(w);
    expect(
      (await patch(w.citizen, issue, "status", { status: "assigned", version: 0 })).status,
    ).toBe(403);
    const other = await patch(w.waterStaff, issue, "status", { status: "assigned", version: 0 });
    const missing = await as(app, w.staff)
      .patch("/api/issues/NIV-2026-999999/status")
      .send({ status: "assigned", version: 0 });
    expect(other.status).toBe(404);
    expect(other.body).toEqual(missing.body);
    const otherCity = await patch(w.admin2, issue, "status", { status: "assigned", version: 0 });
    expect(otherCity.status).toBe(404);
  });

  it("is 409 CONFLICT for a stale version, and only one of two racing writes wins", async () => {
    const issue = await makeIssue(w);
    const stale = await patch(w.staff, issue, "status", { status: "assigned", version: 7 });
    expect(stale.status).toBe(409);
    expect(code(stale)).toBe("CONFLICT");

    const body = { status: "assigned", version: 0 };
    const answers = await Promise.all([
      patch(w.staff, issue, "status", body),
      patch(w.head, issue, "status", body),
    ]);
    expect(answers.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await AuditLog.countDocuments({ action: "issue.status_change" })).toBe(1);
    expect(await Notification.countDocuments()).toBe(1);
  });

  it("refuses unknown keys and a missing version", async () => {
    const issue = await makeIssue(w);
    const extra = await patch(w.staff, issue, "status", {
      status: "assigned",
      version: 0,
      departmentId: String(w.water._id),
    });
    expect(code(extra)).toBe("VALIDATION_ERROR");
    expect(code(await patch(w.staff, issue, "status", { status: "assigned" }))).toBe(
      "VALIDATION_ERROR",
    );
  });
});

describe("PATCH /api/issues/:ticketId/assign", () => {
  const triage = () => makeIssue(w, { departmentId: null, queue: "triage", category: "other" });

  it("moves a triage issue to a department of the same city, as assigned", async () => {
    const issue = await triage();
    const res = await patch(w.admin, issue, "assign", {
      departmentId: String(w.water._id),
      version: 0,
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: "assigned",
      queue: "department",
      department: { id: String(w.water._id), name: "Water" },
      version: 1,
    });
    expect(await AuditLog.countDocuments({ action: "issue.assign" })).toBe(1);
    expect(await Notification.countDocuments({ userId: w.reporter._id })).toBe(1);
  });

  it("is 404 for another city's department, or a triage issue outside the actor's scope", async () => {
    const issue = await triage();
    const foreign = await patch(w.admin, issue, "assign", {
      departmentId: String(w.roads2._id),
      version: 0,
    });
    expect(foreign.status).toBe(404);
    const head = await patch(w.head, issue, "assign", {
      departmentId: String(w.roads._id),
      version: 0,
    });
    expect(head.status).toBe(404); // a dept_head's scope is their department; triage isn't in it
  });

  it("is 400 INVALID_TRANSITION for an issue that already has a department", async () => {
    const issue = await makeIssue(w);
    const res = await patch(w.admin, issue, "assign", {
      departmentId: String(w.water._id),
      version: 0,
    });
    expect(code(res)).toBe("INVALID_TRANSITION");
  });

  it("is 403 for staff, 409 for a stale version", async () => {
    const issue = await triage();
    const body = { departmentId: String(w.roads._id), version: 0 };
    expect((await patch(w.staff, issue, "assign", body)).status).toBe(403);
    expect((await patch(w.admin, issue, "assign", { ...body, version: 3 })).status).toBe(409);
  });

  it("PATCH status to assigned on a triage issue says to assign instead", async () => {
    const issue = await triage();
    const res = await patch(w.admin, issue, "status", { status: "assigned", version: 0 });
    expect(code(res)).toBe("INVALID_TRANSITION");
  });
});
