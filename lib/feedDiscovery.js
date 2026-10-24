/*
 * Finding each listing's own feed or changelog, and checking it is alive.
 *
 * A changelog entry is the vendor stating what shipped. A homepage snapshot
 * diff is a model inferring it, and inference is what produced the AppJubilee
 * and PPSPY false positives (invariant 23). So where a listing has a working
 * feed, the monitor reads its entries as findings and stops inferring
 * features from the homepage (lib/monitor.js). Snapshot diffing stays where
 * no feed exists.
 *
 * Reading a feed link from a page we already fetch is what a feed is for: it
 * exists to be read by machines. robots.txt is still obeyed on every fetch.
 *
 * Where to look, in order:
 *   1. <link rel="alternate" type="application/rss+xml|atom+xml"> on the homepage
 *   2. a changelog link in the nav or footer ("changelog", "what's new",
 *      "release notes", "releases", "updates")
 *   3. common paths: /feed, /rss, /blog/feed, /changelog/feed, /changelog,
 *      /whats-new, /releases, /updates
 * A blocked homepage skips 1 and 2 and goes straight to 3, which is the case
 * that matters most: SAMI and Ranksy refuse the monitor's homepage fetch, and
 * a feed on a path they do not refuse restores coverage.
 *
 * What counts: a feed that parses with an entry in the last twelve months is
 * active; one that parses but is older is stale, which is kept and shown,
 * because an abandoned changelog is itself a signal about the tool. A
 * changelog page (HTML) is active when it carries a date in the last twelve
 * months.
 *
 *   svt:feeds = { [entryId]: { feedUrl, changelogUrl, how, foundAt, state,
 *                 newest, checkedAt, status, hand, seen } }
 *
 * A value set by hand in the catalogue (`changelogUrl`, `feedUrl`) is never
 * overwritten: it is verified and recorded as "set by hand", and discovery
 * does not run for it.
 */
import { read, write, KEYS } from "./store";
import { parseFeed } from "./feeds";
import { fetchRaw as realFetchRaw } from "./monitor";

