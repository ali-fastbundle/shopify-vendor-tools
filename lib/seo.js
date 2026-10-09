/*
 * Structured data, in one place.
 *
 * Everything a crawler or a model reads about this site that is not the visible
 * page: the JSON-LD graph, the per-tool description, the related-tool links.
 *
 * It is a lib rather than inline JSX because the same facts have to agree
 * across four surfaces (the homepage graph, each tool page's graph, the
 * sitemap, llms.txt), and four hand-written copies of "what is a tool" is how
 * one of them ends up claiming a rating for something nobody has reviewed.
 *
 * ------------------------------------------------------------------
 *  The one rule worth stating twice
 * ------------------------------------------------------------------
 * `aggregateRating` is emitted only where a real review exists. Schema.org
 * requires ratingCount to be a positive integer, Google's Rich Results Test
 * flags a zero, and a directory that claims ratings it does not have is
 * exactly the thing this site is meant not to be. `ratingOf` returns null
 * rather than a zero, and the callers spread it, so absent is the default and
 * present is the deliberate case.
 */

import {
  TOOLS, CATEGORIES, catOf, catsOf, isInCat, isPrimaryCat, ownerOf,
  AUTHOR, AUTHOR_URL, HEADLINE,
} from "./tools";
import { NEWSLETTERS } from "./newsletters";

export const SITE = "https://watchfor.tools";
export const SITE_NAME = "watchfor.tools";

export const toolUrl = (id) => `${SITE}/tools/${id}`;
export const categoryUrl = (id) => `${SITE}/categories/${id}`;
export const CATEGORIES_URL = `${SITE}/categories`;

/*
 * The description a tool page carries, and the only place it is decided.
 *
 * Built from `one` rather than from the site description, because sixty pages
 * sharing one meta description is sixty pages Google treats as one. The
 * category and price are appended where they fit, since a description that
 * reads like a sentence and says what it costs is the one an LLM will quote.
 */
export function toolDescription(tool) {
  const bits = [tool.one];
  const cat = catOf(tool.cat).label;
  if (cat) bits.push(`${cat} for Shopify app vendors`);
  if (tool.price) bits.push(tool.price);
  return bits.filter(Boolean).join(". ").replace(/\.\./g, ".").slice(0, 300);
}

/** Alt text that says what the image is of, not that it is an image. */
export const logoAlt = (tool) => `${tool.name} logo`;

/*
 * Ratings, or nothing at all.
 *
 * `reviews` is the public map from /api/data. A tool with no reviews returns
 * null and the caller spreads nothing, which is the whole point: an
 * aggregateRating of 0 from 0 reviews is invalid structured data and a lie
 * about the directory.
 */
export function ratingOf(toolId, reviews = {}) {
  const list = Array.isArray(reviews[toolId]) ? reviews[toolId] : [];
  if (!list.length) return null;
  const value = list.reduce((n, r) => n + (Number(r.rating) || 0), 0) / list.length;
  if (!Number.isFinite(value) || value <= 0) return null;
  return {
    "@type": "AggregateRating",
    ratingValue: Number(value.toFixed(2)),
    ratingCount: list.length,
    reviewCount: list.length,
    bestRating: 5,
    worstRating: 1,
  };
}

/*
 * Price as an Offer, or no Offer at all.
 *
 * Our `price` is editorial prose: "From $49/mo", "$39 / $89 per month", "Not
 * published". Google requires an Offer to carry a price or a priceSpecification
 * and rejects one that carries neither, so an Offer built straight from the
 * prose is invalid on every paid tool. The first version of this emitted
 * exactly that on nine of them.
 *
 * Three cases, in order:
 *
 *   free tier      a real Offer at 0, which is both valid and true
 *   a figure we
 *   can read       an AggregateOffer with lowPrice, which is the type meant
 *                  for "from this much" and does not claim to be the only price
 *   prose only     no offers key. An entity without offers is merely not
 *                  eligible for a price rich result; an entity with a wrong
 *                  price is a wrong price, and that is the number that gets
 *                  quoted back at you.
 *
 * The full string always survives in the application's own description, so
 * nothing is lost by declining to guess at a number.
 */
const firstFigure = (price) => {
  const m = /\$\s?([0-9][0-9,]*)/.exec(String(price || ""));
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
};

