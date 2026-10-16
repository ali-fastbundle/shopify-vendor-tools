import { sessionFrom, isAdmin } from "@/lib/auth";
import { allow, ipOf } from "@/lib/ratelimit";
import { catalogueTools } from "@/lib/entries";
import { ownsListing } from "@/lib/listings";
import { readMedia, readPending, submitMedia, publicMedia } from "@/lib/media";
import { sendEvent } from "@/lib/mail";

export const dynamic = "force-dynamic";

/*
 * Vendor media (lib/media.js), for the verified claimant of a tool or an
 * admin. GET returns what is live and whether a submission is waiting. POST
 * submits a new set, which waits for an editor: nothing here publishes.
 * The ownership check sits above the limiter (invariant 6).
 */
async function gate(request, toolId) {
  const session = sessionFrom(request);
  if (!session) return { error: new Response("Sign in first.", { status: 401 }) };
  const tool = (await catalogueTools()).find((t) => t.id === toolId);
  if (!tool) return { error: new Response("Unknown tool", { status: 400 }) };
  if (!isAdmin(session.email) && !(await ownsListing(tool.id, session.email))) {
    return { error: new Response("Only the verified owner of this listing can add media.", { status: 403 }) };
  }
  return { session, tool };
}

export async function GET(request) {
  const g = await gate(request, new URL(request.url).searchParams.get("tool") || "");
  if (g.error) return g.error;
  const [live, pending] = await Promise.all([readMedia(), readPending()]);
  const p = pending[g.tool.id];
  return Response.json({
    live: publicMedia(live[g.tool.id]),
    pending: p ? { screenshots: p.screenshots.length, video: p.video, submittedAt: p.submittedAt } : null,
  });
}

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { body = {}; }
  const g = await gate(request, String(body.toolId || ""));
  if (g.error) return g.error;
  if (!(await allow("media", ipOf(request), 10, 60 * 60_000))) {
    return new Response("Too many submissions this hour.", { status: 429 });
  }
  const r = await submitMedia(g.tool, { screenshots: body.screenshots, video: body.video }, g.session.email);
  if (r.error) return new Response(r.error, { status: 400 });
  await sendEvent("media_submitted", {
    origin: new URL(request.url).origin, toolName: g.tool.name, email: g.session.email,
    screenshots: r.pending.screenshots.length, video: r.pending.video,
  });
  return Response.json({ pending: { screenshots: r.pending.screenshots.length, video: r.pending.video, submittedAt: r.pending.submittedAt } });
}
