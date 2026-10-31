import { withShareImage } from "@/lib/ogCard";
import { mergedPodcasts } from "@/lib/listings";
import { SITE, PODCASTS_URL, IDS } from "@/lib/seo";
import JsonLd from "@/components/JsonLd";
import Podcasts from "@/components/Podcasts";
import SectionView from "@/components/SectionView";

export const dynamic = "force-dynamic";

const title = "Podcasts for Shopify app vendors | watchfor.tools";
const description =
  "Podcasts an app vendor can learn from or appear on. One is made for app builders, the rest for merchants. Which ones stopped, and which take paid guest slots.";

const baseMetadata = {
  title,
  description,
  alternates: { canonical: "/podcasts", types: { "text/markdown": [{ url: "/podcasts.md", title: "Plain text for agents" }] } },
  openGraph: { title, description, type: "website", url: PODCASTS_URL, siteName: "watchfor.tools" },
  twitter: { card: "summary", title, description },
};

export async function generateMetadata() {
  return withShareImage(baseMetadata);
}

export default async function Page() {
  const podcasts = await mergedPodcasts();
  const graph = {
    "@type": "CollectionPage",
    "@id": `${PODCASTS_URL}#collection`,
    url: PODCASTS_URL,
    name: "Podcasts",
    isPartOf: { "@id": IDS.website },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: podcasts.length,
      itemListElement: podcasts.map((p, i) => ({
        "@type": "ListItem", position: i + 1, url: `${SITE}/podcasts/${p.id}`, name: p.name,
      })),
    },
  };
  return (
    <>
      <SectionView id="podcasts" />
      <JsonLd data={graph} />
      <Podcasts podcasts={podcasts} />
    </>
  );
}