export function offerOf(tool) {
  const base = {
    priceCurrency: "USD",
    description: tool.price || "Pricing not published",
    availability: "https://schema.org/InStock",
    url: tool.url,
  };

  if (tool.free) return { "@type": "Offer", price: "0", ...base };

  const low = firstFigure(tool.price);
  if (low !== null) return { "@type": "AggregateOffer", lowPrice: low, ...base };

  return null;
}

export function softwareApplication(tool, { reviews = {}, full = false } = {}) {
  const rating = ratingOf(tool.id, reviews);
  return {
    "@type": "SoftwareApplication",
    "@id": `${toolUrl(tool.id)}#software`,
    name: tool.name,
    description: full ? tool.note : tool.one,
    url: toolUrl(tool.id),
    sameAs: [tool.url, ...Object.values(tool.social || {})].filter(Boolean),
    applicationCategory: "BusinessApplication",
    applicationSubCategory: catOf(tool.cat).label,
    operatingSystem: "Web",
    /* Absent rather than empty when the price is prose we will not guess at. */
    ...(offerOf(tool) ? { offers: offerOf(tool) } : {}),
    ...(rating ? { aggregateRating: rating } : {}),
    ...(tool.owner ? { author: { "@type": "Organization", name: tool.owner } } : {}),
    ...(tool.updated ? { dateModified: tool.updated } : {}),
  };
}

const person = {
  "@type": "Person",
  "@id": `${SITE}#author`,
  name: AUTHOR,
  ...(AUTHOR_URL ? { url: AUTHOR_URL, sameAs: [AUTHOR_URL] } : {}),
};

const organization = {
  "@type": "Organization",
  "@id": `${SITE}#organization`,
  name: SITE_NAME,
  url: SITE,
  description: "An independent directory of tools for Shopify app vendors. Not affiliated with Shopify.",
  founder: { "@id": `${SITE}#author` },
};

const website = {
  "@type": "WebSite",
  "@id": `${SITE}#website`,
  url: SITE,
  name: SITE_NAME,
  description: HEADLINE,
  publisher: { "@id": `${SITE}#organization` },
  author: { "@id": `${SITE}#author` },
  inLanguage: "en",
};

/** The homepage graph: who we are, plus every tool as a list. */
export function homeGraph(tools, reviews = {}) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      person,
      organization,
      website,
      {
        "@type": "CollectionPage",
        "@id": `${SITE}#collection`,
        url: SITE,
        name: HEADLINE,
        description: "Every tool built for the people who build Shopify apps.",
        isPartOf: { "@id": `${SITE}#website` },
        about: { "@id": `${SITE}#organization` },
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: tools.length,
          itemListOrder: "https://schema.org/ItemListUnordered",
          itemListElement: tools.map((tool, i) => ({
            "@type": "ListItem",
            position: i + 1,
            item: softwareApplication(tool, { reviews }),
          })),
        },
      },
    ],
  };
}

/** One tool's page: the product, and the trail back to the directory. */
export function toolGraph(tool, reviews = {}) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      person,
      organization,
      website,
      softwareApplication(tool, { reviews, full: true }),
      {
        "@type": "WebPage",
        "@id": `${toolUrl(tool.id)}#page`,
        url: toolUrl(tool.id),
        name: `${tool.name}: ${catOf(tool.cat).label}`,
        description: toolDescription(tool),
        isPartOf: { "@id": `${SITE}#website` },
        primaryImageOfPage: tool.logo ? { "@type": "ImageObject", url: `${SITE}${tool.logo}` } : undefined,
        mainEntity: { "@id": `${toolUrl(tool.id)}#software` },
        breadcrumb: {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Directory", item: SITE },
            /* The category page, matching the breadcrumb the page renders.
               `/#cat` pointed at the directory and set no filter, because the
               filter is client state. */
            { "@type": "ListItem", position: 2, name: catOf(tool.cat).label, item: categoryUrl(tool.cat) },
            { "@type": "ListItem", position: 3, name: tool.name, item: toolUrl(tool.id) },
          ],
        },
      },
    ],
  };
}

