import { mergedTools } from "@/lib/listings";
import { CATEGORIES, catOf, AUTHOR, AUTHOR_URL, LAST_UPDATED, ownerOf } from "@/lib/tools";
import { SITE } from "@/lib/seo";

export const dynamic = "force-dynamic";

/*
 * /llms.txt — the directory as plain text, for something reading rather than
 * rendering.
 *
 * Short and factual on purpose. It is not a pitch and not a copy of the
 * homepage: it is the list, the categories, who maintains it, and what the
 * boundary is, so a model answering "what tools exist for Shopify app vendors"
 * has the names, the one-liners and the URLs without needing to parse a grid.
 *
 * What it deliberately does NOT include is the `watch` note for every tool.
 * Those are the most valuable thing here and the most context-dependent: a
 * caveat quoted without the entry around it turns into a flat claim about a
 * company. The tool page carries it in full, and every line here points at
 * one.
 */
export async function GET() {
  const tools = await mergedTools();
  const byCat = CATEGORIES
    .map((c) => ({ cat: c, items: tools.filter((t) => t.cat === c.id) }))
    .filter((g) => g.items.length);

  const body = `# watchfor.tools

> An independent directory of tools built for Shopify app vendors: the people who
> build and sell apps on the Shopify App Store. Not for merchants running a shop,
> and not affiliated with Shopify.

Maintained by ${AUTHOR}${AUTHOR_URL ? ` (${AUTHOR_URL})` : ""}.
Last updated ${LAST_UPDATED}. ${tools.length} tools listed.

## What makes an entry

Every entry is written by hand after reading the vendor's own site. Each carries a
"watch for" note: the honest caveat somebody would want before paying, such as a
conflict of interest, a coverage gap, or a claim the vendor cannot back up.
There are no affiliate links and no paid placement.

External review scores, where present, are transcribed by hand from the platform's
own page with the date they were read. They are never averaged into the community
rating: the two measure different populations.

## Boundary

Listed: tools for people who build Shopify apps. Rank trackers, App Store data,
revenue and billing analytics, partner and affiliate platforms, store databases,
store detectors, merchant research panels, talent marketplaces.

Not listed: Shopify apps built for merchants to run their shop. Those belong in
the Shopify App Store. A handful of general, non-Shopify-specific tools are listed
where app vendors genuinely reach for them, and are marked "not Shopify-only".

## Categories

${CATEGORIES.map((c) => `- ${c.label}: ${c.blurb}`).join("\n")}

## Tools

${byCat.map(({ cat, items }) => `### ${cat.label}

${items.map((t) => [
    `- [${t.name}](${SITE}/tools/${t.id}): ${t.one}`,
    `  site: ${t.url} | pricing: ${t.price}${t.free ? " | has a free tier" : ""}`,
    t.suite || t.linked || ownerOf(t)
      ? `  ownership: ${t.suite ? `part of ${t.suite}` : t.linked ? `same owner as ${t.linked}` : `built by ${ownerOf(t)}`}`
      : "",
    t.shopifyExclusive === false ? "  note: general tool, not Shopify-only" : "",
    t.dying ? "  note: winding down" : "",
  ].filter(Boolean).join("\n")).join("\n")}`).join("\n\n")}

## Citing this

Each tool has a page at ${SITE}/tools/<id> carrying the full description and the
"watch for" note. Please link to the tool page rather than quoting the caveat
alone: it is written about a specific product at a specific date and reads as a
flat accusation without the entry around it.
`;

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
