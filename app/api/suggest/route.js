import { read, write, KEYS } from "@/lib/store";
import { allow, ipOf } from "@/lib/ratelimit";
import { CATEGORIES, RESOURCE_KINDS, kindOf } from "@/lib/tools";
import { notifyAdmin } from "@/lib/notify";

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
    date: new Date().toISOString().slice(0, 10),
    approved: moderate ? false : true,
  };
  const next = [entry, ...suggestions].slice(0, 500);
  await write(KEYS.suggestions, next);

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
  ]);

  return Response.json({ suggestions: next.filter((s) => s.approved !== false) });
}
