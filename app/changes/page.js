import { feedEntries } from "@/lib/feed";
import { mergedTools } from "@/lib/listings";
import { SITE } from "@/lib/seo";
import ChangesFeed from "@/components/ChangesFeed";

export const dynamic = "force-dynamic";

const title = "Recent updates | watchfor.tools";
const description =
  "Pricing moves, new features, rebrands and wind-downs across tools for Shopify app vendors, dated and in order.";

export const metadata = {
  title,
  description,
  /* So a reader that lands on the page can find the feed without being told. */
  alternates: {
    canonical: "/changes",
    types: { "application/rss+xml": [{ url: "/changes/rss", title: "watchfor.tools: recent updates" }] },
  },
  openGraph: { title, description, type: "website", url: `${SITE}/changes`, siteName: "watchfor.tools" },
};

export default async function Page() {
  const [entries, tools] = await Promise.all([feedEntries({ limit: 300 }), mergedTools()]);

  /*
   * A CollectionPage of dated items. This is the page that moves weekly, which
   * is the one crawlers come back for, so it is worth being explicit about what
   * it holds rather than leaving it as an unlabelled list.
   */
  const graph = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${SITE}/changes#collection`,
    url: `${SITE}/changes`,
    name: "Recent updates",
    description,
    isPartOf: { "@id": `${SITE}#website` },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: entries.length,
      itemListElement: entries.slice(0, 100).map((e, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: {
          "@type": "Article",
          headline: e.headline.slice(0, 110),
          datePublished: e.date,
          about: { "@type": "SoftwareApplication", name: e.toolName, url: `${SITE}/tools/${e.toolId}` },
          url: `${SITE}/tools/${e.toolId}`,
        },
      })),
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }} />
      <ChangesFeed entries={entries} tools={tools} />
    </>
  );
}