/*
 * Related tools, so a crawler arriving on any single page can reach the rest
 * and a reader has somewhere to go next.
 *
 * Three tiers, most specific first, and **no padding**. The third tier used to
 * be "the rest of the catalogue", labelled "also listed" and sliced to fill
 * eight rows, which meant a Support & CX page with two siblings showed those
 * two and then six App Store ASO tools under a label that only ever meant
 * "also listed in this directory". That is true of all sixty entries, so it
 * said nothing, and it read as a secondary-category feature fed the wrong data.
 *
 * **Fewer than three genuine matches shows fewer, including none.** An empty
 * Related tools section renders nothing at all, which is rule E: an honest gap
 * is quieter than a list of unrelated products, and a thin category is a fact
 * about the category rather than a hole to fill.
 *
 * The tiers:
 *
 *   named as a competitor   `competes`, symmetric, and the only tier that can
 *                           cross a category boundary. Mantle is winding down
 *                           in Analytics & billing and three of the things
 *                           replacing it are Partner & affiliate tools, so
 *                           category overlap cannot find them and this is the
 *                           most useful list on that page.
 *   same owner              `linked`, `suite`, or a matching `ownerOf`.
 *                           `ownerOf` rather than `owner`, so two entries
 *                           carrying a vacuous owner value cannot match each
 *                           other on it. Invariant 32.
 *   shared category         any category in common, primary or secondary,
 *                           which is the whole reason `alsoIn` exists.
 *
 * The label names the shared category rather than saying "same category",
 * because a reader looking at a row already labelled App Store ASO on a
 * Support & CX page needs to know *which* thing the two have in common. It is
 * also how a secondary overlap reads as one.
 *
 * **Except when the row already says it.** Every row prints the related tool's
 * own primary category next to its name, so where that is also the category
 * the two share, the label repeats it: "KivoSupport  Support & CX  both in
 * Support & CX". The label is empty in that case and the row renders none, and
 * the reader can see the two categories match because they are the same words.
 * This is only visible by looking at the page, which is the argument for doing
 * that: the tests were green on the stutter.
 *
 * `dying` sorts last inside every tier, the same rule the grid follows: a
 * shut-down product never leads a list.
 */
export function relatedTools(tool, all = TOOLS, limit = 8) {
  const others = all.filter((t) => t.id !== tool.id);
  const mine = catsOf(tool);

  const named = (t) =>
    (tool.competes || []).includes(t.id) || (t.competes || []).includes(tool.id);

  const owner = ownerOf(tool);
  const sameOwner = (t) =>
    Boolean((tool.linked && (t.name === tool.linked || t.linked === tool.name))
      || (tool.suite && t.suite === tool.suite)
      || (owner && ownerOf(t) === owner));

  /* The first category the two have in common, which is what the label says. */
  const shared = (t) => mine.find((id) => isInCat(t, id)) || null;

  const tiers = [
    { pick: named, why: () => "named as a direct competitor" },
    { pick: (t) => !named(t) && sameOwner(t), why: () => "same owner" },
    {
      pick: (t) => !named(t) && !sameOwner(t) && Boolean(shared(t)),
      why: (t) => {
        const id = shared(t);
        /* Both lead with it, so the row's own label already says this. */
        if (id === t.cat && id === tool.cat) return "";
        return `both in ${catOf(id).label}`;
      },
    },
  ];

  const out = [];
  const taken = new Set();
  for (const tier of tiers) {
    const rows = others
      .filter((t) => !taken.has(t.id) && tier.pick(t))
      /* Same rule as every order in the grid: a wind-down never leads. */
      .sort((a, b) => Number(Boolean(a.dying)) - Number(Boolean(b.dying)));
    for (const t of rows) {
      taken.add(t.id);
      out.push({ tool: t, why: tier.why(t) });
    }
  }
  return out.slice(0, limit);
}

export const categoryOf = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[0];

/* ================================================================== */
/*  Category pages                                                     */
/*                                                                     */
/*  Nine categories that existed only as a client-side filter chip, so   */
/*  the directory had one crawlable address for the whole catalogue and  */
/*  none for "every store database we know about", which is the query    */
/*  somebody actually types. Each is a real page now, server rendered,   */
/*  with its own title, description, canonical and graph.                */
/*                                                                     */
/*  Everything here reads `isInCat`, so a tool with a secondary          */
/*  category is on both pages and the count on each says so. `members`   */
/*  keeps the primary ones first and marks which is which, because       */
/*  "also does this" and "this is what it is" are different answers to   */
/*  somebody scanning the page.                                         */
/* ================================================================== */

