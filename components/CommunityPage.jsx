import React from "react";
import { AlsoFrom } from "@/components/OwnerLine";
import { outbound } from "@/lib/outbound";
import { C, S, R, F, TRACK, formatDay } from "@/lib/tools";
import { launchLabel } from "@/lib/launched";
import Engagement from "@/components/Engagement";

/*
 * One community, at its own URL, rendered on the server. Mirrors
 * PodcastPage.jsx: no client state in this file, everything in the first
 * response, and the interactive parts (rating, reviewing, reporting, claiming)
 * are the shared client island.
 *
 * No category colour (invariant A): a neutral rule.
 */

const Fact = ({ children }) => (
  <span style={{ fontSize: F.xs, color: C.muted }}>{children}</span>
);

function Facts({ c, owner }) {
  const facts = [
    c.platform,
    c.price,
    c.entry && `Entry: ${c.entry}`,
    launchLabel(c, "group"),
    c.organisers && (owner?.href
      ? <a key="org" href={owner.href} style={{ color: "inherit", textDecoration: "underline", textDecorationColor: C.edge, textUnderlineOffset: 2 }}>run by {c.organisers}</a>
      : `run by ${c.organisers}`),
    c.claimed && "claimed",
  ].filter(Boolean);

  return (
    <p className="flex flex-wrap items-baseline" style={{ gap: S.sm, margin: `${S.md}px 0 0` }}>
      {facts.map((f, i) => (
        <React.Fragment key={typeof f === "string" ? f : i}>
          {i > 0 && <span aria-hidden="true" style={{
            width: 1, height: 9, background: C.edge, display: "inline-block", opacity: 0.7,
          }} />}
          <Fact>{f}</Fact>
        </React.Fragment>
      ))}
    </p>
  );
}

const domainOf = (url) =>
  String(url || "").replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0].toLowerCase();

const Row = ({ label, children }) => (
  <div style={{ display: "flex", gap: S.md, padding: `${S.sm}px 0`, borderTop: `1px solid ${C.line}`, fontSize: F.sm }}>
    <dt style={{ color: C.muted, minWidth: 120, flexShrink: 0 }}>{label}</dt>
    <dd style={{ margin: 0, color: C.text, lineHeight: 1.55 }}>{children}</dd>
  </div>
);

export default function CommunityPage({ community: c, related, reviews = [], owner = null, claimDomain = "" }) {
  const domain = domainOf(c.url);
  const socials = Object.entries(c.social || {}).filter(([, href]) => href);

  return (
    <main style={{ background: C.bg, color: C.text }}>
      <div className="mx-auto" style={{ padding: "0 20px" }}>

        <nav aria-label="Breadcrumb" style={{ paddingTop: S["2xl"], fontSize: F.sm }}>
          <a href="/" style={{ color: C.muted, textDecoration: "none" }}>watchfor.tools</a>
          <span style={{ color: C.dim }}> / </span>
          <a href="/communities" style={{ color: C.muted, textDecoration: "none" }}>Communities</a>
          <span style={{ color: C.dim }}> / </span>
          <span style={{ color: C.text }}>{c.name}</span>
        </nav>

        <article style={{
          background: C.panel, border: `1px solid ${C.line}`, borderRadius: R.card,
          overflow: "hidden", marginTop: S.xl,
        }}>
          <div style={{ height: 3, background: C.edge }} />
          <div style={{ padding: S["2xl"] }}>
            <div className="flex items-center" style={{ gap: S.md }}>
              {c.logo && <img src={c.logo} alt={`${c.name} logo`} width={46} height={46} decoding="async"
                style={{ width: 46, height: 46, borderRadius: R.card, flexShrink: 0, background: C.logoTile, objectFit: "contain", padding: S.xs, border: `1px solid ${C.line}` }} />}
              <h1 style={{ fontSize: F["2xl"], fontWeight: 600, margin: 0, letterSpacing: TRACK.tighter }}>
                {c.name}
              </h1>
            </div>
            <p style={{ fontSize: F.sm, color: C.muted, margin: `${S.xs}px 0 0` }}>
              {c.forBuilders ? "For people who build on Shopify" : "For merchants, read sideways"}
            </p>

            <p style={{ fontSize: F.lg, lineHeight: 1.55, margin: `${S.lg}px 0 0`, color: C.text }}>
              {c.one}
            </p>

            <Facts c={c} owner={owner} />
            <AlsoFrom ctx={owner} />

            <p style={{ fontSize: F.lg, lineHeight: 1.62, margin: `${S.xl}px 0 0` }}>{c.note}</p>

            <p style={{ fontSize: F.md, lineHeight: 1.6, margin: `${S.md}px 0 0`, color: C.muted }}>
              <span style={{ color: C.warnInk, fontWeight: 700 }}>Watch for. </span>{c.watch}
            </p>

            <dl style={{ margin: `${S.xl}px 0 0` }}>
              {c.audience && <Row label="Who is in it">{c.audience}</Row>}
              {c.members && <Row label="Members">{c.members}, by its own count</Row>}
              {c.topics?.length > 0 && <Row label="What is discussed">{c.topics.join(", ")}</Row>}
            </dl>

            <div className="flex flex-wrap items-center" style={{ gap: S.lg, marginTop: S.xl }}>
              <a href={outbound(c.url)} target="_blank" rel="noopener noreferrer"
                style={{
                  background: C.text, color: C.bg, borderRadius: R.control,
                  padding: "8px 16px", fontSize: F.md, fontWeight: 700, textDecoration: "none",
                }}>{domain}</a>
              {socials.map(([key, href]) => (
                <a key={key} href={outbound(href)} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: F.sm, color: C.muted }}>{key.toUpperCase()}</a>
              ))}
            </div>

            {c.updated && (
              <p style={{ fontSize: F.xs, color: C.dim, margin: `${S.xl}px 0 0`, lineHeight: 1.55 }}>
                Entry last checked {formatDay(c.updated)}.
              </p>
            )}

            <Engagement kind="group" initialReviews={reviews}
              entity={{ ...c, domain: claimDomain }} />
          </div>
        </article>

        {related.length > 0 && (
          <section style={{ marginTop: S["3xl"] }}>
            <h2 style={{ fontSize: F.xl, fontWeight: 700, margin: 0, letterSpacing: TRACK.tight }}>
              Related communities
            </h2>
            <ul style={{ listStyle: "none", padding: 0, margin: `${S.md}px 0 0` }}>
              {related.map((r) => (
                <li key={r.id} style={{ borderTop: `1px solid ${C.line}`, padding: `${S.md}px 0` }}>
                  <a href={`/communities/${r.id}`} style={{ color: C.text, fontWeight: 700, fontSize: F.md, textDecoration: "none" }}>
                    {r.name}
                  </a>
                  <p style={{ fontSize: F.sm, color: C.muted, margin: `${S.xs}px 0 0`, lineHeight: 1.5 }}>{r.one}</p>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
