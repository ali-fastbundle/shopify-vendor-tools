/*
 * What the whole tools catalogue says, by shape. Ali's text, from
 * what-59-tools-say.md, with three figures corrected against the live
 * catalogue on 31 October 2026 before it went in:
 *
 *   - "Fifty-one of 59 publish a price" is 52: ECDB publishes plans from
 *     €675 a month (ecdb.com/pricing, read 31 October), and Storetasker states
 *     projects from $400. Seven publish nothing.
 *   - "nothing charges more than $299 to start" is not true: ECDB starts at
 *     €675 a month and Kollectify's retainers at £1,500 a month.
 *   - "Not one opened a new one" is not true: Talent & services and Merchant
 *     research opened on 15 September and Support & CX on 21 September
 *     (git log of lib/tools.js). Those three hold the eight tools in the two
 *     smallest groups of chart one.
 *
 * Chart one counts primary categories: watching public data is Store
 * databases 12 + App Store ASO 10 + Store detectors 10 + App Store data 2 =
 * 34; running your own business is Analytics & billing 8 + Partner &
 * affiliate 7 = 15; hiring people is Talent & services 3 + Support & CX 3 =
 * 6; talking to merchants is Merchant research 2; the two Ecosystem suites
 * are in its description. Ten tools are made by people who publish Shopify
 * apps of their own, each stated in the catalogue (owner notes and watches).
 *
 * Edited 6 November 2026 to cut AI patterns (ali-voice, stop-slop) and to
 * draw the charts on the page. The growth chart is the published count in
 * lib/tools.js at the end of each day it changed, from git history (acorn
 * over each day's last commit). The file reads 57 on 31 October; the other
 * two of the 59 were published from the suggestion queue (svt:entries), whose
 * dates git does not hold, and the caption says so. The weekly-jobs chart
 * uses the post's own counts.
 */
export default {
  slug: "what-59-tools-say",
  title: "What 59 tools say about this market",
  description: "More than half the tools built for Shopify app developers read the same public data. Two help you talk to a merchant. What that says about what nobody has built yet.",
  date: "2026-10-31",
  updated: "2026-11-06",
  body: [
    { p: "I keep a directory of the tools built for people who make Shopify apps. It has 59 entries. I went through all of them and sorted them by what they do." },
    { chart: {
      type: "bars",
      title: "What the 59 tools do",
      labelHead: "Job", valueHead: "Tools",
      bars: [
        { label: "Watch public data", value: 34 },
        { label: "Run your own business", value: 15 },
        { label: "Hire people", value: 6 },
        { label: "Talk to merchants", value: 2 },
        { label: "Everything at once (suites)", value: 2 },
      ],
      source: "Counted by each tool's main category in the directory on 31 October 2026.",
    } },
    { p: "34 of the 59 tools do the same thing. Store databases, keyword and rank trackers, app detectors and App Store data feeds all read data that Shopify already publishes, and put a dashboard on it." },
    { p: "Which merchants exist, which apps they run, what ranks for which keyword, who reviewed what: all of it is public." },
    { p: "15 tools help you run your own business: revenue analytics, churn, billing, affiliate tracking and partner programs. 6 connect you to people: developers to hire, or a support team. 2 help you talk to merchants." },

    { h2: "Why it looks like this" },
    { p: "I think the split shows what is cheap to build, more than what app developers need." },
    { p: "A competent developer can scrape the App Store and sell rankings within a weekend. There is nobody to hire and nothing to negotiate. A research panel means finding merchants, paying them and running the calls. That needs staff." },
    { p: "Second, people who sell apps build most of these tools. Ten of the 59 come from people who also publish Shopify apps of their own. [AppstorePulse](tool:appstorepulse) comes from the company behind WideBundle. [Rankbase](tool:rankbase) comes from Craftshift, who ship three apps. [Luseri](tool:luseri) comes from the maker of OptiDress." },
    { p: "Founders build for the problem they had first. You ask \"where do I rank\" in the first week after launch. You might want a research panel in year two, and by then you are busy. So the directory has many tools for the first problems and few for the later ones." },

    { h2: "What is missing" },
    { chart: {
      type: "bars",
      title: "Tools in the directory for each job an app developer does",
      labelHead: "Job", valueHead: "Tools",
      bars: [
        { label: "Finding merchants", value: 12 },
        { label: "Watching rankings", value: 10 },
        { label: "Tracking revenue", value: 8 },
        { label: "Support inside your app", value: 3, show: "3, all people, no software" },
        { label: "Getting a merchant to first value", value: 0 },
        { label: "Testing a price change", value: 0 },
        { label: "Shipping the app itself", value: 0 },
      ],
      caption: "The last three rows are empty.",
    } },
    { p: "Getting a merchant from install to first value has no tool here. Neither does testing a price change. Support inside your own app has three companies, and all three sell people, not software. Shipping the app itself, meaning testing, API tooling and extension development, has nothing in this directory at all." },
    { p: "The empty rows are the jobs inside your app. The tools in this directory look at the store, the market and the competition. Almost none look at what a merchant does after installing." },
    { p: "If you want to build a tool for app developers, those jobs have no tool in this directory yet." },

    { h2: "What it costs" },
    { p: "52 of the 59 publish a price. Two thirds have a free tier. The most common entry price is $49 a month, shared by six tools. Only two start above $299 a month: ECDB's market data at €675, and Kollectify's marketing retainers at £1,500." },
    { p: "These prices are for a founder paying with their own card, not for a company with a buying process." },

    { h2: "The part I got wrong" },
    { p: "I published this directory on 11 September with 21 tools. I thought I had most of them." },
    { chart: {
      type: "steps",
      title: "Tools in the directory, 11 September to 31 October 2026",
      valueHead: "Tools",
      points: [
        { x: "2026-09-11", y: 21 }, { x: "2026-09-15", y: 24 }, { x: "2026-09-18", y: 33 }, { x: "2026-09-19", y: 37 },
        { x: "2026-09-21", y: 40 }, { x: "2026-10-01", y: 42 }, { x: "2026-10-08", y: 43 }, { x: "2026-10-09", y: 44 },
        { x: "2026-10-10", y: 47 }, { x: "2026-10-14", y: 48 }, { x: "2026-10-17", y: 50 }, { x: "2026-10-18", y: 53 },
        { x: "2026-10-20", y: 54 }, { x: "2026-10-30", y: 57 },
        { x: "2026-10-31", y: 57 },
      ],
      yMax: 60,
      caption: "Each point is a day tools were added to the catalogue file. Two more were published from the suggestion queue, which makes 59 on 31 October.",
    } },
    { p: "The directory nearly tripled in seven weeks. Most of the new entries came from other people: suggestions through the form, founders naming their competitors, and one vendor's comparison page that named four tools I had not heard of." },
    { p: "Three of the categories did not exist on launch day: talent and services, merchant research, and support. They hold eight tools, and they are the two smallest groups in the first chart, the tools that put you in front of a person. I had missed the part of the market that I now say is thin." },

    { h2: "What this does not tell you" },
    { p: "No revenue, no installs, no user numbers. Nobody publishes those and I will not estimate them. So this shows what is for sale. It does not show what anyone buys. A category with twelve tools in it might hold one profitable business and eleven side projects." },
    { p: "59 tools serve a few thousand people. More than half of them read the same public data, and two of them help you speak to a merchant." },
  ],
};
