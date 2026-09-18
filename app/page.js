import Directory from "@/components/Directory";
import { mergedTools } from "@/lib/listings";
import { read, KEYS } from "@/lib/store";
import { publicReviews } from "@/lib/reviews";
import { homeGraph } from "@/lib/seo";
import { feedEntries } from "@/lib/feed";

export const dynamic = "force-dynamic";

export default async function Page() {
  // Rendered on the server so the catalogue, including vendor edits, is in the
  // HTML for crawlers rather than arriving after hydration.
  const [tools, stored, feed] = await Promise.all([
    mergedTools(), read(KEYS.reviews, {}), feedEntries({ limit: 120 }),
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homeGraph(tools, reviews)) }}
      />
      <Directory tools={tools} feed={feed} />
    </>
  );
}
