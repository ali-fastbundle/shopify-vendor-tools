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
 *  launched    is `started` for this kind (lib/launched.js reads it); set
 *              `launched: "unknown"` when it was looked for and not published.
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
 *  lastEpisode optional. YYYY-MM-DD of the newest episode, read from the feed,
 *              for a show that has stopped. Set with `discontinued`.
 *  discontinued
 *              optional. The show has stopped publishing: no episode in over a
 *              year, or the host has said it ended. Kept and listed as an
 *              archive, never removed, because the episodes are still a record
 *              of who said what and when. `watch` says when it stopped and
 *              whether that was announced. Omit `cadence` and `reach`.
 *  rss         the show's own RSS feed, from its podcast host, checked to
 *              return episodes. Followers get a new episode's title and link
 *              from it (lib/notify.js), never the description. Never guessed:
 *              read from the show's Apple listing or its own site.
 *  length      optional. Typical episode length in the recent run, "About 25
 *              minutes", read from the feed's durations, not the show's claim.
 *  forAppBuilders
 *              optional. True when the show is made for people who build
 *              Shopify apps rather than for merchants. It splits the index the
 *              way the intro does (components/Podcasts.jsx).
 *  paidGuests  optional. True when the show's own pages say a guest pays, or
 *              may pay, to appear. `watch` says so in words; this lets the
 *              section intro count them rather than state a number by hand.
 *  changelogUrl
 *              optional. A page the monitor reads (lib/monitor.js). Not the
 *              feed: that is `rss`, which is what following reads.
 *  social      optional, and only profiles published on the show's own site.
 *              Never a plausible guess.
 *  logo        optional path under /public/logos/.
 *  ratings     optional external scores, same shape and rules as tools:
 *              entered by hand, never scraped, never any review text.
 *  updated     YYYY-MM-DD this entry was last touched editorially.
 *  draft       optional. See lib/drafts.js.
 *
 * Opened 2026-10-31 with every count, date, length and feed read from each
 * show's own feed that day. eCommerce Fastlane stays a draft until its
 * sponsorship and audience figures are read on its own site.
 */

import { published } from "./drafts";

