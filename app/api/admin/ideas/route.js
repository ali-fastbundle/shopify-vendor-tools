import { sessionFrom, isAdmin } from "@/lib/auth";
import { allow, ipOf } from "@/lib/ratelimit";
import { getIdeas, addIdea, updateIdea, addReview, recordCommit } from "@/lib/ideaStore";

export const dynamic = "force-dynamic";
/* A review sends CLAUDE.md in full and can take a minute or two. */
export const maxDuration = 300;

/*
 * The ideas backlog (lib/ideas.js). Admin only, re-checked on every request
 * and 404 to anyone else (invariant 7).
 *
 *   add      capture an idea: text, optional surface and size
 *   update   edit it, or move its status (dropped needs a reason)
 *   review   the AI review, stored with the idea; advisory
 *   commit   record the commit hash that shipped it
 *
 * Nothing here starts a Claude Code session. "Copy as prompt" is built in the
 * browser from the idea (handoffPrompt) and pasted by a person.
 */
const DENY = () => new Response("Not found", { status: 404 });

export async function POST(request) {
  const session = sessionFrom(request);
  if (!session || !isAdmin(session.email)) return DENY();

  let body;
  try { body = await request.json(); } catch { body = {}; }
  const id = String(body.id || "");
  const done = async (r) => r.error
    ? new Response(r.error, { status: 400 })
    : Response.json({ ideas: await getIdeas() });

  if (body.action === "review") {
    /* After the admin check: this is the model call, and the expensive one. */
    if (!(await allow("ideas-review", ipOf(request), 20, 60 * 60_000))) {
      return new Response("Too many reviews this hour.", { status: 429 });
    }
    const all = await getIdeas();
    const idea = all.find((i) => i.id === id);
    if (!idea) return new Response("No such idea.", { status: 400 });
    const { reviewIdea } = await import("@/lib/ideaReview");
    const r = await reviewIdea(idea, all);
    if (r.error) return new Response(r.error, { status: 502 });
    return done(await addReview(id, r.review, session.email));
  }

  if (!(await allow("admin", ipOf(request), 300, 60 * 60_000))) {
    return new Response("Too many admin actions this hour.", { status: 429 });
  }
  if (body.action === "add") {
    return done(await addIdea({ text: body.text, surface: body.surface, size: body.size }, session.email));
  }
  if (body.action === "update") {
    return done(await updateIdea(id, {
      text: body.text, surface: body.surface, size: body.size, status: body.status, reason: body.reason,
    }, session.email));
  }
  if (body.action === "commit") {
    return done(await recordCommit(id, body.hash, session.email));
  }
  return new Response("Unknown action.", { status: 400 });
}
