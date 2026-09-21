import React from "react";
import { outbound } from "@/lib/outbound";
import {
  C, S, R, F, TRACK, ink, catOf, ownerOf,
} from "@/lib/tools";
import { logoAlt } from "@/lib/seo";
import { Pill } from "@/components/Pill";

/*
 * Category pages, server rendered.
 *
 * Same contract as components/ToolPage.jsx and for the same reason: no client
 * state, nothing that arrives after hydration, everything in the first
 * response. These exist to be the page a crawler ranks for "Shopify app store
 * data tools" and the page a model cites, and both of those read the HTML once
 * without running a line of our JavaScript.
 *
 * Deliberately not the directory's grid. That component votes, filters, sorts,
 * opens a modal and carries a session; this is a list with links on it. Reusing
 * it would trade the whole point of the page for a card that looks the same.
 *
 * The visual language is the public site's, from lib/tools.js: the spine, the
 * category colour through ink(), one line of muted attributes, the solid
 * VisitSite treatment. A category page that looked like a different site would
 * read as a different site.
 */

const Crumbs = ({ cat }) => (
  <nav aria-label="Breadcrumb" style={{ paddingTop: S["2xl"], fontSize: F.sm }}>
    <a href="/" style={{ color: C.muted, textDecoration: "none" }}>watchfor.tools</a>
    <span style={{ color: C.dim }}> / </span>
    {cat ? (
      <>
        <a href="/categories" style={{ color: C.muted, textDecoration: "none" }}>Categories</a>
        <span style={{ color: C.dim }}> / </span>
        <span style={{ color: ink(cat.color) }}>{cat.label}</span>
      </>
    ) : (
      <span style={{ color: C.text }}>Categories</span>
    )}
  </nav>
);

