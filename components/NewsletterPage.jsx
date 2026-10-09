import React from "react";
import { outbound } from "@/lib/outbound";
import { C, S, R, F, TRACK, formatDay } from "@/lib/tools";
import { Pill } from "@/components/Pill";
import Engagement from "@/components/Engagement";
import FooterLinks from "@/components/FooterLinks";

/*
 * One newsletter, at its own URL, rendered on the server.
 *
 * Deliberately mirrors ToolPage.jsx: no client state in this file, everything
 * in the first response, reviews read on the server and printed. The one
 * interactive piece, rating/reviewing/reporting/claiming, is an isolated client
 * island (components/Engagement.jsx, shared by every section) exactly as the tool flow keeps its interaction in
 * the directory modal rather than in the server page.
 *
 * No category colour anywhere. The category palette is reserved for tool
 * categories (colour invariant A), and a newsletter is not a tool category, so
 * this page is neutral by construction: a plain rule rather than a coloured
 * spine, neutral Pills, no accent except the green that every action wears.
 */

const Fact = ({ children }) => (
  <span style={{ fontSize: F.xs, color: C.muted }}>{children}</span>
);

/*
 * Cadence and run length together, as the first thing on the line, because that
 * pairing is the credibility signal: "Weekly, 1,170 issues" and "New, since Feb
 * 2026" have to read as different kinds of thing at a glance. The rest of the
 * facts follow in muted type.
 */
function Facts({ n }) {
  const since = n.started ? `since ${formatStarted(n.started)}` : "";
  const run = [n.cadence, n.issueCount ? `${n.issueCount.toLocaleString()} issues` : (n.cadence ? "" : "New")]
    .filter(Boolean).join(", ");
  const facts = [
    run,
    since,
    n.free && "Free",
    n.author && `by ${n.author}`,
    n.publisher && n.publisher !== n.author && n.publisher,
    n.platform,
    n.claimed && "claimed",
  ].filter(Boolean);

  return (
    <p className="flex flex-wrap items-baseline" style={{ gap: S.sm, margin: `${S.md}px 0 0` }}>
      {facts.map((f, i) => (
        <React.Fragment key={f}>
          {i > 0 && <span aria-hidden="true" style={{
            width: 1, height: 9, background: C.edge, display: "inline-block", opacity: 0.7,
          }} />}
          <Fact>{f}</Fact>
        </React.Fragment>
      ))}
    </p>
  );
}

/* YYYY, YYYY-MM or YYYY-MM-DD into something a reader scans: "Feb 2026",
   "2022". The run-gap check is the reader's, so the month is kept when known. */
function formatStarted(s) {
  const [y, m] = String(s).split("-");
  if (!m) return y;
  const month = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(m)] || "";
  return month ? `${month} ${y}` : y;
}

/* The publication's own domain, for verifying a claim. Same derivation as
   listedEntity in lib/entries.js, which is what the claim route checks. */
const domainOf = (url) =>
  String(url || "").replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0].toLowerCase();

