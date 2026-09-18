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
 * a conflict worth naming, the same way a tracker built by an app vendor does,
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
 *  started     optional. YYYY, YYYY-MM or YYYY-MM-DD, whichever is knowable.
 *              Do not invent precision to fill the format.
 *  organisers  optional. Who runs it, where they are named publicly. Absent
 *              where nobody is, and `watch` says so.
 *  audience    who it is actually for, in their terms. This is the field that
 *              matters most in this directory, because most Shopify community
 *              is merchant or agency shaped and an app vendor reading the
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
 * The section is not open. RESOURCE_KINDS.group is still `live: false`, and
 * lib/sections.js will not open a section on a catalogue of drafts alone, so
 * nothing below renders anywhere yet.
 */

import { published } from "./drafts";

export const ALL_COMMUNITIES = [
  {
    id: "shopdevalliance",
    name: "ShopDev Alliance",
    url: "https://shopdevalliance.com",
    platform: "Slack (Pro, so the history is searchable rather than 90 days deep)",
    price: "$30/mo or $300/yr",
    free: false,
    entry: "Referral only since 1 September 2026",
    members: "170+",
    started: "2024",
    organisers: "David A. Lindahl and Taylor Page, both freelance Shopify developers",
    audience: "Freelance and agency Shopify developers, with app and theme developers explicitly welcome",
    topics: ["client work", "scope creep", "pricing and rates", "liquid", "theme development", "app development", "job leads", "platform releases"],
    one: "A paid, private Slack for working Shopify developers.",
    note: "Founded in 2024 by two freelance Shopify developers and run as a curated, moderated Slack rather than an open channel. It says it spans 18 timezones and shows 170 or so members, which is small on purpose. Membership is $30 a month or $300 a year and buys a Slack Pro seat, so the archive is searchable instead of rolling off at 90 days, plus a member profile, a resource library and project and job leads. Moderators enforce a published code of conduct and the site is blunt that no shilling is allowed. As of 1 September 2026 the application waitlist is closed and entry is referral only, with two exceptions that skip the line: a Shopify Build Award, or a Community Leader badge from the official Shopify Dev forums.",
    watch: "It is a developer community, not an app vendor one. App and theme developers are named as welcome and the founders are both freelancers, so the centre of gravity is client work, scope and rates rather than listing strategy, Partner billing or App Store distribution. Useful for hiring and for the platform-release chatter, thinner on the things this directory is otherwise about. Entry is the real cost, not the fee: since applications closed you need a referral, an award or a forum badge, so it is not somewhere you can decide to join this week. The published figures, 170+ members and 18 timezones, are self-reported and there is no public archive to check the room against before paying. Not sponsored by or affiliated with Shopify, which the site states itself.",
    social: {
      li: "https://www.linkedin.com/company/shopdev-alliance/",
      x: "https://www.x.com/ShopDevAlliance/",
      gh: "https://github.com/ShopDev-Alliance",
    },
    updated: "2026-09-18",
    draft: true,
  },
];

/*
 * The published list, under the plain name. Every consumer imports this one
 * and is draft-safe without knowing drafts exist; /admin imports ALL_ above
 * on purpose. See lib/drafts.js.
 */
export const COMMUNITIES = published(ALL_COMMUNITIES);
