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
 *  author      the person who actually writes it.
 *  cadence     "Weekly", "Fortnightly", "When there is something to say".
 *  started     YYYY-MM-DD of the first issue. With issueCount this is how a
 *              reader works out whether the run has gaps in it.
 *  issueCount  issues published. A number that goes stale, so it is only
 *              honest next to `updated`.
 *  platform    beehiiv, Substack, ConvertKit, self-hosted. Says something
 *              about whether an archive exists and whether it will survive.
 *  free        boolean. No paid tier at all, or a free tier that is the point.
 *  topics      what it actually covers, in the writer's terms, not categories.
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
    one: "Weekly read on what Shopify is changing and what it means for app businesses.",
    note: "42 issues since November 2025, weekly without a gap. Short: most issues are a two to three minute read. Covers platform shifts rather than generic growth advice: Sidekick changing how merchants find apps, Next Gen Events and what it means for app architecture, Shopify absorbing infrastructure that apps used to build themselves and what that does to defensibility. Free, no paid tier.",
    watch: "Published by TheSaaSHub, who also build PartnerDock, an affiliate platform listed in this directory. Issues have also covered tools listed here, including Meridian. Worth reading with that in mind, as with anything written by a vendor about a market they sell into.",
    social: {},
    updated: "2026-09-17",
    draft: true,
  },
];

/* The published list, and the name anything rendering newsletters imports. */
export const NEWSLETTERS = published(ALL_NEWSLETTERS);

export const newsletterOf = (id) => NEWSLETTERS.find((n) => n.id === id) || null;