export const COMMON_PATHS = ["/feed", "/rss", "/blog/feed", "/changelog/feed", "/changelog", "/whats-new", "/releases", "/updates"];
export const ACTIVE_DAYS = 365;
const REDISCOVER_DAYS = 28;
const CHANGELOG_WORDS = /\b(change ?log|what'?s new|release notes|releases|product updates|updates)\b/i;

const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
const registrable = (h) => String(h || "").split(".").slice(-2).join(".");
const abs = (href, base) => { try { return new URL(href, base).href.replace(/#.*$/, ""); } catch { return ""; } };
const isFeedBody = (body, type = "") => /xml|rss|atom/i.test(type) || /^\s*(<\?xml[^>]*>\s*)?<(rss|feed|rdf:RDF)[\s>]/i.test(String(body || "").slice(0, 600));

/** Feed links declared in a page's head, and changelog links in its nav and footer. Pure. */
export function linksIn(html, baseUrl) {
  const s = String(html || "");
  const feeds = [];
  for (const m of s.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0];
    if (!/rel=["']?alternate/i.test(tag) || !/type=["']?application\/(rss|atom)\+xml/i.test(tag)) continue;
    const href = (tag.match(/href=["']([^"']+)["']/i) || [])[1];
    const u = href && abs(href, baseUrl);
    /* A comments feed is not a changelog. */
    if (u && !/comments/i.test(u)) feeds.push(u);
  }
  const pages = [];
  const base = registrable(host(baseUrl));
  for (const m of s.matchAll(/<a\b[^>]*href=["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const u = abs(m[1], baseUrl);
    const text = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (!u || registrable(host(u)) !== base) continue;
    if (CHANGELOG_WORDS.test(text) || /\/(change-?log|whats-new|release-notes|releases|updates)\b/i.test(new URL(u).pathname)) pages.push(u);
  }
  return { feeds: [...new Set(feeds)], pages: [...new Set(pages)] };
}

/** Newest date on a changelog page (HTML), from dates written in its text. Pure. */
export function newestDateIn(html) {
  const t = String(html || "").replace(/<[^>]+>/g, " ");
  const months = "jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec";
  const found = [];
  for (const m of t.matchAll(/\b(20\d{2})-(\d{2})-(\d{2})\b/g)) found.push(`${m[1]}-${m[2]}-${m[3]}`);
  for (const m of t.matchAll(new RegExp(`\\b(${months})[a-z]*\\.? (\\d{1,2}),? (20\\d{2})\\b`, "gi"))) {
    const d = new Date(`${m[1]} ${m[2]} ${m[3]} UTC`); if (!Number.isNaN(+d)) found.push(d.toISOString().slice(0, 10));
  }
  for (const m of t.matchAll(new RegExp(`\\b(\\d{1,2}) (${months})[a-z]*\\.? (20\\d{2})\\b`, "gi"))) {
    const d = new Date(`${m[2]} ${m[1]} ${m[3]} UTC`); if (!Number.isNaN(+d)) found.push(d.toISOString().slice(0, 10));
  }
  const today = new Date().toISOString().slice(0, 10);
  return found.filter((d) => d <= today).sort().pop() || "";
}

/** active, stale, or nothing. Pure. */
export function verdict(newest, today = new Date().toISOString().slice(0, 10)) {
  if (!newest) return "";
  return (Date.parse(today) - Date.parse(newest)) / 864e5 <= ACTIVE_DAYS ? "active" : "stale";
}

/** Read one candidate: a feed, a changelog page, or neither. */
async function check(url, fetchRaw, robots) {
  const r = await fetchRaw(url, robots);
  if (!r.ok) return { url, state: r.state, status: r.status };
  if (isFeedBody(r.body, r.type)) {
    const items = parseFeed(r.body);
    if (!items.length) return { url, state: "unparseable", status: "a feed with no entries" };
    const newest = (items.find((i) => i.date)?.date || "").slice(0, 10);
    return { url: r.finalUrl || url, type: "feed", state: verdict(newest) || "undated", newest, items: items.length };
  }
  if (/<html|<body/i.test(r.body.slice(0, 2000))) {
    const newest = newestDateIn(r.body);
    if (!newest) return { url, state: "undated", status: "a page with no dates" };
    return { url: r.finalUrl || url, type: "changelog", state: verdict(newest), newest };
  }
  return { url, state: "unparseable", status: r.type || "unknown content" };
}

const RANK = { active: 0, stale: 1, undated: 2 };
const better = (a, b) => !b || (RANK[a.state] ?? 9) < (RANK[b.state] ?? 9) || ((RANK[a.state] ?? 9) === (RANK[b.state] ?? 9) && a.type === "feed" && b.type !== "feed");

/**
 * Discover and verify one entry. Returns the record to store. A hand value is
 * verified and never replaced.
 */
export async function discoverEntry(entry, { fetchRaw = realFetchRaw, robots = new Map(), today = new Date().toISOString().slice(0, 10) } = {}) {
  const now = new Date().toISOString();
  const handUrl = entry.feedUrl || entry.changelogUrl || "";
  if (handUrl) {
    const c = await check(handUrl, fetchRaw, robots);
    return { [c.type === "feed" ? "feedUrl" : "changelogUrl"]: handUrl, how: "set by hand", hand: true, foundAt: "", state: c.state, newest: c.newest || "", status: c.status || "", type: c.type || "", checkedAt: now };
  }
  if (!entry.url) return { state: "none", how: "", checkedAt: now, status: "no site" };

  const tried = [];
  let best = null;
  let how = "";
  const consider = async (url, why) => {
    if (!url || tried.includes(url)) return;
    tried.push(url);
    const c = await check(url, fetchRaw, robots);
    if (["active", "stale", "undated"].includes(c.state) && better(c, best)) { best = c; how = why; }
  };

  const home = await fetchRaw(entry.url, robots);
  if (home.ok) {
    const base = (() => { try { return new URL(home.finalUrl).href; } catch { return entry.url; } })();
    const { feeds, pages } = linksIn(home.body, base);
    for (const f of feeds.slice(0, 3)) await consider(f, "a feed link in the homepage's head");
    if (best?.state !== "active") for (const p of pages.slice(0, 3)) await consider(p, "a changelog link in the nav or footer");
  }
  if (best?.state !== "active") {
    /* The final URL after redirects, else the listing's own: never a relative path. */
    const origin = (() => { for (const u of [home.finalUrl, entry.url]) { try { return new URL(u).origin; } catch { /* next */ } } return ""; })();
    if (!origin) return { state: "none", how: "", checkedAt: now, status: "no usable site URL" };
    for (const p of COMMON_PATHS) {
      if (best?.state === "active") break;
      await consider(`${origin}${p}`, `the common path ${p}`);
    }
  }
  if (!best) {
    return { state: "none", how: "", checkedAt: now, homepage: home.state, status: home.ok ? `nothing found in ${tried.length} places` : `homepage ${home.status}; nothing found in ${tried.length} places` };
  }
  return {
    [best.type === "feed" ? "feedUrl" : "changelogUrl"]: best.url, type: best.type,
    how, foundAt: now, state: best.state === "undated" ? "stale" : best.state, newest: best.newest || "",
    checkedAt: now, homepage: home.state, status: best.state === "undated" ? "no dates to judge it by" : "",
  };
}

export const getFeeds = async () => (await read(KEYS.feeds, {})) || {};

/** The URL the monitor should read for an entry: the hand value, else an active discovered one. */
export function feedPageFor(entry, rec) {
  if (entry.changelogUrl || entry.feedUrl) return entry.feedUrl || entry.changelogUrl;
  if (rec && rec.state === "active") return rec.feedUrl || rec.changelogUrl || "";
  return "";
}

/**
 * Run discovery for the entries that are due: never checked, or checked more
 * than four weeks ago, or not active. The ones the monitor cannot see come
 * first (`blind`), because a feed is how a blocked homepage gets covered.
 */
export async function runDiscovery(entries, { blind = [], budgetMs = 90_000, fetchRaw = realFetchRaw, force = false } = {}) {
  const started = Date.now();
  const feeds = await getFeeds();
  const robots = new Map();
  const stale = (rec) => !rec || !rec.checkedAt || rec.state !== "active" || (Date.now() - Date.parse(rec.checkedAt)) / 864e5 > REDISCOVER_DAYS;
  const due = entries.filter((e) => force || stale(feeds[e.id]))
    .sort((a, b) => Number(!blind.includes(a.id)) - Number(!blind.includes(b.id)) || String(feeds[a.id]?.checkedAt || "").localeCompare(String(feeds[b.id]?.checkedAt || "")));
  let checked = 0;
  for (const e of due) {
    if (Date.now() - started > budgetMs) break;
    const prev = feeds[e.id] || {};
    const rec = await discoverEntry(e, { fetchRaw, robots }).catch((err) => ({ state: "error", status: String(err.message).slice(0, 80), checkedAt: new Date().toISOString() }));
    /* What the monitor has already read of the feed survives a re-check. */
    feeds[e.id] = { ...rec, seen: prev.seen, foundAt: rec.foundAt && prev.foundAt && (prev.feedUrl || prev.changelogUrl) === (rec.feedUrl || rec.changelogUrl) ? prev.foundAt : rec.foundAt };
    checked++;
  }
  await write(KEYS.feeds, feeds);
  return { checked, due: due.length, feeds };
}

/** Counts for the report and the admin: working, stale, none, and blocked ones a feed covers. Pure. */
export function feedCoverage(entries, feeds, blockedIds = []) {
  const by = { active: [], stale: [], none: [] };
  for (const e of entries) {
    const r = feeds[e.id];
    const k = r?.state === "active" ? "active" : r?.state === "stale" ? "stale" : "none";
    by[k].push(e.id);
  }
  return {
    active: by.active.length, stale: by.stale.length, none: by.none.length,
    blockedCovered: blockedIds.filter((id) => feeds[id]?.state === "active"),
    blockedNot: blockedIds.filter((id) => feeds[id]?.state !== "active"),
    by,
  };
}
