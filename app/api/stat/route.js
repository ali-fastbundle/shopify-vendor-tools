import { bumpStats } from "@/lib/store";
import { allow, ipOf } from "@/lib/ratelimit";
import { TOOLS } from "@/lib/tools";

export const dynamic = "force-dynamic";

/*
 * Directory-specific counters only.
 *
 * Page traffic is Vercel Analytics' job and is not duplicated here — see
 * CLAUDE.md. What Vercel cannot see is which *tool* someone opened and what
 * they typed into the matcher, so those two things, and nothing else, are
 * counted.
 *
 * The client buffers events and posts them in one go, so this is a write per
 * batch rather than a write per view. The whole batch lands in a single
 * pipelined round trip.
 *
 * Nothing identifying is stored: no email even when one is known, no IP beyond
 * the rate-limit bucket that every route already keeps, no session id. A query
 * is stored as text because reading what people actually ask for is the point;
 * it is capped and never joined to a person.
 */
const MAX_EVENTS = 50;
const MAX_QUERY = 160;

export async function POST(request) {
  if (!(await allow("stat", ipOf(request), 60, 60 * 60_000))) {
    // Silent: a dropped counter is not worth an error in someone's console.
    return new Response(null, { status: 204 });
  }

  let body;
  try { body = await request.json(); } catch { body = {}; }

  const fields = {};

  // Unknown ids are dropped rather than counted, so the hash cannot be seeded
  // with junk fields by anyone posting arbitrary strings.
  const opens = Array.isArray(body.tools) ? body.tools.slice(0, MAX_EVENTS) : [];
  for (const id of opens) {
    if (TOOLS.some((t) => t.id === id)) fields[`tool:${id}`] = (fields[`tool:${id}`] || 0) + 1;
  }

  const uses = Number(body.matcher);
  if (Number.isFinite(uses) && uses > 0) fields["matcher:uses"] = Math.min(uses, MAX_EVENTS);

  const queries = (Array.isArray(body.queries) ? body.queries : [])
    .slice(0, MAX_EVENTS)
    .map((q) => String(q || "").replace(/\s+/g, " ").trim().slice(0, MAX_QUERY))
    .filter(Boolean);

  await bumpStats(fields, queries);

  return new Response(null, { status: 204 });
}
