import { read, write, KEYS } from "@/lib/store";
import { allow, ipOf } from "@/lib/ratelimit";
import { CATEGORIES, RESOURCE_KINDS, kindOf } from "@/lib/tools";
import { entriesOf } from "@/lib/sections";
import { findListed, findDuplicate, mergeDuplicate, timesAsked } from "@/lib/suggestions";
import { sendEvent } from "@/lib/mail";
import { isEmail, normaliseEmail } from "@/lib/auth";

export const dynamic = "force-dynamic";

const clean = (s, max) => String(s || "").replace(/\s+/g, " ").trim().slice(0, max);

// The email is for the editor only, never served back to the page. `also`
// carries submitter emails for the same reason, so it goes too.
const publicOf = ({ email, also, ...rest }) => rest;
const publicList = (list) => list.filter((s) => s.approved !== false).map(publicOf);

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
  const kind = RESOURCE_KINDS.some((k) => k.id === body.kind) ? body.kind : "tool";
  const submission = {
    name,
    url,
    kind,
    cat: CATEGORIES.some((c) => c.id === body.cat) ? body.cat : CATEGORIES[0].id,
    why: clean(body.why, 600),
    by: clean(body.by, 40) || "Anonymous",
    // Optional. Only used to thank them and to ask a follow-up if the entry is thin.
    email: isEmail(normaliseEmail(body.email)) ? normaliseEmail(body.email) : "",
    date: new Date().toISOString().slice(0, 10),
  };

  /*
   * Already in the directory. Nothing is stored: the useful answer is the link,
   * not a queue item, and a suggestion for something a visitor could already be
   * reading is a navigation failure rather than a gap in the catalogue.
   *
   * Matched against the published list, so a drafted entry does not answer this
   * way — somebody asking for something we are already writing is the demand
   * signal that makes it worth finishing, and it falls through to the queue.
   */
  const listed = findListed(submission, entriesOf(kind));
  if (listed) {
    return Response.json({
      alreadyListed: { id: listed.id, name: listed.name, url: listed.url, kind },
      suggestions: publicList(suggestions),
    });
  }

  /*
   * Somebody has already asked for this. Increment the row that exists rather
   * than writing a second one, so the queue shows demand instead of hiding it
   * across duplicate entries.
   */
  const duplicate = findDuplicate(submission, suggestions);
  if (duplicate) {
    const merged = mergeDuplicate(duplicate, submission);
    const next = suggestions.map((s) => (s.id === duplicate.id ? merged : s));
    await write(KEYS.suggestions, next);

    await sendEvent("suggestion", {
      origin: new URL(request.url).origin,
      name: merged.name, url: merged.url, why: submission.why, by: submission.by,
      email: submission.email, approved: merged.approved,
      alsoAsked: timesAsked(merged),
      kindLabel: kindOf(kind).label,
      catLabel: kind === "tool" ? (CATEGORIES.find((c) => c.id === merged.cat)?.label || merged.cat) : "",
    });

    return Response.json({
      duplicate: { name: merged.name, count: timesAsked(merged) },
      suggestions: publicList(next),
    });
  }

  const entry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    ...submission,
    count: 1,
    approved: moderate ? false : true,
  };
  const next = [entry, ...suggestions].slice(0, 500);
  await write(KEYS.suggestions, next);

  await sendEvent("suggestion", {
    origin: new URL(request.url).origin,
    name: entry.name, url: entry.url, why: entry.why, by: entry.by,
    email: entry.email, approved: entry.approved,
    kindLabel: kindOf(entry.kind).label,
    catLabel: entry.kind === "tool" ? (CATEGORIES.find((c) => c.id === entry.cat)?.label || entry.cat) : "",
  });

  return Response.json({ suggestions: publicList(next) });
}
