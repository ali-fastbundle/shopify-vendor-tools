import { withShareImage } from "@/lib/ogCard";
import { mergedTools } from "@/lib/listings";
import { LAST_UPDATED } from "@/lib/tools";
import { categoryCounts, categoriesGraph, CATEGORIES_URL } from "@/lib/seo";
import { CategoryIndex } from "@/components/Categories";
import JsonLd from "@/components/JsonLd";

export const dynamic = "force-dynamic";

const baseMetadata = {
  title: "Categories | watchfor.tools",
  description:
    "Every category of tool built for Shopify app vendors: ASO, App Store data, billing analytics, "
    + "partner programmes, store databases, detectors, suites, merchant research, talent and support.",
  alternates: { canonical: "/categories" },
  openGraph: {
    title: "Categories | watchfor.tools",
    description: "Every category of tool built for Shopify app vendors.",
    url: CATEGORIES_URL,
    siteName: "watchfor.tools",
    type: "website",
  },
};

/* Async because the share image is versioned on live data (lib/ogCard.js). */
export async function generateMetadata() {
  return withShareImage(baseMetadata);
}

export default async function Page() {
  const tools = await mergedTools();
  const counts = categoryCounts(tools);

  return (
    <>
      <JsonLd data={categoriesGraph(counts)} />
      <CategoryIndex counts={counts} lastUpdated={LAST_UPDATED} />
    </>
  );
}
