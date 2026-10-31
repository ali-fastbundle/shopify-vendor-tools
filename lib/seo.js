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
  TOOLS, CATEGORIES, catOf, catsOf, isInCat, isPrimaryCat, ownerOf, categoriesByCount,
  AUTHOR, AUTHOR_URL, HEADLINE, categoryTerm,
} from "./tools";
import { ownershipOf, ownerById, findOwner, appStoreOf } from "./owners";
import { hasOwnerPage } from "./ownerIndex";
import { NEWSLETTERS } from "./newsletters";
import { PODCASTS } from "./podcasts";
import { countTools } from "./toolCount";
import { ratingStats } from "./reviews";

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
  // Only reviews that count (lib/reviews.js): an excluded vendor review is
  // shown on the page and is in neither this number nor the markup.
  const stats = ratingStats(reviews[toolId]);
  if (!stats) return null;
  const { value, count } = stats;
  if (!Number.isFinite(value) || value <= 0) return null;
  return {
    "@type": "AggregateRating",
    ratingValue: Number(value.toFixed(2)),
    ratingCount: count,
    reviewCount: count,
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

/* The owner as the SoftwareApplication's author: its type from lib/owners.js,
   and its page when it has one. Nothing when the owner is the tool itself. */
function authorOf(tool) {
  const o = ownershipOf(tool);
  if (!o || o.own) return {};
  const known = o.id ? ownerById(o.id) : null;
  return { author: {
    "@type": known?.type === "Person" ? "Person" : "Organization",
    name: o.name,
    ...(o.id && hasOwnerPage(o.id) ? { url: `${SITE}/owners/${o.id}` } : {}),
  } };
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
    ...authorOf(tool),
    ...(tool.updated ? { dateModified: tool.updated } : {}),
  };
}

/* The maintainer. `url` is the /about page, which is the page about them;
   LinkedIn is the profile elsewhere, so it is `sameAs`. The job is stated
   because it is the disclosure (/about leads with it). */