/** Tools in a category, primary members first, each marked. */
export function categoryMembers(catId, all = TOOLS) {
  const inIt = all.filter((t) => isInCat(t, catId));
  const primary = inIt.filter((t) => isPrimaryCat(t, catId));
  const secondary = inIt.filter((t) => !isPrimaryCat(t, catId));
  return [
    ...primary.map((tool) => ({ tool, primary: true })),
    ...secondary.map((tool) => ({ tool, primary: false })),
  ];
}

/** Every category with its live count, for the index page. */
export const categoryCounts = (all = TOOLS) =>
  CATEGORIES.map((cat) => ({
    cat,
    total: all.filter((t) => isInCat(t, cat.id)).length,
    primary: all.filter((t) => isPrimaryCat(t, cat.id)).length,
  }));

/*
 * Related categories, so a category page is not a dead end either.
 *
 * Overlap first, and it is real information rather than a guess: a category
 * that shares tools with this one shares them because an editor filed a tool
 * into both, and how many tools do is the strength of the relationship. The
 * rest of the directory follows so every category page still links to every
 * other within two hops.
 */
export function relatedCategories(catId, all = TOOLS, limit = 4) {
  const mine = all.filter((t) => isInCat(t, catId));
  const scored = CATEGORIES
    .filter((c) => c.id !== catId)
    .map((c) => ({ cat: c, shared: mine.filter((t) => isInCat(t, c.id)).length }))
    .sort((a, b) => b.shared - a.shared || a.cat.label.localeCompare(b.cat.label));
  return scored.slice(0, limit).map(({ cat, shared }) => ({
    cat,
    shared,
    why: shared > 0
      ? `${shared} tool${shared === 1 ? "" : "s"} in both`
      : "also in the directory",
  }));
}

/*
 * The description a category page carries. Its own sentence, built from the
 * blurb and the live count, for the same reason a tool page does not share the
 * site description: nine pages with one description is nine pages treated as
 * one.
 */
export function categoryDescription(cat, count) {
  const n = `${count} tool${count === 1 ? "" : "s"}`;
  return `${cat.blurb} ${n} for Shopify app vendors, each with the caveat worth knowing before you pay.`
    .replace(/\s+/g, " ").slice(0, 300);
}

/** One category: the collection, its tools, and the trail back. */
export function categoryGraph(cat, members, reviews = {}) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      person,
      organization,
      website,
      {
        "@type": "CollectionPage",
        "@id": `${categoryUrl(cat.id)}#collection`,
        url: categoryUrl(cat.id),
        name: `${cat.label} tools for Shopify app vendors`,
        description: categoryDescription(cat, members.length),
        isPartOf: { "@id": `${SITE}#website` },
        breadcrumb: {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Directory", item: SITE },
            { "@type": "ListItem", position: 2, name: "Categories", item: CATEGORIES_URL },
            { "@type": "ListItem", position: 3, name: cat.label, item: categoryUrl(cat.id) },
          ],
        },
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: members.length,
          itemListOrder: "https://schema.org/ItemListUnordered",
          itemListElement: members.map(({ tool }, i) => ({
            "@type": "ListItem",
            position: i + 1,
            item: softwareApplication(tool, { reviews }),
          })),
        },
      },
    ],
  };
}

/** The index: a list of the categories, not of the tools in them. */
export function categoriesGraph(counts) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      person,
      organization,
      website,
      {
        "@type": "CollectionPage",
        "@id": `${CATEGORIES_URL}#collection`,
        url: CATEGORIES_URL,
        name: "Categories",
        description: "Every category of tool built for Shopify app vendors.",
        isPartOf: { "@id": `${SITE}#website` },
        breadcrumb: {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Directory", item: SITE },
            { "@type": "ListItem", position: 2, name: "Categories", item: CATEGORIES_URL },
          ],
        },
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: counts.length,
          itemListElement: counts.map(({ cat, total }, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: cat.label,
            description: cat.blurb,
            url: categoryUrl(cat.id),
            ...(total ? { additionalProperty: {
              "@type": "PropertyValue", name: "toolCount", value: total,
            } } : {}),
          })),
        },
      },
    ],
  };
}

