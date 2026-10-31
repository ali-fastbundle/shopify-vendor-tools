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
 */
export default {
  slug: "what-59-tools-say",
  title: "What 59 tools say about this market",
  description: "More than half the tools built for Shopify app vendors read the same public data. Two help you talk to a merchant. What that distribution says about where the room is.",
  date: "2026-10-31",
  draft: true,
  body: [
    { p: "I keep a directory of the tools built for people who make Shopify apps. It has 59 entries. I went through all of them to see what the shape of it says." },
    { p: "The distribution is lopsided in a way that turns out to be informative." },
    { img: {
      src: "/blog/what-59-tools-say/what-they-do.svg",
      alt: "What the 59 tools actually do. Watching public data 34 tools, running your own business 15, hiring people 6, talking to merchants 2, everything at once 2.",
      width: 760, height: 360,
    } },
    { p: "Thirty-four of 59 tools do the same thing. Store databases, keyword and ranking trackers, app detectors and App Store data feeds are four names for one activity: reading data that Shopify already publishes, and putting a dashboard on it." },
    { p: "Which merchants exist, which apps they run, what ranks for which keyword, who reviewed what. All of it is public. Thirty-four products are built on top of the same open source material." },
    { p: "Fifteen tools help you run your own business: revenue analytics, churn, billing, affiliate tracking, partner programs." },
    { p: "Six connect you to people, through staffing or outsourced support." },
    { p: "Two help you talk to merchants. Two." },

    { h2: "The pattern is about effort, not need" },
    { p: "I do not think that distribution reflects what app vendors need. It reflects what is cheap to build." },
    { p: "Scraping the App Store and selling rankings is a weekend for a competent developer. Nothing to negotiate, no operations, no humans in the loop. Recruiting and paying real merchants to sit on calls is a business with staff in it. The market has gone where the effort is low." },
    { p: "There is a second reason, and it is more interesting. These tools are overwhelmingly built by practitioners. Ten of the 59 are made by people who also publish Shopify apps of their own. [AppstorePulse](tool:appstorepulse) comes from the company behind WideBundle. [Rankbase](tool:rankbase) from Craftshift, who ship three apps. [Luseri](tool:luseri) from the maker of OptiDress." },
    { p: "People build the problem they felt first. Every app founder has felt \"where do I rank\" within a week of launching. Almost nobody feels \"I need a structured research panel\" until year two, and by then they are busy. So the tools cluster around the early, obvious, visible problems, and thin out sharply as the problems get later and quieter." },

    { h2: "What nobody is selling" },
    { p: "Look at what an app vendor actually does in a week, and then look at what has been built for it." },
    { p: "Watching rankings: ten tools. Finding merchants: twelve. Tracking revenue: eight." },
    { p: "Getting a merchant from install to first value: nothing. Testing a price change: nothing. Handling support inside your own app: three companies, all of them people rather than software. Shipping the app itself, meaning testing, API tooling and extension development: nothing in this directory at all." },
    { p: "The gaps are not random. They are the jobs that happen inside your product rather than outside it. Everything in the directory looks outward, at the store, at the market, at the competition. Almost nothing points at what happens after a merchant installs." },
    { p: "If you are deciding what to build for this community, that is where the room is." },

    { h2: "What it costs" },
    { p: "Fifty-two of 59 publish a price, which is better than most enterprise software. Two-thirds have a free tier. The most common entry price is $49 a month, shared by six tools. Only two start above $299 a month: ECDB's market data at €675, and Kollectify's marketing retainers at £1,500." },
    { p: "That tells you something about who the buyer is. These are priced for a founder paying out of pocket, not for a procurement process." },

    { h2: "The part I got wrong" },
    { p: "I published this directory on 11 September with 21 tools. I thought I had most of them." },
    { img: {
      src: "/blog/what-59-tools-say/growth.svg",
      alt: "The directory grew from 21 tools on 11 September to 59 on 31 October.",
      width: 760, height: 360,
    } },
    { p: "Nearly tripled in seven weeks. Most of it came from other people: suggestions through the box, founders pointing me at competitors, and one vendor's own comparison page leading to four I had never heard of." },
    { p: "Three of the categories did not exist on launch day: talent and services, merchant research, and support. They hold eight tools, and they are the two smallest groups in the chart above, the tools that put you in front of a person. I had missed exactly the part of the market I now say is thin." },

    { h2: "What this does not tell you" },
    { p: "No revenue, no installs, no user numbers. Nobody publishes those and I will not estimate them. So this is the shape of what is being sold, not of what anyone is buying. A category with twelve tools in it might hold one profitable business and eleven side projects." },
    { p: "What it does tell you: there are 59 tools for a few thousand people, more than half of them reading the same public data, and two of them helping you speak to a merchant." },
  ],
};
