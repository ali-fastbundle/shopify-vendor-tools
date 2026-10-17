import { withShareImage } from "@/lib/ogCard";
import { readLists, isIndexable, publicList } from "@/lib/lists";
import { mergedTools } from "@/lib/listings";
import { SITE } from "@/lib/seo";
import { C, S, F, TRACK } from "@/lib/tools";
import JsonLd from "@/components/JsonLd";

export const dynamic = "force-dynamic";

/*
 * Published lists: the section other people read.
 *
 * Only lists an editor has read are here (isIndexable): public, not hidden,
 * not empty, marked fine. A list nobody has looked at yet is live at its own
 * address but is not shown in the section, for the reason its page is noindex
 * until then: anything anyone can publish is the first thing a spammer finds.
 * With none to show the page says so and is noindex, and the section is not
 * in the nav at all (lib/listsSection.js).
 */
async function load() {
  const all = Object.values((await readLists()) || {}).filter(isIndexable)
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  const tools = await mergedTools();
  const nameOf = (id) => tools.find((t) => t.id === id)?.name;
  return all.map((l) => ({ ...publicList(l), names: l.items.map((x) => nameOf(x.toolId)).filter(Boolean) }));
}

export async function generateMetadata() {
  const lists = await load();
  const title = "Lists of Shopify app vendor tools | watchfor.tools";
  const description = lists.length
    ? `${lists.length} ${lists.length === 1 ? "list" : "lists"} of tools for Shopify app vendors, made by people who use them, each tool with its caveat.`
    : "Lists of tools for Shopify app vendors, made by people who use them.";
  return withShareImage({
    title, description,
    alternates: { canonical: "/lists" },
    robots: lists.length ? undefined : { index: false, follow: true },
    openGraph: { title, description, type: "website", siteName: "watchfor.tools" },
  });
}

export default async function Page() {
  const lists = await load();
  const url = `${SITE}/lists`;
  return (
    <main style={{ background: C.bg, color: C.text }}>
      {lists.length > 0 && (
        <JsonLd data={{
          "@type": "CollectionPage", "@id": `${url}#page`, url, name: "Lists",
          isPartOf: { "@id": `${SITE}#website` },
          mainEntity: { "@type": "ItemList", itemListElement: lists.map((l, i) => ({ "@type": "ListItem", position: i + 1, name: l.name, url: `${SITE}/lists/${l.id}` })) },
        }} />
      )}
      <div className="mx-auto" style={{ maxWidth: 820, padding: "0 16px" }}>
        <h1 style={{ fontSize: F["2xl"], fontWeight: 800, margin: `${S["2xl"]}px 0 0`, letterSpacing: TRACK.tighter }}>Lists</h1>
        <p style={{ fontSize: F.md, color: C.muted, lineHeight: 1.55, margin: `${S.sm}px 0 0`, maxWidth: "62ch" }}>
          Tools chosen and put in order by people who use them, with their notes. Each list is theirs, not the
          directory's. Each tool keeps its own caveat.
        </p>
        {lists.length === 0 ? (
          <p style={{ fontSize: F.md, color: C.muted, margin: `${S.xl}px 0 0` }}>No lists are published yet.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: `${S.xl}px 0 0` }}>
            {lists.map((l) => (
              <li key={l.id} style={{ borderTop: `1px solid ${C.line}`, padding: `${S.lg}px 0` }}>
                <a href={`/lists/${l.id}`} style={{ fontSize: F.lg, fontWeight: 700, color: C.text, textDecoration: "none" }}>{l.name}</a>
                <p className="tnum" style={{ fontSize: F.sm, color: C.muted, margin: `${S.xs}px 0 0` }}>
                  By {l.byName}. {l.names.length} {l.names.length === 1 ? "tool" : "tools"}: {l.names.slice(0, 5).join(", ")}{l.names.length > 5 ? " and more" : ""}.
                </p>
              </li>
            ))}
          </ul>
        )}
        <p style={{ fontSize: F.sm, color: C.muted, margin: `${S.xl}px 0 0` }}>
          <a href="/lists/mine" style={{ color: C.text }}>Make your own list</a>
        </p>
      </div>
    </main>
  );
}
