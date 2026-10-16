import { notFound } from "next/navigation";
import { withShareImage } from "@/lib/ogCard";
import { rivalsData } from "@/lib/rivalsData";
import { alternativesOf, differences, confirmed } from "@/lib/rivals";
import { ownerContext } from "@/lib/ownerIndex";
import { alternativesGraph } from "@/lib/seo";
import { AlternativesPage } from "@/components/Comparisons";
import JsonLd from "@/components/JsonLd";

export const dynamic = "force-dynamic";

/*
 * Alternatives to one tool (lib/rivals.js). Indexed only once the tool and at
 * least one alternative have confirmed details, because before that the page
 * can state no differences and is the SEO shell this directory exists against.
 * It renders either way, so the links to it always work.
 */
async function load(id) {
  const { tools, pairs } = await rivalsData();
  const tool = tools.find((t) => t.id === id);
  if (!tool) return null;
  const alts = alternativesOf(tool, tools, pairs).map((x) => ({
    ...x, diffs: differences(tool, x.tool), owner: ownerContext(x.tool, "tool", { tools }),
  }));
  if (!alts.length) return null;
  return { tool, tools, alts, indexable: confirmed(tool) && alts.some((x) => confirmed(x.tool)) };
}

export async function generateMetadata({ params }) {
  const found = await load(params.tool);
  if (!found) return { title: "Not found | watchfor.tools", robots: { index: false } };
  const { tool, alts, indexable } = found;
  const title = `Alternatives to ${tool.name} | watchfor.tools`;
  const description = `${alts.length} tools that compete with ${tool.name}: ${alts.slice(0, 5).map((x) => x.tool.name).join(", ")}${alts.length > 5 ? " and more" : ""}. With prices and the caveat for each.`;
  return withShareImage({
    title, description,
    alternates: { canonical: `/alternatives/${tool.id}` },
    robots: indexable ? undefined : { index: false, follow: true },
    openGraph: { title, description, type: "website", siteName: "watchfor.tools" },
  });
}

export default async function Page({ params }) {
  const found = await load(params.tool);
  if (!found) notFound();
  const { tool, tools, alts } = found;
  return (
    <>
      <JsonLd data={alternativesGraph(tool, alts)} />
      <AlternativesPage tool={tool} owner={ownerContext(tool, "tool", { tools })} alts={alts} />
    </>
  );
}
