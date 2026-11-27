import { describe, it, expect } from "vitest";
import { escapeHtml, renderNotificationEmail } from "../../src/services/emailTemplates.js";

const base = {
  name: "Asha",
  title: "Deep pothole <near> the bus stand",
  expectedBy: "2026-12-03T11:30:00.000Z",
  appUrl: "http://localhost:5173",
};

describe("renderNotificationEmail", () => {
  it("builds an English status email with a link to the ticket", () => {
    const mail = renderNotificationEmail(
      { type: "status_changed", ticketId: "NIV-2026-000042", status: "in_progress" },
      base,
    );
    expect(mail.subject).toBe("NIV-2026-000042 is now In progress");
    expect(mail.html).toContain('href="http://localhost:5173/issues/NIV-2026-000042"');
    expect(mail.html).toContain("Expected by 3 Dec");
    expect(mail.text).toContain("Track this issue: http://localhost:5173/issues/NIV-2026-000042");
  });

  it("escapes the issue title, so a title can't inject markup", () => {
    const mail = renderNotificationEmail(
      { type: "status_changed", ticketId: "NIV-2026-000042", status: "assigned" },
      base,
    );
    expect(mail.html).toContain("Deep pothole &lt;near&gt; the bus stand");
    expect(mail.html).not.toContain("<near>");
  });

  it("writes Hindi for a Hindi user and links staff emails to the queue", () => {
    const mail = renderNotificationEmail(
      { type: "sla_breached", ticketId: "NIV-2026-000042", status: "in_progress" },
      { ...base, lang: "hi" },
    );
    expect(mail.subject).toBe("NIV-2026-000042 की समय-सीमा निकल गई है");
    expect(mail.html).toContain('lang="hi"');
    expect(mail.html).toContain('href="http://localhost:5173/staff"');
  });

  it("leaves out the due date once an issue is resolved, and greets without a name", () => {
    const mail = renderNotificationEmail(
      { type: "status_changed", ticketId: "NIV-2026-000042", status: "resolved" },
      { ...base, name: "" },
    );
    expect(mail.text).not.toContain("Expected by");
    expect(mail.text.startsWith("Hello,")).toBe(true);
  });

  it("escapeHtml covers the five HTML characters", () => {
    expect(escapeHtml(`<a href="x" title='y'>&</a>`)).toBe(
      "&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;",
    );
  });
});
