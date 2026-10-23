/*
 * When an entry started: a tool's launch, a newsletter's first issue, an
 * event's first edition. One field on every kind, `launched`, and one module
 * that knows how to read it, word it, sort by it and filter on it.
 *
 * Age is a caveat in a market this young. A tool launched last month and one
 * running since 2007 make the same claims on their homepages, and only one of
 * them has shown it lasts. So the date is stated wherever the entry is, and
 * "unknown" is stated as plainly as a date (CLAUDE.md invariant 56).
 *
 * The value is researched from the entry's own pages (an about page, a
 * changelog, a first post, a first issue, an organizer's history) and never
 * guessed: not from a domain registration, not from a copyright range, not
 * from the oldest blog post that is not a launch.
 *
 *   "YYYY-MM-DD"  the day was stated
 *   "YYYY-MM"     only the month
 *   "YYYY"        only the year ("since 2017", "founded in 2007")
 *   "unknown"     looked for and not published
 *   absent        not researched yet (a new entry); reads as unknown
 *
 * A newsletter's first issue already lived in `started`, so for a newsletter
 * `launched` falls back to it: one fact, one place, read through `launchedOf`.
 * Pure and client-safe.
 */

const MONTHS = ["January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December"];

export const LAUNCHED_RE = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/;

export const isLaunchValue = (v) => v === "unknown" || (typeof v === "string" && LAUNCHED_RE.test(v));

/** The entry's value: `launched`, or a newsletter's or podcast's `started`. "" when not known. */
export function launchedOf(entry = {}) {
  const v = entry.launched && entry.launched !== "unknown" ? entry.launched
    : !entry.launched && entry.started ? entry.started : "";
  return LAUNCHED_RE.test(String(v)) ? String(v) : "";
}

/** "8 October 2026", "March 2026", "2017". */
export function launchDate(v) {
  const m = LAUNCHED_RE.exec(String(v || ""));
  if (!m) return "";
  const [, y, mo, d] = m;
  if (d) return `${Number(d)} ${MONTHS[Number(mo) - 1]} ${y}`;
  if (mo) return `${MONTHS[Number(mo) - 1]} ${y}`;
  return y;
}

const VERB = { tool: "Launched", newsletter: "First issue", event: "First held", podcast: "First episode" };

/** The line a listing shows: "Launched March 2026", "First issue July 2024". "" when unknown. */
export function launchLabel(entry, kind = "tool") {
  const v = launchedOf(entry);
  return v ? `${VERB[kind] || "Started"} ${launchDate(v)}` : "";
}

/** For a table, where unknown is a value people compare (invariant 47). */
export const launchCell = (entry) => launchDate(launchedOf(entry)) || "Unknown";

/** Sortable: "2026-10-08", "2026-03-99", "2017-99-99" (an unstated part sorts as the
    latest it could be, so a bare year never jumps ahead of a dated one in it), "" unknown. */
export function launchKey(entry) {
  const m = LAUNCHED_RE.exec(launchedOf(entry));
  if (!m) return "";
  return `${m[1]}-${m[2] || "99"}-${m[3] || "99"}`;
}

/** Launched in the twelve months before `today`, on what is known: a bare year counts
    only when the whole year falls inside the window, so nothing is claimed new on a guess. */
export function launchedWithinYear(entry, today = new Date().toISOString().slice(0, 10)) {
  const m = LAUNCHED_RE.exec(launchedOf(entry));
  if (!m) return false;
  const [, y, mo, d] = m;
  const from = new Date(`${today}T00:00:00Z`); from.setUTCFullYear(from.getUTCFullYear() - 1);
  const earliest = new Date(Date.UTC(Number(y), mo ? Number(mo) - 1 : 0, d ? Number(d) : 1));
  return earliest >= from && earliest <= new Date(`${today}T23:59:59Z`);
}
