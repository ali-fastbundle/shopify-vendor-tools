import { notFound } from "next/navigation";
import { POSTS, postBySlug, mentionsOf } from "@/lib/blog";
import { LAST_UPDATED, TOOLS } from "@/lib/tools";
import { NEWSLETTERS } from "@/lib/newsletters";
import { EVENTS } from "@/lib/events";
import { postUrl, articleGraph } from "@/lib/seo";
import { BlogPost } from "@/components/Blog";

/*
 * One post at its own URL. Static: a post changes when the file does, so it is
 * built once per deploy rather than rendered per request. An unknown slug is a
 * 404, never the nearest post.
 */
export const dynamicParams = false;
export const generateStaticParams = () => POSTS.map((p) => ({ slug: p.slug }));

export function generateMetadata({ params }) {
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
