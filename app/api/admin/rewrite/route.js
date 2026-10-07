import { sessionFrom, isAdmin } from "@/lib/auth";
import { allow, ipOf } from "@/lib/ratelimit";
import { readChangelog } from "@/lib/monitor";
import { mergedTools } from "@/lib/listings";
import { proposeRewrite } from "@/lib/rewrite";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/*
 * Propose a rewrite of a listing that takes in one monitor finding.
 *
 * Read-only, like /api/admin/announce: it writes nothing and returns a
 * proposal for a person to read as a diff, edit and then save with a separate
 * action. The proposal is drafted against the listing as a visitor sees it
 * now (mergedTools), so it rewrites what is live, vendor edits and earlier
 * rewrites included, rather than the file underneath them.
 *
 * Admin only, re-checked here and 404 to everyone else, with the limiter after
 * the check because it costs a model call and a fetch.
 */
const DENY = () => new Response("Not found", { status: 404 });

export async function POST(request) {
  const session = sessionFrom(request);
  if (!session || !isAdmin(session.email)) return DENY();

  if (!(await allow("rewrite", ipOf(request), 60, 60 * 60_000))) {
    return new Response("Too many rewrites this hour.", { status: 429 });
  }

  let body;
  try { body = await request.json(); } catch { body = {}; }
  if (!body.id) return new Response("Missing id", { status: 400 });

  const [rows, tools] = await Promise.all([readChangelog(500), mergedTools()]);
  const change = rows.find((r) => r.id === body.id);
  if (!change) return new Response("Unknown change", { status: 400 });
  const tool = tools.find((t) => t.id === change.entryId);
  if (!tool) return new Response("That change is about a tool that is no longer listed.", { status: 400 });

  const result = await proposeRewrite({ change, tool, steer: body.steer });
  if (result.error) return new Response(result.error, { status: 502 });
  return Response.json(result);
}
