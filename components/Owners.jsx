import React from "react";
import { C, S, R, F, TRACK } from "@/lib/tools";
import { Pill } from "@/components/Pill";
import { outbound } from "@/lib/outbound";
import { relationOf } from "@/lib/seo";

/*
 * /owners and /owners/[id], server-rendered with no client state, the same
 * contract as components/Categories.jsx. An owner page lists every published
 * entry the owner controls, across tools, newsletters and events, each with
 * its relationship in one plain sentence and a link to its own page. It never
 * copies a listing's caveat: the caveat is on the listing.
 */
export function OwnerPage({ owner, entries, others = [] }) {
  return (
    <main style={{ background: C.bg, color: C.text }}>
      <div className="mx-auto" style={{ maxWidth: 820, padding: "0 16px" }}>
        <nav aria-label="Breadcrumb" style={{ fontSize: F.sm, color: C.dim, marginTop: S["2xl"] }}>
          <a href="/" style={{ color: C.muted }}>Directory</a>{" / "}
          <a href="/owners" style={{ color: C.muted }}>Owners</a>{" / "}
          <span>{owner.name}</span>
        </nav>
        <h1 style={{ fontSize: F.hero, fontWeight: 800, margin: `${S.md}px 0 0`, letterSpacing: TRACK.tighter, lineHeight: 1.05 }}>
          {owner.name}
        </h1>
        <p style={{ fontSize: F.md, color: C.muted, margin: `${S.sm}px 0 0` }}>
          {owner.type === "Person" ? "A person" : "A company"} behind {entries.length} listings here
          {owner.url && <>{". "}<a href={outbound(owner.url)} target="_blank" rel="noopener noreferrer" style={{ color: C.muted }}>{owner.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}</a></>}
          .
        </p>
        {owner.notes && <p style={{ fontSize: F.lg, lineHeight: 1.6, margin: `${S.lg}px 0 0`, maxWidth: "68ch" }}>{owner.notes}</p>}

        <h2 style={{ fontSize: F.xl, fontWeight: 700, margin: `${S["2xl"]}px 0 0`, letterSpacing: TRACK.tight }}>What it controls</h2>
        <ul style={{ listStyle: "none", padding: 0, margin: `${S.sm}px 0 0` }}>
          {entries.map((m) => (
            <li key={`${m.kind}:${m.id}`} style={{ borderTop: `1px solid ${C.line}`, padding: `${S.lg}px 0` }}>
              <div className="flex flex-wrap items-baseline" style={{ gap: S.sm }}>
                <a href={m.href} style={{ color: C.text, fontWeight: 700, fontSize: F.lg, textDecoration: "none" }}>{m.name}</a>
                <span style={{ fontSize: F.xs, color: C.dim }}>{m.kindLabel}</span>
                {m.dying && <Pill tone="warn">winding down</Pill>}
              </div>
              <p style={{ fontSize: F.sm, color: C.text, margin: `${S.xs}px 0 0`, lineHeight: 1.5 }}>{relationOf(m, owner)}</p>
              {m.one && <p style={{ fontSize: F.sm, color: C.muted, margin: `${S.xs}px 0 0`, lineHeight: 1.5 }}>{m.one}</p>}
            </li>
          ))}
        </ul>

        <p style={{ fontSize: F.sm, color: C.muted, lineHeight: 1.55, margin: `${S.xl}px 0 0`, maxWidth: "68ch" }}>
          Shared ownership is recorded where a listing's own site, or the owner's, states it. Each listing's
          caveat is on its own page.
        </p>

        {others.length > 0 && (
          <p style={{ fontSize: F.sm, color: C.muted, margin: `${S.lg}px 0 0`, lineHeight: 1.7 }}>
            Other owners:{" "}
            {others.map((o, i) => (
              <React.Fragment key={o.id}>{i > 0 && ", "}<a href={`/owners/${o.id}`} style={{ color: C.text }}>{o.name}</a></React.Fragment>
            ))}
          </p>
        )}
      </div>
    </main>
  );
}

export function OwnerIndex({ owners }) {
  return (
    <main style={{ background: C.bg, color: C.text }}>
      <div className="mx-auto" style={{ maxWidth: 820, padding: "0 16px" }}>
        <h1 style={{ fontSize: F.hero, fontWeight: 800, margin: `${S["3xl"]}px 0 0`, letterSpacing: TRACK.tighter, lineHeight: 1.05 }}>
          Owners
        </h1>
        <p style={{ fontSize: F.lg, color: C.muted, lineHeight: 1.55, margin: `${S.md}px 0 0`, maxWidth: "62ch" }}>
          Companies and people behind more than one listing. When two listings share an owner, read them as one
          source, not two.
        </p>
        <ul style={{ listStyle: "none", padding: 0, margin: `${S.xl}px 0 0` }}>
          {owners.map((o) => (
            <li key={o.id} style={{ borderTop: `1px solid ${C.line}`, padding: `${S.lg}px 0` }}>
              <div className="flex flex-wrap items-baseline" style={{ gap: S.sm }}>
                <a href={`/owners/${o.id}`} style={{ color: C.text, fontWeight: 700, fontSize: F.lg, textDecoration: "none" }}>{o.name}</a>
                <span className="tnum" style={{ fontSize: F.xs, color: C.dim }}>{o.entries.length} listings</span>
              </div>
              <p style={{ fontSize: F.sm, color: C.muted, margin: `${S.xs}px 0 0`, lineHeight: 1.5 }}>
                {o.entries.map((m) => m.name).join(", ")}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
