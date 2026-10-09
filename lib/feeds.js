/*
 * Reading a newsletter's RSS or Atom feed for new issues.
 *
 * Only what a notification needs comes out: a stable key, the title, the link
 * and the date. Never the body. We send people to the issue, we do not
 * republish it: a newsletter's text is the publisher's, and a digest that
 * quoted it would be a second copy of their work in somebody's inbox.
 *
 * A regex parser rather than a dependency, because the job is four fields
 * from two well-known shapes. Anything it cannot read yields no items, which
 * the caller treats as "nothing new", never as "everything is new".
 */

const UA = "Mozilla/5.0 (compatible; watchfor.tools feed reader; +https://watchfor.tools)";
const MAX_BYTES = 2_000_000;

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const decode = (s) => String(s || "")
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/<[^>]+>/g, "")
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
  .replace(/\s+/g, " ")
  .trim();

const tag = (block, name) => {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decode(m[1]) : "";
};

const isoOf = (s) => {
  const t = Date.parse(s);
  return Number.isFinite(t) ? new Date(t).toISOString() : "";
};

/** Items newest first: `{ key, title, link, date }`. Pure, so it is tested directly. */
export function parseFeed(xml) {
  const text = String(xml || "");
  const out = [];
  for (const m of text.matchAll(/<item[\s>][\s\S]*?<\/item>/gi)) {
    const b = m[0];
    const link = tag(b, "link");
    const title = tag(b, "title");
    const key = tag(b, "guid") || link || title;
    if (key && (link || title)) out.push({ key, title, link, date: isoOf(tag(b, "pubDate") || tag(b, "dc:date")) });
  }
  if (!out.length) {
    for (const m of text.matchAll(/<entry[\s>][\s\S]*?<\/entry>/gi)) {
      const b = m[0];
      const href = (b.match(/<link[^>]*rel="alternate"[^>]*href="([^"]+)"/i) || b.match(/<link[^>]*href="([^"]+)"/i) || [])[1] || "";
      const link = decode(href);
      const title = tag(b, "title");
      const key = tag(b, "id") || link || title;
      if (key && (link || title)) out.push({ key, title, link, date: isoOf(tag(b, "published") || tag(b, "updated")) });
    }
  }
  return out
    .filter((i) => !i.link || /^https?:\/\//i.test(i.link))
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

/** Fetch and parse. Throws on a network or HTTP failure so the caller can keep last run's state. */
export async function fetchFeed(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.5" },
    redirect: "follow",
    signal: AbortSignal.timeout(12_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`feed ${res.status}`);
  const body = (await res.text()).slice(0, MAX_BYTES);
  return parseFeed(body);
}

/*
 * What is new since last time. A key we have seen is not new; neither is an
 * item dated on or before the newest one we saw, which is what keeps a feed
 * that changes its guid scheme from looking like twenty new issues at once.
 * Capped at three regardless: a digest is a nudge, not an archive.
 */
export function newSince(items, prev) {
  if (!prev) return [];
  const seen = new Set(prev.keys || []);
  return items
    .filter((i) => !seen.has(i.key))
    .filter((i) => !(i.date && prev.latest && i.date <= prev.latest))
    .slice(0, 3);
}

/** What to remember: the newest keys and the newest date. */
export const rememberFeed = (items, prev = null) => ({
  keys: [...new Set([...items.map((i) => i.key), ...((prev && prev.keys) || [])])].slice(0, 60),
  latest: items.reduce((d, i) => (i.date && i.date > d ? i.date : d), (prev && prev.latest) || ""),
});
