/*
 * Mentions: where people outside the directory linked to something listed in
 * it. Collected from free sources, matched on the listing's domain only.
 *
 * Domain only, because the 2026-10-23 probe (scripts/feed-match-probe.py,
 * scripts/feed-match-labels.json) measured it: a domain in the text was about
 * the listing 16 times in 16, and a name 10 times in 185, never for an
 * ordinary word. Meridian, Orbit, Elevate, SAMI and Prys are also the names of
 * other things, some of them other Shopify apps. A name match is not offered
 * as a weaker signal: it is not a signal.
 *
 * What is kept, per item: the link, the source, the author's handle, the date,
 * the listing it concerns, and one factual line built in code from the
 * source's own heading (a thread title, a repository name). Never the post's
 * text. The directory links; it does not host (CLAUDE.md invariant 58).
 *
 *   svt:mentions = { items: { [id]: item }, checked: { [domain]: ISO }, lastRunAt }
 *
 * An item's status: "new" until an editor has seen it in the Inbox, "seen",
 * or "removed" with a reason, who and when. Removal is allowed only for the
 * three reasons in REMOVAL_REASONS, and the row is kept, so every removal is
 * on record.
 */
import { createHash } from "crypto";
import { read, write, KEYS } from "./store";
import { discoursePost } from "./mentionContext";

export const SOURCE_LABEL = {
  hackernews: "Hacker News", bluesky: "Bluesky",
  "shopify-community": "Shopify Community", "shopify-dev-community": "Shopify developer community", github: "GitHub",
};

/* The only grounds for taking an item down. Disagreeing with what somebody
   said is not one of them. */
export const REMOVAL_REASONS = {
  "wrong-listing": "Not about this listing",
  spam: "Spam",
  private: "Exposes private data",
};

/* Hosts that are not one listing's own: a match on them says nothing. */
const NOT_A_LISTING = new Set(["shopify.com", "linkedin.com", "youtube.com", "luma.com", "lu.ma", "eventbrite.com", "substack.com", "beehiiv.com", "apps.shopify.com"]);

const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; } };
const pathOf = (u) => { try { const p = new URL(u).pathname.replace(/\/$/, ""); return p.length > 1 ? p.toLowerCase() : ""; } catch { return ""; } };

/**
 * What can be mentioned: every published tool, newsletter, event and owner
 * with a domain of its own. Each carries the strings that identify it in a
 * post: its domain, or its host and path where the domain is shared (Elevate
 * and Orbit on marmeto.com) or it lives on a subdomain (SASI). Pure.
 */
export function targetsOf({ tools = [], newsletters = [], events = [], owners = [] } = {}) {
  const out = [];
  /* `general`: a brand mentioned all the time for reasons that have nothing
     to do with Shopify app vendors (BuiltWith, PartnerStack, Web Summit,
     Retail Insider). Its mentions need the relevance test; a Shopify-only
     listing's do not, because its domain is unambiguous. A tool is general
     when it is marked shopifyExclusive: false; a newsletter unless it is
     Shopify-specific; an event unless its relevance is high; an owner always. */
  const add = (kind, id, name, href, domain, url, general = false) => {
    const d = String(domain || host(url)).replace(/^www\./, "").toLowerCase();
    if (!d || NOT_A_LISTING.has(d) || [...NOT_A_LISTING].some((x) => d.endsWith(`.${x}`) && x !== "shopify.com")) return;
    const h = host(url), p = pathOf(url);
    const needle = p && h ? `${h}${p}` : h && h !== d && h.endsWith(`.${d}`) ? h : d;
    out.push({ kind, id, name, href, domain: d, needle, general });
  };
  for (const t of tools) add("tool", t.id, t.name, `/tools/${t.id}`, t.domain, t.url, t.shopifyExclusive === false);
  for (const n of newsletters) add("newsletter", n.id, n.name, `/newsletters/${n.id}`, n.domain, n.url, !n.shopifySpecific);
  for (const e of events) if (e.domain) add("event", e.id, e.name, `/events/${e.id}`, e.domain, `https://${e.domain}`, e.relevance !== "high");
  /* Owners from allOwners (lib/ownerIndex.js): their own page where there is
     one, otherwise the first listing they are behind. */
  for (const o of owners) {
    const href = o.page || o.entries?.[0]?.href || "";
    if (o.url && href) add("owner", o.id || o.key, o.name, href, "", o.url, true);
  }
  return out;
}

