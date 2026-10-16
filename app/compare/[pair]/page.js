import { notFound, permanentRedirect } from "next/navigation";
import { withShareImage } from "@/lib/ogCard";
import { rivalsData } from "@/lib/rivalsData";
import { parseSlug, pairSlug, pairKey, differences, confirmed } from "@/lib/rivals";
import { ownerContext } from "@/lib/ownerIndex";
import { compareGraph } from "@/lib/seo";
import { ComparePage } from "@/components/Comparisons";
import JsonLd from "@/components/JsonLd";

export const dynamic = "force-dynamic";

/*
 * One head-to-head, only for a pair that genuinely competes (lib/rivals.js).
 * Any other pair is a 404, so the 1,128-page matrix cannot exist even by
 * typing it. The canonical order is alphabetical by id; the other order
 * redirects to it permanently, so a-vs-b and b-vs-a are one URL. Indexed only
 * when both tools have confirmed details.
 */
async function load(slug) {
  const ids = parseSlug(slug);
  if (!ids) return null;
  const { tools, pairs } = await rivalsData();
  const pair = pairs.get(pairKey(ids[0], ids[1]));
  if (!pair) return null;
  const [a, b] = [pair.a, pair.b].map((id) => tools.find((t) => t.id === id));
  return { a, b, tools, why: pair.why, canonical: pairSlug(a.id, b.id) };
}

export async function generateMetadata({ params }) {
  const found = await load(params.pair);
  if (!found) return { title: "Not found | watchfor.tools", robots: { index: false } };
  const { a, b, canonical } = found;
  const title = `${a.name} vs ${b.name} | watchfor.tools`;
  const description = `${a.name} and ${b.name} side by side: pricing, details, ownership and the caveat for each.`;
  return withShareImage({
    title, description,
    alternates: { canonical: `/compare/${canonical}` },
    robots: confirmed(a) && confirmed(b) ? undefined : { index: false, follow: true },
    openGraph: { title, description, type: "website", siteName: "watchfor.tools" },
  });
}

export default async function Page({ params }) {
  const found = await load(params.pair);
  if (!found) notFound();
  const { a, b, tools, why, canonical } = found;
  if (params.pair !== canonical) permanentRedirect(`/compare/${canonical}`);
  return (
    <>
      <JsonLd data={compareGraph(a, b, canonical)} />
      <ComparePage a={a} b={b} why={why}
        ownerA={ownerContext(a, "tool", { tools })} ownerB={ownerContext(b, "tool", { tools })}
        diffsA={differences(b, a)} diffsB={differences(a, b)} />
    </>
  );
}
