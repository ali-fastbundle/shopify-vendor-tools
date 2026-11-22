import { withShareImage } from "@/lib/ogCard";
import { mergedNewsletters } from "@/lib/listings";
import { LAST_UPDATED } from "@/lib/tools";
import { SITE, NEWSLETTERS_URL, IDS } from "@/lib/seo";
import JsonLd from "@/components/JsonLd";
import Newsletters from "@/components/Newsletters";
import SectionView from "@/components/SectionView";
import { pageNewsletters } from "@/lib/pageData";

/* Cached, not rendered per request (CLAUDE.md, Page caching and CPU). The
   data and the share image version come through tagged reads, so a write to
   any store key this page shows re-renders it at once; the hour is a backstop. */
export const revalidate = 3600;

const title = "Newsletters for Shopify App Developers | watchfor.tools";
const description =
  "Newsletters worth an app developer's time: a couple about the Shopify platform itself, the rest merchant-side media read sideways for demand signal. Each with the honest caveat.";

const baseMetadata = {
  title,
  description,
  alternates: { canonical: "/newsletters", types: { "text/markdown": [{ url: "/newsletters.md", title: "Plain text for agents" }] } },
  openGraph: { title, description, type: "website", url: NEWSLETTERS_URL, siteName: "watchfor.tools" },
  twitter: { card: "summary", title, description },
};

/* Async because the share image is versioned on live data (lib/ogCard.js). */
export async function generateMetadata() {
  return withShareImage(baseMetadata);
}

export default async function Page() {
  const newsletters = await pageNewsletters();
  /* The only index page that had no structured data. Same shape as /events
     and /blog: the page, and the list of what is on it. */
  const graph = {
    "@type": "CollectionPage",
    "@id": `${NEWSLETTERS_URL}#collection`,
    url: NEWSLETTERS_URL,
    name: "Newsletters",
    isPartOf: { "@id": IDS.website },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: newsletters.length,
      itemListElement: newsletters.map((n, i) => ({
        "@type": "ListItem", position: i + 1, url: `${SITE}/newsletters/${n.id}`, name: n.name,
      })),
    },
  };
  return (
    <>
      <SectionView id="newsletters" />
      <JsonLd data={graph} />
      <Newsletters newsletters={newsletters} lastUpdated={LAST_UPDATED} />
    </>
  );
}