/** The domains to search, once each. */
export const searchTermsOf = (targets) => [...new Set(targets.map((t) => t.domain))].sort();

/**
 * Which listing a piece of text is about, or null. The longest needle found
 * wins, so marmeto.com/elevate goes to Elevate and marmeto.com alone to the
 * Marmeto listing; between a listing and its owner on the same domain, the
 * listing. Matched on a boundary, so "notstoreleads.app" is not Store Leads. Pure.
 */
export function matchTarget(text, targets) {
  const t = String(text || "").toLowerCase();
  const rank = { tool: 0, newsletter: 1, event: 2, owner: 3 };
  let best = null;
  for (const g of targets) {
    const i = t.indexOf(g.needle);
    if (i < 0) continue;
    const before = i === 0 ? "" : t[i - 1];
    if (before && /[a-z0-9-]/.test(before)) continue;
    /* A dot before it is a subdomain, which is somebody else's, unless it is www. */
    if (before === "." && !/(^|[^a-z0-9-])www\.$/.test(t.slice(Math.max(0, i - 5), i))) continue;
    const after = t[i + g.needle.length] || "";
    if (/[a-z0-9]/.test(after)) continue;
    if (!best || g.needle.length > best.needle.length || (g.needle.length === best.needle.length && rank[g.kind] < rank[best.kind])) best = g;
  }
  return best;
}

/*
 * Two things the 2026-10-24 volume run found most of the raw matches to be:
 *   own        the listing's own account (retailinsider.bsky.social posting
 *              its articles, storeinspect.bsky.social its stats, a GitHub
 *              repository under the vendor's own name). The vendor talking
 *              about itself is not a mention, so these are not collected at
 *              all (the editor's call, 2026-10-24).
 *   affiliate  a referral link (?via=, ?ref=, /go/, partnerstack.com/go): a
 *              commission, not an opinion. Kept and marked.
 * A founder posting from a personal handle cannot be told apart from anyone
 * else by the handle, so that case is left to the editor's Remove.
 * Pure.
 */
