import { notFound } from "next/navigation";
import { withShareImage } from "@/lib/ogCard";
import { mergedTools, mergedNewsletters, mergedEvents } from "@/lib/listings";
import { ownersWithPages } from "@/lib/ownerIndex";
import { ownerGraph, ownerDescription } from "@/lib/seo";
import { feedEntries } from "@/lib/feed";
import { updatesLink } from "@/lib/feedSource";
import { OwnerPage } from "@/components/Owners";
import JsonLd from "@/components/JsonLd";
import { cache } from "react";
import { pageEvents, pageFeed, pageNewsletters, pageTools } from "@/lib/pageData";

/* One load per request: generateMetadata and the page body share it. */
const load = cache(loadUncached);

/* Cached, not rendered per request (CLAUDE.md, Page caching and CPU). The
   data and the share image version come through tagged reads, so a write to
   any store key this page shows re-renders it at once; the hour is a backstop. */
export const revalidate = 3600;
/* No paths at build: each is rendered the first time it is asked for and then
   cached like the rest, so a build does not read the store for every id. */
export function generateStaticParams() { return []; }

/*
 * One owner, with every published entry it controls. Only owners with two or
 * more entries have a page (lib/owners.js); anything else is a 404, so a
 * one-listing owner never gets a page that repeats its listing.
 */
async function loadUncached(id) {
  const [tools, newsletters, events] = await Promise.all([pageTools(), pageNewsletters(), pageEvents()]);
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
      <OwnerPage owner={owner} entries={owner.entries} others={others}
        updates={updatesLink(await pageFeed(1000), `/owners/${owner.id}`)} />
    </>
  );
}
