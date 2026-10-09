/*
 * The App Store ASO tools, side by side. Every fact here is either on the
 * tool's own listing (linked, never repeated at length) or was read on the
 * vendor's own site on the day of publication, and anything the vendor says
 * about itself that we did not check is marked {†...}.
 *
 * The two ownership facts the post leans on were checked against the
 * companies' own documents, not against each other's marketing:
 *   - AppJubilee's page metadata and StoreCensus's About page both name
 *     Dark Ecommerce Labs, LLC.
 *   - AppstorePulse's and WideBundle's terms of use both name The Wide Company.
 */
export default {
  slug: "shopify-app-store-aso-tools-compared",
  title: "Fourteen Shopify App Store ASO tools, compared by someone who sells none of them",
  description: "Every App Store ASO and rank-tracking tool in the directory, judged on stated criteria, with who owns each one and which figures are the vendor's own.",
  date: "2026-10-10",
  updated: "2026-10-10",
  body: [
    { p: "A vendor's comparison page is written by one of the products in it. AppJubilee publishes one setting itself against its rivals, and its conclusion is AppJubilee. That is ordinary marketing. It is also why a developer choosing a rank tracker ends up reading a dozen pages that each reach the same verdict about a different product." },
    { p: "This one is written by someone who sells none of these tools. The directory takes no affiliate commission and no paid placement, so no link below earns anything. Each tool already has a listing here with its full pricing and caveats; this post links to those rather than copying them, and adds the one thing a listing cannot do, which is put all fourteen side by side." },
    { note: "None of these tools was run for this post. What each one is said to do is what its vendor's own site says it does, read directly; who owns each one was checked against the companies' own pages and terms. Figures a vendor publishes about itself, such as how many apps or keywords it tracks, are marked † because nobody outside can check them." },

    { h2: "How they were judged" },
    { p: "The criteria first, so the verdicts can be argued with rather than taken on trust:" },
    { ul: [
      "What it measures. Keyword positions, category positions, or the money behind them. These are different jobs, and a lot of the confusion in this category comes from tools that do one being compared with tools that do another.",
      "What you have to hand over. Some need nothing. Some need a Partner API key, which carries your full revenue history, or a GA4 export to BigQuery. The more a tool needs, the more it matters who runs it.",
      "Who owns it, and whether they compete with you. Several are built by companies that sell Shopify apps of their own. That is not a flaw in the product. It is a fact about who could see your keyword list.",
      "What it costs past the free tier, as published on the vendor's own pricing page.",
      "Whether it will be here next year.",
    ] },
    { p: "Not judged: accuracy. Each tool collects ranking data from the public App Store on its own schedule, and this post did not test which one is closer to the truth, so it does not rank them on it." },

    { h2: "Who owns what" },
    { p: "This is the section the rest depends on, because a comparison of tools that share owners is not fourteen independent opinions." },
    { ul: [
      "[AppJubilee](tool:appjubilee) and [StoreCensus](tool:storecensus) are the same company. AppJubilee's pages carry Dark Ecommerce Labs, LLC as their author, StoreCensus's About page names the same company, and StoreCensus links to AppJubilee's keyword tool from its own pages. A comparison page from one and praise from the other are one vendor speaking twice.",
      "[AppstorePulse](tool:appstorepulse) and WideBundle are run by the same company. The terms of use on both sites name The Wide Company. WideBundle is a bundle app, so a team selling bundles would be tracking its keywords inside a dashboard run by a competitor in the same listings.",
      "[Rankbase](tool:rankbase) started as Craftshift's internal tracker, and Craftshift sells product image and variant apps.",
      "[LetsMetrix](tool:letsmetrix) is owned by OmegaTheme, which runs a large portfolio of Shopify apps.",
      "[Becketto Rank Tracker](tool:becketto) is one developer's free side project, and the same developer publishes an affiliate app.",
      "[Ranksy](tool:ranksy) and [SaaS Insights](tool:saasinsights) name no company and no person anywhere on their sites, and [AppVitals](tool:appvitals) names one person, a sole trader, only on its legal notice. All three ask for a Partner API key.",
    ] },
    { p: "None of this is a reason to avoid a tool. It is a reason to know whose dashboard your keyword strategy and your revenue sit in before you connect anything." },

    { h2: "Side by side" },
    { table: {
      head: ["Tool", "Best at", "Price as published", "Needs from you", "Who runs it"],
      rows: [
        ["[AppJubilee](tool:appjubilee)", "Finding keywords without a list", "$49 for 1 app to $499 for 30, a month", "Nothing to start", "Dark Ecommerce Labs (also StoreCensus)"],
        ["[Rankbase](tool:rankbase)", "Daily positions with install sources", "$49 for 5 apps or $99 for 20, a month", "GA4 with existing traffic", "Craftshift (also sells apps)"],
        ["[SAMI](tool:tracksami)", "Seeing what an app already ranks for", "Not published", "Nothing stated", "Not recorded"],
        ["[AppstorePulse](tool:appstorepulse)", "Keywords, competitor alerts and MRR together", "Free tier, then paid", "Partner account, for the MRR half", "The Wide Company (also WideBundle)"],
        ["[BestAppify](tool:bestappify)", "ASO plus marketing, over MCP", "Free plan available", "Nothing stated", "Not recorded"],
        ["[LetsMetrix](tool:letsmetrix)", "Sizing the category you compete in", "Free", "Nothing", "OmegaTheme (also sells apps)"],
        ["[AppNavigator](tool:appnavigator)", "Checking one competitor", "Free", "Nothing, not even an account", "Ablestar"],
        ["[Applora](tool:applora)", "Questions across the whole store", "Free, Pro $49 a month", "Nothing", "Not recorded"],
        ["[Becketto Rank Tracker](tool:becketto)", "One keyword's history", "Free", "Nothing to look", "One developer"],
        ["[Ranksy](tool:ranksy)", "A keyword to the customer who paid", "$39 or $89 a month", "BigQuery export and a Partner API key", "Not named"],
        ["[AppVitals](tool:appvitals)", "Revenue rebuilt from raw events, with ranks", "Free under $1k MRR, then from $15 a month", "Partner API key; BigQuery for the GA4 half", "A sole trader"],
        ["[SaaS Insights](tool:saasinsights)", "Revenue and ranks on one dashboard", "Free under $2.5k MRR, then $49 a month", "Partner API key", "Not named"],
        ["[Meridian](tool:meridian)", "The whole app lifecycle", "$69 or $169 per app a month", "A place in early access", "Not recorded"],
        ["[SASI](tool:sasi)", "Nothing new: winding down", "Free", "Nothing", "Mantle"],
      ],
    } },
    { p: "\"Not recorded\" means the directory's listing does not name an owner, not that the company hides one." },

    { h2: "The verdicts, by job" },

    { h3: "Checking a competitor, free, without an account" },
    { p: "[AppNavigator](tool:appnavigator) is the lightest way in: ranking history, reviews, new launches and weekly movers across {†26,416 apps}, most of it open without signing up. It is read-only, with no alerts and nothing about your own listing. [Applora](tool:applora) is the one for questions that span the whole store rather than one app, and it answers them over MCP as well as on the web, across {†28.2K apps}. [LetsMetrix](tool:letsmetrix) is best at sizing the pool you actually compete in, and [Becketto Rank Tracker](tool:becketto) shows one keyword's history at a time." },
    { p: "Verdict: AppNavigator for one competitor, Applora for anything wider. Neither replaces tracking your own listing." },

    { h3: "Tracking your own keywords every day" },
    { p: "[Rankbase](tool:rankbase) is the most specific about what it measures: daily positions with up to a year of history, and installs split between organic search and paid ads, which is why it needs a GA4 connection and existing traffic. [AppJubilee](tool:appjubilee) discovers keywords for you rather than asking for a list, needs no GA4, tracks {†1,200+ keywords a day}, and is priced by the number of apps, from 1 to 30. [SAMI](tool:tracksami) starts from what an app already ranks for, against a {†27,000+ keyword} database, and compares up to 40 apps at once, but publishes no price. [AppstorePulse](tool:appstorepulse) puts keywords, competitor change alerts and Partner MRR in one place; its free tier is one app, three keywords and one competitor, and its search volume is a relative estimate rather than a number. [BestAppify](tool:bestappify) adds affiliate and influencer marketing to the rankings and exposes it all over MCP, across {†10,800+ apps}." },
    { p: "Verdict: apps with GA4 traffic, Rankbase, which also covers a portfolio most cheaply at $99 for 20 apps. Apps without GA4, or where you want the keywords found for you, AppJubilee, at $199 for 8 or $499 for 30, read alongside the ownership note above. No budget yet: AppstorePulse's free tier will show whether daily tracking changes anything you do, and if you sell bundles, weigh who runs it first." },

    { h3: "Following a keyword through to revenue" },
    { p: "[Ranksy](tool:ranksy) is built around attribution: it joins BigQuery listing traffic to Partner API revenue so a keyword resolves to the customer it produced, and both tiers include it. There is no free plan, and data you have not been exporting to BigQuery is not backfilled. [AppVitals](tool:appvitals) rebuilds MRR, churn and retention from the raw Partner event feed, adds GA4 attribution, rank tracking and uptime checks, and prices by your MRR. [SaaS Insights](tool:saasinsights) shows Partner revenue and keyword rankings on one dashboard, alongside each other; it does not claim to join one to the other." },
    { p: "Verdict: Ranksy if attribution is the question and you already export to BigQuery. AppVitals if you want the revenue numbers rebuilt from source and are comfortable with one person holding them. SaaS Insights if you want both views without the join. All three ask for a Partner API key, which is the moment to reread who runs each one." },

    { h3: "Everything in one place" },
    { p: "[Meridian](tool:meridian) wraps App Store analytics into a platform that also hosts the app, runs billing, keeps a CRM and sends email. It is in closed early access and onboards one developer at a time, which is worth weighing against how much it would hold." },

    { h3: "Not a place to start" },
    { p: "[SASI](tool:sasi) is Mantle's App Store index and is winding down with Mantle. Anything that depends on it is worth moving now." },

    { h2: "What this cannot tell you" },
    { p: "Prices and features are as each vendor published them, on the dates shown on each listing; AppJubilee's were read again on the day this was published. They move, and the listing is where a change lands first. If something here is wrong, the report link on that tool's listing goes to an editor, and a correction to this post will say what changed and when." },
    { p: "No tool paid to be in this post or to be left out of it, and none of the links in it earn anything." },
  ],
};