export default function NewsletterPage({ newsletter: n, related, reviews = [], rating, forVendors, session = null, lastUpdated }) {
  const domain = String(n.url || "").replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0];
  const socials = Object.entries(n.social || {}).filter(([, href]) => href);

  return (
    <main style={{ background: C.bg, color: C.text, minHeight: "100vh" }}>
      <div className="mx-auto" style={{ maxWidth: 820, padding: "0 20px" }}>

        <nav aria-label="Breadcrumb" style={{ paddingTop: S["2xl"], fontSize: F.sm }}>
          <a href="/" style={{ color: C.muted, textDecoration: "none" }}>watchfor.tools</a>
          <span style={{ color: C.dim }}> / </span>
          <a href="/newsletters" style={{ color: C.muted, textDecoration: "none" }}>Newsletters</a>
          <span style={{ color: C.dim }}> / </span>
          <span style={{ color: C.text }}>{n.name}</span>
        </nav>

        <article style={{
          background: C.panel, border: `1px solid ${C.line}`, borderRadius: R.card,
          overflow: "hidden", marginTop: S.xl,
        }}>
          {/* A neutral rule, not a coloured spine: newsletters carry no category
              colour (invariant A). */}
          <div style={{ height: 3, background: C.edge }} />
          <div style={{ padding: S["2xl"] }}>
            <div className="flex items-start" style={{ gap: S.lg }}>
              {n.logo && (
                <img src={n.logo} alt={`${n.name} logo`} width={46} height={46}
                  style={{
                    width: 46, height: 46, borderRadius: R.card, flexShrink: 0,
                    background: "#FFFFFF", objectFit: "contain", padding: S.xs,
                  }} />
              )}
              <div style={{ minWidth: 0 }}>
                <div className="flex flex-wrap items-baseline" style={{ gap: S.sm }}>
                  <h1 style={{ fontSize: F["2xl"], fontWeight: 800, margin: 0, letterSpacing: TRACK.tighter }}>
                    {n.name}
                  </h1>
                  {/* Positive, neutral marker only. Absent renders nothing: a
                      newsletter that is not about Shopify is not thereby worse. */}
                  {n.shopifySpecific && <Pill>Shopify-specific</Pill>}
                </div>
                {/* Accurate for both members of each group: ShopOps is written
                    for merchants but is about the platform, so "about the
                    Shopify platform" fits it without fighting its watch. */}
                <p style={{ fontSize: F.sm, color: C.muted, margin: `${S.xs}px 0 0` }}>
                  {forVendors ? "About the Shopify platform" : "Merchant-side, read sideways for demand signal"}
                </p>
              </div>
            </div>

            <p style={{ fontSize: F.lg, lineHeight: 1.55, margin: `${S.lg}px 0 0`, color: C.text }}>
              {n.one}
            </p>

            <Facts n={n} />

            <p style={{ fontSize: F.lg, lineHeight: 1.62, margin: `${S.xl}px 0 0` }}>{n.note}</p>

            {/* The caveat, and the reason this directory exists, for a newsletter
                exactly as for a tool. In the server HTML because it is the part
                worth citing. */}
            <p style={{ fontSize: F.md, lineHeight: 1.6, margin: `${S.md}px 0 0`, color: C.muted }}>
              <span style={{ color: C.warnInk, fontWeight: 700 }}>Watch for. </span>{n.watch}
            </p>

            {n.ratings?.length > 0 && (
              <section style={{ marginTop: S.xl }}>
                <h2 style={{ fontSize: F.xs, color: C.dim, margin: 0, fontWeight: 600 }}>External ratings</h2>
                <ul style={{ margin: `${S.sm}px 0 0`, paddingLeft: 18 }}>
                  {n.ratings.map((r) => (
                    <li key={r.source} style={{ fontSize: F.sm, color: C.muted, lineHeight: 1.6 }}>
                      <a href={outbound(r.url)} target="_blank" rel="noopener noreferrer" style={{ color: C.text }}>
                        {r.source}
                      </a>
                      {r.score != null && <> {r.score}{r.outOf && r.outOf !== 5 ? `/${r.outOf}` : ""}</>}
                      {r.count != null && <> from {r.count}</>}
                      {r.captured && <span style={{ color: C.dim }}>, read {formatDay(r.captured)}</span>}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <div className="flex flex-wrap items-center" style={{ gap: S.lg, marginTop: S.xl }}>
              <a href={outbound(n.url)} target="_blank" rel="noopener noreferrer"
                style={{
                  background: C.text, color: C.bg, borderRadius: R.control,
                  padding: "8px 16px", fontSize: F.md, fontWeight: 700, textDecoration: "none",
                }}>{domain}</a>
              {socials.map(([key, href]) => (
                <a key={key} href={outbound(href)} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: F.sm, color: C.muted }}>{key.toUpperCase()}</a>
              ))}
            </div>

            {n.updated && (
              <p style={{ fontSize: F.xs, color: C.dim, margin: `${S.xl}px 0 0`, lineHeight: 1.55 }}>
                Entry last checked {formatDay(n.updated)}.
              </p>
            )}

            {/* Rate, review, report and claim, the same as a tool. Isolated
                client island so this file stays server-only and whole in the
                first response. */}
            <Engagement kind="newsletter" initialReviews={reviews}
              entity={{ ...n, domain: n.domain || domainOf(n.url) }} />
          </div>
        </article>

        {related.length > 0 && (
          <section style={{ marginTop: S["3xl"] }}>
            <h2 style={{ fontSize: F.xl, fontWeight: 700, margin: 0, letterSpacing: TRACK.tight }}>
              Related newsletters
            </h2>
            <ul style={{ listStyle: "none", padding: 0, margin: `${S.md}px 0 0` }}>
              {related.map((r) => (
                <li key={r.id} style={{ borderTop: `1px solid ${C.line}`, padding: `${S.md}px 0` }}>
                  <a href={`/newsletters/${r.id}`} style={{ color: C.text, fontWeight: 700, fontSize: F.md, textDecoration: "none" }}>
                    {r.name}
                  </a>
                  {r.shopifySpecific && <span style={{ fontSize: F.xs, color: C.muted, marginLeft: S.sm }}>Shopify-specific</span>}
                  <p style={{ fontSize: F.sm, color: C.muted, margin: `${S.xs}px 0 0`, lineHeight: 1.5 }}>{r.one}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer style={{ marginTop: S["4xl"], paddingBottom: S["4xl"] }}>

          <FooterLinks />
          <p style={{ fontSize: F.xs, color: C.dim, lineHeight: 1.6, maxWidth: "68ch" }}>
            <a href="/" style={{ color: C.muted }}>watchfor.tools</a> is an independent directory for
            Shopify app vendors. Not affiliated with, endorsed by, or sponsored by Shopify.
            No affiliate links and no paid placement. Directory last updated {lastUpdated}.
          </p>
        </footer>
      </div>
    </main>
  );
}