const Shell = ({ children, lastUpdated }) => (
  <main style={{ background: C.bg, color: C.text, minHeight: "100vh" }}>
    <div className="mx-auto" style={{ maxWidth: 900, padding: "0 20px" }}>
      {children}
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

/*
 * One tool in a category listing.
 *
 * `primary` is the difference between "this is what it is" and "it also does
 * this", which is the question somebody scanning a category page is asking. A
 * secondary member says so in muted type and names the category it leads with,
 * so the row explains itself rather than looking like an error.
 */
function Member({ tool, primary }) {
  const col = catOf(tool.cat).color;
  const facts = [
    tool.price,
    tool.free && "free plan",
    tool.suite && `part of ${tool.suite}`,
    tool.linked && `same owner as ${tool.linked}`,
    ownerOf(tool) && `by ${ownerOf(tool)}`,
    tool.shopifyExclusive === false && "not Shopify-only",
  ].filter(Boolean);

  return (
    <li style={{ borderTop: `1px solid ${C.line}`, padding: `${S.lg}px 0` }}>
      <div className="flex items-start" style={{ gap: S.md }}>
        {/* The spine on its side, exactly as the list view draws it. */}
        <span aria-hidden="true" style={{
          width: 3, height: 34, borderRadius: 2, background: col, flexShrink: 0, marginTop: 2,
        }} />
        {tool.logo && (
          <img src={tool.logo} alt={logoAlt(tool)} width={34} height={34}
            style={{
              width: 34, height: 34, borderRadius: R.control, flexShrink: 0,
              background: "#FFFFFF", objectFit: "contain", padding: 3,
            }} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="flex flex-wrap items-baseline" style={{ gap: S.sm }}>
            <a href={`/tools/${tool.id}`} style={{
              fontSize: F.lg, fontWeight: 700, color: C.text, textDecoration: "none",
              letterSpacing: TRACK.tight,
            }}>{tool.name}</a>
            {tool.dying && <Pill tone="warn">winding down</Pill>}
          </div>

          {/*
            * Which kind of member this is, said plainly. A secondary row names
            * its primary category and links to it, because "why is Marmeto on
            * the billing page" is answered by "because it is a suite" and that
            * answer is one click away rather than absent.
            */}
          <p style={{ fontSize: F.xs, margin: `2px 0 0`, color: C.dim }}>
            {primary ? (
              <span style={{ color: ink(col) }}>{catOf(tool.cat).label}</span>
            ) : (
              <>
                <span>also in this category. Listed under </span>
                <a href={`/categories/${tool.cat}`}
                  style={{ color: ink(col), textDecoration: "none" }}>{catOf(tool.cat).label}</a>
              </>
            )}
          </p>

          <p style={{ fontSize: F.md, color: C.text, lineHeight: 1.5, margin: `${S.sm}px 0 0` }}>
            {tool.one}
          </p>

          <p className="flex flex-wrap items-baseline tnum" style={{
            gap: S.sm, fontSize: F.xs, color: C.muted, margin: `${S.sm}px 0 0`,
          }}>
            {facts.map((f, i) => (
              <React.Fragment key={f}>
                {i > 0 && <span aria-hidden="true" style={{
                  width: 1, height: 9, background: C.edge, display: "inline-block", opacity: 0.7,
                }} />}
                <span>{f}</span>
              </React.Fragment>
            ))}
          </p>
        </div>

        <a href={outbound(tool.url)} target="_blank" rel="noopener noreferrer"
          style={{
            flexShrink: 0, background: C.text, color: C.bg, borderRadius: R.control,
            padding: "5px 12px", fontSize: F.xs, fontWeight: 700, textDecoration: "none",
            whiteSpace: "nowrap",
          }}>Visit site</a>
      </div>
    </li>
  );
}

export function CategoryPage({ cat, members, related, lastUpdated }) {
  const primaryCount = members.filter((m) => m.primary).length;
  const alsoCount = members.length - primaryCount;

  return (
    <Shell lastUpdated={lastUpdated}>
      <Crumbs cat={cat} />

      <header style={{ marginTop: S.xl }}>
        {/* 4px, the detail view's weight rather than a card's. This page is the
            subject of the category, not one of the things in it. */}
        <div style={{ height: 4, background: cat.color, borderRadius: 2, width: 64 }} />
        <h1 style={{
          fontSize: F.display, fontWeight: 800, margin: `${S.md}px 0 0`, letterSpacing: TRACK.tighter,
        }}>{cat.label}</h1>
        <p style={{ fontSize: F.lg, color: C.muted, lineHeight: 1.55, margin: `${S.sm}px 0 0`, maxWidth: "62ch" }}>
          {cat.blurb}
        </p>
        {/* Rule E: a count of zero renders no sentence about the count. */}
        {members.length > 0 && (
          <p className="tnum" style={{ fontSize: F.sm, color: C.dim, margin: `${S.md}px 0 0` }}>
            {primaryCount} listed here
            {alsoCount > 0 && `, and ${alsoCount} more that also belong in it`}.
          </p>
        )}
      </header>

      {members.length > 0 ? (
        <ul style={{ listStyle: "none", padding: 0, margin: `${S.xl}px 0 0` }}>
          {members.map(({ tool, primary }) => (
            <Member key={tool.id} tool={tool} primary={primary} />
          ))}
        </ul>
      ) : (
        <p style={{ fontSize: F.md, color: C.muted, lineHeight: 1.6, margin: `${S.xl}px 0 0`, maxWidth: "62ch" }}>
          Nothing is listed in this category yet.{" "}
          <a href="/" style={{ color: C.text }}>Suggest something for it</a>.
        </p>
      )}

      {/*
        * Every category page links to other category pages, for the reason
        * every tool page links to other tools: a page nothing points at is
        * found once from the sitemap and quietly dropped.
        */}
      {related.length > 0 && (
        <section style={{ marginTop: S["3xl"] }}>
          <h2 style={{ fontSize: F.xl, fontWeight: 700, margin: 0, letterSpacing: TRACK.tight }}>
            Related categories
          </h2>
          <ul style={{ listStyle: "none", padding: 0, margin: `${S.md}px 0 0` }}>
            {related.map(({ cat: c, why }) => (
              <li key={c.id} style={{ borderTop: `1px solid ${C.line}`, padding: `${S.md}px 0` }}>
                <a href={`/categories/${c.id}`} style={{
                  fontSize: F.md, fontWeight: 700, color: ink(c.color), textDecoration: "none",
                }}>{c.label}</a>
                <span style={{ fontSize: F.xs, color: C.dim, marginLeft: S.sm }}>{why}</span>
                <p style={{ fontSize: F.sm, color: C.muted, margin: `${S.xs}px 0 0`, lineHeight: 1.5 }}>
                  {c.blurb}
                </p>
              </li>
            ))}
          </ul>
          <p style={{ fontSize: F.sm, margin: `${S.lg}px 0 0` }}>
            <a href="/categories" style={{ color: C.muted }}>All categories</a>
          </p>
        </section>
      )}
    </Shell>
  );
}

export function CategoryIndex({ counts, lastUpdated }) {
  return (
    <Shell lastUpdated={lastUpdated}>
      <Crumbs cat={null} />

      <header style={{ marginTop: S.xl }}>
        <h1 style={{
          fontSize: F.display, fontWeight: 800, margin: 0, letterSpacing: TRACK.tighter,
        }}>Categories</h1>
        <p style={{ fontSize: F.lg, color: C.muted, lineHeight: 1.55, margin: `${S.sm}px 0 0`, maxWidth: "62ch" }}>
          Every kind of tool built for the people who build Shopify apps. A tool leads with one
          category and can belong in others, so these counts add up to more than the directory.
        </p>
      </header>

      <ul style={{ listStyle: "none", padding: 0, margin: `${S.xl}px 0 0` }}>
        {counts.map(({ cat, total, primary }) => (
          <li key={cat.id} style={{ borderTop: `1px solid ${C.line}`, padding: `${S.lg}px 0` }}>
            <div className="flex items-start" style={{ gap: S.md }}>
              <span aria-hidden="true" style={{
                width: 3, height: 30, borderRadius: 2, background: cat.color, flexShrink: 0, marginTop: 2,
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="flex flex-wrap items-baseline" style={{ gap: S.sm }}>
                  <a href={`/categories/${cat.id}`} style={{
                    fontSize: F.lg, fontWeight: 700, color: ink(cat.color), textDecoration: "none",
                    letterSpacing: TRACK.tight,
                  }}>{cat.label}</a>
                  {total > 0 && (
                    <span className="tnum" style={{ fontSize: F.xs, color: C.dim }}>
                      {total} tool{total === 1 ? "" : "s"}
                      {total !== primary && `, ${primary} listed here`}
                    </span>
                  )}
                </div>
                <p style={{ fontSize: F.md, color: C.muted, lineHeight: 1.5, margin: `${S.xs}px 0 0`, maxWidth: "68ch" }}>
                  {cat.blurb}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <p style={{ fontSize: F.sm, margin: `${S.xl}px 0 0` }}>
        <a href="/" style={{ color: C.muted }}>Back to the directory</a>
      </p>
    </Shell>
  );
}
