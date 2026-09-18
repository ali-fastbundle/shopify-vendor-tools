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

import { TOOLS, CATEGORIES, catOf, AUTHOR, AUTHOR_URL, HEADLINE } from "./tools";

export const SITE = "https://watchfor.tools";
export const SITE_NAME = "watchfor.tools";

export const toolUrl = (id) => `${SITE}/tools/${id}`;

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
        name: `${tool.name} — ${catOf(tool.cat).label}`,
        description: toolDescription(tool),
        isPartOf: { "@id": `${SITE}#website` },
        primaryImageOfPage: tool.logo ? { "@type": "ImageObject", url: `${SITE}${tool.logo}` } : undefined,
        mainEntity: { "@id": `${toolUrl(tool.id)}#software` },
        breadcrumb: {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Directory", item: SITE },
            { "@type": "ListItem", position: 2, name: catOf(tool.cat).label, item: `${SITE}/#${tool.cat}` },
            { "@type": "ListItem", position: 3, name: tool.name, item: toolUrl(tool.id) },
          ],
        },
      },
    ],
  };
}

/*
 * Related tools, so a crawler arriving on any single page can reach the rest.
 *
 * Three relationships, most specific first: the same owner, the same category,
 * and whatever is left of the catalogue. A page with no outbound links to its
 * siblings is a page Google finds once and never revisits, and an orphan is
 * exactly what a modal-only directory produces.
 */
export function relatedTools(tool, all = TOOLS, limit = 8) {
  const sameOwner = all.filter((t) => t.id !== tool.id && (
    (tool.linked && (t.name === tool.linked || t.linked === tool.name))
    || (tool.suite && t.suite === tool.suite)
    || (tool.owner && t.owner === tool.owner)
  ));
  const sameCat = all.filter((t) => t.id !== tool.id && t.cat === tool.cat && !sameOwner.includes(t));
  const rest = all.filter((t) => t.id !== tool.id && !sameOwner.includes(t) && !sameCat.includes(t));

  const label = (t) => (sameOwner.includes(t) ? "same owner"
    : t.cat === tool.cat ? "same category" : "also listed");

  return [...sameOwner, ...sameCat, ...rest].slice(0, limit).map((t) => ({ tool: t, why: label(t) }));
}

export const categoryOf = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[0];
