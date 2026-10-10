import { read, KEYS } from "./store";
import { catalogueTools } from "./entries";
import { NEWSLETTERS } from "./newsletters";
import { ratingStats } from "./reviews";

/*
 * Markers on the admin review list. Neither one blocks anything.
 *
 * The founder review on BestAppify was found by reading it, which is the same
 * as saying it was found by accident. These are the two patterns that make a
 * listing worth reading before a visitor does:
 *
 * - A burst: three or more reviews on one listing inside seven days. A real
 *   tool collects reviews slowly; a launch-day push or a team asked to chip in
 *   arrives all at once.
 * - A domain match: the reviewer signed in with an address on the listing's
 *   own domain, which usually means the vendor reviewing itself.
 *
 * Both are prompts to look, not verdicts. A burst after a newsletter mention
 * is genuine, and somebody at the vendor can be a real user of a product they
 * did not build. The decision is the exclusion buttons, made by a person.
 *
 * Server only: it reads the stored reviews, which carry the reviewer's
 * address, and the address is the thing the domain marker needs. It is never
 * imported by a client component and its result goes only to /admin.
 */

export const BURST = { count: 3, days: 7 };
const DAY = 86400000;

const hostOf = (s) => {
  const v = String(s || "").trim().toLowerCase();
  if (!v) return "";
  try { return new URL(/^https?:\/\//.test(v) ? v : `https://${v}`).hostname.replace(/^www\./, ""); }
  catch { return ""; }
};

const emailDomain = (email) => String(email || "").trim().toLowerCase().split("@")[1] || "";

/** Equal, or one a subdomain of the other. Never a substring. */
export function sameSite(a, b) {
  if (!a || !b) return false;
  return a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`);
}

const dayOf = (r) => {
  const t = Date.parse(`${String(r.date || "").slice(0, 10)}T12:00:00Z`);
  return Number.isFinite(t) ? t : null;
};

/** The ids of every review inside some window of BURST.count within BURST.days. */
export function burstIds(list = []) {
  const dated = list.map((r) => ({ id: r.id, t: dayOf(r) })).filter((x) => x.t != null)
    .sort((a, b) => a.t - b.t);
  const hit = new Set();
  let windows = [];
  for (let i = 0; i < dated.length; i++) {
    let j = i;
    while (j + 1 < dated.length && dated[j + 1].t - dated[i].t <= BURST.days * DAY) j++;
    if (j - i + 1 >= BURST.count) {
      for (let k = i; k <= j; k++) hit.add(dated[k].id);
      windows.push({ from: dated[i].t, to: dated[j].t, n: j - i + 1 });
    }
  }
  const widest = windows.sort((a, b) => b.n - a.n)[0];
  return {
    ids: hit,
    window: widest ? {
      count: widest.n,
      from: new Date(widest.from).toISOString().slice(0, 10),
      to: new Date(widest.to).toISOString().slice(0, 10),
    } : null,
  };
}

/**
 * Pure: stored reviews plus the listed entities, to one group per listing.
 * Groups with a marker come first, then the most recently reviewed.
 */
export function signalsFrom(stored = {}, entities = []) {
  const byId = new Map(entities.map((e) => [e.id, e]));
  const groups = [];
  for (const [id, list] of Object.entries(stored || {})) {
    if (!Array.isArray(list) || !list.length) continue;
    const e = byId.get(id) || { id, name: id, kind: "unlisted" };
    const hosts = [hostOf(e.domain), hostOf(e.url)].filter(Boolean);
    const burst = burstIds(list);
    const reviews = list.map((r) => {
      const d = emailDomain(r.email);
      return {
        id: r.id, author: r.author || "", email: r.email || "", rating: r.rating, date: r.date || "",
        editedAt: r.editedAt || "", text: r.text || "", excluded: r.excluded || null,
        domainMatch: Boolean(d) && hosts.some((h) => sameSite(d, h)),
        inBurst: burst.ids.has(r.id),
      };
    }).sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const stats = ratingStats(list);
    groups.push({
      id, name: e.name, kind: e.kind, domain: hosts[0] || "",
      burst: burst.window,
      domainMatches: reviews.filter((r) => r.domainMatch).length,
      excludedCount: reviews.filter((r) => r.excluded).length,
      average: stats ? Math.round(stats.value * 10) / 10 : null,
      counted: stats ? stats.count : 0,
      latest: reviews[0]?.date || "",
      reviews,
    });
  }
  const flagged = (g) => (g.burst || g.domainMatches ? 1 : 0);
  return groups.sort((a, b) => flagged(b) - flagged(a) || String(b.latest).localeCompare(String(a.latest)));
}

export async function reviewSignals(stored) {
  const [reviews, tools] = await Promise.all([
    stored ? Promise.resolve(stored) : read(KEYS.reviews, {}),
    catalogueTools(),
  ]);
  const entities = [
    ...tools.map((t) => ({ id: t.id, name: t.name, domain: t.domain, url: t.url, kind: "tool" })),
    ...NEWSLETTERS.map((n) => ({ id: n.id, name: n.name, domain: n.domain || "", url: n.url, kind: "newsletter" })),
  ];
  return signalsFrom(reviews, entities);
}
