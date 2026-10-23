import { runEventRefresh } from "@/lib/eventRefresh";
import { sessionFrom, isAdmin } from "@/lib/auth";
import { read, write, KEYS } from "@/lib/store";
import { SITE } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/*
 * The monthly event refresh: lib/eventRefresh.js does the work. Same three ways in
 * as the monitor (Vercel Cron's bearer, any scheduler with the same header, an
 * admin session) and the same 404 for everybody else, so it does not confirm
 * it exists.
 *
 * Monthly, on the 1st at 06:00, two hours before the daily run sends the
 * events digest. It proposes and never edits: findings wait in the Inbox.
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

async function run(request, by) {
  try {
    const last = await read(KEYS.cronLast, {});
    last.events = { at: new Date().toISOString(), by };
    await write(KEYS.cronLast, last);
  } catch { /* never fail the run over its own bookkeeping */ }

  const origin = process.env.NODE_ENV === "production" ? SITE : new URL(request.url).origin;
  const result = await runEventRefresh({ origin, budgetMs: 240_000 });
  return Response.json(result);
}

export async function GET(request) {
  const by = authorised(request);
  return by ? run(request, by) : DENY();
}

export async function POST(request) {
  const by = authorised(request);
  return by ? run(request, by) : DENY();
}
