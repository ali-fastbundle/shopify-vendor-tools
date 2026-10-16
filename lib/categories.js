/*
 * Structured data per tool: category attributes, pricing tiers and
 * integrations. The shapes and the rules live here. The values proposed from
 * each entry's note are in lib/structured.js, and what the editor confirmed is
 * in Redis (lib/structuredStore.js). Only confirmed values reach a page.
 *
 * Unknown is a value. Anything the vendor's site, as recorded in the note,
 * does not state is UNKNOWN, never a guess and never left blank, and it
 * displays as "Unknown". That is the opposite of rule E on purpose: here the
 * reader is comparing, and "we do not know" is the comparison's answer.
 *
 * Pure and client-safe.
 */

export const UNKNOWN = "unknown";
export const isUnknown = (v) => v === UNKNOWN || v === undefined || v === null;

/*
 * What each category is compared on. `type` is boolean, enum, number or text.
 * `comparable` puts it in the compare table. `from` derives a boolean from the
 * integrations, so "API" and "REST API" cannot disagree: present means yes,
 * absent falls back to the attribute's own value (no, or unknown).
 */
export const ATTRIBUTES = {
  aso: [
    { key: "keywordsTracked", label: "Keywords tracked", type: "number", comparable: true, hint: "On the largest published plan" },
    { key: "appsPerPlan", label: "Apps per plan", type: "number", comparable: true, hint: "On the largest published plan" },
    { key: "competitorAlerts", label: "Competitor alerts", type: "boolean", comparable: true },
    { key: "listingAudit", label: "Listing audit", type: "boolean", comparable: true },
    { key: "api", label: "API", type: "boolean", comparable: true, from: "rest-api" },
  ],
  data: [
    { key: "appsCovered", label: "Apps covered", type: "number", comparable: true },
    { key: "reviewHistory", label: "Review history", type: "boolean", comparable: true },
    { key: "rankingHistory", label: "Ranking history", type: "boolean", comparable: true },
    { key: "api", label: "API", type: "boolean", comparable: true, from: "rest-api" },
    { key: "export", label: "Export", type: "boolean", comparable: true, from: "csv" },
  ],
  biz: [
    { key: "mrr", label: "MRR tracking", type: "boolean", comparable: true },
    { key: "churn", label: "Churn analytics", type: "boolean", comparable: true },
    { key: "ltv", label: "LTV", type: "boolean", comparable: true },
    { key: "runsBilling", label: "Runs billing", type: "boolean", comparable: true, hint: "Charges merchants, not only reports on it" },
    { key: "installAttribution", label: "Install attribution", type: "boolean", comparable: true },
  ],
  partner: [
    { key: "attribution", label: "Attributes", type: "enum", options: ["installs", "revenue", "installs and revenue"], comparable: true },
    { key: "paysAffiliates", label: "Pays affiliates", type: "boolean", comparable: true },
    { key: "partnerPortal", label: "Partner portal", type: "boolean", comparable: true },
    { key: "mantleImport", label: "Imports from Mantle", type: "boolean", comparable: true },
    { key: "platformFee", label: "Platform fee", type: "text", comparable: true, hint: "What it takes from payouts" },
  ],
  storedb: [
    { key: "storesCovered", label: "Stores covered", type: "number", comparable: true },
    { key: "platforms", label: "Platforms", type: "text", comparable: true },
    { key: "installHistory", label: "Install history", type: "boolean", comparable: true },
    { key: "contactsIncluded", label: "Contacts included", type: "boolean", comparable: true },
    { key: "export", label: "Export", type: "boolean", comparable: true, from: "csv" },
    { key: "crmIntegrations", label: "CRM integrations", type: "text", comparable: true },
  ],
  detect: [
    { key: "detectsApps", label: "Detects installed apps", type: "boolean", comparable: true },
    { key: "detectsTheme", label: "Detects theme", type: "boolean", comparable: true },
    { key: "browserExtension", label: "Browser extension", type: "boolean", comparable: true },
    { key: "freeChecks", label: "Free checks", type: "text", comparable: true },
    { key: "api", label: "API", type: "boolean", comparable: true, from: "rest-api" },
  ],
  suite: [
    { key: "products", label: "Products in the suite", type: "number", comparable: true },
    { key: "covers", label: "Covers", type: "text", comparable: true },
    { key: "freeForPartners", label: "Free for partners", type: "boolean", comparable: true },
  ],
  research: [
    { key: "panelSize", label: "Merchants in the network", type: "number", comparable: true },
    { key: "minCostPerCall", label: "Lowest cost per call (USD)", type: "number", comparable: true },
    { key: "screening", label: "Participants screened", type: "boolean", comparable: true },
    { key: "salesCalls", label: "Sells sales calls too", type: "boolean", comparable: true },
  ],
  talent: [
    { key: "whoPays", label: "Who pays the platform", type: "enum", options: ["the hirer", "the expert", "both"], comparable: true },
    { key: "vetted", label: "Vetted", type: "boolean", comparable: true },
    { key: "appDevelopers", label: "App developers", type: "boolean", comparable: true },
    { key: "takePublished", label: "Platform take published", type: "boolean", comparable: true },
  ],
  support: [
    { key: "hours", label: "Hours", type: "text", comparable: true },
    { key: "inYourHelpdesk", label: "Works in your helpdesk", type: "boolean", comparable: true },
    { key: "reviewRecovery", label: "Review recovery", type: "boolean", comparable: true },
    { key: "whiteLabel", label: "Answers under your name", type: "boolean", comparable: true },
  ],
};

