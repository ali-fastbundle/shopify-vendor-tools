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
  /* A mention (lib/mentions.js): the post is read now, drafted from, and
     dropped. Same editor, same second press to publish. */
  if (body.mentionId) {
    const { getMentions } = await import("@/lib/mentions");
    const m = (await getMentions()).items[body.mentionId];
    if (!m) return new Response("Unknown mention", { status: 400 });
    const r = await (await import("@/lib/mentionDraft")).draftMentionLine(m);
    if (r.error) return new Response(r.error, { status: 502 });
    return Response.json({ draft: r.draft, provider: r.provider, thin: r.thin, note: r.note });
  }
  /*
   * A vendor's message (lib/vendorNews.js): read into an extraction first,
   * then the line is drafted from the extraction, never from the message. The
   * reading is kept as a record so publishing, the listing rewrite and
   * resolving can refer to it; the message itself is not. `newsId` alone
   * drafts again from a stored reading, with any statuses the editor set.
   */
  if (body.vendor || body.newsId) {
    const V = await import("@/lib/vendorNews");
    const tools = await catalogueTools();
    let rec;
    if (body.newsId) {
      rec = await V.findVendorNews(body.newsId);
      if (!rec) return new Response("No vendor message with that id.", { status: 400 });
      if (body.statuses && typeof body.statuses === "object") rec = await V.saveVendorNews(V.withStatuses(rec, body.statuses));
    }
    const tool = tools.find((t) => t.id === (rec ? rec.toolId : body.vendor?.toolId));
    if (!tool) return new Response("No published tool with that id.", { status: 400 });
    if (!rec) {
      const v = body.vendor;
      const email = String(v.email || "").trim();
      if (email.length < 40) return new Response("Paste the vendor's message, at least a sentence or two.", { status: 400 });
      if (email.length > V.EMAIL_MAX) return new Response("That is longer than 20,000 characters. Paste the part about the product.", { status: 400 });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v.announcedOn || ""))) return new Response("Say when the vendor announced it, as a date.", { status: 400 });
      const listed = (await import("@/lib/listings")).mergedTools;
      const live = (await listed()).find((t) => t.id === tool.id) || tool;
      const read = await V.readVendorEmail({ tool: live, email });
      if (read.error) return new Response(read.error, { status: 502 });
      rec = await V.saveVendorNews(V.newRecord({
        tool, announcedOn: v.announcedOn, sourceUrl: v.sourceUrl || tool.url, sourceNote: v.sourceNote,
        by: session.email, extraction: read.extraction, dropped: read.dropped, provider: read.provider,
      }));
      console.log(`[vendornews] read ${tool.id} ${rec.id} items=${read.extraction.items.length} dropped=${read.dropped.length}`);
    }
    const priorEntries = await feedEntries({ limit: 4, toolId: tool.id });
    const d = await V.draftFromExtraction({ tool, extraction: rec.extraction, priorEntries });
    if (d.error) return Response.json({ record: rec, draft: "", error: d.error, issues: [] });
    rec = await V.saveVendorNews({ ...rec, draft: d.draft });
    return Response.json({
      record: rec, draft: d.draft, provider: d.provider, thin: d.thin, note: d.note,
      issues: V.draftIssues(d.draft, rec.extraction),
    });
  }
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
