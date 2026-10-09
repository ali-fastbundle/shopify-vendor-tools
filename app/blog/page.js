import { withShareImage } from "@/lib/ogCard";
import { POSTS } from "@/lib/blog";
import { LAST_UPDATED } from "@/lib/tools";
import { BLOG_URL, blogGraph } from "@/lib/seo";
import { BlogIndex } from "@/components/Blog";

/* Dynamic so the share image version is read per request, like every other
   page; a version frozen at build time is the drift lib/ogCard.js exists to stop. */
export const dynamic = "force-dynamic";

const title = "Blog | watchfor.tools";
const description =
  "Whole categories of Shopify app vendor tools side by side, judged on stated criteria by someone who sells none of them.";

const baseMetadata = {
  title,
  description,
  alternates: {
    canonical: "/blog",
    types: { "application/rss+xml": [{ url: "/blog/rss", title: "watchfor.tools: blog" }] },
  },
  openGraph: { title, description, type: "website", url: BLOG_URL, siteName: "watchfor.tools" },
  twitter: { card: "summary", title, description },
};

/* Async because the share image is versioned on live data (lib/ogCard.js). */
export async function generateMetadata() {
  return withShareImage(baseMetadata);
}

export default function Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(blogGraph(POSTS)) }} />
      <BlogIndex posts={POSTS} lastUpdated={LAST_UPDATED} />
    </>
  );
}
