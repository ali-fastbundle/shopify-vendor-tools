import React from "react";
import { C, S, R, F, TRACK } from "@/lib/tools";

/*
 * "Compared side by side": the blog posts that cover this category or this
 * tool, on the pages a reader actually lands on. Server-rendered, no state,
 * so it sits in ToolPage and CategoryPage without changing their contract.
 * Rule E: no posts, nothing rendered.
 */
export default function PostLinks({ posts = [], context }) {
  if (!posts.length) return null;
  return (
    <aside aria-label="Compared side by side" style={{
      marginTop: S.xl, border: `1px solid ${C.line}`, borderRadius: R.card, padding: S.lg, background: C.panel,
    }}>
      <p style={{ fontSize: F.xs, color: C.dim, fontWeight: 600, margin: 0 }}>
        {context === "tool" ? "Compared side by side with its alternatives" : "Compared side by side"}
      </p>
      {posts.map((p) => (
        <div key={p.slug} style={{ marginTop: S.sm }}>
          <a href={`/blog/${p.slug}`} style={{
            color: C.text, fontWeight: 700, fontSize: F.md, letterSpacing: TRACK.tight,
            textDecoration: "underline", textUnderlineOffset: 3, textDecorationColor: C.edge,
          }}>{p.title}</a>
          <p style={{ fontSize: F.sm, color: C.muted, lineHeight: 1.5, margin: `${S.xs}px 0 0`, maxWidth: "62ch" }}>
            {p.description}
          </p>
        </div>
      ))}
    </aside>
  );
}
