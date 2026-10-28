/*
 * Newsletters.
 *
 * A separate file with a separate shape, because a newsletter is not a tool
 * with different words in it. A tool is judged on what it does, what it costs
 * and who owns it; a newsletter is judged on whether it is still going, how
 * often, how long it has been going, who writes it and what they are selling
 * on the side. Forcing one through the other's fields would mean a `price` on
 * something free, a `cat` from a list of tool categories that do not describe
 * writing, and no room for the two facts that actually matter: cadence and
 * whether the run has gaps in it.
 *
 * Shared with the tool shape, deliberately: `one`, `note`, `watch`, `social`,
 * `logo`, `ratings`, `updated`, `draft`. Those are the directory's own
 * editorial contract rather than anything about software, and they mean the
 * same thing here. `watch` in particular: a newsletter written by a vendor
 * about the market they sell into has a conflict worth naming, the same way a
 * tracker built by an app vendor does.
 *
 * ------------------------------------------------------------------
 *  Shape
 * ------------------------------------------------------------------
 *  id          permanent. Votes, reviews and any future claim key on it.
 *  name        as the publication calls itself.
 *  url         where to subscribe.
 *  publisher   the company or brand behind it, if it is not just a person.
 *  author      optional. The person who actually writes it. Omit where a team
 *              writes it and no one person is credited.
 *  cadence     optional. "Weekly", "Fortnightly", "When there is something to
 *              say". Omit where it is genuinely not published anywhere, and
 *              say so in `watch` rather than guessing a rhythm from the
 *              archive.
 *  launched    a newsletter's launch is its first issue, which is `started`
 *              below; `launched: "unknown"` records that it was looked for and
 *              not published. Shown as "First issue July 2024" beside the issue
 *              count, so a reader can see whether it has shipped steadily.
 *              lib/launched.js.
 *  started     optional. YYYY-MM-DD of the first issue, or YYYY-MM where only
 *              the month is knowable. Do not invent a day to fill the format.
 *  issueCount  optional. A number that goes stale, so it is only honest next
 *              to `updated`. Independent of `started`: a publication can have
 *              a countable run with no findable start date, or the reverse.
 *              Having both is what lets a reader check the run for gaps.
 *
 *              Omit both for something with no discrete numbered run at all,
 *              such as a blog with a weekly recap. Omitting is the honest
 *              option; there is no figure to estimate here.
 *  platform    beehiiv, Substack, ConvertKit, self-hosted. Says something
 *              about whether an archive exists and whether it will survive.
 *  rss         optional. The publication's own RSS or Atom feed, checked by
 *              hand to return items. Followers get a new issue's title and
 *              link from it (lib/notify.js), never the body. Absent means no
 *              public feed was found, which is common: beehiiv only exposes
 *              one when the publisher switches it on, and Kit and most
 *              Webflow sites have none. Never guess a path; a feed URL that
 *              404s is a daily failed fetch for nothing.
 *  free        boolean. No paid tier at all, or a free tier that is the point.
 *  topics      what it actually covers, in the writer's terms, not categories.
 *  shopifySpecific
 *              optional. True when the publication is about Shopify itself.
 *              Renders a neutral "Shopify-specific" badge. This is a positive
 *              tag and nothing else: absent renders nothing at all, no badge
 *              and no disclaimer, because a newsletter that is not about
 *              Shopify is not thereby worse. Some of the most useful reading
 *              for an app vendor is about the market their merchants sell in.
 *              Not to be confused with the Shopify-exclusive rule for tools,
 *              which is a boundary on what gets listed at all. This is a label
 *              on things that are already listed.
 *  one         one line, lowercase-ish, no marketing.
 *  note        what it is and who it is for.
 *  watch       the honest caveat. Never editable by whoever is listed.
 *  pricingUrl  optional. Rarely useful for a newsletter, but a paid one
 *              has a page worth watching. See lib/monitor.js.
 *  changelogUrl
 *              optional. For a newsletter this is usually the archive, which
 *              is the page that answers "are they still publishing".
 *  social      optional, and only profiles published on their own site.
 *  logo        optional path under /public/logos/.
 *  ratings     optional external scores, same shape and same rules as tools:
 *              entered by hand, never scraped, never any review text.
 *  updated     YYYY-MM-DD this entry was last touched editorially.
 *  draft       optional. See lib/drafts.js.
 *
 * The section is not open. RESOURCE_KINDS.newsletter is still `live: false`,
 * and lib/sections.js will not open it on a catalogue of drafts alone, so
 * nothing below renders anywhere yet.
 */

