import { withShareImage } from "@/lib/ogCard";
import { notFound } from "next/navigation";
import { read, KEYS } from "@/lib/store";
import { mergedCommunities } from "@/lib/listings";
import { listedEntity } from "@/lib/entries";
import { publicReviews } from "@/lib/reviews";
import { communityUrl, communityDescription, communityGraph, relatedCommunities } from "@/lib/seo";
import CommunityPage from "@/components/CommunityPage";
import { ownerContext } from "@/lib/ownerIndex";
import JsonLd from "@/components/JsonLd";

export const dynamic = "force-dynamic";

/*
 * One community at its own URL, server-rendered and complete without
 * JavaScript, the same contract as /podcasts/[id].
 */
async function load(id) {
  const [communities, storedReviews] = await Promise.all([mergedCommunities(), read(KEYS.reviews, {})]);
  const c = communities.find((x) => x.id === id);
  if (!c) return null;
  return { c, communities, reviews: publicReviews(storedReviews) };
}

async function baseMetadata({ params }) {
  const found = await load(params.id);
  if (!found) return { title: "Not found | watchfor.tools" };
  const { c } = found;
  const title = `${c.name} | watchfor.tools communities`;
  const description = communityDescription(c);
  return {
    title,
    description,
    alternates: { canonical: `/communities/${c.id}`, types: { "text/markdown": [{ url: `/communities/${c.id}.md`, title: "Plain text for agents" }] } },
    openGraph: { title, description, type: "article", url: communityUrl(c.id), siteName: "watchfor.tools" },
    twitter: { card: "summary", title, description },
  };
}

export default async function Page({ params }) {
  const found = await load(params.id);
  if (!found) notFound();
  const { c, communities, reviews } = found;
  /* The domain a claim verifies against, from the one lookup the claim route
     uses, so the page never offers a claim the route would refuse. */
  const entity = await listedEntity(c.id);
  return (
    <>
      <JsonLd data={communityGraph(c)} />
      <CommunityPage
        community={c}
        owner={ownerContext(c, "group")}
        related={relatedCommunities(c, communities)}
        reviews={reviews[c.id] || []}
        claimDomain={entity?.domain || ""}
      />
    </>
  );
}

export async function generateMetadata(props) {
  return withShareImage(await baseMetadata(props));
}
