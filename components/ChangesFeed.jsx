"use client";

import React, { Suspense, useState, useMemo } from "react";
import { useParam, usePublishPanel } from "@/components/ListingParams";
import CopyLink from "./CopyLink";
import { outbound } from "@/lib/outbound";
import dynamic from "next/dynamic";
import { sourceOf, entryHref, revisionsOf } from "@/lib/feedSource";
import { C, S, R, F, TRACK, ink, CATEGORIES, catOf, formatDay } from "@/lib/tools";

/*
 * What changed, in order.
 *
 * The counterpart to a listing: a listing says what a tool is today, this says
 * what happened to it. Keeping them apart is the whole point. A `note` that
 * grows a sentence every week has stopped describing a product and started
 * being a changelog with no dates on it.
 *
 * Server-rendered in full and filtered on the client. The filters are a
 * convenience for a person; the complete list is what a crawler gets, which is
 * the half that matters for a page whose entire job is to be the part of the
 * site that changes weekly.
 */

const KIND_LABEL = {
  pricing: "Pricing", "free-tier": "Free tier", "wind-down": "Winding down",
  acquisition: "Acquired", "new-capability": "New capability", shipped: "Shipped",
  "dead-page": "Availability", scale: "Scale", ownership: "Ownership",
};

/* Loaded only when an admin is looking, so a visitor's bundle does not carry it. */
const FeedEntryAdmin = dynamic(() => import("./FeedEntryAdmin"), { ssr: false });