const stem = (s) => String(s || "").toLowerCase().replace(/^www\./, "").split(".")[0].replace(/[^a-z0-9]/g, "");
export function isOwnAccount(author, listing, where = "") {
  /* A GitHub repository's owner counts as its author: "storeinspect/cli". */
  const repoOwner = String(where || "").includes("/") ? String(where).split("/")[0] : "";
  if (repoOwner && repoOwner !== author && isOwnAccount(repoOwner, listing)) return true;
  const a = String(author || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const d = stem(listing?.domain);
  const n = String(listing?.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return Boolean(a) && ((d.length >= 4 && a.includes(d)) || (n.length >= 4 && a.includes(n)));
}
export const hasAffiliateLink = (text, needle) => {
  const t = String(text || "").toLowerCase();
  const i = t.indexOf(needle);
  return i >= 0 && /^[^\s]*([?&](via|ref|aff|affiliate|fpr|referral)=|\/go\/)/.test(t.slice(i, i + 200));
};

/**
 * Every listing a text links, one per listing: the longest needle at each
 * place wins, so marmeto.com/elevate is Elevate and not also Marmeto. Pure.
 */
export function matchTargets(text, targets) {
  const t = String(text || "").toLowerCase();
  const hits = [];
  for (const g of targets) {
    let from = 0;
    for (;;) {
      const i = t.indexOf(g.needle, from);
      if (i < 0) break;
      from = i + 1;
      if (matchTarget(t.slice(Math.max(0, i - 6), i + g.needle.length + 1), [g])) hits.push({ g, i, end: i + g.needle.length });
    }
  }
  const kept = hits.filter((h) => !hits.some((o) => o !== h && o.i <= h.i && o.end >= h.end && o.end - o.i > h.end - h.i));
  const out = [];
  for (const { g } of kept) if (!out.some((x) => x.id === g.id && x.kind === g.kind)) out.push(g);
  return out;
}

const idOf = (url) => createHash("sha1").update(String(url)).digest("base64url").slice(0, 16);
const clip = (s, n = 100) => { const x = String(s || "").replace(/\s+/g, " ").trim(); return x.length > n ? `${x.slice(0, n - 1).trim()}…` : x; };

/**
 * The one line shown, built from the source's own heading and never from the
 * post. Pure.
 */
export function lineOf(item) {
  const name = item.listing?.name || "";
  const who = item.author ? `${item.author} ` : "";
  switch (item.source) {
    case "hackernews": return `${who ? `${who}linked` : "A Hacker News comment links"} ${name}${who ? " in a Hacker News comment" : ""}.`;
    case "bluesky": return `${who ? `${who}linked` : "A Bluesky post links"} ${name}${who ? " on Bluesky" : ""}.`;
    case "shopify-community": return `${who ? `${who}linked` : "A post links"} ${name} in a Shopify Community thread.`;
    case "shopify-dev-community": return `${who ? `${who}linked` : "A post links"} ${name} in a Shopify developer community thread.`;
    case "github": return `${who ? `${who}linked` : "A GitHub issue links"} ${name}${item.where ? ` in ${item.where}` : ""}.`;
    default: return `A post links ${name}.`;
  }
}

export { contextLine } from "./feedSource";

/* ------------------------------------------------------------------ */
/*  Sources. Each answers [{ url, at, author, title, kind, where, text }],
    where `text` is used for matching only and is never stored.          */
/* ------------------------------------------------------------------ */

const UA = "watchfor.tools-mentions/1.0 (+https://watchfor.tools)";
const strip = (s) => String(s || "").replace(/<[^>]+>/g, " ").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
/*
 * Three outcomes, like the tool monitor's fetch (invariant 23), because an
 * empty answer and a refused one look the same in an empty Inbox:
 *   blocked  401, 403, 429, or a page where JSON was expected (a challenge or
 *            a bot wall). The source is live and refusing us, usually because
 *            of the datacentre range a Vercel function runs from.
 *   error    a timeout, a 5xx, or anything else that did not answer.
 * A blocked or failed query never marks a domain as searched.
 */
export class SourceError extends Error {
  constructor(kind, status, message) { super(message || `${kind} ${status}`); this.kind = kind; this.status = String(status); }
}
async function getText(url, headers = {}) {
  let res;
  /* A network blip or a timeout is tried three times before it counts. A
     refusal is not retried: asking again is not going to change a 403. */
  for (let attempt = 1; ; attempt++) {
    try {
      res = await fetch(url, { headers: { "user-agent": UA, ...headers }, signal: AbortSignal.timeout(15_000) });
      break;
    } catch (e) {
      if (attempt >= 3) throw new SourceError("error", e?.name === "TimeoutError" ? "timeout" : "network", String(e?.message || e).slice(0, 80));
      await new Promise((r) => setTimeout(r, 800 * attempt));
    }
  }
  if ([401, 403, 429].includes(res.status)) throw new SourceError("blocked", res.status);
  if (!res.ok) throw new SourceError("error", res.status);
  return res.text();
}
const getJson = async (url, headers) => {
  const t = await getText(url, headers);
  try { return JSON.parse(t); } catch {
    throw new SourceError(/^\s*</.test(t) ? "blocked" : "error", "200", /^\s*</.test(t) ? "a page instead of JSON (challenge or bot wall)" : "unreadable JSON");
  }
};

const ALL_SOURCES = {
  async hackernews(term, since) {
    const ts = Math.floor(Date.parse(`${since}T00:00:00Z`) / 1000);
    const d = await getJson(`https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(term)}&numericFilters=created_at_i>${ts}&hitsPerPage=100`);
    return (d.hits || []).map((h) => ({
      url: `https://news.ycombinator.com/item?id=${h.objectID}`, at: String(h.created_at || "").slice(0, 10), author: h.author || "",
      kind: h.comment_text ? "comment" : "submission", title: h.title || h.story_title || "",
      thread: `hn:${h.story_id || h.objectID}`,
      post: { url: `https://news.ycombinator.com/item?id=${h.objectID}`, author: h.author || "", at: String(h.created_at || "").slice(0, 10) },
      replyTo: h.parent_id && h.parent_id !== h.story_id ? { number: h.parent_id, author: "" } : null,
      text: [h.title, strip(h.story_text), strip(h.comment_text), h.url].filter(Boolean).join(" "),
    }));
  },
  async bluesky(term, since) {
    const d = await getJson(`https://api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=${encodeURIComponent(term)}&since=${since}T00:00:00Z&sort=latest&limit=100`);
    return (d.posts || []).map((p) => {
      const rec = p.record || {};
      const links = (rec.facets || []).flatMap((f) => (f.features || []).map((x) => x.uri).filter(Boolean)).join(" ");
      return {
        url: `https://bsky.app/profile/${p.author.handle}/post/${String(p.uri).split("/").pop()}`, at: String(rec.createdAt || "").slice(0, 10),
        author: p.author.handle, title: "", kind: "post",
        thread: `bsky:${rec.reply?.root?.uri || p.uri}`,
        replyTo: rec.reply?.parent?.uri ? { number: 0, author: "" } : null,
        text: [rec.text, p.embed?.external?.uri, links].filter(Boolean).join(" "),
      };
    });
  },
  /* Reddit is not in SOURCES: its search matches loosely and never on a link,
     so 295 rows for these domains held none of them (2026-10-24), and its JSON
     endpoints refuse unauthenticated requests. Kept for a keyed version. */
  async redditUnused(term, since) {
    const out = [];
    for (const q of [term, `site:${term}`]) {
      const x = await getText(`https://www.reddit.com/search.rss?q=${encodeURIComponent(q)}&sort=new&t=year&limit=100`);
      for (const e of x.match(/<entry>[\s\S]*?<\/entry>/g) || []) {
        const url = (e.match(/<link href="([^"]+)"/) || [])[1] || "";
        const at = ((e.match(/<(?:published|updated)>([^<]+)</) || [])[1] || "").slice(0, 10);
        if (!url || at < since) continue;
        const sub = (url.match(/reddit\.com\/(r\/[^/]+)/) || [])[1] || "";
        const title = strip((e.match(/<title>([\s\S]*?)<\/title>/) || [])[1]);
        out.push({ url, at, author: ((e.match(/<name>([^<]+)<\/name>/) || [])[1] || "").replace(/^\/u\//, ""), kind: "post", where: sub, title,
          text: `${title} ${strip(strip((e.match(/<content[^>]*>([\s\S]*?)<\/content>/) || [])[1]))}` });
      }
    }
    return out;
  },
  "shopify-community": discourse("https://community.shopify.com"),
  "shopify-dev-community": discourse("https://community.shopify.dev"),
  async github(term, since) {
    const headers = process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {};
    const d = await getJson(`https://api.github.com/search/issues?q=${encodeURIComponent(`"${term}" created:>=${since}`)}&per_page=100`, headers);
    return (d.items || []).map((i) => ({
      url: i.html_url, at: String(i.created_at || "").slice(0, 10), author: i.user?.login || "",
      kind: i.pull_request ? "pull request" : "issue", where: (i.repository_url || "").split("/repos/")[1] || "", title: i.title || "",
      text: `${i.title || ""} ${String(i.body || "").slice(0, 6000)}`,
    }));
  },
};

const { redditUnused, ...SOURCES_IN_USE } = ALL_SOURCES;
export const SOURCES = SOURCES_IN_USE;

/*
 * Discourse: the search finds the posts; each is then read in full, because
 * its excerpt often lacks the link (post 3 of the 1-star review thread links
 * LetsMetrix only behind its link text). One row per post, anchored to it,
 * with the thread's title as context and the post it replies to.
 */
function discourse(base) {
  return async (term, since) => {
    const d = await getJson(`${base}/search.json?q=${encodeURIComponent(`${term} after:${since} order:latest`)}`);
    const topics = Object.fromEntries((d.topics || []).map((t) => [t.id, t]));
    const out = [];
    for (const p of (d.posts || []).slice(0, 25)) {
      let full = null;
      try { full = await discoursePost(base, p.id); } catch { /* fall back to the excerpt */ }
      const title = topics[p.topic_id]?.title || "";
      out.push({
        url: full?.url || `${base}/t/${p.topic_id}/${p.post_number || 1}`,
        at: full?.at || String(p.created_at || "").slice(0, 10), author: full?.author || p.username || "",
        kind: "post", title, thread: `${base}/t/${p.topic_id}`,
        post: { number: full?.number || p.post_number || 1, author: full?.author || p.username || "", at: full?.at || String(p.created_at || "").slice(0, 10) },
        replyTo: full?.replyTo || null,
        text: `${title} ${full ? full.text : strip(p.blurb)}`,
      });
    }
    return out;
  };
}

/* ------------------------------------------------------------------ */
/*  The run                                                            */
/* ------------------------------------------------------------------ */

export const getMentions = async () => ({ items: {}, checked: {}, ...((await read(KEYS.mentions, {})) || {}) });

/** The public shape: no status fields, nothing removed. */
export const publicMention = ({ status, decidedBy, decidedAt, reason, feedId, vendorBy, vendorAt, summaryTried, ...m }) => m;

/* Other people's words only: not the listing's own account, not a referral link. */
export const isThirdParty = (m) => !m.affiliate && !m.repeat && !m.vendor && !m.interest;

/**
 * Search each domain not checked in the last week, since its last check, and
 * keep what links a listing. Budgeted and resumable, oldest check first, so a
 * daily run gets through the catalogue in a few days and then keeps it fresh.
 */
/* A query every source answers with something on any day, run once per source
   per collection. Rows back means the source works from here; nothing back
   means it answered and found nothing, which for "shopify" is not believable,
   so it is reported as suspicious rather than as a quiet week. */
export const CANARY = "shopify";
export const CANARY_SINCE_DAYS = 14;

export const SOURCE_STATE_LABEL = {
  ok: "answering", empty: "answering, but empty where results were expected", blocked: "blocked", error: "failing", never: "not run yet",
};

/**
 * Search each (source, domain) not searched in the last week, since it was
 * last searched. Budgeted and resumable, oldest first, so a daily run gets
 * through the catalogue in a few days and then keeps it fresh. Each source's
 * outcome is recorded per run in `state.sources`, so a blocked source reads as
 * blocked and never as a week with no mentions.
 */
const MAX_SUMMARIES = 20;
const MAX_JUDGED = 40;
const SHOPIFY_SOURCES = new Set(["shopify-community", "shopify-dev-community"]);

export async function collectMentions({ targets, budgetMs = 240_000, today = new Date().toISOString().slice(0, 10), sources = SOURCES, firstSince, summarise = null, judge = null } = {}) {
  const started = Date.now();
  const state = await getMentions();
  state.checked = state.checked || {};
  /* Items collected before own accounts were left out go now. */
  for (const [id, m] of Object.entries(state.items || {})) if (m.own) delete state.items[id];
  state.sources = state.sources || {};
  const day = (n) => new Date(Date.parse(`${today}T00:00:00Z`) - n * 864e5).toISOString().slice(0, 10);
  const weekAgo = day(7);
  const start = firstSince || day(28);
  const now = new Date().toISOString();
  const terms = searchTermsOf(targets);
  const run = Object.fromEntries(Object.keys(sources).map((s) => [s, { requests: 0, rows: 0, matched: 0, blocked: 0, errors: 0, last: "" }]));

  /* The canary first: is the source answering from here at all? */
  for (const [source, fn] of Object.entries(sources)) {
    try {
      const rows = await fn(CANARY, day(CANARY_SINCE_DAYS));
      run[source].canary = rows.length;
    } catch (e) {
      run[source].canary = -1;
      run[source][e.kind === "blocked" ? "blocked" : "errors"]++;
      run[source].last = `${e.status}${e.message && e.message !== `${e.kind} ${e.status}` ? `: ${e.message}` : ""}`;
    }
  }

  const key = (source, term) => `${source}|${term}`;
  const due = [];
  for (const term of terms) for (const source of Object.keys(sources)) {
    const at = state.checked[key(source, term)] || state.checked[term] || "";
    if (run[source].canary === -1) continue;            // refused us just now: do not spend the budget on it
    if (!at || at.slice(0, 10) <= weekAgo) due.push({ source, term, at });
  }
  due.sort((a, b) => a.at.localeCompare(b.at));

  let found = 0, checked = 0;
  const fresh = [];
  for (const { source, term, at } of due) {
    if (Date.now() - started > budgetMs) break;
    const since = at ? at.slice(0, 10) : start;
    run[source].requests++;
    let rows;
    try { rows = await sources[source](term, since); } catch (e) {
      run[source][e.kind === "blocked" ? "blocked" : "errors"]++;
      run[source].last = `${e.status}${e.message && e.message !== `${e.kind} ${e.status}` ? `: ${e.message}` : ""}`;
      continue;                                          // never marked as searched
    }
    run[source].rows += rows.length;
    for (const r of rows) {
      /* Every listed tool the post links gets its own mention, anchored to
         this post. One per tool per thread: a later post linking the same tool
         is recorded on the first as "also linked in". */
      const listings = matchTargets(r.text, targets);
      if (!listings.some((l) => l.domain === term)) continue;
      for (const listing of listings) {
        if (isOwnAccount(r.author, listing, r.where)) { run[source].own = (run[source].own || 0) + 1; continue; }
        const threadKey = r.thread || r.url;
        const id = idOf(`${threadKey}|${listing.kind}:${listing.id}`);
        const existing = state.items[id] || state.items[idOf(r.url)];
        if (existing) {
          if (existing.url !== r.url && !(existing.alsoIn || []).some((x) => x.url === r.url)) {
            existing.alsoIn = [...(existing.alsoIn || []), { url: r.url, number: r.post?.number || 0, author: r.author, at: r.at }].slice(0, 20);
          }
          continue;
        }
        const item = {
          id, url: r.url, source, author: r.author, at: r.at, kind: r.kind, where: r.where || "", title: r.title || "",
          thread: threadKey, post: r.post || null, replyTo: r.replyTo || null,
          listing: { kind: listing.kind, id: listing.id, name: listing.name, href: listing.href, general: Boolean(listing.general) },
          matched: listing.needle, collectedAt: now, status: "new",
          affiliate: hasAffiliateLink(r.text, listing.needle),
        };
        item.line = lineOf(item);
        state.items[id] = item;
        fresh.push(item);
        run[source].matched++;
        found++;
      }
    }
    state.checked[key(source, term)] = now;
    checked++;
  }

  /*
   * Relevance, after the domain match and before the Inbox. Three rules:
   *   - a Shopify-only listing passes: its domain is unambiguous
   *   - anything posted in the Shopify Community or the developer community
   *     passes: where it was posted is the evidence
   *   - a general brand mentioned anywhere else is judged by the model on the
   *     post (Shopify named, an app-vendor topic, another listed tool, a known
   *     ecosystem handle), and the reason is stored either way
   * What fails is kept as "filtered", out of the Inbox, in a collapsed group,
   * so an over-eager filter can be seen. With no model, a general brand's
   * mention waits as filtered with "not judged yet" and is judged next run.
   */
  for (const m of Object.values(state.items)) {
    if (m.relevance || m.status === "removed") continue;
    if (!m.listing?.general) { m.relevance = { relevant: true, by: "listing", reason: "A Shopify-only listing: its domain is unambiguous." }; continue; }
    if (SHOPIFY_SOURCES.has(m.source)) { m.relevance = { relevant: true, by: "source", reason: `Posted in the ${SOURCE_LABEL[m.source]}.` }; continue; }
  }
  const toJudge = Object.values(state.items).filter((m) => m.listing?.general && !SHOPIFY_SOURCES.has(m.source) && m.status !== "removed" && (!m.relevance || m.relevance.by === "pending")).slice(0, MAX_JUDGED);
  for (const m of toJudge) {
    if (Date.now() - started > budgetMs + 40_000) break;
    const v = judge ? await judge(m).catch(() => null) : null;
    if (!v || typeof v.relevant !== "boolean") {
      m.relevance = { relevant: false, by: "pending", reason: judge ? "Could not be judged this run; tried again next run." : "Not judged yet: no model available." };
      if (m.status === "new") m.status = "filtered";
      continue;
    }
    m.relevance = { relevant: v.relevant, by: "model", reason: String(v.reason || "").slice(0, 240), at: now };
    if (!v.relevant && (m.status === "new" || m.status === "filtered")) m.status = "filtered";
    if (v.relevant && m.status === "filtered") m.status = "new";
  }

  /* A summary of what each new mention's post said, in our words, from the
     post and the one it answers (lib/mentionDraft.js). Budgeted: what does
     not fit this run is summarised on the next. */
  if (summarise) {
    const pending = Object.values(state.items).filter((m) => m.status === "new" && !m.summary && !m.summaryTried).slice(0, MAX_SUMMARIES);
    for (const m of pending) {
      if (Date.now() - started > budgetMs + 40_000) break;
      const r = await summarise(m).catch(() => null);
      m.summaryTried = now;
      if (r?.summary) Object.assign(m, { summary: r.summary, summaryBy: r.provider || "" });
      if (r?.replyAuthor && m.replyTo && !m.replyTo.author) m.replyTo.author = r.replyAuthor;
    }
  }

  /* One account linking the same listing three or more times is marked:
     the bot posting AI filler with a partnerstack.com link 56 times, the
     account repeating an affiliate link 12 times. */
  const byAuthor = {};
  for (const m of Object.values(state.items)) if (m.author) {
    const k = `${m.source}|${m.author}|${m.listing?.id}`;
    byAuthor[k] = (byAuthor[k] || 0) + 1;
  }
  for (const m of Object.values(state.items)) m.repeat = Boolean(m.author && byAuthor[`${m.source}|${m.author}|${m.listing?.id}`] >= 3);

  /* What each source did this run, kept with the last ten. */
  for (const [source, r] of Object.entries(run)) {
    const st = r.canary === -1 || (r.blocked && r.blocked >= r.requests) ? (r.blocked ? "blocked" : "error")
      : r.canary === 0 ? "empty" : r.errors && r.errors >= r.requests && r.requests ? "error" : "ok";
    const prev = state.sources[source] || {};
    const rec = { state: st, at: now, ...r };
    state.sources[source] = {
      ...rec,
      since: st === prev.state ? (prev.since || now) : now,
      history: [{ at: now, state: st, requests: r.requests, blocked: r.blocked, errors: r.errors, matched: r.matched, canary: r.canary, last: r.last }, ...(prev.history || [])].slice(0, 10),
    };
    console.log(`[mentions] ${source}: ${st} · canary ${r.canary} · ${r.requests} queries, ${r.blocked} blocked, ${r.errors} failed, ${r.matched} new${r.last ? ` · last ${r.last}` : ""}`);
  }

  state.lastRunAt = now;
  await write(KEYS.mentions, state);
  console.log(`[mentions] ${checked} of ${due.length} searches due, ${found} new`);
  const filtered = fresh.filter((m) => m.status === "filtered");
  const byListing = {};
  for (const m of fresh) {
    const k = m.listing.name;
    byListing[k] ||= { in: 0, passed: 0, general: Boolean(m.listing.general) };
    byListing[k].in++;
    if (m.status !== "filtered") byListing[k].passed++;
  }
  return { checked, due: due.length, found, passed: found - filtered.length, filtered: filtered.length, byListing, sources: Object.fromEntries(Object.entries(state.sources).map(([k, v]) => [k, { state: v.state, canary: v.canary, requests: v.requests, blocked: v.blocked, errors: v.errors, matched: v.matched, last: v.last }])) };
}

/** Sources that cannot be read right now: what an empty Inbox must not hide. */
export const unreadableSources = (state) =>
  Object.entries(state?.sources || {}).filter(([, v]) => v.state !== "ok").map(([k, v]) => ({ source: k, ...v }));

/** An editor's decision. A removal needs one of the three reasons, and is kept. */
export async function decideMention(id, { action, reason = "" } = {}, by = "") {
  const state = await getMentions();
  const m = state.items[id];
  if (!m) return { error: "No such mention." };
  if (action === "seen") m.status = "seen";
  /* Genuine, not worth acting on: kept, out of the Inbox, no reason needed.
     Most mentions end here. */
  else if (action === "dismiss") Object.assign(m, { status: "dismissed", decidedBy: by, decidedAt: new Date().toISOString() });
  /* Marked by hand, because the handle cannot show it: a founder on a personal
     account, an employee, an agency posting for a client. Kept and visible,
     never counted as other people and never published. */
  else if (action === "vendor" || action === "unvendor") Object.assign(m, { vendor: action === "vendor", vendorBy: by, vendorAt: new Date().toISOString() });
  /* Not the vendor, not neutral either: somebody recommending a tool while
     running a rival or a related business. Recorded with a note. */
  else if (action === "interest") {
    const note = String(reason || "").replace(/\s+/g, " ").trim().slice(0, 200);
    if (!note) return { error: "Say what the interest is, in a few words." };
    Object.assign(m, { interest: { note, by, at: new Date().toISOString() } });
  } else if (action === "uninterest") m.interest = null;
  /* The filter got it wrong: keep it, and say so, so the miss is on record. */
  else if (action === "keep") Object.assign(m, { status: "new", relevance: { ...(m.relevance || {}), relevant: true, by: "editor", overruled: m.relevance?.reason || "", reason: "Kept by the editor over the filter." } });
  else if (action === "remove") {
    if (!REMOVAL_REASONS[reason]) return { error: "Removal needs one of: not about this listing, spam, private data." };
    Object.assign(m, { status: "removed", reason, decidedBy: by, decidedAt: new Date().toISOString() });
  } else if (action === "restore") {
    Object.assign(m, { status: "seen", reason: "", decidedBy: by, decidedAt: new Date().toISOString() });
  } else return { error: "Unknown action." };
  await write(KEYS.mentions, state);
  return { mention: m };
}

/** Published to the feed: it leaves the Inbox and keeps the feed row's id. */
export async function markMentionPublished(id, feedId, by = "") {
  const state = await getMentions();
  const m = state.items[id];
  if (!m) return null;
  Object.assign(m, { status: "published", feedId, decidedBy: by, decidedAt: new Date().toISOString() });
  await write(KEYS.mentions, state);
  return m;
}

/** Newest first. */
export const mentionList = (state, { includeRemoved = false } = {}) =>
  Object.values(state.items || {}).filter((m) => includeRemoved || m.status !== "removed")
    .sort((a, b) => (b.at || "").localeCompare(a.at || "") || (b.collectedAt || "").localeCompare(a.collectedAt || ""));
