import React from "react";
import { C, S, R, F, TRACK, formatDay, AUTHOR, AUTHOR_URL } from "@/lib/tools";
import { inline, resolveRef, minutesToRead, UNVERIFIED_LEGEND } from "@/lib/blog";
import { outbound } from "@/lib/outbound";
import SiteNav from "@/components/SiteNav";
import FooterLinks from "@/components/FooterLinks";
import Engagement from "@/components/Engagement";
import { postKey } from "@/lib/comments";

/*
 * The blog index and a post. Server-rendered with no client state, the same
 * contract as ToolPage and Categories: whole in the first response, for a
 * crawler and a reader without JavaScript alike.
 *
 * Neutral type throughout. No category colour (invariant A): a post about one
 * category is not that category's chip.
 *
 * A link to one of our listings is a plain internal anchor. Anything absolute
 * goes through outbound() at the point the href is written (invariant 11).
 */

const MEASURE = "68ch";

function Inline({ text }) {
  return inline(text).map((tk, i) => {
    if (tk.t === "text") return <React.Fragment key={i}>{tk.text}</React.Fragment>;
    if (tk.t === "claim") {
      return (
        <span key={i}>
          {tk.text}
          <sup title="The vendor's own claim, not checked independently"
            aria-label="(vendor's claim, not checked)" style={{ color: C.muted, fontWeight: 700 }}>†</sup>
        </span>
      );
    }
    const href = resolveRef(tk.ref) || "#";
    const external = /^https?:\/\//.test(href);
    return (
      <a key={i} href={external ? outbound(href) : href}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        style={{ color: C.text, textDecoration: "underline", textDecorationColor: C.muted, textUnderlineOffset: 3 }}>{tk.text}</a>
    );
  });
}

