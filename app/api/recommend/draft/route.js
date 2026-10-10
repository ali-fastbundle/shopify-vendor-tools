import { sessionFrom } from "@/lib/auth";
import { allow, ipOf } from "@/lib/ratelimit";
import { getDraft, saveDraft, clearDraft } from "@/lib/recommendDraft";

export const dynamic = "force-dynamic";

/*
 * The recommender's saved progress, for the signed-in account only. The
 * session check is a signature compare and comes first; the limiter sits
 * after it, where the store is touched (invariant 6). Generous, because the
 * flow saves after every screen.
 */
async function gate(request) {
  const session = sessionFrom(request);
  if (!session) return { res: new Response("Sign in to save your answers.", { status: 401 }) };
  if (!(await allow("recdraft", ipOf(request), 300, 60 * 60_000))) {
    return { res: new Response("Too many saves this hour. Your answers are still on this page.", { status: 429 }) };
  }
  return { session };
}

export async function GET(request) {
  const { session, res } = await gate(request);
  if (res) return res;
  return Response.json({ draft: await getDraft(session.email) });
}

export async function PUT(request) {
  const { session, res } = await gate(request);
  if (res) return res;
  let body;
  try { body = await request.json(); } catch { return new Response("Bad request.", { status: 400 }); }
  const draft = await saveDraft(session.email, body || {});
  return Response.json({ saved: draft.at });
}

export async function DELETE(request) {
  const { session, res } = await gate(request);
  if (res) return res;
  await clearDraft(session.email);
  return Response.json({ cleared: true });
}
