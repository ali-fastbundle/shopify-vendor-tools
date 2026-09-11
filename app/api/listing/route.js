import { sessionFrom, isAdmin } from "@/lib/auth";
import { allow, ipOf } from "@/lib/ratelimit";
import { TOOLS } from "@/lib/tools";
import { ownsListing, sanitiseEdit, saveEdit, mergedTools } from "@/lib/listings";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ tools: await mergedTools() });
}

export async function POST(request) {
  const session = sessionFrom(request);
  if (!session) return new Response("Sign in first", { status: 401 });

  const ip = ipOf(request);
  if (!(await allow("listing", ip, 30, 60 * 60_000))) {
    return new Response("Too many edits this hour.", { status: 429 });
  }

  const { toolId, edit } = await request.json();
  if (!TOOLS.some((t) => t.id === toolId)) return new Response("Unknown tool", { status: 400 });

  const owns = await ownsListing(toolId, session.email);
  if (!owns && !isAdmin(session.email)) {
    return new Response("You have not verified ownership of this listing.", { status: 403 });
  }

  const { edit: clean, error } = sanitiseEdit(edit || {});
  if (error) return new Response(error, { status: 400 });

  await saveEdit(toolId, clean, session.email);
  return Response.json({ tools: await mergedTools() });
}