export const ALL_PODCASTS = [
  {
    id: "ecommercecoffeebreak",
    name: "Ecommerce Coffee Break",
    url: "https://ecommercecoffeebreak.com/",
    /* Every count, date and length below read from this feed on 2026-10-31:
       541 episodes, 22 Apr 2021 to 26 Oct 2026, 15 in the last 90 days. */
    rss: "https://rss.buzzsprout.com/1763290.rss",
    paidGuests: true,
    host: "Claus Lauter",
    cadence: "About weekly, sometimes twice",
    started: "2021-04-22",
    episodeCount: 541,
    length: "About 27 minutes",
    platform: "Buzzsprout, on Apple, Spotify, Amazon Music and YouTube",
    free: true,
    topics: ["dtc marketing", "paid ads", "retention", "ai", "martech", "shopify apps", "marketplaces", "dropshipping"],
    one: "interviews on ecommerce and dtc marketing, about weekly, for the merchants your app sells to.",
    note: "541 episodes since April 2021, hosted by Claus Lauter, with a newsletter of the same name. Each is a short interview with an ecommerce or marketing expert. It ran twice a week in 2023 and is about weekly in 2026. Written for people who sell online or run a DTC brand, on Shopify, Amazon and beyond: apps, MarTech, paid ads, retention, AI and dropshipping. For an app vendor it is a read on what merchants are being sold, and one of the more organised ways to be the one selling it.",
    /* The guest fee from /podcast-guest-application/, the newsletter and
       co-registration prices from /email-newsletter-sponsorship/, both read
       2026-10-31. */
    reach: "Every route in is sold. A guest interview carries a production fee starting at $249. Host-read ads are priced on request. Newsletter ads start at $480 and run to $2,250 for four image placements, and co-registration costs $4 per confirmed opt-in. The publisher states 70,000 monthly reach and a newsletter of 16,000+ at a 33 to 35% open rate.",
    watch: "Guests pay to appear, so the interviews are placements: the vendors on it are the ones who bought a slot. That matters whether you are listening for demand signal or weighing up buying one yourself. The audience is ecommerce at large rather than Shopify, with Amazon, TikTok Shop and WooCommerce sellers in the same count, and every reach and open-rate figure is the publisher's own.",
    social: {},
    launched: "2021-04-22", /* first episode: "#001: Welcome to the Ecommerce Coffee Break", 22 Apr 2021, in its feed (checked 2026-10-31) */
    updated: "2026-10-31",
  },
  {
    id: "groundup",
    name: "Ground Up",
    url: "https://ecomhunt.com/podcast",
    /* Read 2026-10-31: 12 episodes, 28 Oct 2020 to 16 Nov 2021, nothing since. */
    rss: "https://rss.buzzsprout.com/1449025.rss",
    host: "Ariel Ben Solomon",
    publisher: "Ecomhunt",
    started: "2020-10-28",
    lastEpisode: "2021-11-16",
    discontinued: true,
    episodeCount: 12,
    length: "About 22 minutes",
    platform: "Buzzsprout, on Apple, Spotify and YouTube",
    free: true,
    topics: ["dropshipping", "product research", "facebook ads", "influencer marketing", "one-product stores", "scaling"],
    one: "interviews with dropshippers on how they built their stores, 12 episodes to november 2021, no longer publishing.",
    note: "Ariel Ben Solomon of Ecomhunt interviews dropshipping sellers about how they built their stores and what they would do differently starting from scratch: winning products, Facebook ad testing, influencers, one-product versus general stores. Episodes run about twenty minutes. Written for dropshippers, so for an app vendor it is a record of how that end of the merchant base thought about tools and spend.",
    watch: "Not publishing. The feed holds 12 episodes, from October 2020 to 16 November 2021, with nothing since and no end announced, so this is an archive rather than a show to follow, and no longer a channel to appear on. It is published by Ecomhunt, which sells a product research tool to the same dropshippers, and at least one guest describes finding a product with it, so read it as the publisher's content marketing.",
    social: { yt: "https://www.youtube.com/c/ecomhunt" },
    launched: "2020-10-28", /* first episode in its feed, 28 Oct 2020 (checked 2026-10-31) */
    updated: "2026-10-31",
  },
  {
    id: "dropshippingtalks",
    name: "Dropshipping Talks",
    url: "https://www.autods.com/podcast/",
    /* Read 2026-10-31: 292 episodes, 12 Oct 2020 to 11 Aug 2026. By year:
       3, 26, 43, 78, 83, 38, and 21 in 2026. */
    rss: "https://rss.buzzsprout.com/1412335.rss",
    host: "Mario Martinez",
    publisher: "AutoDS",
    started: "2020-10-12",
    episodeCount: 292,
    length: "About 11 minutes",
    platform: "Buzzsprout, on Apple and Spotify",
    free: true,
    topics: ["dropshipping", "product research", "suppliers", "ai tools", "side businesses", "tiktok shop"],
    reach: "No published guest or sponsorship programme, so the way in is a pitch to AutoDS. Other tool makers have been on, BeProfit as the guest on a live Q&A and Multilogin among them, which says a complementary tool can get a slot. It will not be one that competes with AutoDS's own app.",
    one: "dropshipping how-tos and online business ideas, from the makers of a dropshipping automation app.",
    note: "AutoDS's podcast, listed on Apple as Talks From Dropshippers To Dropshippers. 292 episodes since October 2020, hosted by Mario Martinez for most of the run and by AutoDS's CEO Lior Pozin early on, mostly short solo episodes with some interviews. Written for dropshippers starting out: products, suppliers, ads, and lately AI tools and one-person business ideas. For an app vendor it shows what the beginner end of the merchant base is being told to install and why.",
    watch: "Published by AutoDS, which sells dropshipping automation to the same audience, and 89 of the 292 episodes mention it, so treat its tool advice as the publisher's own marketing. Output has slowed from 83 episodes in 2024 to 21 in 2026, with none since 11 August 2026 and no fixed schedule. Recent episodes have drifted from dropshipping to AI side hustles, two show notes still carry an unfilled \"[Podcast Name], [Host Name]\" template, and \"the #1 dropshipping podcast\" is its own claim.",
    social: {},
    launched: "2020-10-12", /* first episode in its feed, 12 Oct 2020 (checked 2026-10-31) */
    updated: "2026-10-31",
  },
  {
    id: "shopifyappshow",
    name: "The Shopify App Show",
    url: "https://www.youtube.com/@TheShopifyAppShow",
    /* Read 2026-10-31: 40 episodes, 1 Feb to 27 Oct 2026, 19 in the last 90
       days. The host's company and the sponsor counts are from the episode
       notes in this feed; the fee from its Talks.co booking profile. */
    rss: "https://api.riverside.fm/hosting/nnmoaAps.rss",
    host: "Martin Cox",
    cadence: "Weekly, with short mini episodes in between",
    started: "2026-02-01",
    episodeCount: 40,
    length: "About 22 minutes",
    platform: "Riverside, on YouTube and Apple Podcasts",
    free: true,
    shopifySpecific: true,
    forAppBuilders: true,
    paidGuests: true,
    topics: ["indie shopify apps", "app founders", "shopify releases", "bfcm", "cro", "pos", "ai shopping agents"],
    one: "weekly interviews with independent shopify app founders, plus short takes on shopify releases.",
    note: "Started in February 2026, with 40 episodes by the end of October. The host, Martin Cox, says he has 14 years in the Shopify ecosystem. Most episodes are interviews of about 25 minutes with founders of small Shopify apps about how they build and grow. The show says it skips demos and pricing. Mini episodes test new Shopify releases, such as Shopify Canvas and shop.md. The autumn Global Compass series is written for merchants getting ready for Black Friday.",
    reach: "Its guest-booking profile on Talks.co is open for guests who build Shopify apps, with remote recording on weekdays. It says a speaking fee may apply and is negotiable. Episodes also carry sponsor reads.",
    watch: "The host runs his own app company, Native App Co, and episodes advertise its apps: Stork Credit, Fish Wishlist, Product Pelican and Omnibus Owl. So the one show here made for app builders is also an app vendor's marketing. The Support Heroes, an outsourced support company listed in this directory, presents the show and is named in 31 of its 40 episodes. Its booking profile says a speaking fee may apply, so some interviews may be paid placements. Every figure about the host is his own.",
    social: {},
    launched: "2026-02-01", /* first episode in its feed, 1 Feb 2026 (checked 2026-10-31) */
    updated: "2026-10-31",
  },
  {
    id: "ecommercefastlane",
    name: "eCommerce Fastlane",
    url: "https://ecommercefastlane.com/",
    /* Read 2026-10-31: 494 episodes, 11 Jun 2018 to 29 Oct 2026. Still a
       draft: the sponsorship price and the audience figures below came from
       search results, its own site answered 403 again on 2026-10-31, and its
       feed states neither. Publish once they are read on its own pages, or
       cut. */
    rss: "https://feeds.transistor.fm/ecommercefastlane",
    host: "Steve Hutt",
    publisher: "Fastlane Media Inc.",
    cadence: "About weekly, sometimes twice",
    started: "2018-06-11",
    episodeCount: 494,
    length: "About 45 minutes",
    platform: "Transistor, on Apple, Spotify and the show's own site",
    free: true,
    shopifySpecific: true,
    topics: ["shopify growth", "bfcm", "conversion", "email and popups", "fraud", "affiliates", "ai shopping", "apps and tools"],
    one: "a long-running shopify growth podcast whose guests are mostly the vendors behind the tools discussed.",
    note: "494 episodes since June 2018, about one a week, hosted by Steve Hutt for Shopify merchants. Most episodes interview someone from a Shopify app or service. Each is built around one tactic with numbers, such as popup discounts, fraud declines or affiliate revenue. For an app vendor it is a view of what merchants are being sold, and one of the clearer ways to be on that list.",
    reach: "Sponsorship is published: $3,000 for four episodes as the sole sponsor. That buys a 60 to 90 second read by the host, a link in the show notes, and newsletter and social mentions. It also takes guest applications. No guest fee is published.",
    watch: "Most guests work for the company whose product the episode is about, so an episode is a vendor making its case, with the host asking. Whether guests pay to appear is not stated anywhere found. The audience figures are its own and disagree: 40,000+ monthly downloads on one page, 50,000+ monthly listens on another. Its website blocked this check, so the facts come from its podcast feed and search results.",
    social: {},
    launched: "2018-06-11", /* first episode in its feed, "NEW SHOW: eCommerce Fastlane with Steve Hutt", 11 Jun 2018 (checked 2026-10-31) */
    updated: "2026-10-31",
    draft: true,
  },
  {
    id: "dtcpodcast",
    name: "The DTC Podcast",
    url: "https://www.directtoconsumer.co/podcasts",
    /* Read 2026-10-31: 798 episodes, 20 May 2020 to 30 Oct 2026, 35 in the
       last 90 days. */
    rss: "https://anchor.fm/s/205a6c00/podcast/rss",
    host: "Eric Dyck",
    publisher: "DTC Media",
    ownership: { id: "dtc-media", name: "DTC Media" },
    cadence: "Weekly on Mondays, plus series episodes on Thursdays",
    started: "2020-05-20",
    episodeCount: 798,
    length: "About 39 minutes",
    platform: "Spotify for Podcasters, on Apple, Spotify and YouTube",
    free: true,
    topics: ["dtc brands", "meta ads", "tiktok shop", "retail expansion", "pricing", "brand strategy", "marketing budgets"],
    one: "weekly interviews with dtc brand founders and marketers, from the team behind the dtc newsletter.",
    note: "The podcast of the DTC Newsletter, hosted by Eric Dyck, for people who build and market consumer brands. Episodes are interviews with founders and operators about one result with numbers. Recent ones cover O Positiv scaling TikTok Shop and Flex reaching 30,000 retail stores. A Thursday series runs in parts, such as Harness the Halo on getting marketing budget approved. The same page carries two sister shows, AKNF on ad creative and the Email And Retention Podcast. For an app vendor it is how DTC merchants talk about growth, and a sponsor channel.",
    reach: "The publisher's advertising page sells podcast sponsorship with the newsletter. It states 20k+ monthly downloads, 8 to 10 new episodes a month and 1,000 downloads per episode in its first 30 days. No prices are published, and the route in is a chat on that page.",
    watch: "Owned with the DTC Newsletter, whose watch note names the agency Pilothouse as the business behind both. Pilothouse staff appear as guests and experts, so some episodes are also its marketing. The audience figures are the publisher's own. The YouTube channel mixes full episodes with thousands of short clips.",
    social: {
      yt: "https://www.youtube.com/@DTCPodcast",
    },
    launched: "2020-05-20", /* first episode in its feed, "Ep 1: How To Advertise During A Global Pandemic", 20 May 2020 (checked 2026-10-31) */
    updated: "2026-10-31",
  },
  {
    id: "honestecommerce",
    name: "Honest Ecommerce",
    url: "https://honestecommerce.com/",
    /* Read 2026-10-31: 569 episodes and a trailer, 7 Jan 2019 to 26 Oct 2026,
       19 in the last 90 days. honestecommerce.com links "Shopify Experts" to
       electriceye.io, and electriceye.io's footer links "Podcast" back to the
       show (read 2026-10-23). */
    rss: "https://api.riverside.com/hosting/S3wcJsCy.rss",
    host: "Chase Clymer",
    publisher: "Electric Eye",
    ownership: { id: "electric-eye", name: "Electric Eye", verb: "run alongside" },
    cadence: "About weekly, sometimes twice",
    started: "2019-01-07",
    episodeCount: 569,
    length: "About 30 minutes",
    platform: "Its own Shopify site, on Apple, Spotify and YouTube",
    free: true,
    shopifySpecific: true,
    topics: ["shopify growth", "wholesale", "omnichannel", "ai in ecommerce", "customer support", "product customization", "brand building"],
    one: "a weekly shopify growth podcast for store owners, run alongside a shopify agency.",
    note: "Hosted by Chase Clymer for online store owners, with 569 episodes since January 2019. Guests are mostly brand operators. Recent ones include the head of ecommerce at Liberty Safe and the founder of Vici Collections. Some are software people talking about their own product, such as the CEO of Zakeke and a product manager at LiveChat's maker. For an app vendor it is how merchants hear growth advice, and a show where vendors do appear as guests.",
    watch: "The show is run alongside Electric Eye, a Shopify Premier Partner agency in Columbus, Ohio. Its site sends listeners to the agency as \"Shopify Experts\", so the show is also the agency's marketing. No guest or sponsor terms are published, and whether guests pay is not stated. It says it is in the top 5% of podcasts and one of Shopify's picks, and both are its own claims.",
    social: {
      yt: "https://www.youtube.com/c/HonestEcommerce",
    },
    launched: "2019-01-07", /* first episode in its feed, 7 Jan 2019; a trailer is dated 21 Dec 2018 (checked 2026-10-31) */
    updated: "2026-10-31",
  },
  {
    id: "ecommerceoptimizers",
    name: "Ecommerce Optimizers",
    url: "https://ecommerceoptimizers.com/podcast/",
    /* Read 2026-10-31: 30 items, 27 Oct 2023 to 25 Oct 2024. The feed's own
       pubDate is December 2025, but that is the channel's build date, not an
       episode. */
    rss: "https://feeds.libsyn.com/487682/rss",
    host: "Scott Reid",
    publisher: "Ecommerce Optimizers",
    started: "2023-10-27",
    lastEpisode: "2024-10-25",
    discontinued: true,
    episodeCount: 30,
    length: "About 43 minutes",
    platform: "Libsyn, on Apple Podcasts",
    free: true,
    topics: ["conversion optimization", "paid ads", "attribution", "seo", "personalization", "ai content"],
    one: "an ecommerce growth podcast from an agency, 30 episodes from october 2023 to october 2024, no longer publishing.",
    note: "Hosted by Scott Reid, who runs Ecommerce Optimizers, a growth agency for ecommerce brands. It ran for a year, 30 episodes, plus short 10 Minute Tune-Up episodes. Guests are mostly founders of ecommerce software companies and agencies, on attribution, personalization, AI product content, SEO and paid ads. Examples are Provalytics, Mason and Dresma. Listed as an archive of who was saying what in 2024.",
    watch: "No new episode since 25 October 2024, and no end was announced anywhere found. It is the agency's own show, so it also markets the agency. Most guests are vendors talking about their own product category.",
    social: {},
    launched: "2023-10-27", /* first episode in its feed, 27 Oct 2023 (checked 2026-10-31) */
    updated: "2026-10-31",
  },
];

/* The published list, under the plain name. Every consumer imports this one and
   is draft-safe without knowing drafts exist; /admin imports ALL_ above on
   purpose. See lib/drafts.js. */
export const PODCASTS = published(ALL_PODCASTS);

export const podcastOf = (id) => PODCASTS.find((p) => p.id === id) || null;
