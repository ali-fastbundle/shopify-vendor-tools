/*
 * Owners: the companies and people behind listed entries.
 *
 * An entry points at its owner with a structured reference instead of free
 * text:
 *
 *   ownership: { id: "dark-ecommerce-labs", name: "Dark Ecommerce Labs, LLC",
 *                verb?: "part of", note?: "acquired from Union Works" }
 *
 * `id` is a key into OWNERS. `name` is how this entry's line shows it, which
 * may be the full legal name where the owner's own name is shorter. `verb`
 * replaces the default ("by" for a tool, "published by" for a newsletter,
 * "organized by" for an event). `note` is the one fact about this
 * relationship worth stating on the owner's page.
 *
 * Three rules carry over from invariant 32 and they hold here too:
 *  - an owner equal to the entry's own name is not information, so the
 *    entry's ownership line says nothing (it still lists its siblings, and it
 *    is still on the owner's page, as the owner's own product)
 *  - matching is on equality after normalising, never substring
 *  - nothing here is inferred: an owner is recorded only where the
 *    catalogue's own text states it
 *
 * An owner gets a page at /owners/<id> only when it controls two or more
 * published entries. A page about one entry would repeat that entry's page,
 * which is the duplicate-content problem in another shape. With one entry the
 * ownership line is plain text.
 *
 * A row may also carry `logo` (a path under /public/logos/, from the owner's
 * own site) and `domain` (whose favicon stands in for a logo; without it the
 * host of `url` is used). Neither is required: the mark falls back to
 * initials.
 *
 * Pure and client-safe: no catalogue imports. What an owner controls is
 * worked out in lib/ownerIndex.js, which reads the catalogues.
 */
import { isVacuousOwner } from "./tools";

