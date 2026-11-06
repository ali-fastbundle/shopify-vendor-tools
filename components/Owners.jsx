import React from "react";
import UpdatesLink from "@/components/UpdatesLink";
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
export function OwnerPage({ owner, entries, others = [], updates = null }) {
  return (
    <main style={{ background: C.bg, color: C.text }}>
      <div className="mx-auto" style={{ padding: "0 16px" }}>
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
        <OwnApps o={owner} max={50} />
        {owner.notes && <p style={{ fontSize: F.lg, lineHeight: 1.6, margin: `${S.lg}px 0 0`  }}>{owner.notes}</p>}
        <UpdatesLink link={updates} />

        <h2 style={{ fontSize: F.xl, fontWeight: 700, margin: `${S["2xl"]}px 0 0`, letterSpacing: TRACK.tight }}>What it controls</h2>
        <ul style={{ listStyle: "none", padding: 0, margin: `${S.sm}px 0 0` }}>
          {entries.map((m) => (
            <li key={`${m.kind}:${m.id}`} style={{ borderTop: `1px solid ${C.line}`, padding: `${S.lg}px 0` }}>
              <div className="flex flex-wrap items-baseline" style={{ gap: S.sm }}>
                <h3 style={{ margin: 0, fontSize: "inherit", fontWeight: "inherit", display: "inline" }}><a href={m.href} style={{ color: C.text, fontWeight: 700, fontSize: F.lg, textDecoration: "none" }}>{m.name}</a></h3>
                <span style={{ fontSize: F.xs, color: C.dim }}>{m.kindLabel}</span>
                {m.dying && <Pill tone="warn">winding down</Pill>}
              </div>
              <p style={{ fontSize: F.sm, color: C.text, margin: `${S.xs}px 0 0`, lineHeight: 1.5 }}>{relationOf(m, owner)}</p>
              {m.one && <p style={{ fontSize: F.sm, color: C.muted, margin: `${S.xs}px 0 0`, lineHeight: 1.5 }}>{m.one}</p>}
            </li>
          ))}
        </ul>

        <p style={{ fontSize: F.sm, color: C.muted, lineHeight: 1.55, margin: `${S.xl}px 0 0`  }}>
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
/* An owner's own App Store apps, by name and linked, the first `max` then the
   rest as a count linking its developer page. Nothing when it has none. */
function OwnApps({ o, max = 4, size = F.sm }) {
  const apps = o.apps || [];
  if (!apps.length) return null;
  const shown = apps.slice(0, max);
  const more = apps.length - shown.length;
  return (
    <p style={{ fontSize: size, color: C.muted, margin: `${S.xs}px 0 0`, lineHeight: 1.6 }}>
      <span style={{ color: C.text, fontWeight: 600 }}>Also publishes on the Shopify App Store: </span>
      {shown.map((a, i) => (
        <React.Fragment key={a.handle}>{i ? ", " : ""}<a href={outbound(`https://apps.shopify.com/${a.handle}`)} target="_blank" rel="noopener noreferrer" style={{ color: C.text }}>{a.name}</a></React.Fragment>
      ))}
      {more > 0 && <>{" and "}<a href={outbound(o.appStore)} target="_blank" rel="noopener noreferrer" style={{ color: C.text }}>{more} more</a></>}
      .{o.appsRead && <span style={{ color: C.dim }}> Read from its developer page on {o.appsRead}.</span>}
    </p>
  );
}

export function OwnerIndex({ owners: all, onlyApps = false }) {
  const devs = all.filter((o) => (o.apps || []).length);
  const owners = onlyApps ? devs : all;
  const shared = all.filter((o) => o.entries.length >= 2).length;
  return (
    <main style={{ background: C.bg, color: C.text }}>
      <div className="mx-auto" style={{ padding: "0 16px" }}>
        <h1 style={{ fontSize: F.hero, fontWeight: 600, margin: `${S["3xl"]}px 0 0`, letterSpacing: TRACK.tighter, lineHeight: 1.05 }}>
          Owners
        </h1>
        <p style={{ fontSize: F.lg, color: C.muted, lineHeight: 1.55, margin: `${S.md}px 0 0`  }}>
          The companies and people behind the tools, newsletters and events listed here. {all.length} in
          all, {shared} of them behind more than one listing, and {devs.length} that also sell their own Shopify apps. When two listings share an owner, read them
          as one source, not two.
        </p>
        <p style={{ fontSize: F.sm, color: C.dim, lineHeight: 1.55, margin: `${S.sm}px 0 0`  }}>
          An owner is listed only where the listing's own site, or the owner's, says who it is. A listing
          that names nobody is not on this page. App developer marks an owner that also publishes apps
          on the Shopify App Store, read from the App Store itself, with a link to its developer page there.
        </p>
        {/* A link, not client state: the filtered list is in the first HTML. */}
        <p style={{ fontSize: F.sm, margin: `${S.md}px 0 0` }}>
          {onlyApps
            ? <>Showing the {devs.length} that publish apps. <a href="/owners" style={{ color: C.text, fontWeight: 600 }}>Show all {all.length}</a></>
            : <a href="/owners?apps=1" style={{ color: C.text, fontWeight: 600 }}>Show only the {devs.length} that publish apps</a>}
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
                      <h2 style={{ margin: 0, fontSize: "inherit", fontWeight: "inherit", display: "inline" }}>{o.page
                        ? <a href={o.page} style={{ color: C.text, fontWeight: 700, fontSize: F.lg, textDecoration: "none" }}>{o.name}</a>
                        : <span style={{ fontWeight: 700, fontSize: F.lg }}>{o.name}</span>}</h2>
                      {o.appStore && <Pill>App developer</Pill>}
                      <span className="tnum" style={{ fontSize: F.xs, color: C.dim }}>
                        {[o.type === "Person" ? "A person" : o.type ? "A company" : "",
                          `${o.entries.length} listing${o.entries.length === 1 ? "" : "s"}`].filter(Boolean).join(", ")}
                      </span>
                    </div>
                    {o.notes && (
                      <p style={{ fontSize: F.sm, color: C.text, margin: `${S.xs}px 0 0`, lineHeight: 1.55  }}>{o.notes}</p>
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
                    <OwnApps o={o} />
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
