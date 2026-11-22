import { withShareImage } from "@/lib/ogCard";
import { notFound } from "next/navigation";
import { read, KEYS } from "@/lib/store";
import { mergedPodcasts } from "@/lib/listings";
import { listedEntity } from "@/lib/entries";
import { publicReviews } from "@/lib/reviews";
import { podcastUrl, podcastDescription, podcastGraph, relatedPodcasts } from "@/lib/seo";
import PodcastPage from "@/components/PodcastPage";
import { ownerContext } from "@/lib/ownerIndex";
import JsonLd from "@/components/JsonLd";
import { cache } from "react";
import { pagePodcasts, pageReviews } from "@/lib/pageData";

/* One load per request: generateMetadata and the page body share it. */
const load = cache(loadUncached);

/* Cached, not rendered per request (CLAUDE.md, Page caching and CPU). The
   data and the share image version come through tagged reads, so a write to
   any store key this page shows re-renders it at once; the hour is a backstop. */
export const revalidate = 3600;
/* No paths at build: each is rendered the first time it is asked for and then
   cached like the rest, so a build does not read the store for every id. */
export function generateStaticParams() { return []; }

/*
 * One podcast at its own URL, server-rendered and complete without
 * JavaScript, the same contract as /newsletters/[id].
 */
async function loadUncached(id) {
  const [podcasts, storedReviews] = await Promise.all([pagePodcasts(), pageReviews()]);
  const p = podcasts.find((x) => x.id === id);
  if (!p) return null;
  return { p, podcasts, reviews: storedReviews };
}

async function baseMetadata({ params }) {
  const found = await load(params.id);
  if (!found) return { title: "Not found | watchfor.tools" };
  const { p } = found;
  const title = `${p.name} | watchfor.tools podcasts`;
  const description = podcastDescription(p);
  return {
    title,
    description,
    alternates: { canonical: `/podcasts/${p.id}`, types: { "text/markdown": [{ url: `/podcasts/${p.id}.md`, title: "Plain text for agents" }] } },
    openGraph: { title, description, type: "article", url: podcastUrl(p.id), siteName: "watchfor.tools" },
    twitter: { card: "summary", title, description },
  };
}

export default async function Page({ params }) {
  const found = await load(params.id);
  if (!found) notFound();
  const { p, podcasts, reviews } = found;
  /* The domain a claim verifies against, from the one lookup the claim route
     uses, so the page never offers a claim the route would refuse. */
  const entity = await listedEntity(p.id);
  return (
    <>
      <JsonLd data={podcastGraph(p, reviews)} />
      <PodcastPage
        podcast={p}
        owner={ownerContext(p, "podcast")}
        related={relatedPodcasts(p, podcasts)}
        reviews={reviews[p.id] || []}
        claimDomain={entity?.domain || ""}
      />
    </>
  );
}

export async function generateMetadata(props) {
  return withShareImage(await baseMetadata(props));
}
