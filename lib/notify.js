/*
 * Admin notifications, through the same Resend account that sends sign-in links.
 *
 * Two rules, both load-bearing:
 *
 *  1. This never throws. Every path is inside the try, including reading env and
 *     building the request, so a caller can treat it as fire-and-forget.
 *  2. Callers do not await it. A notification is not worth a second of someone
 *     else's request, and Resend being slow or down must not turn a successful
 *     suggestion into a failed one.
 *
 * What it must NOT do is fail quietly. An earlier version returned
 * `{ skipped: true }` with no log when RESEND_API_KEY or ADMIN_EMAILS was
 * missing, which is exactly the state a misconfigured deployment sits in — so
 * the symptom was silence and the cause was invisible. Every path now says
 * something, and every line is prefixed `[notify]` so it can be grepped out of
 * a Vercel log.
 *
 * One email per event. Nothing is batched or digested.
 */
import { renderEmail, replyTo } from "./email";
import { background } from "./background";

const adminList = () =>
  (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim()).filter(Boolean);

/*
 * Half-configured is worse than unconfigured: one of these set without the
 * other looks deliberate and behaves like nothing. Said once per instance at
 * import, so it appears in the logs of a cold start rather than only when an
 * event happens to fire.
 */
(function warnOnMisconfiguration() {
  const key = Boolean(process.env.RESEND_API_KEY);
  const admins = adminList().length;
  if (key && !admins) {
    console.warn("[notify] RESEND_API_KEY is set but ADMIN_EMAILS is empty. No admin notification can be delivered. Set ADMIN_EMAILS to a comma-separated list.");
  } else if (!key && admins) {
    console.warn("[notify] ADMIN_EMAILS is set but RESEND_API_KEY is missing. No admin notification can be delivered.");
  }
})();

/**
 * notifyAdmin(subject, lines, { origin, event })
 *
 * `origin` turns the console link into the mail's button.
 * `event` names the trigger in the logs — pass it, so a failure line says which
 * of six senders broke rather than only what its subject happened to be.
 *
 * Returns { sent } | { skipped, reason } | { failed, error }. Nothing rejects.
 */
export function notifyAdmin(subject, lines = [], opts = {}) {
  /*
   * Registered with the platform on the way out, so it survives the response
   * being sent. Callers still do not await it and still cannot be broken by it;
   * the returned promise is there for the admin test button, which does await
   * because the result is the thing it exists to report.
   */
  return background(send(subject, lines, opts), `notify:${opts.event || "unknown"}`);
}

async function send(subject, lines = [], { origin, event = "unknown" } = {}) {
  try {
    const key = process.env.RESEND_API_KEY;
    const to = adminList();

    if (!key || !to.length) {
      const reason = !key && !to.length ? "RESEND_API_KEY and ADMIN_EMAILS are both unset"
        : !key ? "RESEND_API_KEY is unset"
        : "ADMIN_EMAILS is unset";
      console.warn(`[notify] ${event}: not sent — ${reason}. Subject was: ${subject}`);
      return { skipped: true, reason };
    }

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

    if (!res.ok) {
      // Resend puts the useful part in the body, not the status.
      const body = await res.text();
      throw new Error(`resend ${res.status}: ${body}`);
    }

    console.log(`[notify] ${event}: sent to ${to.length} admin address${to.length === 1 ? "" : "es"}`);
    return { sent: true, to: to.length };
  } catch (e) {
    const error = e?.name === "TimeoutError"
      ? "timed out after 8s waiting for Resend"
      : String(e?.message || e);
    console.error(`[notify] ${event}: FAILED — ${error}. Subject was: ${subject}`);
    return { failed: true, error };
  }
}
