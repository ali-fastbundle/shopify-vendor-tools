/* Catalogue, categories and palette. Edit tools here; the UI reads from this file. */

import { published } from "./drafts";

/*
 * The headline, in one place. The h1 and the share card both read it, because
 * the card's whole job is to be the page — two literals drifted apart once
 * already.
 */
export const HEADLINE = "The Shopify app vendor's toolkit";

export const AUTHOR = "Ali A.";

/*
 * Where the byline points. Empty renders the byline as plain text, so the site
 * is correct either way — set it to a profile you actually control rather than
 * one that looks plausible.
 */
export const AUTHOR_URL = "https://www.linkedin.com/in/ali-arabzadeh/";

/* ================================================================== */
/*  Design tokens                                                      */
/*                                                                     */
/*  Every value here is a CSS variable, declared once per theme in      */
/*  app/globals.css. Components keep writing `background: C.panel` and  */
/*  the theme decides what that is, so a light mode costs no branching  */
/*  in the components and nothing can be light in one place and dark    */
/*  in another.                                                        */
/*                                                                     */
/*  Two surfaces cannot resolve a variable, because they render         */
/*  without the stylesheet: the share card in app/og (satori) and the   */
/*  unsubscribe page in app/api/subscribe/remove (a bare Response).     */
/*  Those read DARK below — literal values, and dark on purpose, since  */
/*  an image and a one-line confirmation page have no theme to follow.  */
/* ================================================================== */

export const DARK = {
  bg: "#06110D",
  panel: "#0D1F19",
  raised: "#132A22",
  line: "rgba(255,255,255,0.09)",
  text: "#E8F2EC",
  muted: "#8CA79B",
  dim: "#5E7A6E",
};

export const C = {
  bg: "var(--c-bg)",
  panel: "var(--c-panel)",
  raised: "var(--c-raised)",
  line: "var(--c-line)",
  text: "var(--c-text)",
  muted: "var(--c-muted)",
  dim: "var(--c-dim)",

  /* Fills that used to be written inline as rgba(255,255,255,.0x) — they
     have to flip, or every secondary button turns into a white smudge on
     the light theme. */
  subtle: "var(--c-subtle)",
  stripe: "var(--c-stripe)",
  /* The border a neutral badge is drawn with. `line` is the hairline between
     surfaces; `edge` is the same idea one step up, so an outlined pill reads
     as an outline rather than as a smudge. */
  edge: "var(--c-edge)",
  field: "var(--c-field)",
  scrim: "var(--c-scrim)",
  tray: "var(--c-tray)",

  /* Whole backgrounds, so a gradient is one token rather than two colours
     a caller has to get right in both themes. */
  glow: "var(--c-glow)",
  hero: "var(--c-hero)",
  invite: "var(--c-invite)",

  shadowSm: "var(--c-shadow-sm)",
  shadowMd: "var(--c-shadow-md)",
  shadowLg: "var(--c-shadow-lg)",

  /*
   * The brand green is a fill in both themes and reads as one, so `accent`
   * does not move. As *text* it does: #00E08A on white is about 1.8:1.
   * accentInk is the same green taken down to a readable one, and the same
   * split applies to the warning and error hues. Anything filled uses the
   * first, anything set in type uses the second.
   */
  accent: "#00E08A",
  onAccent: "#06110D",
  accentInk: "var(--c-accent-ink)",
  accentSoft: "var(--c-accent-soft)",
  accentEdge: "var(--c-accent-edge)",
  warnInk: "var(--c-warn-ink)",
  badInk: "var(--c-bad-ink)",
  badSoft: "var(--c-bad-soft)",
  badEdge: "var(--c-bad-edge)",

  star: "var(--c-star)",
  starOff: "var(--c-star-off)",
};

/*
 * A category colour, as readable text.
 *
 * The hues are chosen against a near-black background and none of them
 * clears 4.5:1 on white. Each therefore has a darker twin at the same hue,
 * declared in globals.css and keyed by the hex itself so RESOURCE_KINDS —
 * which reuses these exact values — gets them for free.
 *
 * Fills, borders and the bars in the wordmark keep the original hex: the
 * colour still identifies the category everywhere it appears, it is only
 * type that shifts. The fallback is the hex, so a colour added without its
 * twin degrades to today's behaviour rather than to nothing.
 */
export const ink = (hex) => `var(--ink-${String(hex).replace("#", "").toLowerCase()}, ${hex})`;

/*
 * Spacing, on a 4px grid. Everything that was 7, 9, 11, 13 or 18 now lands
 * on one of these, which is most of what makes a layout look decided rather
 * than nudged.
 */
export const S = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, "2xl": 24, "3xl": 32, "4xl": 48, "5xl": 64,
};

/*
 * The gap between major bands of the page, and the only value used for that
 * job. Vertical rhythm used to arrive through the Tailwind door as mt-10,
 * pb-7, pb-14, pb-16 — four numbers nobody chose together, none of them named.
 * One name, two values, and the page reads as one rhythm at both sizes.
 */
export const BAND = { desktop: S["5xl"], mobile: S["3xl"] };

/* Corner radii. Cards 8, controls 6, the two sizes the Shopify admin uses. */
export const R = { control: 6, card: 8, modal: 12, pill: 999 };

/*
 * Type scale. Eight steps, down from the twenty half-point sizes this file's
 * consumers had grown — 13.5 and 14 next to each other is not a decision
 * anybody made, it is two people rounding differently.
 */
export const F = {
  xs: 12, sm: 13, md: 14, lg: 16, xl: 20, "2xl": 24, display: 28, hero: 36,
};

/* Negative tracking, which Inter wants as it gets bigger. Two steps only. */
export const TRACK = { tight: "-0.01em", tighter: "-0.025em" };

export const CATEGORIES = [
  { id: "aso", label: "App Store ASO", color: "#00E08A",
    blurb: "Keyword rankings, listing audits and competitor monitoring inside the Shopify App Store." },
  { id: "data", label: "App Store data", color: "#4CC9F0",
    blurb: "The App Store turned into a queryable dataset rather than a dashboard." },
  { id: "biz", label: "Analytics & billing", color: "#FFB020",
    blurb: "MRR, churn and subscriptions for app businesses. The market Mantle's shutdown opened." },
  { id: "partner", label: "Partner & affiliate", color: "#FF6B8A",
    blurb: "Attributing installs to the agency, affiliate or partner that drove them." },
  { id: "storedb", label: "Store databases", color: "#B08CFF",
    blurb: "Query the merchant universe by platform, apps installed, revenue band and contacts." },
  { id: "detect", label: "Store detectors", color: "#48E5C2",
    blurb: "One store at a time. Paste a URL, see the stack." },
  { id: "suite", label: "Ecosystem suites", color: "#FF9052",
    blurb: "Vendors covering several categories under one roof." },
  { id: "research", label: "Merchant research", color: "#FFD166",
    blurb: "Talking to actual merchants: panels, recruitment, customer discovery." },
  { id: "talent", label: "Talent & services", color: "#7FD1F0",
    blurb: "Freelance Shopify developers and expert marketplaces. Vendors use them both to hire and as affiliate partners." },
  /*
   * Support is deliberately its own category rather than a corner of Talent &
   * services. Both are somebody else's people doing work you could do, which
   * is where the resemblance ends: talent is hired against a brief and
   * finishes, support is a standing team answering your merchants every day
   * and never finishes. The buying decision is different, the failure modes
   * are different, and a vendor looking for one is not shopping for the other.
   */
  { id: "support", label: "Support & CX", color: "#8C9EFF",
    blurb: "Outsourced merchant support teams: your inbox and your helpdesk, somebody else's staff, answering under your name." },
];

export const catOf = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[0];

/*
 * The strict lookup. `catOf` falls back to the first category so a render
 * cannot crash on a bad id, which is right for a render and wrong for a route:
 * /categories/nonsense has to 404 rather than quietly serve App Store ASO.
 */
export const findCat = (id) => CATEGORIES.find((c) => c.id === id) || null;

/* ================================================================== */
/*  More than one category                                             */
/*                                                                     */
/*  `cat` is the primary category and stays a single value, because     */
/*  three things read it as one: the spine colour on a card, the        */
/*  category label under the name, and the "By category" sort. Colour   */
/*  invariant A only survives while a tool has exactly one colour, so   */
/*  the primary is the one source for all three and `alsoIn` never      */
/*  touches any of them.                                               */
/*                                                                     */
/*  `alsoIn` is the optional rest: an array of category ids a tool      */
/*  genuinely also belongs in. A suite covering billing and partner     */
/*  programmes was being filed under one of them and vanishing from     */
/*  the other, which made the category counts wrong in the direction    */
/*  that matters, too low.                                             */
/*                                                                     */
/*  Everything reads these helpers rather than `t.cat` directly, so a   */
/*  filter, a count and a category page cannot disagree about where a   */
/*  tool lives. An unknown id in `alsoIn` is dropped rather than        */
/*  rendered, and the primary is deduped out of it, so a hand edit      */
/*  repeating the primary costs nothing.                               */
/* ================================================================== */

/** Every category a tool is in, primary first, unknown ids dropped. */
export function catsOf(t = {}) {
  const out = [];
  for (const id of [t.cat, ...(Array.isArray(t.alsoIn) ? t.alsoIn : [])]) {
    if (findCat(id) && !out.includes(id)) out.push(id);
  }
  return out;
}

/** The categories beyond the primary. Usually empty, which is the point. */
export const secondaryCats = (t) => catsOf(t).slice(1);

/** Does this tool belong in this category at all, primary or not? */
export const isInCat = (t, id) => catsOf(t).includes(id);

