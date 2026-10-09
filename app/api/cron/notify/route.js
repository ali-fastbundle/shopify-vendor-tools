import { detect, send } from "@/lib/notify";
import { sessionFrom, isAdmin } from "@/lib/auth";
import { read, write, KEYS } from "@/lib/store";
import { SITE } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/*
 * The daily run for followers: lib/notify.js does the work. Same three ways in
 * as the monitor (Vercel Cron's bearer, any scheduler with the same header, an
 * admin session) and the same 404 for everybody else, so it does not confirm
 * it exists.
 *
 * Links in the digest use the canonical site, not the request origin: a cron
 * invocation arrives on whatever host Vercel calls, and a digest pointing at a
 * deployment URL would outlive that deployment.
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
    last.notify = { at: new Date().toISOString(), by };
    await write(KEYS.cronLast, last);
  } catch { /* never fail the run over its own bookkeeping */ }

  const found = await detect();
  const sent = await send({ origin: process.env.NODE_ENV === "production" ? SITE : new URL(request.url).origin, budgetMs: 200_000 });
  if (found.errors.length) console.warn(`[notify] feeds unread: ${found.errors.join("; ")}`);
  console.log(`[notify] ${found.found} found, ${found.queued} queued, ${sent.sent} sent, ${sent.failed} failed, ${sent.left} left`);
  return Response.json({ ...found, ...sent });
}

export async function GET(request) {
  const by = authorised(request);
  return by ? run(request, by) : DENY();
}

export async function POST(request) {
  const by = authorised(request);
  return by ? run(request, by) : DENY();
}
