import React from "react";
import { C, S, R, F } from "@/lib/tools";
import { chartTable, chartDay } from "@/lib/blog";

/*
 * A chart in a blog post, drawn from the numbers in the post. Server-rendered
 * with no client state, like the rest of the post.
 *
 * Bars are HTML, not an SVG image, so their labels are real text at the
 * page's own size on a phone and on a wide screen alike, and they follow the
 * theme through the tokens. The step chart is the one SVG: a line with no
 * text in it, with its labels set in HTML around it.
 *
 * Colour is neutral ink at three steps (C.chart1..3). Cobalt is the action and
 * the category hues mean a category (invariants A and C), so a series is told
 * apart by its step, a direct label and the table under every chart, never by
 * colour alone. Each mark carries a `title`, which is the hover tooltip.
 *
 * Every chart ends with "Show the numbers": the same table RSS and the plain
 * text carry (chartTable in lib/blog.js).
 */

const STEPS = [C.chart1, C.chart2, C.chart3];
const BAR = 14;

const Title = ({ c }) => (
  <figcaption style={{ margin: 0 }}>
    <span style={{ display: "block", fontSize: F.md, fontWeight: 700, color: C.text }}>{c.title}</span>
    {c.caption && <span style={{ display: "block", fontSize: F.sm, color: C.muted, marginTop: S.xs, lineHeight: 1.5 }}>{c.caption}</span>}
  </figcaption>
);

function Numbers({ c }) {
  const t = chartTable(c);
  return (
    <details style={{ marginTop: S.md, fontSize: F.sm }}>
      <summary style={{ cursor: "pointer", color: C.muted }}>Show the numbers</summary>
      <div style={{ overflowX: "auto", marginTop: S.sm }}>
        <table className="tnum" style={{ borderCollapse: "collapse", fontSize: F.sm }}>
          <thead><tr>{t.head.map((h, i) => (
            <th key={i} scope="col" style={{ textAlign: i ? "right" : "left", padding: `${S.xs}px ${S.md}px ${S.xs}px 0`, color: C.muted, fontWeight: 600 }}>{h}</th>
          ))}</tr></thead>
          <tbody>{t.rows.map((r, i) => (
            <tr key={i}>{r.map((v, j) => {
              const Cell = j ? "td" : "th";
              return <Cell key={j} {...(j ? {} : { scope: "row" })} style={{ textAlign: j ? "right" : "left", padding: `${S.xs}px ${S.md}px ${S.xs}px 0`, fontWeight: 400, color: C.text, borderTop: `1px solid ${C.line}` }}>{v}</Cell>;
            })}</tr>
          ))}</tbody>
        </table>
      </div>
    </details>
  );
}

/* One label column, one bar track. The track is the full width so bars of
   different charts on one page share a reading. */
const grid = { display: "grid", gridTemplateColumns: "minmax(110px, 30%) 1fr", columnGap: S.md, alignItems: "center" };

function BarRow({ label, value, max, show, tone = C.chart1, note }) {
  const pct = max ? Math.max(0, (value / max) * 100) : 0;
  return (
    <div className="flex items-center" style={{ gap: S.sm, minHeight: BAR + 6 }} title={`${label}: ${show ?? value}${note ? ` (${note})` : ""}`}>
      {/* Zero is drawn as nothing, with the value still said: an empty bar is the finding. */}
      {pct > 0 && <span aria-hidden="true" style={{ display: "block", height: BAR, width: `calc(${pct}% * 0.82)`, minWidth: 3, background: tone, borderRadius: "0 4px 4px 0" }} />}
      <span className="tnum" style={{ fontSize: F.sm, color: C.text, whiteSpace: "nowrap" }}>
        {show ?? value}{note && <span style={{ color: C.muted }}> {note}</span>}
      </span>
    </div>
  );
}

function Bars({ c }) {
  const max = Math.max(...c.bars.map((b) => b.value));
  return (
    <div role="img" aria-label={`${c.title}. ${c.bars.map((b) => `${b.label}: ${b.show ?? b.value}`).join(", ")}.`} style={{ marginTop: S.md }}>
      {c.bars.map((b) => (
        <div key={b.label} style={{ ...grid, padding: `${S.xs}px 0` }}>
          <span style={{ fontSize: F.sm, color: C.text, lineHeight: 1.35 }}>{b.label}</span>
          <BarRow label={b.label} value={b.value} max={max} show={b.show} />
        </div>
      ))}
    </div>
  );
}

