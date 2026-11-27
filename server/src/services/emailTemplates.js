// Notification emails (decision 6): one layout, English or Hindi by the recipient's preferredLanguage.
// Pure: data in, { subject, html, text } out. Email clients ignore <style> and web fonts, so everything is
// inline styles on tables, with the app's peacock accent and a stamped ticket ID like the counterfoil.
const PEACOCK = "#13697A";
const INK = "#16242B";
const MUTED = "#5B6B73";
const PAPER = "#F4F7F8";

const STATUS = {
  en: {
    submitted: "Submitted",
    assigned: "Assigned",
    in_progress: "In progress",
    resolved: "Resolved",
    closed: "Closed",
    reopened: "Reopened",
    rejected: "Rejected",
  },
  hi: {
    submitted: "दर्ज",
    assigned: "सौंपी गई",
    in_progress: "काम जारी",
    resolved: "हल हुई",
    closed: "बंद",
    reopened: "फिर खोली गई",
    rejected: "अस्वीकृत",
  },
};

// {ticket}, {status} and {date} are filled in; every line is ours, never free text from staff.
const COPY = {
  en: {
    status_changed: ["{ticket} is now {status}", "There's an update on your report."],
    on_hold: [
      "{ticket} is on hold",
      "The department paused work on your report. The deadline pauses too.",
    ],
    resumed: [
      "Work on {ticket} has started again",
      "The department is working on your report again.",
    ],
    sla_breached: [
      "{ticket} is overdue",
      "This issue in your department has passed its fix-by date.",
    ],
    sla_escalated: [
      "{ticket} was escalated to you",
      "This issue is still overdue 24 hours after the department head was told.",
    ],
    sla_respond_overdue: [
      "{ticket} is waiting to be picked up",
      "Nobody has been assigned within the respond-by time.",
    ],
    track: "Track this issue",
    queue: "Open the queue",
    expected: "Expected by {date}",
    hello: "Hello {name},",
    helloAnon: "Hello,",
    footer:
      "You get this email because of your account on Nivaran. Updates also appear under the bell in the app.",
  },
  hi: {
    status_changed: ["{ticket} अब {status} है", "आपकी शिकायत पर नया अपडेट है।"],
    on_hold: ["{ticket} रोका गया है", "विभाग ने आपकी शिकायत पर काम रोका है। समय-सीमा भी रुकी है।"],
    resumed: ["{ticket} पर काम फिर शुरू हो गया है", "विभाग आपकी शिकायत पर फिर से काम कर रहा है।"],
    sla_breached: [
      "{ticket} की समय-सीमा निकल गई है",
      "आपके विभाग की यह शिकायत अपनी तय तारीख पार कर चुकी है।",
    ],
    sla_escalated: [
      "{ticket} आपके पास भेजा गया है",
      "विभाग प्रमुख को बताने के 24 घंटे बाद भी यह शिकायत लंबित है।",
    ],
    sla_respond_overdue: [
      "{ticket} किसी को सौंपे जाने का इंतज़ार कर रहा है",
      "जवाब देने के तय समय में इसे किसी को नहीं सौंपा गया।",
    ],
    track: "शिकायत देखें",
    queue: "कतार खोलें",
    expected: "{date} तक अपेक्षित",
    hello: "नमस्ते {name},",
    helloAnon: "नमस्ते,",
    footer: "आपको यह ईमेल निवारण पर आपके खाते की वजह से मिला है। अपडेट ऐप में घंटी के नीचे भी दिखते हैं।",
  },
};

const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
export const escapeHtml = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );

const dateFormat = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
});

/**
 * @param n   { type, ticketId, status }
 * @param ctx { name, lang, title, expectedBy, appUrl }
 */
export function renderNotificationEmail(n, { name, lang = "en", title, expectedBy, appUrl }) {
  const c = COPY[lang] ?? COPY.en;
  const statusLabel = (STATUS[lang] ?? STATUS.en)[n.status] ?? n.status ?? "";
  const [headline, line] = c[n.type] ?? c.status_changed;
  const vars = { ticket: n.ticketId, status: statusLabel };
  const subject = fill(headline, vars);
  const staff = n.type.startsWith("sla_");
  const link = `${appUrl}${staff ? "/staff" : `/issues/${n.ticketId}`}`;
  const cta = staff ? c.queue : c.track;
  const greet = name ? fill(c.hello, { name }) : c.helloAnon;
  const due =
    expectedBy && !["resolved", "closed", "rejected"].includes(n.status)
      ? fill(c.expected, { date: dateFormat.format(new Date(expectedBy)) })
      : "";

  const text = [
    greet,
    "",
    subject,
    line,
    title ? `"${title}"` : "",
    due,
    "",
    `${cta}: ${link}`,
    "",
    c.footer,
  ]
    .filter((l, i, all) => l !== "" || all[i - 1] !== "")
    .join("\n");

  const e = escapeHtml;
  const html = `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>${e(subject)}</title></head>
<body style="margin:0;padding:0;background:${PAPER};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;font-family:Mukta,'Noto Sans Devanagari',Arial,sans-serif;color:${INK};">
  <tr><td style="padding:0 4px 16px;font-size:20px;font-weight:700;color:${PEACOCK};">निवारण · Nivaran</td></tr>
  <tr><td style="background:#ffffff;border:1px solid #D7E0E3;border-radius:12px;padding:28px 24px;">
    <p style="margin:0 0 16px;font-size:16px;color:${MUTED};">${e(greet)}</p>
    <h1 style="margin:0 0 8px;font-size:22px;line-height:1.3;color:${INK};">${e(subject)}</h1>
    <p style="margin:0 0 20px;font-size:16px;line-height:1.6;">${e(line)}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px dashed #B9C7CC;border-radius:8px;">
      <tr><td style="padding:16px;">
        ${title ? `<p style="margin:0 0 6px;font-size:16px;font-weight:600;">${e(title)}</p>` : ""}
        <p style="margin:0;font-size:26px;font-weight:700;letter-spacing:1px;">${e(n.ticketId)}</p>
        ${statusLabel ? `<p style="margin:10px 0 0;"><span style="display:inline-block;padding:3px 10px;border-radius:999px;background:#E3F1F3;color:${PEACOCK};font-size:14px;font-weight:600;">${e(statusLabel)}</span></p>` : ""}
        ${due ? `<p style="margin:10px 0 0;font-size:14px;color:${MUTED};">${e(due)}</p>` : ""}
      </td></tr>
    </table>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:24px;"><tr>
      <td style="border-radius:8px;background:${PEACOCK};">
        <a href="${e(link)}" style="display:inline-block;padding:12px 22px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;">${e(cta)}</a>
      </td></tr></table>
  </td></tr>
  <tr><td style="padding:16px 4px 0;font-size:13px;line-height:1.5;color:${MUTED};">${e(c.footer)}</td></tr>
</table>
</td></tr></table>
</body></html>`;
  return { subject, html, text };
}
