/*
 * Groups and communities.
 *
 * The third catalogue, and the third shape. A tool is judged on what it does,
 * what it costs and who owns it; a newsletter on whether it is still going and
 * who writes it; a community on who is actually in the room. Forcing this one
 * through the tool shape would mean a `cat` from a list of software categories
 * and no room for the two things that decide whether it is worth joining: who
 * it is for, and whether you can get in at all.
 *
 * Shared with every other kind, because it is the directory's editorial
 * contract rather than anything about the subject: `id`, `name`, `url`, `one`,
 * `note`, `watch`, `social`, `logo`, `ratings`, `updated`, `draft`. `watch`
 * especially. A paid community run by people who sell into the same market has
 * a conflict worth naming, the same way a tracker built by an app developer does,
 * and it is no more theirs to edit than a tool's is.
 *
 * ------------------------------------------------------------------
 *  Shape
 * ------------------------------------------------------------------
 *  id          permanent. Votes, reviews and any future claim key on it.
 *  name        as the community calls itself.
 *  url         where you would go to find out about joining.
 *  platform    Slack, Discord, WhatsApp, Facebook, LinkedIn, a forum. This is
 *              most of what decides whether it is usable day to day, and
 *              whether anything said in it survives being said.
 *  price       what membership costs, as a string, same as a tool's. "Free"
 *              where it is free, and say so rather than omitting it.
 *  free        boolean. No fee to join at all.
 *  entry       how you get in: "Open", "Application", "Referral only",
 *              "Invite only", "Waitlist". The fee is rarely the real barrier.
 *  members     optional. A number the community publishes about itself. Goes
 *              stale, so it is only honest next to `updated`, and it is
 *              omitted rather than estimated where nothing is published.
 *  launched    is `started` for this kind (lib/launched.js reads it); set
 *              `launched: "unknown"` when it was looked for and not published.
 *  started     optional. YYYY, YYYY-MM or YYYY-MM-DD, whichever is knowable.
 *              Do not invent precision to fill the format.
 *  organisers  optional. Who runs it, where they are named publicly. Absent
 *              where nobody is, and `watch` says so.
 *  audience    who it is actually for, in their terms. This is the field that
 *              matters most in this directory, because most Shopify community
 *              is merchant or agency shaped and an app developer reading the
 *              label can waste a month finding that out.
 *  topics      what gets discussed.
 *  one         one line, lowercase-ish, no marketing.
 *  note        what it is and who is in it.
 *  watch       the honest caveat. Never editable by whoever is listed.
 *  social      optional, and only profiles published on their own site.
 *  logo        optional path under /public/logos/.
 *  ratings     optional external scores, same shape and same rules as tools:
 *              entered by hand, never scraped, never any review text.
 *  updated     YYYY-MM-DD this entry was last touched editorially.
 *  draft       optional. See lib/drafts.js.
 *
 * The section is open (2026-11-06) at /communities. Two entries stay drafts:
 * a Facebook group and a LinkedIn group that can only be read while signed in,
 * so nothing about them except the address has been checked.
 *
 *  forBuilders optional. true where the people in it build on Shopify
 *              (apps, themes, client stores). Absent means merchant-shaped.
 *              It decides the group on /communities and the counted intro.
 *  ownership   optional, the shared owner reference (lib/owners.js), set
 *              only where the community is run by an owner already known.
 */

import { published } from "./drafts";