export const person = {
  "@type": "Person",
  "@id": `${SITE}#author`,
  name: AUTHOR,
  url: `${SITE}/about`,
  jobTitle: "Head of Partnerships & Strategic Accounts",
  worksFor: { "@type": "Organization", name: "Fast Bundle" },
  ...(AUTHOR_URL ? { sameAs: [AUTHOR_URL] } : {}),
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

/*
 * The three nodes every page's graph refers to, and the one spelling of each
 * id. Pages used to write `${SITE}#website` or `${SITE}/#website`, which are
 * different identifiers, and only the homepage, tool and category graphs
 * defined the nodes at all, so the blog, the feed, events and newsletters
 * pointed at things their own page never declared. Google resolves @id
 * within the document, so a reference has to be defined on the page it is on.
 */
export const IDS = {
  website: `${SITE}#website`,
  organization: `${SITE}#organization`,
  author: `${SITE}#author`,
};

/**
 * Any graph, with the site, organization and author nodes in it exactly once.
 * Accepts a single node or an @graph; always returns an @graph. Used by
 * components/JsonLd.jsx, which every page emits its structured data through.
 */
export function withSiteNodes(data) {
  const shared = [website, organization, person];
  const base = data && data["@graph"] ? data["@graph"]
    : data ? [(({ "@context": _, ...node }) => node)(data)] : [];
  const have = new Set(base.map((n) => n && n["@id"]).filter(Boolean));
  return {
    "@context": "https://schema.org",
    "@graph": [...base, ...shared.filter((n) => !have.has(n["@id"]))],
  };
}

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
 *   same owner              the same `ownership` id, or a matching `ownerOf`.
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

  /* One owner id (lib/owners.js), or, for an owner with no id yet, the same
     printable name. ownerOf rather than the raw field, so two entries carrying
     their own names as owners cannot match on it (invariant 32). */
  const mineO = ownershipOf(tool);
  const owner = ownerOf(tool);
  const sameOwner = (t) => {
    const o = ownershipOf(t);
    if (mineO?.id && o?.id) return mineO.id === o.id;
    return Boolean(owner) && ownerOf(t) === owner;
  };

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
/* Most tools first (categoriesByCount), the order the directory's rail uses. */
/* Counted by countTools (lib/toolCount.js), the same as the sidebar. */
export const categoryCounts = (all = TOOLS) => {
  const n = countTools(all);
  return n.order.map((id) => ({
    cat: CATEGORIES.find((c) => c.id === id),
    total: n.byCategory[id],
    primary: n.primaryByCategory[id],
  }));
};

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
        name: `${categoryTerm(cat)} for Shopify app vendors`,
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
        isPartOf: { "@id": `${SITE}#website` },
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
/*  Podcasts                                                           */
/*                                                                     */
/*  The newsletter contract in a show's shape: a PodcastSeries, with    */
/*  the host as author, and the description leading on cadence and run  */
/*  length, or on the fact that it stopped.                             */
/* ================================================================== */
export const PODCASTS_URL = `${SITE}/podcasts`;
export const podcastUrl = (id) => `${SITE}/podcasts/${id}`;

/* The run in words: "Weekly, 541 episodes" or "Stopped, 12 episodes". */
export function podcastRun(p) {
  const n = p.episodeCount ? `${p.episodeCount.toLocaleString("en-US")} episodes` : "";
  return [p.discontinued ? "Stopped publishing" : p.cadence, n].filter(Boolean).join(", ");
}

export function podcastDescription(p) {
  const bits = [p.one, podcastRun(p), p.host ? `Hosted by ${p.host}` : "", p.free ? "Free" : ""];
  return bits.filter(Boolean).join(". ").replace(/\.\./g, ".").slice(0, 300);
}

/* Same publisher first, then the same audience (made for app builders or
   not), then the same state (running or stopped). Never padding. */
export function relatedPodcasts(p, all = PODCASTS, limit = 4) {
  const others = all.filter((x) => x.id !== p.id);
  const seen = new Set();
  const out = [];
  const take = (list) => {
    for (const x of list) {
      if (out.length >= limit || seen.has(x.id)) continue;
      seen.add(x.id); out.push(x);
    }
  };
  if (p.publisher) take(others.filter((x) => x.publisher && x.publisher === p.publisher));
  take(others.filter((x) => Boolean(x.forAppBuilders) === Boolean(p.forAppBuilders) && Boolean(x.discontinued) === Boolean(p.discontinued)));
  return out.slice(0, limit);
}

export function podcastGraph(p, reviews = {}) {
  const rating = ratingOf(p.id, reviews);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": ["WebPage", "CollectionPage"],
        "@id": `${podcastUrl(p.id)}#page`,
        url: podcastUrl(p.id),
        name: `${p.name} on ${SITE_NAME}`,
        description: podcastDescription(p),
        isPartOf: { "@id": `${SITE}#website` },
        mainEntity: { "@id": `${podcastUrl(p.id)}#series` },
        breadcrumb: {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: SITE },
            { "@type": "ListItem", position: 2, name: "Podcasts", item: PODCASTS_URL },
            { "@type": "ListItem", position: 3, name: p.name, item: podcastUrl(p.id) },
          ],
        },
      },
      {
        "@type": "PodcastSeries",
        "@id": `${podcastUrl(p.id)}#series`,
        name: p.name,
        url: p.url,
        description: p.one,
        ...(p.rss ? { webFeed: p.rss } : {}),
        ...(p.host ? { author: { "@type": "Person", name: p.host } } : {}),
        ...(p.publisher ? { publisher: { "@type": "Organization", name: p.publisher } } : {}),
        ...(/^\d{4}-\d{2}-\d{2}$/.test(p.started || "") ? { startDate: p.started } : {}),
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

/*
 * Optional Event fields are filled only from published facts (CLAUDE.md,
 * invariant 29). A Search Console suggestion is not a reason to emit a value
 * we do not have.
 *
 *   organizer  only with a URL that is the organizer's own site: its owner
 *              row's url, or the event's `domain` where that domain is plainly
 *              the organizer's (its name and the domain's stem agree). No URL,
 *              no organizer node: a bare name is what Search Console flags.
 *   performer  only `performers` written on the entry from the event's own
 *              page. The organizer is never a stand-in.
 *   offers     only `tickets` written from the event's own page, with a price,
 *              currency, URL and the date it was read, and only for an edition
 *              still ahead and read within 120 days. A stale price is worse
 *              than none.
 *   image      the event's own card (/og/event/<id>), passed in by the page.
 */
const letters = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g, "");
export function organizerUrlOf(e) {
  const owner = (e.ownership?.id && ownerById(e.ownership.id)) || findOwner(e.organizer);
  if (owner?.url) return owner.url;
  const stem = letters(String(e.domain || "").replace(/^www\./, "").split(".")[0]);
  const name = letters(String(e.organizer || "").replace(/\(.*?\)/g, ""));
  if (stem.length >= 4 && name.length >= 4 && (stem.includes(name) || name.includes(stem))) return `https://${e.domain}`;
  return "";
}

