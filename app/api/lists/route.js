import { sessionFrom } from "@/lib/auth";
import { allow, ipOf } from "@/lib/ratelimit";
import { catalogueTools } from "@/lib/entries";
import { readLists, saveLists, listsOf, createList, saveList, addToList, deleteList, ownList } from "@/lib/lists";

export const dynamic = "force-dynamic";

/*
 * Saved lists (lib/lists.js). Signed in for everything, because a list is
 * somebody's. The session check sits above the limiter (invariant 6), and the
 * limiter is generous: reordering a list is many small saves.
 *
 *   GET            your lists
 *   POST create    { name, toolId? }
 *   POST save      { id, name, items, public, byName }
 *   POST add       { id, toolId }
 *   POST delete    { id }
 */
async function toolCheck() {
  const ids = new Set((await catalogueTools()).map((t) => t.id));
  return (id) => ids.has(id);
}

export async function GET(request) {
  const session = sessionFrom(request);
  if (!session) return new Response("Sign in to see your lists.", { status: 401 });
  return Response.json({ lists: listsOf(await readLists(), session.email) });
}

export async function POST(request) {
  const session = sessionFrom(request);
  if (!session) return new Response("Sign in to save a list.", { status: 401 });
  if (!(await allow("lists", ipOf(request), 120, 10 * 60_000))) {
    return new Response("Too many changes at once. Try again in a few minutes.", { status: 429 });
  }
  let body;
  try { body = await request.json(); } catch { body = {}; }
  const isTool = await toolCheck();
  const all = await readLists();
  const id = String(body.id || "");
  const r = body.action === "create" ? createList(all, session.email, { name: body.name, toolId: String(body.toolId || "") }, isTool)
    : body.action === "save" ? saveList(all, session.email, id, { name: body.name, items: body.items, public: body.public, byName: body.byName }, isTool)
      : body.action === "add" ? addToList(all, session.email, id, String(body.toolId || ""), isTool)
        : body.action === "delete" ? deleteList(all, session.email, id)
          : { error: "Unknown action." };
  if (r.error) return new Response(r.error, { status: 400 });
  await saveLists(r.all);
  return Response.json({ list: r.list ? ownList(r.list) : null, lists: listsOf(r.all, session.email) });
}
