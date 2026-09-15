/*
 * Every email this app sends, in one place.
 *
 * The history worth knowing: sends used to be scattered across the routes, each
 * one a bare promise nobody waited on. On Vercel a function is frozen when it
 * returns, so those promises were not slow, they were unfinished — and because
 * nothing rejected, they left no trace. The symptom was an admin test button
 * that worked and real events that silently did not.
 *
 * So the rules here are deliberate:
 *
 *  1. One entry point. Routes call sendEvent() once and never touch Resend.
 *  2. Everything is awaited. A few hundred milliseconds on a request is the
 *     price of delivery that actually happens, and it is worth paying. The
 *     transport's 8s timeout bounds the worst case.
 *  3. Nothing throws at the caller. A mail failure must never turn a stored
 *     suggestion into a 500 someone sees.
 *  4. Every attempt is logged to svt:maillog and to the console, success or
 *     failure. Silence is the bug; this is how it stays fixed.
 */
import { renderEmail, resendSend } from "./email";
import { pushMailLog } from "./store";
import { unsubLink } from "./subscribers";

const SITE = "watchfor.tools";

export const adminList = () =>
  (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim()).filter(Boolean);

/*
 * Half-configured is worse than unconfigured: one of these without the other
 * looks deliberate and behaves like nothing. Said once per instance at import.
 */
(function warnOnMisconfiguration() {
  const key = Boolean(process.env.RESEND_API_KEY);
  const admins = adminList().length;
  if (key && !admins) console.warn("[mail] RESEND_API_KEY is set but ADMIN_EMAILS is empty. No admin mail can be delivered.");
  else if (!key && admins) console.warn("[mail] ADMIN_EMAILS is set but RESEND_API_KEY is missing. No mail can be delivered.");
})();

const adminButton = (origin) => (origin ? { label: "Open the admin console", url: `${origin}/admin` } : undefined);
const siteButton = (origin, label = "Open the directory") => (origin ? { label, url: origin } : undefined);

/*
 * The matrix. Each event declares who hears about it.
 *
 *   admin(data) -> { subject, paragraphs, button } | null
 *   user(data)  -> { to, subject, paragraphs, button, unsubscribe } | null
 *
 * A user block returning null is how "only if they gave us an address" is
 * expressed — suggestions and reports are open to signed-out visitors, so the
 * absence of an address is normal and must never fail anything.
 */
