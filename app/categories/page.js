import { withShareImage } from "@/lib/ogCard";
import { mergedTools } from "@/lib/listings";
import { LAST_UPDATED, CATEGORIES, catsOf } from "@/lib/tools";
import { categoryCounts, categoriesGraph, CATEGORIES_URL } from "@/lib/seo";
import { CategoryIndex } from "@/components/Categories";
import JsonLd from "@/components/JsonLd";
import SectionView from "@/components/SectionView";

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

/* What the overlap map needs, and nothing else: ids, names, categories and
   named rivals of the published tools. Counted here, so the sentence above
   the map is server HTML. */
function graphOf(tools) {
  const live = tools.filter((t) => !t.draft);
  const ids = new Set(live.map((t) => t.id));
  const rows = live.map((t) => ({ id: t.id, name: t.name, cat: t.cat, also: catsOf(t).slice(1), competes: (t.competes || []).filter((x) => ids.has(x)) }));
  const pairs = new Set(rows.flatMap((t) => t.competes.map((r) => [t.id, r].sort().join("|"))));
  return {
    cats: CATEGORIES.map((c) => ({ id: c.id, label: c.label, color: c.color })),
    tools: rows,
    bridging: rows.filter((t) => t.also.length).length,
    rivalPairs: pairs.size,
  };
}

export default async function Page() {
  const tools = await mergedTools();
  const counts = categoryCounts(tools);

  return (
    <>
      <SectionView id="categories" />
      <JsonLd data={categoriesGraph(counts)} />
      <CategoryIndex counts={counts} lastUpdated={LAST_UPDATED} graph={graphOf(tools)} />
    </>
  );
}
