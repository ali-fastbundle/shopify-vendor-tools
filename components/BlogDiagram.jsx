import React from "react";
import { C, S, R, F } from "@/lib/tools";
import { cellsOf } from "@/lib/blog";

/*
 * A diagram in a post: who or what connects to what, as boxes joined by
 * arrows from left to right, one row per subject (2026-11-15). Drawn in HTML,
 * not as an image, so it follows the theme and its words are real text at any
 * width, the same reason charts are (BlogChart.jsx). Neutral throughout: no
 * category colour (invariant A). Server-rendered, no client state.
 *
 * `renderCell` is the page's own inline renderer, passed in so a link in a box
 * is the same link, with the same logo, as one in a paragraph.
 *
 * Below 640px the columns stack and each arrow turns to point down
 * (`.blog-diagram` in globals.css), so nothing scrolls sideways on a phone.
 */
export default function BlogDiagram({ d, renderCell }) {
  return (
    <figure style={{ margin: `${S.xl}px 0 0` }}>
      <figcaption style={{ fontSize: F.md, fontWeight: 700, color: C.text }}>{d.title}</figcaption>
      <div role="table" aria-label={d.title} className="blog-diagram"
        style={{ marginTop: S.sm, border: `1px solid ${C.line}`, borderRadius: R.card, background: C.panel, padding: S.md }}>
        <div role="row" className="blog-diagram-row blog-diagram-head" style={{ gridTemplateColumns: cols(d.columns.length) }}>
          {d.columns.map((h, i) => (
            <React.Fragment key={h}>
              {i > 0 && <span aria-hidden="true" />}
              <span role="columnheader" style={{ fontSize: F.xs, color: C.muted, fontWeight: 600 }}>{h}</span>
            </React.Fragment>
          ))}
        </div>
        {d.rows.map((r, k) => (
          <div role="row" key={k} className="blog-diagram-row" style={{ gridTemplateColumns: cols(d.columns.length), borderTop: `1px solid ${C.line}` }}>
            {r.map((c, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span aria-hidden="true" className="blog-diagram-arrow" style={{ color: C.muted, fontSize: F.lg, textAlign: "center" }}>→</span>}
                <div role="cell" style={{ display: "flex", flexDirection: "column", gap: S.xs }}>
                  {cellsOf(c).map((x, j) => (
                    <span key={j} style={{
                      display: "block", fontSize: F.sm, lineHeight: 1.4, color: C.text, fontWeight: i === 0 ? 700 : 400,
                      background: C.bg, border: `1px solid ${C.line}`, borderRadius: R.control, padding: `${S.xs}px ${S.sm}px`,
                    }}>{renderCell(x)}</span>
                  ))}
                </div>
              </React.Fragment>
            ))}
          </div>
        ))}
      </div>
      {d.caption && <p style={{ fontSize: F.xs, color: C.dim, margin: `${S.xs}px 0 0`, lineHeight: 1.5 }}>{renderCell(d.caption)}</p>}
    </figure>
  );
}

/* Content columns share the width; each arrow column is narrow. */
const cols = (n) => Array.from({ length: n }, (_, i) => (i ? "28px minmax(0, 1fr)" : "minmax(0, 1fr)")).join(" ");
