import React from "react";
import { AlsoFrom } from "@/components/OwnerLine";
import { outbound } from "@/lib/outbound";
import { C, S, R, F, TRACK, formatDay } from "@/lib/tools";
import { launchLabel } from "@/lib/launched";
import { Pill } from "@/components/Pill";
import Engagement from "@/components/Engagement";
import FollowBox from "@/components/FollowBox";

/*
 * One podcast, at its own URL, rendered on the server. Mirrors
 * NewsletterPage.jsx: no client state in this file, everything in the first
 * response, and the interactive parts (rating, reviewing, reporting, claiming,
 * following) are the shared client islands.
 *
 * No category colour (invariant A): a neutral rule, neutral Pills.
 */

const Fact = ({ children }) => (
  <span style={{ fontSize: F.xs, color: C.muted }}>{children}</span>
);

function Facts({ p, owner }) {
  const run = [
    p.discontinued ? `Stopped publishing${p.lastEpisode ? `, last episode ${formatDay(p.lastEpisode)}` : ""}` : p.cadence,
    p.episodeCount ? `${p.episodeCount.toLocaleString("en-US")} episodes` : "",
  ].filter(Boolean).join(", ");
  const facts = [
    run,
    launchLabel(p, "podcast"),
    p.length,
    p.free && "Free",
    p.host && `hosted by ${p.host}`,
    p.publisher && p.publisher !== p.host && (owner?.href
      ? <a key="pub" href={owner.href} style={{ color: "inherit", textDecoration: "underline", textDecorationColor: C.edge, textUnderlineOffset: 2 }}>{owner.line || p.publisher}</a>
      : (owner?.line || p.publisher)),
    p.platform,
    p.claimed && "claimed",
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

export default function PodcastPage({ podcast: p, related, reviews = [], owner = null, claimDomain = "" }) {
  const domain = domainOf(p.url);
  const socials = Object.entries(p.social || {}).filter(([, href]) => href);

  return (
    <main style={{ background: C.bg, color: C.text }}>
      <div className="mx-auto" style={{ maxWidth: 820, padding: "0 20px" }}>

        <nav aria-label="Breadcrumb" style={{ paddingTop: S["2xl"], fontSize: F.sm }}>
          <a href="/" style={{ color: C.muted, textDecoration: "none" }}>watchfor.tools</a>
          <span style={{ color: C.dim }}> / </span>
          <a href="/podcasts" style={{ color: C.muted, textDecoration: "none" }}>Podcasts</a>
          <span style={{ color: C.dim }}> / </span>
          <span style={{ color: C.text }}>{p.name}</span>
        </nav>

        <article style={{
          background: C.panel, border: `1px solid ${C.line}`, borderRadius: R.card,
          overflow: "hidden", marginTop: S.xl,
        }}>
          <div style={{ height: 3, background: C.edge }} />
          <div style={{ padding: S["2xl"] }}>
            <div className="flex flex-wrap items-baseline" style={{ gap: S.sm }}>
              <h1 style={{ fontSize: F["2xl"], fontWeight: 600, margin: 0, letterSpacing: TRACK.tighter }}>
                {p.name}
              </h1>
              {p.shopifySpecific && <Pill>Shopify-specific</Pill>}
            </div>
            <p style={{ fontSize: F.sm, color: C.muted, margin: `${S.xs}px 0 0` }}>
              {p.discontinued ? "Stopped publishing, kept as a record"
                : p.forAppBuilders ? "Made for app builders"
                : "For merchants and DTC brands, heard sideways"}
            </p>

            <p style={{ fontSize: F.lg, lineHeight: 1.55, margin: `${S.lg}px 0 0`, color: C.text }}>
              {p.one}
            </p>

            <Facts p={p} owner={owner} />
            <AlsoFrom ctx={owner} />

            <p style={{ fontSize: F.lg, lineHeight: 1.62, margin: `${S.xl}px 0 0` }}>{p.note}</p>

            <p style={{ fontSize: F.md, lineHeight: 1.6, margin: `${S.md}px 0 0`, color: C.muted }}>
              <span style={{ color: C.warnInk, fontWeight: 700 }}>Watch for. </span>{p.watch}
            </p>

            {/* How an app vendor gets in front of this audience. Editorial,
                like the caveat: a host cannot write their own rate card here. */}
            {p.reach && !p.discontinued && (
              <section style={{ marginTop: S.xl }}>
                <h2 style={{ fontSize: F.md, fontWeight: 700, margin: 0 }}>How a vendor gets on it</h2>
                <p style={{ fontSize: F.md, lineHeight: 1.6, margin: `${S.xs}px 0 0`, color: C.muted, maxWidth: "62ch" }}>
                  {p.reach} <span style={{ color: C.dim }}>As of {formatDay(p.updated)}.</span>
                </p>
              </section>
            )}

            {p.ratings?.length > 0 && (
              <section style={{ marginTop: S.xl }}>
                <h2 style={{ fontSize: F.xs, color: C.dim, margin: 0, fontWeight: 600 }}>External ratings</h2>
                <ul style={{ margin: `${S.sm}px 0 0`, paddingLeft: 18 }}>
                  {p.ratings.map((r) => (
                    <li key={r.source} style={{ fontSize: F.sm, color: C.muted, lineHeight: 1.6 }}>
                      <a href={outbound(r.url)} target="_blank" rel="noopener noreferrer" style={{ color: C.text }}>{r.source}</a>
                      {r.score != null && <> {r.score}{r.outOf && r.outOf !== 5 ? `/${r.outOf}` : ""}</>}
                      {r.count != null && <> from {r.count}</>}
                      {r.captured && <span style={{ color: C.dim }}>, read {formatDay(r.captured)}</span>}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <div className="flex flex-wrap items-center" style={{ gap: S.lg, marginTop: S.xl }}>
              <a href={outbound(p.url)} target="_blank" rel="noopener noreferrer"
                style={{
                  background: C.text, color: C.bg, borderRadius: R.control,
                  padding: "8px 16px", fontSize: F.md, fontWeight: 700, textDecoration: "none",
                }}>{domain}</a>
              {p.rss && (
                <a href={p.rss} target="_blank" rel="noopener noreferrer" style={{ fontSize: F.sm, color: C.muted }}>RSS feed</a>
              )}
              {socials.map(([key, href]) => (
                <a key={key} href={outbound(href)} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: F.sm, color: C.muted }}>{key.toUpperCase()}</a>
              ))}
            </div>

            {p.updated && (
              <p style={{ fontSize: F.xs, color: C.dim, margin: `${S.xl}px 0 0`, lineHeight: 1.55 }}>
                Entry last checked {formatDay(p.updated)}. Episode counts, dates and lengths are read from the show&apos;s own feed.
              </p>
            )}

            {/* A show that stopped has nothing to follow (lib/follows.js). */}
            {!p.discontinued && p.rss && <FollowBox id={p.id} kind="podcast" name={p.name} hasFeed />}
            <Engagement kind="podcast" initialReviews={reviews}
              entity={{ ...p, domain: claimDomain }} />
          </div>
        </article>

        {related.length > 0 && (
          <section style={{ marginTop: S["3xl"] }}>
            <h2 style={{ fontSize: F.xl, fontWeight: 700, margin: 0, letterSpacing: TRACK.tight }}>
              Related podcasts
            </h2>
            <ul style={{ listStyle: "none", padding: 0, margin: `${S.md}px 0 0` }}>
              {related.map((r) => (
                <li key={r.id} style={{ borderTop: `1px solid ${C.line}`, padding: `${S.md}px 0` }}>
                  <a href={`/podcasts/${r.id}`} style={{ color: C.text, fontWeight: 700, fontSize: F.md, textDecoration: "none" }}>
                    {r.name}
                  </a>
                  {r.discontinued && <span style={{ fontSize: F.xs, color: C.muted, marginLeft: S.sm }}>stopped</span>}
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
