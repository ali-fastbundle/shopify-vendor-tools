/*
 * Awards.
 *
 * The sixth catalogue, and its own shape. An award is not an event with a
 * trophy: what decides whether it is worth an app vendor's time is who can
 * enter, what entering costs, who judges, and who pays for the night. A
 * ceremony has a date like an event, but the date that matters first is the
 * entry deadline, and most of the cost is the entry fee and the table, not a
 * ticket.
 *
 * For an app vendor an award is two things: a category an app or an agency
 * can enter, and a room of merchants and partners on the night. Both are worth
 * stating, and so is the commercial side, because many awards are run by a
 * media company or an agency group and paid for by sponsors in the same market.
 *
 * Shared with every other kind: `id`, `name`, `url`, `one`, `note`, `watch`,
 * `social`, `logo`, `ratings`, `updated`, `draft`.
 *
 * ------------------------------------------------------------------
 *  Shape
 * ------------------------------------------------------------------
 *  id            permanent. Votes, reviews and any future claim key on it.
 *  name          as the awards call themselves.
 *  url           the awards' own site.
 *  domain        the site's domain, set by hand.
 *  organiser     who runs it. `partners` names who powers or sponsors it, as
 *                the site states it.
 *  cadence       "Annual", or omitted where it is not stated.
 *  ceremony      optional. YYYY-MM-DD of the next ceremony, only once the
 *                organiser publishes it. Never inferred from last year.
 *  lastHeld      optional. YYYY-MM-DD of the last ceremony, where known.
 *  entryDeadline optional. YYYY-MM-DD, only as published.
 *  entryFee      optional prose: per entry, per category, early-bird, with the
 *                currency, as of `updated`. Omit rather than estimate.
 *  whoCanEnter   who may enter: retailers only, or agencies and technology
 *                suppliers too. The field that decides whether an app vendor
 *                can enter at all.
 *  appCategories optional. The award categories an app or a supplier can enter,
 *                in the organiser's words.
 *  city, country where the ceremony is held.
 *  relevance     ours: high, medium or low, for an app vendor.
 *  one, note, watch, social, logo, ratings, updated, draft
 *                as everywhere else.
 *
 * The section is not open. RESOURCE_KINDS.award is `live: false`, and
 * lib/sections.js will not open it on a catalogue of drafts alone.
 */

import { published } from "./drafts";

export const ALL_AWARDS = [
  {
    id: "uk-ecommerce-awards",
    name: "UK eCommerce Awards",
    url: "https://ukecommerceawards.co.uk/",
    domain: "ukecommerceawards.co.uk",
    organiser: "Don't Panic",
    partners: "Powered by Space 48, in association with Klaviyo (from search results, not the site)",
    cadence: "Annual",
    city: "London",
    country: "UK",
    relevance: "low",
    one: "annual awards for uk ecommerce, run by an agency group with a sponsor platform behind it",
    note: "Annual awards for UK online retailers and the agencies and suppliers who work with them, with a ceremony in London. An earlier edition was held at the Montcalm Marble Arch. Space 48, a Shopify and Magento agency, has posted about entries opening in past years.",
    watch: "Not checked on its own site yet, which sits behind a bot check. Search results say Don't Panic runs it, powered by the agency Space 48 and in association with Klaviyo. Check the next date, the entry fee and whether app vendors can enter before publishing.",
    social: {},
    updated: "2026-10-18",
    draft: true,
  },
];

/* The published list, under the plain name. Every consumer imports this one and
   is draft-safe without knowing drafts exist; /admin imports ALL_ above on
   purpose. See lib/drafts.js. */
export const AWARDS = published(ALL_AWARDS);

export const awardOf = (id) => AWARDS.find((a) => a.id === id) || null;
