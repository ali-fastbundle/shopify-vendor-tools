import { sessionFrom, isAdmin } from "@/lib/auth";
import { read, write, KEYS } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/*
 * The weekly Search Console pull (vercel.json, Mondays), then the AI step
 * when the data is not thin. The same three ways in as every cron: Vercel's
 * CRON_SECRET, an external scheduler with the same bearer, or an admin POST.
 * Without GSC_* configured it records that and does nothing.
 */
const DENY = () => new Response("Not found", { status: 404 });
function authorised(request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") || "";
  if (secret && header === `Bearer ${secret}`) return "cron";
  const session = sessionFrom(request);
  if (session && isAdmin(session.email)) return "admin";
  return "";
}

async function run(by) {
  try {
    const last = await read(KEYS.cronLast, {});
    last.search = { at: new Date().toISOString(), by };
    await write(KEYS.cronLast, last);
  } catch { /* bookkeeping never fails the run */ }
  const { pullSearchConsole } = await import("@/lib/searchConsole");
  const pulled = await pullSearchConsole();
  if (pulled.error) return Response.json({ ok: false, pulled });
  const { calendarData } = await import("@/lib/blogCalendar");
  const cal = await calendarData();
  if (cal.search.thin?.thin) return Response.json({ ok: true, pulled, proposed: 0, thin: cal.search.thin.why });
  const { proposeFromSearch } = await import("@/lib/searchIdeas");
  const r = await proposeFromSearch({
    opps: { ...cal.search.groups, thin: cal.search.thin }, range: cal.search.range,
    posts: cal.posts.filter((p) => !p.draft), by: "cron",
  });
  return Response.json({ ok: true, pulled, proposed: r.added?.length || 0, note: r.error || "" });
}

export async function GET(request) {
  const by = authorised(request);
  if (!by) return DENY();
  return run(by);
}
export async function POST(request) {
  const by = authorised(request);
  if (!by) return DENY();
  return run(by);
}
