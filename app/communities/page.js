import { withShareImage } from "@/lib/ogCard";
import { mergedCommunities } from "@/lib/listings";
import { SITE, COMMUNITIES_URL, IDS } from "@/lib/seo";
import JsonLd from "@/components/JsonLd";
import Communities from "@/components/Communities";
import SectionView from "@/components/SectionView";

export const dynamic = "force-dynamic";

const title = "Groups and communities for Shopify app vendors | watchfor.tools";
const description =
  "Forums and groups an app vendor can join. Who is in each one, what it costs, how you get in, and what its rules let a vendor do.";

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
  const communities = await mergedCommunities();
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