/** Is this category the one that owns the tool's colour and its card? */
export const isPrimaryCat = (t, id) => catsOf(t)[0] === id;

/* ================================================================== */
/*  Entries the editor has a commercial interest in                    */
/*                                                                     */
/*  `editorInterest: true` marks an entry whose subject the person      */
/*  maintaining this directory is paid by, owns, or otherwise stands    */
/*  to gain from. There is no `false`, for the same reason there is no  */
/*  `shopifyExclusive: true`: it is absent from everything else and a   */
/*  badge on every other entry saying "not the editor's" would be       */
/*  noise on 60 cards to carry information on one.                     */
/*                                                                     */
/*  The whole value of this site is that the caveat is written by       */
/*  somebody with nothing to gain. Where that is not true, the only     */
/*  honest move is to say so louder than a reader would think to ask,   */
/*  so the treatment is deliberately heavier than anything else here:   */
/*                                                                     */
/*    - a warn badge on the card and the detail view, which is the      */
/*      second and last exception to colour invariant B                 */
/*    - `watch` states the interest in the first person                 */
/*    - `owner` names the entity and the relationship                   */
/*    - the matcher will not recommend it, on the model path and on     */
/*      the keyword path behind it                                      */
/*    - it cannot be claimed, because the editor already controls it    */
/*    - it is in PROTECTED, so no vendor edit, override or monitor      */
/*      proposal can set it, clear it, or move it onto a competitor     */
/*                                                                     */
/*  The flag lives here rather than in the component that draws the     */
/*  badge for the reason invariant 32 gives: a guard on the door the    */
/*  last bad value came through is not a rule about the field.          */
/* ================================================================== */
export const hasEditorInterest = (t = {}) => t.editorInterest === true;

/* One wording, used by the badge on all three surfaces. */
export const EDITOR_INTEREST = "maintained by the editor";

/*
 * Ownership, and the value that is not one.
 *
 * "AppJubilee is built by AppJubilee" is not information: every product is made
 * by itself. Ownership is only worth stating when it names something the reader
 * did not already have from the name on the card, which means a parent company,
 * a legal entity, a person, or another listed tool.
 *
 * This lived in lib/monitor.js, where it stopped the monitor *proposing* such a
 * value. That was not enough twice over: values applied before the rule existed
 * are already stored, and a rule that only guards the door a bad value came
 * through last time is not a rule about the field. So it lives here, next to
 * the catalogue it describes, and it is used at three points now: the monitor
 * will not propose one, the sweep clears the ones already stored, and `ownerOf`
 * refuses to render one whatever is in the record.
 *
 * `bare` strips the things that make two spellings of one name look different:
 * case, punctuation, a TLD, and the corporate suffixes. "AppJubilee Inc",
 * "The AppJubilee App" and "appjubilee.io" all collapse onto the same string.
 */
