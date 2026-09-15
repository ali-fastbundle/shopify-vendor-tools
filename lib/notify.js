/*
 * Admin notifications, through the same Resend account that sends sign-in links.
 *
 * Two rules, both load-bearing:
 *
 *  1. This never throws. Every path is inside the try, including reading env and
 *     building the request, so a caller can treat it as fire-and-forget.
 *  2. Callers do not await it. A notification is not worth a second of someone
 *     else's request, and Resend being slow or down must not turn a successful
 *     suggestion into a failed one. Failures land in the server log.
 *
 * No-ops when RESEND_API_KEY or ADMIN_EMAILS is unset, which is the normal
 * state locally — so there is nothing to configure to run the app.
 *
 * One email per event. Nothing is batched or digested: a notification that
 * arrives an hour late, bundled with four others, is one nobody acts on.
 */
import { renderEmail, replyTo } from "./email";

const adminList = () =>
  (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim()).filter(Boolean);

/**
 * notifyAdmin(subject, lines, { origin })
 *
 * `origin` turns the console link into the mail's button. It is optional only
 * because a caller without a request cannot know it; pass it wherever you can.
 */
export async function notifyAdmin(subject, lines = [], { origin } = {}) {
  try {
    const key = process.env.RESEND_API_KEY;
    const to = adminList();
    if (!key || !to.length) return { skipped: true };

    const { html, text } = renderEmail({
      heading: subject,
      paragraphs: (lines || []).filter(Boolean).map((l) => String(l).replace(/^\n+/, "")),
      button: origin ? { label: "Open the admin console", url: `${origin}/admin` } : undefined,
    });

    const reply = replyTo();
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "Watch For Tools <onboarding@resend.dev>",
        to, subject, text, html,
        ...(reply ? { reply_to: reply } : {}),
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`resend ${res.status}: ${await res.text()}`);
    return { sent: true };
  } catch (e) {
    console.error("notifyAdmin failed:", subject, e.message);
    return { failed: true };
  }
}
