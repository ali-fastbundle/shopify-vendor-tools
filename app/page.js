import Directory from "@/components/Directory";
import { mergedTools } from "@/lib/listings";
import { read, KEYS } from "@/lib/store";
import { publicReviews } from "@/lib/reviews";
import { homeGraph } from "@/lib/seo";
import { feedEntries } from "@/lib/feed";
import { NEWSLETTERS } from "@/lib/newsletters";
import { HEADLINE } from "@/lib/tools";
import { ogFacts, ogVersion } from "@/lib/ogCard";
import JsonLd from "@/components/JsonLd";

export const dynamic = "force-dynamic";

/*
 * The share card's URL, versioned on exactly what the card draws (see
 * lib/ogCard.js). Per request, because the tool count includes entries
 * published from the admin queue, which the build cannot see.
 */
export async function generateMetadata(_, parent) {
  const og = (await parent).openGraph || {};
  const image = {
    url: `/og?v=${ogVersion(await ogFacts())}`,
    width: 1200, height: 630,
    alt: `Watch For Tools. ${HEADLINE}`,
  };
  return {
    openGraph: { ...og, images: [image] },
    twitter: { card: "summary_large_image", images: [image] },
  };
}

export default async function Page() {
  // Rendered on the server so the catalogue, including vendor edits, is in the
  // HTML for crawlers rather than arriving after hydration.
  const [tools, stored, feed, votes] = await Promise.all([
    mergedTools(), read(KEYS.reviews, {}), feedEntries({ limit: 150 }), read(KEYS.votes, {}),
  ]);

  /*
   * Reviews are read here only to decide which tools have a real rating.
   * `ratingOf` returns null for anything with none, and the spread drops it, so
   * an aggregateRating is emitted exactly where one is true. Schema.org
   * requires a positive ratingCount and the Rich Results Test flags a zero, but
   * the better reason is that a directory claiming ratings it does not have is
   * the thing this site exists not to be.
   */
  const reviews = publicReviews(stored);

  return (
    <>
      <JsonLd data={homeGraph(tools, reviews)} />
      {/* Votes and reviews go in as the grid's starting state. The default sort
          is "Top rated", which reads both, so starting from nothing meant the
          server sent one order and the browser re-sorted into another once
          /api/data arrived: the largest layout shift on the page (0.26). */}
      <Directory tools={tools} feed={feed} newsletterCount={NEWSLETTERS.length}
        initialVotes={votes} initialReviews={reviews} />
    </>
  );
}
