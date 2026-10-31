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
   * The action colour, Cobalt's one signal (globals.css, 2026-10-28). It is
   * a fill with onAccent type on it, re-derived per theme. As text it uses
   * accentInk, a deeper step of the same hue, and the same split applies to
   * the warning and error hues. Anything filled uses the first, anything set
   * in type uses the second. The brand green is the wordmark, the icon and
   * the ASO category now, not the action.
   */
  accent: "var(--c-accent)",
  onAccent: "var(--c-on-accent)",
  /* Type on a category fill. The hues are bright in both themes, so this is
     dark in both, and it is not onAccent, which is paper on cobalt. */
  onCategory: "#06110D",
  /* The tile behind a vendor's logo: white in both themes, because logos are
     drawn for white. */
  logoTile: "var(--c-logo-tile)",
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

/* Corner radii, Cobalt's (2026-10-28): 6 on a control, 8 on a card, 12 on a
   modal, 4 on a badge. Cobalt has no pills, so `pill` is a key's 6 too: the
   chips and tags that used it are keys and tags now. A card that the browser
   can bevel is cut on two corners in globals.css. */
export const R = { control: 6, card: 8, modal: 12, badge: 4, pill: 6 };

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
  { id: "storedb", label: "Store databases", term: "Store database tools", color: "#B08CFF",
    blurb: "Query the merchant universe by platform, apps installed, revenue band and contacts." },
  { id: "detect", label: "Store detectors", term: "Store detector tools", color: "#48E5C2",
    blurb: "One store at a time. Paste a URL, see the stack." },
  { id: "suite", label: "Ecosystem suites", term: "Ecosystem suites", color: "#FF9052",
    blurb: "Vendors covering several categories under one roof." },
  { id: "research", label: "Merchant research", color: "#FFD166",
    blurb: "Talking to actual merchants: panels, recruitment, customer discovery." },
  { id: "talent", label: "Talent & services", term: "Talent and services", color: "#7FD1F0",
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

/*
 * Categories in the order they are shown everywhere a visitor sees a list of
 * them: most tools first, counting secondary members as the chips do, then by
 * label. Computed, so the order stays right as the catalogue grows and a new
 * category does not land last because it was written last. "All" is not a
 * category and goes first wherever it appears.
 */
export const categoriesByCount = (tools = TOOLS) =>
  CATEGORIES.map((c) => ({ c, n: tools.filter((t) => isInCat(t, c.id)).length }))
    .sort((a, b) => b.n - a.n || a.c.label.localeCompare(b.c.label))
    .map((x) => x.c);

/* ================================================================== */
/*  Entries the matcher will not put forward                           */
/*                                                                     */
/*  `noRecommend: true` keeps an entry out of the matcher's            */
/*  recommendations. It is a rule about this directory's own            */
/*  behaviour and it asserts nothing whatsoever about the company:      */
/*  not a conflict, not a relationship, not a doubt about the           */
/*  product. Anything that needs saying about an entry is said in       */
/*  `watch` and `ownership`, in words, where a reader can weigh it.         */
/*                                                                     */
/*  This replaced a field called `editorInterest`, which drove a warn   */
/*  badge and a disclosure paragraph asserting that the person          */
/*  maintaining this directory had a commercial interest in the entry.  */
/*  That was wrong about a real company and it was published. The       */
/*  lesson is the one worth keeping in this file: **a field whose name  */
/*  is a claim about somebody will publish that claim everywhere it is  */
/*  read.** A flag may describe what we do. The moment it describes     */
/*  what somebody else is, it belongs in `watch` as a sentence          */
/*  somebody wrote on purpose, not in a boolean that six components     */
/*  render on its behalf.                                              */
/*                                                                     */
/*  So there is no badge, no disclosure block and no llms.txt note.     */
/*  The one consequence is the exclusion, it is in PROTECTED so a       */
/*  vendor cannot clear it or set it on a rival, and `sanitiseEntry`    */
/*  forces it absent so it can only be written by hand in this file.    */
/*                                                                     */
/*  Absent means recommendable, which is every other entry.             */
/* ================================================================== */
export const recommendable = (t = {}) => t.noRecommend !== true;

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
export const ownerOf = (t = {}) => {
  /* The structured reference (lib/owners.js) first, then a legacy free-text
     `owner` from a stored override or a published entry written before it. */
  const ref = t.ownership && typeof t.ownership === "object" ? t.ownership : null;
  const name = ref ? ref.name : t.owner;
  /* A reference from the file is checked against the name and id only: a
     product on its parent's domain (Elevate on marmeto.com) still names the
     parent. Free text keeps the domain check (lib/owners.js says why). */
  return isVacuousOwner(name, ref?.id ? { name: t.name, id: t.id } : t) ? "" : String(name);
};

/* ================================================================== */
/*  Resource kinds. Tools are the only section with a catalogue        */
/*  behind them; the rest are stubs the roadmap opens for suggestions. */
/*  Colours are reused from CATEGORIES so the palette stays closed.    */
/* ================================================================== */
export const RESOURCE_KINDS = [
  { id: "tool", label: "Tools", color: "#00E08A", live: true,
    blurb: "Software for the people who build Shopify apps, nearly all of it built for nothing else. The section you are looking at." },
  { id: "newsletter", label: "Newsletters", color: "#4CC9F0", live: true,
    blurb: "Written regularly, actually about the app ecosystem, and still publishing." },
  { id: "event", label: "Events & meetups", color: "#FFB020", live: true,
    blurb: "Conferences, Partner meetups and the side events worth the flight." },
  { id: "podcast", label: "Podcasts", color: "#FF6B8A", live: true,
    blurb: "Shows about selling on Shopify. One is made for app builders; the rest are for merchants." },
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
  { id: "award", label: "Awards", color: "#B08CFF", live: false,
    blurb: "Industry awards an app vendor can enter, who judges them and what entering costs." },
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
  { id: "date", label: "Wrong date or place", needsValue: true,
    hint: "What are the dates and city now, and where did you see them?" },
  { id: "other", label: "Something else", needsValue: true,
    hint: "What is wrong?" },
];

/*
 * A category as a noun phrase for titles. Most labels read with "tools"
 * after them ("App Store ASO tools"); a few are already plural nouns or
 * services, and "Store databases tools" is what the template made of one.
 * Those carry a `term`. Pure, shared by the page title and the graph name.
 */
export const categoryTerm = (cat) => (cat && cat.term) || `${cat.label} tools`;

/*
 * The price line, with a free plan folded in rather than badged beside it
 * (rule J). Returns the price untouched when it already says free, which is
 * most of the catalogue, and completes the sentence only where it does not.
 * A dying tool is left alone: its price describes the wind-down. Defined here
 * so the card, the list and the category rows say the same thing.
 */
export function priceLine(tool) {
  const price = String(tool.price || "").trim();
  if (!tool.free || tool.dying) return price;
  if (/free/i.test(price)) return price;
  if (!price || /^not published$/i.test(price)) return "Free plan, paid tiers not published";
  return `Free, then ${price.charAt(0).toLowerCase()}${price.slice(1)}`;
}

export const reportKindOf = (id) => REPORT_KINDS.find((k) => k.id === id) || null;

/*
 * Which of those make sense for each kind of listing. A newsletter has no
 * price and a tool has no date, and offering the wrong one invites a report
 * nobody can act on. The route checks the same list, so a hand-built request
 * cannot file a pricing report against an event either.
 */
const REPORT_KINDS_BY = {
  tool: ["broken", "url", "pricing", "social", "other"],
  newsletter: ["broken", "url", "social", "other"],
  podcast: ["broken", "url", "social", "other"],
  event: ["broken", "url", "date", "social", "other"],
};
export const reportKindsFor = (kind) => {
  const ids = REPORT_KINDS_BY[kind] || REPORT_KINDS_BY.tool;
  return REPORT_KINDS.filter((k) => ids.includes(k.id));
};

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
/*  launched: when the tool launched, from its own site. "YYYY-MM-DD", */
/*    "YYYY-MM", "YYYY" or "unknown"; never guessed, never a domain   */
/*    registration or a copyright range. Shown as "Launched March     */
/*    2026", in the compare table, and sorts and filters the grid.    */
/*    Protected: a vendor does not set its own age. lib/launched.js.  */
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
 *  alsoIn: optional array of secondary category ids. `cat` is the primary and
 *  stays the only source of the card spine colour, the category label and the
 *  "By category" sort; `alsoIn` puts the entry on those categories' pages and
 *  in their counts as well, marked as a secondary member. File one only where
 *  the entry's own `note` describes that category's core job, not where it
 *  touches on it: the point is that somebody shopping that shelf would
 *  genuinely consider it. See invariant 36.
 *
 *  competes: optional array of tool ids this entry is a direct rival or a
 *  direct replacement for. Read symmetrically, so declaring it on one entry
 *  wires both pages, and it is the only Related tools tier that crosses a
 *  category boundary. Write it only where the catalogue's own prose already
 *  names the rivalry. See invariant 28.
 */
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
    url: "https://www.appjubilee.io", price: "$29 / $99 / $199 / $499 a month", free: false, verified: true,
    ownership: { id: "dark-ecommerce-labs", name: "Dark Ecommerce Labs, LLC" },
    pricingUrl: "https://www.appjubilee.io/pricing",
    /* Clears the stored price override on deploy (lib/overrideClears.js). */
    clearOverride: { fields: ["price"], at: "2026-10-31", reason: "The monitor saved a finding's sentence (\"Pricing no longer includes a $49/mo Starter tier\") as the price. The plans are $29 / $99 / $199 / $499, read on appjubilee.io/pricing 2026-10-31." },
    launched: "unknown", /* not stated on its own site (checked 2026-10-23) */
    updated: "2026-10-31",
    tags: ["keyword", "ranking", "aso", "competitor", "multi-app", "agency", "listing", "portfolio"],
    one: "Multi-app ASO with automatic keyword discovery.",
    note: "By its own count it tracks 1,200+ App Store keywords a day. It finds them automatically, with no list to build. It maps the full set of competing apps and correlates listing changes with ranking movement. Pricing is by the number of apps: $29 for one, up to $499 for 30 on the agency tier. It needs no GA4 connection.",
    watch: "Same company as StoreCensus. So their comparison pages against rivals are one vendor's marketing, not two independent sources.",
    social: {},
  },
  {
    id: "appstorepulse", name: "AppstorePulse", cat: "aso", domain: "appstorepulse.com",
    url: "https://www.appstorepulse.com", price: "Free tier, then paid", free: true, verified: true,
    ownership: { id: "the-wide-company", name: "The Wide Company, which also makes WideBundle" },
    /* "Connect a Partner account and it adds live MRR, ARR, churn, trials and a
       per-store customer view" is the Analytics & billing category in full.
       Somebody replacing Mantle should find it. */
    alsoIn: ["biz"],
    launched: "unknown", /* not stated on its own site (checked 2026-10-23) */
    updated: "2026-10-13",
    tags: ["keyword", "ranking", "competitor", "mrr", "churn", "revenue", "alerts", "listing", "reviews", "funnel"],
    one: "Rankings, competitor alerts and real MRR in one place.",
    note: "It covers keyword difficulty and volume, and daily detection of competitor changes to pricing and listings. It adds an AI listing audit against the top 10 in your category, and the listing view-to-install funnel. Connect a Partner account and it adds live MRR, ARR, churn, trials and a per-store customer view. It says 600+ app teams use it.",
    watch: "Built by the maker of Wide Bundles, a bundle app in the Upsell and bundles category. If you compete there, you would be handing your keyword strategy to a company that competes in the same category. The free tier is one app, three keywords and one competitor. Search volume is a relative tier estimate, not real numbers.",
    social: {},
  },
  {
    id: "tracksami", name: "SAMI", cat: "aso", domain: "tracksami.com",
    url: "https://www.tracksami.com", price: "$8 per month", free: false, verified: true,
    /* Monitoring: the homepage refuses the monitor from the datacentre range
       (403 behind Cloudflare) while reading fine from anywhere else, and there
       is nothing else to read. Checked 2026-10-13: the sitemap lists only the
       homepage, privacy and terms, and /blog, /changelog, /feed, /rss.xml and
       /updates are 404. So SAMI's news reaches the feed as vendor
       announcements, and Monitor coverage on /admin shows it as blocked.
       Price and Compare categories read from the homepage the same day; a
       Keyword Explorer was announced by email on 2026-10-11 and is not in the
       note until it ships. */
    launched: "unknown", /* not stated on its own site (checked 2026-10-23) */
    updated: "2026-10-13",
    tags: ["keyword", "ranking", "compare", "category", "competitor", "listing", "movers", "built for shopify"],
    one: "Look up an app and see the keywords it already ranks for.",
    note: "The main idea: there is no keyword list to build. Rankings are captured automatically against a curated database of 27,000+ keywords. So you start from what an app ranks for, not from guesses. Compare up to 40 apps side by side on shared keywords and categories. Or compare whole categories on pricing, ratings, reviews and Built for Shopify share. Category pulse shows daily gainers and losers, new and removed apps, and shifts in pricing mix and rating distribution.",
    watch: "Rankings exist only for keywords in its curated database. A long-tail term it does not carry will not show up. The site does not say how terms are chosen or added. There is no changelog, blog or named team on the site, so what has shipped is hard to check from outside.",
    social: {},
  },
  {
    id: "bestappify", name: "BestAppify", cat: "aso", domain: "bestappify.com",
    url: "https://bestappify.com", price: "Free plan available", free: true, verified: true,
    /* Its own `one` is "exposed as an MCP server", which is what App Store data
       means here: Applora's whole differentiator is the same thing. The
       affiliate and merchant-research extras are real but their depth is not
       demonstrated, and its `watch` doubts the analytics, so they do not earn a
       category each. */
    alsoIn: ["data"],
    launched: "unknown", /* not stated on its own site (checked 2026-10-23) */
    updated: "2026-10-13",
    tags: ["keyword", "ranking", "competitor", "reviews", "mcp", "ai", "affiliate", "influencer", "listing", "alerts"],
    one: "ASO plus a marketing layer, exposed as an MCP server.",
    note: "10,800+ apps tracked, with daily competitor checks. Beyond rankings it bundles an affiliate program, influencer marketing and merchant research interviews. It serves both sides of the market. A merchant-facing app directory and a developer-facing growth platform share one dataset.",
    watch: "Revenue analytics are rebuilt from subscription charge events. Its own docs note that a null ranking means not captured that day, not unranked.",
    social: { x: "https://x.com/BestAppify" },
  },
  {
    id: "letsmetrix", name: "LetsMetrix", cat: "aso", domain: "letsmetrix.com",
    /* "Free theme and app detector tools on top", and a free one is worth
       knowing about from the detectors shelf. */
    alsoIn: ["detect"],
    url: "https://letsmetrix.com", price: "Free", free: true, verified: true,
    ownership: { id: "omegatheme", name: "OmegaTheme" },
    launched: "unknown", /* not stated on its own site (checked 2026-10-23) */
    updated: "2026-10-13",
    tags: ["directory", "category", "ranking", "reviews", "free", "detector", "market size", "collections"],
    one: "Category rankings and collections, free on both sides.",
    note: "19,565 apps scored daily across 7 categories and 33 subcategories, plus 179 official Shopify collections tracked. It is best at one thing: measuring how many apps you actually compete with. Free theme and app detector tools come with it. Built by a team with 11 years of making Shopify apps.",
    watch: "Owned by OmegaTheme, which runs a large portfolio of Shopify apps. So the same conflict applies as with any tracker built by an app vendor. Developer analytics sit behind a login, and the depth is unproven.",
    social: { x: "https://x.com/letsmetrix", li: "https://www.linkedin.com/company/letsmetrix/" },
  },
  {
    id: "appnavigator", name: "AppNavigator", cat: "aso", domain: "appnavigator.io",
    url: "https://appnavigator.io", price: "Free", free: true, verified: true,
    launched: "unknown", /* not stated on its own site (checked 2026-10-23) */
    updated: "2026-10-13",
    tags: ["directory", "ranking history", "reviews", "free", "new apps", "movers", "no signup"],
    one: "Public index with ranking history, no account needed.",
    note: "26,416 apps, updated daily. Ranking history, review analysis, new launches and weekly top movers, most of it open without signing up. Built by Ablestar. The easiest way to check a competitor without paying anything.",
    watch: "Read-only. No alerts and no tracking of your own listing.",
    social: {},
  },
  {
    id: "sasi", name: "SASI", cat: "aso", domain: "heymantle.com",
    /* AppNavigator and Applora do the same free job: history and following
       across the store, so the page links them. Until 2026-10-23 this entry
       was marked as winding down with Mantle; SASI's own site shows it running
       and was being updated that day, so the flag and the words came off.
       `ownership` states what heymantle.com already implies
       and, being read both ways, puts SASI on Mantle's page as a stablemate
       rather than leaving the three Mantle entries as strangers. */
    competes: ["appnavigator", "applora"],
    url: "https://sasi.heymantle.com", price: "Free", free: true, verified: true,
    ownership: { id: "mantle", name: "Mantle", verb: "acquired by", note: "Acquired from Union Works." },
    launched: "unknown", /* not stated on its own site (checked 2026-10-23) */
    updated: "2026-10-23",
    tags: ["ranking history", "keyword", "alerts", "free", "index"],
    one: "Mantle's free App Store index, with listing history and change alerts.",
    note: "A free index of the Shopify App Store, run by Mantle. It keeps historical listing data, lets you follow apps and keywords, and notifies you about the changes you choose. Mantle acquired it from Union Works, along with the separate App Store Analytics. The two are often described as one product.",
    watch: "Run by Mantle, whose billing platform is winding down. SASI's own site says nothing about its future, and it was being updated on 23 October 2026. It is free, with no plan or terms that say how long that lasts. Do not make it the only copy of data you depend on.",
    social: {},
  },

  {
    id: "ranksy", name: "Ranksy", cat: "aso", domain: "ranksyapp.com",
    /* The Partner side is MRR over time and VIP, at-risk, growth and new
       customer segments, which is billing analytics rather than a ranking
       feature. */
    alsoIn: ["biz"],
    url: "https://ranksyapp.com", price: "$39 / $89 per month", free: false, verified: true,
    /* The site is client-rendered: the homepage, /pricing and /features are
       empty shells to a fetch and read as blocked. /changelog carries every
       entry as page data, which the monitor reads (readableText in
       lib/monitor.js), so this is how Ranksy is watched. Checked 2026-10-13. */
    changelogUrl: "https://ranksyapp.com/changelog",
    launched: "unknown", /* not stated on its own site (checked 2026-10-23) */
    updated: "2026-10-13",
    tags: ["keyword", "ranking", "attribution", "revenue", "mrr", "crm", "bigquery", "partner api", "chrome extension", "segments"],
    one: "Follows a keyword through to the customer who paid.",
    note: "Rankings, installs, revenue and a customer list in one view, for the 27,000+ apps in the store. It is built around attribution. It joins BigQuery listing traffic to Shopify Partner API revenue, so a keyword can be traced to the paying customer it produced. Organic and paid positions are counted separately. The Partner side adds MRR over time and pre-built segments for VIP, at-risk, growth and new customers. Starter is $39 a month for 3 apps, and Studio is $89 for a team. Attribution is on both, not held back for the higher tier. Seven-day trial, no card. A free Chrome extension shows rankings, review trends and keyword data on any App Store listing. The homepage app lookup is free too.",
    watch: "There is no free plan, and the pricing page says there will not be one. So after the trial, the Chrome extension is the only free part. Attribution is only as good as what you connect. BigQuery and a Partner API key are both required. Listing traffic you have not been exporting is not backfilled, and the first useful report is some weeks away. Nobody is named anywhere on the site: no company, no founder and no social profile. For a tool you give Partner API revenue data to, ask about that before you connect it.",
    social: {},
  },
  {
    id: "rankbase", name: "Rankbase", cat: "aso", domain: "rankbase.io",
    url: "https://rankbase.io", price: "$49 / $99 per month", free: false, verified: true,
    ownership: { id: "craftshift", name: "Craftshift" },
    launched: "unknown", /* not stated on its own site (checked 2026-10-23) */
    updated: "2026-10-13",
    tags: ["keyword", "ranking", "aso", "listing", "changelog", "forum", "ga4", "slack", "api", "potential score"],
    one: "Daily keyword positions, and where the installs behind them came from.",
    note: "Built for developers who already have an app listed and want more from that listing. Daily positions with up to 365 days of history, and install clicks split by organic search and paid ads. A Potential Score points at the keywords where a small move is worth the most. It also has a changelog of listing edits, and community forum monitoring with notifications. Slack and email alerts, a REST API, CSV export, multiple apps and multiple languages are included. Growth is $49 a month for 5 apps, and Business is $99 for 20. It needs a Google Analytics 4 connection and existing traffic. It does not work outside the Shopify App Store.",
    watch: "Craftshift publishes Shopify apps of its own: Bulk Product Image Upload and Export, Variant Images and Swatches, and Combined Listings. Rankbase started as the internal tracker for them. That is a fair origin. It is also a conflict if you compete in product images or variants. Your keyword strategy would be visible to somebody who sells apps of the same kind. The site's evidence is testimonials, not numbers. The one it leads with, an app going from 13th to 1st, is a single keyword on a single app. It is a rank tracker with an attribution layer, not a revenue tool: nothing here reads your Partner billing.",
    social: { li: "https://www.linkedin.com/in/faridmovsumov/", x: "https://x.com/rankbase_io" },
  },

  {
    id: "becketto", name: "Becketto Rank Tracker", cat: "aso", domain: "becketto.com",
    url: "https://becketto.com/rank-tracker", price: "Free", free: true, verified: true,
    ownership: { id: "beckett-oliphant", name: "Beckett Oliphant" },
    launched: "unknown", /* not stated on its own site (checked 2026-10-23) */
    updated: "2026-10-13",
    tags: ["keyword", "ranking", "history", "free", "locale", "snapshots", "solo"],
    one: "Free keyword rank history for the App Store, no account needed to look.",
    note: "A single-purpose tool. Search a keyword, pick a date range, and compare ranking snapshots side by side, with a locale selector. Built by Beckett Oliphant, a solo Shopify app developer. It is published on his personal site next to a development blog. Free, with no pricing page and no paid tier anywhere on it. Looking at stored history needs nothing. An email address is asked for only to refresh results right away, instead of waiting for the next scheduled capture.",
    watch: "The same person publishes Affilitrak, an affiliate marketing app for merchants on the Shopify App Store. Tracking affiliate or referral keywords here means handing your keyword strategy to somebody competing in that exact category. That is the same conflict AppstorePulse carries. It is one person's side project on a personal domain. There is no company behind it, no stated retention or refresh schedule, and no commitment to keep running. So use it for a quick check, not to build a process on. How far the history goes back is not published and could not be established without an account.",
    social: {},
  },

  /* ---- Data ---- */
  {
    id: "applora", name: "Applora", cat: "data", domain: "applora.ai",
    /* 600+ keywords refreshed daily, queryable over MCP, so somebody shopping
       for rank data has a real reason to consider it. Deliberately not
       storedb: the 605K stores come from public reviews rather than from a
       prospecting database with contacts, which its own `watch` says. */
    alsoIn: ["aso"],
    url: "https://applora.ai", price: "Free, Pro $49/mo", free: true, verified: true,
    launched: "unknown", /* not stated on its own site (checked 2026-10-23) */
    updated: "2026-10-13",
    tags: ["mcp", "ai", "agent", "dataset", "api", "keyword", "reviews", "stores", "export", "free", "research"],
    one: "The whole App Store as a live database, free on the web and over MCP.",
    note: "28.2K apps tracked, with 27.8K currently listed and 365 delisted. 1.1M reviews indexed, 605K stores identified and 600+ keywords refreshed daily. Everything is searchable for free without signup. The real difference is 15 live tools over remote MCP, plus published agent skills. So an AI agent can run a market question across rankings, reviews, keywords and stores in one pass. Pro adds 365 days of history, CSV export and 5,000 MCP calls.",
    watch: "Store records come from public App Store reviews. A store only appears if it has publicly reviewed an app. It is not install data, and they say so plainly.",
    social: { x: "https://twitter.com/applora_ai", gh: "https://github.com/applora" },
  },
  {
    id: "heyapps", name: "HeyApps", cat: "data", domain: "heyapps.dev",
    /* "Merchant intelligence": the merchants behind the reviews, with store
       domains and contact emails, which is the store database's job too. */
    alsoIn: ["storedb"],
    url: "https://heyapps.dev", price: "Free", free: true, verified: true,
    launched: "unknown", /* not stated on its own site (checked 2026-10-23) */
    updated: "2026-10-18",
    tags: ["app store", "reviews", "review archive", "rankings", "merchants", "emails", "crm", "delisted apps", "free"],
    one: "A free explorer of the whole App Store: apps, full review text, rankings and the merchants who wrote the reviews.",
    note: "Covers 29,501 apps, 950,453 reviews and 535,966 merchants by its own count, updated daily. Apps that leave the App Store and reviews Shopify removes stay in its archive, marked as delisted or removed. Reviews are searchable in full text, with developer replies and how long the merchant used the app. A free account unlocks the merchants' store domains and contact emails, and a board to track outreach.",
    watch: "No company or person is named anywhere on the site, and it has no terms of use, no privacy policy and no pricing page. It hands out merchant contact emails it found by itself, so anyone writing to them should check the consent rules first. It keeps reviews that Shopify took down. It is free, and nothing on the site says how it pays for itself.",
    social: {},
  },

  /* ---- Analytics & billing ---- */
  {
    id: "elevate", name: "Elevate", cat: "biz", domain: "marmeto.com",
    /* "Now covers affiliate attribution alongside analytics", which puts it on
       the Partner & affiliate shelf beside Orbit, its own stablemate. */
    alsoIn: ["partner"],
    url: "https://marmeto.com/elevate",
    ownership: { id: "marmeto", name: "Marmeto", verb: "part of", note: "Part of the Marmeto partner suite." },
    price: "Free for Marmeto partners", free: true, verified: true,
    launched: "unknown", /* not stated on its own site (checked 2026-10-23) */
    updated: "2026-10-13",
    tags: ["mrr", "arr", "churn", "retention", "ltv", "analytics", "mantle", "installs", "partner api"],
    one: "MRR, ARR, churn and retention for Shopify app companies.",
    note: "Openly positioned as the Mantle analytics replacement, and the copy credits Mantle by name. Revenue churn and customer churn are tracked separately. It covers customer health and LTV, install-source analytics, growth trends and direct Shopify Partner account integration. It now covers affiliate attribution alongside analytics.",
    watch: "Free access requires being an approved Marmeto partner, which is the real product.",
    social: {},
  },
  {
    id: "mantle", name: "Mantle", cat: "biz", domain: "heymantle.com",
    /*
     * Declared once and read both ways, so this one line wires Mantle's page
     * to its replacements and every replacement's page back to Mantle.
     *
     * It is the case `competes` exists for. Four of these are Partner &
     * affiliate tools and Mantle is Analytics & billing, so no amount of
     * category overlap finds them, and "what do I move to" is the only
     * question anybody opens this entry to ask. Elevate, SaaS Insights and
     * Meridian position themselves against Mantle by name; Mantle's own
     * wind-down page names Shoffi, PartnerDock, Orbit and Affilitrak.
     */
    competes: ["elevate", "saasinsights", "meridian", "appvitals", "affilitrak", "partnerdock", "shoffi", "orbit"],
    url: "https://heymantle.com", price: "Winding down", free: false, verified: true, dying: true,
    ownership: { id: "mantle", name: "Mantle", note: "Mantle's own billing and analytics platform, now winding down." },
    launched: "unknown", /* not stated on its own site (checked 2026-10-23) */
    updated: "2026-10-13",
    tags: ["billing", "mrr", "churn", "email", "affiliate", "help desk", "flows", "shutdown"],
    one: "Billing, analytics, email, affiliates, flows, help desk. Shutting down.",
    note: "Announced June 2026. Most services stopped 14 August 2026. Mantle Billing runs until 30 September 2026. Mantle wrapped Shopify's Billing API, so the subscriptions themselves live on Shopify. Backed by Shopify, with a team involved in starting the App Store. It did not lose to a competitor. Shopify replaced it by shipping native App Pricing in May.",
    watch: "Listed for orientation only. If you still bill through it, this is an engineering deadline. Flex Billing has no native equivalent.",
    social: {},
  },

  {
    id: "fusionmetrics", name: "Fusionmetrics", cat: "biz", domain: "fusionmetrics.com",
    url: "https://fusionmetrics.com", price: "Free under $5k MRR, then $25 / $99", free: true, verified: true,
    /* Clears the stored price override on deploy (lib/overrideClears.js). */
    clearOverride: { fields: ["price"], at: "2026-10-31", reason: "\"Enterprise, Custom\" was stored as the price. It is free up to $5k tracked MRR, then $25 a month, read on fusionmetrics.com 2026-10-31." },
    launched: "unknown", /* not stated on its own site (checked 2026-10-23) */
    updated: "2026-10-13",
    tags: ["mrr", "churn", "ltv", "arpu", "attribution", "ga4", "partner api", "self-hosted", "mantle", "merchant lookup"],
    one: "GA4 joined to Partner billing, so an ad click can be followed to the revenue.",
    note: "Puts Google Analytics 4 next to Shopify Partner data. It tracks the whole path: ad click, App Store visit, install, then the revenue after it. Every tier has three things. A revenue dashboard with MRR, churn, LTV and ARPU. A merchant lookup for the store behind a subscription. And acquisition attribution. Pricing follows your size, not a feature list. It is free under $5k MRR, $25 a month above that, $99 above $10k, and custom above $1M ARR. A $999 one-time self-hosted license is there for anyone who would rather keep the data. Founder-led by Alexander Hupfer, who does the setup himself.",
    watch: "One person runs it, and the site says so plainly. That is honest, and it is also the risk. This is billing and revenue reporting from a single maintainer. There is no published team, no customer count, and nothing on the site about what happens to your Partner data. The self-hosted license answers that if you want it. Revenue-banded pricing also means the bill moves when the business does. That is fair while you are small and worth modeling before you are not.",
    social: {},
  },

  {
    id: "saasinsights", name: "SaaS Insights", cat: "biz", domain: "saasinsights.com",
    /* "alongside App Store keyword rankings and competitor tracking", which is
       the mirror image of Ranksy and AppstorePulse. */
    alsoIn: ["aso"],
    url: "https://saasinsights.com", price: "Free under $2.5k/mo, then $49/mo or $490/yr", free: true, verified: true,
    pricingUrl: "https://saasinsights.com/pricing",
    launched: "2023-12-15", /* saasinsights.com/changelog: "2023-12-15 Public launch." (checked 2026-10-23) */
    updated: "2026-10-13",
    tags: ["mrr", "arr", "arpu", "churn", "trials", "keyword", "ranking", "competitors", "forecasting", "slack", "mantle", "migration"],
    one: "Partner API revenue and App Store rankings on one dashboard.",
    note: "Revenue and listing data for Shopify app teams in one place. MRR, ARR, ARPU, churn and trial conversion come from the Partner API, next to App Store keyword rankings and competitor tracking. It adds custom reports, forecasting and Slack or email notifications. Free until an app earns $2.5k a month, then $49 a month or $490 a year. Every tier has unlimited apps and a 14-day trial. It is currently running a Mantle migration funnel: a dedicated \"Migrate from Mantle\" page and a 30% discount code for three months.",
    watch: "Nobody is named anywhere on it. The about page is several paragraphs of \"we\" with no company, no founder and no location. The only social profile published is an X account. That is a lot of anonymity for a tool you connect a Partner API key to, and the one thing to ask about before you do. The free tier is generous, but it is a revenue threshold, not a feature limit. So the bill arrives exactly when the app starts working. It is strongly targeted at teams leaving Mantle right now. That tells you the pricing is competitive today and says nothing about where it settles.",
    social: { x: "https://twitter.com/SaaS_insights" },
  },

  {
    id: "appvitals", name: "AppVitals", cat: "biz", domain: "appvitals.io",
    /* "Daily category and keyword positions for the apps you follow, plus
       fastest growers, review movement and new launches across the whole
       Shopify App Store" is the ASO shelf outright, the same shape as
       SaaS Insights and the mirror of Ranksy. */
    alsoIn: ["aso"],
    url: "https://appvitals.io", price: "Free under $1k/mo MRR, then from $15/mo", free: true, verified: true,
    ownership: { id: "jan-ther", name: "Jan Thér" },
    pricingUrl: "https://appvitals.io/pricing",
    launched: "unknown", /* not stated on its own site (checked 2026-10-23) */
    updated: "2026-10-13",
    tags: ["mrr", "arr", "churn", "retention", "ltv", "partner api", "keyword", "ranking", "ga4", "bigquery", "slack", "uptime", "custom events", "mantle", "migration"],
    one: "Partner API revenue rebuilt from raw events, with rank tracking and uptime beside it.",
    note: "Four tools in one console: revenue analytics from the Shopify Partner API, GA4 listing-traffic attribution from listing view to install to paying subscriber, daily App Store category and keyword positions, and minute-level uptime checks on each app's critical routes. Slack and email rules cover all of it. The method is the main selling point: MRR, ARR, churn, retention and LTV are recomputed from the append-only Partner event feed, not read off nightly totals. So a figure for last March is the same every time you ask for it. One definition of MRR is used on the dashboard, in the churn denominator and on your own bill. It adds Mixpanel-style custom events, each paired to the store that fired it. Pricing is banded on your MRR, not on features: free under $1,000 a month, $15 above that, rising in brackets to over $1M. Every tier has every feature, unlimited apps, full history and unlimited seats. It runs a Mantle migration funnel. Its argument is that reconnecting the Partner API brings the whole history back, with nothing to export.",
    watch: "The marketing site names nobody. The legal notice shows the operator is a Czech sole trader called Jan Thér, billing through Paddle. That is one person holding a Partner API key and the complete revenue history of every app connected to it, which is worth weighing before connecting. The headline figures are not customers either: 27,300+ apps, 17,900+ developers and 932,000+ reviews are the size of its App Store index, which is roughly the App Store. Nothing published says how many teams pay for this. Revenue-banded pricing means the bill tracks the business, which is generous while you are small and worth modeling before you are not. The GA4 half needs a BigQuery export set up on your side, so attribution needs setup work first. The changelog sits behind the login, so how fast it actually moves cannot be checked from outside.",
    social: { x: "https://x.com/appvitalsio" },
  },
  {
    id: "luseri", name: "Luseri", cat: "biz", domain: "luseri.com",
    /* No alsoIn "aso": it records daily category rank and six competitors,
       but says itself that it does not track keywords you choose, which is
       what somebody shopping that shelf is after. */
    url: "https://luseri.com/en", price: "Free for now", free: true, verified: true,
    logo: "/logos/luseri.svg",
    ownership: { id: "arthur-renard", name: "Arthur Renard" },
    competes: ["mantle"],
    launched: "2026-10-08", /* luseri.com/en/changelog: "October 8, 2026: The first version." (checked 2026-10-23) */
    updated: "2026-10-20",
    tags: ["mrr", "churn", "retention", "cohorts", "uninstall reasons", "partner api", "ranking", "competitors", "reviews", "ga4", "ai assistant", "mantle", "migration"],
    one: "Partner revenue, installs and App Store listing data live, with an AI assistant that reads them.",
    note: "A dashboard for one Shopify app's numbers. MRR and what moved it, cohort retention and the reasons merchants give for uninstalling come from the Partner account, with read-only access. Beside them are reviews, daily category rank against six competitors, and the App Store searches that led to a visit, from GA4. An AI assistant answers questions about those figures. In-app event tracking is optional. It does no billing and no affiliates. The dashboard is in English or French.",
    watch: "One person in France runs it, Arthur Renard, who also sells a Shopify app called OptiDress. That is one individual holding read access to your Partner account and its full revenue history. It is free for now, and its terms say paid plans would come with 30 days of notice, so the long-run price is unknown. It is new: its legal pages are dated October 2026, and no user count is published. It does not track keywords you pick, only the searches GA4 saw.",
    social: {},
  },
  {
    id: "prys", name: "Prys", cat: "biz", domain: "prys.io",
    /* Rank and keyword tracking, keyword prioritisation and generated listing
       copy are App Store SEO outright, and the note says so. */
    alsoIn: ["aso"],
    /* Its own Mantle migration page names the rivalry. */
    competes: ["mantle"],
    url: "https://prys.io", price: "Free under $1k/mo MRR, then $49.95 to $499.95/mo by MRR", free: true, verified: true,
    ownership: { id: "convert2x", name: "Convert2x", verb: "built by" },
    pricingUrl: "https://prys.io/pricing",
    launched: "unknown", /* not stated on its own site (checked 2026-10-23) */
    updated: "2026-10-17",
    tags: ["attribution", "keyword", "revenue", "mrr", "churn", "ltv", "aso", "seo", "aeo", "google ads", "shopify ads", "ga4", "bigquery", "partner api", "email", "funnel", "benchmarks", "mantle", "migration"],
    one: "Keyword-level revenue attribution for apps, with App Store SEO, ads and email on top.",
    note: "Connects your Shopify Partner data and Google Analytics, through a BigQuery export. It then follows each merchant from App Store visit to paying customer, down to the search keyword. On that it builds App Store SEO with AI-written listing copy. It also feeds conversions to Google Ads and Shopify App Store ads, tracks landing pages and sends lifecycle emails. Meta Ads is listed as coming soon. Pricing is banded on your MRR. It is free under $1,000 a month for the analytics alone, then $49.95 to $499.95 a month, with a 30-day trial of everything. Its Mantle migration page offers it as the replacement for Mantle's analytics, flows and customer views, not for billing.",
    watch: "Prys grew out of Convert2x, a growth agency for Shopify apps. Its about page still offers the agency to anyone who wants the work done for them. Connecting it gives one company your Partner revenue history and your GA4 data. It benchmarks you against hundreds of other Shopify apps, and the site does not say where that data comes from. Without ShopIDs in BigQuery, it matches installs to visits with its own algorithm, which it calls around 80% accurate. The figure of 500+ apps is its own claim. The company, Prys.io Ltd, is headquartered in Israel.",
    social: { li: "https://www.linkedin.com/company/83046118" },
  },

  /* ---- Partner & affiliate ---- */
  {
    id: "affilitrak", name: "Affilitrak for Apps", cat: "partner", domain: "affilitrak.com",
    url: "https://affilitrak.com/for-apps", price: "Free, 20% on marketplace affiliates", free: true, verified: true,
    ownership: { id: "beckett-oliphant", name: "Beckett Oliphant" },
    launched: "unknown", /* not stated on its own site (checked 2026-10-23) */
    updated: "2026-10-13",
    tags: ["affiliate", "referral", "commission", "payout", "attribution", "mantle", "migration", "marketplace"],
    one: "Affiliate tracking for apps, built to take over a Mantle program as it is.",
    note: "Tracks installs and recurring revenue, runs commission rules and pays affiliates through PayPal. The migration is the main selling point. It imports affiliates, referral codes, referral history and payout history from Mantle. It keeps every existing apps.shopify.com link working in the same mref format, so no affiliate has to re-share anything. It runs alongside Mantle until Mantle shuts down. Attribution uses the Partner API for installs and revenue, plus GA4 and BigQuery, which is how Mantle did it. It is free at $0 a month for unlimited apps, with no caps. The money is a 20% cut of what you pay affiliates that the Affilitrak marketplace introduced you to.",
    watch: "The pitch is \"same tracking as Mantle\" and \"built on Mantle's tracking infrastructure\", which is Affilitrak's claim about itself, not one Mantle makes. Mantle's own wind-down page lists it beside Shoffi, PartnerDock and Orbit as one of four places to go, with no partnership, no data handover and no preference stated. So ask what that infrastructure claim actually means before you give it your attribution. The brand also covers two products, and the numbers on affilitrak.com belong to the other one, the merchant affiliate app on the Shopify App Store. Those are 1,000 stores, 10,000 referrals tracked and a 5.0 from 200 ratings, and nothing on the app vendor page says how many vendors run a program here. Free is not settled pricing either: the 20% on marketplace affiliates is announced but not charged yet. That marketplace is the only thing that earns, so an introduction from it is a sale, not a recommendation. No company or person is named anywhere on the site, and the link to Beckett Oliphant comes from his own launch announcement, not from the site.",
    social: {},
  },
  {
    id: "partnerdock", name: "PartnerDock", cat: "partner", domain: "getpartnerdock.com",
    url: "https://getpartnerdock.com", price: "Free, then $19 / $49 / $99", free: true, verified: true,
    ownership: { id: "thesaashub", name: "TheSaaSHub" },
    launched: "unknown", /* not stated on its own site (checked 2026-10-23) */
    updated: "2026-10-16",
    tags: ["affiliate", "referral", "commission", "payout", "attribution", "mantle", "migration", "cheap"],
    one: "Affiliate tracking with a software fee, not a cut of revenue.",
    note: "No revenue caps, 0% commission on payouts and unlimited affiliates on every plan. Click-to-install matching uses the Shopify Partner API and GA4. It has a branded signup page and PayPal mass-payout CSV export. It offers a hands-on migration call, not a self-serve importer.",
    watch: "Very new, and the site is built as a Mantle migration funnel. Ask how many live programs they actually run before trusting it with attribution.",
    social: { x: "https://x.com/thesaashub" },
  },
  {
    id: "shoffi", name: "Shoffi", cat: "partner", domain: "shoffi.app",
    url: "https://shoffi.app", price: "Free until $100/mo referred", free: true, verified: true,
    launched: "2021", /* shoffi.app: "2021 Since" (checked 2026-10-23) */
    updated: "2026-10-13",
    tags: ["affiliate", "referral", "marketplace", "commission", "attribution", "network", "agency"],
    one: "The largest affiliate network aimed at Shopify apps.",
    note: "Claims 18,000 affiliates, 60,000 referrals and $25M referred revenue since 2021. Tracking uses the Shopify Partner API and GA4, with no code. It has a marketplace where affiliates browse programs, branded signup pages and payment tracking.",
    watch: "One developer publicly reported 16 affiliates and 3 attributed clicks over several months on the marketplace. Shoffi's own rep admitted it is a tool, not a growth guarantee. Judge the tracking, and give the marketplace less weight.",
    social: { x: "https://twitter.com/ShoffiHQ", li: "https://www.linkedin.com/company/shoffi-shopify-apps-affiliate-platform/" },
  },
  {
    id: "partnerjam", name: "PartnerJam", cat: "partner", domain: "partnerjam.com",
    url: "https://www.partnerjam.com", price: "Free", free: true, verified: false,
    launched: "unknown", /* not stated on its own site (checked 2026-10-23) */
    updated: "2026-10-13",
    tags: ["affiliate", "referral", "free", "attribution", "cookie-independent", "partner api"],
    one: "Free, cookie-independent, direct Partner API integration.",
    note: "Built by Digismoothie, who make Candy Rack, after they failed to find a platform they liked. They became their own first customer. Cookie independence matters here, because install attribution through the App Store breaks normal cookie chains.",
    watch: "Free products from app vendors can quietly go unmaintained. Check the changelog before committing a program to it.",
    social: { li: "https://www.linkedin.com/company/partnerjam/" },
  },
  {
    id: "orbit", name: "Orbit", cat: "partner", domain: "marmeto.com",
    url: "https://marmeto.com/orbit",
    ownership: { id: "marmeto", name: "Marmeto", verb: "part of", note: "Part of the Marmeto partner suite." },
    price: "Free for Marmeto partners", free: true, verified: true,
    launched: "unknown", /* not stated on its own site (checked 2026-10-23) */
    updated: "2026-10-13",
    tags: ["partner", "prm", "onboarding", "commission", "leads", "white-label", "portal", "agency"],
    one: "Partner onboarding, leads, commissions and white-label portals.",
    note: "Closer to a PRM than a pure affiliate tracker. It onboards partners, receives leads from them and pays commissions. White-label partner portals carry your branding. Marmeto claims 3x faster partner onboarding.",
    watch: "Marmeto publishes a comparison of Orbit against every rival, and it recommends Orbit, as expected. Useful as a list of features, not as a verdict.",
    social: {},
  },
  {
    id: "krutva", name: "Krutva", cat: "partner", domain: "krutva.com",
    url: "https://www.krutva.com", price: "Not published", free: false, verified: false,
    launched: "unknown", /* not stated on its own site (checked 2026-10-23) */
    updated: "2026-10-13",
    tags: ["prm", "partner", "relationship", "commission", "channel"],
    one: "Partner relationship management, named in community threads.",
    note: "Developers raised it as a PRM option alongside the affiliate trackers when the Mantle replacement question came up. It is the more complex kind of tool: relationship and channel management, not link tracking.",
    watch: "The least evidence of any listing in this directory. Confirm it is still in business and actually serves Shopify app vendors before spending time on it.",
    social: { li: "https://www.linkedin.com/company/krutva/" },
  },

  {
    id: "partnerstack", name: "PartnerStack", cat: "partner", domain: "partnerstack.com",
    url: "https://partnerstack.com", price: "Not published", free: false, verified: true,
    ownership: { id: "appdirect", name: "AppDirect" },
    shopifyExclusive: false,
    launched: "unknown", /* not stated on its own site (checked 2026-10-23) */
    updated: "2026-10-13",
    tags: ["prm", "partner", "affiliate", "referral", "co-sell", "influencer", "commission", "payout", "network", "b2b saas"],
    one: "A full B2B partner program platform, not built for Shopify but used from it.",
    note: "Recruitment, onboarding, tracking and payouts for affiliate, referral, co-sell and influencer programs. It has a marketplace it says carries 131,000+ active partners, so you can recruit there instead of starting from zero. It adds full-funnel reporting, automated commission payouts across partner types, and lead submission from email and Slack. Published network figures are $4M+ in sales a day, 33,000+ referred customers a day and $606K+ a day paid out in commissions. That is across 600+ enterprise customers, with onboarding quoted at 30 to 45 days. Owned by AppDirect.",
    watch: "Nothing here knows what a Shopify app is. There is no Partner API connection, no install attribution and no App Store anything. So a Shopify vendor wires it up by hand and pays enterprise prices, while the cheap, native equivalents are two rows up in this category. Pricing is not published at all. It is set per program during a demo, so you cannot compare it with PartnerDock or Shoffi without booking a sales call first. The 30 to 45 day onboarding is their own number, and it tells you what kind of company this is sold to. It is listed because an app vendor selling to agencies and enterprise partners at scale does eventually outgrow a link tracker. This is the platform they end up looking at.",
    social: {},
  },

  /* ---- Store databases ---- */
  {
    id: "storeleads", name: "Store Leads", cat: "storedb", domain: "storeleads.app",
    url: "https://storeleads.app", price: "$75 / $250 / $450 / $950 per month", free: false, verified: true,
    launched: "unknown", /* not stated on its own site (checked 2026-10-23) */
    updated: "2026-10-13",
    tags: ["leads", "prospecting", "database", "hubspot", "crm", "enrichment", "install history", "displacement", "api", "export"],
    one: "13.7M stores, app install and uninstall history, HubSpot native.",
    note: "3,027,144 Shopify stores of 13,727,714 total across 409 platforms. 8,127 apps tracked, weekly updates and 60 search filters. The most useful data is not in the headline. It is the date of each app install, a historic changelog of installs and uninstalls, and estimated monthly app spend. Its own docs suggest correlating churn with a competitor's app install. Run by Lochside Software in Victoria, BC.",
    ratings: [
      { source: "G2", score: 4.9, outOf: 5, count: 22, url: "https://www.g2.com/products/store-leads/reviews", captured: "2026-09-15" },
    ],
    watch: "This works against you too. The same changelog makes your own install and uninstall curve visible to any competitor on a $250 plan.",
    social: { li: "https://www.linkedin.com/company/storeleads/" },
  },
  {
    id: "storecensus", name: "StoreCensus", cat: "storedb", domain: "storecensus.com",
    url: "https://www.storecensus.com", price: "Free plan, then $49 / $99", free: true, verified: false,
    ownership: { id: "dark-ecommerce-labs", name: "Dark Ecommerce Labs" },
    launched: "2024", /* www.storecensus.com/about: "In late 2024 ... StoreCensus was born" (checked 2026-10-23) */
    updated: "2026-10-13",
    tags: ["leads", "prospecting", "database", "contacts", "apollo", "export", "cheap", "free", "displacement", "outreach"],
    one: "Cheaper store database with decision-maker contacts built in.",
    note: "4M+ Shopify and WooCommerce stores, filtered by platform, category, revenue band, country and installed apps, with 8,500+ app install detection. Founder and CMO contacts are built in, SMTP-verified. It pushes to Apollo, Instantly and SmartLead. It has a dedicated flow for app developers: pick a competitor app, export the stores running it, send outreach.",
    watch: "Same company as AppJubilee. Its whole position is 'cheaper than Store Leads', and narrower coverage is the trade-off. Test the free plan against a segment you know well.",
    social: {},
  },

  {
    id: "storeinspect", name: "StoreInspect", cat: "storedb", domain: "storeinspect.com",
    url: "https://storeinspect.com", price: "Free tier, then $99 / $249 / $599 a month", free: true, verified: true,
    launched: "unknown", /* not stated on its own site (checked 2026-10-23) */
    updated: "2026-10-31",
    tags: ["store database", "leads", "contacts", "apps installed", "themes", "pixels", "traffic", "shopify plus", "export", "api", "mcp", "chrome extension"],
    one: "Shopify store database, filtered by the apps each store already runs.",
    /* Prices, counts and the MCP server read from storeinspect.com/pricing,
       its homepage and /llms.txt on 2026-10-31. A description edited on the
       site overrides this note in production; see the finding for the text. */
    note: "A searchable database of Shopify stores and their contacts, 2.4M+ stores and 2.9M+ contacts by its own count. It filters by apps installed, theme, pixels, category, country, traffic and Shopify Plus status. For an app vendor, that is a prospect list built from a competitor's install base. Free gives 10 contact reveals a month, 50 results per search and one saved list of 25 stores, with no export, API or MCP. Pro is $99 a month for 1,000 reveals, 10,000 store exports, CSV, the API and a hosted MCP server. Business is $249 for 3,000 reveals and 100,000 exports with unlimited results. Scale is $599 for 10,000 reveals and 500,000 exports. Yearly billing is 20% less. The MCP server connects Claude, ChatGPT, Cursor and Codex to the same data. Detection runs a headless browser over each storefront, and the site says the sources are public only.",
    watch: "Nobody is named. There is no company, no founder and no location, and a support address is the whole contact page. That is a lot of trust to give a vendor selling you millions of merchants' contact details. Treat the contact side as your own compliance question. The site says the data is public. That is not the same as saying an outreach campaign built on it is lawful where you or the merchant are. The store counts are self-reported and disagree: 1.9M, 2.3M and 2.4M on its own pages in the same week. The refresh cadence is described as regular without a number, so how current any single record is cannot be checked from outside.",
    social: { li: "https://www.linkedin.com/company/110146091", x: "https://x.com/StoreInspect" },
  },

  {
    id: "alertcommerce", name: "Alert Commerce", cat: "storedb", domain: "alertcommerce.com",
    url: "https://alertcommerce.com", price: "14-day trial, then $199/mo", free: false, verified: true,
    launched: "unknown", /* not stated on its own site (checked 2026-10-23) */
    updated: "2026-10-13",
    tags: ["signals", "alerts", "intent", "leads", "prospecting", "contacts", "displacement", "churn", "reviews", "uninstalls", "plus", "hiring", "ads", "outreach", "pipeline"],
    one: "Buying-signal alerts on Shopify stores, with the contact attached.",
    note: "Watches live Shopify stores for the moment a merchant might switch. It watches for a competitor app installed or uninstalled, a new one or two star review on a rival app, or an upgrade to Shopify Plus. It also watches for role-level hiring and a Meta ad launch. Each event arrives scored. It comes with the store's plan, GMV band and detected app stack, and a decision-maker's name, role and verified email. An AI assistant drafts outreach from any alert, and a built-in pipeline tracks the lead from new to won. One plan, unlimited seats, no per-lead fees.",
    watch: "Its scale figures differ between its own pages: 1M+ stores on About and 1.5M+ on Pricing, 1M contacts on one and 800K+ on the other. It calls itself a private beta while charging $199 a month, with a card required to start the trial. It names no founder or team beyond operators who have sold Shopify apps. It gives no address or jurisdiction for Alert Commerce, Inc. Every alert gives you a named person's email for outreach they did not ask for. So the consent question is yours, not theirs.",
    social: {
      linkedin: "https://www.linkedin.com/company/alertcommerce",
      x: "https://x.com/AlertCommerce",
    },
  },

  {
    id: "builtwith", name: "BuiltWith", cat: "storedb", domain: "builtwith.com",
    url: "https://builtwith.com", price: "Free lookups, then $295 / $495 / $995 a month", free: true, verified: true,
    ownership: { id: "builtwith-founders", name: "Andrew Rogers and Gary Brewer" },
    shopifyExclusive: false,
    pricingUrl: "https://builtwith.com/plans",
    launched: "2007", /* builtwith.com/about: "Founded in 2007, BuiltWith" (checked 2026-10-23) */
    updated: "2026-10-13",
    tags: ["technology lookup", "tech stack", "leads", "prospecting", "migration", "woocommerce", "bigcommerce", "historical", "api", "general"],
    one: "Technology lookup for any site on the web, Shopify or not.",
    note: "A technology index, not a Shopify database. By its own count it tracks 127,605 internet technologies, with 20 years of adoption history, 26M ecommerce sites and 6,672,791 live Shopify sites. It counts Shopify Plus at 115,773 and Shopify B2B at 33,291. What it gives an app vendor that Store Leads and StoreCensus cannot is coverage outside Shopify. It finds merchants running WooCommerce, BigCommerce, Magento or Salesforce Commerce, which is the migration conversation, and the one segment a Shopify-only database cannot show by design. It also reads a prospect's whole stack, not only what is installed on the store. That covers the ESP, the analytics, the payment processor, the CDN and the ad pixels. The free account does single-site lookups forever, with no expiry, which covers checking one prospect before a call. Lists, exports and the API need a plan. BuiltWith Pty Ltd in Sydney, independent of everything else in this directory.",
    watch: "Its Shopify detail stops one level above where an app vendor works. Its own Shopify page breaks the platform into products and more than 40 themes, and lists no individual app detection anywhere. This category exists for one question: which stores run my competitor. Store Leads answers it with 8,127 tracked apps and install dates, and this does not appear to answer it at all. Price is the other half: $295 a month is the floor, against $75 for Store Leads and $49 for StoreInspect Pro. That tier buys 2 technologies, 2 keywords and 2 reports, unlimited anything starts at $495, and a second seat at $995. There is no free trial either, only the permanent single-site lookup, so there is no way to test a segment at volume before paying. Buy it for the merchants who are not on Shopify yet: everything it does inside Shopify is cheaper and deeper two rows up.",
    social: {
      li: "https://www.linkedin.com/company/builtwith",
      x: "https://x.com/builtwith",
      gh: "https://github.com/builtwith",
    },
  },

  {
    id: "cartinsight", name: "CartInsight", cat: "storedb", domain: "cartinsight.io",
    url: "https://www.cartinsight.io", price: "$0.083 a lead, on download tiers from 250 to 10,000 a month. Free account to start", free: true, verified: true,
    ownership: { id: "ready-innovations", name: "Ready Innovations Inc." },
    pricingUrl: "https://www.cartinsight.io/cartinsight-pricing/",
    launched: "unknown", /* not stated on its own site (checked 2026-10-23) */
    updated: "2026-10-13",
    tags: ["leads", "prospecting", "database", "contacts", "crm", "hubspot", "salesforce", "pipedrive", "export", "marketplaces", "woocommerce", "bigcommerce"],
    one: "Store database priced by the lead rather than by the seat.",
    note: "524,047 stores by its own count on 23 August 2026. That is 392,849 Shopify, 74,191 WooCommerce, 23,106 BigCommerce and 19,834 Magento, plus Amazon, Etsy, eBay and Walmart sellers and about fifteen smaller carts. It includes 75,000+ human-researched contacts, payment and shipping provider detection, traffic ranking, store category and offline-store tagging. It pushes to HubSpot, Salesforce, Pipedrive, Copper, Insightly and Capsule, with a Chrome extension and a Gmail extension. The pricing model is the unusual part. You buy downloads, not seats, from 250 to 10,000 a month at a stated $0.083 a lead. A free account reaches the whole database before you pay anything.",
    watch: "It does not visibly answer the question an app vendor buys this category for. Its plugin directory catalogs 9,781 Shopify apps, but that is a list of apps. Nothing on the public site shows the reverse lookup, which stores run a given app, that Store Leads sells with 8,127 tracked apps and install dates. Check it on the free account before anything else. Contacts are also far fewer than stores, 75,000 against 524,047, so most rows arrive with no person attached. Ownership is stated two ways on its own pages, as a business of Ready Innovations Inc., and as a product of Ready, a business of Better Industries Inc., at the same Dover, Delaware mailing address. The Team link in its own footer is dead.",
    social: { x: "https://x.com/CartInsight_io", li: "https://www.linkedin.com/company/cartinsight/" },
  },
  {
    id: "etailinsights", name: "etailinsights", cat: "storedb", domain: "etailinsights.com",
    url: "https://www.etailinsights.com", price: "Not published. Quoted on an order form, with 3% added to card payments", free: false, verified: true,
    shopifyExclusive: false,
    launched: "unknown", /* not stated on its own site (checked 2026-10-23) */
    updated: "2026-10-13",
    tags: ["leads", "prospecting", "database", "contacts", "retailers", "technographics", "crm", "general", "enterprise"],
    one: "Retailer contact database, sold through a demo rather than a signup.",
    note: "500,000+ online retailers, 750+ technologies tracked and 190,000+ verified contacts by its own count. It claims more than 1,000 customers and has CRM integration. It is a retail intelligence database, not a Shopify one. It watches the commerce stack: the platform, the email service provider, the payment processor. It is sold to anyone selling to ecommerce brands, not to this ecosystem in particular. Etailinsights, Inc., a North Carolina corporation, in Cary.",
    watch: "Nothing about the price is published. There is no pricing page, and both calls to action are a demo request or a trial signup. The terms put the figure on an order form and add 3% to card payments. That looks like an annual contract, not a card and a login. Coverage is the bigger question: 750 technologies is platform and stack level. Nothing on the public site shows detection of individual Shopify apps. So it is not shown to answer the question this category exists for: which stores run my competitor. It is worth listing only as a contact database for retail brands, some of which happen to be on Shopify.",
    social: {
      li: "https://www.linkedin.com/company/etailinsights/",
      x: "https://x.com/etailinsights",
      yt: "https://www.youtube.com/channel/UCTuTUIEbqkT_c2kRaIYuWGA",
    },
  },
  {
    id: "ecdb", name: "ECDB", cat: "storedb", domain: "ecdb.com",
    /* A general tool, added on request (2026-10-17) as a store database like
       Store Leads: retailer revenue rankings across every platform. ecdb.com
       did not respond when this was written, so verified stays false and the
       figures are the ones read for the ECDB newsletter entry. It sits on the
       Needs verifying panel until somebody reads the site. */
    url: "https://ecdb.com", price: "€675 / €975 / €1,975 a month, billed annually", free: false, verified: false,
    shopifyExclusive: false,
    /* Clears the stored price override on deploy (lib/overrideClears.js). */
    clearOverride: { fields: ["price"], at: "2026-10-31", reason: "\"From $450,000\" was stored as the price. ECDB publishes plans from \u20ac675 a month, read on ecdb.com/pricing 2026-10-31." },
    launched: "2022", /* ecdb.com/about-us: "In 2022 ... founded ECDB" (checked 2026-10-23) */
    updated: "2026-10-31",
    tags: ["market data", "revenue estimates", "retailers", "rankings", "categories", "countries", "growth", "general", "enterprise"],
    one: "Revenue estimates and rankings for online retailers on every platform, from a market data company.",
    note: "A market intelligence platform built on revenue estimates for each store. By its own count it covers 56,000+ retailers in 150+ countries and 250+ product categories, ranked by net sales with growth trends. The data comes from transaction analytics, web traffic and crawling of retailer sites. For an app vendor the use is sizing which merchant categories and countries are growing. It also finds the large retailers in them, on Shopify or not. The same company publishes the free ECDB newsletter listed here.",
    watch: "A general ecommerce data product, not a Shopify one. Nothing published shows it can tell which apps a store runs, which is the question Store Leads and StoreCensus answer. The revenue figures are modeled estimates. Its 56,000 retailers are a small slice of the stores on Shopify alone, so it suits large merchants, not the long tail. Plans start at €675 a month, billed annually with VAT on top, which is far above anything else in this category.",
    social: {},
  },
  {
    id: "techleads", name: "TechLeads", cat: "storedb", domain: "techleads.fyi",
    /* A general tool, added on request (2026-10-18) as a store database like
       Store Leads. Its free domain lookup and Chrome extension are the store
       detector's job too, so it is also filed there. */
    alsoIn: ["detect"],
    url: "https://techleads.fyi", price: "Free lookups. Lists from $29 per technology, Growth $79/mo ($49/mo yearly), Business $149/mo ($119/mo yearly)", free: true, verified: true,
    shopifyExclusive: false,
    ownership: { id: "mehboob-shaikh", name: "Mehboob Shaikh" },
    pricingUrl: "https://techleads.fyi/pricing",
    launched: "unknown", /* not stated on its own site (checked 2026-10-23) */
    updated: "2026-10-18",
    tags: ["technographics", "leads", "store lists", "shopify", "shopify apps", "lookup", "chrome extension", "api", "csv", "general"],
    one: "Lists of websites by the technology they run, Shopify stores included, from $29 a list.",
    note: "A technographics database: search a technology and download the websites that use it, or look up one site's stack for free. By its own count it tracks 12,000+ technologies across 450M+ websites, with 3,057,658 Shopify stores and a Shopify apps category. A list for one technology is $29 once, as a CSV. Growth is $79 a month, or $49 a month paid yearly, with exports, an API and alerts. Business is $149 a month, or $119 paid yearly. There is a Chrome extension for checking a store as you browse.",
    watch: "Built for any technology, not for Shopify apps. Its Shopify apps category lists 155 apps, a small part of the App Store, so most competitors you look up will not be detected. Its own Store Leads comparison says to stay on Store Leads for app and install depth. It is one founder's company in Mumbai, under Indian law. Its terms forbid using the data beyond your own business without a separate licence.",
    social: {
      li: "https://linkedin.com/company/techleads-fyi",
      x: "https://x.com/techleads_fyi",
      gh: "https://github.com/techleads-fyi",
      yt: "https://www.youtube.com/@techleadsfyi",
    },
  },

  {
    id: "storeradar", name: "StoreRadar", cat: "storedb", domain: "storeradar.co",
    url: "https://storeradar.co", price: "$99 one-time for 500 stores, then $299 or $699 a month", free: false, verified: true,
    launched: "unknown", /* not stated on its own site (checked 2026-10-23) */
    updated: "2026-10-13",
    tags: ["leads", "prospecting", "database", "contacts", "app gap", "icp", "outreach", "csv", "gdpr", "agency", "enrichment"],
    one: "Describe an offer and get a matched CSV, not a database to search.",
    note: "It sells the output of a store database, not the database. You fill in two plain-English fields: what you sell and who you sell to. An agent scores 400,000+ live Shopify storefronts against them, and only matched rows come back, as a CSV by email in minutes. Each row carries the domain and store name, a Shopify-native vertical, catalog signals like product count and average price, and a tech stack fingerprint. It also has an internal SEO score and a contact address from the store's own contact, about or policy pages, ranked personal, then business, then support. For an app vendor the point is finding stores that lack an app, not stores that have it: stores running Klaviyo with no loyalty app, or Recharge with no review tool. $99 buys one list of 500 stores. Then it is $299 a month for 1,500 distinct stores a cycle, or $699 for 5,000, and a repeat inside a cycle is not charged twice. StoreRadar Limited, company number 15771343, registered in England and Wales. The site has a DPA and a stated UK GDPR legitimate-interest basis for the contact data.",
    watch: "You get less coverage in return for the convenience: 400,000 storefronts, against Store Leads' 3 million Shopify records and StoreInspect's 1.4 million. The app detection on show is a handful of large apps, Klaviyo, Yotpo, Judge.me, Loox and Recharge, where Store Leads tracks 8,127 apps with install dates. So this category's main question, which stores run my competitor, can be answered here only if your competitor is big enough to be fingerprinted. You also cannot look before you buy: there is no searchable account, delivery is a CSV by email, the API is still on the roadmap, and the $99 sample is the trial. Nobody is named anywhere. The revenue bands are a catalog-based estimate calibrated on licensed Similarweb traffic, not observed figures, and their own footnote admits this. The Independent profiles row on the homepage links to Capterra, LaunchFree, TheSaaSDir and three more listing sites, which are submissions, not assessments. The founding rate locked for ten seats shows the pricing is not settled yet.",
    social: { li: "https://www.linkedin.com/company/storeradar/" },
  },

  {
    id: "ecomaudience", name: "EcomAudience", cat: "storedb", domain: "ecomaudience.com",
    url: "https://ecomaudience.com", price: "$4 per opt-in, $100 minimum top-up", free: false, verified: true,
    ownership: { id: "idube", name: "Idube Pte. Ltd. (Claus Lauter, Ecommerce Coffee Break)" },
    shopifyExclusive: false,
    launched: "unknown", /* not stated on its own site (checked 2026-10-23) */
    updated: "2026-10-13",
    tags: ["leads", "prospecting", "contacts", "co-registration", "newsletter", "opt-in", "outreach", "general"],
    one: "Pay per opted-in merchant email, collected when someone joins an ecommerce newsletter.",
    note: "Co-registration. People who sign up to the Ecommerce Coffee Break newsletter see a short list of partner offers. Anyone who clicks yours becomes an opt-in, delivered as a verified email. Name, role, store URL and platforms are included when they chose to share them. A week of reminder emails pointing at your landing page is included. $4 per opt-in from prepaid credit, with a $100 minimum top-up. Duplicates, invalid addresses and bounces are refunded. App developers are named among the intended buyers.",
    watch: "Not a Shopify audience. The audience is one newsletter's new signups: Amazon sellers, DTC founders and general online business owners alongside Shopify merchants. The platform is only known when the subscriber volunteers it. So you pay the same $4 for someone who will never install an app. Volume is capped by that newsletter's growth: 1,500 to 2,000 new subscribers a month by its own count, partly from paid acquisition. The cost per customer and LTV figures on the pricing page are its own illustrations. The opt-in is one click on a post-signup page, and what happens after it is outside anything they track.",
    social: {},
    draft: true,
  },

  /* ---- Detectors ---- */
  {
    id: "shopscan", name: "ShopScan", cat: "detect", domain: "shopscan.app",
    url: "https://www.shopscan.app", price: "Free, API paid", free: true, verified: true,
    launched: "2024", /* www.shopscan.app/blog/about-us/: "In 2024 ... so we built ShopScan" (checked 2026-10-23) */
    updated: "2026-10-13",
    tags: ["detector", "theme", "apps", "free", "extension", "chrome", "scraper", "revenue estimate"],
    one: "App and theme detector with a wide free tool set.",
    note: "Claims data on 2,000+ apps. Beyond detection it has a revenue checker, traffic checker, store analyzer, product scraper and fees calculator. Chrome, Firefox and Edge extensions. Named first in the community thread on detecting which apps a store runs.",
    watch: "Monetized through affiliate links and a Shopify referral offer, so the surrounding recommendations are not neutral.",
    social: { x: "https://x.com/shopscan_app", li: "https://www.linkedin.com/company/shopscan-app/" },
  },
  {
    id: "welookup", name: "WeLookup", cat: "detect", domain: "welookup.info",
    url: "https://welookup.info", price: "Free", free: true, verified: true,
    logo: "/logos/welookup.jpeg",
    launched: "unknown", /* not stated on its own site (checked 2026-10-23) */
    updated: "2026-10-13",
    tags: ["detector", "apps", "free", "extension", "chrome", "store insights"],
    one: "Extension-first store analysis, 7,548 apps and tools.",
    note: "The broadest claimed detection coverage of the free detectors. It adds an information tab with Shopify store insights. Search exists but is still in beta. The extension is the product.",
    watch: "Small and new, version 1.0.0 at time of checking. Like every detector, it only sees apps with a storefront presence.",
    social: { li: "https://www.linkedin.com/company/welookupinfo/" },
  },
  {
    id: "copyfy", name: "Copyfy Apps Detector", cat: "detect", domain: "copyfy.io",
    url: "https://www.copyfy.io/en/tools/shopify-apps-detector", price: "Free, no sign-up", free: true, verified: true,
    launched: "unknown", /* not stated on its own site (checked 2026-10-23) */
    updated: "2026-10-13",
    tags: ["detector", "apps", "free", "no signup", "web", "dropshipping"],
    one: "Paste a store URL and get its storefront apps, free and without an account.",
    note: "A web page, not an extension. It loads a store's homepage and one product page, confirms the store is on Shopify, and lists the apps whose code it finds there. Results are grouped by category, with a link to each vendor: reviews, upsell, email and SMS, page builders, loyalty, subscriptions, bundles and similar. It is one of a set of free tools, with a theme detector and a catalog exporter beside it. They come from Copyfy, a product and ad research platform for dropshippers run by Innovify LLC, a US company.",
    watch: "One store at a time and two pages deep. So it answers what a store runs, never which stores run your competitor. A run on allbirds.com returned five apps. No list of detectable apps is published. It exists to sell the Copyfy subscription to dropshippers. The 29,870+ sellers and 4.8 rating on the page are its own figures.",
    social: { li: "https://www.linkedin.com/company/copyfyio/" },
  },
  {
    id: "shopthemedetector", name: "Shopify Theme Detector", cat: "detect", domain: "shopthemedetector.com",
    url: "https://shopthemedetector.com", price: "Free", free: true, verified: true,
    ownership: { id: "ok-digital", name: "OK Digital LTD" },
    launched: "2017", /* shopthemedetector.com/about: "since 2017" (checked 2026-10-23) */
    updated: "2026-10-18",
    tags: ["detector", "theme", "apps", "free", "extension", "chrome", "speed", "app spend", "statistics"],
    one: "A free theme and app detector for one store at a time, with usage counts across its scans.",
    note: "Paste a store URL to get its theme with version, price and demo link, and the apps visible in its public code. Theme speed comes from Google's field data. Each scan is set against its dataset of 3.5M+ stores, 33,518+ apps and 9,959+ themes, by its own count. So it shows how common a theme or app is. Scans now also list each app's price and an estimate of the store's monthly app spend. There are statistics pages and a Chrome extension, in six languages.",
    watch: "Built for merchants copying a competitor's store, not for app vendors. It answers what one store runs, not which stores run an app. Some of its links are affiliate links, including a Shopify sign-up banner, which it says keeps the site free. The dataset figures are its own, and the monthly app spend is an estimate.",
    social: {},
  },
  {
    id: "sellercenter", name: "SellerCenter", cat: "storedb", domain: "sellercenter.io",
    /* Two jobs from one provider, one row: the store database is what an app
       vendor pays for, and the free single-store app detector sits on the
       detector shelf beside it. */
    alsoIn: ["detect"],
    url: "https://sellercenter.io/shopify-seller-center", price: "100 free credits a month, then $9.99 / $29.99 / $99.99 a month, half that billed yearly", free: true, verified: true,
    ownership: { id: "handhunt", name: "HANDHUNT HONGKONG LIMITED" },
    pricingUrl: "https://sellercenter.io/pricing",
    launched: "unknown", /* not stated on its own site (checked 2026-10-23) */
    updated: "2026-10-13",
    tags: ["database", "store database", "detector", "apps", "leads", "prospecting", "csv", "export", "sales estimate", "dropshipping", "free", "no signup"],
    one: "Dropshipper research platform with a 2.4M-store Shopify database and a free app detector.",
    note: "A searchable database of 2.4M+ Shopify stores by its own count. It filters by keyword, age, and whether a store advertises, has apps installed or shows an email. Each store has a detail page covering products, estimated sales, traffic, ads and apps, and paid plans have CSV export. Beside it is a free web detector, with no account, that lists the apps on any one store. Credits meter everything: 100 a month free, then Basic $9.99, Pro $29.99 and Expert $99.99 a month for 10,000, 50,000 and 200,000. Yearly billing is half that. A 20-row search costs 20 credits, and exporting 10 rows costs 20. Run by HANDHUNT HONGKONG LIMITED, and its subscription terms call the product EHunt.",
    watch: "It is not shown to answer the question this category exists for: which stores run my competitor. The app filter is a checkbox for whether a store has apps installed, not a choice of which app. The detector reads one store at a time, with no published method or app list. Every search shows at most 300 results on the free and Basic plans, and 1,000 on Expert. Free accounts cannot export. Sales and traffic are estimates with no method attached. It is built and priced for dropshippers. Refunds are limited to the first purchase within 24 hours.",
    social: { yt: "https://www.youtube.com/@sellercenter-dropship" },
  },
  {
    id: "winninghunter", name: "Winning Hunter", cat: "storedb", domain: "winninghunter.com",
    url: "https://winninghunter.com", price: "$49 / $79 / $249 a month, 15% off quarterly, 40% off yearly", free: false, verified: true,
    launched: "unknown", /* not stated on its own site (checked 2026-10-23) */
    updated: "2026-10-13",
    tags: ["database", "store database", "apps", "installed apps", "revenue estimate", "ad spy", "api", "mcp", "dropshipping", "store tracker"],
    one: "Ad spy platform whose store explorer filters 5M+ stores by installed app.",
    note: "Built for dropshippers and brands researching ads and products across Meta, TikTok and Pinterest. A Shopify Store Explorer sits underneath. Its own API reference documents a store_apps filter that matches installed app names. It also filters by theme, product category, language, store creation date and revenue. So which stores run my competitor is a question it can answer. Basic is $49 a month, Standard $79 and Enterprise $249, and the store explorer is listed on Standard and above. An HTTP API and an MCP server use the same key, with 20,000 calls a month from Standard. Winninghunter LLC, registered in Dubai.",
    watch: "The store side is what you would pay for, and it is the least documented part. The app filter is a substring match on app names. There is no published count of apps it recognizes, or of how often a store is rescanned. The revenue figures are estimates with no method attached. Everything else is priced for ad research you will not use. The 500k+ users and 5M+ stores are its own figures. There is a free trial that takes no card. So the app filter can be tested against a competitor whose installs you already know before paying.",
    social: {},
  },

  {
    id: "koalainspector", name: "Koala Inspector", cat: "detect", domain: "koala-apps.io",
    url: "https://koala-apps.io/koala-inspector/", price: "Free, 15 checks a month. Premium $22/mo, token packs from $3.99", free: true, verified: true,
    /* Clears the stored price override on deploy (lib/overrideClears.js). */
    clearOverride: { fields: ["price"], at: "2026-10-31", reason: "\"From $0\" was stored as the price and hid the $22 Premium plan, read on koala-apps.io/pricing 2026-10-31." },
    launched: "unknown", /* not stated on its own site (checked 2026-10-23) */
    updated: "2026-10-13",
    tags: ["detector", "apps", "theme", "extension", "chrome", "free", "sales estimate", "traffic estimate", "ads"],
    one: "Chrome extension reading a store's apps, theme and estimated numbers.",
    note: "Open a Shopify store and it returns the installed apps, the active theme, the product catalog and its best sellers. It also returns estimated monthly traffic with its sources, estimated monthly sales, and the store's live ad creatives. The free plan is 15 analyses a month and does not expire. Premium is $22 a month for 220 analyses and tracking of up to 50 stores, with one-off token packs from $3.99. One of about ten tools from Koala Apps, alongside separate theme and app detectors, a sales tracker, a store analyzer and a set of calculators.",
    watch: "Monetized by affiliate links, to TikTok, Klaviyo, Zendrop, Printify and NordVPN among others. It also has an affiliate and an ambassador program of its own. So nothing it recommends around the data is neutral. No legal entity, country or person is named anywhere on the site. The sales and traffic figures are estimates published with no method attached. Use them to rank stores, not to quote one.",
    social: { yt: "https://www.youtube.com/@koala-apps" },
  },
  {
    id: "stackpeek", name: "Stackpeek", cat: "detect", domain: "stackpeek.app",
    /* Suggested by email on 2026-10-30 by someone who said they help with
       Stackpeek. Everything below is from stackpeek.app, its privacy and terms
       pages, its GitHub repository and its Chrome Web Store listing. */
    url: "https://stackpeek.app", price: "Free, no account", free: true, verified: true,
    launched: "unknown", /* not stated on its own site; it calls its track record "New" (checked 2026-10-30) */
    updated: "2026-10-30",
    tags: ["detector", "apps", "theme", "trackers", "extension", "chrome", "firefox", "free", "open source", "catalog export"],
    one: "Free browser extension naming a store's theme, apps and trackers, with a catalog export.",
    note: "A Chrome and Firefox extension. Open a Shopify store and click the icon. A side panel names the theme and its version, the apps grouped by type, and the tracking pixels. It counts 885 apps and 329 themes in its database. It also exports the store's public product catalog to CSV in Shopify's import format, up to 10,000 products. The export is built in the browser. The extension's code is on GitHub under the MIT license.",
    watch: "New, with 32 Chrome users at version 0.7.2 when checked, and its own site says so. Only the extension is open source. Each scan sends the store's address and page signals to its server, and the database there is not published. A paid tier is announced. No company or person is named, only registration in Andorra. Like every detector, it only sees apps with code on the storefront.",
    social: { gh: "https://github.com/tonic20/stackpeek-extension" },
  },
  {
    id: "shoperspy", name: "Shoper Spy", cat: "detect", domain: "upsell.com",
    /* The extension has no site of its own: shoperspy.com is a parked domain
       redirecting to /lander, and the listing's website link is the old
       StilyoApps page. So the url is the Chrome Web Store listing, and the
       domain is the developer's, ReConvert Ltd, which now trades as
       Upsell.com (reconvert.io redirects there). Checked 2026-10-30. */
    url: "https://chromewebstore.google.com/detail/shopify-store-spy-shoper/pegiihfbfblmhendfgjmcjnofblcigga",
    price: "Free to install, no paid plan stated", free: true, verified: true,
    ownership: { id: "reconvert", name: "ReConvert Ltd" },
    launched: "unknown", /* not stated on the listing or the developer's site (checked 2026-10-30) */
    updated: "2026-10-30",
    tags: ["detector", "apps", "theme", "extension", "chrome", "free", "products", "best sellers"],
    one: "Chrome extension listing a store's apps, theme and products.",
    note: "A Chrome extension from ReConvert Ltd. Open a Shopify store and it lists the apps and the theme, unless the theme is custom-built. It also reads the store's products: the best sellers, the most and least expensive, the newest additions and the total count. It has 5,000 users on the Chrome Web Store. It is written for merchants watching competitors, so for an app vendor it is a quick look at one store at a time.",
    watch: "Built by ReConvert Ltd, which sells a post-purchase upsell app to Shopify merchants, now as Upsell.com. The listing says it \"may get affiliate commission from installs initiated by the extension\", so the apps it points you to can be paid placements. Its Chrome privacy disclosure lists personal, financial, authentication and communication data, with no reason given. No count of detectable apps is published. Like every detector, it only sees apps with code on the storefront.",
    ratings: [
      { source: "Chrome Web Store", score: 4.8, outOf: 5, count: 60, url: "https://chromewebstore.google.com/detail/shopify-store-spy-shoper/pegiihfbfblmhendfgjmcjnofblcigga", captured: "2026-10-30" },
    ],
    social: {},
  },
  {
    id: "shopifyraise", name: "Shopify Raise", cat: "detect", domain: "findniche.com",
    /* No site of its own. The Chrome Web Store marks the publisher as the
       verified owner of findniche.com, whose terms and privacy policy name
       HANDHUNT HONGKONG LIMITED, which also owns SellerCenter (listed). The
       privacy link on the listing goes to sellercenter.io, and the developer
       email is a Gmail address. Checked 2026-10-30. */
    url: "https://chromewebstore.google.com/detail/shopify-raise-shopify-sto/hdpfnbgfohonaplgnaahcefglgclmdpo",
    price: "Free to install, no paid plan stated", free: true, verified: true,
    ownership: { id: "handhunt", name: "HANDHUNT HONGKONG LIMITED" },
    launched: "unknown", /* not stated on the listing or findniche.com (checked 2026-10-30) */
    updated: "2026-10-30",
    tags: ["detector", "apps", "theme", "extension", "chrome", "free", "products", "sales tracking", "dropshipping", "catalog export"],
    one: "Chrome extension for store analysis: products, live sales, apps and theme.",
    note: "A Chrome extension for dropshippers. On a Shopify store it shows the theme, the best sellers and newest products, and trends by release date, vendor and tag. It exports the product list to CSV in Shopify's import format and downloads the product reviews. Kept open on a store, it counts the sales it can see. It also lists the store's apps. It has 10,000 users on the Chrome Web Store.",
    watch: "App detection is one feature of five, and no list of detectable apps is published. It is built for copying: the export and the review download are meant for importing a competitor's products and reviews into your own store. Same owner as SellerCenter, listed here, which has its own free app detector. The only contact is a Gmail address. Last updated April 2026.",
    ratings: [
      { source: "Chrome Web Store", score: 3.9, outOf: 5, count: 50, url: "https://chromewebstore.google.com/detail/shopify-raise-shopify-sto/hdpfnbgfohonaplgnaahcefglgclmdpo", captured: "2026-10-30" },
    ],
    social: {},
  },
  {
    id: "ppspy", name: "PPSPY", cat: "detect", domain: "ppspy.com",
    /* Underneath the spy tooling is the Shop Explorer: 1M+ stores filterable
       by revenue, keywords and search volume, plus an API. That is a store
       database whichever shelf you find it on. */
    alsoIn: ["storedb"],
    url: "https://www.ppspy.com", price: "Free plan, then $39 / $99 / $299 a month", free: true, verified: true,
    pricingUrl: "https://www.ppspy.com/rank",
    launched: "unknown", /* not stated on its own site (checked 2026-10-23) */
    updated: "2026-10-13",
    tags: ["detector", "spy", "sales estimate", "dropshipping", "store explorer", "traffic", "ads", "api", "extension", "chrome"],
    one: "Dropshipper spy tool, with a store explorer and an API behind it.",
    note: "Built to find winning products. It has fifteen-day sales reports on any store, a product and ad library, an ad tracker and a Chrome extension. By its own count it covers more than 1M active Shopify stores, 200M+ products and 800K+ themes, with app, theme and pixel detection. The useful part here is underneath that: the Shop Explorer, which filters the same store set by revenue, keywords and search volume, and the API. Standard is $39 a month for 30 trackers and 10,000 credits, Pro $99 for 100 and 100,000, and Business $299 for 300 and 500,000. Annual billing is 30% off. There is also a free tier and a trial that takes no card.",
    watch: "It is not built for you, and it is listed for one part of it. Its own homepage says join 130,000+ merchants. The product, the price and the whole library around it are aimed at dropshippers choosing products. So the store explorer comes attached to something else and is priced with it. The order figures are AI predictions, not measured sales, and its own copy says so plainly. So they rank stores and do not report revenue. It names no company, entity or country anywhere on the site. It states that it issues no refunds.",
    social: {},
  },

  /* ---- Suites ---- */
  {
    id: "marmeto", name: "Marmeto", cat: "suite", domain: "marmeto.com",
    url: "https://marmeto.com", price: "Most tools free for approved partners", free: true, verified: true,
    ownership: { id: "marmeto", name: "Marmeto", note: "The suite itself." },
    /* Elevate is app revenue and churn analytics, Orbit is partner programmes
       and commissions. Both are listed here as their own entries and both are
       Marmeto, so the suite belongs in those two categories as well. */
    alsoIn: ["biz", "partner"],
    launched: "unknown", /* not stated on its own site (checked 2026-10-23) */
    updated: "2026-10-13",
    tags: ["suite", "analytics", "partner", "feedback", "logistics", "payouts", "nps", "checkout", "agency", "white-label", "api"],
    one: "Twelve products across the partner side and the merchant side.",
    note: "India's first Shopify Platinum Partner as of July 2026, one of fewer than 100 globally. Founded 2017, and the team behind Return Prime and Recurpay. It moved from services to a product-first company in 2026, which is why the partner tool suite appeared when it did. Six products for partners, apps and agencies: Elevate (app revenue and churn analytics), Orbit (partner programs and commissions), Feedback (visual feedback on any site, free, aimed at agencies), Logistics (one API for courier integrations you resell inside your own SaaS), Payouts (multi-market payout options through a single integration), Pulse (in-app NPS, free). Six more for brands: Vision (ecommerce analytics), Nexus (multi-marketplace), Checkout (Shopify checkout customization), OTP Login, Flow (workflow automation), Bridge (integration automation).",
    watch: "Most of it is free only if you register as a Marmeto partner, which is the actual product. Logistics and Payouts are white-label infrastructure you would resell. That is a different offer from the analytics tools.",
    social: {},
  },
  {
    id: "meridian", name: "Meridian", cat: "suite", domain: "the-meridian.ai",
    url: "https://www.the-meridian.ai", price: "$69 / $169 per app per month", free: false, verified: true,
    /* Billing and a plan builder wired into Shopify Billing, plus an App Store
       analytics and keywords module. Somebody replacing Mantle should find it
       under Analytics & billing, which is the search that brings them here. */
    alsoIn: ["biz", "aso"],
    launched: "unknown", /* not stated on its own site (checked 2026-10-23) */
    updated: "2026-10-23",
    tags: ["suite", "hosting", "billing", "crm", "email", "automation", "sdk", "mcp", "analytics", "lifecycle"],
    one: "Whole app lifecycle: hosting, billing, CRM, email, ASO.",
    note: "The most ambitious of the Mantle replacements. Hosting with webhooks, logs and secrets managed for you. A plan builder wired into Shopify Billing. A CRM built around the stores using your app. Automations, emails, affiliates and reports. App Store analytics, keywords and reviews as one module. One price per app, every feature on every plan, hosting included.",
    watch: "Moving to it means moving your app's hosting, not only your data. A wide product scope from a new team that also runs a Shopify agency. It was in closed early access until October 2026 and now offers a 14-day trial.",
    social: { li: "https://www.linkedin.com/company/the-meridian-ai/" },
  },

  /* ---- Merchant research ---- */
  {
    id: "appstoreresearch", name: "App Store Research", cat: "research", domain: "appstoreresearch.com",
    url: "https://appstoreresearch.com", price: "Free account, from $150 per research call", free: true, verified: true,
    ownership: { id: "shopexperts", name: "ShopExperts" },
    /* Deliberately NOT alsoIn: ["talent"], which an earlier pass had. Talent &
       services is defined as freelance developers and expert marketplaces, for
       hiring and for affiliate partnerships. You cannot hire a research
       participant to build anything, so somebody filtering that category would
       be sent to the wrong shelf. The real connection to ShopExperts is the
       shared owner, which `ownership` already states. */
    launched: "2022", /* appstoreresearch.com/about-us: "foundingDate 2022 (the site's own Organization markup)" (checked 2026-10-23) */
    updated: "2026-10-13",
    tags: ["user research", "customer discovery", "interviews", "panel", "recruitment", "validation", "sales calls", "positioning", "churn"],
    one: "A paid panel of vetted Shopify merchants to book calls with.",
    note: "3,000+ Shopify brands in the network, $1M+ paid to participants, 6,000+ product conversations. You define the merchant profile by role, industry, revenue range and Shopify plan, then vetted operators apply and you approve who you talk to. Scheduling, screening and incentives are handled, and it is used for roadmap validation, switching analysis, pricing and positioning. Transcripts and tagged insights are a paid add-on. Named customers include Loox, Recart, Tresl, ClickPost and MobiLoud. Pricing is published as worked examples, with the incentive and the recruitment fee itemized separately. A product validation interview is $100 incentive plus $65 recruitment, $165 in total, and a Shopify Plus interview is $200 plus $65, $265. A high-intent sales conversation is $300 plus $250, $550. Research calls start at $150 and sales calls at $500, billed only for a completed call, with nothing charged for a cancellation or a no-show. The same company runs ShopExperts and publishes ShopOps Weekly, a free weekly digest of Shopify platform changes written for merchants.",
    watch: "It sells sales calls alongside research calls, and a merchant paid $300 to take one is not the same signal as inbound interest. Those conversations are research with a discount applied, not pipeline. The incentive is also the part that changes. It is adjusted for participant quality, urgency and targeting, with $85 the minimum for a research interview. So the worked examples show how a bill is built up, not a quote for yours. And a paid panel selects itself, like every paid panel. You are hearing from operators who will take $100 to talk for half an hour. That is a different population from the merchants who ignore the invitation.",
    ratings: [
      { source: "REVIEWS.io", score: 5, outOf: 5, count: 72, url: "https://www.reviews.io/company-reviews/store/appstoreresearch.com-2ng54Ax", captured: "2026-09-18" },
      { source: "Trustpilot", score: 4.3, outOf: 5, count: 12, url: "https://www.trustpilot.com/review/appstoreresearch.com", captured: "2026-09-15" },
    ],
    social: { li: "https://www.linkedin.com/company/appstoreresearch/" },
  },
  {
    id: "dtcmvp", name: "dtcmvp", cat: "research", domain: "dtcmvp.com",
    url: "https://dtcmvp.com", price: "Quote only, plus a payment to each brand per call", free: false, verified: true,
    ownership: { id: "garner-labs", name: "Garner Labs LLC" },
    logo: "/logos/dtcmvp.svg",
    /* Read on 2026-10-14: home, pricing, about, faq, platform, solutions,
       for-brands and the Chrome extension page. The legal entity is named on
       the extension page ("Garner Labs LLC dba dtcmvp"). The member, meeting,
       payout and per-client match figures are the vendor's own. */
    launched: "unknown", /* not stated on its own site (checked 2026-10-23) */
    updated: "2026-10-14",
    tags: ["user research", "customer discovery", "expert network", "interviews", "brand operators", "dtc", "validation", "positioning", "feedback calls"],
    one: "Paid feedback calls with established Shopify brands, booked for you.",
    note: "A managed expert network for the technology vendors that sell to Shopify brands. It vets brand operators, matches them to you, books the calls and pays the brand after each one. The calls ask where a product fits: the brand's plans this quarter, how it judges new tools and what a test would take. It says 1,000+ operators are enrolled, 5,000+ paid meetings have run and $1M+ has been paid to members. Named clients include Postscript, Intelligems, Storetasker, Depict and OrderProtection. A client portal shows past and booked calls and the themes from them. Add-ons cover call prep, transcript analysis and co-marketing content.",
    watch: "No price is published. It is invite only, and each client gets a quoted monthly package. Each brand is also paid separately per call, so the full cost is unknown until you apply. The founder built it after leading go-to-market at Tydo, and one homepage testimonial is from Tydo's CEO. The call format and the coaching ask where you fit and what would make a test easy. That is closer to sales discovery than to research. Brands in the network also get its Chrome extension, which labels and filters cold vendor pitches in Gmail.",
    social: { li: "https://www.linkedin.com/company/dtcmvp/", x: "https://x.com/garner_wendt" },
  },

  /* ---- Talent & services ---- */
  {
    id: "storetasker", name: "Storetasker", cat: "talent", domain: "storetasker.com",
    url: "https://www.storetasker.com", price: "Free to get matched, projects from $400", free: true, verified: true,
    /* Clears the stored price override on deploy (lib/overrideClears.js). */
    clearOverride: { fields: ["price"], at: "2026-10-31", reason: "\"Not published\" was stored as the price. Storetasker states projects from $400 on its own site, read 2026-10-31." },
    launched: "unknown", /* not stated on its own site (checked 2026-10-23) */
    updated: "2026-10-13",
    tags: ["freelance", "developers", "designers", "marketers", "hiring", "retainer", "agencies", "app devs", "vetting"],
    one: "Vetted freelance Shopify talent, introduced against a brief rather than browsed.",
    note: "Introductions, not a directory. You describe the work, and Storetasker introduces you to freelancers it thinks fit, usually within a few hours. It says it has reviewed over 15,000 developers, designers and marketers and admits under 5%. It shows 4.9 out of 5 across 1,500+ reviews. The freelancer quotes the work as a fixed project or a monthly retainer. Published examples: $400 for a landing page customization, $475 for theme edits and $2,000 for site speed work. A 30-hour monthly retainer is $3,000, and a branding sprint is $6,000. Two parts matter here. There is a Shopify app developer category next to the theme and marketing talent. And 200+ agencies use it for overflow.",
    watch: "What Storetasker takes is not published anywhere on the site. Pricing is described as coming directly from the experts you hire. That is the freelancer's number, and it says nothing about the platform's margin on top of it. The vetting figures, 15,000 reviewed and under 5% admitted, are self-reported and not checkable. Fine on a fixed-scope project, where the quote does not change. Worth asking about before a long retainer.",
    ratings: [
      { source: "Trustpilot", score: 4.9, outOf: 5, count: 1732, url: "https://www.trustpilot.com/review/storetasker.com", captured: "2026-09-15" },
    ],
    social: { li: "https://www.linkedin.com/company/storetasker/" },
  },
  {
    id: "shopexperts", name: "ShopExperts", cat: "talent", domain: "shopexperts.com",
    url: "https://shopexperts.com", price: "Free to get matched; experts pay to be listed", free: true, verified: true,
    ownership: { id: "shopexperts", name: "ShopExperts", note: "ShopExperts' own marketplace." },
    launched: "2023", /* shopexperts.com/about-us: "2023: HeyCarson ... creating shopexperts (HeyCarson itself 2015)" (checked 2026-10-23) */
    updated: "2026-10-13",
    tags: ["freelance", "agencies", "marketplace", "hiring", "matching", "vetting", "heycarson", "no commission"],
    one: "Hand-matched Shopify experts and agencies, free to the person hiring.",
    note: "Formerly HeyCarson. You describe what is broken and get up to three hand-picked matches to compare, usually within an hour. They come from 205 vetted experts covering agencies, freelancers and consultants. It shows 4.96 across 860 verified client reviews. It claims 56,000+ brands, agencies and app companies matched since 2015, with the top 3% of applicants passing vetting. Hiring costs nothing: no commission, no markup, and you pay the expert directly. Browsing is organized by the problem, not the skill. You can filter by the partner apps an expert works with, Loox, Klaviyo, Judge.me and PageFly among them. The same company runs App Store Research and publishes ShopOps Weekly, a free weekly digest of Shopify platform changes written for merchants.",
    watch: "The side that pays is the expert, not you. A verified listing is free. Verified Pro, at $799 a year or $249 a quarter, buys Official Partner status, lead capture and listing analytics. So a hand-picked match is a ranking somebody can pay for, not a neutral one. The vetting figures, 205 experts and the top 3% of applicants, are self-reported and not checkable from outside.",
    ratings: [
      { source: "Trustpilot", count: 269, url: "https://www.trustpilot.com/review/heycarson.com", captured: "2026-09-15" },
    ],
    social: { li: "https://www.linkedin.com/company/heycarson/" },
  },
  {
    id: "kollectify", name: "Kollectify", cat: "talent", domain: "kollectify.com",
    url: "https://kollectify.com", price: "Content retainers £1,957 and £3,250 a month, SEO and App Store ads support from £1,500. Strategy on enquiry", free: false, verified: true,
    logo: "/logos/kollectify.png",
    launched: "unknown", /* not stated on its own site (checked 2026-10-23) */
    updated: "2026-10-13",
    tags: ["agency", "marketing", "positioning", "app store listing", "aso", "content", "seo", "app store ads", "course", "retainer", "uk"],
    one: "Marketing agency for Shopify apps rather than Shopify stores.",
    note: "A small UK agency in Braunton, Devon, founded by Krissie. It sells marketing to app teams: positioning workshops, App Store listing rewrites and keyword research, App Store ads support, and technical SEO. It also sells monthly content retainers of newsletters, articles, ebooks and case studies. The clients it names are Shopify app companies, Okendo, Klevu, GoodCarts, SparkLayer and FORSBERG+two among them. Beside the agency work it sells a self-paced audio course, Unlock Your Shopify Merchant Magnetism, with worksheets and email support from the founder. Unusually for an agency, the retainers carry published prices.",
    watch: "The strategy packages and the course have no published price. So the work most app teams would start with begins on a sales call. The team page names three people by first name only, and no legal entity appears anywhere on the site. So ask how much capacity sits behind a content retainer. Its own claims do not fit together. The homepage says over 8 years and About says over 9. The course is billed as the world's first and only program of its kind. A 23% traffic and 15% install lift is given with no source.",
    social: { li: "https://www.linkedin.com/company/kollectify/" },
  },

  /* ---- Support & CX ---- */
  /*
   * `noRecommend` is applied here on the editor's instruction, as a
   * conservative default while the section is new. It says nothing about this
   * company: see the block above `recommendable`.
   *
   * `ownership` is deliberately absent. The site's own metadata gives the legal
   * name as "Apricot CX Technologies", which is the brand plus a noun and
   * names nothing a reader did not already have from the card. Invariant 32:
   * an owner is worth stating when it names something else.
   */
  {
    id: "apricotcx", name: "Apricot CX", cat: "support", domain: "acxt.am",
    url: "https://acxt.am", price: "Not published", free: false, verified: true,
    noRecommend: true,
    /* Since the October 2026 redesign the homepage is a two-way choice with
       about 360 characters of text, so the monitor saw the services vanish
       and, correctly, recorded them as not observed rather than removed:
       nothing was reported. The services are described here. */
    changelogUrl: "https://acxt.am/app-developers",
    /* Clients named by the editor on 2026-10-23. acxt.am does not name them. */
    launched: "unknown", /* not stated on its own site (checked 2026-10-23) */
    updated: "2026-10-23",
    tags: ["support", "outsourced", "white-label", "helpdesk", "chat", "24/7", "reviews", "review recovery", "escalation", "qa", "merchant acquisition", "partner network", "listing review", "armenia"],
    one: "Outsourced support, review work and merchant referrals for Shopify app vendors.",
    note: "A 15-person team in Yerevan, Armenia, that now sells to both sides of Shopify. For app vendors it runs merchant support, part-time or 24/7, asks for reviews after a solved case, and works low-star reviews by outreach. Its app clients include Fast Bundle, Yoyo and Cart Pilot, and it also reviews listings and support processes and offers merchant acquisition. For merchants it recommends apps from its partner network and installs them free. Its own figures: about 3,000 positive reviews for one app, 140+ for another, a 13%+ monthly review-conversion rate and 100+ negative reviews recovered.",
    watch: "Merchant acquisition means joining its partner network, and the apps it recommends to merchants are the ones whose support it runs. It says no merchant is recommended an app because it pays. Both review services act on your own App Store listing, no price is published, and every figure is its own.",
    social: { li: "https://www.linkedin.com/company/acxt/", x: "https://x.com/Apricotcx" },
  },
  {
    id: "kivosupport", name: "KivoSupport", cat: "support", domain: "kivosupport.com",
    url: "https://kivosupport.com", price: "$299 / $1,499 / $2,999 per month, then custom", free: false, verified: true,
    ownership: { id: "efoli", name: "EFOLI, LLC" },
    pricingUrl: "https://kivosupport.com/pricing",
    launched: "unknown", /* not stated on its own site (checked 2026-10-23) */
    updated: "2026-10-13",
    tags: ["support", "outsourced", "white-label", "helpdesk", "chat", "email", "sla", "knowledge base", "liquid", "escalation"],
    one: "White-label support for Shopify apps, with the tiers actually priced.",
    note: "The only one of these three with a rate card. Starter at $299 is email only, with shared agents and up to 75 tickets a month. It covers 4 hours a day across 5 days, with a 24-hour response SLA. Growth at $1,499 adds live chat to 150 conversations, feedback analysis, and bug and feature-request reporting. It also adds basic HTML and CSS work over 8 hours a day. Professional at $2,999 is a dedicated agent capped at three clients, 24/7 cover and 300 conversations. It adds dedicated QA and agent coaching, Liquid customization, and review request and response management. Enterprise is custom: a dedicated team and lead, 1,000+ conversations, helpdesk setup, Slack and SLAs down to 4 hours. No setup fee, no free trial, cancel any time, and a free consultation to scope it.",
    watch: "The logo wall is headed \"Trusted by Shopify apps used by thousands of merchants\". At least four of the six apps on it are EFOLI's own. MultiVariants, OrderRules, DiscountRay and QuotWay are all published by EFOLI, LLC on the App Store, and PushBundle is EFOLI's too. Read it as a portfolio, not as six independent references, and ask for a client you can actually call. The tiers are also metered on conversations, not hours. So a support load that spikes is the case their pricing handles worst. Where the team is based is not stated anywhere. Review request and response management is bundled from Professional up, which is a different product from support, billed on the same invoice.",
    social: {
      li: "https://www.linkedin.com/company/kivosupport",
      x: "https://x.com/KivoSupport",
    },
  },
  {
    id: "supportheroes", name: "The Support Heroes", cat: "support", domain: "thesupportheroes.com",
    url: "https://thesupportheroes.com", price: "Not published", free: false, verified: true,
    launched: "2020", /* www.thesupportheroes.com/pages/about-us: "It all started in 2020" (checked 2026-10-23) */
    updated: "2026-10-13",
    tags: ["support", "outsourced", "white-label", "tier 2", "24/7", "recruitment", "training", "qa", "escalation", "timezones"],
    one: "A tiered support team for app vendors, recruited and managed for you.",
    note: "The largest of the three by its own numbers: 66 people supporting 44 Shopify apps, 24/7. Its agents are spread across timezones, not one office covering shifts. Two tiers, and the split is the main selling point. Tier 1 knows Shopify and handles the queue. Tier 2 takes complex issues and customization requests. Team management, recruitment, training and quality analysis are all included, not sold separately. So what you buy is closer to a managed support department than a group of agents. Named partners include Ablestar, Venntov, Conjured, Freshly Commerce, Orbe, Bloggle, Buunto, Forsberg Plus Two and Code Black Belt.",
    watch: "Nothing about the commercial side is published. There is no price, no rate card, no SLA, no response-time commitment and no minimum. So everything about what it costs and what it promises is a conversation. Ownership is not stated either. The site credits eighteen people by first name and names no founder, no parent and no legal entity. For a supplier taking over your merchant relationship, that is the one fact you would want before the first call. The 44 apps and 66 heroes are self-reported and not checkable. The partner list is unusually specific for this category, though, and several of those vendors are well known enough to ask directly.",
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
