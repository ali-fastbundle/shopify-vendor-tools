"use client";

import React, { useState, useMemo } from "react";
import CopyLink from "./CopyLink";
import { outbound } from "@/lib/outbound";
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
  acquisition: "Acquired", "new-capability": "New capability",
  "dead-page": "Availability", scale: "Scale", ownership: "Ownership",
};

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
        background: "#FFFFFF", objectFit: "contain", padding: S.xs,
      }}
    />
  );
}

/*
 * The feed body: filters and the dated list, with no page chrome.
 *
 * Split out so the standalone page and the Recent updates tab on the directory
 * are the same component rather than two that drift. The page wraps this in a
 * <main> with its own heading; the tab drops it straight under the tab row.
 */
export function FeedRows({ entries = [], tools = [] }) {
  const [tool, setTool] = useState("all");
  const [cat, setCat] = useState("all");

  const named = useMemo(() => {
    const byId = Object.fromEntries(tools.map((t) => [t.id, t]));
    return entries.map((e) => ({ ...e, domain: byId[e.toolId]?.domain, logo: byId[e.toolId]?.logo }));
  }, [entries, tools]);

  const rows = useMemo(() => named.filter((e) =>
    (tool === "all" || e.toolId === tool) && (cat === "all" || e.cat === cat)), [named, tool, cat]);

  /* Only tools that actually appear, so the filter never offers an empty result. */
  const present = useMemo(() => {
    const ids = [...new Set(entries.map((e) => e.toolId))];
    return ids.map((id) => entries.find((e) => e.toolId === id)).sort((a, b) => a.toolName.localeCompare(b.toolName));
  }, [entries]);

  const field = {
    background: C.panel, border: `1px solid ${C.line}`, borderRadius: R.control,
    padding: "8px 10px", fontSize: F.sm, color: C.text, fontFamily: "inherit",
  };

  return (
    <>
        {entries.length > 0 && (
          <div className="flex flex-wrap items-center" style={{ gap: S.sm, marginTop: S.xl }}>
            <select value={tool} onChange={(e) => setTool(e.target.value)} style={field} aria-label="Filter by tool">
              <option value="all">All tools</option>
              {present.map((e) => (
                <option key={e.toolId} value={e.toolId} style={{ background: C.panel }}>{e.toolName}</option>
              ))}
            </select>
            <select value={cat} onChange={(e) => setCat(e.target.value)} style={field} aria-label="Filter by category">
              <option value="all">All categories</option>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id} style={{ background: C.panel }}>{c.label}</option>
              ))}
            </select>
            <span className="tnum" style={{ fontSize: F.sm, color: C.dim }}>
              {rows.length} {rows.length === 1 ? "entry" : "entries"}
            </span>
            <a href="/changes/rss" style={{ fontSize: F.sm, color: C.muted, marginLeft: "auto" }}>RSS</a>
          </div>
        )}

        <div style={{ marginTop: S.xl }}>
          {entries.length === 0 ? (
            <p style={{ fontSize: F.md, color: C.muted, lineHeight: 1.6, maxWidth: "58ch" }}>
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
                  width: 3, borderRadius: 2, background: catOf(e.cat).color,
                  flexShrink: 0, alignSelf: "stretch",
                }} />
                <Logo entry={e} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="flex flex-wrap items-baseline" style={{ gap: S.sm }}>
                    <a href={`/tools/${e.toolId}`} style={{ fontSize: F.lg, fontWeight: 700, color: C.text, textDecoration: "none", letterSpacing: TRACK.tight }}>
                      {e.toolName}
                    </a>
                    <span style={{ fontSize: F.xs, color: ink(catOf(e.cat).color) }}>{catOf(e.cat).label}</span>
                    {e.kind && <span style={{ fontSize: F.xs, color: C.dim }}>{KIND_LABEL[e.kind] || e.kind}</span>}
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
                  <p style={{ fontSize: F.md, lineHeight: 1.6, color: C.text, margin: `${S.sm}px 0 0`, maxWidth: "64ch" }}>
                    {e.headline}
                  </p>
                  {e.sourceUrl && (
                    <p style={{ margin: `${S.sm}px 0 0` }}>
                      <a href={outbound(e.sourceUrl)} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: F.xs, color: C.muted }}>
                        {e.sourceUrl.replace(/^https?:\/\//, "").slice(0, 70)}
                      </a>
                    </p>
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
export default function ChangesFeed({ entries = [], tools = [] }) {
  return (
    <main style={{ background: C.bg, color: C.text, minHeight: "100vh" }}>
      <div className="mx-auto" style={{ maxWidth: 860, padding: "0 20px" }}>
        <nav style={{ paddingTop: S["2xl"], fontSize: F.sm }}>
          <a href="/" style={{ color: C.muted, textDecoration: "none" }}>watchfor.tools</a>
          <span style={{ color: C.dim }}> / </span><span>Recent updates</span>
        </nav>

        <header style={{ paddingTop: S.xl }}>
          <h1 style={{ fontSize: F.hero, fontWeight: 800, letterSpacing: TRACK.tighter, lineHeight: 1.05, margin: 0 }}>
            Recent updates
          </h1>
          <p style={{ fontSize: F.lg, color: C.muted, maxWidth: "58ch", lineHeight: 1.5, margin: `${S.md}px 0 0` }}>
            Pricing moves, new features, rebrands and wind-downs across the directory, dated and in
            order. The listings say what each tool is. This says what happened to it.
          </p>
        </header>

        <div style={{ paddingBottom: S["4xl"] }}>
          <FeedRows entries={entries} tools={tools} />
        </div>
      </div>
    </main>
  );
}
