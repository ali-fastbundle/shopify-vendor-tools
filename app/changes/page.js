import { cookies, headers } from "next/headers";
import { withShareImage } from "@/lib/ogCard";
import { sessionFrom, isAdmin } from "@/lib/auth";
import { feedEntries } from "@/lib/feed";
import { revisionsOf } from "@/lib/feedSource";
import { mergedTools } from "@/lib/listings";
import { SITE, IDS } from "@/lib/seo";
import ChangesFeed from "@/components/ChangesFeed";
import JsonLd from "@/components/JsonLd";
import SectionView from "@/components/SectionView";

export const dynamic = "force-dynamic";

const title = "What's moving | watchfor.tools";
const description =
  "What is moving across the directory, dated and in order: pricing moves, new features and wind-downs seen on vendors' sites, news vendors told us, and what other people said, linked and attributed.";

const baseMetadata = {
  title,
  description,
  /* So a reader that lands on the page can find the feed without being told. */
  alternates: {
    canonical: "/changes",
    types: {
      "application/rss+xml": [{ url: "/changes/rss", title: "watchfor.tools: What's moving" }],
      "text/markdown": [{ url: "/changes.md", title: "Plain text for agents" }],
    },
  },
  openGraph: { title, description, type: "website", url: `${SITE}/changes`, siteName: "watchfor.tools" },
};

/* Async because the share image is versioned on live data (lib/ogCard.js). */
export async function generateMetadata() {
  return withShareImage(baseMetadata);
}

export default async function Page({ searchParams = {} }) {
  const [entries, tools] = await Promise.all([feedEntries({ limit: 300 }), mergedTools()]);
  /* Edit and Delete under each entry for an admin. An affordance, never the
     permission: /api/admin re-checks on every press (invariant 7). */
  const session = sessionFrom({ cookies: cookies(), headers: headers() });
  const admin = Boolean(session && isAdmin(session.email));

  /*
   * A CollectionPage of dated items. This is the page that moves weekly, which
   * is the one crawlers come back for, so it is worth being explicit about what
   * it holds rather than leaving it as an unlabelled list.
   */
  const graph = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${SITE}/changes#collection`,
    url: `${SITE}/changes`,
    name: "What's moving",
    description,
    isPartOf: { "@id": `${SITE}#website` },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: entries.length,
      itemListElement: entries.slice(0, 100).map((e, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: {
          "@type": "Article",
          headline: e.headline.slice(0, 110),
          datePublished: e.date,
          ...(revisionsOf(e).length ? { dateModified: revisionsOf(e).at(-1).on } : {}),
          // Written by a person for the site, every time (invariant 31), so
          // the site is the author. A node every page already defines.
          author: { "@id": IDS.organization },
          publisher: { "@id": IDS.organization },
          about: { "@type": "SoftwareApplication", name: e.toolName, url: `${SITE}/tools/${e.toolId}` },
          // The entry's own address: a fragment on this page, as the RSS item has.
          url: `${SITE}/changes#${e.id}`,
        },
      })),
    },
  };

  return (
    <>
      <SectionView id="updates" />
      <JsonLd data={graph} />
      {/* ?on= is applied in the first HTML too, so the "N updates" link from a
          listing lands on that listing's entries without JavaScript. */}
      <ChangesFeed entries={entries} tools={tools} admin={admin} on={String(searchParams.on || "").slice(0, 120)} />
    </>
  );
}
