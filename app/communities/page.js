import { withShareImage } from "@/lib/ogCard";
import { mergedCommunities } from "@/lib/listings";
import { SITE, COMMUNITIES_URL, IDS } from "@/lib/seo";
import JsonLd from "@/components/JsonLd";
import Communities from "@/components/Communities";
import SectionView from "@/components/SectionView";
import { pageCommunities } from "@/lib/pageData";

/* Cached, not rendered per request (CLAUDE.md, Page caching and CPU). The
   data and the share image version come through tagged reads, so a write to
   any store key this page shows re-renders it at once; the hour is a backstop. */
export const revalidate = 3600;

const title = "Shopify App Developer Communities and Groups | watchfor.tools";
const description =
  "Forums and groups an app developer can join. Who is in each one, what it costs, how you get in, and what its rules let you post.";

const baseMetadata = {
  title,
  description,
  alternates: { canonical: "/communities", types: { "text/markdown": [{ url: "/communities.md", title: "Plain text for agents" }] } },
  openGraph: { title, description, type: "website", url: COMMUNITIES_URL, siteName: "watchfor.tools" },
  twitter: { card: "summary", title, description },
};

export async function generateMetadata() {
  return withShareImage(baseMetadata);
}

export default async function Page() {
  const communities = await pageCommunities();
  const graph = {
    "@type": "CollectionPage",
    "@id": `${COMMUNITIES_URL}#collection`,
    url: COMMUNITIES_URL,
    name: "Communities",
    isPartOf: { "@id": IDS.website },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: communities.length,
      itemListElement: communities.map((p, i) => ({
        "@type": "ListItem", position: i + 1, url: `${SITE}/communities/${p.id}`, name: p.name,
      })),
    },
  };
  return (
    <>
      <SectionView id="communities" />
      <JsonLd data={graph} />
      <Communities communities={communities} />
    </>
  );
}
