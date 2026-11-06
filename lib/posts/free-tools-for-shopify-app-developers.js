/*
 * What you can use for free. Ali's draft of 6 November 2026, with every
 * figure read again that day on each vendor's own pricing page (curl with a
 * browser user agent, no third-party or review site), and the text edited for
 * ali-voice and stop-slop.
 *
 * What the reading changed from the draft:
 *   - 39 of 59 is 38 of 59. The file has 37 free of 58 after the fixes below.
 *     Partnerdex, published from the suggestion queue, is GPL-3.0 open source
 *     on GitHub, so it is free to run, which makes 38. Its queue entry still
 *     says "Not published" and needs the same fix on /admin. Wappalyzer, also
 *     live from the queue, is not counted: CLAUDE.md keeps it out of the
 *     directory, and it should be unpublished.
 *   - PartnerJam is not free. Every plan is a 30-day trial, then $49.99 or
 *     $99.99 (partnerjam.com). The listing was corrected the same day. Its own
 *     site does not mention Candy Rack, so the post does not either.
 *   - Store Leads showed as free on the live site through a stored override.
 *     It has no free plan; the override is cleared by a marker in lib/tools.js.
 *   - AppNavigator states 30,032 apps, not 26,000. It has no paid plan at all.
 *   - LetsMetrix has paid plans now (Pro $19, Studio $49), and its free plan is
 *     1 app, 3 keywords, 1 competitor, 14 days, the same shape as AppstorePulse.
 *   - Koala Inspector's free plan is 15 tokens, not 15 checks, and app and
 *     theme detection cost none.
 *   - Applora states 31.4K apps, 1.2M reviews and 395+ keywords. Browsing is
 *     free with no credits; the free account adds 50 credits a month. Pro is
 *     the full history and 5,000 credits, not a year and 5,000 MCP calls.
 *   - Shoffi's $100 is your app's revenue from affiliate referrals in 30 days,
 *     not what affiliates earn.
 *   - StoreCensus's pricing page contradicts itself on CSV export on the free
 *     plan, and the post says so rather than choosing.
 *   - Affilitrak's page for app vendors states a commission on marketplace
 *     affiliates with no rate.
 *
 * The chart counts primary categories in lib/tools.js plus Partnerdex
 * (Analytics & billing), Wappalyzer excluded.
 */
