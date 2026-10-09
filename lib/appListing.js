/*
 * Reading one public Shopify App Store listing, for the growth recommender.
 *
 * What it may fetch, and why only that:
 *
 *  - `https://apps.shopify.com/<handle>`, the listing page, and nothing else.
 *    apps.shopify.com/robots.txt allows listing pages for every agent and
 *    disallows `*q=*`, which is App Store search. So keyword position, which
 *    can only be read by searching, is not fetched: there is no free source
 *    whose terms permit it (Applora's licence does not cover redistribution,
 *    and its API is paid). The recommender says so rather than guessing.
 *  - One page per request, started by a signed-in person asking about their
 *    own app. Not a crawl, not the reviews pages, nothing stored but the
 *    handful of facts below.
 *
 * Facts come from the listing's own JSON-LD where it carries them (name,
 * rating, review count) and from the page's labelled text otherwise
 * (launched, categories, pricing summary, Built for Shopify). Anything that
 * does not parse is absent, never guessed: a recommendation built on a wrong
 * launch date is worse than one that says it could not read it.
 */

const UA = "Mozilla/5.0 (compatible; watchfor.tools listing reader; +https://watchfor.tools)";
const MAX_BYTES = 1_500_000;

/** The handle from anything that looks like a listing URL, or null. Pure. */
/* App Store paths that are not an app's listing. */
const NOT_LISTINGS = new Set(["search", "categories", "collections", "stories", "partners", "internal", "services",
  "sitemap", "login", "logout", "account", "browse", "apps", "recommendations", "compare"]);

export function listingHandle(input) {
  let u;
  try { u = new URL(String(input || "").trim()); } catch { return null; }
  if (u.protocol !== "https:" || u.hostname !== "apps.shopify.com") return null;
  // Drop any locale prefix ("/fr/judgeme") and anything after the handle.
  const parts = u.pathname.split("/").filter(Boolean);
  const handle = /^[a-z]{2}(-[A-Za-z]{2,4})?$/.test(parts[0] || "") && parts[1] ? parts[1] : parts[0];
  return handle && /^[a-z0-9][a-z0-9-]{1,80}$/.test(handle) && !NOT_LISTINGS.has(handle) ? handle : null;
}

export const listingUrl = (handle) => `https://apps.shopify.com/${handle}`;

const decode = (s) => String(s || "")
  .replace(/&amp;/g, "&").replace(/&#39;|&#x27;/g, "'").replace(/&quot;/g, '"')
  .replace(/&#183;?/g, "·").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();

/** Facts from listing HTML. Pure, so it is tested against a fixture. */
export function parseListing(html) {
  const out = {};
  for (const m of String(html).matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      const d = JSON.parse(m[1]);
      for (const n of [].concat(d["@graph"] || d)) {
        if (n["@type"] !== "SoftwareApplication") continue;
        if (n.name) out.name = decode(n.name);
        if (n.description) out.description = decode(n.description).slice(0, 300);
        const r = n.aggregateRating;
        if (r && Number.isFinite(Number(r.ratingValue))) out.rating = Number(r.ratingValue);
        if (r && Number.isFinite(Number(r.ratingCount))) out.reviews = Number(r.ratingCount);
      }
    } catch { /* a malformed block costs those fields, nothing else */ }
  }
  const lines = String(html)
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, "\n")
    .split("\n").map(decode).filter(Boolean);
  const after = (label) => { const i = lines.findIndex((l) => l === label); return i >= 0 ? lines[i + 1] : ""; };

  const launched = after("Launched");
  // "March 4, 2026" parses as local midnight, which is the 3rd in UTC for
  // anybody west of Greenwich. Pinned to noon UTC so the day is the day.
  const t = Date.parse(`${launched} 12:00 UTC`);
  if (Number.isFinite(t)) out.launched = new Date(t).toISOString().slice(0, 10);
  const cat = after("Categories");
  if (cat && cat.length < 60) out.category = cat;
  const pricing = after("Pricing");
  if (pricing && pricing.length < 120) out.pricing = pricing;
  out.builtForShopify = lines.includes("Built for Shopify");
  return out;
}

/** Fetch and parse. Throws on failure so the caller can carry on without it. */
export async function readListing(handle) {
  const res = await fetch(listingUrl(handle), {
    headers: { "User-Agent": UA, Accept: "text/html" },
    redirect: "follow",
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (res.status === 404) throw new Error("not found");
  if (!res.ok) throw new Error(`listing ${res.status}`);
  const facts = parseListing((await res.text()).slice(0, MAX_BYTES));
  if (!facts.name) throw new Error("not a listing page");
  return facts;
}

/** Whole months between a launch date and today, for "launched 4 months ago". */
export const monthsSince = (iso, today = new Date().toISOString().slice(0, 10)) => {
  if (!iso) return null;
  const [y1, m1] = iso.split("-").map(Number);
  const [y2, m2] = today.split("-").map(Number);
  return Math.max(0, (y2 - y1) * 12 + (m2 - m1));
};
