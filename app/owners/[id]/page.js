import { notFound } from "next/navigation";
import { withShareImage } from "@/lib/ogCard";
import { mergedTools, mergedNewsletters, mergedEvents } from "@/lib/listings";
import { ownersWithPages } from "@/lib/ownerIndex";
import { ownerGraph, ownerDescription } from "@/lib/seo";
import { OwnerPage } from "@/components/Owners";
import JsonLd from "@/components/JsonLd";

export const dynamic = "force-dynamic";

/*
 * One owner, with every published entry it controls. Only owners with two or
 * more entries have a page (lib/owners.js); anything else is a 404, so a
 * one-listing owner never gets a page that repeats its listing.
 */
async function load(id) {
  const [tools, newsletters, events] = await Promise.all([mergedTools(), mergedNewsletters(), mergedEvents()]);
  const owners = ownersWithPages({ tools, newsletters, events });
  const owner = owners.find((o) => o.id === id);
  return owner ? { owner, others: owners.filter((o) => o.id !== id) } : null;
}

export async function generateMetadata({ params }) {
  const found = await load(params.id);
  if (!found) return { title: "Not found | watchfor.tools", robots: { index: false } };
  const { owner } = found;
  const title = `${owner.name}: what it owns | watchfor.tools`;
  const description = ownerDescription(owner, owner.entries);
  return withShareImage({
    title, description,
    alternates: { canonical: `/owners/${owner.id}`, types: { "text/markdown": [{ url: `/owners/${owner.id}.md`, title: "Plain text for agents" }] } },
    openGraph: { title, description, type: "profile", siteName: "watchfor.tools" },
  });
}

export default async function Page({ params }) {
  const found = await load(params.id);
  if (!found) notFound();
  const { owner, others } = found;
  return (
    <>
      <JsonLd data={ownerGraph(owner, owner.entries)} />
      <OwnerPage owner={owner} entries={owner.entries} others={others} />
    </>
  );
}