const MATRIX = {
  /* A first-ever sign-in. Tell the admin, welcome the person. */
  signin_new: {
    admin: (d) => ({
      subject: `New account: ${d.email}`,
      paragraphs: [`${d.email} signed in for the first time.`, "Nothing is stored beyond the address and when they signed in."],
      button: adminButton(d.origin),
    }),
    user: (d) => ({
      to: d.email,
      subject: `Welcome to ${SITE}`,
      paragraphs: [
        "You are signed in. If you build one of the tools listed here, you can now claim its listing and edit how it is described: the summary, description, pricing and links.",
        "The editorial parts stay ours — the “watch for” caveat, the category, the external ratings. That line is the reason the directory is worth reading.",
        "We keep your email address and when you signed in. Nothing else.",
      ],
      button: siteButton(d.origin),
    }),
  },

  /* A returning sign-in is not news to anyone. */
  signin_return: { admin: () => null, user: () => null },

  /* The magic link itself. No admin copy; a sign-in attempt is not an event. */
  signin_link: {
    admin: () => null,
    user: (d) => ({
      to: d.email,
      subject: `Your sign-in link for ${SITE}`,
      paragraphs: [
        "Signing in lets you claim a listing you own and edit how your tool is described — its summary, description, pricing and links.",
        "The editorial notes stay ours: the “watch for” caveat, the category and the ratings are not editable by a vendor, and that is deliberate.",
        "This link works once and expires in 15 minutes.",
        "If you did not ask for it, ignore this email. Nothing happens until the link is opened.",
      ],
      button: { label: "Sign in", url: d.link },
    }),
  },

  subscribe: {
    admin: (d) => ({
      subject: "New newsletter signup",
      paragraphs: [`Address: ${d.email}`, "They have been sent the confirmation and can unsubscribe from it."],
      button: adminButton(d.origin),
    }),
    user: (d) => ({
      to: d.email,
      subject: "You're on the list",
      paragraphs: [
        "You will get one email when new tools go into the directory or a new section opens. That is the whole thing — no newsletter, no weekly digest, no pitch at the bottom. If neither happens, you hear nothing.",
        "Your address is not shared or sold, and it is not passed to any tool listed in the directory.",
        "You can unsubscribe with the link below, or just reply to this email and ask.",
      ],
      button: siteButton(d.origin, "Browse the directory"),
      unsubscribe: d.origin ? unsubLink(d.origin, d.email) : undefined,
    }),
  },

  /* A rating with no text is the same event as a review. */
  review: {
    admin: (d) => ({
      subject: `${d.rating}★ review of ${d.toolName}`,
      paragraphs: [
        `Tool: ${d.toolName}`,
        `Rating: ${d.rating} out of 5`,
        `By: ${d.author || "Anonymous"}`,
        d.text ? `Wrote: ${d.text}` : "No text, rating only.",
      ],
      button: adminButton(d.origin),
    }),
    // Only a signed-in visitor has an address; the form never asks for one.
    user: (d) => (d.email ? {
      to: d.email,
      subject: `Thanks for reviewing ${d.toolName}`,
      paragraphs: [
        `Your ${d.rating}-star review of ${d.toolName} is live on its listing.`,
        "Reviews from people who have actually used a tool are the part of this directory we cannot write ourselves, so thank you.",
        "They are shown separately from any external scores, and the two are never averaged together.",
      ],
      button: siteButton(d.origin, `See the ${d.toolName} listing`),
    } : null),
  },

  claim_verified: {
    admin: (d) => ({
      subject: `Listing claimed: ${d.toolName}`,
      paragraphs: [
        `Tool: ${d.toolName} (${d.domain})`,
        `Claimed by: ${d.email}`,
        d.method === "email-domain"
          ? "Method: email domain — their address is already on the tool's own domain."
          : `Method: published token${d.via ? ` — found at ${d.via}` : ""}`,
        "They can now edit the listing. Revoke it at /admin if that is wrong.",
      ],
      button: adminButton(d.origin),
    }),
    user: (d) => ({
      to: d.email,
      subject: `You now manage the ${d.toolName} listing`,
      paragraphs: [
        `Ownership of ${d.toolName} is verified, so you can edit how it is described.`,
        "You control: the one-line summary, the description, the pricing, the site URL and the social profiles.",
        "You cannot change the “watch for” note, the category, the verified badge, the external ratings or the community reviews. Those are editorial, and keeping them out of vendors' hands is what makes the directory worth reading.",
        "Edits go live immediately and are marked on the listing as vendor-maintained.",
      ],
      button: siteButton(d.origin, "Edit your listing"),
    }),
  },

  suggestion: {
    admin: (d) => ({
      subject: `New suggestion: ${d.name}`,
      paragraphs: [
        `Kind: ${d.kindLabel}`,
        d.catLabel ? `Category: ${d.catLabel}` : "",
        `By: ${d.by || "Anonymous"}`,
        d.url ? `URL: ${d.url}` : "No URL given",
        d.why ? `Why: ${d.why}` : "",
        d.approved === false
          ? "Awaiting approval — stored but not public."
          : "Live now. Moderation is off, so it is already public.",
        d.email ? `Reply-to: ${d.email}` : "No email given, so they cannot be thanked or chased.",
      ],
      button: adminButton(d.origin),
    }),
    user: (d) => (d.email ? {
      to: d.email,
      subject: `Thanks for suggesting ${d.name}`,
      paragraphs: [
        `You suggested ${d.name}${d.url ? ` (${d.url})` : ""}.`,
        d.why ? `You said: “${d.why}”` : "",
        "It goes in after a check — we read the vendor's own site before writing an entry, and anything we cannot confirm there is marked unverified rather than published as fact. That takes a little time.",
        "Nothing else happens with your address. It is not added to the mailing list.",
      ],
      button: siteButton(d.origin, "Browse the directory"),
    } : null),
  },

  report: {
    admin: (d) => ({
      subject: `Report on ${d.toolName}: ${d.kindLabel}`,
      paragraphs: [
        `Tool: ${d.toolName} (${d.domain})`,
        `Problem: ${d.kindLabel}`,
        d.value ? `They say: ${d.value}` : "No detail given.",
        d.email ? `From: ${d.email}` : "No email given.",
        "Nothing has changed on the listing. Reports are a queue, not an edit.",
      ],
      button: adminButton(d.origin),
    }),
    user: (d) => (d.email ? {
      to: d.email,
      subject: `Thanks for the report on ${d.toolName}`,
      paragraphs: [
        `You told us about ${d.toolName}: ${d.kindLabel.toLowerCase()}.`,
        d.value ? `You sent: ${d.value}` : "",
        "It goes to the editor, not the vendor, and nothing is applied automatically. A social profile only gets added once it can be confirmed on the company's own site.",
      ],
      button: siteButton(d.origin, "Browse the directory"),
    } : null),
  },

  /*
   * Not in the original matrix, kept because deleting a working notification
   * during a refactor is a silent loss. Admin only: the vendor made the edit,
   * so telling them about it is telling them what they just did.
   */
  listing_edited: {
    admin: (d) => ({
      subject: `${d.toolName} listing edited by ${d.email}`,
      paragraphs: [
        `Tool: ${d.toolName}`,
        `Edited by: ${d.email}${d.byAdmin ? " (admin, not the owner)" : ""}`,
        `Fields changed: ${(d.changed || []).join(", ")}`,
        ...(d.values || []),
      ],
      button: adminButton(d.origin),
    }),
    user: () => null,
  },
};

