import React from "react";
import { outbound } from "@/lib/outbound";
import { C, S, R, F, TRACK, ink, catOf, socialLabel, SOCIALS, formatDay } from "@/lib/tools";
import { toolDescription, logoAlt } from "@/lib/seo";

/*
 * One tool, at its own URL, rendered on the server.
 *
 * Deliberately NOT a client component and deliberately not sharing the modal's
 * code. The modal is interactive: it votes, it opens a review form, it carries
 * a session. This has to be complete in the HTML for a crawler that will never
 * run a line of our JavaScript, and the quickest way to fail at that is to
 * reuse a component whose content arrives after hydration.
 *
 * So it renders the same facts with no state at all: no useState, no effects,
 * no fetch. Everything on the page is in the first response. Reviews are read
 * on the server and printed; voting and rating live on the directory page,
 * which this links back to.
 *
 * The visual language is the public site's, from lib/tools.js. The spine, the
 * category colour through ink(), the neutral attribute line, the solid
 * VisitSite treatment: all the same rules, because a tool page that looked
 * like a different site would read as a different site.
 */

const Fact = ({ children }) => (
  <span style={{ fontSize: F.xs, color: C.muted }}>{children}</span>
);

function Facts({ tool }) {
  const facts = [
    tool.price,
    tool.free && "free plan",
    tool.suite && `part of ${tool.suite}`,
    tool.linked && `same owner as ${tool.linked}`,
    tool.owner && `by ${tool.owner}`,
    tool.suggestedBy >= 2 && `suggested by ${tool.suggestedBy} people`,
    tool.claimed && "claimed",
    !tool.verified && "unverified",
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

export default function ToolPage({ tool, related, reviews = [], rating, changes = [], lastUpdated }) {
  const col = catOf(tool.cat).color;
  const socials = SOCIALS
    .map(({ key }) => [key, tool.social?.[key]])
    .filter(([, href]) => href);

  return (
    <main style={{ background: C.bg, color: C.text, minHeight: "100vh" }}>
      <div className="mx-auto" style={{ maxWidth: 820, padding: "0 20px" }}>

        <nav aria-label="Breadcrumb" style={{ paddingTop: S["2xl"], fontSize: F.sm }}>
          <a href="/" style={{ color: C.muted, textDecoration: "none" }}>watchfor.tools</a>
          <span style={{ color: C.dim }}> / </span>
          <a href={`/#${tool.cat}`} style={{ color: ink(col), textDecoration: "none" }}>
            {catOf(tool.cat).label}
          </a>
          <span style={{ color: C.dim }}> / </span>
          <span style={{ color: C.text }}>{tool.name}</span>
        </nav>

        <article style={{
          background: C.panel, border: `1px solid ${C.line}`, borderRadius: R.card,
          overflow: "hidden", marginTop: S.xl,
        }}>
          {/* The spine, same 4px as the detail modal. */}
          <div style={{ height: 4, background: col }} />
          <div style={{ padding: S["2xl"] }}>
            <div className="flex items-start" style={{ gap: S.lg }}>
              {tool.logo && (
                <img src={tool.logo} alt={logoAlt(tool)} width={46} height={46}
                  style={{
                    width: 46, height: 46, borderRadius: R.card, flexShrink: 0,
                    background: "#FFFFFF", objectFit: "contain", padding: S.xs,
                  }} />
              )}
              <div style={{ minWidth: 0 }}>
                <h1 style={{ fontSize: F["2xl"], fontWeight: 800, margin: 0, letterSpacing: TRACK.tighter }}>
                  {tool.name}
                </h1>
                <p style={{ fontSize: F.sm, color: ink(col), margin: `${S.xs}px 0 0` }}>
                  {catOf(tool.cat).label}
                </p>
              </div>
            </div>

            <p style={{ fontSize: F.lg, lineHeight: 1.55, margin: `${S.lg}px 0 0`, color: C.text }}>
              {tool.one}
            </p>

            <Facts tool={tool} />

            <p style={{ fontSize: F.lg, lineHeight: 1.62, margin: `${S.xl}px 0 0` }}>{tool.note}</p>

            {/* The caveat, and the reason this directory exists. It is in the
                server HTML because it is the part worth citing. */}
            <p style={{ fontSize: F.md, lineHeight: 1.6, margin: `${S.md}px 0 0`, color: C.muted }}>
              <span style={{ color: C.warnInk, fontWeight: 700 }}>Watch for. </span>{tool.watch}
            </p>

            {tool.ratings?.length > 0 && (
              <section style={{ marginTop: S.xl }}>
                <h2 style={{ fontSize: F.xs, color: C.dim, margin: 0, fontWeight: 600 }}>External ratings</h2>
                <ul style={{ margin: `${S.sm}px 0 0`, paddingLeft: 18 }}>
                  {tool.ratings.map((r) => (
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
                <p style={{ fontSize: F.xs, color: C.dim, margin: `${S.sm}px 0 0`, lineHeight: 1.5 }}>
                  Collected on other platforms, from a different set of people than the reviews here,
                  and deliberately never averaged together.
                </p>
              </section>
            )}

            <div className="flex flex-wrap items-center" style={{ gap: S.lg, marginTop: S.xl }}>
              <a href={outbound(tool.url)} target="_blank" rel="noopener noreferrer"
                style={{
                  background: C.text, color: C.bg, borderRadius: R.control,
                  padding: "8px 16px", fontSize: F.md, fontWeight: 700, textDecoration: "none",
                }}>{tool.domain}</a>
              {socials.map(([key, href]) => (
                <a key={key} href={outbound(href)} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: F.sm, color: C.muted }}>{socialLabel(key)}</a>
              ))}
            </div>

            <p style={{ fontSize: F.xs, color: C.dim, margin: `${S.xl}px 0 0`, lineHeight: 1.55 }}>
              {tool.updated && <>Entry last checked {formatDay(tool.updated)}. </>}
              <a href={`/?tool=${encodeURIComponent(tool.id)}`} style={{ color: C.muted }}>
                Rate it, review it or report a problem on the directory
              </a>.
            </p>
          </div>
        </article>

        {/*
          * What happened to this tool, as opposed to what it is. The listing
          * above is the description; this is the record. Keeping them apart is
          * why the description does not grow a sentence every week.
          */}
        {changes.length > 0 && (
          <section style={{ marginTop: S["3xl"] }}>
            <h2 style={{ fontSize: F.xl, fontWeight: 700, margin: 0, letterSpacing: TRACK.tight }}>
              Recent changes
            </h2>
            <div style={{ marginTop: S.md }}>
              {changes.map((c) => (
                <article key={c.id} style={{ borderTop: `1px solid ${C.line}`, padding: `${S.md}px 0` }}>
                  <time dateTime={c.date} style={{ fontSize: F.xs, color: C.dim }}>{formatDay(c.date)}</time>
                  <p style={{ fontSize: F.md, lineHeight: 1.6, margin: `${S.xs}px 0 0`, maxWidth: "64ch" }}>{c.headline}</p>
                  {c.sourceUrl && (
                    <a href={outbound(c.sourceUrl)} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: F.xs, color: C.muted }}>
                      {c.sourceUrl.replace(/^https?:\/\//, "").slice(0, 60)}
                    </a>
                  )}
                </article>
              ))}
            </div>
            <p style={{ fontSize: F.xs, color: C.dim, margin: `${S.md}px 0 0` }}>
              <a href="/changes" style={{ color: C.muted }}>Every change across the directory</a>
            </p>
          </section>
        )}

        {reviews.length > 0 && (
          <section style={{ marginTop: S["3xl"] }}>
            <h2 style={{ fontSize: F.xl, fontWeight: 700, margin: 0, letterSpacing: TRACK.tight }}>
              What people say
              {rating && (
                <span className="tnum" style={{ fontSize: F.md, color: C.muted, fontWeight: 500, marginLeft: S.sm }}>
                  {rating.ratingValue} from {rating.ratingCount}
                </span>
              )}
            </h2>
            <div style={{ marginTop: S.md }}>
              {reviews.map((r) => (
                <div key={r.id} style={{ borderTop: `1px solid ${C.line}`, padding: `${S.md}px 0` }}>
                  <p style={{ fontSize: F.sm, margin: 0 }}>
                    <b>{r.author}</b>
                    <span className="tnum" style={{ color: C.star, marginLeft: S.sm }}>
                      {"★".repeat(r.rating)}<span style={{ color: C.starOff }}>{"★".repeat(5 - r.rating)}</span>
                    </span>
                    <span style={{ color: C.dim, marginLeft: S.sm }}>{r.date}</span>
                  </p>
                  {r.text && <p style={{ fontSize: F.md, color: C.muted, lineHeight: 1.55, margin: `${S.xs}px 0 0` }}>{r.text}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {/*
          * The links that make the catalogue crawlable from any entry. Without
          * these every tool page is an orphan: reachable from the sitemap once,
          * linked from nothing, and quietly dropped.
          */}
        {related.length > 0 && (
          <section style={{ marginTop: S["3xl"] }}>
            <h2 style={{ fontSize: F.xl, fontWeight: 700, margin: 0, letterSpacing: TRACK.tight }}>
              Related tools
            </h2>
            <ul style={{ listStyle: "none", padding: 0, margin: `${S.md}px 0 0` }}>
              {related.map(({ tool: t, why }) => (
                <li key={t.id} style={{ borderTop: `1px solid ${C.line}`, padding: `${S.md}px 0` }}>
                  <a href={`/tools/${t.id}`} style={{ color: C.text, fontWeight: 700, fontSize: F.md, textDecoration: "none" }}>
                    {t.name}
                  </a>
                  <span style={{ fontSize: F.xs, color: ink(catOf(t.cat).color), marginLeft: S.sm }}>
                    {catOf(t.cat).label}
                  </span>
                  <span style={{ fontSize: F.xs, color: C.dim, marginLeft: S.sm }}>{why}</span>
                  <p style={{ fontSize: F.sm, color: C.muted, margin: `${S.xs}px 0 0`, lineHeight: 1.5 }}>{t.one}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer style={{ marginTop: S["4xl"], paddingBottom: S["4xl"] }}>
          <p style={{ fontSize: F.xs, color: C.dim, lineHeight: 1.6, maxWidth: "68ch" }}>
            <a href="/" style={{ color: C.muted }}>watchfor.tools</a> is an independent directory of
            tools for Shopify app vendors. Not affiliated with, endorsed by, or sponsored by Shopify.
            No affiliate links and no paid placement. Directory last updated {lastUpdated}.
          </p>
        </footer>
      </div>
    </main>
  );
}
