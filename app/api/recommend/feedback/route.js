import { sessionFrom, readRunToken } from "@/lib/auth";
import { allow, ipOf } from "@/lib/ratelimit";
import { readRuns, RUNS_MAX } from "@/lib/recommend";
import { readFeedback, applyFeedback, saveFeedback } from "@/lib/recommendFeedback";

export const dynamic = "force-dynamic";

/*
 * Feedback on one recommender run: a thumb and a line per pick, and "did this
 * help?" on the run. See lib/recommendFeedback.js.
 *
 * Order, per invariant 6: the session and the run token are pure checks, so a
 * request that is not from the person who ran it costs nothing. The limiter
 * sits above the store, where real work starts. Generous, because a thumb is
 * saved on every press and a person changing their mind presses a few.
 *
 * Nothing about the person is stored: the token proves the run was theirs
 * and says nothing about who they are.
 */
export async function POST(request) {
  const session = sessionFrom(request);
  if (!session) return new Response("Sign in to give feedback.", { status: 401 });

  let body;
  try { body = await request.json(); } catch { body = {}; }
  const runId = readRunToken(body.token);
  if (!runId) return new Response("That run can no longer take feedback. Run it again.", { status: 400 });

  if (!(await allow("recommend-feedback", ipOf(request), 60, 60 * 60_000))) {
    return new Response("That is a lot of feedback in an hour. Try again later.", { status: 429 });
  }

  const [runs, all] = await Promise.all([readRuns(RUNS_MAX), readFeedback()]);
  const run = runs.find((r) => r.id === runId);
  if (!run && !all[runId]) return new Response("That run is no longer stored.", { status: 400 });

  const { record, error } = applyFeedback(all[runId] || null, run || { id: runId, picks: all[runId].run.picks }, body);
  if (error) return new Response(error, { status: 400 });
  await saveFeedback(record);
  return Response.json({ ok: true, picks: record.picks, helped: record.helped, text: record.text });
}