export const EVENTS = Object.keys(MATRIX);

/* One message out, with its own try/catch so one failure cannot hide another. */
async function deliver({ event, cls, to, subject, paragraphs, button, unsubscribe }) {
  const at = new Date().toISOString();
  try {
    if (!to || (Array.isArray(to) && !to.length)) {
      return { event, cls, to: "", ok: false, error: "no recipient", at, skipped: true };
    }
    const { html, text } = renderEmail({ heading: subject, paragraphs, button, unsubscribe });
    await resendSend({ to, subject, text, html });
    console.log(`[mail] ${event} -> ${cls}: ok`);
    return { event, cls, to: Array.isArray(to) ? to.join(", ") : to, ok: true, at };
  } catch (e) {
    const error = e?.name === "TimeoutError" ? "timed out after 8s waiting for Resend" : String(e?.message || e);
    console.error(`[mail] ${event} -> ${cls}: FAILED — ${error}`);
    return { event, cls, to: Array.isArray(to) ? to.join(", ") : to, ok: false, error, at };
  }
}

/**
 * sendEvent(event, data) — the only way this app sends mail.
 *
 * Awaited by callers. Never throws. Returns
 *   { event, ok, sends: [{ cls, to, ok, error }] }
 * where ok is false if any attempted send failed. A send that was never
 * attempted (no admin configured, no user address) is not a failure.
 */
export async function sendEvent(event, data = {}) {
  const spec = MATRIX[event];
  if (!spec) {
    console.error(`[mail] unknown event "${event}" — nothing sent`);
    return { event, ok: false, sends: [], error: "unknown event" };
  }

  const sends = [];
  try {
    const admin = spec.admin(data);
    if (admin) {
      const to = data.adminOverride ? [data.adminOverride] : adminList();
      if (to.length) sends.push(await deliver({ event, cls: "admin", to, ...admin }));
      else console.warn(`[mail] ${event} -> admin: not sent — ADMIN_EMAILS is unset`);
    }

    const user = spec.user(data);
    // Absent by design for signed-out suggestions and reports. Not an error.
    if (user && user.to) sends.push(await deliver({ event, cls: "user", ...user }));

    await pushMailLog(sends);
  } catch (e) {
    // Only reachable if a matrix function itself throws on malformed data.
    console.error(`[mail] ${event}: dispatch FAILED — ${e?.message || e}`);
    sends.push({ event, cls: "dispatch", to: "", ok: false, error: String(e?.message || e), at: new Date().toISOString() });
    await pushMailLog(sends.slice(-1));
  }

  return { event, ok: sends.every((s) => s.ok), sends };
}
