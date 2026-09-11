/*
 * Sends the sign-in link through Resend. With no RESEND_API_KEY the link is
 * written to the server log instead, which is fine locally and useless in
 * production — so /api/auth/request refuses to run in production without it.
 */
export async function sendLoginLink(to, link) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`\n[dev] sign-in link for ${to}:\n${link}\n`);
    return { dev: true };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || "Directory <onboarding@resend.dev>",
      to,
      subject: "Your sign-in link",
      text: `Sign in to the Shopify app vendor's toolkit:\n\n${link}\n\nThe link works once and expires in 15 minutes. If you did not ask for it, ignore this email.`,
    }),
  });
  if (!res.ok) throw new Error(`resend ${res.status}: ${await res.text()}`);
  return { sent: true };
}

/*
 * Generic sender. Throws on failure — callers decide whether that matters.
 * Without RESEND_API_KEY it logs and reports itself as a dev no-op, matching
 * sendLoginLink above so local development needs no mail account.
 */
export async function sendMail({ to, subject, text }) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "Directory <onboarding@resend.dev>";
  if (!key) {
    console.log(`\n[dev] email to ${Array.isArray(to) ? to.join(", ") : to}: ${subject}\n${text}\n`);
    return { dev: true };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ from, to, subject, text }),
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
  const from = process.env.EMAIL_FROM || "Directory <onboarding@resend.dev>";
  if (!key) {
    console.log(`\n[dev] batch of ${messages.length} emails, not sent\n`);
    return { dev: true, sent: messages.length };
  }
  const res = await fetch("https://api.resend.com/emails/batch", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify(messages.map((m) => ({ from, to: [m.to], subject: m.subject, text: m.text }))),
  });
  if (!res.ok) throw new Error(`resend batch ${res.status}: ${await res.text()}`);
  return { sent: messages.length };
}
