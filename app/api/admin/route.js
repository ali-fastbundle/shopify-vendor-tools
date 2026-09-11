import { sessionFrom, isAdmin } from "@/lib/auth";
import { read, write, KEYS } from "@/lib/store";
import { getClaims, revokeClaim } from "@/lib/listings";

export const dynamic = "force-dynamic";

/*
 * Every request re-derives the session from the cookie and re-checks isAdmin.
 * The admin page performing the same check is a convenience for the person
 * looking at it, not a permission — this route is reachable directly with curl
 * and has to defend itself. Same 404 for signed-out and non-admin, so the
 * endpoint does not confirm it exists to someone without access.
 */
const DENY = () => new Response("Not found", { status: 404 });

export async function POST(request) {
  const session = sessionFrom(request);
  if (!session || !isAdmin(session.email)) return DENY();

  let body;
  try { body = await request.json(); } catch { body = {}; }
  const { action, id } = body;
  if (!id || typeof id !== "string") return new Response("Missing id", { status: 400 });

  if (action === "approve-suggestion" || action === "delete-suggestion") {
    const suggestions = await read(KEYS.suggestions, []);
    if (!suggestions.some((s) => s.id === id)) {
      return new Response("Unknown suggestion", { status: 400 });
    }
    const next = action === "approve-suggestion"
      ? suggestions.map((s) => (s.id === id ? { ...s, approved: true } : s))
      : suggestions.filter((s) => s.id !== id);
    await write(KEYS.suggestions, next);
    return Response.json({ suggestions: next });
  }

  if (action === "revoke-claim") {
    const claims = await getClaims();
    if (!claims[id]) return new Response("Unknown claim", { status: 400 });
    return Response.json({ claims: await revokeClaim(id) });
  }

  return new Response("Unknown action", { status: 400 });
}
