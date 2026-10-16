/*
 * A suggestion that became a listing leaves the queue as "published", with
 * the entry it became and the date. Server only.
 *
 * There are two ways a suggestion becomes a listing and only one used to say
 * so. "Approve and publish" (svt:entries) set approved, publishedId and
 * publishedAt but no status, and the Catalogue panel filtered only on
 * "deleted", so the row stayed under Reviewed suggestions for good. The file
 * path (Copy as entry stub, then Publish on the draft) never touched the
 * suggestion at all, so the row stayed wherever it was, the Inbox included.
 * Nothing linked a published entry back to the request that asked for it.
 *
 * Now both paths go through `settlePublished`, and so does a pass on /admin
 * load that catches entries published before this existed. A suggestion
 * matches an entry by `findListed`, the same name-then-unique-domain rule the
 * suggestion form uses (invariant 17), so "is this the thing they asked for"
 * has one answer.
 *
 * Interest carries across once: a suggestion that already has a publishedId
 * carried its count when it was first published (carryInterest is additive).
 */
import { read, write, KEYS } from "./store";
import { findListed, normaliseDomain, timesAsked } from "./suggestions";
import { carryInterest } from "./interest";
import { tally } from "./tallies";

/** Pure: the suggestions with the matched ones marked published. */
export function markPublished(suggestions = [], catalogue = [], { at = new Date().toISOString(), onlyId = "" } = {}) {
  const changed = [];
  const next = suggestions.map((s) => {
    if (!s || s.status) return s;
    if (onlyId && s.id !== onlyId) return s;
    const kind = s.kind || "tool";
    const pool = catalogue.filter((e) => (e.kind || "tool") === kind);
    const entry = findListed({ name: s.name, url: s.url || "", domain: normaliseDomain(s.url || ""), kind }, pool);
    if (!entry) return s;
    const row = { ...s, status: "published", approved: true, publishedId: entry.id, publishedAt: s.publishedAt || at, publishedKind: kind };
    changed.push({ before: s, after: row, entry });
    return row;
  });
  return { next, changed };
}

/**
 * Mark and persist, and carry interest for any that never carried it.
 * `catalogue` is [{ id, name, url, domain, kind }]. Returns the changed rows.
 */
export async function settlePublished(catalogue, opts = {}) {
  const suggestions = (await read(KEYS.suggestions, [])) || [];
  const { next, changed } = markPublished(suggestions, catalogue, opts);
  if (!changed.length) return { suggestions, changed };
  await write(KEYS.suggestions, next);
  for (const { before, entry } of changed) {
    if (before.publishedId) continue;
    await tally("suggestions:published");
    await carryInterest(entry.id, {
      count: timesAsked(before),
      people: [{ by: before.by, why: before.why, email: before.email, date: before.date }, ...(Array.isArray(before.also) ? before.also : [])],
    });
  }
  return { suggestions: next, changed };
}
