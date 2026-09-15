import { read, write, KEYS } from "@/lib/store";
import { allow, ipOf } from "@/lib/ratelimit";
import { CATEGORIES, RESOURCE_KINDS, kindOf } from "@/lib/tools";
import { notifyAdmin } from "@/lib/notify";
import { renderEmail, sendMail } from "@/lib/email";
import { background } from "@/lib/background";
import { isEmail, normaliseEmail } from "@/lib/auth";

export const dynamic = "force-dynamic";

const clean = (s, max) => String(s || "").replace(/\s+/g, " ").trim().slice(0, max);

/*
 * MODERATE_SUGGESTIONS=true holds new entries back with approved:false, so they
 * are stored but not served by /api/data. Flip an entry by hand in Redis, or
 * leave the flag off and accept that you will prune.
 */
export async function POST(request) {
  const ip = ipOf(request);
  if (!(await allow("suggest", ip, 3, 60 * 60_000))) {
    return new Response("Suggestion limit reached for this hour.", { status: 429 });
  }
  const body = await request.json();
  const name = clean(body.name, 60);
  if (!name) return new Response("Name required", { status: 400 });

  const url = clean(body.url, 200);
  if (url && !/^https?:\/\/[^\s]+\.[^\s]+$/.test(url)) {
    return new Response("That URL does not look right", { status: 400 });
  }

  const moderate = process.env.MODERATE_SUGGESTIONS === "true";
  const suggestions = await read(KEYS.suggestions, []);
  const entry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name,
    url,
    kind: RESOURCE_KINDS.some((k) => k.id === body.kind) ? body.kind : "tool",
    cat: CATEGORIES.some((c) => c.id === body.cat) ? body.cat : CATEGORIES[0].id,
    why: clean(body.why, 600),
    by: clean(body.by, 40) || "Anonymous",
    // Optional. Only used to thank them and to ask a follow-up if the entry is thin.
    email: isEmail(normaliseEmail(body.email)) ? normaliseEmail(body.email) : "",
    date: new Date().toISOString().slice(0, 10),
    approved: moderate ? false : true,
  };
  const next = [entry, ...suggestions].slice(0, 500);
  await write(KEYS.suggestions, next);

  const origin = new URL(request.url).origin;

  // Deliberately not awaited. See lib/notify.js.
  notifyAdmin(`New suggestion: ${entry.name}`, [
    `Kind: ${kindOf(entry.kind).label}`,
    entry.kind === "tool" ? `Category: ${CATEGORIES.find((c) => c.id === entry.cat)?.label || entry.cat}` : "",
    `By: ${entry.by}`,
    entry.url ? `URL: ${entry.url}` : "No URL given",
    entry.why ? `\nWhy:\n${entry.why}` : "",
    entry.approved === false
      ? "\nAwaiting approval — it is stored but not public. Approve it at /admin."
      : "\nLive now. Moderation is off, so it is already public.",
    entry.email ? `Reply-to: ${entry.email}` : "No email given, so they cannot be thanked or chased.",
  ], { origin, event: "suggestion" });

  if (entry.email) {
    const { html, text } = renderEmail({
      heading: "Thanks for the suggestion",
      paragraphs: [
        `You suggested ${entry.name}${entry.url ? ` (${entry.url})` : ""} for ${kindOf(entry.kind).label.toLowerCase()}.`,
        entry.why ? `You said: \u201c${entry.why}\u201d` : "",
        "It goes in after a check \u2014 we read the vendor's own site before writing an entry, and anything we cannot confirm there is marked unverified rather than published as fact. That takes a little time, so it will not appear immediately.",
        "Nothing else happens with your address. It is not added to the mailing list.",
      ],
      button: { label: "Browse the directory", url: origin },
    });
    background(sendMail({ to: entry.email, subject: `Thanks for suggesting ${entry.name}`, text, html }), "suggestion-thank-you");
  }

  // The email is for the editor only, never served back to the page.
  const publicOf = ({ email, ...rest }) => rest;
  return Response.json({ suggestions: next.filter((s) => s.approved !== false).map(publicOf) });
}
