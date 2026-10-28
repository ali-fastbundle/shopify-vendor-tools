import { notFound } from "next/navigation";
import { withShareImage } from "@/lib/ogCard";
import { readLists, isShown, isIndexable, publicList } from "@/lib/lists";
import { mergedTools } from "@/lib/listings";
import { SITE } from "@/lib/seo";
import { C, S, F, TRACK, ink, catOf, priceLine } from "@/lib/tools";
import JsonLd from "@/components/JsonLd";

export const dynamic = "force-dynamic";

/*
 * A published list (lib/lists.js). 404 unless its owner published it and it
 * is not hidden. Indexed only after an admin marked it fine. It shows who
 * made it by the name they chose, never an address, and every tool carries
 * its own caveat, the same as anywhere else in the directory.
 */
async function load(id) {
  const all = await readLists();
  const l = all[id];
  if (!isShown(l)) return null;
  const tools = await mergedTools();
  const items = l.items.map((it) => ({ ...it, tool: tools.find((t) => t.id === it.toolId) })).filter((x) => x.tool);
  return { list: publicList(l), items, indexable: isIndexable(l) };
}

export async function generateMetadata({ params }) {
  const found = await load(params.id);
  if (!found) return { title: "Not found | watchfor.tools", robots: { index: false } };
  const { list, items, indexable } = found;
  const title = `${list.name}, a list by ${list.byName} | watchfor.tools`;
  const description = `${items.length} tools chosen by ${list.byName}: ${items.slice(0, 5).map((x) => x.tool.name).join(", ")}${items.length > 5 ? " and more" : ""}.`;
  return withShareImage({
    title, description,
    alternates: { canonical: `/lists/${list.id}` },
    robots: indexable ? undefined : { index: false, follow: true },
    openGraph: { title, description, type: "website", siteName: "watchfor.tools" },
  });
}

export default async function Page({ params }) {
  const found = await load(params.id);
  if (!found) notFound();
  const { list, items } = found;
  const url = `${SITE}/lists/${list.id}`;
  return (
    <main style={{ background: C.bg, color: C.text }}>
      <JsonLd data={{
        "@type": "CollectionPage", "@id": `${url}#page`, url, name: list.name,
        isPartOf: { "@id": `${SITE}#website` },
        creator: { "@type": "Person", name: list.byName },
        mainEntity: { "@type": "ItemList", itemListElement: items.map((x, i) => ({ "@type": "ListItem", position: i + 1, name: x.tool.name, url: `${SITE}/tools/${x.tool.id}` })) },
      }} />
      <div className="mx-auto" style={{ maxWidth: 820, padding: "0 16px" }}>
        <h1 style={{ fontSize: F.hero, fontWeight: 600, margin: `${S["3xl"]}px 0 0`, letterSpacing: TRACK.tighter, lineHeight: 1.05 }}>{list.name}</h1>
        <p style={{ fontSize: F.md, color: C.muted, margin: `${S.sm}px 0 0` }}>
          A list by {list.byName}, updated {String(list.updatedAt).slice(0, 10)}. {items.length} {items.length === 1 ? "tool" : "tools"}.
        </p>
        <p style={{ fontSize: F.xs, color: C.dim, margin: `${S.xs}px 0 0`, maxWidth: "64ch", lineHeight: 1.5 }}>
          Made by a visitor to watchfor.tools, not by the directory. The notes are theirs. Each tool's caveat is the directory's.
        </p>
        <ol style={{ padding: 0, listStyle: "none", margin: `${S.xl}px 0 0` }}>
          {items.map(({ tool: t, note }, i) => (
            <li key={t.id} style={{ borderTop: `1px solid ${C.line}`, padding: `${S.lg}px 0` }}>
              <div className="flex flex-wrap items-baseline" style={{ gap: S.sm }}>
                <span className="tnum" style={{ fontSize: F.sm, color: C.dim }}>{i + 1}.</span>
                <a href={`/tools/${t.id}`} style={{ fontSize: F.lg, fontWeight: 700, color: C.text, textDecoration: "none" }}>{t.name}</a>
                <a href={`/categories/${t.cat}`} style={{ fontSize: F.xs, color: ink(catOf(t.cat).color), textDecoration: "none" }}>{catOf(t.cat).label}</a>
              </div>
              <p style={{ fontSize: F.md, margin: `${S.xs}px 0 0` }}>{t.one}</p>
              <p style={{ fontSize: F.sm, color: C.muted, margin: `${S.xs}px 0 0` }}>{priceLine(t)}</p>
              {note && (
                <p style={{ fontSize: F.sm, margin: `${S.sm}px 0 0`, lineHeight: 1.55 }}>
                  <b>{list.byName}:</b> {note}
                </p>
              )}
              <p style={{ fontSize: F.sm, color: C.muted, margin: `${S.sm}px 0 0`, lineHeight: 1.55 }}>
                <span style={{ color: C.warnInk, fontWeight: 700 }}>Watch for. </span>{t.watch}
              </p>
            </li>
          ))}
        </ol>
        <p style={{ fontSize: F.sm, color: C.muted, margin: `${S.xl}px 0 0` }}>
          <a href="/lists" style={{ color: C.text }}>More lists</a>{" · "}<a href="/lists/mine" style={{ color: C.text }}>Make your own</a>
        </p>
      </div>
    </main>
  );
}