export const OWNERS = [
  /* ---- shared owners: each controls two or more listings ---- */
  {
    id: "dark-ecommerce-labs", name: "Dark Ecommerce Labs", type: "Organization", url: "",
    notes: "The company behind AppJubilee and StoreCensus. AppJubilee publishes comparison pages against rival tools, so those pages and StoreCensus come from one vendor, not two independent sources.",
  },
  {
    id: "marmeto", name: "Marmeto", type: "Organization", url: "https://marmeto.com",
    notes: "A Shopify Platinum Partner founded in 2017, and the team behind Return Prime and Recurpay. It moved from services to products in 2026 and offers a suite of partner tools. Most of them are free only to approved Marmeto partners.",
  },
  {
    id: "mantle", name: "Mantle", type: "Organization", url: "https://heymantle.com",
    notes: "An app billing and analytics platform that announced its wind-down in June 2026. It acquired SASI from Union Works, together with a separate product, App Store Analytics, which is not listed here.",
  },
  {
    id: "thesaashub", name: "TheSaaSHub", type: "Organization", url: "",
    notes: "Builds PartnerDock, an affiliate platform for app vendors, and publishes the Shopify App Founders Edition newsletter. The newsletter has covered tools listed here, so read it as a vendor writing about its own market.",
  },
  {
    id: "shopexperts", name: "ShopExperts", type: "Organization", url: "https://shopexperts.com",
    notes: "Formerly HeyCarson. It runs the ShopExperts marketplace and App Store Research, and publishes the ShopOps Weekly newsletter. The research panel and the marketplace do different jobs and do not compete with each other.",
  },
  {
    id: "beckett-oliphant", name: "Beckett Oliphant", type: "Person", url: "",
    notes: "A solo Shopify app developer. He publishes the Becketto Rank Tracker and Affilitrak, an affiliate app on the Shopify App Store. Anyone in the affiliate category who tracks keywords in his tracker is sharing them with a competitor.",
  },
  {
    id: "dtc-media", name: "DTC Media", type: "Organization", url: "",
    notes: "Publishes the DTC Newsletter and The DTC Podcast and runs DTC Dines dinners. The newsletter's watch note names Pilothouse, an agency, as the business behind it.",
  },
  {
    id: "avex", name: "Avex", type: "Organization", url: "https://www.avexdesigns.com",
    notes: "A Shopify agency that runs small dining and networking events for ecommerce operators.",
  },
  {
    id: "worldef", name: "WORLDEF (Incmice)", type: "Organization", url: "https://worldef.com",
    notes: "Runs ecommerce trade events in several cities under the WORLDEF name.",
  },
  {
    id: "shoptalk", name: "Shoptalk (Hyve Group)", type: "Organization", url: "https://shoptalk.com",
    notes: "Retail conferences in the US and Europe, plus a luxury edition. Owned by Hyve Group.",
  },
  {
    id: "shopify", name: "Shopify", type: "Organization", url: "https://www.shopify.com",
    notes: "Shopify's own events for developers and partners, and its In Stock newsletter. This directory is not affiliated with Shopify.",
  },

  /* Checked 2026-10-30: findniche.com's terms and privacy policy name HANDHUNT
     HONGKONG LIMITED, and the Chrome Web Store verifies the Shopify Raise
     publisher as the owner of findniche.com. SellerCenter's listing already
     named it. */
  {
    id: "handhunt", name: "HANDHUNT HONGKONG LIMITED", type: "Organization", url: "https://findniche.com",
    notes: "Hong Kong company behind FindNiche, a dropshipping research site, and the tools listed here.",
  },

  /* ---- single-entry owners: a structured name, no page ---- */
  /* Checked 2026-10-23: honestecommerce.com links "Shopify Experts" to
     electriceye.io, and electriceye.io's footer links "Podcast" back to the
     show. */
  { id: "electric-eye", name: "Electric Eye", type: "Organization", url: "https://electriceye.io", notes: "Shopify agency in Columbus, Ohio, that runs the Honest Ecommerce podcast." },
  /* Checked 2026-10-23: AppstorePulse's terms name The Wide Company in
     Pierrelaye, France, with a contact address on matdesousa.com, and the
     WideBundle listing on the Shopify App Store names Mat De Sousa as its
     developer at the same address. */
  { id: "the-wide-company", name: "The Wide Company", type: "Organization", url: "",
    notes: "Mat De Sousa's company, in France. It makes WideBundle, a bundle app on the Shopify App Store, and AppstorePulse. Mat De Sousa also runs The Wide Event in Paris." },
  { id: "omegatheme", name: "OmegaTheme", type: "Organization", url: "", notes: "" },
  { id: "craftshift", name: "Craftshift", type: "Organization", url: "", notes: "" },
  { id: "jan-ther", name: "Jan Thér", type: "Person", url: "", notes: "" },
  { id: "retail-bulletin", name: "The Retail Bulletin", type: "Organization", url: "https://www.theretailbulletin.com", notes: "Published by Retail Bulletin Events Limited (company 06136675), Bagshot, Surrey, led by managing director Karen Howard. Runs a daily UK retail newsletter and a programme of retail summits, roundtables and the People in Retail Awards." },
  { id: "arthur-renard", name: "Arthur Renard", type: "Person", url: "", notes: "Publisher of luseri.com, a private individual per its legal notice. Also makes the Shopify app OptiDress (luseri.com/en/about)." },
  { id: "ok-digital", name: "OK Digital LTD", type: "Organization", url: "", notes: "Operator of shopthemedetector.com, per its privacy policy." },
  { id: "mehboob-shaikh", name: "Mehboob Shaikh", type: "Person", url: "", notes: "Named as founder on techleads.fyi/about." },
  { id: "convert2x", name: "Convert2x", type: "Organization", url: "", notes: "Shopify app growth agency founded by Boaz Lantsman in 2018. Prys grew out of it." },
  { id: "appdirect", name: "AppDirect", type: "Organization", url: "", notes: "" },
  { id: "builtwith-founders", name: "Andrew Rogers and Gary Brewer", type: "Person", url: "", notes: "" },
  { id: "ready-innovations", name: "Ready Innovations Inc.", type: "Organization", url: "", notes: "" },
  { id: "garner-labs", name: "Garner Labs LLC", type: "Organization", url: "", notes: "" },
  /* Checked 2026-10-30: the Shoper Spy listing names ReConvert LTD of Ramat Gan
     as developer and trader, and links upsell.com's privacy policy, which is
     ReConvert Ltd's, "registered in Israel". */
  { id: "reconvert", name: "ReConvert Ltd", type: "Organization", url: "https://upsell.com", notes: "" },
  { id: "efoli", name: "EFOLI, LLC", type: "Organization", url: "", notes: "" },
  { id: "idube", name: "Idube Pte. Ltd.", type: "Organization", url: "", notes: "" },
];