function Groups({ c }) {
  const max = Math.max(...c.rows.flatMap((r) => r.values));
  return (
    <div role="img" aria-label={`${c.title}. ${c.rows.map((r) => `${r.label}: ${r.values.map((v, i) => `${c.series[i]} ${r.show?.[i] ?? v}`).join(", ")}`).join(". ")}.`} style={{ marginTop: S.md }}>
      <ul className="flex flex-wrap" style={{ listStyle: "none", padding: 0, margin: `0 0 ${S.sm}px`, gap: `${S.xs}px ${S.lg}px` }}>
        {c.series.map((s, i) => (
          <li key={s} className="flex items-center" style={{ gap: S.xs, fontSize: F.sm, color: C.text }}>
            <span aria-hidden="true" style={{ width: 12, height: 12, borderRadius: 3, background: STEPS[i] }} />{s}
          </li>
        ))}
      </ul>
      {c.rows.map((r, ri) => (
        <div key={r.label} style={{ ...grid, padding: `${S.sm}px 0`, borderTop: `1px solid ${C.line}` }}>
          <span style={{ fontSize: F.sm, color: C.text, fontWeight: 600 }}>{r.label}</span>
          <div style={{ display: "grid", rowGap: 2 }}>
            {r.values.map((v, i) => (
              /* The series name is written beside the first row's bars, so the
                 legend is never the only way to tell them apart. */
              <BarRow key={i} label={`${r.label}, ${c.series[i]}`} value={v} max={max} show={r.show?.[i]} tone={STEPS[i]}
                note={ri === 0 ? c.series[i] : ""} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const dayNum = (d) => Date.parse(`${d}T00:00:00Z`) / 864e5;

function Steps({ c }) {
  const pts = c.points;
  const x0 = dayNum(pts[0].x), x1 = dayNum(pts.at(-1).x);
  const yMax = c.yMax || Math.ceil(Math.max(...pts.map((p) => p.y)) / 20) * 20;
  const X = (d) => ((dayNum(d) - x0) / (x1 - x0 || 1)) * 100;
  const Y = (v) => 100 - (v / yMax) * 100;
  /* A running count holds its value until the next day it moved. */
  const path = pts.map((p, i) => (i ? `L${X(p.x)},${Y(pts[i - 1].y)} L${X(p.x)},${Y(p.y)}` : `M${X(p.x)},${Y(p.y)}`)).join(" ");
  const ticks = [0, yMax / 2, yMax];
  const first = pts[0], last = pts.at(-1);
  return (
    <div role="img" aria-label={`${c.title}. From ${first.y} on ${chartDay(first.x)} to ${last.y} on ${chartDay(last.x)}.`}
      style={{ marginTop: S.lg, display: "grid", gridTemplateColumns: "auto 1fr", columnGap: S.sm }}>
      <div className="tnum" style={{ position: "relative", fontSize: F.xs, color: C.muted, width: 24 }}>
        {ticks.map((t) => <span key={t} style={{ position: "absolute", right: 0, top: `${Y(t)}%`, transform: "translateY(-50%)" }}>{t}</span>)}
      </div>
      <div style={{ position: "relative", height: 220 }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="100%" aria-hidden="true" style={{ display: "block", overflow: "visible" }}>
          {ticks.map((t) => <line key={t} x1="0" x2="100" y1={Y(t)} y2={Y(t)} stroke={C.line} strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
          <path d={path} fill="none" stroke={C.chart1} strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </svg>
        {/* Dots and their tooltips are HTML, so they stay round at any width. */}
        {/* A dot marks a day the count moved; a closing point that only
            extends the line to the end date gets none. */}
        {pts.filter((p, i) => i === 0 || p.y !== pts[i - 1].y).map((p) => (
          <span key={p.x} title={`${chartDay(p.x)}: ${p.y}`} style={{
            position: "absolute", left: `${X(p.x)}%`, top: `${Y(p.y)}%`, width: 8, height: 8, marginLeft: -4, marginTop: -4,
            borderRadius: "50%", background: C.chart1, boxShadow: `0 0 0 2px ${C.panel}`,
          }} />
        ))}
        {[first, last].map((p, i) => (
          <span key={p.x} className="tnum" style={{
            position: "absolute", left: `${X(p.x)}%`, top: `${Y(p.y)}%`, transform: `translate(${i ? "-100%" : "0"}, -150%)`,
            fontSize: F.sm, fontWeight: 700, color: C.text, whiteSpace: "nowrap",
          }}>{p.y}</span>
        ))}
      </div>
      <span />
      <div className="flex justify-between tnum" style={{ fontSize: F.xs, color: C.muted, marginTop: S.xs }}>
        <span>{chartDay(first.x)}</span><span>{chartDay(last.x)}</span>
      </div>
    </div>
  );
}

export default function BlogChart({ c }) {
  return (
    <figure style={{
      margin: `${S.xl}px 0 0`, padding: S.lg, background: C.panel,
      border: `1px solid ${C.line}`, borderRadius: R.card,
    }}>
      <Title c={c} />
      {c.type === "bars" && <Bars c={c} />}
      {c.type === "groups" && <Groups c={c} />}
      {c.type === "steps" && <Steps c={c} />}
      {c.source && <p style={{ fontSize: F.xs, color: C.dim, margin: `${S.md}px 0 0`, maxWidth: "none" }}>{c.source}</p>}
      <Numbers c={c} />
    </figure>
  );
}
