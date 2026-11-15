/*
 * The category overlap map on /categories, explained. Ali's text
 * (2026-11-15), used as written with the figures corrected to the live
 * directory and four claims fixed against the catalogue:
 *
 *   - Live figures, read from watchfor.tools/llms.txt and the tool count on
 *     2026-11-15: 65 tools (63 in lib/tools.js plus two published from the
 *     review queue), 83 category placements, so 18 beyond each tool's main
 *     one. The four public-data categories: Store databases 16, ASO 15,
 *     Store detectors 14, App Store data 3 = 48 of 83, 58 per cent.
 *   - 15 tools in more than one category (the queue entries add no
 *     placement: live and file agree on 18). Rival pairs: 12, from `competes`.
 *   - The 18 secondary placements land in six categories, not five: ASO 5,
 *     Analytics & billing 4, Partner & affiliate 3, Store detectors 3, Store
 *     databases 2 and App Store data 1 (BestAppify). Talent, support, suites,
 *     merchant research and listing channels have none.
 *   - 13 of the 15 tools in more than one category touch a public-data
 *     category. The two that do not are Elevate and Marmeto.
 *   - LetsMetrix is the third tool in three categories, after Marmeto and
 *     Meridian. Its affiliate platform runs on the Partner API and GA4, not
 *     on a crawl, and when it launched is not published, so "in a week" and
 *     "a crawl it already ran" are not in the post.
 *   - The overlaps in the catalogue pair ASO with App Store data (the App
 *     Store crawl) and store databases with detectors (the storefront crawl),
 *     so the post names those two crawls instead of one.
 *   - "Dark dots" became filled: in the dark theme they are light.
 *
 * The chart's numbers are not in this file: `from: "category-placements"`
 * draws it from the live tool count each time the page renders.
 */
export default {
  slug: "category-map",
  title: "A map of where the tools sit",
  description: "The categories page has a map of which tools serve which categories. What it shows: the overlap stays among the tools that read public data.",
  categories: ["aso", "storedb", "detect", "data", "biz", "partner"],
  date: "2026-11-15",
  body: [
    { p: "The [categories page](/categories) has a map on it now. This explains what it shows and what I noticed while building it." },
    { img: { src: "/blog/category-map/map.png", alt: "The category map on the categories page: eleven coloured category circles, tools as dots joined to them by solid and dashed lines, the tools in more than one category named", width: 1294, height: 776 } },

    { h2: "How it works" },
    { p: "Each coloured circle is a category. Each dot is a tool." },
    { p: "A solid line runs from a tool to its main category. A dashed line runs to every other category it also serves. Filled dots are tools in more than one category. Hollow dots sit in one." },
    { p: "Fifteen of the 65 tools are in more than one category. Those are the only tools named on the map until you zoom in or point at one, because they are the ones doing the connecting. The rest would be fifty labels with nothing to say." },
    { p: "You can switch on the rivals layer, which draws a line between tools that name each other as competitors. There are twelve such pairs. Click any node to open its page." },
    { p: "It is a desktop view. On a phone you get the list above it, which holds the same tools." },

    { h2: "What the shape shows" },
    { chart: {
      from: "category-placements",
      title: "Tools in each category: the ones that lead there, and the ones that also serve it",
      caption: "Drawn from the directory's live tool count each time this page loads, so it can move after this post was written.",
    } },
    { p: "Two things stand out once it is drawn." },
    { p: "The overlap stays on one side of the map. All eighteen secondary placements land in six categories: store databases, ASO, detectors, App Store data, analytics and billing, and partner. Talent, support, suites, merchant research and listing channels have none. Not one tool extends into them from somewhere else." },
    { p: "That is not a coincidence. A tool that reads public App Store data can add a second public-data feature in an afternoon. Rank tracking and App Store data come from the same crawl of the App Store. Store databases and detectors come from the same crawl of storefronts. So the crowded categories are also the connected ones, and they keep connecting to each other." },
    { p: "It happened again while I was writing this. [LetsMetrix](tool:letsmetrix), a rank tracker, added a free affiliate platform for app developers. It became the third tool in three categories, after [Marmeto](tool:marmeto) and [Meridian](tool:meridian). It offered one more thing to the app developers it already had." },
    { screen: "letsmetrix", caption: "LetsMetrix runs its affiliate platform at aff.letsmetrix.com." },
    { p: "Merchant research cannot be extended into. Neither can outsourced support. You cannot bolt “we also recruit merchants for interviews” onto a dashboard, because it means finding people, paying them and running the calls. There is no cheap edge to cross." },
    { p: "So the market is lopsided twice over. Lopsided in count, which I [wrote about last month](/blog/what-59-tools-say). And lopsided in connection: the four categories that read public data hold 48 of the 83 placements, 58 per cent, and almost all the overlap. 13 of the 15 tools in more than one category touch one of them. The categories involving a human being sit alone at the edge of the map." },

    { h2: "What the map does not show" },
    { p: "Size. A category with sixteen tools might hold one real business and fifteen weekend projects. Nothing here says which." },
    { p: "It also does not show quality, usage or whether anyone is paying. It shows what has been built and how the pieces relate." },
    { p: "The rivals layer is only what vendors themselves publish. If two tools compete and neither says so, there is no line between them." },
    { note: "The figures in the text are the live directory on 15 November 2026: 65 tools, two of them published from the review queue rather than the catalogue file. The picture of the map was taken the same day." },
  ],
};
