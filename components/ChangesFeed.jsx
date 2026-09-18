"use client";

import React, { useState, useMemo } from "react";
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

export default function ChangesFeed({ entries = [], tools = [] }) {
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
    <main style={{ background: C.bg, color: C.text, minHeight: "100vh" }}>
      <div className="mx-auto" style={{ maxWidth: 860, padding: "0 20px" }}>
        <nav style={{ paddingTop: S["2xl"], fontSize: F.sm }}>
          <a href="/" style={{ color: C.muted, textDecoration: "none" }}>watchfor.tools</a>
          <span style={{ color: C.dim }}> / </span><span>Changes</span>
        </nav>

        <header style={{ paddingTop: S.xl }}>
          <h1 style={{ fontSize: F.hero, fontWeight: 800, letterSpacing: TRACK.tighter, lineHeight: 1.05, margin: 0 }}>
            What changed
          </h1>
          <p style={{ fontSize: F.lg, color: C.muted, maxWidth: "58ch", lineHeight: 1.5, margin: `${S.md}px 0 0` }}>
            Pricing moves, new features, rebrands and wind-downs across the directory, dated and in
            order. The listings say what each tool is. This says what happened to it.
          </p>
        </header>

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
          </div>
        )}

        <div style={{ marginTop: S.xl, paddingBottom: S["4xl"] }}>
          {entries.length === 0 ? (
            <p style={{ fontSize: F.md, color: C.muted, lineHeight: 1.6, maxWidth: "58ch" }}>
              Nothing recorded yet. The directory is checked weekly and anything material lands here.
            </p>
          ) : rows.length === 0 ? (
            <p style={{ fontSize: F.md, color: C.muted, lineHeight: 1.6 }}>
              Nothing under that filter.
            </p>
          ) : rows.map((e) => (
            <article key={e.id} style={{ borderTop: `1px solid ${C.line}`, padding: `${S.lg}px 0` }}>
              <div className="flex items-start" style={{ gap: S.md }}>
                <Logo entry={e} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="flex flex-wrap items-baseline" style={{ gap: S.sm }}>
                    <a href={`/tools/${e.toolId}`} style={{ fontSize: F.lg, fontWeight: 700, color: C.text, textDecoration: "none", letterSpacing: TRACK.tight }}>
                      {e.toolName}
                    </a>
                    <span style={{ fontSize: F.xs, color: ink(catOf(e.cat).color) }}>{catOf(e.cat).label}</span>
                    {e.kind && <span style={{ fontSize: F.xs, color: C.dim }}>{KIND_LABEL[e.kind] || e.kind}</span>}
                    <time dateTime={e.date} style={{ fontSize: F.xs, color: C.dim, marginLeft: "auto" }}>
                      {formatDay(e.date)}
                    </time>
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
      </div>
    </main>
  );
}
