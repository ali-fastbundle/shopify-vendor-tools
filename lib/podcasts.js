/*
 * Podcasts.
 *
 * A podcast earns its row on either of two counts, and a merchant-facing show
 * usually has both: it is where an app vendor hears how merchants talk about
 * their problems and their tools, and it is a channel for getting in front of
 * them, as a guest, a sponsor or an advertiser. The second is what `reach` is
 * for. Being written for merchants rather than for app builders is therefore
 * not a mark against a show; it is the audience a vendor is trying to reach.
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
 *  reach       optional prose. How an app vendor can get in front of this
 *              audience: paid guest slots, host-read ads, newsletter placements,
 *              a pitch with no published route, with prices where they are
 *              published and as of `updated`. Omit where there is no way in,
 *              rather than writing "none". When guests pay to appear, `watch`
 *              says so as well, because it changes what the interviews are.
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
    note: "537 episodes since 2021, twice a week, each a short interview with an ecommerce or marketing expert, hosted by Claus Lauter and paired with a newsletter of the same name. Written for people who sell online or run a DTC brand, across Shopify, Amazon and beyond: apps, MarTech, paid ads, retention, AI and dropshipping. For an app vendor it is both a read on what merchants are being sold and one of the more organised ways to be the one selling it.",
    reach: "Every route in is sold. A guest interview carries a production fee from $249, host-read ads come in packages priced on request, newsletter ads run from $1,000 a month for a text placement to $2,250 for four image placements, and EcomAudience, the same company's co-registration product, charges $4 per opted-in subscriber. Its own media kit claims 70,000+ monthly reach, 35,000+ monthly listens and a 15,000+ subscriber newsletter at a 33 to 35% open rate.",
    watch: "Guests pay to appear, so the interviews are placements: the vendors on it are the ones who bought a slot, which is worth knowing whether you are listening for demand signal or weighing up buying one yourself. The audience is ecommerce at large rather than Shopify, with Amazon, TikTok Shop and WooCommerce sellers in the same count, and every reach, ranking and open-rate figure is the publisher's own.",
    social: {},
    updated: "2026-10-10",
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
    watch: "Not publishing. The feed holds 12 episodes, from October 2020 to November 2021, with nothing since, so this is an archive rather than a show to follow, and no longer a channel to appear on. It is published by Ecomhunt, which sells a product research tool to the same dropshippers, and at least one guest describes finding a product with it, so read it as the publisher's content marketing.",
    changelogUrl: "https://rss.buzzsprout.com/1449025.rss",
    social: { yt: "https://www.youtube.com/c/ecomhunt" },
    updated: "2026-10-10",
    draft: true,
  },
  {
    id: "dropshippingtalks",
    name: "Dropshipping Talks",
    url: "https://www.autods.com/podcast/",
    host: "Mario Martinez",
    publisher: "AutoDS",
    started: "2020-10",
    episodeCount: 292,
    platform: "Buzzsprout, on Apple and Spotify",
    free: true,
    topics: ["dropshipping", "product research", "suppliers", "ai tools", "side businesses", "tiktok shop"],
    reach: "No published guest or sponsorship programme, so the way in is a pitch to AutoDS. Other tool makers have been on, BeProfit as the guest on a live Q&A and Multilogin among them, which says a complementary tool can get a slot. It will not be one that competes with AutoDS's own app.",
    one: "dropshipping how-tos and online business ideas, from the makers of a dropshipping automation app.",
    note: "AutoDS's podcast, listed on Apple as Talks From Dropshippers To Dropshippers. 292 episodes since October 2020, hosted by Mario Martinez for most of the run and by AutoDS's CEO Lior Pozin early on, mostly short solo episodes with some interviews. Written for dropshippers starting out: products, suppliers, ads, and lately AI tools and one-person business ideas. For an app vendor it shows what the beginner end of the merchant base is being told to install and why.",
    watch: "Published by AutoDS, which sells dropshipping automation to the same audience, and 86 of the 292 episodes mention it, so treat its tool advice as the publisher's own marketing. Recent episodes have drifted from dropshipping to AI side hustles and passive income, none of the run is about building apps, and two recent show notes still carry an unfilled \"[Podcast Name], [Host Name]\" template. Output has slowed from 83 episodes in 2024 to 21 so far in 2026, with no fixed schedule, and \"the #1 dropshipping podcast\" is its own claim.",
    changelogUrl: "https://rss.buzzsprout.com/1412335.rss",
    social: {},
    updated: "2026-10-10",
    draft: true,
  },
];

/* The published list, under the plain name. Every consumer imports this one and
   is draft-safe without knowing drafts exist; /admin imports ALL_ above on
   purpose. See lib/drafts.js. */
export const PODCASTS = published(ALL_PODCASTS);

export const podcastOf = (id) => PODCASTS.find((p) => p.id === id) || null;
