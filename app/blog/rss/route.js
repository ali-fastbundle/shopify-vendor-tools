import { POSTS, postHtml } from "@/lib/blog";
import { SITE } from "@/lib/seo";

/*
 * The blog as RSS, full text, for the same reason as /changes/rss: a feed that
 * withholds its own content to drive clicks is what readers exist to escape.
 * The body goes in <content:encoded> as CDATA; `]]>` inside it is split so it
 * cannot close the section early. Links in it are absolute, and the dagger on
 * an unverified claim keeps its legend at the foot of every item.
 */
const esc = (s) => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&apos;");

const rfc822 = (day) => new Date(`${day}T09:00:00Z`).toUTCString();
const cdata = (s) => `<![CDATA[${String(s).replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;

export function GET() {
  const items = POSTS.map((p) => `    <item>
      <title>${esc(p.title)}</title>
      <link>${SITE}/blog/${p.slug}</link>
      <guid isPermaLink="true">${SITE}/blog/${p.slug}</guid>
      <pubDate>${rfc822(p.date)}</pubDate>
      <description>${esc(p.description)}</description>
      <content:encoded>${cdata(postHtml(p, SITE))}</content:encoded>
    </item>`).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>watchfor.tools: blog</title>
    <link>${SITE}/blog</link>
    <atom:link href="${SITE}/blog/rss" rel="self" type="application/rss+xml" />
    <description>Whole categories of Shopify app vendor tools side by side, by someone who sells none of them.</description>
    <language>en</language>
    <lastBuildDate>${rfc822((POSTS[0] && (POSTS[0].updated || POSTS[0].date)) || new Date().toISOString().slice(0, 10))}</lastBuildDate>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: { "content-type": "application/rss+xml; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}
