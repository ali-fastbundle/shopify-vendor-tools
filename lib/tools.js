/* Catalogue, categories and palette. Edit tools here; the UI reads from this file. */

export const AUTHOR = "Ali A.";

/*
 * Where the byline points. Empty renders the byline as plain text, so the site
 * is correct either way — set it to a profile you actually control rather than
 * one that looks plausible.
 */
export const AUTHOR_URL = "https://www.linkedin.com/in/ali-arabzadeh/";

export const C = {
  bg: "#06110D",
  panel: "#0D1F19",
  raised: "#132A22",
  line: "rgba(255,255,255,0.09)",
  text: "#E8F2EC",
  muted: "#8CA79B",
  dim: "#5E7A6E",
};

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
];

export const catOf = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[0];

/* ================================================================== */
/*  Resource kinds. Tools are the only section with a catalogue        */
/*  behind them; the rest are stubs the roadmap opens for suggestions. */
/*  Colours are reused from CATEGORIES so the palette stays closed.    */
/* ================================================================== */
export const RESOURCE_KINDS = [
  { id: "tool", label: "Tools", color: "#00E08A", live: true,
    blurb: "Software built specifically for Shopify app vendors. The section you are looking at." },
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
/*  Catalogue. Shopify-exclusive tools only.                           */
/*  social: only profiles published on the vendor's own site.          */
/*                                                                     */
/*  ratings: optional external scores, entered BY HAND from the public  */
/*  listing page — never scraped, and never any review text. Shape:     */
/*    ratings: [{ source: "G2", score: 4.8, outOf: 5, count: 120,       */
/*                url: "https://www.g2.com/products/...",               */
/*                captured: "2026-09-15" }]                             */
/*  captured is required so a stale figure reads as stale. These are    */
/*  reference only and are never averaged into the community rating.    */
/* ================================================================== */
export const TOOLS = [
  /* ---- App Store ASO ---- */
  {
    id: "appjubilee", name: "AppJubilee", cat: "aso", domain: "appjubilee.io",
    url: "https://www.appjubilee.io", price: "From $49/mo", free: false, verified: false,
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
    note: "Historical listing data, app and keyword following, change notifications. Mantle acquired it in May 2024. Still reachable but tied to a platform that is winding down.",
    watch: "Do not build a process on it. Move anything you depend on to AppNavigator, Applora or a paid tracker.",
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
    url: "https://marmeto.com/pages/elevate-shopify-app-analytics",
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

  /* ---- Partner & affiliate ---- */
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
    url: "https://partnerjam.com", price: "Free", free: true, verified: false,
    updated: "2026-09-11",
    tags: ["affiliate", "referral", "free", "attribution", "cookie-independent", "partner api"],
    one: "Free, cookie-independent, direct Partner API integration.",
    note: "Built by Digismoothie, who make Candy Rack, after failing to find a platform they liked. They became their own first customer. Cookie independence matters here because install attribution through the App Store breaks normal cookie chains.",
    watch: "Free products from app vendors can quietly go unmaintained. Check the changelog before committing a program to it.",
    social: { li: "https://www.linkedin.com/company/partnerjam/" },
  },
  {
    id: "orbit", name: "Orbit", cat: "partner", domain: "marmeto.com",
    url: "https://marmeto.com/pages/orbit-partner-management",
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
    url: "https://krutva.com", price: "Not published", free: false, verified: false,
    updated: "2026-09-11",
    tags: ["prm", "partner", "relationship", "commission", "channel"],
    one: "Partner relationship management, surfaced in community threads.",
    note: "Raised by developers as a PRM option alongside the affiliate trackers when the Mantle replacement question came up. Sits at the heavier end: relationship and channel management rather than link tracking.",
    watch: "The thinnest evidence base in this directory. Confirm it is still trading and actually serves Shopify app vendors before spending time on it.",
    social: { li: "https://www.linkedin.com/company/krutva/" },
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
    updated: "2026-09-11",
    tags: ["detector", "apps", "free", "extension", "chrome", "store insights"],
    one: "Extension-first store analysis, 7,548 apps and tools.",
    note: "Broadest claimed detection coverage of the free detectors. Adds an information tab with Shopify store insights. Search exists but is still beta; the extension is the product.",
    watch: "Small and new, version 1.0.0 at time of checking. Like every detector, it only sees apps with a storefront presence.",
    social: {},
  },

  /* ---- Suites ---- */
  {
    id: "marmeto", name: "Marmeto", cat: "suite", domain: "marmeto.com",
    url: "https://marmeto.com", price: "Most tools free for approved partners", free: true, verified: true,
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
    url: "https://appstoreresearch.com", price: "Free account, then per-call fees", free: true, verified: true,
    linked: "ShopExperts",
    updated: "2026-09-15",
    tags: ["user research", "customer discovery", "interviews", "panel", "recruitment", "validation", "sales calls", "positioning", "churn"],
    one: "A paid panel of vetted Shopify merchants you can book calls with.",
    note: "3,000+ Shopify brands in the network, $1M+ paid to participants, 6,000+ product conversations. You define the merchant profile by role, industry, revenue range and Shopify plan; vetted operators apply and you approve who you talk to. Scheduling, screening and incentives are handled. Used for roadmap validation, switching analysis, pricing and positioning. Transcripts and tagged insights are a paid add-on. Named customers include Loox, Recart, Tresl, ClickPost and MobiLoud.",
    watch: "Same owner as ShopExperts. Two costs, not one. You pay the participant incentive (minimum $85 for research interviews) plus a recruitment fee that varies by plan and participant type, so the real per-call cost is not on the pricing page alone. Worth noting it also sells sales calls: a merchant paid to take a call is not the same signal as inbound interest, and treating those conversations as pipeline needs that discount applied. Their own site advertises 5.0 from 72 reviews while Trustpilot shows 4.3 from 12: the higher figure is their on-platform number, collected and displayed by them, not an independent one.",
    ratings: [
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
    updated: "2026-09-15",
    tags: ["freelance", "agencies", "marketplace", "hiring", "matching", "vetting", "heycarson", "no commission"],
    one: "Hand-matched Shopify experts and agencies, free to the person hiring.",
    note: "Formerly HeyCarson. You describe what is broken and get up to three hand-picked matches to compare, usually inside an hour, drawn from 205 vetted experts covering agencies, freelancers and consultants. It shows 4.96 across 860 verified client reviews and claims 56,000+ brands, agencies and app companies matched since 2015, with the top 3% of applicants passing vetting. Hiring costs nothing: no commission, no markup, and you pay the expert directly. Browsing is organised by the problem rather than the skill, and filterable by the partner apps an expert works with, Loox, Klaviyo, Judge.me and PageFly among them.",
    watch: "Same owner as App Store Research, which serves its logo and founder photo from ShopExperts' own CDN, so read the two as one company's view of the ecosystem rather than two. The side that pays is the expert, not you: a verified listing is free, but Verified Pro at $799 a year or $249 a quarter buys Official Partner status, lead capture and listing analytics. Worth knowing before treating a hand-picked match as a neutral ranking.",
    ratings: [
      { source: "Trustpilot", count: 269, url: "https://www.trustpilot.com/review/heycarson.com", captured: "2026-09-15" },
    ],
    social: { li: "https://www.linkedin.com/company/heycarson/" },
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

export const LAST_UPDATED_ISO =
  TOOLS.reduce((newest, t) => (t.updated && t.updated > newest ? t.updated : newest), "");

export const LAST_UPDATED = formatDay(LAST_UPDATED_ISO);

/* ================================================================== */
