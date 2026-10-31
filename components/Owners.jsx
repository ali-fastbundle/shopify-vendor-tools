import React from "react";
import { C, S, R, F, TRACK } from "@/lib/tools";
import { Pill } from "@/components/Pill";
import { outbound } from "@/lib/outbound";
import { relationOf } from "@/lib/seo";
import EventLogo from "@/components/EventLogo";
import { appStoreOf } from "@/lib/owners";

/* The link to an owner's developer page on the Shopify App Store. */
const AppStoreLink = ({ href }) => (
  <a href={outbound(href)} target="_blank" rel="noopener noreferrer" style={{ color: C.muted }}>
    Apps on the Shopify App Store
  </a>
);

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
        <div className="flex flex-wrap items-baseline" style={{ gap: S.md, marginTop: S.md }}>
          <h1 style={{ fontSize: F.hero, fontWeight: 600, margin: 0, letterSpacing: TRACK.tighter, lineHeight: 1.05 }}>
            {owner.name}
          </h1>
          {appStoreOf(owner) && <Pill>App developer</Pill>}
        </div>
        <p style={{ fontSize: F.md, color: C.muted, margin: `${S.sm}px 0 0` }}>
          {owner.type === "Person" ? "A person" : "A company"} behind {entries.length} listings here
          {owner.url && <>{". "}<a href={outbound(owner.url)} target="_blank" rel="noopener noreferrer" style={{ color: C.muted }}>{owner.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}</a></>}
          .
        </p>
        {appStoreOf(owner) && (
          <p style={{ fontSize: F.sm, color: C.muted, margin: `${S.xs}px 0 0` }}>
            {owner.type === "Person" ? "Publishes" : "Also publishes"} apps on the Shopify App Store. <AppStoreLink href={appStoreOf(owner)} />
          </p>
        )}
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

/*
 * Every owner of a published listing, of any kind (allOwners in
 * lib/ownerIndex.js): a mark, the name, whether a company or a person, the
 * brief note on it, its site, and every listing it is behind, each linked.
 * An owner behind two or more listings links to its own page; one behind a
 * single listing does not have one (invariant 46), so its row is the whole of
 * what there is to say and links the listing instead.
 *
 * No client state, the same contract as the rest of this file. The mark is
 * EventLogo's chain (a hosted file, the favicon of the owner's own site, then
 * initials), which is a client island like it is on every event row.
 */
export function OwnerIndex({ owners }) {
  const shared = owners.filter((o) => o.entries.length >= 2).length;
  return (
    <main style={{ background: C.bg, color: C.text }}>
      <div className="mx-auto" style={{ maxWidth: 820, padding: "0 16px" }}>
        <h1 style={{ fontSize: F.hero, fontWeight: 600, margin: `${S["3xl"]}px 0 0`, letterSpacing: TRACK.tighter, lineHeight: 1.05 }}>
          Owners
        </h1>
        <p style={{ fontSize: F.lg, color: C.muted, lineHeight: 1.55, margin: `${S.md}px 0 0`, maxWidth: "62ch" }}>
          The companies and people behind the tools, newsletters and events listed here. {owners.length} in
          all, {shared} of them behind more than one listing. When two listings share an owner, read them
          as one source, not two.
        </p>
        <p style={{ fontSize: F.sm, color: C.dim, lineHeight: 1.55, margin: `${S.sm}px 0 0`, maxWidth: "62ch" }}>
          An owner is listed only where the listing's own site, or the owner's, says who it is. A listing
          that names nobody is not on this page. App developer marks an owner that also publishes apps
          on the Shopify App Store, read from the App Store itself, with a link to its developer page there.
        </p>
        <ul style={{ listStyle: "none", padding: 0, margin: `${S.xl}px 0 0` }}>
          {owners.map((o) => {
            const site = o.url ? o.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "") : "";
            return (
              <li key={o.key} id={o.id || undefined} style={{ borderTop: `1px solid ${C.line}`, padding: `${S.lg}px 0` }}>
                <div className="flex items-start" style={{ gap: S.md }}>
                  <EventLogo e={{ name: o.name, logo: o.logo, domain: o.domain }} size={40} status="upcoming" />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="flex flex-wrap items-baseline" style={{ gap: S.sm }}>
                      {o.page
                        ? <a href={o.page} style={{ color: C.text, fontWeight: 700, fontSize: F.lg, textDecoration: "none" }}>{o.name}</a>
                        : <span style={{ fontWeight: 700, fontSize: F.lg }}>{o.name}</span>}
                      {o.appStore && <Pill>App developer</Pill>}
                      <span className="tnum" style={{ fontSize: F.xs, color: C.dim }}>
                        {[o.type === "Person" ? "A person" : o.type ? "A company" : "",
                          `${o.entries.length} listing${o.entries.length === 1 ? "" : "s"}`].filter(Boolean).join(", ")}
                      </span>
                    </div>
                    {o.notes && (
                      <p style={{ fontSize: F.sm, color: C.text, margin: `${S.xs}px 0 0`, lineHeight: 1.55, maxWidth: "68ch" }}>{o.notes}</p>
                    )}
                    <ul style={{ listStyle: "none", padding: 0, margin: `${S.sm}px 0 0` }}>
                      {o.entries.map((m) => (
                        <li key={`${m.kind}:${m.id}`} style={{ fontSize: F.sm, lineHeight: 1.6 }}>
                          <a href={m.href} style={{ color: C.text, fontWeight: 600 }}>{m.name}</a>
                          <span style={{ color: C.dim }}> {m.kindLabel.toLowerCase()}. </span>
                          <span style={{ color: C.muted }}>{m.relation}</span>
                          {m.dying && <> <Pill tone="warn">winding down</Pill></>}
                        </li>
                      ))}
                    </ul>
                    {(site || o.page || o.appStore) && (
                      <p className="flex flex-wrap" style={{ gap: S.lg, fontSize: F.sm, margin: `${S.sm}px 0 0` }}>
                        {o.page && <a href={o.page} style={{ color: C.muted }}>Owner page</a>}
                        {site && <a href={outbound(o.url)} target="_blank" rel="noopener noreferrer" style={{ color: C.muted }}>{site}</a>}
                        {o.appStore && <AppStoreLink href={o.appStore} />}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}
