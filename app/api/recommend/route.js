import { sessionFrom, mintRunToken } from "@/lib/auth";
import { allow, ipOf } from "@/lib/ratelimit";
import { mergedTools } from "@/lib/listings";
import { listingHandle, listingUrl, readListing } from "@/lib/appListing";
import { recommend, saveRun } from "@/lib/recommend";
import { sanitiseAnswers, sanitiseSkipped } from "@/lib/recommendOptions";
import { clearDraft } from "@/lib/recommendDraft";
import { tally } from "@/lib/tallies";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/*
 * The growth recommender's run. Signed in only: it spends a model call and
 * fetches a page on the person's behalf, and an account is the cheapest thing
 * that makes that not free to repeat all afternoon (invariant 16's reasoning).
 *
 * Order, per invariant 6: the session and the inputs are pure checks; the
 * limiter sits above the listing fetch, where real work starts. The listing is
 * read again here rather than trusted from the page, then the model is asked,
 * then the run is stored and the saved draft is deleted. A listing that cannot
 * be read is not a failure: the run goes ahead on what the person typed, and
 * says so.
 *
 * Only the listing URL is required. Everything else may be skipped, and what
 * was skipped is passed on and shown in the answer as reducing confidence.
 *
 * No Store Leads data anywhere in this path. Its licence forbids republishing
 * its data in any form and transferring it to another person.
 */
export async function POST(request) {
  const session = sessionFrom(request);
  if (!session) return new Response("Sign in to get recommendations.", { status: 401 });

  let body;
  try { body = await request.json(); } catch { body = {}; }
  const answers = sanitiseAnswers(body.answers || {});
  const skipped = sanitiseSkipped(body.skipped);
  const handle = listingHandle(answers.url);
  if (!handle) return new Response("Paste the app's own listing URL, like https://apps.shopify.com/your-app.", { status: 400 });
  if (body.answers?.installs !== undefined && body.answers?.installs !== null && body.answers?.installs !== "" && answers.installs === null) {
    return new Response("Installs should be a whole number.", { status: 400 });
  }

  if (!(await allow("recommend", ipOf(request), 10, 60 * 60_000))) {
    return new Response("That is a few runs in an hour. Try again later.", { status: 429 });
  }

  let app = {};
  let listingRead = true;
  try {
    app = await readListing(handle);
  } catch (e) {
    listingRead = false;
    console.warn(`[recommend] listing ${handle} unread: ${e.message}`);
  }

  const tools = await mergedTools();
  const result = await recommend(tools, answers, app, skipped);

  const row = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    at: new Date().toISOString(),
    handle, url: listingUrl(handle), listingRead, app,
    answers: { ...answers, app: undefined }, skipped,
    picks: result.picks.map((p) => ({ id: p.id, name: p.name, why: p.why, drivers: p.drivers.map((d) => d.key) })),
    path: result.path, provider: result.provider, considered: result.considered, noneFit: result.noneFit,
  };
  await saveRun(row);
  await tally("recommend:runs");
  await clearDraft(session.email).catch(() => {});

  /* The token is how feedback finds this run without the run knowing whose it
     was (lib/recommendFeedback.js). */
  return Response.json({
    runId: row.id, feedbackToken: mintRunToken(row.id),
    app, listingRead, skipped,
    picks: result.picks.map((p) => ({ ...p, path: `/tools/${p.id}` })),
    path: result.path, noneFit: result.noneFit,
  });
}