export const ALL_COMMUNITIES = [
  {
    id: "shopdevalliance",
    name: "ShopDev Alliance",
    url: "https://shopdevalliance.com",
    logo: "/logos/communities/shopdevalliance.svg", /* the icon its own page declares, 2026-11-06 (scripts/collect-logos.mjs) */
    platform: "Slack",
    price: "$30/mo or $300/yr",
    free: false,
    entry: "Referral only since 1 September 2026",
    members: "170+ members",
    started: "2024",
    organisers: "David A. Lindahl and Taylor Page, both freelance Shopify developers",
    audience: "Freelance and agency Shopify developers, with app and theme developers explicitly welcome",
    forBuilders: true,
    topics: ["client work", "scope creep", "pricing and rates", "liquid", "theme development", "app development", "job leads", "platform releases"],
    one: "A paid, private Slack for working Shopify developers.",
    note: "Founded in 2024 by two freelance Shopify developers. It is a curated, moderated Slack, not an open channel. It says it spans 18 time zones and shows 170 or so members, which is small on purpose. Membership is $30 a month or $300 a year. That buys a Slack Pro seat, so the whole archive stays searchable, not only the last 90 days. It also buys a member profile, a resource library, and project and job leads. Moderators enforce a published code of conduct, and the site says plainly that no self-promotion is allowed. Since 1 September 2026 the application waitlist is closed and entry is referral only. Two things get you in without a referral: a Shopify Build Award, or a Community Leader badge from the official Shopify Dev forums.",
    watch: "It is a community for freelance developers, not for app businesses. App and theme developers are named as welcome, and both founders are freelancers. So the main topics are client work, scope and rates, not listing strategy, Partner billing or App Store distribution. It is useful for hiring and for talk about platform releases. It has less on the other topics this directory covers. Getting in is the real cost, not the fee. Since applications closed you need a referral, an award or a forum badge, so you cannot decide to join this week. The published figures, 170+ members and 18 time zones, are self-reported and were read on 13 October 2026. There is no public archive to see who is in it before you pay. Not sponsored by or affiliated with Shopify, which the site states itself.",
    social: {
      li: "https://www.linkedin.com/company/shopdev-alliance/",
      x: "https://www.x.com/ShopDevAlliance/",
      gh: "https://github.com/ShopDev-Alliance",
    },
    updated: "2026-11-06",
    /* Site read 2026-10-13. On 2026-11-06 it answered 429 to a re-check, so the
       figures stand as read on the 13th and the watch says so. */
  },
  {
    id: "appfoundersclub",
    name: "App Founders Club",
    url: "https://www.facebook.com/groups/appfoundersclub",
    platform: "Facebook group",
    price: "Not checked",
    free: true,
    entry: "Not checked",
    audience: "Not checked. The name suggests app founders.",
    topics: [],
    one: "a facebook group for app founders. nothing about it is checked yet.",
    note: "A Facebook group at facebook.com/groups/appfoundersclub. Facebook shows a group only to signed-in users, so its name, size, owners, rules and whether it is private could not be read on 2026-10-17. A web search found no page about a group of this name.",
    watch: "Unverified. Everything here except the address is a placeholder until someone reads the group while signed in to Facebook. Check who runs it, whether app developers or merchants make up most of it, and whether it is active, before publishing.",
    social: {},
    updated: "2026-11-06",
    draft: true,
  },
  {
    id: "linkedin-group-13751134",
    name: "LinkedIn group 13751134",
    url: "https://www.linkedin.com/groups/13751134/",
    platform: "LinkedIn group",
    price: "Not checked",
    free: true,
    entry: "Not checked",
    audience: "Not checked.",
    topics: [],
    one: "a linkedin group, suggested for this directory. nothing about it is checked yet.",
    note: "A LinkedIn group at linkedin.com/groups/13751134. LinkedIn shows groups only to signed-in users, so its name, size, owners and rules could not be read on 2026-10-17. A web search found no page that names it. The id is a placeholder from the address and must not change once published; the name can.",
    watch: "Unverified. Everything here except the address is a placeholder until someone reads the group while signed in to LinkedIn. Check its name, who runs it, whether app developers or merchants make up most of it, and whether it is active, before publishing.",
    social: {},
    updated: "2026-11-06",
    draft: true,
  },
  {
    id: "shopifycommunity",
    name: "Shopify Community",
    url: "https://community.shopify.com/",
    logo: "/logos/communities/shopifycommunity.png", /* the icon its own page declares, 2026-11-06 (scripts/collect-logos.mjs) */
    platform: "Discourse forum run by Shopify",
    price: "Free",
    free: true,
    entry: "Open, with a Shopify account to post",
    members: "1,602,591 accounts, 5,577 active in the last 30 days",
    launched: "unknown", /* no opening date on the forum's own pages (checked 2026-11-06). Rules read at /faq the same day. */
    organisers: "Shopify",
    ownership: { id: "shopify", name: "Shopify" },
    audience: "Shopify merchants asking how to run their store, with partners and app developers answering",
    topics: ["store setup", "themes", "payments", "shipping", "apps", "technical questions"],
    one: "shopify's official public forum, where merchants ask and partners answer.",
    note: "Shopify's own forum, free and public, where merchants ask questions about running their store. Anyone can read it. Posting needs a Shopify account. On 6 November 2026 it had 1,602,591 accounts, 5,577 of them active in the last 30 days, and 1,104 new topics that month. For an app developer it records the problems merchants describe in their own words. Questions about a specific app go to the Shopify Apps board, and app recommendations to the Ask and Offer board.",
    watch: "Built for merchants, not app developers. Its rules count any app recommendation outside the Ask and Offer board as spam, even an honest one for an app you have no link to. So on most boards you can help with the problem but cannot name your app. Technical questions about Shopify's APIs belong on the separate developer forum at community.shopify.dev. The account count includes every merchant who ever signed in, so the 30-day figure is the one that says how busy it is. The figures are the forum software's own counts on the day it was read.",
    social: {},
    updated: "2026-11-06",
  },
  {
    id: "shopifydevcommunity",
    name: "Shopify Developer Community",
    url: "https://community.shopify.dev/",
    logo: "/logos/communities/shopifydevcommunity.png", /* the icon its own page declares, 2026-11-06 (scripts/collect-logos.mjs) */
    platform: "Discourse forum run by Shopify",
    price: "Free",
    free: true,
    entry: "Open, with an account to post",
    members: "19,571 accounts, 1,627 active in the last 30 days",
    started: "2024-06",
    organisers: "Shopify",
    ownership: { id: "shopify", name: "Shopify" },
    audience: "Developers building apps and themes on Shopify's APIs, with Shopify staff answering",
    forBuilders: true,
    topics: ["graphql admin api", "functions", "extensions", "webhooks", "app store and billing api", "built for shopify", "developer changelog"],
    one: "shopify's official forum for app and theme developers, where shopify staff answer api questions.",
    note: "Shopify's forum for developers, opened in June 2024. On 6 November 2026 it had 19,571 accounts, 1,627 of them active in the last 30 days, and 331 new topics that month. Boards cover the GraphQL Admin API, Functions, extensions, webhooks, the App Store and Billing API, Built for Shopify and the developer changelog. Shopify staff answer here, which makes it the closest thing to official support for an app's technical problems.",
    watch: "It is for technical questions about Shopify's APIs, and its guidelines remove promotional posts as spam. So it is a place to get answers and see what other developers run into, not to find customers. The talk is about building, not running an app business: pricing, marketing and growth are mostly absent. The figures are the forum software's own counts on the day it was read.",
    social: {},
    updated: "2026-11-06",
  },
  {
    id: "talkshop",
    name: "Talk Shop",
    url: "https://www.letstalkshop.com/",
    /* The invite that answers: Discord's public invite API for
       discord.gg/talk-shop returned the server "Talk Shop" on 2026-11-09. The
       site shows a second invite link, not yet checked. join and
       shopifySpecific are recorded here but no community page renders them yet. */
    join: "https://discord.gg/talk-shop",
    platform: "Discord",
    price: "Free",
    free: true,
    entry: "Open",
    shopifySpecific: true,
    /* Discord's own count for discord.gg/talk-shop on 2026-11-09:
       approximate_member_count 5,350, presence 263. The site's figures
       disagree with each other (5,300+ and 600+ active); this is Discord's. */
    members: "5,350 members by Discord's count, 263 online when read",
    /* The server's id 1143352199045447841 dates its creation to 22 August
       2023 (Discord snowflake). Not stated by the community itself. */
    started: "2023-08",
    ownership: { id: "talk-shop", name: "Talk Shop" },
    /* No forBuilders: most of the server is merchants and agencies. */
    audience: "Mostly Shopify merchants and agencies, with a developer channel",
    topics: ["developers", "growth", "entrepreneurs", "support", "experts"],
    one: "A Shopify Discord for merchants, developers and experts.",
    note: "A general Shopify Discord with sub-communities for developers, growth, entrepreneurs, support and experts. Runs a blog and a daily ecommerce newsletter alongside it. The developer channel is the part relevant here; most of the server is merchants and agencies.",
    watch: "Member numbers are inconsistent on their own site: the homepage says 5,300+ members while a panel further down says 600+ active, and two different Discord invite links appear on the same page. Several stat counters render as zero. Treat the size claims as unverified. Mixed audience, so app developers are a minority of the room.",
    /* Verify before publishing: which Discord invite is live (talk-shop is),
       what the actual member count is, and whether the blog's tool roundups
       carry affiliate links. */
    social: {},
    updated: "2026-11-10",
  },
];

/*
 * The published list, under the plain name. Every consumer imports this one
 * and is draft-safe without knowing drafts exist; /admin imports ALL_ above
 * on purpose. See lib/drafts.js.
 */
export const COMMUNITIES = published(ALL_COMMUNITIES);