/* ================================================================== */
/*  Newsletters                                                        */
/*                                                                     */
/*  The same contract as tools, in the newsletter's own shape. A       */
/*  newsletter is a Periodical, not a SoftwareApplication, and its      */
/*  description leads on who writes it and how often rather than on     */
/*  price, because that is what the reader is choosing on. ratingOf is  */
/*  id-keyed and shared, so a reviewed newsletter gets an               */
/*  aggregateRating on exactly the same terms as a tool.               */
/* ================================================================== */
export const NEWSLETTERS_URL = `${SITE}/newsletters`;
export const newsletterUrl = (id) => `${SITE}/newsletters/${id}`;

/* Audience split, the one editorial fact the section is organised around: a
   couple of these are written for app vendors, the rest are merchant media read
   sideways. `shopifySpecific` is the honest proxy for "about the platform". */
export const isForVendors = (n) => Boolean(n.shopifySpecific);

export function newsletterDescription(n) {
  const bits = [n.one];
  const run = [n.cadence, n.issueCount ? `${n.issueCount} issues` : ""].filter(Boolean).join(", ");
  if (run) bits.push(run);
  if (n.free) bits.push("Free");
  return bits.filter(Boolean).join(". ").replace(/\.\./g, ".").slice(0, 300);
}

/*
 * Related newsletters: same audience side first (app-vendor vs merchant), then
 * same publisher, then anything else, never padding. Fewer than the limit shows
 * fewer, including none, exactly like relatedTools.
 */
export function relatedNewsletters(n, all = NEWSLETTERS, limit = 4) {
  const others = all.filter((x) => x.id !== n.id);
  const seen = new Set();
  const out = [];
  const take = (list) => {
    for (const x of list) {
      if (out.length >= limit || seen.has(x.id)) continue;
      seen.add(x.id); out.push(x);
    }
  };
  if (n.publisher) take(others.filter((x) => x.publisher && x.publisher === n.publisher));
  take(others.filter((x) => isForVendors(x) === isForVendors(n)));
  return out.slice(0, limit);
}

export function newsletterGraph(n, reviews = {}) {
  const rating = ratingOf(n.id, reviews);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": ["WebPage", "CollectionPage"],
        "@id": `${newsletterUrl(n.id)}#page`,
        url: newsletterUrl(n.id),
        name: `${n.name} on ${SITE_NAME}`,
        description: newsletterDescription(n),
        isPartOf: { "@id": `${SITE}/#website` },
        mainEntity: { "@id": `${newsletterUrl(n.id)}#periodical` },
        breadcrumb: {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: SITE },
            { "@type": "ListItem", position: 2, name: "Newsletters", item: NEWSLETTERS_URL },
            { "@type": "ListItem", position: 3, name: n.name, item: newsletterUrl(n.id) },
          ],
        },
      },
      {
        "@type": "Periodical",
        "@id": `${newsletterUrl(n.id)}#periodical`,
        name: n.name,
        url: n.url,
        description: n.one,
        ...(n.publisher ? { publisher: { "@type": "Organization", name: n.publisher } } : {}),
        ...(n.author ? { author: { "@type": "Person", name: n.author } } : {}),
        ...(rating ? { aggregateRating: rating } : {}),
      },
    ],
  };
}

/* ================================================================== */
/*  Events                                                             */
/*                                                                     */
/*  An Event node only where the date is exact. schema.org Event needs  */
/*  a startDate, and an inferred or approximate one written there would */
/*  be a date nobody announced, stated as fact to every crawler that    */
/*  reads it. Everything else is a WebPage about the event, which is    */
/*  true and merely not eligible for an event rich result.             */
/* ================================================================== */
export const EVENTS_URL = `${SITE}/events`;
export const eventUrl = (id) => `${SITE}/events/${id}`;

export function eventDescription(e) {
  const where = [e.city, e.country].filter((x) => x && !/^n\/a$/i.test(x)).join(", ");
  const bits = [e.one, e.at && e.at.label, where];
  return bits.filter(Boolean).join(". ").replace(/\.\./g, ".").slice(0, 300);
}