const bare = (v) => String(v || "")
  .toLowerCase()
  .replace(/^https?:\/\//, "")
  .replace(/^www\./, "")
  .replace(/\.(com|io|app|co|net|org|ai|dev|tools)\b/g, "")
  /* Legal suffixes and the generic product nouns, so the brand is what is
     left. Deliberately NOT "labs", "studio" or "group": those distinguish a
     real parent, and "Dark Ecommerce Labs" is the answer here rather than the
     noise. */
  .replace(/\b(inc|llc|ltd|limited|gmbh|bv|corp|co|company|the|a|an|app|apps|software|tool|tools|platform|team|hq)\b/g, "")
  .replace(/[^a-z0-9]/g, "");

/**
 * Is this owner value just the brand wearing a hat?
 *
 * Empty counts as vacuous, so callers get one answer to "is there anything
 * worth showing here" rather than having to check twice.
 */
export function isVacuousOwner(value, entry = {}) {
  const v = bare(value);
  if (!v) return true;
  /*
   * Equality after normalising, never a substring match.
   *
   * Substring looked equivalent and cost a real owner: Becketto is built by
   * Beckett Oliphant, and "beckettoliphant" contains "becketto", so the rule
   * both hid a genuine person and, through the sweep, would have deleted them
   * from the record. A product named after its founder is common enough that
   * this was not a corner case.
   *
   * Normalising hard and comparing exactly covers what substring was there
   * for: "AppJubilee Inc", "The AppJubilee App" and "appjubilee.io" all reduce
   * to "appjubilee" on their own.
   */
  return [entry.name, entry.domain, entry.url, entry.id]
    .map(bare)
    .some((o) => o && o === v);
}

/**
 * The owner worth printing, or "". The last line of defence: a bad value
 * written by any route, now or later, still cannot reach a page through this.
 */
export const ownerOf = (t = {}) => (isVacuousOwner(t.owner, t) ? "" : String(t.owner));

/* ================================================================== */
/*  Resource kinds. Tools are the only section with a catalogue        */
/*  behind them; the rest are stubs the roadmap opens for suggestions. */
/*  Colours are reused from CATEGORIES so the palette stays closed.    */
/* ================================================================== */
export const RESOURCE_KINDS = [
  { id: "tool", label: "Tools", color: "#00E08A", live: true,
    blurb: "Software for the people who build Shopify apps, nearly all of it built for nothing else. The section you are looking at." },
  { id: "newsletter", label: "Newsletters", color: "#4CC9F0", live: false,
    blurb: "Written regularly, actually about the app ecosystem, and still publishing." },
  { id: "event", label: "Events & meetups", color: "#FFB020", live: false,
    blurb: "Conferences, Partner meetups and the side events worth the flight." },
  { id: "podcast", label: "Podcasts", color: "#FF6B8A", live: false,
    blurb: "Shows where app founders talk about building and selling on the platform." },
  { id: "youtube", label: "YouTube", color: "#B08CFF", live: false,
    blurb: "Channels covering app development, listing strategy and the Partner business." },
  { id: "book", label: "Books", color: "#48E5C2", live: false,
    blurb: "Long-form worth the hours, whether or not it says Shopify on the cover." },
  { id: "group", label: "Groups & communities", color: "#FF9052", live: false,
    blurb: "WhatsApp, Facebook, Slack and LinkedIn groups where app vendors actually answer each other." },
  { id: "account", label: "Accounts to follow", color: "#00E08A", live: false,
    blurb: "X and LinkedIn accounts posting something other than launch announcements." },
  { id: "influencer", label: "Influencers", color: "#4CC9F0", live: false,
    blurb: "People with an audience of merchants or app vendors, and what they are worth to you." },
];

export const kindOf = (id) => RESOURCE_KINDS.find((k) => k.id === id) || RESOURCE_KINDS[0];

/*
 * What a visitor can report about a listing. Shared by the form and by
 * /api/report so the two cannot drift apart — the route validates against this
 * list, and an unknown id is rejected rather than stored.
 *
 * `needsValue` marks the kinds where the report is worthless without the
 * correction: a broken link is self-describing, a wrong price is not.
 */
export const REPORT_KINDS = [
  { id: "broken", label: "Broken link", needsValue: false,
    hint: "The site or a link on the listing does not load." },
  { id: "url", label: "Wrong URL", needsValue: true,
    hint: "Paste the URL it should point at." },
  { id: "pricing", label: "Wrong pricing", needsValue: true,
    hint: "What does it actually cost now?" },
  { id: "social", label: "Missing social profile", needsValue: true,
    hint: "Paste the profile URL." },
  { id: "other", label: "Something else", needsValue: true,
    hint: "What is wrong?" },
];

export const reportKindOf = (id) => REPORT_KINDS.find((k) => k.id === id) || null;

/* ================================================================== */
/*  Social profiles a listing can carry.                               */
/*                                                                     */
/*  Declared once. The same list used to be written out three times:    */
/*  the render in components/Directory.jsx, the whitelist in            */
/*  sanitiseEdit, and the fields in the vendor edit form. Three copies  */
/*  of one list is how a network ends up editable but never rendered,   */
/*  or rendered but silently dropped on save. Adding one is a line      */
/*  here and an icon in the Social component.                           */
/*                                                                     */
/*  The rule for filling these in has not changed: only a profile the   */
/*  vendor publishes on their own site. Never a plausible guess.        */
/* ================================================================== */
export const SOCIALS = [
  { key: "li", label: "LinkedIn", placeholder: "https://linkedin.com/company/…" },
  { key: "x", label: "X", placeholder: "https://x.com/…" },
  { key: "gh", label: "GitHub", placeholder: "https://github.com/…" },
  { key: "yt", label: "YouTube", placeholder: "https://youtube.com/@…" },
];

export const SOCIAL_KEYS = SOCIALS.map((s) => s.key);

export const socialLabel = (key) =>
  (SOCIALS.find((s) => s.key === key) || {}).label || key;

/* ================================================================== */
/*  Catalogue.                                                         */
/*  social: only profiles published on the vendor's own site.          */
/*                                                                     */
/*  shopifyExclusive: optional, and only ever written as `false`.       */
/*  Absent means what it has always meant: this tool exists for the     */
/*  Shopify ecosystem and nothing else, which is true of nearly         */
/*  everything here. `false` marks a general tool listed because an     */
/*  app vendor genuinely reaches for it, and renders a neutral          */
/*  "not Shopify-only" badge so nobody has to find that out on the      */
/*  pricing page. There is no `true`: a badge on every entry but a      */
/*  handful would carry no information, which is the same reason the    */
/*  newsletter tag runs the other way round.                           */
/*                                                                     */
/*  It is a label, not a gate. What gets listed is still judged on      */
/*  whether an app vendor has a real use for it, and a general tool     */
/*  has to clear a higher bar to be worth the row.                      */
/*                                                                     */
/*  logo: optional path to a real mark under /public/logos/, e.g.      */
/*    logo: "/logos/welookup.jpeg". Favicons are 128px at best, so a   */
/*  mark the vendor publishes is better wherever we have one. Absent,  */
/*  the Logo component falls back to the favicon service and then to   */
/*  the coloured lettermark, so leaving it out is always safe.         */
/*                                                                     */
/*  pricingUrl, changelogUrl: optional. Where the weekly monitor looks   */
/*  besides the homepage. Most vendors keep pricing on /pricing, which   */
/*  the monitor does NOT guess at: a wrong guess produces a dead-page    */
/*  alert every week. Set these where the page exists and is worth       */
/*  watching, leave them out otherwise. See lib/monitor.js.              */
/*                                                                      */
/*  ratings: optional external scores, entered BY HAND from the public  */
/*  listing page — never scraped, and never any review text. Shape:     */
/*    ratings: [{ source: "G2", score: 4.8, outOf: 5, count: 120,       */
/*                url: "https://www.g2.com/products/...",               */
/*                captured: "2026-09-15" }]                             */
/*  captured is required so a stale figure reads as stale. These are    */
/*  reference only and are never averaged into the community rating.    */
/* ================================================================== */
/*
 *  draft: optional. An entry with `draft: true` is written but not published:
 *  it is in ALL_TOOLS, it shows in /admin, and it is absent from TOOLS and so
 *  from everything a visitor can reach. Publishing is deleting the flag.
 *  See lib/drafts.js.
 */
export const ALL_TOOLS = [
  /* ---- App Store ASO ---- */
  {
    id: "appjubilee", name: "AppJubilee", cat: "aso", domain: "appjubilee.io",
    url: "https://www.appjubilee.io", price: "From $49/mo", free: false, verified: false,
    pricingUrl: "https://www.appjubilee.io/pricing",
    owner: "Dark Ecommerce Labs, LLC",
    linked: "StoreCensus",
    updated: "2026-09-11",
    tags: ["keyword", "ranking", "aso", "competitor", "multi-app", "agency", "listing", "portfolio"],
    one: "Multi-app ASO with automatic keyword discovery.",
    note: "Tracks roughly 1,200 App Store keywords automatically with no list to build, maps the competitor universe, and correlates listing changes with ranking movement. Up to 30 apps on the agency tier, which makes it the obvious pick for anyone running a portfolio rather than a single app.",
    watch: "Same company as StoreCensus, so their comparison pages against rivals are one vendor's marketing, not two independent sources.",
    social: {},
  },
  {
    id: "appstorepulse", name: "AppstorePulse", cat: "aso", domain: "appstorepulse.com",
    url: "https://www.appstorepulse.com", price: "Free tier, then paid", free: true, verified: true,
    owner: "the maker of Wide Bundles",
    updated: "2026-09-11",
    tags: ["keyword", "ranking", "competitor", "mrr", "churn", "revenue", "alerts", "listing", "reviews", "funnel"],
    one: "Rankings, competitor alerts and real MRR in one place.",
    note: "Keyword difficulty and volume, daily competitor change detection on pricing and listings, an AI listing audit benchmarked against the top 10 in your category, and the listing view-to-install funnel. Connect a Partner account and it adds live MRR, ARR, churn, trials and a per-store customer view. Says 600+ app teams use it.",
    watch: "Built by the maker of Wide Bundles, a bundle app in the Upsell and bundles category. Useful context if you compete there, since you would be handing your keyword strategy to someone with a horse in the race. Free tier is one app, three keywords, one competitor, and search volume is a relative tier estimate rather than real numbers.",
    social: {},
  },
  {
    id: "tracksami", name: "SAMI", cat: "aso", domain: "tracksami.com",
    url: "https://www.tracksami.com", price: "Not published", free: false, verified: true,
    updated: "2026-09-11",
    tags: ["keyword", "ranking", "compare", "category", "competitor", "listing", "movers", "built for shopify"],
    one: "Look up an app and see the keywords it already ranks for.",
    note: "The distinguishing idea: no keyword list to build. Rankings are captured automatically against a curated 27,000+ keyword database, so you start from what an app ranks for rather than from guesses. Compare up to 40 apps side by side on shared keywords and categories. Category pulse shows daily gainers and losers, new and removed apps, and shifts in pricing mix, Built for Shopify share and rating distribution.",
    watch: "Pricing is not on the marketing site, so budget it as an unknown until you talk to them.",
    social: {},
  },
  {
    id: "bestappify", name: "BestAppify", cat: "aso", domain: "bestappify.com",
    url: "https://bestappify.com", price: "Free plan available", free: true, verified: true,
    updated: "2026-09-11",
    tags: ["keyword", "ranking", "competitor", "reviews", "mcp", "ai", "affiliate", "influencer", "listing", "alerts"],
    one: "ASO plus a marketing layer, exposed as an MCP server.",
    note: "10,800+ apps tracked with daily competitor checks. Beyond rankings it bundles an affiliate program, influencer marketing and merchant research interviews. Runs both sides of the market: a merchant-facing app directory and a developer-facing growth platform sharing one dataset.",
    watch: "Revenue analytics are reconstructed from subscription charge events. Their own docs note a null ranking means not captured that day, not unranked.",
    social: { x: "https://x.com/BestAppify" },
  },
  {
    id: "letsmetrix", name: "LetsMetrix", cat: "aso", domain: "letsmetrix.com",
    url: "https://letsmetrix.com", price: "Free", free: true, verified: true,
    owner: "OmegaTheme",
    updated: "2026-09-11",
    tags: ["directory", "category", "ranking", "reviews", "free", "detector", "market size", "collections"],
    one: "Category rankings and collections, free on both sides.",
    note: "19,565 apps scored daily across 7 categories and 33 subcategories, plus 179 official Shopify collections tracked. Best at one thing in particular: sizing the pool you actually compete in. Free theme and app detector tools on top. Built by a team with 11 years making Shopify apps.",
    watch: "Owned by OmegaTheme, who run a large portfolio of Shopify apps, so the same conflict applies as anywhere a tracker is built by an app vendor. Developer analytics sit behind a login and the depth is unproven.",
    social: { x: "https://x.com/letsmetrix", li: "https://www.linkedin.com/company/letsmetrix/" },
  },
  {
    id: "appnavigator", name: "AppNavigator", cat: "aso", domain: "appnavigator.io",
    url: "https://appnavigator.io", price: "Free", free: true, verified: true,
    updated: "2026-09-11",
    tags: ["directory", "ranking history", "reviews", "free", "new apps", "movers", "no signup"],
    one: "Public index with ranking history, no account needed.",
    note: "26,416 apps updated daily. Ranking history, review analysis, new launches and weekly top movers, most of it open without signing up. Built by Ablestar. The lightest way to check a competitor without paying for anything.",
    watch: "Read-only. No alerts and no tracking of your own listing.",
    social: {},
  },
  {
    id: "sasi", name: "SASI", cat: "aso", domain: "heymantle.com",
    url: "https://sasi.heymantle.com", price: "Free", free: true, verified: true, dying: true,
    updated: "2026-09-11",
    tags: ["ranking history", "keyword", "alerts", "free", "index"],
    one: "Mantle's App Store index. Going down with Mantle.",
    note: "Historical listing data, app and keyword following, change notifications. Mantle acquired it from Union Works, alongside the separate App Store Analytics, and the two are often quoted as one product. Still reachable but tied to a platform that is winding down.",
    watch: "Do not build a process on it. Move anything you depend on to AppNavigator, Applora or a paid tracker.",
    social: {},
  },

  {
    id: "ranksy", name: "Ranksy", cat: "aso", domain: "ranksyapp.com",
    url: "https://ranksyapp.com", price: "$39 / $89 per month", free: false, verified: true,
    updated: "2026-09-18",
    tags: ["keyword", "ranking", "attribution", "revenue", "mrr", "crm", "bigquery", "partner api", "chrome extension", "segments"],
    one: "Follows a keyword through to the customer who paid.",
    note: "Rankings, installs, revenue and a customer list in one view, for the 27,000+ apps in the store. The idea it is built around is attribution: it joins BigQuery listing traffic to Shopify Partner API revenue, so a keyword resolves to the paying customer it produced, with organic and paid positions counted separately. The Partner side adds MRR over time and pre-built segments for VIP, at-risk, growth and new customers. Starter is $39 a month for 3 apps, Studio $89 for a team, with attribution on both rather than held back for the higher tier. Seven-day trial, no card. A free Chrome extension overlays rankings, review trends and keyword data on any App Store listing, and the homepage app lookup is free too.",
    watch: "There is no free plan and the pricing page says there will not be one, so past the trial the Chrome extension is the whole free surface. Attribution is only as good as what you connect: BigQuery and a Partner API key are both required, which means listing traffic you have not been exporting is not backfilled and the first useful report is some weeks out. Nobody is named anywhere on the site, no company, no founder and no social profile, which for a tool you are handing Partner API revenue data to is worth asking about before you connect it.",
    social: {},
  },
  {
    id: "rankbase", name: "Rankbase", cat: "aso", domain: "rankbase.io",
    url: "https://rankbase.io", price: "$49 / $99 per month", free: false, verified: true,
    owner: "Craftshift",
    updated: "2026-09-18",
    tags: ["keyword", "ranking", "aso", "listing", "changelog", "forum", "ga4", "slack", "api", "potential score"],
    one: "Daily keyword positions, and where the installs behind them came from.",
    note: "Built for developers who already have an app listed and want more out of the listing they have. Daily positions with up to 365 days of history, install clicks split by organic search and paid ads, and a Potential Score that points at the keywords where a small move is worth the most. Around that: a changelog of listing edits, community forum monitoring with notifications, Slack and email alerts, a REST API and CSV export, multiple apps and multiple languages. Growth is $49 a month for 5 apps, Business $99 for 20. It needs a Google Analytics 4 connection and existing traffic, and it does not work outside the Shopify App Store.",
    watch: "Craftshift publishes Shopify apps of its own, Bulk Product Image Upload and Export, Variant Images and Swatches, and Combined Listings, and Rankbase started as the internal tracker for them. That is a fair origin story and it is also a conflict if you compete in product images or variants, because your keyword strategy would be visible to somebody selling into the same listings. The site's evidence is testimonials rather than numbers, and the one it leads with, an app going from 13th to 1st, is a single keyword on a single app. It is a rank tracker with an attribution layer, not a revenue tool: nothing here reads your Partner billing.",
    social: { li: "https://www.linkedin.com/in/faridmovsumov/", x: "https://x.com/rankbase_io" },
  },

  {
    id: "becketto", name: "Becketto Rank Tracker", cat: "aso", domain: "becketto.com",
    url: "https://becketto.com/rank-tracker", price: "Free", free: true, verified: true,
    owner: "Beckett Oliphant",
    linked: "Affilitrak for Apps",
    updated: "2026-09-18",
    tags: ["keyword", "ranking", "history", "free", "locale", "snapshots", "solo"],
    one: "Free keyword rank history for the App Store, no account needed to look.",
    note: "A single-purpose tool: search a keyword, pick a date range, and compare ranking snapshots side by side, with a locale selector. Built by Beckett Oliphant, a solo Shopify app developer, and published on his personal site alongside a development blog. Free, with no pricing page and no paid tier anywhere on it. Looking at stored history needs nothing; an email address is only asked for to refresh results immediately rather than wait for the next scheduled capture.",
    watch: "The same person publishes Affilitrak, an affiliate marketing app for merchants on the Shopify App Store. Tracking affiliate or referral keywords here means handing your keyword strategy to somebody competing in that exact category, which is the same conflict AppstorePulse carries. It is one person's side project on a personal domain, with no company behind it, no stated retention or refresh schedule and no commitment to keep running, so it is a thing to check a hunch with rather than a thing to build a process on. How far the history goes back is not published and could not be established without an account.",
    social: {},
  },
  {
    id: "appstoreanalytics", name: "App Store Analytics", cat: "aso", domain: "heymantle.com",
    url: "https://heymantle.com", price: "Was bundled into Mantle", free: false, verified: false,
    linked: "SASI",
    dying: true,
    draft: true,
    updated: "2026-09-18",
    tags: ["listing", "conversion", "experiments", "acquired", "mantle", "union works", "winding down"],
    one: "Listing-change impact analysis, absorbed into Mantle and going down with it.",
    note: "Distinct from SASI, though the two are constantly confused and were sold together. Mantle acquired both from Union Works, where App Store Analytics was founded by Daniel Sim. The split, in Mantle's own words: App Store Analytics measured how changes to a listing affected user interactions and conversions, while SASI tracked ranking position across categories and keywords. One is about whether an edit worked, the other about where you sit.",
    watch: "There is no product here to look at any more. It has no site of its own: appstoreanalytics.com and asa.heymantle.com both fail to resolve, and the only page describing it is Mantle's own acquisition announcement. Mantle announced a full wind-down of every product, dashboard, API and tracking tool in June 2026, so this is listed as a name you will meet in comparison pages and old blog posts rather than as something you can buy. Everything here is sourced from Mantle's announcement rather than from the product.",
    social: {},
  },

  /* ---- Data ---- */
  {
    id: "applora", name: "Applora", cat: "data", domain: "applora.ai",
    url: "https://applora.ai", price: "Free, Pro $49/mo", free: true, verified: true,
    updated: "2026-09-11",
    tags: ["mcp", "ai", "agent", "dataset", "api", "keyword", "reviews", "stores", "export", "free", "research"],
    one: "The whole App Store as a live database, free on the web and over MCP.",
    note: "28.2K apps tracked with 27.8K currently listed and 365 delisted, 1.1M reviews indexed, 605K stores identified, 600+ keywords refreshed daily. Everything searchable free without signup. The real differentiator is 15 live tools over remote MCP plus published agent skills, so an AI agent can run a market question across rankings, reviews, keywords and stores in one pass. Pro adds 365 days of history, CSV export and 5,000 MCP calls.",
    watch: "Store records come from public App Store reviews, so a store only appears if it has publicly reviewed an app. Not install data, and they say so plainly.",
    social: { x: "https://twitter.com/applora_ai", gh: "https://github.com/applora" },
  },

  /* ---- Analytics & billing ---- */
  {
    id: "elevate", name: "Elevate", cat: "biz", domain: "marmeto.com",
    url: "https://marmeto.com/elevate",
    price: "Free for Marmeto partners", free: true, verified: true, suite: "Marmeto",
    updated: "2026-09-11",
    tags: ["mrr", "arr", "churn", "retention", "ltv", "analytics", "mantle", "installs", "partner api"],
    one: "MRR, ARR, churn and retention for Shopify app companies.",
    note: "Positioned openly as the Mantle analytics replacement, and the copy credits Mantle by name. Revenue churn and customer churn tracked separately, customer health and LTV, install-source analytics, growth trends, direct Shopify Partner account integration. Now covers affiliate attribution alongside analytics.",
    watch: "Free access is gated on being an approved Marmeto partner, which is the real product.",
    social: {},
  },
  {
    id: "mantle", name: "Mantle", cat: "biz", domain: "heymantle.com",
    url: "https://heymantle.com", price: "Winding down", free: false, verified: true, dying: true,
    updated: "2026-09-11",
    tags: ["billing", "mrr", "churn", "email", "affiliate", "help desk", "flows", "shutdown"],
    one: "Billing, analytics, email, affiliates, flows, help desk. Shutting down.",
    note: "Announced June 2026. Most services stopped 14 August 2026; Mantle Billing runs until 30 September 2026. Mantle wrapped Shopify's Billing API, so the subscriptions themselves live on Shopify. Backed by Shopify, with a team involved in starting the App Store. It did not lose to a competitor. The platform absorbed it when Shopify shipped native App Pricing in May.",
    watch: "Listed for orientation only. If you still bill through it, this is an engineering deadline. Flex Billing has no native equivalent.",
    social: {},
  },

  {
    id: "fusionmetrics", name: "Fusionmetrics", cat: "biz", domain: "fusionmetrics.com",
    url: "https://fusionmetrics.com", price: "Free under $5k MRR, then $25 / $99", free: true, verified: true,
    updated: "2026-09-18",
    tags: ["mrr", "churn", "ltv", "arpu", "attribution", "ga4", "partner api", "self-hosted", "mantle", "merchant lookup"],
    one: "GA4 joined to Partner billing, so an ad click can be followed to the revenue.",
    note: "Puts Google Analytics 4 next to Shopify Partner data and tracks the whole path, ad click to App Store visit to install to the revenue after it. MRR, churn, LTV and ARPU on a revenue dashboard, a merchant lookup for the store behind a subscription, and acquisition attribution, all three on every tier. Pricing follows your size rather than a feature list: free under $5k MRR, $25 a month above that, $99 above $10k, custom above $1M ARR, and a $999 one-time self-hosted licence for anyone who would rather keep the data. Founder-led by Alexander Hupfer, who does the setup himself.",
    watch: "One person, and the site says so plainly, which is honest and is also the risk: this is billing and revenue reporting from a single maintainer with no published team, no customer count and nothing on the site about what happens to your Partner data. The self-hosted licence is the answer to that if you want one. Revenue banded pricing also means the bill moves when the business does, which is fair while you are small and worth modelling before you are not.",
    social: {},
  },

  {
    id: "saasinsights", name: "SaaS Insights", cat: "biz", domain: "saasinsights.com",
    url: "https://saasinsights.com", price: "Free under $2.5k/mo, then $49/mo or $490/yr", free: true, verified: true,
    pricingUrl: "https://saasinsights.com/pricing",
    updated: "2026-09-18",
    tags: ["mrr", "arr", "arpu", "churn", "trials", "keyword", "ranking", "competitors", "forecasting", "slack", "mantle", "migration"],
    one: "Partner API revenue and App Store rankings on one dashboard.",
    note: "Revenue and listing data for Shopify app teams in one place: MRR, ARR, ARPU, churn and trial conversion from the Partner API, alongside App Store keyword rankings and competitor tracking. Adds custom reports, forecasting and Slack or email notifications. Free until an app earns $2.5k a month, then $49 a month or $490 a year with unlimited apps on every tier and a 14-day trial. Currently running a Mantle migration funnel: a dedicated \"Migrate from Mantle\" page and a 30% discount code for three months.",
    watch: "Nobody is named anywhere on it. The about page is several paragraphs of \"we\" with no company, no founder and no location, and the only social profile published is an X account. That is a lot of anonymity for a tool you connect a Partner API key to, and it is the one thing worth asking about before you do. The free tier is generous but it is a revenue threshold rather than a feature limit, so the bill arrives exactly when the app starts working. Positioned hard at Mantle refugees at the moment, which tells you the pricing is competitive today and says nothing about where it settles.",
    social: { x: "https://twitter.com/SaaS_insights" },
  },

  /* ---- Partner & affiliate ---- */
  {
    id: "affilitrak", name: "Affilitrak for Apps", cat: "partner", domain: "affilitrak.com",
    url: "https://affilitrak.com/for-apps", price: "Free, 20% on marketplace affiliates", free: true, verified: true,
    owner: "Beckett Oliphant",
    linked: "Becketto Rank Tracker",
    updated: "2026-09-18",
    tags: ["affiliate", "referral", "commission", "payout", "attribution", "mantle", "migration", "marketplace"],
    one: "Affiliate tracking for apps, built to take a Mantle program as it stands.",
    note: "Tracks installs and recurring revenue, runs commission rules and pays affiliates through PayPal. The migration is the pitch: it imports affiliates, referral codes, referral history and payout history out of Mantle, keeps every existing apps.shopify.com link working in the same mref format so no affiliate has to re-share anything, and runs alongside Mantle until that shuts down. Attribution is the Partner API for installs and revenue plus GA4 and BigQuery, which is how Mantle did it. Free at $0 a month for unlimited apps with no caps, and the money is a 20% cut of what you pay affiliates that the Affilitrak marketplace introduced you to.",
    watch: "The pitch is \"same tracking as Mantle\" and \"built on Mantle's tracking infrastructure\", which is Affilitrak's claim about itself and not one Mantle makes. Mantle's own wind-down page lists it beside Shoffi, PartnerDock and Orbit as one of four places to go, with no partnership, no data handover and no preference stated, so ask what that infrastructure claim actually means before you hand it your attribution. The brand also covers two products and the numbers belong to the other one: affilitrak.com leads with 1,000 stores, 10,000 referrals tracked and a 5.0 from 200 ratings, all of which are the merchant affiliate app on the Shopify App Store, and nothing on the app vendor page says how many vendors run a program here. Free is not settled pricing either. The 20% on marketplace affiliates is announced but not charging yet, and that marketplace is the only thing that earns, so an introduction from it is a sale rather than a recommendation. No company or person is named anywhere on the site; the link to Beckett Oliphant is from his own launch announcement rather than from the site.",
    social: {},
  },
  {
    id: "partnerdock", name: "PartnerDock", cat: "partner", domain: "getpartnerdock.com",
    url: "https://getpartnerdock.com", price: "Free, then $19 / $49 / $99", free: true, verified: true,
    updated: "2026-09-11",
    tags: ["affiliate", "referral", "commission", "payout", "attribution", "mantle", "migration", "cheap"],
    one: "Affiliate tracking priced on software, not on your success.",
    note: "No revenue caps, 0% commission on payouts, unlimited affiliates on every plan. Click-to-install matching via the Shopify Partner API and GA4, branded signup page, PayPal mass-payout CSV export. Offers a hands-on migration call rather than a self-serve importer.",
    watch: "Very new, and the site is built as a Mantle migration funnel. Ask how many live programs they actually run before trusting it with attribution.",
    social: { x: "https://x.com/thesaashub" },
  },
  {
    id: "shoffi", name: "Shoffi", cat: "partner", domain: "shoffi.app",
    url: "https://shoffi.app", price: "Free until $100/mo referred", free: true, verified: true,
    updated: "2026-09-11",
    tags: ["affiliate", "referral", "marketplace", "commission", "attribution", "network", "agency"],
    one: "The largest affiliate network aimed at Shopify apps.",
    note: "Claims 18,000 affiliates, 60,000 referrals and $25M referred revenue since 2021. Tracking through the Shopify Partner API and GA4, no code. Marketplace where affiliates browse programs, branded signup pages, payment tracking.",
    watch: "One developer publicly reported 16 affiliates and 3 attributed clicks over several months on the marketplace, and Shoffi's own rep conceded it is a tool rather than a growth guarantee. Judge the tracking, discount the marketplace.",
    social: { x: "https://twitter.com/ShoffiHQ", li: "https://www.linkedin.com/company/shoffi-shopify-apps-affiliate-platform/" },
  },
  {
    id: "partnerjam", name: "PartnerJam", cat: "partner", domain: "partnerjam.com",
    url: "https://www.partnerjam.com", price: "Free", free: true, verified: false,
    updated: "2026-09-11",
    tags: ["affiliate", "referral", "free", "attribution", "cookie-independent", "partner api"],
    one: "Free, cookie-independent, direct Partner API integration.",
    note: "Built by Digismoothie, who make Candy Rack, after failing to find a platform they liked. They became their own first customer. Cookie independence matters here because install attribution through the App Store breaks normal cookie chains.",
    watch: "Free products from app vendors can quietly go unmaintained. Check the changelog before committing a program to it.",
    social: { li: "https://www.linkedin.com/company/partnerjam/" },
  },
  {
    id: "orbit", name: "Orbit", cat: "partner", domain: "marmeto.com",
    url: "https://marmeto.com/orbit",
    price: "Free for Marmeto partners", free: true, verified: true, suite: "Marmeto",
    updated: "2026-09-11",
    tags: ["partner", "prm", "onboarding", "commission", "leads", "white-label", "portal", "agency"],
    one: "Partner onboarding, leads, commissions and white-label portals.",
    note: "Closer to a PRM than a pure affiliate tracker: onboard partners, receive leads from them, pay commissions. White-label partner portals carrying your branding. Marmeto claims 3x faster partner onboarding.",
    watch: "Marmeto publishes a comparison putting Orbit against every rival and unsurprisingly recommends Orbit. Useful as a feature map, not as a verdict.",
    social: {},
  },
  {
    id: "krutva", name: "Krutva", cat: "partner", domain: "krutva.com",
    url: "https://www.krutva.com", price: "Not published", free: false, verified: false,
    updated: "2026-09-11",
    tags: ["prm", "partner", "relationship", "commission", "channel"],
    one: "Partner relationship management, surfaced in community threads.",
    note: "Raised by developers as a PRM option alongside the affiliate trackers when the Mantle replacement question came up. Sits at the heavier end: relationship and channel management rather than link tracking.",
    watch: "The thinnest evidence base in this directory. Confirm it is still trading and actually serves Shopify app vendors before spending time on it.",
    social: { li: "https://www.linkedin.com/company/krutva/" },
  },

  {
    id: "partnerstack", name: "PartnerStack", cat: "partner", domain: "partnerstack.com",
    url: "https://partnerstack.com", price: "Not published", free: false, verified: true,
    shopifyExclusive: false,
    owner: "AppDirect",
    updated: "2026-09-18",
    tags: ["prm", "partner", "affiliate", "referral", "co-sell", "influencer", "commission", "payout", "network", "b2b saas"],
    one: "A full B2B partner program platform, not built for Shopify but used from it.",
    note: "Recruitment, onboarding, tracking and payouts for affiliate, referral, co-sell and influencer programs, plus a marketplace it says carries 131,000+ active partners you can recruit from rather than starting cold. Full-funnel reporting, automated commission payouts across partner types, and lead submission from email and Slack. Published network figures are $4M+ in sales a day, 33,000+ referred customers a day and $606K+ a day paid out in commissions, across 600+ enterprise customers, with onboarding quoted at 30 to 45 days. Owned by AppDirect.",
    watch: "Nothing here knows what a Shopify app is. There is no Partner API connection, no install attribution and no App Store anything, so a Shopify vendor is wiring it up by hand and paying enterprise prices for a platform whose cheap, native equivalents are two rows up in this category. Pricing is not published at all: it is set per program during a demo, which means you cannot compare it against PartnerDock or Shoffi without booking a sales call first. The 30 to 45 day onboarding is their own number and tells you what shape of company this is sold to. It earns the row because an app vendor selling to agencies and enterprise partners at scale does eventually outgrow a link tracker, and it is the platform they end up looking at.",
    social: {},
  },

  /* ---- Store databases ---- */
  {
    id: "storeleads", name: "Store Leads", cat: "storedb", domain: "storeleads.app",
    url: "https://storeleads.app", price: "$75 / $250 / $450 / $950 per month", free: false, verified: true,
    updated: "2026-09-11",
    tags: ["leads", "prospecting", "database", "hubspot", "crm", "enrichment", "install history", "displacement", "api", "export"],
    one: "13.7M stores, app install and uninstall history, HubSpot native.",
    note: "3,027,144 Shopify stores of 13,727,714 total across 409 platforms, 8,127 apps tracked, weekly updates, 60 search filters. The attribute that matters is not in the headline: date of app install plus a historic changelog of installs and uninstalls, and estimated monthly app spend. Their own docs suggest correlating churn with a competitor's app install. Run by Lochside Software in Victoria, BC.",
    ratings: [
      { source: "G2", score: 4.9, outOf: 5, count: 22, url: "https://www.g2.com/products/store-leads/reviews", captured: "2026-09-15" },
    ],
    watch: "Cuts both ways. The same changelog makes your own install and uninstall curve visible to any competitor on a $250 plan.",
    social: { li: "https://www.linkedin.com/company/storeleads/" },
  },
  {
    id: "storecensus", name: "StoreCensus", cat: "storedb", domain: "storecensus.com",
    url: "https://www.storecensus.com", price: "Free plan, then $49 / $99", free: true, verified: false,
    linked: "AppJubilee",
    updated: "2026-09-11",
    tags: ["leads", "prospecting", "database", "contacts", "apollo", "export", "cheap", "free", "displacement", "outreach"],
    one: "Cheaper store database with decision-maker contacts built in.",
    note: "4M+ Shopify and WooCommerce stores filtered by platform, category, revenue band, country and installed apps, with 8,500+ app install detection. Ships founder and CMO contacts natively, SMTP-verified, and pushes to Apollo, Instantly and SmartLead. Has a dedicated flow for app developers: pick a competitor app, export the stores running it, send outreach.",
    watch: "Same company as AppJubilee. Its whole position is 'cheaper than Store Leads' and narrower coverage is the trade. Test the free plan against a segment you know cold.",
    social: {},
  },

  {
    id: "storeinspect", name: "StoreInspect", cat: "storedb", domain: "storeinspect.com",
    url: "https://storeinspect.com", price: "Free tier, then $49 / $149 / $349", free: true, verified: true,
    updated: "2026-09-18",
    tags: ["store database", "leads", "contacts", "apps installed", "themes", "pixels", "traffic", "shopify plus", "export", "api", "chrome extension"],
    one: "1.4M Shopify stores, filtered by the apps they already run.",
    note: "A searchable database of 1,400,000+ Shopify stores and 1,440,000+ contacts, filterable by apps installed, theme, pixels, category, country, traffic and Shopify Plus status. For an app vendor that is a prospect list shaped by a competitor's install base. Free gives 10 contact reveals a month, 50 results per search and one saved list of 25 stores, with no export and no API. Pro is $49 a month, or $468 a year, for 1,000 reveals, 10,000 store exports, CSV and API. Business is $149 for 3,000 reveals and 100,000 exports with unlimited results. Enterprise is $349 for 10,000 reveals and 500,000 exports. A company email may qualify for a 7-day Pro trial with 100 reveals. Detection runs a headless Puppeteer browser over each storefront and the site says the sources are public only: storefront files, the Meta Ad Library, search trends and published contact details.",
    watch: "Nobody is named. No company, no founder, no location, and a support address is the whole contact page, which is a lot of trust to extend to a vendor selling you 1.4 million merchants' contact details. Treat the contact side as a compliance question of your own: the site says the data is public, which is not the same as saying an outreach campaign built on it is lawful where you or the merchant are. The store counts are self-reported and the refresh cadence is described as regular without a number, so how current any single record is cannot be checked from outside.",
    social: { li: "https://www.linkedin.com/company/110146091", x: "https://x.com/StoreInspect" },
  },

  {
    id: "builtwith", name: "BuiltWith", cat: "storedb", domain: "builtwith.com",
    url: "https://builtwith.com", price: "Free lookups, then $295 / $495 / $995 a month", free: true, verified: true,
    shopifyExclusive: false,
    owner: "Andrew Rogers and Gary Brewer",
    pricingUrl: "https://builtwith.com/plans",
    updated: "2026-09-18",
    tags: ["technology lookup", "tech stack", "leads", "prospecting", "migration", "woocommerce", "bigcommerce", "historical", "api", "general"],
    one: "Technology lookup for any site on the web, Shopify or not.",
    note: "A technology index rather than a Shopify database: 127,605 internet technologies tracked, 20 years of adoption history, 26M ecommerce sites and 6,672,791 live Shopify sites by its own count, along with Shopify Plus at 115,773 and Shopify B2B at 33,291. What it gives an app vendor that Store Leads and StoreCensus cannot is coverage outside Shopify. It finds merchants running WooCommerce, BigCommerce, Magento or Salesforce Commerce, which is the migration conversation and the one segment a Shopify-only database structurally cannot show you, and it reads a prospect's whole stack, the ESP, the analytics, the payment processor, the CDN and the ad pixels, rather than only what is installed on the store. The free account does single-site lookups forever with no expiry, which covers checking one prospect before a call; lists, exports and the API need a plan. BuiltWith Pty Ltd in Sydney, independent of everything else in this directory.",
    watch: "Its Shopify resolution stops a level above where an app vendor works. Its own Shopify page breaks the platform into products and more than 40 themes and lists no individual app detection anywhere, so the question this category exists for, which stores run my competitor, is one Store Leads answers with 8,127 tracked apps and install dates and this does not appear to answer at all. Price is the other half. $295 a month is the floor, against $75 for Store Leads and $49 for StoreInspect Pro, and that tier buys 2 technologies, 2 keywords and 2 reports; unlimited anything starts at $495 and a second seat at $995. There is no free trial either, only the perpetual single-site lookup, so there is no way to test a segment at volume before paying. Buy it for the merchants who are not on Shopify yet. Everything it does inside Shopify is cheaper and deeper two rows up.",
    social: {
      li: "https://www.linkedin.com/company/builtwith",
      x: "https://x.com/builtwith",
      gh: "https://github.com/builtwith",
    },
  },

  {
    id: "cartinsight", name: "CartInsight", cat: "storedb", domain: "cartinsight.io",
    url: "https://www.cartinsight.io", price: "$0.083 a lead, on download tiers from 250 to 10,000 a month. Free account to start", free: true, verified: true,
    owner: "Ready Innovations Inc.",
    pricingUrl: "https://www.cartinsight.io/cartinsight-pricing/",
    updated: "2026-09-19",
    tags: ["leads", "prospecting", "database", "contacts", "crm", "hubspot", "salesforce", "pipedrive", "export", "marketplaces", "woocommerce", "bigcommerce"],
    one: "Store database priced by the lead rather than by the seat.",
    note: "524,047 stores by its own count on 23 August 2026: 392,849 Shopify, 74,191 WooCommerce, 23,106 BigCommerce, 19,834 Magento, plus Amazon, Etsy, eBay and Walmart sellers and fifteen or so smaller carts. Ships 75,000+ human-researched contacts, payment and shipping provider detection, traffic ranking, store category and offline-store tagging, and pushes to HubSpot, Salesforce, Pipedrive, Copper, Insightly and Capsule, with a Chrome extension and a Gmail extension. The pricing shape is the unusual part. You buy downloads rather than seats, from 250 to 10,000 a month at a stated $0.083 a lead, and a free account reaches the whole database before you pay anything.",
    watch: "The number an app vendor buys this category for is the one it does not visibly answer. Its plugin directory catalogues 9,781 Shopify apps, but that is a list of apps; nothing on the public site demonstrates the reverse lookup, which stores run a given app, that Store Leads sells at 8,127 tracked apps with install dates. Check that on the free account before anything else. Contacts also run a long way behind stores, 75,000 against 524,047, so most rows arrive with no person attached. Ownership is stated two ways on its own pages, as a business of Ready Innovations Inc. and as a product of Ready, a business of Better Industries Inc, at a shared Dover, Delaware mailing address, and the Team link in its own footer is dead.",
    social: { x: "https://x.com/CartInsight_io", li: "https://www.linkedin.com/company/cartinsight/" },
  },
  {
    id: "etailinsights", name: "etailinsights", cat: "storedb", domain: "etailinsights.com",
    url: "https://www.etailinsights.com", price: "Not published. Quoted on an order form, with 3% added to card payments", free: false, verified: true,
    shopifyExclusive: false,
    updated: "2026-09-19",
    tags: ["leads", "prospecting", "database", "contacts", "retailers", "technographics", "crm", "general", "enterprise"],
    one: "Retailer contact database, sold through a demo rather than a signup.",
    note: "500,000+ online retailers, 750+ technologies tracked and 190,000+ verified contacts by its own count, with more than 1,000 customers claimed and CRM integration. It is a retail intelligence database rather than a Shopify one: what it watches is the commerce stack, the platform, the email service provider, the payment processor, and it is sold to anyone selling into ecommerce brands rather than to this ecosystem in particular. Etailinsights, Inc., a North Carolina corporation, in Cary.",
    watch: "Nothing about the price is published. There is no pricing page, both calls to action are a demo request or a trial signup, and the terms put the figure on an order form and add 3% to card payments, which is the shape of an annual contract rather than a card and a login. Coverage is the bigger question. 750 technologies is platform and stack level, and nothing on the public site shows detection of individual Shopify apps, so the thing this category exists for, which stores run my competitor, is not demonstrably answerable here. Worth the row only as a contact database for retail brands, some of which happen to be on Shopify.",
    social: {
      li: "https://www.linkedin.com/company/etailinsights/",
      x: "https://x.com/etailinsights",
      yt: "https://www.youtube.com/channel/UCTuTUIEbqkT_c2kRaIYuWGA",
    },
  },

  /* ---- Detectors ---- */
  {
    id: "shopscan", name: "ShopScan", cat: "detect", domain: "shopscan.app",
    url: "https://www.shopscan.app", price: "Free, API paid", free: true, verified: true,
    updated: "2026-09-11",
    tags: ["detector", "theme", "apps", "free", "extension", "chrome", "scraper", "revenue estimate"],
    one: "App and theme detector with a wide free tool set.",
    note: "Claims data on 2,000+ apps. Beyond detection: revenue checker, traffic checker, store analyzer, product scraper, fees calculator. Chrome, Firefox and Edge extensions. Named first in the community thread on detecting which apps a store runs.",
    watch: "Monetised through affiliate links and a Shopify referral offer, so the surrounding recommendations are not neutral.",
    social: { x: "https://x.com/shopscan_app", li: "https://www.linkedin.com/company/shopscan-app/" },
  },
  {
    id: "welookup", name: "WeLookup", cat: "detect", domain: "welookup.info",
    url: "https://welookup.info", price: "Free", free: true, verified: true,
    logo: "/logos/welookup.jpeg",
    updated: "2026-09-16",
    tags: ["detector", "apps", "free", "extension", "chrome", "store insights"],
    one: "Extension-first store analysis, 7,548 apps and tools.",
    note: "Broadest claimed detection coverage of the free detectors. Adds an information tab with Shopify store insights. Search exists but is still beta; the extension is the product.",
    watch: "Small and new, version 1.0.0 at time of checking. Like every detector, it only sees apps with a storefront presence.",
    social: { li: "https://www.linkedin.com/company/welookupinfo/" },
  },

  {
    id: "koalainspector", name: "Koala Inspector", cat: "detect", domain: "koala-apps.io",
    url: "https://koala-apps.io/koala-inspector/", price: "Free, 15 checks a month. Premium $22/mo, token packs from $3.99", free: true, verified: true,
    updated: "2026-09-19",
    tags: ["detector", "apps", "theme", "extension", "chrome", "free", "sales estimate", "traffic estimate", "ads"],
    one: "Chrome extension reading a store's apps, theme and estimated numbers.",
    note: "Open a Shopify store and it returns the installed apps, the active theme, the product catalogue and its best sellers, estimated monthly traffic with its sources, estimated monthly sales, and the store's live ad creatives. The free plan is 15 analyses a month and does not expire; Premium is $22 a month for 220 analyses and tracking of up to 50 stores, with one-off token packs from $3.99. One of roughly ten tools from Koala Apps, alongside separate theme and app detectors, a sales tracker, a store analyzer and a set of calculators.",
    watch: "Monetised by affiliate links, to TikTok, Klaviyo, Zendrop, Printify and NordVPN among others, with an affiliate and an ambassador program of its own, so nothing it recommends around the data is neutral. No legal entity, country or person is named anywhere on the site. The sales and traffic figures are estimates published with no method attached, so they are worth using to rank stores and not to quote one.",
    social: { yt: "https://www.youtube.com/@koala-apps" },
  },
  {
    id: "ppspy", name: "PPSPY", cat: "detect", domain: "ppspy.com",
    url: "https://www.ppspy.com", price: "Free plan, then $39 / $99 / $299 a month", free: true, verified: true,
    pricingUrl: "https://www.ppspy.com/rank",
    updated: "2026-09-19",
    tags: ["detector", "spy", "sales estimate", "dropshipping", "store explorer", "traffic", "ads", "api", "extension", "chrome"],
    one: "Dropshipper spy tool, with a store explorer and an API behind it.",
    note: "Built to find winning products: fifteen-day sales reports on any store, a product and ad library, an ad tracker and a Chrome extension, across more than 1M active Shopify stores, 200M+ products and 800K+ themes by its own count, with app, theme and pixel detection. What is useful here is underneath that, the Shop Explorer, which filters the same store set by revenue, keywords and search volume, and the API. Standard is $39 a month for 30 trackers and 10,000 credits, Pro $99 for 100 and 100,000, Business $299 for 300 and 500,000, 30% off annually, on top of a free tier and a trial that takes no card.",
    watch: "It is not built for you, and the row is here for one part of it. Its own homepage says join 130,000+ merchants, and the product, the price and the whole library around it are aimed at dropshippers choosing products, so the store explorer arrives attached to something else and priced with it. The order figures are AI predictions rather than measured sales, which its own copy says plainly, so they rank stores and do not report revenue. It names no company, entity or country anywhere on the site, and it states that it issues no refunds.",
    social: {},
  },

  /* ---- Suites ---- */
  {
    id: "marmeto", name: "Marmeto", cat: "suite", domain: "marmeto.com",
    url: "https://marmeto.com", price: "Most tools free for approved partners", free: true, verified: true,
    /* Elevate is app revenue and churn analytics, Orbit is partner programmes
       and commissions. Both are listed here as their own entries and both are
       Marmeto, so the suite belongs in those two categories as well. */
    alsoIn: ["biz", "partner"],
    updated: "2026-09-11",
    tags: ["suite", "analytics", "partner", "feedback", "logistics", "payouts", "nps", "checkout", "agency", "white-label", "api"],
    one: "Twelve products across the partner side and the merchant side.",
    note: "India's first Shopify Platinum Partner as of July 2026, fewer than 100 globally, founded 2017, and the team behind Return Prime and Recurpay. Transitioned from services to a product-first company in 2026, which is why the partner tool suite appeared when it did. Six products for partners, apps and agencies: Elevate (app revenue and churn analytics), Orbit (partner programs and commissions), Feedback (visual feedback on any site, free, aimed at agencies), Logistics (one API for courier integrations you resell inside your own SaaS), Payouts (multi-market payout options through a single integration), Pulse (in-app NPS, free). Six more for brands: Vision (ecommerce analytics), Nexus (multi-marketplace), Checkout (Shopify checkout customization), OTP Login, Flow (workflow automation), Bridge (integration automation).",
    watch: "Most of it is free only if you register as a Marmeto partner, which is the actual product. Logistics and Payouts are white-label infrastructure you would resell, a different proposition from the analytics tools.",
    social: {},
  },
  {
    id: "meridian", name: "Meridian", cat: "suite", domain: "the-meridian.ai",
    url: "https://www.the-meridian.ai", price: "$69 / $169 per app per month", free: false, verified: true,
    /* Billing and a plan builder wired into Shopify Billing, plus an App Store
       analytics and keywords module. Somebody replacing Mantle should find it
       under Analytics & billing, which is the search that brings them here. */
    alsoIn: ["biz", "aso"],
    updated: "2026-09-11",
    tags: ["suite", "hosting", "billing", "crm", "email", "automation", "sdk", "mcp", "analytics", "lifecycle"],
    one: "Whole app lifecycle: hosting, billing, CRM, email, ASO.",
    note: "The most ambitious of the Mantle replacements. Hosting with webhooks, logs and secrets managed for you; a plan builder wired into Shopify Billing; a CRM built around the stores using your app; automations, emails and reports; App Store analytics, keywords and reviews as one module. One price per app, every feature on every plan, hosting included.",
    watch: "Closed early access, onboarding one developer at a time. A broad surface area from a new team is the exact risk this ecosystem just learned about.",
    social: { li: "https://www.linkedin.com/company/the-meridian-ai/" },
  },

  /* ---- Merchant research ---- */
  {
    id: "appstoreresearch", name: "App Store Research", cat: "research", domain: "appstoreresearch.com",
    url: "https://appstoreresearch.com", price: "Free account, from $150 per research call", free: true, verified: true,
    linked: "ShopExperts",
    /* It recruits, screens, schedules and pays a panel of vetted operators on
       your behalf, which is the Talent & services job done with merchants
       rather than developers. The research framing is primary because that is
       what you are buying the calls for. */
    alsoIn: ["talent"],
    updated: "2026-09-18",
    tags: ["user research", "customer discovery", "interviews", "panel", "recruitment", "validation", "sales calls", "positioning", "churn"],
    one: "A paid panel of vetted Shopify merchants you can book calls with.",
    note: "3,000+ Shopify brands in the network, $1M+ paid to participants, 6,000+ product conversations. You define the merchant profile by role, industry, revenue range and Shopify plan; vetted operators apply and you approve who you talk to. Scheduling, screening and incentives are handled. Used for roadmap validation, switching analysis, pricing and positioning. Transcripts and tagged insights are a paid add-on. Named customers include Loox, Recart, Tresl, ClickPost and MobiLoud. Pricing is published as worked examples with the incentive and the recruitment fee itemised separately: a product validation interview is $100 incentive plus $65 recruitment, $165 in total; a Shopify Plus interview is $200 plus $65, $265; a high-intent sales conversation is $300 plus $250, $550. Research calls start at $150 and sales calls at $500. You are billed only on a completed call, with nothing charged for a cancellation or a no-show. The same company runs ShopExperts and publishes ShopOps Weekly, a free weekly digest of Shopify platform changes written for merchants.",
    watch: "It sells sales calls alongside research calls, and a merchant paid $300 to take one is not the same signal as inbound interest. Those conversations are research with a discount applied, not pipeline. The incentive is also the part that moves: it is adjusted for participant quality, urgency and targeting, with $85 the floor on a research interview, so the worked examples are the shape of a bill rather than a quote for yours. And a paid panel is self-selecting in the way every paid panel is. You are hearing from operators who will take $100 to talk for half an hour, which is a different population from the merchants who ignore the invitation.",
    ratings: [
      { source: "REVIEWS.io", score: 5, outOf: 5, count: 72, url: "https://www.reviews.io/company-reviews/store/appstoreresearch.com-2ng54Ax", captured: "2026-09-18" },
      { source: "Trustpilot", score: 4.3, outOf: 5, count: 12, url: "https://www.trustpilot.com/review/appstoreresearch.com", captured: "2026-09-15" },
    ],
    social: { li: "https://www.linkedin.com/company/appstoreresearch/" },
  },

  /* ---- Talent & services ---- */
  {
    id: "storetasker", name: "Storetasker", cat: "talent", domain: "storetasker.com",
    url: "https://www.storetasker.com", price: "Free to get matched, projects from $400", free: true, verified: true,
    updated: "2026-09-15",
    tags: ["freelance", "developers", "designers", "marketers", "hiring", "retainer", "agencies", "app devs", "vetting"],
    one: "Vetted freelance Shopify talent, introduced against a brief rather than browsed.",
    note: "Introductions rather than a directory: you describe the work and Storetasker puts you in front of freelancers it thinks fit, usually within a few hours. It says it has reviewed over 15,000 developers, designers and marketers and admits under 5%, and shows 4.9 out of 5 across 1,500+ reviews. Work is quoted by the freelancer as a fixed project or a monthly retainer, with published examples running $400 for a landing page customisation, $475 for theme edits, $2,000 for site speed work, $3,000 for a 30-hour monthly retainer and $6,000 for a branding sprint. The part that matters here is a Shopify app developer category sitting alongside the theme and marketing talent, plus the 200+ agencies using it for overflow.",
    watch: "What Storetasker takes is not published anywhere on the site. Pricing is described as coming directly from the experts you hire, which is the freelancer's number and says nothing about the platform's margin on top of it. The vetting figures, 15,000 reviewed and under 5% admitted, are self-reported and not checkable. Fine on a fixed-scope project where the quote is the quote; worth asking about before a long retainer.",
    ratings: [
      { source: "Trustpilot", score: 4.9, outOf: 5, count: 1732, url: "https://www.trustpilot.com/review/storetasker.com", captured: "2026-09-15" },
    ],
    social: { li: "https://www.linkedin.com/company/storetasker/" },
  },
  {
    id: "shopexperts", name: "ShopExperts", cat: "talent", domain: "shopexperts.com",
    url: "https://shopexperts.com", price: "Free to get matched; experts pay to be listed", free: true, verified: true,
    linked: "App Store Research",
    updated: "2026-09-18",
    tags: ["freelance", "agencies", "marketplace", "hiring", "matching", "vetting", "heycarson", "no commission"],
    one: "Hand-matched Shopify experts and agencies, free to the person hiring.",
    note: "Formerly HeyCarson. You describe what is broken and get up to three hand-picked matches to compare, usually inside an hour, drawn from 205 vetted experts covering agencies, freelancers and consultants. It shows 4.96 across 860 verified client reviews and claims 56,000+ brands, agencies and app companies matched since 2015, with the top 3% of applicants passing vetting. Hiring costs nothing: no commission, no markup, and you pay the expert directly. Browsing is organised by the problem rather than the skill, and filterable by the partner apps an expert works with, Loox, Klaviyo, Judge.me and PageFly among them. The same company runs App Store Research and publishes ShopOps Weekly, a free weekly digest of Shopify platform changes written for merchants.",
    watch: "The side that pays is the expert, not you. A verified listing is free, but Verified Pro at $799 a year or $249 a quarter buys Official Partner status, lead capture and listing analytics, so a hand-picked match is a ranking somebody can buy into rather than a neutral one. The vetting figures, 205 experts and the top 3% of applicants, are self-reported and not checkable from outside.",
    ratings: [
      { source: "Trustpilot", count: 269, url: "https://www.trustpilot.com/review/heycarson.com", captured: "2026-09-15" },
    ],
    social: { li: "https://www.linkedin.com/company/heycarson/" },
  },

  /* ---- Support & CX ---- */
  /*
   * Apricot CX carries `editorInterest: true`. It is the company the person
   * maintaining this directory runs, so it gets the heaviest disclosure here
   * and is the only entry the matcher is not allowed to recommend. See the
   * block above hasEditorInterest, and invariant 35.
   */
  {
    id: "apricotcx", name: "Apricot CX", cat: "support", domain: "acxt.am",
    url: "https://acxt.am", price: "Not published", free: false, verified: true,
    editorInterest: true,
    owner: "Apricot CX Technologies, run by Ali A., who maintains this directory",
    updated: "2026-09-21",
    tags: ["support", "outsourced", "white-label", "helpdesk", "chat", "24/7", "reviews", "review recovery", "escalation", "qa", "armenia"],
    one: "Outsourced merchant support for app vendors, with review recovery attached.",
    note: "Fifteen people in Yerevan, Armenia: ten support agents, three technical-support specialists and two QC agents, covering a merchant queue around the clock and handling up to 1,000 chats a week. Three services, and the second two are what separate it from a general support shop. Support operations runs the inbox and live chat with technical escalation. Positive review operations works the same queue for review conversion against a stated 13% monthly KPI, claiming around 3,000 positive reviews on one app it supports and 140+ on another. Negative review recovery is direct outreach on low-star reviews: reach the merchant, fix the underlying problem, ask them to reconsider, with 100+ recovered so far and the site stating that no incentive of any kind is offered. Enquiry is by email or phone, and there is no self-serve signup.",
    watch: "I run this company. Apricot CX Technologies is mine, I have a direct commercial interest in you hiring it, and I cannot assess it neutrally. Weigh this entry accordingly and do not read it as the independent judgement the rest of the directory is for. What I can state as fact, because it is checkable on the site: no price is published anywhere, no founding date either, and every figure in the description is the company's own and unverifiable from outside, which is the same thing this directory says about every other self-reported number. The part worth thinking hardest about is not the support queue. A service carrying a monthly review-conversion KPI is a different product from support, it moves the reviews on your own App Store listing, and how comfortable you are with that is a judgement I am the wrong person to help you make.",
    social: { li: "https://www.linkedin.com/company/acxt/", x: "https://x.com/Apricotcx" },
  },
  {
    id: "kivosupport", name: "KivoSupport", cat: "support", domain: "kivosupport.com",
    url: "https://kivosupport.com", price: "$299 / $1,499 / $2,999 per month, then custom", free: false, verified: true,
    pricingUrl: "https://kivosupport.com/pricing",
    owner: "EFOLI, LLC",
    updated: "2026-09-21",
    tags: ["support", "outsourced", "white-label", "helpdesk", "chat", "email", "sla", "knowledge base", "liquid", "escalation"],
    one: "White-label support for Shopify apps, with the tiers actually priced.",
    note: "The only one of these three with a rate card. Starter at $299 is email only, shared agents, up to 75 tickets a month, 4 hours a day across 5 days and a 24-hour response SLA. Growth at $1,499 adds live chat to 150 conversations, feedback analysis, bug and feature-request reporting and basic HTML and CSS work over 8 hours a day. Professional at $2,999 is a dedicated agent capped at three clients, 24/7 cover, 300 conversations, dedicated QA and agent coaching, Liquid customisation and review request and response management. Enterprise is custom: a dedicated team and lead, 1,000+ conversations, helpdesk setup, Slack and SLAs down to 4 hours. No setup fee, no free trial, cancel any time, and a free consultation to scope it.",
    watch: "The logo wall is headed \"Trusted by Shopify apps used by thousands of merchants\", and at least four of the six apps on it are EFOLI's own: MultiVariants, OrderRules, DiscountRay and QuotWay are all published by EFOLI, LLC on the App Store, and PushBundle is EFOLI's too. Read it as a portfolio rather than as six independent references, and ask for a client you can actually call. The tiers are also metered on conversations rather than on hours, so a support load that spikes is the case their pricing handles worst, and where the team sits is not stated anywhere. Note too that review request and response management is bundled from Professional up, which is a different product from support wearing the same invoice.",
    social: {
      li: "https://www.linkedin.com/company/kivosupport",
      x: "https://x.com/KivoSupport",
    },
  },
  {
    id: "supportheroes", name: "The Support Heroes", cat: "support", domain: "thesupportheroes.com",
    url: "https://thesupportheroes.com", price: "Not published", free: false, verified: true,
    updated: "2026-09-21",
    tags: ["support", "outsourced", "white-label", "tier 2", "24/7", "recruitment", "training", "qa", "escalation", "timezones"],
    one: "A tiered support team for app vendors, recruited and managed for you.",
    note: "The largest of the three by its own numbers: 66 people supporting 44 Shopify apps, 24/7, with agents spread across timezones rather than one office covering shifts. Two tiers, and the split is the pitch: tier 1 knows Shopify and handles the queue, tier 2 takes complex issues and customisation requests. Team management, recruitment, training and quality analysis are all included rather than sold on, so what you are buying is closer to a managed support department than a pool of agents. Named partners include Ablestar, Venntov, Conjured, Freshly Commerce, Orbe, Bloggle, Buunto, Forsberg Plus Two and Code Black Belt.",
    watch: "Nothing about the commercial side is published: no price, no rate card, no SLA, no response-time commitment, and no minimum, so everything about what it costs and what it promises is a conversation. Ownership is not stated either. The site credits eighteen people by first name and names no founder, no parent and no legal entity, which for a supplier taking over your merchant relationship is the one fact you would want before the first call. The 44 apps and 66 heroes are self-reported and not checkable, though the partner list is unusually specific for this category and several of those vendors are well known enough to ask directly.",
    social: {
      li: "https://www.linkedin.com/company/the-support-heroes/",
      x: "https://twitter.com/TSupportHeroes",
    },
  },
];

/*
 * When the catalogue last changed, derived rather than declared.
 *
 * A hand-maintained constant only ever tells the truth until the first time
 * somebody forgets it, and the failure is silent and in the wrong direction —
 * the footer claims the directory is stale while it is not. This reads the
 * newest `updated` in TOOLS instead, so the date cannot disagree with the
 * catalogue it describes.
 *
 * Deliberately computed from TOOLS, the editorial source, and not from
 * mergedTools(): a vendor editing their own listing must not move the
 * site-wide date. Their change shows as "last updated {editedAt}" on that
 * listing alone.
 *
 * Formatted from a fixed month table rather than toLocaleDateString, because
 * the masthead renders in a client component — a server and a browser
 * disagreeing about locale would be a hydration mismatch.
 */
const MONTHS = ["January", "February", "March", "April", "May", "June",
   "July", "August", "September", "October", "November", "December"];

export const formatDay = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  if (!m) return "";
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
};

/*
 * The catalogue as a visitor sees it, and the name everything else imports.
 *
 * Reaching for `TOOLS` is the safe default on purpose: every route, every
 * component and every id check gets the published list without asking for it,
 * so a draft cannot reach a visitor through a consumer that had not heard of
 * drafts. `ALL_TOOLS` above is the full source, and /admin is the only thing
 * that wants it.
 */
export const TOOLS = published(ALL_TOOLS);

/*
 * Computed from the published list. A draft has an `updated` date like
 * anything else, and letting it move the site-wide date would have the footer
 * announce an update a visitor cannot see. Writing a draft changes nothing
 * about what the directory currently says, so it changes nothing about when
 * the directory last said something.
 */
export const LAST_UPDATED_ISO =
  TOOLS.reduce((newest, t) => (t.updated && t.updated > newest ? t.updated : newest), "");

export const LAST_UPDATED = formatDay(LAST_UPDATED_ISO);

/* ================================================================== */
