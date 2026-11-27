// POST /api/chat (M3 step 3). Gemini is mocked: ticket answers must come from the DB, never the model.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useFakeAuth0 } from "../helpers/authSeam.js";
import { useTestDb } from "../helpers/testDb.js";
import { as, makeIssue, seedIssueWorld } from "../helpers/issueWorld.js";

vi.mock("../../src/middleware/auth.js", async (orig) =>
  (await import("../helpers/authSeam.js")).authModule(await orig()),
);
const askGemini = vi.fn();
vi.mock("../../src/services/geminiService.js", () => ({ askGemini, geminiEnabled: () => true }));

const { createApp } = await import("../../src/app.js");

useTestDb();
useFakeAuth0();
const app = createApp();

let w;
let issue;
beforeEach(async () => {
  askGemini.mockReset();
  w = await seedIssueWorld();
  issue = await makeIssue(w);
});

const ask = (user, message) => as(app, user).post("/api/chat").send({ message });

describe("POST /api/chat", () => {
  it("answers the reporter's own ticket from the database, with its department", async () => {
    const res = await ask(w.reporter, `where is ${issue.ticketId.toLowerCase()}?`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      kind: "ticket",
      unknown: [],
      tickets: [{ ticketId: issue.ticketId, status: "submitted", department: "Roads" }],
    });
    expect(askGemini).not.toHaveBeenCalled();
  });

  it("treats someone else's ticket exactly like a missing one", async () => {
    const theirs = await ask(w.citizen, `status ${issue.ticketId}`);
    const missing = await ask(w.citizen, "status NIV-2026-999999");
    expect(theirs.body).toEqual({ kind: "ticket", tickets: [], unknown: [issue.ticketId] });
    expect(missing.body).toEqual({ kind: "ticket", tickets: [], unknown: ["NIV-2026-999999"] });
  });

  it("lets staff read a ticket in their department, not another department's", async () => {
    expect((await ask(w.staff, issue.ticketId)).body.tickets).toHaveLength(1);
    expect((await ask(w.waterStaff, issue.ticketId)).body.tickets).toHaveLength(0);
  });

  it("lists the asker's last tickets for 'my complaints'", async () => {
    const res = await ask(w.reporter, "show my complaints");
    expect(res.body.kind).toBe("list");
    expect(res.body.tickets.map((t) => t.ticketId)).toEqual([issue.ticketId]);
  });

  it("sends general questions to Gemini with contact details removed", async () => {
    askGemini.mockResolvedValue("Pick the closest category and add a photo.");
    const res = await ask(w.citizen, "How do I report a pothole? I'm on 9876543210");
    expect(res.body).toEqual({
      kind: "general",
      reply: "Pick the closest category and add a photo.",
    });
    expect(askGemini.mock.calls[0][0]).toBe("How do I report a pothole? I'm on [phone]");
  });

  it("falls back when Gemini gives nothing", async () => {
    askGemini.mockResolvedValue(null);
    expect((await ask(w.citizen, "hello")).body).toEqual({ kind: "fallback" });
  });

  it("refuses an empty or oversized message and extra keys", async () => {
    expect((await ask(w.citizen, "   ")).status).toBe(400);
    expect((await ask(w.citizen, "x".repeat(1001))).status).toBe(400);
    const extra = await as(app, w.citizen).post("/api/chat").send({ message: "hi", history: [] });
    expect(extra.status).toBe(400);
  });
});
