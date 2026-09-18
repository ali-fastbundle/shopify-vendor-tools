import { runMonitor } from "@/lib/monitor";
import { catalogueTools } from "@/lib/entries";
import { NEWSLETTERS } from "@/lib/newsletters";
import { sendEvent } from "@/lib/mail";
import { sessionFrom, isAdmin } from "@/lib/auth";
import { read, write, KEYS } from "@/lib/store";

/* So the admin health strip can say when this last fired and how it was
   invoked. A cron that silently stopped running looks exactly like a quiet
   week otherwise. */
async function recordCronFire(path, by) {
  try {
    const last = await read(KEYS.cronLast, {});
    last[path] = { at: new Date().toISOString(), by };
    await write(KEYS.cronLast, last);
  } catch { /* never fail the run over its own bookkeeping */ }
}

export const dynamic = "force-dynamic";
/* ~30 entries at three at a time, each a fetch plus one or two model calls.
   The sweep has its own 240s budget inside this, so it returns before Vercel
   kills it and the next run continues from the oldest snapshot. */
export const maxDuration = 300;

/*
 * The weekly sweep.
 *
 * Three ways in, and all three end up in the same place:
 *
 *  1. Vercel Cron, which sends `Authorization: Bearer $CRON_SECRET`.
 *  2. Any external scheduler with the same header, which is the fallback if a
 *     plan will not take the schedule. Nothing here depends on Vercel Cron
 *     specifically.
 *  3. An admin session, so the button on /admin can run it by hand.
 *
 * Everything else gets 404, which is also what an unauthenticated caller gets,
 * so the endpoint does not confirm it exists. It is expensive to run and it
 * makes thirty outbound requests, so it is not somewhere to be relaxed.
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

async function sweep(request, by) {
  await recordCronFire("monitor", by);
  const url = new URL(request.url);
  const limit = Math.max(0, Math.min(200, Number(url.searchParams.get("limit")) || 0));

  /*
   * Published entries only, tools and newsletters together. A draft is not on
   * the site, so nothing about it can be out of date in a way a visitor sees,
   * and fetching a draft's site would spend a model call on a listing nobody
   * can read.
   */
  const entries = [
    ...(await catalogueTools()).map((t) => ({ ...t, kind: "tool" })),
    ...NEWSLETTERS.map((n) => ({ ...n, kind: "newsletter" })),
  ];

  const result = await runMonitor(entries, { limit });
  if (result.error) return new Response(result.error, { status: 503 });

  /*
   * Silence is the correct output most weeks, so nothing is sent when nothing
   * changed. An empty digest every Monday is how a digest becomes something
   * people filter to a folder.
   */
  if (result.changes.length) {
    await sendEvent("monitor_digest", {
      origin: url.origin,
      count: result.changes.length,
      checked: result.checked,
      total: result.total,
      changes: result.changes,
    });
  }

  return Response.json({
    ok: true, by,
    at: result.at,
    checked: result.checked,
    total: result.total,
    changes: result.changes.length,
    stopped: result.stopped,
    tookMs: result.tookMs,
    emailed: result.changes.length > 0,
  });
}

/* Vercel Cron issues a GET. */
export async function GET(request) {
  const by = authorised(request);
  if (!by) return DENY();

  /*
   * `?changes=1` reads the log instead of running a sweep.
   *
   * Same gate, no side effects, and it exists because the sweep's own response
   * is a count: "21 changes" is not an answer to "what changed", and reading
   * them otherwise meant an admin session. Deliberately a separate parameter
   * rather than a different status on the same path, so a cron invocation can
   * never accidentally land here and report nothing.
   */
  if (new URL(request.url).searchParams.get("changes")) {
    const { readChangelog, getMonitorState } = await import("@/lib/monitor");
    const [rows, state] = await Promise.all([readChangelog(200), getMonitorState()]);
    return Response.json({ lastRun: state, count: rows.length, changes: rows });
  }

  return sweep(request, by);
}

/* The admin button posts. */
export async function POST(request) {
  const by = authorised(request);
  if (!by) return DENY();
  return sweep(request, by);
}
