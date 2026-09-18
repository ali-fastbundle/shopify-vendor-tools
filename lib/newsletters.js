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
    author: "Yuvraj Kewate",
    cadence: "Weekly",
    started: "2025-11-05",
    /*
     * 42 issues from 2025-11-05 at one a week lands on 2026-08-19, four weeks
     * before this entry was written. Either the count was read a month ago or
     * the run is not quite unbroken. Worth settling before this is published,
     * since "weekly without a gap" is the claim the note leans on.
     */
    issueCount: 42,
    platform: "beehiiv",
    free: true,
    topics: ["platform changes", "app architecture", "distribution", "security", "infrastructure"],
    shopifySpecific: true,
    one: "Weekly read on what Shopify is changing and what it means for app businesses.",
    note: "42 issues since November 2025, weekly without a gap. Short: most issues are a two to three minute read. Covers platform shifts rather than generic growth advice: Sidekick changing how merchants find apps, Next Gen Events and what it means for app architecture, Shopify absorbing infrastructure that apps used to build themselves and what that does to defensibility. Free, no paid tier.",
    watch: "Published by TheSaaSHub, who also build PartnerDock, an affiliate platform listed in this directory. Issues have also covered tools listed here, including Meridian. Worth reading with that in mind, as with anything written by a vendor about a market they sell into.",
    social: {},
    updated: "2026-09-17",
    draft: true,
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
    note: "Founded in 2022 by former Statista people. Runs a market intelligence platform covering 56,000+ retailers across 150+ countries and 250+ product categories, built on transaction analytics, web traffic and continuous crawling of retailer sites. The free output is the blog and the weekly recap, which run on revenue figures, growth rates and category movement rather than opinion. Useful for app vendors in a specific way: it shows which merchant categories and regions are actually growing, which is the demand signal behind who installs your app. Also published as a LinkedIn newsletter, \"eCommerce in a Nutshell\".",
    watch: "Written for retailers and brands doing market analysis, not for app developers, so you are reading it sideways for demand signals rather than directly. The free material is the top of a funnel for an enterprise data product, and the revenue figures are modelled estimates rather than disclosed numbers.",
    social: {},
    updated: "2026-09-17",
    draft: true,
  },
  {
    id: "dtc",
    name: "DTC Newsletter",
    url: "https://www.directtoconsumer.co/",
    publisher: "DTC Media",
    cadence: "Daily, weekdays",
    issueCount: 1159,
    platform: "Own site",
    free: true,
    topics: ["paid media", "creative testing", "CRO", "retention", "AI shopping", "brand teardowns", "tariffs and supply chain"],
    one: "Daily DTC operator newsletter, 155,000+ readers, written for the merchants your app sells to.",
    note: "The largest thing in this section by some distance: 155,000+ claimed readers and over 1,150 issues, daily on weekdays. Written for DTC brand operators and marketers, not for app developers, which is exactly why it is useful here. A continuous read on what merchants are worried about and what they are buying: Meta Muse checking out from Shopify stores, ChatGPT Shopping depending on merchant product feeds, Q4 shipping costs squeezing margins, bottom-of-funnel conversion leaks. Regular teardowns of individual brands' Shopify stacks show which apps real stores run and why. A daily podcast runs alongside it.",
    watch: "Agency-owned media. Pilothouse, the agency behind it, appears as the analyst in most issues, so a large share of the editorial is also their content marketing. Individual sections carry named sponsors in the same voice as the reporting. The reader count is self-reported. Read it for demand signal and brand teardowns, not for neutral tooling advice.",
    social: {
      li: "https://www.linkedin.com/company/dtc-mediateam/",
      x: "https://x.com/DTCNewsletter",
      yt: "https://www.youtube.com/@DTCPodcast",
    },
    updated: "2026-09-17",
    draft: true,
  },
  {
    id: "cpgd",
    name: "CPGD",
    url: "https://cpgdxyz.substack.com/",
    publisher: "CPGD",
    /* Cadence deliberately absent rather than guessed. The watch note says so. */
    started: "2026-02",
    platform: "Substack",
    free: true,
    topics: ["consumer brands", "brand building", "founder interviews"],
    one: "Interviews and analysis from the consumer brand-building side of the ecosystem.",
    note: "From the team behind the CPGD Brand Builder Directory, which lists several hundred agencies and studios that build consumer brands. The newsletter covers what is coming in consumer and talks to the people building it. Small and young: launched early 2026 with hundreds of subscribers by their own description. Relevant here sideways, as a view of the brand and agency layer rather than the app layer, which is where partner and referral relationships come from.",
    watch: "The smallest entry in this section and the least established. Cadence and issue count are not published in a readable form, so consistency is unproven. Sits alongside a directory business, so it functions partly as distribution for that.",
    social: {},
    updated: "2026-09-17",
    draft: true,
  },
  {
    id: "retailinsider",
    name: "Retail Insider",
    url: "https://retail-insider.com/",
    publisher: "Retail Insider Media Ltd.",
    cadence: "Daily synopsis, plus monthly and quarterly reports",
    platform: "Own site",
    free: true,
    topics: ["Canadian retail", "retailer financials", "store openings", "consumer spending", "tariffs"],
    one: "Canadian retail industry trade press, daily.",
    note: "Describes itself as Canada's most-read online retail industry publication. A daily synopsis plus retailer financials, people moves, op-eds, and recurring reports including a monthly Canadian Retail Monitor and quarterly shopping centre and luxury analysis. Podcast and magazine alongside. Coverage is predominantly physical retail and the Canadian market: quarterly results, store openings, consumer spending, tariffs and supply chain.",
    watch: "The furthest from this audience of anything listed here. Very little ecommerce, no Shopify coverage, and written for retail operators and analysts rather than software. Read it if you sell to Canadian retailers or want macro consumer context, not for anything about apps. Carries display advertising and sponsored op-eds from vendors.",
    social: {
      li: "https://www.linkedin.com/company/retail-insider/",
      /* Their own published link is the twitter.com form. Left as they publish
         it rather than rewritten to x.com. */
      x: "https://twitter.com/retailinsider_",
      yt: "https://www.youtube.com/channel/UCNIIaKxQcs291713wv-Jd2Q",
    },
    updated: "2026-09-17",
    draft: true,
  },
  {
    id: "operators",
    name: "Operators",
    url: "https://operatorscontent.com/",
    publisher: "Operators",
    author: "Sean Frank, Matt Bertulli, Mike Beckham, Jason Panzer; curated by Aaron Orendorff",
    cadence: "Weekly",
    /* 125 weekly issues would put the first one around April 2024, but no start
       date is published anywhere on the site, so it is derived arithmetic
       rather than a fact and `started` stays absent. Worth settling before
       this is published if the run is a claim the note leans on. */
    issueCount: 125,
    platform: "Kit",
    free: true,
    topics: ["paid media", "CAC and profitability", "tech stacks", "influencer marketing", "operations", "Q4 planning"],
    one: "Four nine-figure DTC founders writing about running their own brands, weekly.",
    note: "Written by operators rather than by media: the people behind Ridge, Pela and Lomi, Simple Modern and HexClad, with guests from Jones Road, Haus and Common Thread. 125 issues, weekly, eight to fourteen minutes each, longer and denser than the daily recaps. Specifics rather than takes: what CAC and spend level maximises profit, Q4 conversion benchmarks by category, how Ridge cut support cost 70% with AI. For app vendors the most directly useful recurring format is the stack teardown: one issue lists the 25 tools running a $500M cookware brand, which is a clearer picture of what large merchants actually buy than any vendor page. They are currently launching a new brand in public and documenting each step.",
    watch: "Written by brand owners with active commercial interests, including masterminds, workshops, events and a brand of their own, so the newsletter doubles as distribution for those. The operators run nine-figure businesses and the advice assumes that scale: CAC maths and media budgets that do not transfer to the merchants most apps serve. Sponsored placements sit in the same voice as the writing.",
    social: {},
    updated: "2026-09-18",
    draft: true,
  },
];

/* The published list, and the name anything rendering newsletters imports. */
export const NEWSLETTERS = published(ALL_NEWSLETTERS);

export const newsletterOf = (id) => NEWSLETTERS.find((n) => n.id === id) || null;
