import { collectMentions, targetsOf } from "@/lib/mentions";
import { mergedTools, mergedNewsletters, mergedEvents } from "@/lib/listings";
import { allOwners } from "@/lib/ownerIndex";
import { sessionFrom, isAdmin } from "@/lib/auth";
import { read, write, KEYS } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/*
 * The mentions collection: lib/mentions.js does the work. Same three ways in
 * as the monitor (Vercel Cron's bearer, any scheduler with the same header, an
 * admin session) and the same 404 for everybody else, so it does not confirm
 * it exists.
 *
 * Daily at 07:00, each run searching the domains not searched in a week, so
 * the whole catalogue is covered weekly. New items wait in the Inbox.
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
    last.mentions = { at: new Date().toISOString(), by };
    await write(KEYS.cronLast, last);
  } catch { /* never fail the run over its own bookkeeping */ }

  const [tools, newsletters, events] = await Promise.all([mergedTools(), mergedNewsletters(), mergedEvents()]);
  const owners = allOwners({ tools, newsletters, events });
  const { summariseMention, judgeRelevance } = await import("@/lib/mentionDraft");
  const listed = tools.filter((t) => t.shopifyExclusive !== false).map((t) => t.name);
  const result = await collectMentions({
    targets: targetsOf({ tools, newsletters, events, owners }), budgetMs: 180_000,
    summarise: (m) => summariseMention(m),
    judge: (m) => judgeRelevance(m, { listed }),
  });
  console.log(`[mentions] ${result.found} in, ${result.passed} passed, ${result.filtered} filtered. ${Object.entries(result.byListing || {}).map(([k, v]) => `${k} ${v.passed}/${v.in}`).join(", ")}`);
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