export function eventGraph(e) {
  const at = e.at || {};
  const exact = at.mode === "exact" && !at.discontinued;
  const where = [e.city, e.country].filter((x) => x && !/^n\/a$/i.test(x));
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${eventUrl(e.id)}#page`,
        url: eventUrl(e.id),
        name: `${e.name} on ${SITE_NAME}`,
        description: eventDescription(e),
        isPartOf: { "@id": `${SITE}/#website` },
        ...(exact ? { mainEntity: { "@id": `${eventUrl(e.id)}#event` } } : {}),
        breadcrumb: {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: SITE },
            { "@type": "ListItem", position: 2, name: "Events", item: EVENTS_URL },
            { "@type": "ListItem", position: 3, name: e.name, item: eventUrl(e.id) },
          ],
        },
      },
      ...(exact ? [{
        "@type": "Event",
        "@id": `${eventUrl(e.id)}#event`,
        name: e.name,
        url: e.url,
        description: e.one,
        startDate: at.date,
        endDate: at.end || at.date,
        eventStatus: "https://schema.org/EventScheduled",
        eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
        ...(where.length ? {
          location: {
            "@type": "Place",
            name: e.venue && !/^(tbd|n\/a)$/i.test(e.venue) ? e.venue : where.join(", "),
            address: {
              "@type": "PostalAddress",
              ...(where[0] ? { addressLocality: where[0] } : {}),
              ...(where[1] ? { addressCountry: where[1] } : {}),
            },
          },
        } : {}),
        ...(e.organizer ? { organizer: { "@type": "Organization", name: e.organizer } } : {}),
      }] : []),
    ],
  };
}

/* ================================================================== */
/*  Blog                                                               */
/* ================================================================== */

export const BLOG_URL = `${SITE}/blog`;
export const postUrl = (slug) => `${SITE}/blog/${slug}`;

/*
 * One Article per post. Author and publisher are the site's own Person and
 * Organization by @id, the same nodes the homepage defines, so there is one
 * description of who writes this rather than one per page. `mentions` points
 * at each linked tool's SoftwareApplication node on its own page rather than
 * describing it again: the listing is the source of truth for the tool, the
 * post only says it is discussed here.
 */
export function articleGraph(post, mentions = []) {
  const url = postUrl(post.slug);
  return {
    "@context": "https://schema.org",
    "@graph": [
      person,
      organization,
      {
        "@type": "Article",
        "@id": `${url}#article`,
        headline: post.title,
        description: post.description,
        url,
        mainEntityOfPage: { "@id": `${url}#page` },
        datePublished: post.date,
        dateModified: post.updated || post.date,
        author: { "@id": `${SITE}#author` },
        publisher: { "@id": `${SITE}#organization` },
        isPartOf: { "@id": `${SITE}#website` },
        inLanguage: "en",
        ...(mentions.length ? {
          // The listing pages, by the @id each one already declares. A
          // SoftwareApplication here would be a second, priceless description
          // of the tool, which is the node Google reports as incomplete.
          mentions: mentions.map((m) => {
            const u = m.kind === "tool" ? toolUrl(m.id) : `${SITE}/${m.kind}s/${m.id}`;
            return { "@type": "WebPage", "@id": `${u}#page`, url: u, name: m.name };
          }),
        } : {}),
      },
      {
        "@type": "WebPage",
        "@id": `${url}#page`,
        url,
        name: post.title,
        isPartOf: { "@id": `${SITE}#website` },
        mainEntity: { "@id": `${url}#article` },
        breadcrumb: {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Directory", item: SITE },
            { "@type": "ListItem", position: 2, name: "Blog", item: BLOG_URL },
            { "@type": "ListItem", position: 3, name: post.title, item: url },
          ],
        },
      },
    ],
  };
}

export function blogGraph(posts) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${BLOG_URL}#collection`,
    url: BLOG_URL,
    name: "Blog",
    isPartOf: { "@id": `${SITE}#website` },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: posts.length,
      itemListElement: posts.map((p, i) => ({
        "@type": "ListItem", position: i + 1, url: postUrl(p.slug), name: p.title,
      })),
    },
  };
}
