import { sessionFrom, isAdmin } from "@/lib/auth";
import { allow, ipOf } from "@/lib/ratelimit";
import { draftPost, addAnnouncement, updateAnnouncement, getAnnouncements, checksFor, KINDS } from "@/lib/announcements";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/*
 * The announcement queue (lib/announcements.js). Admin only, re-checked on
 * every request and 404 to anyone else (invariant 7).
 *
 *   draft   a model drafts a LinkedIn post for what the editor says shipped,
 *           and it is queued as a draft. The button is the trigger; nothing
 *           queues itself.
 *   update  edit the text, or move the status: draft, ready, posted, dropped.
 *
 * Nothing here posts anywhere. Posting is a person pasting it into LinkedIn.
 */
const DENY = () => new Response("Not found", { status: 404 });

const withChecks = (rows) => rows.map((r) => ({ ...r, checks: checksFor(r) }));

export async function POST(request) {
  const session = sessionFrom(request);
  if (!session || !isAdmin(session.email)) return DENY();

  let body;
  try { body = await request.json(); } catch { body = {}; }

  if (body.action === "draft") {
    const what = String(body.what || "").trim().slice(0, 1500);
    if (what.length < 20) return new Response("Say what shipped in a sentence or two first.", { status: 400 });
    const kind = KINDS[body.kind] ? body.kind : "feature";
    const url = /^https:\/\/[^\s]+$/.test(String(body.url || "")) ? String(body.url).slice(0, 300) : "";
    const since = /^\d{4}-\d{2}-\d{2}$/.test(String(body.since || "")) ? body.since : "";
    /* After the admin check and the input checks: this is the model call. */
    if (!(await allow("announcements", ipOf(request), 30, 60 * 60_000))) {
      return new Response("Too many drafts this hour.", { status: 429 });
    }
    const r = await draftPost({ kind, what, url, since });
    if (r.error) return new Response(r.error, { status: 502 });
    const now = new Date().toISOString();
    await addAnnouncement({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      kind, what, url, since, shipped: now.slice(0, 10), text: r.text, status: "draft", postedAt: "",
      createdAt: now, by: session.email, provider: r.provider, thin: r.thin, note: r.note, factsBlock: r.factsBlock,
    });
    return Response.json({ announcements: withChecks(await getAnnouncements()) });
  }

  if (body.action === "update") {
    if (!(await allow("admin", ipOf(request), 300, 60 * 60_000))) {
      return new Response("Too many admin actions this hour.", { status: 429 });
    }
    const r = await updateAnnouncement(String(body.id || ""), {
      text: body.text, status: body.status, postedAt: body.postedAt,
    }, session.email);
    if (r.error) return new Response(r.error, { status: 400 });
    return Response.json({ announcements: withChecks(await getAnnouncements()) });
  }

  return new Response("Unknown action", { status: 400 });
}
