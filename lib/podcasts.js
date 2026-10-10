/*
 * Podcasts.
 *
 * The fourth catalogue, and the fourth shape, for the same reason as the other
 * three: a podcast is not a tool, a newsletter or a community with different
 * words in it. A tool is judged on what it does and what it costs; a newsletter
 * on whether it is still going and who writes it; a community on who is in the
 * room. A podcast is judged on whether it is still publishing, how often, how
 * long for, who hosts it, and what the host is selling around it. Forcing it
 * through the tool shape would mean a `price` on something free and a `cat`
 * from a list that does not describe a show.
 *
 * Shared with every other kind, because it is the directory's editorial
 * contract rather than anything about the subject: `id`, `name`, `url`, `one`,
 * `note`, `watch`, `social`, `logo`, `ratings`, `updated`, `draft`. `watch`
 * especially. A podcast whose host sells into the same market, or runs on guest
 * appearances that are really placements, has a conflict worth naming, the same
 * way a tracker built by an app vendor does, and it is no more the host's to
 * edit than a tool's is.
 *
 * ------------------------------------------------------------------
 *  Shape
 * ------------------------------------------------------------------
 *  id          permanent. Votes, reviews and any future claim key on it.
 *  name        as the show calls itself.
 *  url         the show's own home, where you would go to subscribe.
 *  host        the person who hosts it. Omit where a rotating or uncredited
 *              team does, and say so in `watch`.
 *  publisher   optional. The company or network behind it, if it is not just
 *              the host's own thing.
 *  cadence     optional. "Weekly", "Twice weekly", "When there is an episode".
 *              Omit where it genuinely is not on a schedule, and say so in
 *              `watch` rather than guessing a rhythm from the feed.
 *  started     optional. YYYY, YYYY-MM or YYYY-MM-DD, whichever is actually
 *              knowable. Do not invent a day to fill the format.
 *  episodeCount optional. A number that goes stale, so it is only honest next
 *              to `updated`, and it is independent of `started`: having both is
 *              what lets a reader check the run for gaps. Omit rather than
 *              estimate.
 *  platform    where it is hosted and distributed: "Buzzsprout, on Apple,
 *              Spotify and YouTube". Says whether an archive exists and where.
 *  free        boolean. Nearly always true for a podcast; false for a paid or
 *              members-only feed, and `note` says what the fee buys.
 *  topics      what it actually covers, in the host's terms, not categories.
 *  shopifySpecific
 *              optional. True when the show is about Shopify itself. Renders a
 *              neutral "Shopify-specific" badge and nothing else; absent
 *              renders nothing, because a show that is not about Shopify is not
 *              thereby worse. Same positive-label rule as the newsletters, not
 *              the Shopify-exclusive boundary that governs tools.
 *  one         one line, lowercase-ish, no marketing.
 *  note        what it is and who it is for.
 *  watch       the honest caveat. Never editable by whoever is listed.
 *  changelogUrl
 *              optional. For a podcast this is usually the RSS feed or the
 *              episode archive, which is the page that answers "are they still
 *              publishing". See lib/monitor.js.
 *  social      optional, and only profiles published on the show's own site.
 *              Never a plausible guess.
 *  logo        optional path under /public/logos/.
 *  ratings     optional external scores, same shape and rules as tools:
 *              entered by hand, never scraped, never any review text.
 *  updated     YYYY-MM-DD this entry was last touched editorially.
 *  draft       optional. See lib/drafts.js.
 *
 * The section is not open. RESOURCE_KINDS.podcast is still `live: false`, and
 * lib/sections.js will not open it on a catalogue of drafts alone, so nothing
 * below renders anywhere yet.
 */

import { published } from "./drafts";

export const ALL_PODCASTS = [
  {
    id: "ecommercecoffeebreak",
    name: "Ecommerce Coffee Break",
    url: "https://ecommercecoffeebreak.com/",
    host: "Claus Lauter",
    cadence: "Twice weekly",
    started: "2021-04",
    episodeCount: 537,
    platform: "Buzzsprout, on Apple, Spotify, Amazon Music and YouTube",
    free: true,
    topics: ["dtc marketing", "paid ads", "retention", "ai", "martech", "shopify apps", "marketplaces", "dropshipping"],
    one: "twice-weekly interviews on ecommerce and dtc marketing, for the merchants your app sells to.",
    note: "537 episodes since 2021, twice a week, each a short interview with an ecommerce or marketing expert. Hosted by Claus Lauter, an official Shopify partner, and paired with a newsletter of the same name. Written for people who sell online or run a DTC brand, covering Amazon, Shopify and beyond: apps, MarTech, paid ads, retention, AI and dropshipping. 15,000+ monthly listeners by its own count, and some episodes are directly about Shopify apps, which is the part an app vendor is here for.",
    watch: "Merchant and DTC facing, not a show about building apps, so you are listening sideways for demand signal and the occasional app episode rather than for app-development discussion. It is interview-driven and guests come on to promote what they do, and the host is a Shopify affiliate partner who earns through the surrounding newsletter and partner links, so treat what a guest or the host recommends as a placement rather than a neutral pick. The listener and ranking figures are self-reported.",
    social: {},
    updated: "2026-10-02",
    draft: true,
  },
  {
    id: "groundup",
    name: "Ground Up",
    url: "https://ecomhunt.com/podcast",
    host: "Ariel Ben Solomon",
    publisher: "Ecomhunt",
    started: "2020-10",
    episodeCount: 12,
    platform: "Buzzsprout, on Apple, Spotify and YouTube",
    free: true,
    topics: ["dropshipping", "product research", "facebook ads", "influencer marketing", "one-product stores", "scaling"],
    one: "interviews with dropshippers on how they built their stores, from the makers of a product research tool.",
    note: "Ariel Ben Solomon of Ecomhunt interviews dropshipping sellers about how they built their stores and what they would do differently starting from scratch: winning products, Facebook ad testing, influencers, one-product versus general stores. Episodes run about twenty minutes. Written for dropshippers, so for an app vendor it is a view of how that end of the merchant base thinks about tools and spend.",
    watch: "Not publishing. The feed holds 12 episodes, from October 2020 to November 2021, with nothing since, so this is an archive rather than a show to follow. It is published by Ecomhunt, which sells a product research tool to the same dropshippers, and at least one guest describes finding a product with it, so read it as the publisher's content marketing.",
    changelogUrl: "https://rss.buzzsprout.com/1449025.rss",
    social: { yt: "https://www.youtube.com/c/ecomhunt" },
    updated: "2026-10-10",
    draft: true,
  },
];

/* The published list, under the plain name. Every consumer imports this one and
   is draft-safe without knowing drafts exist; /admin imports ALL_ above on
   purpose. See lib/drafts.js. */
export const PODCASTS = published(ALL_PODCASTS);

export const podcastOf = (id) => PODCASTS.find((p) => p.id === id) || null;
