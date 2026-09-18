import { runDiscovery, getDiscovery } from "@/lib/discovery";
import { catalogueTools } from "@/lib/entries";
import { configured } from "@/lib/model";
import { sessionFrom, isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/*
 * Monthly competitor discovery.
 *
 * Same gate as the weekly monitor: Vercel Cron's bearer token, any external
 * scheduler with the same token, or an admin session for the button on /admin.
 * 404 to everyone else, because it makes a hundred or so outbound requests and
 * spends a model call per vendor.
 *
 * Monthly rather than weekly on purpose. Comparison pages move on a marketing
 * quarter's timescale, and a name arriving three weeks late costs nothing. See
 * lib/discovery.js.
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

async function handle(request, by) {
  const url = new URL(request.url);

  /* Read the last pass without running one. */
  if (url.searchParams.get("findings")) {
    return Response.json({ by, ...(await getDiscovery()) });
  }

  if (!configured()) {
    return new Response("No model provider is configured.", { status: 503 });
  }

  const limit = Math.max(0, Math.min(200, Number(url.searchParams.get("limit")) || 0));
  const result = await runDiscovery(await catalogueTools(), { limit });
  if (result.error) return new Response(result.error, { status: 503 });

  /*
   * Nothing is emailed. These are leads that need somebody to open a website,
   * not alerts: the monitor mails because a listing may have gone wrong this
   * week, and this is a list to work through whenever there is time.
   */
  return Response.json({
    ok: true, by,
    at: result.at,
    checked: result.checked,
    withComparisonPages: result.withPages,
    found: result.findings.length,
    tookMs: result.tookMs,
    stopped: result.stopped,
    findings: result.findings,
  });
}

export async function GET(request) {
  const by = authorised(request);
  if (!by) return DENY();
  return handle(request, by);
}

export async function POST(request) {
  const by = authorised(request);
  if (!by) return DENY();
  return handle(request, by);
}