export const ownerById = (id) => OWNERS.find((o) => o.id === id) || null;

/* Equality after normalising, never substring (invariant 32). */
const bare = (v) => String(v ?? "").toLowerCase()
  .replace(/^https?:\/\//, "").replace(/^www\./, "")
  .replace(/\b(inc|llc|ltd|limited|pte|gmbh|co|corp|corporation|company)\b\.?/g, "")
  .replace(/[^a-z0-9]/g, "");

/** The key two spellings of one owner's name share (invariant 32: equality, never substring). */
export const ownerKey = (name) => bare(name);

/** The site an owner's mark is looked up on: a `domain` set by hand, else its own url's host. */
export const ownerDomain = (o) => String(o?.domain || String(o?.url || "")
  .replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0]).toLowerCase();

/** The OWNERS row a free-text name means, or null. Exact after normalising. */
export function findOwner(name) {
  const b = bare(name);
  if (!b) return null;
  return OWNERS.find((o) => bare(o.name) === b || bare(o.id) === b) || null;
}

/** A structured reference from a free-text name: a known owner, or a new one with no page. */
export function ownershipFromName(name) {
  const n = String(name || "").replace(/\s+/g, " ").trim().slice(0, 160);
  if (!n) return null;
  const o = findOwner(n);
  return { id: o ? o.id : "", name: n };
}

const DEFAULT_VERB = { tool: "by", newsletter: "published by", event: "organized by", podcast: "published by" };

/**
 * An entry's ownership, resolved: { id, name, verb, note, own } or null.
 *
 * Reads `ownership` first, and falls back to a legacy free-text `owner`
 * (stored overrides and published entries written before this field), so
 * nothing already in Redis loses its owner. `own` is true when the owner is
 * the entry itself, in which case the line says nothing.
 */
export function ownershipOf(entry = {}, kind = "tool") {
  const raw = entry.ownership && typeof entry.ownership === "object"
    ? entry.ownership
    : entry.owner ? ownershipFromName(entry.owner) : null;
  if (!raw || !(raw.id || raw.name)) return null;
  const known = raw.id ? ownerById(raw.id) : null;
  const name = String(raw.name || known?.name || "").trim();
  if (!name) return null;
  /*
   * A reference written in the file (it has an id) is compared with the
   * entry's name and id only. The domain check in isVacuousOwner is for free
   * text from the monitor, where "appjubilee.io" means AppJubilee; here it
   * would hide a real parent, because Elevate and Orbit live on marmeto.com
   * and Marmeto is exactly what their line should say.
   */
  const self = raw.id ? { name: entry.name, id: entry.id } : entry;
  const own = isVacuousOwner(name, self) || Boolean(known && isVacuousOwner(known.name, self));
  return {
    id: known ? known.id : "",
    name,
    verb: raw.verb || DEFAULT_VERB[kind] || "by",
    note: raw.note || "",
    own: Boolean(own),
  };
}

/** The display line for an entry's ownership, or "" (none, or its own name). */
export function ownershipLine(entry, kind = "tool") {
  const o = ownershipOf(entry, kind);
  return o && !o.own ? `${o.verb} ${o.name}` : "";
}
