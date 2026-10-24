/*
 * What the monitor can actually see, per listing.
 *
 * SAMI shipped a feature and announced another, and the monitor reported
 * nothing, because SAMI answers our fetches with a 403 and had done for weeks.
 * Nothing was wrong with the monitor's output: an entry it cannot read produces
 * no findings, which is exactly what an entry with nothing new produces. A
 * quiet week and a blind spot looked identical. This is the difference, stated
 * per listing, so "no changes" is only ever read as "no changes" for a tool the
 * monitor could actually see.
 *
 * Four states, derived from the snapshot store and never kept as a second list
 * (a site that starts letting us in clears its own flag on the next read):
 *
 *   monitored    the last run read at least one of its pages
 *   blocked      the site is live and every page refused us
 *   unreachable  the site did not answer, on one run or more
 *   none         no reading recorded at all: not swept yet, or every attempt
 *                failed before a snapshot existed. "No source" on the page.
 *
 * A monitored entry read through only some of its pages says which, because
 * "watched through its changelog, homepage refused" is thinner coverage than
 * a full reading and should not look the same either.
 *
 * Pure and client-safe: no store, no model.
 */

export const COVERAGE_LABEL = {
  monitored: "Monitored",
  blocked: "Blocked",
  unreachable: "Unreachable",
  none: "No source",
};

const ORDER = { blocked: 0, none: 1, unreachable: 2, monitored: 3 };
const DAY = 24 * 60 * 60 * 1000;

/* A weekly sweep that has not read an entry in three weeks has stopped
   reaching it, whatever the last reading said. */
export const STALE_DAYS = 21;

const declared = (e) => [
  e.url && "home",
  e.pricingUrl && "pricing",
  e.changelogUrl && "changelog",
].filter(Boolean);

export function coverageOf(entries = [], snapshots = {}, { now = Date.now(), feeds = {} } = {}) {
  return entries.map((e) => {
    const rec = (snapshots && snapshots[e.id]) || null;
    const pages = Array.isArray(rec?.pages) ? rec.pages : [];
    const read = pages.filter((p) => p.state === "ok").map((p) => p.label);
    const refused = pages.filter((p) => p.state !== "ok").map((p) => ({ label: p.label, state: p.state, status: p.status }));
    const alternatives = declared(e).filter((l) => l !== "home");

    let state = "none";
    if (rec?.blocked) state = "blocked";
    else if (Number(rec?.failures) > 0) state = "unreachable";
    else if (rec?.snapshot) state = "monitored";

    const lastRead = rec?.snapshot ? rec.at || "" : "";
    const ageDays = lastRead ? Math.floor((now - Date.parse(lastRead)) / DAY) : null;

    let detail = "";
    if (state === "blocked") {
      detail = rec.blockedWhy || "every page refused";
      if (!alternatives.length) detail += ". No changelog, blog or feed declared to read instead.";
    } else if (state === "unreachable") {
      detail = `${rec.lastFailureWhy || "did not answer"} (${rec.failures} run${rec.failures === 1 ? "" : "s"})`;
    } else if (state === "monitored" && refused.length) {
      detail = `Read through ${read.join(" and ") || "part of the site"} only. ${refused.map((r) => `${r.label}: ${r.status}`).join("; ")}.`;
    } else if (state === "none") {
      detail = pages.length
        ? `Fetched, but no reading was recorded: ${pages.map((p) => `${p.label}: ${p.status}`).join("; ")}.`
        : "No run has read this entry yet.";
    }

    return {
      id: e.id,
      kind: e.kind || "tool",
      name: e.name,
      state,
      partial: state === "monitored" && refused.length > 0,
      stale: state === "monitored" && ageDays !== null && ageDays > STALE_DAYS,
      read,
      refused,
      declared: declared(e),
      lastRead,
      checkedAt: rec?.checkedAt || "",
      since: state === "blocked" ? rec.blockedAt || "" : "",
      detail,
      /* The listing's feed or changelog (lib/feedDiscovery.js): active, stale,
         or none, how it was found, and its newest entry. */
      feed: feeds[e.id] ? {
        state: feeds[e.id].state, url: feeds[e.id].feedUrl || feeds[e.id].changelogUrl || "",
        type: feeds[e.id].type || "", how: feeds[e.id].how || "", newest: feeds[e.id].newest || "", status: feeds[e.id].status || "",
      } : null,
    };
  }).sort((a, b) => (ORDER[a.state] - ORDER[b.state])
    || (Number(b.partial || b.stale) - Number(a.partial || a.stale))
    || String(a.name).localeCompare(String(b.name)));
}

/* "53 monitored, 1 blocked": the one line the Inbox and the status strip read. */
export function coverageCounts(rows = []) {
  const out = { total: rows.length, monitored: 0, blocked: 0, unreachable: 0, none: 0, partial: 0, stale: 0 };
  for (const r of rows) {
    out[r.state] += 1;
    if (r.partial) out.partial += 1;
    if (r.stale) out.stale += 1;
  }
  return out;
}

/** Listings the monitor cannot currently see at all. */
export const uncovered = (rows = []) => rows.filter((r) => r.state !== "monitored" || r.stale);
