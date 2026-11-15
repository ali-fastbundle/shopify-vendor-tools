/*
 * Who owns the affiliate tool you give your partner data to. Reframed on
 * 2026-11-15 at the editor's request: a feature and price comparison of the
 * affiliate tools is a table, and /blog/after-mantle already has one. This
 * post is about ownership only, and it accuses nobody of misusing data.
 *
 * Checked on 15 November 2026:
 *   - PartnerJam: partnerjam.com says "The service is developed and managed by
 *     fellow Shopify app developers from Digismoothie", footer "© 2026
 *     Digismoothie". digismoothie.com lists Candy Rack, Gift Box, Nada,
 *     Payster, PartnerJam and Setpilot under "Shopify Apps". The App Store
 *     listing apps.shopify.com/candyrack names Digismoothie as developer
 *     (partners/digismoothie): upsell, cross-sell and volume bundles.
 *     PartnerJam's FAQ: the Partner API token "encompasses all public and
 *     private apps managed by your organization" and cannot be limited to one.
 *   - PartnerDock: getpartnerdock.com, "Built by the team behind The SaaS Hub",
 *     footer "© 2026 The SaaS Hub". The owner row (lib/owners.js) records
 *     SaaSOri and the Shopify App Founders Edition newsletter. No Shopify app
 *     published by TheSaaSHub was found, so the brief's "four app publishers"
 *     is three, and this post says so.
 *   - Affilitrak: affilitrak.com/for-apps names no person or company. The App
 *     Store developer page apps.shopify.com/partners/sunlight-dev ("Apps by
 *     Affilitrak") lists Affilitrak Affiliate Marketing, a merchant affiliate
 *     app. The tie to Beckett Oliphant is the owner row's, from his own launch
 *     announcement (checked 2026-10-31).
 *   - Orbit and Elevate: the owner row (Marmeto's own site) names Marmeto as
 *     the team behind Return Prime and Recurpay. recurpay.com carries a banner
 *     for "Elevate by Marmeto". The App Store listing for Return Prime names
 *     Appsdart Solutions Private Limited as developer, and the post says so.
 *     marmeto.com refused a TLS connection from here on 2026-11-15.
 *   - Shoffi: shoffi.app footer "© 2026 Avit Tech, LLC". No founder named. A
 *     web search found no Shopify app from Avit Tech. The App Store's own
 *     search is closed to crawlers by its robots.txt, so it was not searched.
 *   - PartnerStack: owned by AppDirect (owner row). No Shopify app from either
 *     was found.
 */
export default {
  slug: "who-owns-your-affiliate-tool",
  title: "Who owns the affiliate tool you give your partner data to",
  description: "Three of the main affiliate tools for Shopify apps are built by companies that also sell Shopify apps. Who owns which, which are independent, and what to ask.",
  categories: ["partner"],
  date: "2026-11-15",
  body: [
    { p: "An affiliate tool for a Shopify app needs your Partner API token. Through it, the tool sees your installs, your revenue and which partner sent each merchant. Before you connect one, it is worth knowing who else that company sells to." },
    { p: "Of the main affiliate tools for Shopify apps, three are built by companies that also publish Shopify apps. A fourth is built by a company that publishes a newsletter and runs a paid app directory for the same audience. None of this means anyone has misused data. Nothing found here suggests that. The point is that you should know before you connect." },
    { note: "Ownership was checked on 15 November 2026, on each tool's own site, its App Store developer page and the owner pages in this directory. None of the tools was run for this post. Features and prices are not compared here. The [after-Mantle post](https://watchfor.tools/blog/after-mantle) does that." },

    { h2: "Why ownership matters more here" },
    { p: "A rank tracker sees which keywords you follow. That is useful to a competitor, and most of it is public anyway. An affiliate tool sees things that are not public. Which agencies send you merchants. Which partners convert. What a referral is worth to you, and what you pay for it." },
    { p: "That is a list of your best sales channels, with prices. It is the data a competing app would most want to see. The token also reaches further than one app. PartnerJam's own FAQ says it plainly: the Partner API token covers every app your organization manages, and it cannot be limited to one." },

    { h2: "Who owns what" },
    { ul: [
      "[PartnerJam](tool:partnerjam) is built by Digismoothie. Its site says so. Digismoothie also publishes Candy Rack, an upsell, cross-sell and bundles app, and other merchant apps.",
      "[Orbit](tool:orbit) and [Elevate](tool:elevate) are part of [Marmeto](https://watchfor.tools/owners/marmeto). Marmeto says it is the team behind Return Prime, a returns app, and Recurpay, a subscriptions app. The App Store lists Return Prime's developer as Appsdart Solutions, a name Marmeto's site does not explain.",
      "[Affilitrak](tool:affilitrak) is by [Beckett Oliphant](https://watchfor.tools/owners/beckett-oliphant). Its site names nobody. The same developer account publishes Affilitrak Affiliate Marketing, an affiliate app for merchants, on the App Store.",
      "[PartnerDock](tool:partnerdock) is built by [TheSaaSHub](https://watchfor.tools/owners/thesaashub). No Shopify app from TheSaaSHub was found. It publishes the [Shopify App Founders Edition](newsletter:shopifyappfounders) newsletter and runs [SaaSOri](tool:saasori), where apps pay to be listed.",
    ] },
    { p: "Whether any of this matters depends on what you build. A subscriptions app has a reason to ask about Marmeto. An upsell or bundles app has a reason to ask about Digismoothie. An app that sells affiliate programs to merchants has a reason to ask about Affilitrak. For TheSaaSHub, the question is different. It sells placement and writes about the market, so it is in a position to know which apps are growing." },

    { h2: "Which are independent" },
    { p: "Two of the affiliate tools listed here are not owned by a company that publishes Shopify apps, as far as could be checked." },
    { ul: [
      "[Shoffi](tool:shoffi) is run by Avit Tech, LLC, the name in its footer. No Shopify app from Avit Tech was found. The App Store's own search is closed to crawlers, so it was not searched.",
      "[PartnerStack](tool:partnerstack) is owned by AppDirect. Neither publishes a Shopify app that could be found. It is a general platform that does not connect to the Partner API.",
    ] },
    { p: "[Krutva](tool:krutva) is not counted either way. Too little is published about it to say." },
    { p: "Independent is not the same as better. It means one question less to ask. The others may still be the right choice, if their answers to the questions below are good." },

    { h2: "What to ask before you sign up" },
    { ul: [
      "Is my data used in aggregate? For benchmarks, market reports or anything shown to other customers.",
      "Can your own app teams see it? Who in the company has access, and is that written down.",
      "What happens to my partner records if I leave? Can I export partners, referral links and payout history, and is my data deleted after.",
      "Does the token you ask for reach my other apps? If it does, what do you read from them.",
    ] },
    { p: "Ask in writing. A clear answer is a good sign, whoever owns the tool." },

    { h2: "Why I checked" },
    { p: "I nearly chose one of these tools myself. Then I found out the same company runs an app that competes with the one I work on. It changed the decision. Nothing was wrong with the tool. I did not want that company to see who sends us business." },
  ],
};