const TICKETS_FRESH_DAYS = 120;
export function offersOf(e, today = new Date().toISOString().slice(0, 10)) {
  const t = e.tickets;
  if (!t || e.at?.status === "past" || !/^\d{4}-\d{2}-\d{2}$/.test(t.checked || "")) return null;
  if ((Date.parse(today) - Date.parse(t.checked)) / 864e5 > TICKETS_FRESH_DAYS) return null;
  if (typeof t.price !== "number" || !/^[A-Z]{3}$/.test(t.currency || "") || !/^https:\/\//.test(t.url || "")) return null;
  return { "@type": "Offer", price: t.price, priceCurrency: t.currency, url: t.url, validFrom: t.checked };
}

export function eventGraph(e, { image = "" } = {}) {
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
        isPartOf: { "@id": `${SITE}#website` },
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
        ...(e.organizer && organizerUrlOf(e) ? { organizer: { "@type": "Organization", name: e.organizer, url: organizerUrlOf(e) } } : {}),
        ...(Array.isArray(e.performers) && e.performers.length
          ? { performer: e.performers.map((p) => ({ "@type": p.type === "Organization" ? "Organization" : "Person", name: p.name })) } : {}),
        ...(offersOf(e) ? { offers: offersOf(e) } : {}),
        ...(image ? { image: [image] } : e.logo ? { image: `${SITE}${e.logo}` } : {}),
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
export function articleGraph(post, mentions = [], image = "") {
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
        // The share card, the one image the post has. Absolute and versioned.
        ...(image ? { image } : {}),
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

/* ------------------------------------------------------------------ */
/*  Owners (lib/owners.js, lib/ownerIndex.js)                          */
/* ------------------------------------------------------------------ */

export const OWNERS_URL = `${SITE}/owners`;
export const ownerUrl = (id) => `${SITE}/owners/${id}`;

/** The plain sentence for how one entry relates to its owner. */
export function relationOf(m, owner) {
  if (m.note) return m.note;
  if (m.own) return `${owner.name}'s own ${m.kind === "tool" ? "product" : m.kind}.`;
  return `${m.verb.charAt(0).toUpperCase()}${m.verb.slice(1)} ${m.ownerName}.`;
}

export function ownerDescription(owner, entries) {
  const names = entries.map((m) => m.name);
  const list = names.length > 2 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names.join(" and ");
  return `Every listing ${owner.name} controls on watchfor.tools: ${list}.`;
}

/** One owner's page: the company or person, and what it controls. */
export function ownerGraph(owner, entries) {
  const url = ownerUrl(owner.id);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": owner.type === "Person" ? "Person" : "Organization",
        "@id": `${url}#owner`,
        name: owner.name,
        url,
        ...(owner.url || appStoreOf(owner) ? { sameAs: [owner.url, appStoreOf(owner)].filter(Boolean) } : {}),
        ...(owner.notes ? { description: owner.notes } : {}),
      },
      {
        "@type": "ProfilePage",
        "@id": `${url}#page`,
        url,
        name: `${owner.name}: what it owns`,
        description: ownerDescription(owner, entries),
        isPartOf: { "@id": `${SITE}#website` },
        mainEntity: { "@id": `${url}#owner` },
        hasPart: {
          "@type": "ItemList",
          itemListElement: entries.map((m, i) => ({
            "@type": "ListItem", position: i + 1, name: m.name, url: `${SITE}${m.href}`,
          })),
        },
        breadcrumb: {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Directory", item: SITE },
            { "@type": "ListItem", position: 2, name: "Owners", item: OWNERS_URL },
            { "@type": "ListItem", position: 3, name: owner.name, item: url },
          ],
        },
      },
    ],
  };
}