export const attributesFor = (cat) => ATTRIBUTES[cat] || [];

/* The controlled vocabulary. Nothing else may be stored. */
export const INTEGRATIONS = [
  { id: "partner-api", label: "Shopify Partner API" },
  { id: "ga4", label: "GA4" },
  { id: "hubspot", label: "HubSpot" },
  { id: "slack", label: "Slack" },
  { id: "apollo", label: "Apollo" },
  { id: "zapier", label: "Zapier" },
  { id: "mcp", label: "MCP" },
  { id: "webhooks", label: "Webhooks" },
  { id: "csv", label: "CSV export" },
  { id: "rest-api", label: "REST API" },
];
export const integrationLabel = (id) => INTEGRATIONS.find((i) => i.id === id)?.label || id;

/* ------------------------------------------------------------------ */
/*  Pricing                                                            */
/* ------------------------------------------------------------------ */

export const PERIODS = ["month", "year", "one-time"];
export const UNITS = ["flat", "per app", "per seat", "per call", "per lead", "per credit pack"];
export const CURRENCIES = ["USD", "GBP", "EUR"];
const SYMBOL = { USD: "$", GBP: "£", EUR: "€" };

/*
 * { published, free, trialDays, tiers: [{ name, amount, currency, period, unit }], note }
 *
 * `published: false` is the answer for a vendor who prints no price, and the
 * display says "Not published". `free` and `trialDays` may be UNKNOWN.
 * `note` holds the one condition the tiers cannot ("free under $5k MRR",
 * "3% added to card payments"), and is shown after them.
 */
const money = (t) => {
  const s = SYMBOL[t.currency] || `${t.currency} `;
  const n = Number(t.amount);
  /* Whole amounts with separators, cents as given: $0.083 a lead is $0.083. */
  return `${s}${Number.isInteger(n) ? n.toLocaleString("en-US") : String(n)}`;
};
const periodWord = { month: "a month", year: "a year", "one-time": "one-time" };

/** The display string, derived from the structure. Never stored. */
export function pricingDisplay(p) {
  if (!p) return "";
  if (p.published === false) return p.note ? `Not published. ${p.note}` : "Not published";
  const tiers = (p.tiers || []).filter((t) => Number(t.amount) > 0);
  const parts = [];
  if (p.free === true) parts.push(tiers.length ? "Free plan" : "Free");
  if (tiers.length) {
    /* Group by period and unit, so "$39 / $89 a month" rather than a list. */
    const groups = [];
    for (const t of tiers) {
      const k = `${t.period}|${t.unit}`;
      const g = groups.find((x) => x.k === k);
      if (g) g.items.push(t); else groups.push({ k, period: t.period, unit: t.unit, items: [t] });
    }
    /* A per-call or per-lead price has no period worth saying: "$150 per call". */
    const usage = (g) => g.unit === "per call" || g.unit === "per lead" || g.unit === "per credit pack";
    parts.push(groups.map((g) =>
      `${g.items.map(money).join(" / ")}${g.unit && g.unit !== "flat" ? ` ${g.unit}` : ""} ${usage(g) && g.period === "one-time" ? "" : periodWord[g.period] || ""}`.trim()
    ).join(", "));
  }
  let out = parts.length > 1 ? `${parts[0]}, then ${parts.slice(1).join(", ")}` : parts[0] || "";
  if (Number(p.trialDays) > 0) out = `${out}${out ? ". " : ""}${p.trialDays}-day trial`;
  if (p.note) out = `${out}${out ? ". " : ""}${p.note}`;
  return out || "Not published";
}

