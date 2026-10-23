import { sessionFrom, isAdmin } from "@/lib/auth";
import { allow, ipOf } from "@/lib/ratelimit";
import { listedEntity } from "@/lib/entries";
import { ownsListing, sanitiseEdit, editableFor, saveEdit, mergedTools, mergedNewsletters, mergedEvents } from "@/lib/listings";
import { sendEvent } from "@/lib/mail";
import { read, write, KEYS } from "@/lib/store";
import { readChangelog } from "@/lib/monitor";

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

  const { toolId, edit, finding } = await request.json();
  const tool = await listedEntity(toolId);
  if (!tool) return new Response("Unknown listing", { status: 400 });

  const owns = await ownsListing(toolId, session.email);
  if (!owns && !isAdmin(session.email)) {
    return new Response("You have not verified ownership of this listing.", { status: 403 });
  }

  const { edit: sane, error } = sanitiseEdit(edit || {});
  if (error) return new Response(error, { status: 400 });
  // Narrower than the tool whitelist for the other shapes. See EDITABLE_BY_KIND.
  const clean = editableFor(tool.kind, sane);
  // Same answer sanitiseEdit gives an edit made only of protected fields.
  if (!Object.keys(clean).length) return new Response("Nothing to save.", { status: 400 });

  await saveEdit(toolId, clean, session.email);

  /*
   * Opened from a monitor finding (the "Edit the listing" link on Recent
   * updates carries its id): record the edit as that finding's destination,
   * so Resolve can close it. Admin only, and only a finding about this
   * listing; anything else is ignored rather than refused, because the edit
   * itself has already been saved and is what the person asked for.
   */
  if (finding && typeof finding === "string" && isAdmin(session.email)) {
    try {
      const row = (await readChangelog(500)).find((r) => r.id === finding && r.entryId === toolId);
      if (row) {
        const edited = (await read(KEYS.changesEdited, {})) || {};
        edited[finding] = { at: new Date().toISOString(), by: session.email, via: "form", toolId, fields: Object.keys(clean) };
        await write(KEYS.changesEdited, edited);
      }
    } catch { /* the edit stands; the finding can be marked by hand */ }
  }

  const changed = Object.keys(clean);
  await sendEvent("listing_edited", {
    origin: new URL(request.url).origin,
    toolName: tool.name, email: session.email, byAdmin: !owns, changed,
    values: changed.map((f) => `${f}: ${typeof clean[f] === "object" ? JSON.stringify(clean[f]) : clean[f]}`),
  });

  const tools = tool.kind === "newsletter" ? await mergedNewsletters()
    : tool.kind === "event" ? await mergedEvents()
    : await mergedTools();
  return Response.json({ tools });
}
