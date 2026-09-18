import { feedEntries } from "@/lib/feed";
import { SITE } from "@/lib/seo";
import { catOf } from "@/lib/tools";

export const dynamic = "force-dynamic";

/*
 * RSS, because the people who would follow a weekly feed of Shopify app-vendor
 * tooling changes are developers, and a good number of them still run a reader.
 * It costs one route and it is the only way to follow this site that does not
 * involve handing over an email address.
 *
 * Full text in the description rather than a teaser. The entries are two
 * sentences; there is nothing to click through for, and a feed that withholds
 * its own content to drive traffic is the thing readers exist to escape.
 */

const esc = (s) => String(s ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&apos;");

/* RFC 822, which is what RSS wants and what Date.toUTCString already produces. */
const rfc822 = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? new Date().toUTCString() : d.toUTCString();
};

export async function GET() {
  const entries = await feedEntries({ limit: 100 });
  const updated = entries[0]?.at || new Date().toISOString();

  const items = entries.map((e) => `    <item>
      <title>${esc(`${e.toolName}: ${e.headline.slice(0, 120)}`)}</title>
      <link>${esc(`${SITE}/tools/${e.toolId}`)}</link>
      <guid isPermaLink="false">${esc(`${SITE}/changes#${e.id}`)}</guid>
      <pubDate>${rfc822(e.at)}</pubDate>
      <category>${esc(catOf(e.cat).label)}</category>
      <description>${esc(e.headline)}${e.sourceUrl ? esc(` Source: ${e.sourceUrl}`) : ""}</description>
    </item>`).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>watchfor.tools: what changed</title>
    <link>${SITE}/changes</link>
    <atom:link href="${SITE}/changes/rss" rel="self" type="application/rss+xml" />
    <description>Pricing moves, new features, rebrands and wind-downs across tools built for Shopify app vendors.</description>
    <language>en</language>
    <lastBuildDate>${rfc822(updated)}</lastBuildDate>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": "public, max-age=900",
    },
  });
}