import { published } from "./drafts";

export const ALL_NEWSLETTERS = [
  {
    id: "shopifyappfounders",
    name: "Shopify App Founders Edition",
    url: "https://shopifyappfounders.beehiiv.com/",
    publisher: "TheSaaSHub",
    ownership: { id: "thesaashub", name: "TheSaaSHub" },
    author: "Yuvraj Kewate",
    cadence: "Weekly",
    started: "2025-11-05",
    /*
     * 44 confirmed against the publisher's own archive on thesaashub.com on
     * 2026-10-02 (beehiiv itself 403s automated reads). 44 in ~48 weeks since
     * 2025-11-05 is weekly with a few gaps, not gapless, so the note says
     * "weekly" rather than "weekly without a gap".
     */
    issueCount: 44,
    platform: "beehiiv",
    free: true,
    topics: ["platform changes", "app architecture", "distribution", "security", "infrastructure"],
    shopifySpecific: true,
    one: "Weekly read on what Shopify is changing and what it means for app businesses.",
    note: "44 issues since November 2025, weekly. Short: most issues take two to three minutes to read. It covers platform changes, not general growth advice. Examples: Sidekick changing how merchants find apps, and what Next Gen Events means for app architecture. Also Shopify taking over infrastructure that apps used to build themselves, and what that does to how defensible an app is. Free, no paid tier.",
    watch: "Published by TheSaaSHub, who also build PartnerDock, an affiliate platform listed in this directory. Issues have also covered tools listed here, including Meridian. Read it with that in mind, as you would anything a vendor writes about a market it sells into.",
    social: {},
    updated: "2026-10-13",
  },
  {
    id: "ecdb",
    name: "ECDB",
    url: "https://ecdb.com/blog",
    publisher: "ECDB (ecommerceDB)",
    author: "ECDB analyst team",
    cadence: "Weekly, plus ongoing reports",
    /* No discrete numbered run to count, so started and issueCount are absent
       rather than estimated. */
    platform: "Own site and LinkedIn",
    free: true,
    topics: ["market data", "retailer revenue", "cross-border", "category trends", "marketplaces"],
    one: "Weekly ecommerce market data and analysis from a transaction-data company.",
    note: "Founded in 2022 by former Statista people. It runs a market intelligence platform covering 56,000+ retailers in 150+ countries and 250+ product categories. The data comes from transaction analytics, web traffic and continuous crawling of retailer sites. The free output is the blog and the weekly recap. Both are built on revenue figures, growth rates and category changes, not opinion. For app vendors it shows which merchant categories and regions are growing. That is the demand signal behind who installs your app. Also published as a LinkedIn newsletter, \"eCommerce in a Nutshell\".",
    watch: "Written for retailers and brands doing market analysis, not for app developers. You read it indirectly, for demand signals. The free material exists to bring in buyers for an enterprise data product. The revenue figures are modeled estimates, not disclosed numbers.",
    social: {},
    launched: "unknown", /* first issue: no newsletter start stated (checked 2026-10-23) */
    updated: "2026-10-13",
  },
  {
    id: "dtc",
    name: "DTC Newsletter",
    url: "https://www.directtoconsumer.co/",
    publisher: "DTC Media",
    ownership: { id: "dtc-media", name: "DTC Media" },
    cadence: "Daily, weekdays",
    issueCount: 1170,
    platform: "Own site",
    free: true,
    topics: ["paid media", "creative testing", "CRO", "retention", "AI shopping", "brand teardowns", "tariffs and supply chain"],
    one: "Daily DTC operator newsletter, 155,000+ readers, written for the merchants your app sells to.",
    note: "By far the largest entry in this section: 155,000+ claimed readers and over 1,150 issues, daily on weekdays. It is written for DTC brand operators and marketers, not for app developers. That is why it is useful here. It shows, every weekday, what merchants worry about and what they buy. Examples: Meta Muse checking out from Shopify stores, and ChatGPT Shopping depending on merchant product feeds. Also Q4 shipping costs cutting margins, and lost conversions at the bottom of the funnel. Regular teardowns of individual brands' Shopify stacks show which apps real stores run and why. A daily podcast runs alongside it.",
    watch: "Agency-owned media. Pilothouse, the agency behind it, appears as the analyst in most issues. So a large share of the editorial content is also their content marketing. Individual sections carry named sponsors, written in the same voice as the reporting. The reader count is self-reported. Read it for demand signal and brand teardowns, not for neutral advice on tools.",
    social: {
      li: "https://www.linkedin.com/company/dtc-mediateam/",
      x: "https://x.com/DTCNewsletter",
      yt: "https://www.youtube.com/@DTCPodcast",
    },
    launched: "unknown", /* first issue: the archive bottoms out at a 2021 migration, no start stated (checked 2026-10-23) */
    updated: "2026-10-13",
  },
  {
    id: "cpgd",
    name: "CPGD",
    url: "https://cpgdxyz.substack.com/",
    rss: "https://cpgdxyz.substack.com/feed",
    publisher: "CPGD",
    /* Cadence deliberately absent rather than guessed. The watch note says so. */
    started: "2026-02",
    platform: "Substack",
    free: true,
    topics: ["consumer brands", "brand building", "founder interviews"],
    one: "Interviews and analysis from the consumer brand-building side of the ecosystem.",
    note: "From the team behind the CPGD Brand Builder Directory. That directory lists several hundred agencies and studios that build consumer brands. The newsletter covers what is coming in the consumer sector and interviews the people building it. Small and young: launched in early 2026, with hundreds of subscribers by their own description. It is relevant here indirectly. It shows the brand and agency layer, not the app layer, and that layer is where partner and referral relationships come from.",
    watch: "The smallest entry in this section and the least established. Cadence and issue count are not published in a readable form, so consistency is unproven. It sits next to a directory business, and partly works as distribution for it.",
    social: {},
    updated: "2026-10-13",
  },
  {
    id: "retailinsider",
    name: "Retail Insider",
    url: "https://retail-insider.com/",
    rss: "https://retail-insider.com/feed",
    /* The homepage answers the monitor with a 403 from every network we tried,
       and the feed answers 200, so the feed is what the monitor reads. Item
       titles and dates only (feedText in lib/monitor.js). Checked 2026-10-13. */
    changelogUrl: "https://retail-insider.com/feed",
    publisher: "Retail Insider Media Ltd.",
    cadence: "Daily synopsis, plus monthly and quarterly reports",
    platform: "Own site",
    free: true,
    topics: ["Canadian retail", "retailer financials", "store openings", "consumer spending", "tariffs"],
    one: "Canadian retail industry trade press, daily.",
    note: "Describes itself as Canada's most-read online retail industry publication. A daily synopsis, plus retailer financials, people moves and op-eds. Recurring reports include a monthly Canadian Retail Monitor and quarterly analysis of shopping centers and luxury. A podcast and a magazine run alongside. Coverage is mostly physical retail and the Canadian market: quarterly results, store openings, consumer spending, tariffs and supply chain.",
    watch: "The furthest from this audience of anything listed here. Very little ecommerce and no Shopify coverage. It is written for retail operators and analysts, not for software. Read it if you sell to Canadian retailers or want macro consumer context, not for anything about apps. Carries display advertising and sponsored op-eds from vendors.",
    social: {
      li: "https://www.linkedin.com/company/retail-insider/",
      /* Their own published link is the twitter.com form. Left as they publish
         it rather than rewritten to x.com. */
      x: "https://twitter.com/retailinsider_",
      yt: "https://www.youtube.com/channel/UCNIIaKxQcs291713wv-Jd2Q",
    },
    launched: "unknown", /* first issue: the site's oldest post is 2012, not a newsletter issue (checked 2026-10-23) */
    updated: "2026-10-13",
  },
  {
    id: "operators",
    name: "Operators",
    url: "https://operatorscontent.com/",
    publisher: "Operators",
    author: "Sean Frank, Matt Bertulli, Mike Beckham, Jason Panzer; curated by Aaron Orendorff",
    cadence: "Weekly",
    /* Issue N0001, "It. Is. Here.", went out 2024-07-09 00:06 UTC (the evening
       of 8 July in the US), so the month only: operatorscontent.com/posts/n0001,
       checked 2026-10-23. An earlier comment here guessed April 2024 from the
       issue count; the publisher's own first issue says July. */
    started: "2024-07",
    issueCount: 130,
    platform: "Kit",
    free: true,
    topics: ["paid media", "CAC and profitability", "tech stacks", "influencer marketing", "operations", "Q4 planning"],
    one: "Four nine-figure DTC founders writing about running their own brands, weekly.",
    note: "Written by operators, not by media: the people behind Ridge, Pela and Lomi, Simple Modern and HexClad. Guests come from Jones Road, Haus and Common Thread. 130 issues, weekly, eight to fourteen minutes each. That is longer and denser than the daily recaps. It gives specifics, not opinions: which CAC and spend level maximizes profit, Q4 conversion benchmarks by category, how Ridge cut support cost 70% with AI. For app vendors the most useful recurring format is the stack teardown. One issue lists the 25 tools running a $500M cookware brand. That shows what large merchants buy more clearly than any vendor page. They are now launching a new brand in public and documenting each step.",
    watch: "Written by brand owners with active commercial interests: masterminds, workshops, events and a brand of their own. The newsletter is also distribution for those. The operators run nine-figure businesses, and the advice assumes that scale. Its CAC math and media budgets do not apply to the merchants most apps serve. Sponsored placements are written in the same voice as the editorial content.",
    social: {},
    updated: "2026-10-13",
  },
  {
    id: "shopops",
    name: "ShopOps Weekly",
    url: "https://shopifyentrepreneurs.beehiiv.com/",
    publisher: "ShopExperts",
    ownership: { id: "shopexperts", name: "ShopExperts" },
    cadence: "Weekly, Fridays",
    /*
     * beehiiv blocks automated reads (403 to every user agent tried on
     * 2026-10-02), so no figure here could be stood up from outside. Rather
     * than publish an unverifiable number on a launch page, issueCount is
     * omitted and the note makes no count or gapless claim. "Weekly" is in the
     * publication's own name; "Fridays" is the editor's. `started` is absent
     * because the archive publishes no start date, so it is not invented.
     */
    platform: "beehiiv",
    free: true,
    topics: ["platform changes", "AI channels", "app ecosystem", "theme and admin updates", "merchant operations"],
    /* About the Shopify platform itself, which is why it groups with the app-
       vendor side even though it is written for merchants. The watch keeps that
       honest. */
    shopifySpecific: true,
    one: "Weekly digest of what Shopify shipped, written for merchants.",
    note: "The most consistent tracker of Shopify platform changes in this section, weekly. It covers what shipped each week, not commentary. Examples: ChatGPT Ads going live for Shopify, Meta becoming an AI channel, Stocky being retired, variants gaining multiple barcodes, same-day delivery opening to every store. For app vendors the value is the log of platform changes. When Shopify builds in a capability, your roadmap usually changes that week. This catches it without you reading the changelog yourself. It also tracks app-market moves, such as Judge.me pricing below Shopify Email. Free, no paid tier.",
    watch: "Published by ShopExperts, who also run App Store Research. Both are listed in this directory. It is written for merchants, not app developers, so app-ecosystem coverage is a side topic, not the focus.",
    social: {},
    launched: "unknown", /* first issue: the oldest issue online is 41, from October 2023 (checked 2026-10-23) */
    updated: "2026-10-13",
  },
  {
    id: "shopify-app-spotlight",
    name: "Shopify App Spotlight",
    url: "https://www.linkedin.com/newsletters/shopify-app-spotlight-7519249182239670272",
    author: "Israt Eva",
    /* "Published weekly" on the newsletter page, checked 2026-10-23. One
       edition, dated 23 October 2026; the id in the URL encodes the same
       day, so it is the first. */
    cadence: "Weekly",
    started: "2026-10-23",
    issueCount: 1,
    platform: "LinkedIn",
    free: true,
    shopifySpecific: true,
    topics: ["Shopify apps", "app founders", "founder interviews"],
    one: "Weekly stories about the people who build Shopify apps, on LinkedIn.",
    note: "Each edition profiles one Shopify app and the team behind it: the problem it solves and what they learned. The first edition, on 23 October 2026, covers T Lab and selling in seven languages. It is written for merchants, but the subjects are app teams, so a vendor reads it to see how other apps tell their story.",
    watch: "One edition so far, so the weekly cadence is a stated plan, not a record. The page gives no job or company for the author. It does not say how apps are chosen, or whether an app pays to be featured.",
    social: {},
    updated: "2026-10-23",
  },
  {
    id: "retailbulletin",
    name: "The Retail Bulletin",
    url: "https://www.theretailbulletin.com/register/",
    /* Linked from the site's own footer (/rss/), checked 2026-10-21: 200,
       RSS 2.0, 100 items. */
    rss: "https://www.theretailbulletin.com/rss/",
    publisher: "Retail Bulletin Events Limited",
    ownership: { id: "retail-bulletin", name: "The Retail Bulletin" },
    cadence: "Every weekday morning, plus a Saturday roundup",
    started: "2002",
    platform: "Own site",
    free: true,
    topics: ["UK retail", "trading updates", "retailer results", "store openings", "people moves"],
    one: "UK retail trade news, every weekday morning.",
    note: "An independent UK retail trade publication, running since 2002. The daily newsletter carries trading updates, results, store openings and appointments across grocery, fashion, home and the rest of the high street. Editor Angela Beevers leads the news team, and columnist Glynn Davis writes features and interviews. Everything is free, with no paywall. For an app vendor it is context on UK retailers, not on software.",
    watch: "Almost all physical and high-street retail, with very little on ecommerce software and nothing on Shopify apps. The business behind it runs events, summits and roundtables where vendors pay to sponsor and speak. Its whitepapers and sponsored pages come from those vendors. Its own figure of 21,000+ subscribed decision makers is a claim, not an audited number.",
    social: {
      li: "https://www.linkedin.com/company/the-retail-bulletin/",
      x: "https://twitter.com/RetailBulletin",
      yt: "https://www.youtube.com/channel/UCGpAPUoa_4eEQaEwscVNbBA",
    },
    updated: "2026-10-21",
  },
  {
    id: "marketplacepulse",
    name: "Marketplace Pulse",
    url: "https://www.marketplacepulse.com/",
    /* Found, not guessed: the homepage declares it in its own <head> as
       <link href="/articles/recent.atom" rel="alternate" type="application/atom+xml">.
       Rechecked 2026-10-10: 200, 20 entries. */
    rss: "https://www.marketplacepulse.com/articles/recent.atom",
    publisher: "Marketplace Pulse",
    /* From the newsletter's own Mailchimp archive (us12.campaign-archive.com,
       the list the signup form posts to), checked 2026-10-10: 20 sends in the
       31 weeks from 6 March to 9 October 2026, 18 on a Thursday. Gaps of one
       week (10), two (7), three (1) and four (1), and fortnightly since late
       August. Each send is one article, so the article feed shows the same
       rhythm. Their own pages say "every week" and "a few new articles every
       week"; the archive does not bear either out. */
    cadence: "Every one to two weeks, usually Thursdays",
    platform: "Own site",
    free: true,
    topics: ["marketplace data", "Amazon", "TikTok Shop", "seller economics", "ecommerce share", "AI shopping"],
    one: "Marketplace data journalism, cited by the WSJ, NYT and Bloomberg.",
    note: "Built on its own data, not commentary: its own parsing of sellers, products and categories across Amazon, TikTok Shop, Walmart and eBay. It publishes every week or two, as short data-led articles and longer research reports. Recent pieces cover 150,000 US TikTok Shop sellers and 4.5 million products. Others cover Amazon opening Seller Central to rival marketplaces including Shopify, and US ecommerce at a record 17.1% of retail. For app vendors it is the clearest view of merchant attention moving from Shopify to marketplaces. That is usually where multichannel demand comes from.",
    watch: "Focused on marketplaces, not Shopify. Shopify appears where it meets Amazon or TikTok, not as a subject of its own. Figures are Marketplace Pulse estimates from their own tracking, not disclosed numbers. They say this clearly, but the precise figures can look official. Sells data products and advertising alongside the free articles.",
    social: {
      li: "https://www.linkedin.com/company/marketplace-pulse",
      /* As the site publishes it: twitter.com, and the handle is 15
         characters, so it really is "marketplacepuls". */
      x: "https://twitter.com/marketplacepuls",
    },
    launched: "unknown", /* first issue: the archive shows only recent campaigns (checked 2026-10-23) */
    updated: "2026-10-13",
  },
  {
    id: "shopifreaks",
    name: "Shopifreaks",
    url: "https://www.shopifreaks.com/",
    /* Checked 2026-10-28: 200, the issues only, newest #301. The site-wide
       /feed/ is the daily news articles, not the newsletter, so it is not
       this one. */
    rss: "https://www.shopifreaks.com/category/newsletters/feed/",
    publisher: "Shopifreaks",
    author: "Paul Drecksler",
    /* "a comprehensive weekly e-mail every Monday afternoon", on the homepage. */
    cadence: "Weekly, Mondays",
    started: "2021-01-25",
    /*
     * From the site's own archive (/category/newsletters/, 17 pages), read on
     * 2026-10-28: #1 on 25 January 2021, #301 on 26 October 2026. 301 issues
     * in about 301 weeks, so the note can say weekly with no visible gaps.
     */
    issueCount: 301,
    changelogUrl: "https://www.shopifreaks.com/category/newsletters/",
    platform: "Own site",
    free: true,
    topics: ["ecommerce news", "Shopify", "Amazon", "TikTok Shop", "AI agents", "funding rounds", "policy"],
    one: "Weekly roundup of ecommerce news, with Shopify, Amazon and TikTok Shop up front.",
    note: "Short summaries of the week's ecommerce news, sent every Monday. 301 issues since January 2021, weekly with no visible gaps. It covers platforms, funding rounds, policy and the large players: Shopify, Amazon, TikTok Shop, Temu and Meta. Recent issues covered Shopify welcoming all AI agents and Walmart's bundle membership. For app vendors it is one read on what changed around Shopify, not only inside it. The site also publishes daily news articles. Free.",
    watch: "Funded by paid \"News Partners\" named on the site, including Seguno and DataFeedWatch, which both sell apps to Shopify merchants. Read coverage of sponsors with that in mind. The 20,000+ subscribers and the 5.0 rating from 135 Google reviews are the publisher's own figures, not checked here.",
    /* The site links only a Facebook page, which is not a network this
       directory renders. */
    social: {},
    launched: "2021-01-25", /* first issue: "#1 – Deliveright, Affirm, $2 billion, and fighting climate change", Jan 25, 2021, on shopifreaks.com/category/newsletters/page/17/ (checked 2026-10-28) */
    updated: "2026-10-28",
  },
];

/* The published list, and the name anything rendering newsletters imports. */
export const NEWSLETTERS = published(ALL_NEWSLETTERS);

export const newsletterOf = (id) => NEWSLETTERS.find((n) => n.id === id) || null;
