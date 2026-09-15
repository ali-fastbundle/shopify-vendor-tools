/*
 * Everything that leaves the app by email.
 *
 * One shell, one place. `renderEmail` returns the HTML and the plain-text
 * alternative together so a caller cannot send one without the other — every
 * message goes out as multipart, and the text half is written to be read, not
 * to satisfy a spam filter.
 *
 * Tables and inline styles throughout, because that is still what mail clients
 * render reliably. No external CSS, no web fonts, no images.
 */
import { CATEGORIES } from "./tools";

const SITE = "watchfor.tools";
const INK = "#06110D";
const ACCENT = "#00583F";
const MARK_GREEN = "#00E08A";

const FOOTER = `${SITE} — an independent directory of tools for Shopify app vendors`;

const esc = (s) => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const from = () => process.env.EMAIL_FROM || "Watch For Tools <onboarding@resend.dev>";

/*
 * Replies go to the first ADMIN_EMAILS address. The subscribe copy tells people
 * they can reply to get off the list, and the from-address has no inbox behind
 * it, so without this that promise is a dead end.
 */
export const replyTo = () =>
  (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim()).filter(Boolean)[0] || null;

/* The same mark as the site header: the category colours, in catalogue order. */
const wordmark = () => {
  const bars = CATEGORIES.map((c) =>
    `<td width="4" height="17" style="background:${c.color};border-radius:2px;font-size:0;line-height:0">&nbsp;</td>
     <td width="2" style="font-size:0;line-height:0">&nbsp;</td>`).join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
    ${bars}
    <td style="padding-left:6px;font-family:Helvetica,Arial,sans-serif;font-size:18px;font-weight:bold;letter-spacing:-0.5px;color:#ffffff;white-space:nowrap">Watch For <span style="color:${MARK_GREEN}">Tools</span></td>
  </tr></table>`;
};

/**
 * Build one email. Returns { html, text }.
 *
 * heading     short line at the top of the white panel
 * paragraphs  array of strings, or [label, url] pairs rendered as a link line
 * button      { label, url } — at most one, because a mail with two equal
 *             calls to action has none
 * unsubscribe absolute URL; adds the opt-out line to both halves
 */
export function renderEmail({ heading, paragraphs = [], button, unsubscribe }) {
  const body = paragraphs.filter(Boolean).map((p) =>
    `<p style="margin:0 0 14px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#20302a">${esc(p)}</p>`
  ).join("");

  const cta = button ? `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 6px">
      <tr><td style="background:${ACCENT};border-radius:8px">
        <a href="${esc(button.url)}" style="display:inline-block;padding:12px 22px;font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none">${esc(button.label)}</a>
      </td></tr>
    </table>
    <p style="margin:10px 0 0;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;color:#6b7c74">If the button does not work, paste this in: <br><span style="color:#20302a">${esc(button.url)}</span></p>` : "";

  const unsub = unsubscribe ? `<br><a href="${esc(unsubscribe)}" style="color:#6b7c74">Unsubscribe</a>` : "";

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f1f4f2">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f4f2">
    <tr><td align="center" style="padding:24px 12px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;border-radius:12px;overflow:hidden;border:1px solid #dfe6e2">
        <tr><td style="background:${INK};padding:18px 24px">${wordmark()}</td></tr>
        <tr><td style="background:#ffffff;padding:26px 24px 28px">
          ${heading ? `<h1 style="margin:0 0 14px;font-family:Helvetica,Arial,sans-serif;font-size:20px;line-height:1.3;color:${INK}">${esc(heading)}</h1>` : ""}
          ${body}
          ${cta}
        </td></tr>
        <tr><td style="background:#ffffff;border-top:1px solid #e7ede9;padding:16px 24px 20px;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.55;color:#6b7c74">
          ${esc(FOOTER)}${unsub}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const text = [
    heading || "",
    heading ? "" : null,
    ...paragraphs.filter(Boolean),
    button ? `\n${button.label}:\n${button.url}` : null,
    "",
    "—",
    FOOTER,
    unsubscribe ? `Unsubscribe: ${unsubscribe}` : null,
  ].filter((l) => l !== null).join("\n").replace(/\n{3,}/g, "\n\n").trim();

  return { html, text };
}

/*
 * Resend refuses to send in two configuration states that look identical to a
 * user and nothing like each other in the logs:
 *
 *  - no verified domain, so the account may only mail its own owner ("you can
 *    only send testing emails to your own email address")
 *  - a `from` address on a domain that has not been verified
 *
 * Both mean the same thing to whoever is trying to sign in — the deployment is
 * not finished — and both are worth saying out loud instead of "could not send
 * the email". Matched on the error text because Resend signals these through
 * the message body rather than a stable code.
 */
const RESTRICTED = [
  /only send testing emails/i,
  /verify a domain/i,
  /not verified/i,
  /resend\.com\/domains/i,
  /domain_not_verified/i,
];

export const isSendingRestricted = (message) =>
  RESTRICTED.some((re) => re.test(String(message || "")));

/*
 * The only place this app talks to Resend for a single message.
 *
 * Throws on failure with the Resend body in the message, because that body is
 * where Resend puts the reason. lib/mail.js is what catches it; nothing else
 * should call this directly. The timeout bounds how long a user's request can
 * wait on the mail provider, now that sends are awaited.
 */
export async function resendSend({ to, subject, text, html }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`\n[dev] email to ${Array.isArray(to) ? to.join(", ") : to}: ${subject}\n${text}\n`);
    return { dev: true };
  }
  const reply = replyTo();
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: from(), to, subject, text,
      ...(html ? { html } : {}),
      ...(reply ? { reply_to: reply } : {}),
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`resend ${res.status}: ${await res.text()}`);
  return { sent: true };
}

/*
 * Resend's batch endpoint: one request, up to 100 distinct messages. Distinct
 * matters — every recipient gets their own unsubscribe link, so these cannot
 * be collapsed into one message with many addresses in `to` (which would also
 * show every subscriber to every subscriber).
 */
export const BATCH_MAX = 100;

export async function sendBatch(messages) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`\n[dev] batch of ${messages.length} emails, not sent\n`);
    return { dev: true, sent: messages.length };
  }
  const reply = replyTo();
  const res = await fetch("https://api.resend.com/emails/batch", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify(messages.map((m) => ({
      from: from(), to: [m.to], subject: m.subject, text: m.text,
      ...(m.html ? { html: m.html } : {}),
      ...(reply ? { reply_to: reply } : {}),
    }))),
  });
  if (!res.ok) throw new Error(`resend batch ${res.status}: ${await res.text()}`);
  return { sent: messages.length };
}
