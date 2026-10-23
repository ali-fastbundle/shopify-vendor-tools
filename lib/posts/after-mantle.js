/*
 * What took over from Mantle, one job at a time. Retrospective: billing ended
 * on 30 September 2026, and this reports what filled each of the four other
 * jobs. It advises nobody to move.
 *
 * Read on 23 October 2026, from each vendor's own pages:
 *   - Mantle's pricing page still carries its band table in the page source
 *     (priceTiers: Core, Advanced, Pro per revenue band). Every plan includes
 *     Core, so Advanced is the price of all four jobs.
 *   - Prys's pricing page (Offer JSON-LD and the tier cards) and its
 *     /mantle-alternative page, which says it does not do affiliates.
 *   - PartnerDock's and Shoffi's pricing pages.
 *   - Meridian's homepage and pricing page, which now offer a 14-day trial and
 *     list "Email and affiliates" and quote Shopify App Founders Edition #41.
 *   - AppVitals's pricing page: $15 for the first paid band, $999 as the top
 *     of its AggregateOffer, nothing published between.
 */
export default {
  slug: "after-mantle",
  title: "After Mantle: who took over its four jobs, and what they cost together",
  description: "Mantle billing ended on 30 September 2026. This looks back at which tools took over its analytics, affiliates, flows and customer views, and what they cost.",
  categories: ["biz", "partner"],
  date: "2026-10-23",
  body: [
    { p: "[Mantle](tool:mantle) billing ended on 30 September 2026. Its other services stopped on 14 August. This post looks back at what took over each of its jobs. It does not advise anyone to move. If you were on Mantle, you have moved already." },
    { p: "Billing itself is not covered here. It moved to Shopify's own App Pricing, and the Mantle listing says what that leaves out. This post covers the four other jobs Mantle did: billing analytics, affiliates, flows and customer views." },
    { note: "None of these tools was run for this post. What each one does is what its own site says, read on 23 October 2026. Prices are from each vendor's pricing page on that day. Figures a vendor publishes about itself are marked †. Nobody has published how many teams moved to which tool, so nothing here says which one won." },

    { h2: "One subscription became two" },
    { p: "Mantle sold all four jobs as one plan, Mantle Advanced. The price followed your monthly revenue, including usage fees, averaged over three months. Mantle's pricing page still shows the table. It was $49 a month under $5K, $99 from $5K to $10K, $399 from $25K to $50K and $999 from $100K to $250K." },
    { p: "No single tool took over all four jobs without a condition attached. [Prys](tool:prys) says it covers analytics, flows and customer views. Its own Mantle page says it does not do affiliates. So the cheapest set with published prices is Prys plus an affiliate tool. [PartnerDock](tool:partnerdock) is free for one app." },
    { table: {
      head: ["Monthly revenue", "Mantle Advanced", "Prys and PartnerDock Free", "Meridian Lite, one app"],
      rows: [
        ["$3K", "$49", "$49.95", "$69"],
        ["$8K", "$99", "$49.95", "$69"],
        ["$40K", "$399", "$199.95", "$69"],
        ["$150K", "$999", "$499.95", "$69"],
      ],
    } },
    { p: "Above $5K a month, the pair costs about half of what Mantle Advanced did. Below $5K, it costs about the same. PartnerDock's free plan has manual payouts and no export. Its $19 plan adds a PayPal CSV, which makes the pair $68.95 at the lowest band." },
    { p: "[Meridian](tool:meridian) is the one product that claims all four jobs, and billing plans as well. It charges per app, not by revenue. So one large app pays far less than it did on Mantle. The condition is that Meridian also hosts your app. Moving to it means moving your hosting, not only your data." },
    { p: "Two limits on this table. Mantle priced on revenue including usage fees, and Prys prices on Shopify MRR. And the columns do not buy the same things. Mantle also included billing tools. Prys adds ads and listing copy, which Mantle did not have." },
    { p: "Some candidates have no price you can add up. [Elevate](tool:elevate) and [Orbit](tool:orbit) are free only to approved Marmeto partners, and the terms are not published. [AppVitals](tool:appvitals) shows $15 for its first paid band and $999 at the top, and nothing between. [Luseri](tool:luseri) is free for now, with no paid plans set. [Affilitrak](tool:affilitrak) is free, with a 20% fee on marketplace affiliates that is announced and not yet charged." },

    { h2: "Who owns what" },
    { p: "Several candidates share an owner. Others are written about by a newsletter that belongs to a rival. No vendor comparison page says this, and it matters before you connect a Partner account to any of them." },
    { ul: [
      "[Elevate](tool:elevate) and [Orbit](tool:orbit) both belong to [Marmeto](https://watchfor.tools/owners/marmeto), a Shopify agency that also sells merchant apps. Using both is one vendor for analytics and affiliates, not two.",
      "[PartnerDock](tool:partnerdock) is built by TheSaaSHub. TheSaaSHub also publishes the [Shopify App Founders Edition](newsletter:shopifyappfounders) newsletter. Issue 41 covered Meridian, and Meridian quotes it on its own pricing page.",
      "[Prys](tool:prys) grew out of Convert2x, a growth agency for Shopify apps.",
      "[AppVitals](tool:appvitals) is run by one sole trader, named only on its legal notice. [Luseri](tool:luseri) is run by one person who also sells a Shopify app.",
      "[Affilitrak](tool:affilitrak) names nobody on its site. The link to Beckett Oliphant comes from Beckett Oliphant's own launch announcement.",
      "[SaaS Insights](tool:saasinsights) names no company and no person on its site.",
      "[Meridian](tool:meridian) comes from a team that also runs a Shopify agency.",
    ] },
    { p: "Most Mantle comparisons online are written by a candidate. SaaS Insights, Prys and [LetsMetrix](tool:letsmetrix) each published one. Mantle's own wind-down page named four affiliate tools side by side, with no preference: Shoffi, PartnerDock, Orbit and Affilitrak." },

    { h2: "Billing analytics" },
    { h3: "What it is judged on" },
    { ul: [
      "Where the numbers come from: the Partner API's totals, the raw Partner event feed, or GA4 through a BigQuery export.",
      "Whether it needs your Partner account. Every tool here does. That connection carries your full revenue history, so who runs the tool matters.",
      "What it does not cover.",
    ] },
    { h3: "The candidates" },
    { p: "[SaaS Insights](tool:saasinsights) reads revenue from the Partner API and shows App Store rankings beside it. It does not connect one to the other. [AppVitals](tool:appvitals) recalculates revenue from the raw event feed, so last March's figure does not change later. Its GA4 part needs your own BigQuery export. It says reconnecting the Partner API brings your history back {†with nothing to export}." },
    { p: "[Prys](tool:prys) uses Partner data and GA4 through BigQuery. It follows a merchant from a listing visit to a payment. Without ShopIDs in BigQuery, it says its matching is {†around 80% accurate}. [Luseri](tool:luseri) reads the Partner account with read-only access and adds an AI assistant. It does no keyword tracking of your choice. [Elevate](tool:elevate) connects to the Partner account directly. [Meridian](tool:meridian) reports revenue inside a platform that also bills and hosts." },
    { h3: "Which fits which team" },
    { p: "For revenue numbers only, with a free tier that lasts, SaaS Insights is free up to $2.5K MRR. For history that never shifts, AppVitals. For which keyword brought a paying merchant, Prys, if you can set up BigQuery. Each asks for your Partner account. Read who runs it first." },

    { h2: "Affiliates" },
    { h3: "What it is judged on" },
    { ul: [
      "How a referral is attributed. Most match a click to an install with the Partner API and GA4.",
      "How affiliates get paid: by hand, from a PayPal CSV, or through the tool.",
      "What the price grows with: the number of apps, what affiliates earn, or a cut of payouts. This decides who pays more as a program grows.",
    ] },
    { h3: "The candidates" },
    { p: "[Affilitrak](tool:affilitrak) uses the Partner API, GA4 and BigQuery, and pays affiliates through PayPal. It imports a Mantle program and keeps the old referral links working, {†by its own description}. It is free, apart from the 20% marketplace fee above." },
    { p: "[PartnerDock](tool:partnerdock) matches clicks to installs with the Partner API and GA4. Payouts are by hand on the free plan, with a PayPal CSV from $19. Its price grows with the number of apps. Its site says the price never grows with affiliate revenue." },
    { p: "[Shoffi](tool:shoffi) has run since 2021, longer than the others. Its price grows with what affiliates earn in 30 days. It is free up to $100, $39 up to $300, $89 up to $3,000 and $149 up to $10,000. You pay affiliates' PayPal accounts by card. Its pricing page does not say how it attributes a referral." },
    { p: "[Orbit](tool:orbit) is closer to a partner portal than a link tracker: onboarding, leads and commissions. Meridian also lists referrals on its homepage. That part was not checked further." },
    { h3: "Which fits which team" },
    { p: "A small program that wants its Mantle links to keep working: Affilitrak. A program that expects affiliate revenue to grow: PartnerDock, because its price does not grow with it. A program that wants a marketplace of affiliates: Shoffi, after reading what its listing says about that marketplace." },

    { h2: "Flows" },
    { h3: "What it is judged on" },
    { ul: [
      "What can start a flow: an install, a trial ending, an uninstall or a payment.",
      "Which domain the email is sent from, yours or the vendor's.",
      "What it measures afterwards: opens, or what the merchant did next.",
    ] },
    { h3: "The candidates" },
    { p: "Two listed tools send flows. [Prys](tool:prys) sends welcome, trial and win-back emails from your own domain. It measures each one by what the merchant did next: subscribe, pay or reinstall. Email is in its paid plans, not the free one. [Meridian](tool:meridian) has automations started by events such as an install, and an email builder for campaigns. Its Pro plan includes 30,000 emails a month. Lite does not state a limit." },
    { p: "Email tools outside this directory also offer Mantle migrations. They are not listed here, so they are not compared." },
    { h3: "Which fits which team" },
    { p: "Prys is the smaller move: email on top of analytics. Meridian is the larger one, because flows come with its hosting." },

    { h2: "Customer views" },
    { h3: "What it is judged on" },
    { ul: [
      "What one merchant's record shows: plan, event history, notes.",
      "Whether you can build a segment and act on it.",
      "Who holds the record.",
    ] },
    { h3: "The candidates" },
    { p: "[Prys](tool:prys) segments merchants by plan, source, keyword and status. You can open one store and see its event history and notes. [Meridian](tool:meridian) has a CRM with segments, connected to its automations. [Luseri](tool:luseri) shows cohorts and the reasons merchants give for uninstalling, not a page per merchant." },
    { h3: "Which fits which team" },
    { p: "For a record per merchant without moving your hosting, Prys. With a hosting move, Meridian." },

    { h2: "What this cannot tell you" },
    { p: "Nobody has published how many former Mantle users went to each tool. Vendor figures such as {†500+ apps} on Prys or {†18,000 affiliates} on Shoffi describe the vendor, not the move." },
    { p: "Attribution was not tested. Several of these say they track referrals the way Mantle did. Nobody outside the companies can check that." },
    { p: "Prices are as published on 23 October 2026. When they change, each listing is updated first. If something here is wrong, use the report link on that tool's listing. It goes to an editor." },
    { p: "No tool paid to be in this post or to be left out of it, and none of the links earn anything." },
  ],
};
