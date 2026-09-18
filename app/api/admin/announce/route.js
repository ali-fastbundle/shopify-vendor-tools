import { sessionFrom, isAdmin } from "@/lib/auth";
import { allow, ipOf } from "@/lib/ratelimit";
import { readChangelog } from "@/lib/monitor";
import { catalogueTools } from "@/lib/entries";
import { feedEntries } from "@/lib/feed";
import { draftAnnouncement } from "@/lib/announce";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/*
 * Draft a feed announcement for one finding.
 *
 * Read-only: it writes nothing, publishes nothing, and returns a string for a
 * person to edit. Publishing is a separate action with a separate click, which
 * is the whole arrangement and not an implementation detail.
 *
 * Admin only, re-checked here and 404 to everyone else, because it costs a
 * model call.
 */
const DENY = () => new Response("Not found", { status: 404 });

export async function POST(request) {
  const session = sessionFrom(request);
  if (!session || !isAdmin(session.email)) return DENY();

  /* After the admin check, so a stranger's request costs nothing. */
  if (!(await allow("announce", ipOf(request), 60, 60 * 60_000))) {
    return new Response("Too many drafts this hour.", { status: 429 });
  }

  let body;
  try { body = await request.json(); } catch { body = {}; }
  if (!body.id) return new Response("Missing id", { status: 400 });

  const [rows, tools] = await Promise.all([readChangelog(500), catalogueTools()]);
  const change = rows.find((r) => r.id === body.id);
  if (!change) return new Response("Unknown change", { status: 400 });

  const tool = tools.find((t) => t.id === change.entryId);
  if (!tool) return new Response("That change is about a tool that is no longer listed.", { status: 400 });

  /*
   * What a regular reader already knows: this tool's own recent entries, and a
   * little of what is happening elsewhere. One clause of that can make an
   * announcement land; the prompt is explicit that a paragraph of it is an
   * essay nobody asked for.
   */
  const [priorEntries, elsewhere] = await Promise.all([
    feedEntries({ limit: 4, toolId: tool.id }),
    feedEntries({ limit: 8 }),
  ]);

  const result = await draftAnnouncement({ change, tool, priorEntries, elsewhere });
  if (result.error) return new Response(result.error, { status: 502 });

  /*
   * The draft and how it was made. Deliberately NOT the finding: the editor
   * renders the claim from the row it already has, so the figures stay beside
   * the draft even when the model is down and the textarea opens empty. Sending
   * a second copy of the same finding back would only create the chance of the
   * two disagreeing.
   */
  return Response.json({
    draft: result.draft,
    provider: result.provider,
    thin: result.thin,
    note: result.note,
  });
}
