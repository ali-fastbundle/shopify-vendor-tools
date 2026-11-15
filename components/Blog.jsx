import React from "react";
import { C, S, R, F, TRACK, formatDay, AUTHOR } from "@/lib/tools";
import { inline, resolveRef, minutesToRead, UNVERIFIED_LEGEND, listingsIn } from "@/lib/blog";
import { outbound } from "@/lib/outbound";
import Engagement from "@/components/Engagement";
import { postKey } from "@/lib/comments";
import BlogChart from "@/components/BlogChart";
import BlogDiagram from "@/components/BlogDiagram";
import ToolScreen from "@/components/ToolScreen";
import { TOOLS } from "@/lib/tools";

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

/* Full column width, on Ali's call (2026-11-06): a post's lines run the width
   of the content column rather than stopping at a reading measure. "none" and
   not absent, because globals.css stops an unclassed paragraph at 62ch. */
const MEASURE = "none";

/*
 * A listing's mark, server-rendered: the logo we host, else its initials on a
 * tile. Not the favicon service: with no onError to fall back on (this file
 * has no client state), a blank or globe favicon would stay blank, and it did
 * for Orbit, Elevate and SaaSOri (2026-11-15).
 */
function Mark({ l, size = 20 }) {
  if (l.logo) {
    return (
      <img src={l.logo} alt="" aria-hidden="true" width={size} height={size} loading="lazy" decoding="async"
        style={{ width: size, height: size, borderRadius: 4, background: C.logoTile, objectFit: "contain", padding: 2, flexShrink: 0 }} />
    );
  }
  const initials = String(l.name || "?").replace(/[^A-Za-z0-9 ]/g, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
  return (
    <span aria-hidden="true" style={{
      width: size, height: size, borderRadius: 4, background: C.subtle, color: C.muted, flexShrink: 0,
      display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: Math.round(size * 0.45), fontWeight: 700,
    }}>{initials}</span>
  );
}

/* The listings a post links, with their marks, under the byline: who the post
   is about, before a word of it is read (2026-11-15). */
function InThisPost({ post }) {
  const ls = listingsIn(post);
  if (!ls.length) return null;
  return (
    <div style={{ margin: `${S.lg}px 0 0` }}>
      <p style={{ fontSize: F.sm, color: C.muted, margin: 0 }}>Listings in this post</p>
      <ul style={{ listStyle: "none", padding: 0, margin: `${S.xs}px 0 0`, display: "flex", flexWrap: "wrap", gap: S.sm }}>
        {ls.map((l) => (
          <li key={l.ref}>
            <a href={l.href} className="ctl" style={{
              display: "inline-flex", alignItems: "center", gap: S.sm, fontSize: F.sm, color: C.text, textDecoration: "none",
              background: C.panel, border: `1px solid ${C.line}`, borderRadius: R.control, padding: `${S.xs}px ${S.sm}px`,
            }}><Mark l={l} size={18} />{l.name}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Inline({ text, seen }) {
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
    /* The first mention of a listed tool carries its mark. */
    let mark = null;
    if (seen && tk.ref.startsWith("tool:") && !seen.has(tk.ref)) {
      seen.add(tk.ref);
      const t = TOOLS.find((x) => x.id === tk.ref.slice(5));
      if (t) mark = <Mark l={{ logo: t.logo, name: t.name }} size={18} />;
    }
    if (mark) {
      return (
        <a key={i} href={href} style={{ color: C.text, textDecoration: "underline", textDecorationColor: C.muted, textUnderlineOffset: 3, whiteSpace: "nowrap" }}>
          <span style={{ display: "inline-block", verticalAlign: "-3px", marginRight: 4 }}>{mark}</span>{tk.text}
        </a>
      );
    }
    return (
      <a key={i} href={external ? outbound(href) : href}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        style={{ color: C.text, textDecoration: "underline", textDecorationColor: C.muted, textUnderlineOffset: 3 }}>{tk.text}</a>
    );
  });
}

function Block({ b, seen }) {
  if (b.h2) return <h2 style={{ fontSize: F.xl, fontWeight: 700, margin: `${S["3xl"]}px 0 0`, letterSpacing: TRACK.tight }}><Inline seen={seen} text={b.h2} /></h2>;
  if (b.h3) return <h3 style={{ fontSize: F.lg, fontWeight: 700, margin: `${S["2xl"]}px 0 0` }}><Inline seen={seen} text={b.h3} /></h3>;
  if (b.p) return <p style={{ fontSize: F.lg, lineHeight: 1.65, margin: `${S.md}px 0 0`, maxWidth: MEASURE }}><Inline seen={seen} text={b.p} /></p>;
  if (b.note) {
    return (
      <p style={{
        fontSize: F.md, lineHeight: 1.6, color: C.muted, margin: `${S.lg}px 0 0`, maxWidth: MEASURE,
        borderLeft: `2px solid ${C.edge}`, paddingLeft: S.md,
      }}><Inline seen={seen} text={b.note} /></p>
    );
  }
  if (b.chart) return <BlogChart c={b.chart} />;
  if (b.diagram) return <BlogDiagram d={b.diagram} renderCell={(x) => <Inline seen={seen} text={x} />} />;
  if (b.screen) {
    const t = TOOLS.find((x) => x.id === b.screen);
    if (!t) return null;
    return (
      <div>
        <ToolScreen tool={t} />
        {b.caption && <p style={{ fontSize: F.sm, color: C.muted, margin: `${S.xs}px 0 0`, lineHeight: 1.5 }}><Inline seen={seen} text={b.caption} /></p>}
      </div>
    );
  }
  if (b.img) {
    /* A chart: its own description is the alt text, and it scales down to the
       column without ever being wider than it was drawn. */
    return (
      <figure style={{ margin: `${S.xl}px 0 0`, maxWidth: b.img.width }}>
        <img src={b.img.src} alt={b.img.alt} width={b.img.width} height={b.img.height} loading="lazy"
          style={{ width: "100%", height: "auto", display: "block", borderRadius: R.card, border: `1px solid ${C.line}` }} />
      </figure>
    );
  }
  if (b.ul) {
    return (
      <ul style={{ margin: `${S.md}px 0 0`, paddingLeft: S.xl, maxWidth: MEASURE, listStyle: "disc" }}>
        {b.ul.map((item, i) => (
          <li key={i} style={{ fontSize: F.lg, lineHeight: 1.6, marginTop: S.sm }}><Inline seen={seen} text={item} /></li>
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
                    }}><Inline seen={seen} text={c} /></Cell>
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
    <a href="/about" rel="author" style={{ color: C.muted }}>{AUTHOR}</a>
    {/* AUTHOR ends in a full stop already ("Ali A."), so only add one when it does not. */}
    {AUTHOR.endsWith(".") ? " " : ". "}
    <time dateTime={post.date}>{formatDay(post.date)}</time>
    {post.updated && post.updated !== post.date && <>{". Updated "}<time dateTime={post.updated}>{formatDay(post.updated)}</time></>}
    {". "}{minutesToRead(post)} minute read.
  </p>
);

const Footer = ({ lastUpdated }) => (
<p style={{ fontSize: F.xs, color: C.dim, lineHeight: 1.6, maxWidth: MEASURE, margin: `${S["3xl"]}px 0 0` }}>
  <a href="/blog/rss" style={{ color: C.muted }}>RSS</a> for every post, in full.
</p>
);

export function BlogIndex({ posts, lastUpdated }) {
  return (
    <main style={{ background: C.bg, color: C.text, }}>
      <div className="mx-auto" style={{ padding: "0 16px" }}>
        <header style={{ marginTop: S["3xl"] }}>
          <h1 style={{ fontSize: F.hero, fontWeight: 600, margin: 0, letterSpacing: TRACK.tighter, lineHeight: 1.05 }}>Blog</h1>
          <p style={{ fontSize: F.lg, color: C.muted, lineHeight: 1.55, margin: `${S.md}px 0 0`, maxWidth: MEASURE }}>
            What a listing cannot hold: a whole category side by side, judged on stated criteria,
            by someone who sells none of the tools in it.
          </p>
        </header>
        <ul style={{ listStyle: "none", padding: 0, margin: `${S["2xl"]}px 0 0` }}>
          {posts.map((p) => (
            <li key={p.slug} style={{ borderTop: `1px solid ${C.line}`, padding: `${S.lg}px 0` }}>
              <h2 style={{ margin: 0, fontSize: "inherit", fontWeight: "inherit", display: "inline" }}><a href={`/blog/${p.slug}`} style={{ color: C.text, fontWeight: 700, fontSize: F.xl, textDecoration: "none", letterSpacing: TRACK.tight, lineHeight: 1.3 }}>
                {p.title}
              </a></h2>
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
    <main style={{ background: C.bg, color: C.text, }}>
      <div className="mx-auto" style={{ padding: "0 16px" }}>
        <nav aria-label="Breadcrumb" style={{ paddingTop: S["2xl"], fontSize: F.sm }}>
          <a href="/" style={{ color: C.muted, textDecoration: "none" }}>watchfor.tools</a>
          <span style={{ color: C.dim }}> / </span>
          <a href="/blog" style={{ color: C.muted, textDecoration: "none" }}>Blog</a>
        </nav>
        <article>
          <header style={{ marginTop: S["2xl"] }}>
            <h1 style={{ fontSize: F.display, fontWeight: 600, margin: 0, letterSpacing: TRACK.tighter, lineHeight: 1.15, maxWidth: "none" }}>
              {post.title}
            </h1>
            <Byline post={post} />
            <InThisPost post={post} />
          </header>
          {(() => { const seen = new Set(); return post.body.map((b, i) => <Block key={i} b={b} seen={seen} />); })()}
          <p style={{ fontSize: F.xs, color: C.dim, margin: `${S["2xl"]}px 0 0`, maxWidth: MEASURE }}>{UNVERIFIED_LEGEND}</p>
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
