import { notFound } from "next/navigation";
import { read, KEYS } from "@/lib/store";
import { mergedTools } from "@/lib/listings";
import { publicReviews } from "@/lib/reviews";
import { findCat, LAST_UPDATED } from "@/lib/tools";
import {
  categoryUrl, categoryMembers, categoryDescription, categoryGraph, relatedCategories,
} from "@/lib/seo";
import { CategoryPage } from "@/components/Categories";

export const dynamic = "force-dynamic";

/*
 * A real URL for every category.
 *
 * Nine of these existed only as a filter chip in a client component, which
 * meant "store databases for Shopify app vendors" had no page to rank and
 * nothing to cite. The chips still work and are still the fast way to browse;
 * this is the same set of tools at an address, server rendered and complete
 * without JavaScript.
 *
 * `findCat` rather than `catOf`: an unknown id has to 404. `catOf` falls back
 * to the first category, which is the right behaviour inside a render and
 * exactly wrong here, because it would serve App Store ASO at a hundred
 * misspelled URLs and let a crawler index every one of them.
 */

async function load(id) {
  const cat = findCat(id);
  if (!cat) return null;
  const [tools, storedReviews] = await Promise.all([mergedTools(), read(KEYS.reviews, {})]);
  return {
    cat,
    members: categoryMembers(id, tools),
    related: relatedCategories(id, tools),
    reviews: publicReviews(storedReviews),
  };
}

export async function generateMetadata({ params }) {
  const found = await load(params.id);
  if (!found) return { title: "Not found | watchfor.tools" };
  const { cat, members } = found;

  const title = `${cat.label} tools for Shopify app vendors | watchfor.tools`;
  const description = categoryDescription(cat, members.length);

  return {
    title,
    description,
    alternates: { canonical: `/categories/${cat.id}` },
    openGraph: {
      title, description, type: "website",
      url: categoryUrl(cat.id),
      siteName: "watchfor.tools",
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function Page({ params }) {
  const found = await load(params.id);
  if (!found) notFound();
  const { cat, members, related, reviews } = found;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(categoryGraph(cat, members, reviews)) }}
      />
      <CategoryPage cat={cat} members={members} related={related} lastUpdated={LAST_UPDATED} />
    </>
  );
}
