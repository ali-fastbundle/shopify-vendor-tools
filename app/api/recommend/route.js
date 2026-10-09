import { sessionFrom } from "@/lib/auth";
import { allow, ipOf } from "@/lib/ratelimit";
import { mergedTools } from "@/lib/listings";
import { listingHandle, listingUrl, readListing } from "@/lib/appListing";
import { recommend, saveRun } from "@/lib/recommend";
import { budgetOf, stageOf, objectiveOf, MAX_INSTALLS } from "@/lib/recommendOptions";
import { tally } from "@/lib/tallies";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/*
 * The growth recommender. Signed in only: it spends a model call and fetches
 * a page on the person's behalf, and an account is the cheapest thing that
 * makes that not free to repeat all afternoon (invariant 16's reasoning).
 *
 * Order, per invariant 6: the session and the inputs are pure checks, so a
 * rejected request costs nothing; the limiter sits above the listing fetch,
 * where real work starts. The listing is read, then the model is asked, then
 * the run is stored. A listing that cannot be read is not a failure: the
 * recommendation goes ahead on what the person typed, and says so.
 *
 * No Store Leads data anywhere in this path. Its licence forbids republishing
 * its data in any form and transferring it to another person.
 */
export async function POST(request) {
  const session = sessionFrom(request);
  if (!session) return new Response("Sign in to get recommendations.", { status: 401 });

  let body;
  try { body = await request.json(); } catch { body = {}; }
  const handle = listingHandle(body.url);
  if (!handle) return new Response("Paste the app's own listing URL, like https://apps.shopify.com/your-app.", { status: 400 });
  if (!budgetOf(body.budget)) return new Response("Pick a budget.", { status: 400 });
  if (!stageOf(body.stage)) return new Response("Pick a stage.", { status: 400 });
  if (!objectiveOf(body.objective)) return new Response("Pick what you most want.", { status: 400 });
  const installs = Number(body.installs);
  if (!Number.isInteger(installs) || installs < 0 || installs > MAX_INSTALLS) {
    return new Response("Installs should be a whole number.", { status: 400 });
  }
  const input = { budget: body.budget, stage: body.stage, objective: body.objective, installs };

  if (!(await allow("recommend", ipOf(request), 10, 60 * 60_000))) {
    return new Response("That is a few runs in an hour. Try again later.", { status: 429 });
  }

  let app = {};
  let listingRead = true;
  try {
    app = await readListing(handle);
  } catch (e) {
    listingRead = false;
    console.warn(`[recommend] listing ${handle} unread — ${e.message}`);
  }

  const tools = await mergedTools();
  const result = await recommend(tools, input, app);

  const row = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    at: new Date().toISOString(),
    handle, url: listingUrl(handle), listingRead, app,
    ...input,
    picks: result.picks, path: result.path, provider: result.provider, considered: result.considered,
  };
  await saveRun(row);
  await tally("recommend:runs");

  return Response.json({
    app, listingRead,
    picks: result.picks.map((p) => ({ ...p, path: `/tools/${p.id}` })),
    path: result.path,
  });
}
