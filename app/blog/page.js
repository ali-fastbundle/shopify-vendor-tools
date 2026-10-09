import { POSTS } from "@/lib/blog";
import { LAST_UPDATED } from "@/lib/tools";
import { BLOG_URL, blogGraph } from "@/lib/seo";
import { BlogIndex } from "@/components/Blog";

const title = "Blog | watchfor.tools";
const description =
  "Whole categories of Shopify app vendor tools side by side, judged on stated criteria by someone who sells none of them.";

export const metadata = {
  title,
  description,
  alternates: {
    canonical: "/blog",
    types: { "application/rss+xml": [{ url: "/blog/rss", title: "watchfor.tools: blog" }] },
  },
  openGraph: { title, description, type: "website", url: BLOG_URL, siteName: "watchfor.tools" },
  twitter: { card: "summary", title, description },
};

export default function Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(blogGraph(POSTS)) }} />
      <BlogIndex posts={POSTS} lastUpdated={LAST_UPDATED} />
    </>
  );
}
