import { withShareImage } from "@/lib/ogCard";
import { mergedPodcasts } from "@/lib/listings";
import { SITE, PODCASTS_URL, IDS } from "@/lib/seo";
import JsonLd from "@/components/JsonLd";
import Podcasts from "@/components/Podcasts";
import SectionView from "@/components/SectionView";
import { pagePodcasts } from "@/lib/pageData";

/* Cached, not rendered per request (CLAUDE.md, Page caching and CPU). The
   data and the share image version come through tagged reads, so a write to
   any store key this page shows re-renders it at once; the hour is a backstop. */
export const revalidate = 3600;

const title = "Podcasts for Shopify App Developers | watchfor.tools";
const description =
  "Podcasts an app developer can learn from or appear on. One is made for app builders, the rest for merchants. Which ones stopped, and which take paid guest slots.";

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
  const podcasts = await pagePodcasts();
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
