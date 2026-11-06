/*
 * What the Search Console queries say a post could win (2026-11-06). Pure and
 * client-safe: the blog calendar renders it, the AI step reads it, and the
 * test runs it on made-up rows.
 *
 * Three groups, each a reason to write rather than a ranking:
 *  - no-clicks: shown, never clicked. A post could win something Google
 *    already puts in front of people.
 *  - near-top: average position 5 to 20, where a better page could move it
 *    onto the first screen.
 *  - no-page: shown, and nothing on the site is about it (`hasPage` is the
 *    site's own search, handed in by the caller).
 *
 * THIN is the point of this file as much as the groups. A two-month-old site
 * whose Search Console was linked days ago has almost no data, and an idea
 * built on three impressions is a guess wearing a number. Below the floors
 * the page says so and the AI step refuses to run.
 */

export const FLOORS = {
  totalImpressions: 1000,   // across every query in the range
  solidQueries: 10,         // queries with at least `perQuery` impressions
  perQuery: 20,             // the least a query needs to be in any group
};

/** Rows of { query, page, clicks, impressions, position } folded per query. */
export function byQuery(rows = []) {
  const m = new Map();
  for (const r of rows) {
    const q = String(r.query || "").trim().toLowerCase();
    if (!q) continue;
    const x = m.get(q) || { query: q, clicks: 0, impressions: 0, posWeight: 0, pages: new Set() };
    const imp = Number(r.impressions) || 0;
    x.clicks += Number(r.clicks) || 0;
    x.impressions += imp;
    x.posWeight += (Number(r.position) || 0) * imp;
    if (r.page) x.pages.add(String(r.page));
    m.set(q, x);
  }
  return [...m.values()].map((x) => ({
    query: x.query, clicks: x.clicks, impressions: x.impressions,
    position: x.impressions ? Math.round((x.posWeight / x.impressions) * 10) / 10 : 0,
    pages: [...x.pages],
  })).sort((a, b) => b.impressions - a.impressions);
}

/** Whether the data can carry a proposal, and the sentence that says why not. */
export function thinness(queries = [], floors = FLOORS) {
  const total = queries.reduce((s, q) => s + q.impressions, 0);
  const solid = queries.filter((q) => q.impressions >= floors.perQuery).length;
  const thin = total < floors.totalImpressions || solid < floors.solidQueries;
  return {
    thin, total, solid, queries: queries.length,
    why: thin
      ? `${total.toLocaleString("en-US")} impressions across ${queries.length} ${queries.length === 1 ? "query" : "queries"}, and ${solid} with ${floors.perQuery} or more. Ideas need at least ${floors.totalImpressions.toLocaleString("en-US")} impressions and ${floors.solidQueries} such queries, so none are proposed.`
      : "",
  };
}

/** The three groups. `hasPage(query)` says whether any page here is about it. */
export function opportunities(rows = [], { hasPage = () => true, floors = FLOORS, limit = 15 } = {}) {
  const queries = byQuery(rows);
  const enough = queries.filter((q) => q.impressions >= floors.perQuery);
  return {
    queries,
    thin: thinness(queries, floors),
    noClicks: enough.filter((q) => q.clicks === 0).slice(0, limit),
    nearTop: enough.filter((q) => q.position >= 5 && q.position <= 20).sort((a, b) => a.position - b.position).slice(0, limit),
    noPage: enough.filter((q) => !hasPage(q.query)).slice(0, limit),
  };
}
