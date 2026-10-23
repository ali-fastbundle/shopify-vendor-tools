/*
 * Every question asked of the directory, kept, including the ones it could
 * not answer. An intent the directory cannot serve is the clearest signal of
 * what to list or build next, and it only shows up if the empty answers are
 * kept beside the full ones.
 *
 * One row per question: when, the words (capped), how many results came back
 * per section, the gap the model named, and which path answered (the model,
 * or keyword matching when none was available). Nothing identifies who asked:
 * no address, no IP, no session, the same promise the matcher queries in
 * svt:stats:queries already keep. Newest 1,000 (KEYS.matchLog).
 */
import { pushCapped, readCapped, bumpStats, KEYS } from "./store";

export const MATCH_LOG_MAX = 1000;

export async function logQuestion({ q, groups = [], gap = "", path = "model", provider = "", error = "" }) {
  const byKind = Object.fromEntries(groups.map((g) => [g.kind, g.items.length]));
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  try {
    await pushCapped(KEYS.matchLog, [{
      at: new Date().toISOString(),
      q: String(q || "").slice(0, 600),
      byKind, total, gap: String(gap || "").slice(0, 240),
      answered: total > 0, path, provider: provider || "", error: error ? String(error).slice(0, 120) : "",
    }], MATCH_LOG_MAX);
    await bumpStats({ "matcher:uses": 1, ...(total ? {} : { "matcher:unanswered": 1 }) });
  } catch (e) {
    /* Losing a log row is not a reason to fail the answer. */
    console.error("[match] log failed", e.message);
  }
}

export const readQuestions = (limit = 500) => readCapped(KEYS.matchLog, limit);