/** The cheapest paid monthly figure in USD, or null. For the recommender's budget. */
export function lowestMonthlyUSD(p) {
  if (!p || p.published === false) return null;
  const monthly = (p.tiers || [])
    .filter((t) => t.currency === "USD" && Number(t.amount) > 0 && (t.unit === "flat" || t.unit === "per app" || t.unit === "per seat"))
    .map((t) => (t.period === "year" ? Number(t.amount) / 12 : t.period === "month" ? Number(t.amount) : null))
    .filter((n) => n !== null);
  return monthly.length ? Math.min(...monthly) : null;
}

/* ------------------------------------------------------------------ */
/*  Validation                                                         */
/* ------------------------------------------------------------------ */

function cleanValue(a, v) {
  if (isUnknown(v)) return UNKNOWN;
  if (a.type === "boolean") return v === true || v === false ? v : UNKNOWN;
  if (a.type === "number") { const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : UNKNOWN; }
  if (a.type === "enum") return a.options.includes(v) ? v : UNKNOWN;
  const t = String(v).replace(/\s+/g, " ").trim().slice(0, 160);
  return t && !/—/.test(t) ? t : UNKNOWN;
}

/**
 * Validate one tool's structured data against its category. Returns
 * { data } or { error }. Every attribute of the category is present in the
 * result, as a value or as UNKNOWN; anything else is dropped.
 */
export function sanitiseStructured(cat, input = {}) {
  const attrs = {};
  for (const a of attributesFor(cat)) attrs[a.key] = cleanValue(a, input.attrs?.[a.key]);

  const ids = INTEGRATIONS.map((i) => i.id);
  const integrations = [...new Set((input.integrations || []).filter((i) => ids.includes(i)))];

  const p = input.pricing || {};
  if (p.published !== true && p.published !== false) return { error: "Say whether pricing is published." };
  const tiers = [];
  for (const t of p.tiers || []) {
    const amount = Number(t.amount);
    if (!Number.isFinite(amount) || amount < 0) return { error: `A tier has no valid amount: ${JSON.stringify(t)}` };
    if (!PERIODS.includes(t.period)) return { error: `Unknown period "${t.period}".` };
    if (!UNITS.includes(t.unit)) return { error: `Unknown unit "${t.unit}".` };
    if (!CURRENCIES.includes(t.currency)) return { error: `Unknown currency "${t.currency}".` };
    tiers.push({ name: String(t.name || "").trim().slice(0, 40), amount, currency: t.currency, period: t.period, unit: t.unit });
  }
  if (p.published === false && tiers.length) return { error: "Pricing is marked not published but has tiers." };
  const note = String(p.note || "").replace(/\s+/g, " ").trim().slice(0, 200);
  if (/—/.test(note)) return { error: "The pricing note has an em dash." };
  const free = p.free === true || p.free === false ? p.free : UNKNOWN;
  const trialDays = isUnknown(p.trialDays) ? UNKNOWN : Number.isFinite(Number(p.trialDays)) ? Number(p.trialDays) : UNKNOWN;

  return { data: { attrs, integrations, pricing: { published: p.published, free, trialDays, tiers, note } } };
}

/** An attribute's value for display, applying `from`. */
export function attributeValue(a, data) {
  const own = data?.attrs?.[a.key];
  if (a.from && (data?.integrations || []).includes(a.from)) return true;
  return isUnknown(own) ? UNKNOWN : own;
}

export function formatValue(a, v) {
  if (isUnknown(v)) return "Unknown";
  if (a.type === "boolean") return v ? "Yes" : "No";
  if (a.type === "number") return Number(v).toLocaleString("en-US");
  return String(v);
}
