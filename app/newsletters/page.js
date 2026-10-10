import { withShareImage } from "@/lib/ogCard";
import { mergedNewsletters } from "@/lib/listings";
import { LAST_UPDATED } from "@/lib/tools";
import { SITE, NEWSLETTERS_URL, IDS } from "@/lib/seo";
import JsonLd from "@/components/JsonLd";
import Newsletters from "@/components/Newsletters";
import SectionView from "@/components/SectionView";

export const dynamic = "force-dynamic";

const title = "Newsletters for Shopify app vendors | watchfor.tools";
const description =
  "Newsletters worth an app vendor's time: a couple about the Shopify platform itself, the rest merchant-side media read sideways for demand signal. Each with the honest caveat.";

const baseMetadata = {
  title,
  description,
  alternates: { canonical: "/newsletters" },
  openGraph: { title, description, type: "website", url: NEWSLETTERS_URL, siteName: "watchfor.tools" },
  twitter: { card: "summary", title, description },
};

/* Async because the share image is versioned on live data (lib/ogCard.js). */
export async function generateMetadata() {
  return withShareImage(baseMetadata);
}

export default async function Page() {
  const newsletters = await mergedNewsletters();
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
