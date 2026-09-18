import { notFound } from "next/navigation";
import { read, KEYS } from "@/lib/store";
import { mergedTools } from "@/lib/listings";
import { publicReviews } from "@/lib/reviews";
import { catOf, C, S, R, F, TRACK, ink, LAST_UPDATED, formatDay } from "@/lib/tools";
import { outbound } from "@/lib/outbound";
import {
  SITE, toolUrl, toolDescription, toolGraph, relatedTools, logoAlt, ratingOf,
} from "@/lib/seo";
import ToolPage from "@/components/ToolPage";

export const dynamic = "force-dynamic";

/*
 * A real URL for every tool.
 *
 * Before this the whole catalogue lived at one address behind a modal, which
 * meant Google had one page to rank for sixty products and a model quoting us
 * had nothing to cite but the homepage. Neither could link to a tool, because
 * there was no link to a tool.
 *
 * The page is server-rendered and complete without JavaScript on purpose: the
 * crawlers that matter for citation mostly do not run it, and a page that needs
 * hydration to say what a product costs is a page they read as empty. The modal
 * stays for in-page browsing; this is the same content at an address.
 */

async function load(id) {
  const [tools, storedReviews] = await Promise.all([
    mergedTools(),
    read(KEYS.reviews, {}),
  ]);
  const tool = tools.find((t) => t.id === id);
  if (!tool) return null;
  return { tool, tools, reviews: publicReviews(storedReviews) };
}

export async function generateMetadata({ params }) {
  const found = await load(params.id);
  if (!found) return { title: "Not found | watchfor.tools" };
  const { tool } = found;

  const title = `${tool.name} — ${catOf(tool.cat).label} | watchfor.tools`;
  /* Its own sentence, never the site description: sixty pages sharing one
     description is sixty pages treated as one. */
  const description = toolDescription(tool);

  return {
    title,
    description,
    alternates: { canonical: `/tools/${tool.id}` },
    openGraph: {
      title, description, type: "article",
      url: toolUrl(tool.id),
      siteName: "watchfor.tools",
      images: [{ url: `/og?v=${tool.id}-${tool.updated}`, width: 1200, height: 630, alt: `${tool.name} on watchfor.tools` }],
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function Page({ params }) {
  const found = await load(params.id);
  if (!found) notFound();
  const { tool, tools, reviews } = found;

  const related = relatedTools(tool, tools);
  const toolReviews = reviews[tool.id] || [];

  return (
    <>
      {/*
        * The graph goes in the server HTML, not into a useEffect. A crawler
        * that does not run JavaScript is the audience for this tag.
        */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(toolGraph(tool, reviews)) }}
      />
      <ToolPage
        tool={tool}
        related={related}
        reviews={toolReviews}
        rating={ratingOf(tool.id, reviews)}
        lastUpdated={LAST_UPDATED}
      />
    </>
  );
}
