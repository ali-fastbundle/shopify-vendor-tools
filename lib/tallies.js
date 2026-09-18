/*
 * Running counts that survive the thing they count.
 *
 * "How many suggestions have we ever had" cannot be answered by counting the
 * suggestions, because the list is the one place the answer goes to die: a row
 * deleted, capped off the end of the 500, or folded into a duplicate takes its
 * own history with it. Every count derived from a current list silently means
 * "the ones still here", and reads like a total.
 *
 * So these are incremented at the moment a thing happens and never recomputed.
 * They are allowed to disagree with the list, and when they do the counter is
 * the one telling the truth.
 *
 * They live in `svt:stats`, the same hash as the directory counters, because
 * HINCRBY is the operation this needs: two submissions landing at once cannot
 * lose each other, which a read-modify-write of a JSON blob absolutely can.
 */

import { bumpStats } from "./store";

/* Every counter, named once. The admin panel reads this list rather than
   hard-coding the keys, so a counter added here appears there. */
export const TALLIES = [
  ["suggestions:received", "received"],
  ["suggestions:published", "published"],
  ["suggestions:outofscope", "out of scope"],
  ["suggestions:deleted", "deleted"],
  ["suggestions:duplicate", "folded into a duplicate"],
  ["suggestions:listed", "already listed"],
  ["reports:received", "reports received"],
  ["reports:resolved", "reports resolved"],
  ["reports:dismissed", "reports dismissed"],
];

/**
 * Add one to a counter. Never throws and never blocks: a lost count is not a
 * reason to fail the request that earned it.
 *
 * `bumpStats` is already fire-and-forget internally, so this is awaited only
 * to keep call sites honest about ordering.
 */
export async function tally(key, n = 1) {
  if (!key) return;
  await bumpStats({ [key]: n });
}

/** Several at once, one round trip. */
export async function tallyMany(keys = []) {
  const fields = {};
  for (const k of keys) if (k) fields[k] = (fields[k] || 0) + 1;
  if (Object.keys(fields).length) await bumpStats(fields);
}

/**
 * Pending is the one figure that cannot be a counter.
 *
 * Received minus everything that has since happened to a suggestion would drift
 * the first time two counters got out of step, and it would go negative rather
 * than wrong-but-plausible, which at least has the virtue of being obvious.
 * It is counted off the live list instead, and labelled as the live figure.
 */
export const pendingCount = (rows = []) =>
  rows.filter((s) => !s.status && s.approved === false && !s.outOfScope).length;
