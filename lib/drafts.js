/*
 * Drafts.
 *
 * Any catalogue entry, of any kind, may carry `draft: true`. A draft is
 * written, stored in the source file and reviewable in /admin, and it is
 * invisible to a visitor: not in the grid, the search, the matcher, the
 * counts, the share card, or any API response.
 *
 * Publishing is deleting the flag in the source file. The Publish button on
 * /admin does exactly that and nothing else: it commits the edit to the file
 * on GitHub (lib/publish.js), so published-ness never lives anywhere but the
 * file, and every publish is a reviewable, revertable commit. `readiness`
 * below is the checklist that button shows, and the server runs it again.
 *
 * The important half of this module is not the filter, it is the naming. Every
 * catalogue exports the *published* list under its plain name, so every
 * existing consumer is draft-safe without being changed and without knowing
 * drafts exist. Seeing a draft requires deliberately importing `ALL_TOOLS` or
 * `ALL_NEWSLETTERS`, which only /admin does. A leak has to be written on
 * purpose rather than forgotten into existence.
 */

export const isDraft = (entry) => Boolean(entry && entry.draft);

/** Everything a visitor may see. The default for every consumer. */
export const published = (list) =>
  Array.isArray(list) ? list.filter((e) => !isDraft(e)) : [];

/** Everything still being written. /admin only. */
export const drafted = (list) =>
  Array.isArray(list) ? list.filter(isDraft) : [];

/*
 * What stops a draft being published, as sentences. Empty means ready.
 * Shown beside the Publish button on /admin and re-run by the server before
 * it commits, so the check a person reads is the check that is enforced.
 * Pure and client-safe.
 *
 * These are the mechanical half. Whether the note and the watch are *right*
 * is still a person's judgement, which is why the button shows them in full
 * and asks twice.
 */
const NO_CAVEAT = /^(none|n\/?a|nothing|no caveats?|no concerns?|no issues?|not applicable)\b[.!]*$/i;

/*
 * The commit in the publish log that says this draft is already on its way out,
 * or null. A row counts only while the build serving the page is the one that
 * made the commit: any later deploy carries the commit, so a draft still in the
 * file after one has been put back (a revert) and needs its buttons again.
 * RetailFest Connect sat "waiting for Vercel" for a month on its 10 October
 * publish, which had been reverted the same day. Rows written before the build
 * was recorded count for 30 minutes, about two deploys.
 */
export const PENDING_GRACE_MS = 30 * 60 * 1000;
export function pendingCommit(log = [], { kind, id, build = "", now = Date.now() } = {}) {
  return (log || []).find((r) => {
    if (r.kind !== kind || r.id !== id || !r.sha) return false;
    if (r.outcome && r.outcome !== "discarded" && r.outcome !== "published") return false;
    if (r.build) return r.build === build;
    const at = Date.parse(r.at || "");
    return Number.isFinite(at) && now - at < PENDING_GRACE_MS;
  }) || null;
}

export function readiness(entry = {}, kind = "tool") {
  const out = [];
  if (!String(entry.one || "").trim()) out.push("No one-line summary.");
  if (kind !== "event" && !String(entry.note || "").trim()) out.push("No note.");
  const watch = String(entry.watch || "").trim();
  if (!watch) out.push("No watch note. Every entry needs its caveat before it goes live.");
  else if (NO_CAVEAT.test(watch)) out.push("The watch note says there is nothing to watch for. Look harder.");
  for (const f of ["one", "note", "watch"]) {
    if (String(entry[f] || "").includes("\u2014")) out.push(`The ${f} contains an em-dash.`);
  }
  if (!/^https:\/\//.test(String(entry.url || ""))) out.push("No https link.");
  return out;
}
