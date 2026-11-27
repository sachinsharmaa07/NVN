// Email outbox: notification rows written in the business transaction are mailed afterwards.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useTestDb } from "../helpers/testDb.js";
import { makeIssue, seedIssueWorld } from "../helpers/issueWorld.js";

const sendEmail = vi.fn();
vi.mock("../../src/services/emailService.js", () => ({ sendEmail, emailEnabled: () => true }));

const { drainEmails, MAX_ATTEMPTS } = await import("../../src/services/emailOutboxService.js");
const { notify } = await import("../../src/services/notificationService.js");
const { Notification } = await import("../../src/models/Notification.js");
const { User } = await import("../../src/models/User.js");

useTestDb();

let w;
let issue;
beforeEach(async () => {
  sendEmail.mockReset();
  w = await seedIssueWorld();
  issue = await makeIssue(w, { status: "assigned" });
});

describe("drainEmails", () => {
  it("emails each new notification once, to the user's address, in their language", async () => {
    await User.updateOne({ _id: w.reporter._id }, { preferredLanguage: "hi" });
    await notify([w.reporter._id], "status_changed", issue);
    expect(await drainEmails()).toEqual({ sent: 1, failed: 0, skipped: 0 });
    expect(await drainEmails()).toEqual({ sent: 0, failed: 0, skipped: 0 }); // never twice
    const [mail] = sendEmail.mock.calls[0];
    expect(mail.to).toBe(w.reporter.email);
    expect(mail.subject).toBe(`${issue.ticketId} अब सौंपी गई है`);
    expect((await Notification.findOne().lean()).emailedAt).toBeInstanceOf(Date);
  });

  it("retries a failed send, then gives up after MAX_ATTEMPTS", async () => {
    sendEmail.mockRejectedValue(Object.assign(new Error("down"), { code: "ECONNECTION" }));
    await notify([w.reporter._id], "status_changed", issue);
    for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
      expect(await drainEmails()).toMatchObject({ failed: 1 });
    }
    expect(await drainEmails()).toMatchObject({ failed: 0, sent: 0 });
    expect(sendEmail).toHaveBeenCalledTimes(MAX_ATTEMPTS);
  });

  it("never mails a suspended user or an unverified address", async () => {
    await User.updateOne({ _id: w.citizen._id }, { emailVerified: false });
    await User.collection.updateOne({ _id: w.reporter._id }, { $set: { status: "suspended" } });
    await notify([w.reporter._id, w.citizen._id], "status_changed", issue);
    expect(await drainEmails()).toEqual({ sent: 0, failed: 0, skipped: 2 });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("does not mail old notifications when email is first turned on", async () => {
    await notify([w.reporter._id], "status_changed", issue);
    const later = new Date(Date.now() + 25 * 3600_000);
    expect(await drainEmails({ now: later })).toEqual({ sent: 0, failed: 0, skipped: 0 });
  });
});