/** The owners index: every owner with more than one listing. */
export function ownersIndexGraph(owners) {
  return {
    "@context": "https://schema.org",
    "@graph": [{
      "@type": "CollectionPage",
      "@id": `${OWNERS_URL}#page`,
      url: OWNERS_URL,
      name: "Owners",
      description: "The companies and people behind the tools, newsletters and events on watchfor.tools.",
      isPartOf: { "@id": `${SITE}#website` },
      mainEntity: {
        "@type": "ItemList",
        /* An owner with a page links it; one behind a single listing has no
           page (invariant 46) and links that listing. */
        itemListElement: owners.map((o, i) => ({
          "@type": "ListItem", position: i + 1, name: o.name,
          url: `${SITE}${o.page || o.entries[0].href}`,
        })),
      },
    }],
  };
}

/* ------------------------------------------------------------------ */
/*  Alternatives and head-to-heads (lib/rivals.js)                     */
/* ------------------------------------------------------------------ */

export const alternativesUrl = (id) => `${SITE}/alternatives/${id}`;
export const compareUrl = (slug) => `${SITE}/compare/${slug}`;

export function alternativesGraph(tool, alts) {
  const url = alternativesUrl(tool.id);
  return {
    "@context": "https://schema.org",
    "@graph": [{
      "@type": "CollectionPage",
      "@id": `${url}#page`,
      url,
      name: `Alternatives to ${tool.name}`,
      isPartOf: { "@id": `${SITE}#website` },
      about: { "@type": "SoftwareApplication", name: tool.name, url: toolUrl(tool.id) },
      mainEntity: {
        "@type": "ItemList",
        itemListElement: alts.map((x, i) => ({ "@type": "ListItem", position: i + 1, name: x.tool.name, url: toolUrl(x.tool.id) })),
      },
      breadcrumb: {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Directory", item: SITE },
          { "@type": "ListItem", position: 2, name: tool.name, item: toolUrl(tool.id) },
          { "@type": "ListItem", position: 3, name: "Alternatives", item: url },
        ],
      },
    }],
  };
}

export function compareGraph(a, b, slug) {
  const url = compareUrl(slug);
  return {
    "@context": "https://schema.org",
    "@graph": [{
      "@type": "WebPage",
      "@id": `${url}#page`,
      url,
      name: `${a.name} vs ${b.name}`,
      isPartOf: { "@id": `${SITE}#website` },
      about: [
        { "@type": "SoftwareApplication", name: a.name, url: toolUrl(a.id) },
        { "@type": "SoftwareApplication", name: b.name, url: toolUrl(b.id) },
      ],
      breadcrumb: {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Directory", item: SITE },
          { "@type": "ListItem", position: 2, name: `${a.name} vs ${b.name}`, item: url },
        ],
      },
    }],
  };
}