function Logo({ entry, size = 34 }) {
  const [failed, setFailed] = useState(false);
  if (failed || !entry.domain) {
    return (
      <div aria-hidden="true" style={{
        width: size, height: size, borderRadius: R.card, flexShrink: 0,
        background: C.subtle, color: C.muted, border: `1px solid ${C.line}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontWeight: 700, fontSize: size * 0.42,
      }}>{entry.toolName.slice(0, 2)}</div>
    );
  }
  return (
    <img
      src={entry.logo || `https://www.google.com/s2/favicons?domain=${entry.domain}&sz=128`}
      alt={`${entry.toolName} logo`}
      width={size} height={size} loading="lazy" decoding="async"
      onError={() => setFailed(true)}
      style={{
        width: size, height: size, borderRadius: R.card, flexShrink: 0,
        background: C.logoTile, objectFit: "contain", padding: S.xs,
      }}
    />
  );
}

/*
 * The feed body: filters and the dated list, with no page chrome.
 *
 * Split out so the standalone page and the What's moving tab on the directory
 * are the same component rather than two that drift. The page wraps this in a
 * <main> with its own heading; the tab drops it straight under the tab row.
 */
export function FeedRows(props) {
  return <Suspense fallback={<Rows {...props} tool="all" cat="all" on="" />}><FromUrl {...props} /></Suspense>;
}

/* The filters are ?tool= and ?cat=, written by the sidebar
   (components/SiteFrame.jsx), so a filtered feed is a link. ?on= is the
   listing's own path ("owners/mantle"), which a listing's "N updates" line
   links to: it matches entryHref exactly, so an owner and a tool sharing an
   id are not mixed. */
function FromUrl(props) {
  return <Rows {...props} tool={useParam("tool") || "all"} cat={useParam("cat") || "all"} on={useParam("on") || ""} />;
}

function Rows({ entries: initial = [], tools = [], tool, cat, on = "", admin = false }) {
  /* Local so an admin's edit or delete shows at once, without a reload. */
  const [entries, setEntries] = useState(initial);
  const replace = (id, next) => setEntries((xs) => (next ? xs.map((x) => (x.id === id ? { ...x, ...next } : x)) : xs.filter((x) => x.id !== id)));

  const named = useMemo(() => {
    const byId = Object.fromEntries(tools.map((t) => [t.id, t]));
    return entries.map((e) => ({ ...e, domain: byId[e.toolId]?.domain, logo: byId[e.toolId]?.logo }));
  }, [entries, tools]);

  const rows = useMemo(() => named.filter((e) =>
    (tool === "all" || e.toolId === tool) && (cat === "all" || e.cat === cat)
    && (!on || entryHref(e) === `/${on.replace(/^\//, "")}`)), [named, tool, cat, on]);

  /* Only tools that actually appear, so the filter never offers an empty result. */
  const present = useMemo(() => {
    const ids = [...new Set(entries.map((e) => e.toolId))];
    return ids.map((id) => entries.find((e) => e.toolId === id)).sort((a, b) => a.toolName.localeCompare(b.toolName));
  }, [entries]);

  /* The sidebar's tool list: only tools that appear, so it never offers an
     empty result. */
  const toolList = useMemo(() => present.map((e) => ({ id: e.toolId, name: e.toolName })), [present]);
  usePublishPanel("feed", toolList);

  return (
    <>
        {entries.length > 0 && (
          <div className="flex flex-wrap items-center" style={{ gap: S.sm, marginTop: S.xl }}>
            <span className="tnum" style={{ fontSize: F.sm, color: C.dim }}>
              {rows.length} {rows.length === 1 ? "entry" : "entries"}
              {on && rows[0] && <> about <a href={`/${on.replace(/^\//, "")}`} style={{ color: C.text }}>{rows[0].toolName}</a>. <a href="/changes" style={{ color: C.muted }}>Show all</a></>}
            </span>
            <a href="/changes/rss" style={{ fontSize: F.sm, color: C.muted, marginLeft: "auto" }}>RSS</a>
          </div>
        )}

        <div style={{ marginTop: S.xl }}>
          {entries.length === 0 ? (
            <p style={{ fontSize: F.md, color: C.muted, lineHeight: 1.6  }}>
              Nothing recorded yet. The directory is checked weekly and anything material lands here.
            </p>
          ) : rows.length === 0 ? (
            <p style={{ fontSize: F.md, color: C.muted, lineHeight: 1.6 }}>
              Nothing under that filter.
            </p>
          ) : rows.map((e) => (
            /*
             * Every entry has an address of its own.
             *
             * The feed is one stream across every tool, so an entry has no page
             * to be the subject of and does not want one: what makes "Ranksy
             * raised Starter to $79" worth reading is the dated list around it.
             * An anchor on the row is the right granularity, and it is a real
             * one in the server HTML, so it resolves for somebody arriving cold
             * with JavaScript off. The filters default to all, so a pasted link
             * never lands on a row that has been filtered away.
             *
             * scrollMarginTop so the row arrives below the top edge of the
             * window rather than flush against it, where it reads as the first
             * thing on the page rather than as one entry in a list.
             */
            <article key={e.id} id={e.id} style={{ borderTop: `1px solid ${C.line}`, padding: `${S.lg}px 0`, scrollMarginTop: S.xl }}>
              <div className="flex items-start" style={{ gap: S.md }}>
                {/* The spine, turned on its side. Same device as a list row on
                    the directory, and the same rule: category colour appears
                    here, on the label, and on the filter. Nowhere else. */}
                <span aria-hidden="true" style={{
                  width: 3, borderRadius: 2, background: e.cat ? catOf(e.cat).color : C.edge,
                  flexShrink: 0, alignSelf: "stretch",
                }} />
                <Logo entry={e} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="flex flex-wrap items-baseline" style={{ gap: S.sm }}>
                    <a href={entryHref(e)} style={{ fontSize: F.lg, fontWeight: 700, color: C.text, textDecoration: "none", letterSpacing: TRACK.tight }}>
                      {e.toolName}
                    </a>
                    {e.cat && <span style={{ fontSize: F.xs, color: ink(catOf(e.cat).color) }}>{catOf(e.cat).label}</span>}
                    {e.kind && <span style={{ fontSize: F.xs, color: C.dim }}>{KIND_LABEL[e.kind] || e.kind}</span>}
                    {/* Where it came from: observed, from the vendor, or
                        mentioned (lib/feedSource.js). Type, not a badge. */}
                    <span title={sourceOf(e).title} style={{ fontSize: F.xs, color: C.dim }}>
                      {sourceOf(e).label}{e.source === "vendor" && e.announcedOn ? `, ${formatDay(e.announcedOn)}` : ""}
                    </span>
                    {/* The date is the permalink, which is the convention a
                        feed already has and costs nothing to honour: same type,
                        same colour, and a right click or a middle click now
                        does something. The control beside it is for everybody
                        who does not know that. */}
                    <a href={`/changes#${e.id}`} title="Link to this entry"
                      style={{ marginLeft: "auto", textDecoration: "none" }}>
                      <time dateTime={e.date} style={{ fontSize: F.xs, color: C.dim }}>
                        {formatDay(e.date)}
                      </time>
                    </a>
                    <CopyLink path={`/changes#${e.id}`}
                      title={`Copy a link to this ${e.toolName} update`} />
                  </div>
                  <p style={{ fontSize: F.md, lineHeight: 1.6, color: C.text, margin: `${S.sm}px 0 0`  }}>
                    {e.headline}
                  </p>
                  {/* Later changes to the entry, said on the entry: a
                      correction with what it changed, or one quiet line for a
                      wording fix (lib/feedSource.js). Never a silent rewrite. */}
                  {revisionsOf(e).map((v) => (
                    <p key={`${v.kind}${v.on}${v.text.length}`} style={v.kind === "correction"
                      ? { fontSize: F.sm, color: C.muted, lineHeight: 1.55, margin: `${S.sm}px 0 0` , borderLeft: `2px solid ${C.edge}`, paddingLeft: S.md }
                      : { fontSize: F.xs, color: C.dim, margin: `${S.xs}px 0 0` }}>
                      {v.text}
                    </p>
                  ))}
                  {sourceOf(e).note && (
                    <p style={{ fontSize: F.xs, color: C.dim, margin: `${S.xs}px 0 0` }}>{sourceOf(e).note}</p>
                  )}
                  {e.sourceUrl && (
                    <p style={{ margin: `${S.sm}px 0 0` }}>
                      <a href={outbound(e.sourceUrl)} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: F.xs, color: C.muted }}>
                        {e.sourceUrl.replace(/^https?:\/\//, "").slice(0, 70)}
                      </a>
                    </p>
                  )}
                  {admin && (
                    <div style={{ marginTop: S.sm }}>
                      <FeedEntryAdmin entry={e} onChange={(next) => replace(e.id, next)} />
                    </div>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
    </>
  );
}

/*
 * The standalone page at /changes.
 *
 * It keeps its own URL, title, description and JSON-LD because it is the part
 * of the site that moves weekly, which makes it what a crawler comes back for.
 * The tab on the directory renders the same rows without this chrome.
 */
export default function ChangesFeed({ entries = [], tools = [], admin = false }) {
  return (
    <main style={{ background: C.bg, color: C.text, }}>
      <div className="mx-auto" style={{ padding: "0 20px" }}>

        <header style={{ paddingTop: S["3xl"] }}>
          <h1 style={{ fontSize: F.hero, fontWeight: 600, letterSpacing: TRACK.tighter, lineHeight: 1.05, margin: 0 }}>
            What's moving
          </h1>
          <p style={{ fontSize: F.lg, color: C.muted , lineHeight: 1.5, margin: `${S.md}px 0 0` }}>
            What is moving across the directory, dated and in order. Each entry says where it came
            from: observed on the vendor's site, from the vendor, or mentioned by someone else.
            The listings say what each tool is. This says what is happening around it.
          </p>
        </header>

        <div style={{ paddingBottom: S["4xl"] }}>
          <FeedRows entries={entries} tools={tools} admin={admin} />
        </div>
      </div>
    </main>
  );
}