export default {
  /* Renamed the day it went out, for what people search: the old slug,
     /blog/free-tiers, redirects here (next.config.mjs). */
  slug: "free-tools-for-shopify-app-developers",
  title: "Free tools for Shopify app developers: 38 with a free plan, and where each one stops",
  description: "Free rank trackers, store detectors, store databases, revenue and affiliate tools for Shopify app developers, with the limit where each free plan stops.",
  categories: ["aso", "data", "detect", "storedb", "biz", "partner"],
  date: "2026-11-06",
  body: [
    { p: "38 of the 59 tools in this directory have a free plan that does not expire. That is nearly two thirds. Free trials are not counted." },
    { p: "This market has a few thousand buyers. 52 of the 59 tools publish a price, and most let you sign up without talking to anyone. So the free plan is how they find customers." },
    { p: "That helps if you are starting out. You can run the first months of an app business without paying for tools. The useful question is where each free plan stops. Most stop at the point where you would start to use the tool every day." },
    { note: "Every limit below was read on the vendor's own pricing page on 6 November 2026. Counts a vendor states about itself, such as how many apps it covers, are marked †. Free plans change faster than anything else on a pricing page, so check the listing before you rely on one." },
    { chart: {
      type: "groups",
      title: "Tools with a free plan, by category",
      labelHead: "Category",
      series: ["Free plan", "All tools"],
      rows: [
        { label: "Store detectors", values: [9, 9] },
        { label: "Analytics & billing", values: [7, 8] },
        { label: "App Store ASO", values: [6, 10] },
        { label: "Store databases", values: [6, 12] },
        { label: "Partner & affiliate", values: [4, 7] },
        { label: "App Store data", values: [2, 2] },
        { label: "Talent & services", values: [2, 4] },
        { label: "Ecosystem suites", values: [1, 2] },
        { label: "Merchant research", values: [1, 2] },
        { label: "Support & CX", values: [0, 3] },
      ],
      caption: "Each tool counted once, in its main category. Every store detector is free. No support service is.",
    } },

    { h2: "See where you rank" },
    { p: "[AppNavigator](tool:appnavigator) is free with no account. It shows ranking history, review summaries and weekly top movers across {†30,032 apps}, and it has no paid plan. It does not track your own listing and has no alerts. Its sign-up form says keyword monitoring is coming, so that part is not built yet. To check a competitor, it is the fastest tool here." },
    { p: "[LetsMetrix](tool:letsmetrix) has a free plan with an account: 1 app, 3 keywords, 1 competitor and 14 days of history, with no CSV export. Pro is $19 a month. Its category scores cover {†19,565 apps}, which shows you how many apps you compete with." },
    { p: "[AppstorePulse](tool:appstorepulse) has the same free limits: 1 app, 3 keywords, 1 competitor and 14 days of history. Email alerts, search volume and the API are paid, from $49 a month. That is enough to see the product work, and not enough to rely on it." },
    { p: "[BestAppify](tool:bestappify) tracks 1 app and 10 competitors for free, with 15 live rank checks a day, 1 AI listing audit a month and 500 MCP calls a month. Change history is 7 days. The competitor change feed and its alerts are paid, from $29 a month." },
    { p: "Where it stops: the free plans show you the data. To be told you dropped six places overnight without going to look, you pay. AppNavigator has no alerts on any plan." },

    { h2: "Look up a single store" },
    { p: "[ShopScan](tool:shopscan) is a free Chrome extension with no account and unlimited scans. It detects {†2,000+ apps}. Its API is paid, from $19 a month." },
    { p: "[WeLookup](tool:welookup) is a free extension that detects {†7,548 apps}. It shows no paid plan." },
    { p: "[Koala Inspector](tool:koalainspector) gives 15 tokens a month for free, and they do not expire. App and theme detection cost no tokens. A traffic analysis costs 3, ads cost 2 and a CSV export costs 1. Premium is $22 a month for 220 tokens." },
    { p: "Where it stops: these look at one store at a time. To ask which 400 stores run an app, which is the question you have when you prospect, you need a store database." },

    { h2: "Find merchants at scale" },
    { p: "Free runs out fastest here. [StoreCensus](tool:storecensus) has a free plan with no card: 50 actions, 3 credits to open full store details, and 1 seat. The plan card lists search, filters and store previews. The comparison table on the same page also ticks CSV export for the free plan, so test it before you count on it. Starter, at $49 a month, lists CSV export and 2,000 credits." },
    { p: "[Store Leads](tool:storeleads) has no free plan. A free account shows a limited preview. Premium is $75 a month and leaves out CSV export. Export and the API start on Pro, at $250." },
    { p: "Where it stops: the install and uninstall history, the most useful part of a store database, is on Store Leads' paid plans only." },

    { h2: "Query the App Store as data" },
    { p: "[Applora](tool:applora) lets you browse for free, with no credits used. Sign up and you get 50 credits each month to spend over MCP or the REST API, plus 7 days of ranking history and review previews. Its home page counts {†31.4K apps and 1.2M reviews}. Pro is $49 a month, or $39 billed yearly, for the full history, CSV export, monitoring and 5,000 credits a month." },

    { h2: "Track your own revenue" },
    { p: "[Fusionmetrics](tool:fusionmetrics) is free up to $5,000 of tracked MRR, with the same features as its paid plans. Above that it is $25 a month, and $99 above $10,000. It stays free until the app makes money. Its pricing page also mentions a 30-day evaluation after your first dashboard is ready, and does not say more." },
    { p: "[Partnerdex](https://github.com/AdityaMalani/partnerdex) is open source under GPL-3.0. You host it yourself, so it costs your server and your time." },
    { p: "Where it stops: these tools read your Shopify Partner account. The software is free, and you still hand over your revenue data." },

    { h2: "Run an affiliate program" },
    { p: "Three tools cost nothing to start." },
    { ul: [
      "[Affilitrak](tool:affilitrak) is free for unlimited apps, with no caps. It takes a commission on affiliates that its own marketplace brings you, and its page for app vendors does not state the rate.",
      "[Shoffi](tool:shoffi) is free for 1 app while your app makes up to $100 in 30 days from affiliate referrals. Above that you have 14 days to upgrade. Starter is $39 a month.",
      "[PartnerDock](tool:partnerdock) is free for 1 app with unlimited affiliates. Payouts are by hand, with no CSV export. Launch is $19 a month.",
    ] },
    { p: "[PartnerJam](tool:partnerjam) has no free plan, only a 30-day trial. After it you pay $49.99 or $99.99 a month." },
    { p: "Where it stops: for a small program, it mostly does not. This is the one job where a new vendor has no reason to pay for a while." },

    { h2: "Three kinds of free" },
    { p: "Free because the data is public. AppNavigator and the store detectors read what Shopify already publishes. Showing it to you costs them almost nothing, so expect these to stay free." },
    { p: "Free until it works. One app, three keywords, fifteen tokens. These plans show you that the tool works, then ask for money. That is fair. Plan for the bill." },
    { p: "Free until you succeed. Shoffi up to $100 a month of referral revenue, Fusionmetrics up to $5,000 MRR. This kind suits a new vendor best, and it is the rarest." },
    { p: "If you launch an app this month, the first and third kinds will cover more than you expect. Before you sign up for the second kind, check the limit that will make you pay." },
  ],
};