function Block({ b }) {
  if (b.h2) return <h2 style={{ fontSize: F.xl, fontWeight: 700, margin: `${S["3xl"]}px 0 0`, letterSpacing: TRACK.tight }}><Inline text={b.h2} /></h2>;
  if (b.h3) return <h3 style={{ fontSize: F.lg, fontWeight: 700, margin: `${S["2xl"]}px 0 0` }}><Inline text={b.h3} /></h3>;
  if (b.p) return <p style={{ fontSize: F.lg, lineHeight: 1.65, margin: `${S.md}px 0 0`, maxWidth: MEASURE }}><Inline text={b.p} /></p>;
  if (b.note) {
    return (
      <p style={{
        fontSize: F.md, lineHeight: 1.6, color: C.muted, margin: `${S.lg}px 0 0`, maxWidth: MEASURE,
        borderLeft: `2px solid ${C.edge}`, paddingLeft: S.md,
      }}><Inline text={b.note} /></p>
    );
  }
  if (b.ul) {
    return (
      <ul style={{ margin: `${S.md}px 0 0`, paddingLeft: S.xl, maxWidth: MEASURE, listStyle: "disc" }}>
        {b.ul.map((item, i) => (
          <li key={i} style={{ fontSize: F.lg, lineHeight: 1.6, marginTop: S.sm }}><Inline text={item} /></li>
        ))}
      </ul>
    );
  }
  if (b.table) {
    /* Its own scroller, so a wide table never scrolls the page at phone width. */
    return (
      <div role="region" aria-label="Comparison table" tabIndex={0}
        style={{ marginTop: S.lg, overflowX: "auto", border: `1px solid ${C.line}`, borderRadius: R.card }}>
        <table className="tnum" style={{ borderCollapse: "collapse", width: "100%", minWidth: 760, fontSize: F.sm }}>
          <thead>
            <tr>{b.table.head.map((h) => (
              <th key={h} scope="col" style={{
                textAlign: "left", padding: `${S.sm}px ${S.md}px`, color: C.muted, fontWeight: 600,
                borderBottom: `1px solid ${C.line}`, background: C.panel, whiteSpace: "nowrap",
              }}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {b.table.rows.map((r, i) => (
              <tr key={i}>
                {r.map((c, j) => {
                  const Cell = j === 0 ? "th" : "td";
                  return (
                    <Cell key={j} {...(j === 0 ? { scope: "row" } : {})} style={{
                      textAlign: "left", verticalAlign: "top", padding: `${S.sm}px ${S.md}px`,
                      borderTop: i ? `1px solid ${C.line}` : 0, fontWeight: j === 0 ? 700 : 400,
                      color: j === 0 ? C.text : C.muted, lineHeight: 1.45,
                    }}><Inline text={c} /></Cell>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return null;
}

const Byline = ({ post }) => (
  <p style={{ fontSize: F.sm, color: C.muted, margin: `${S.sm}px 0 0` }}>
    By{" "}
    {AUTHOR_URL
      ? <a href={outbound(AUTHOR_URL)} target="_blank" rel="noopener noreferrer" style={{ color: C.muted }}>{AUTHOR}</a>
      : AUTHOR}
    {/* AUTHOR ends in a full stop already ("Ali A."), so only add one when it does not. */}
    {AUTHOR.endsWith(".") ? " " : ". "}
    <time dateTime={post.date}>{formatDay(post.date)}</time>
    {post.updated && post.updated !== post.date && <>{". Updated "}<time dateTime={post.updated}>{formatDay(post.updated)}</time></>}
    {". "}{minutesToRead(post)} minute read.
  </p>
);

const Footer = ({ lastUpdated }) => (
  <footer style={{ marginTop: S["4xl"], paddingBottom: S["4xl"], borderTop: `1px solid ${C.line}`, paddingTop: S.lg }}>
    <FooterLinks />
    <p style={{ fontSize: F.xs, color: C.dim, lineHeight: 1.6, maxWidth: "68ch", margin: 0 }}>
      <a href="/" style={{ color: C.muted }}>watchfor.tools</a> is an independent directory for
      Shopify app vendors. Not affiliated with, endorsed by, or sponsored by Shopify.
      No affiliate links and no paid placement. <a href="/blog/rss" style={{ color: C.muted }}>RSS</a>.
      Directory last updated {lastUpdated}.
    </p>
  </footer>
);

export function BlogIndex({ posts, lastUpdated }) {
  return (
    <main style={{ background: C.bg, color: C.text, minHeight: "100vh" }}>
      <div className="mx-auto" style={{ maxWidth: 820, padding: "0 16px" }}>
        <SiteNav current="blog" />
        <header style={{ marginTop: S["3xl"] }}>
          <h1 style={{ fontSize: F.hero, fontWeight: 800, margin: 0, letterSpacing: TRACK.tighter, lineHeight: 1.05 }}>Blog</h1>
          <p style={{ fontSize: F.lg, color: C.muted, lineHeight: 1.55, margin: `${S.md}px 0 0`, maxWidth: "62ch" }}>
            What a listing cannot hold: a whole category side by side, judged on stated criteria,
            by someone who sells none of the tools in it.
          </p>
        </header>
        <ul style={{ listStyle: "none", padding: 0, margin: `${S["2xl"]}px 0 0` }}>
          {posts.map((p) => (
            <li key={p.slug} style={{ borderTop: `1px solid ${C.line}`, padding: `${S.lg}px 0` }}>
              <a href={`/blog/${p.slug}`} style={{ color: C.text, fontWeight: 700, fontSize: F.xl, textDecoration: "none", letterSpacing: TRACK.tight, lineHeight: 1.3 }}>
                {p.title}
              </a>
              <p style={{ fontSize: F.md, color: C.muted, lineHeight: 1.55, margin: `${S.xs}px 0 0`, maxWidth: MEASURE }}>{p.description}</p>
              <p className="tnum" style={{ fontSize: F.xs, color: C.dim, margin: `${S.xs}px 0 0` }}>
                <time dateTime={p.date}>{formatDay(p.date)}</time>. {minutesToRead(p)} minute read.
              </p>
            </li>
          ))}
        </ul>
        <Footer lastUpdated={lastUpdated} />
      </div>
    </main>
  );
}

export function BlogPost({ post, lastUpdated, comments = [] }) {
  return (
    <main style={{ background: C.bg, color: C.text, minHeight: "100vh" }}>
      <div className="mx-auto" style={{ maxWidth: 820, padding: "0 16px" }}>
        <nav aria-label="Breadcrumb" style={{ paddingTop: S["2xl"], fontSize: F.sm }}>
          <a href="/" style={{ color: C.muted, textDecoration: "none" }}>watchfor.tools</a>
          <span style={{ color: C.dim }}> / </span>
          <a href="/blog" style={{ color: C.muted, textDecoration: "none" }}>Blog</a>
        </nav>
        <article>
          <header style={{ marginTop: S["2xl"] }}>
            <h1 style={{ fontSize: F.display, fontWeight: 800, margin: 0, letterSpacing: TRACK.tighter, lineHeight: 1.15, maxWidth: "26ch" }}>
              {post.title}
            </h1>
            <Byline post={post} />
          </header>
          {post.body.map((b, i) => <Block key={i} b={b} />)}
          <p style={{ fontSize: F.xs, color: C.dim, margin: `${S["2xl"]}px 0 0` }}>{UNVERIFIED_LEGEND}</p>
        </article>
        {/* The shared engagement module, as a client island: likes and
            comments. The comments are read on the server and passed in, so
            they are in the first response like a listing's reviews. */}
        <div id="comments">
          <Engagement kind="post" entity={{ id: postKey(post.slug), slug: post.slug, name: post.title }} initialComments={comments} />
        </div>
        <p style={{ marginTop: S["2xl"], fontSize: F.sm }}><a href="/blog" style={{ color: C.muted }}>All posts</a></p>
        <Footer lastUpdated={lastUpdated} />
      </div>
    </main>
  );
}
