import { withShareImage } from "@/lib/ogCard";
import { notFound } from "next/navigation";
import { postBySlug, mentionsOf } from "@/lib/blog";
import { LAST_UPDATED, TOOLS } from "@/lib/tools";
import { NEWSLETTERS } from "@/lib/newsletters";
import { EVENTS } from "@/lib/events";
import { postUrl, articleGraph } from "@/lib/seo";
import { BlogPost } from "@/components/Blog";

/* Dynamic so the share image version is read per request, like every other
   page; a version frozen at build time is the drift lib/ogCard.js exists to stop. */
export const dynamic = "force-dynamic";

/*
 * One post at its own URL. Rendered per request (see `dynamic` above). An
 * unknown slug is a 404 from notFound(), never the nearest post.
 */

async function baseMetadata({ params }) {
  const post = postBySlug(params.slug);
  if (!post) return { title: "Not found | watchfor.tools" };
  const title = `${post.title} | watchfor.tools`;
  return {
    title,
    description: post.description,
    alternates: {
      canonical: `/blog/${post.slug}`,
      types: { "application/rss+xml": [{ url: "/blog/rss", title: "watchfor.tools: blog" }] },
    },
    openGraph: {
      title, description: post.description, type: "article", url: postUrl(post.slug), siteName: "watchfor.tools",
      publishedTime: post.date, modifiedTime: post.updated || post.date,
    },
    twitter: { card: "summary", title, description: post.description },
  };
}

const nameOf = ({ kind, id }) =>
  (kind === "tool" ? TOOLS : kind === "newsletter" ? NEWSLETTERS : EVENTS).find((x) => x.id === id)?.name || id;

export default function Page({ params }) {
  const post = postBySlug(params.slug);
  if (!post) notFound();
  const mentions = mentionsOf(post).map((m) => ({ ...m, name: nameOf(m) }));
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleGraph(post, mentions)) }} />
      <BlogPost post={post} lastUpdated={LAST_UPDATED} />
    </>
  );
}

/* Wrapped so every page carries the one share card, versioned on what it
   draws (lib/ogCard.js), rather than each page writing its own. */
export async function generateMetadata(props) {
  return withShareImage(await baseMetadata(props));
}
