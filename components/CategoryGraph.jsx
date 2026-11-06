"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { forceSimulation, forceLink, forceManyBody, forceCollide, forceX, forceY } from "d3-force";
import { C, S, R, F, ink } from "@/lib/tools";

/*
 * How the categories overlap (2026-11-06, /categories). Secondary to the list
 * above it, which is the content and renders on the server: this is a client
 * island, so a crawler or a reader without JavaScript loses nothing.
 *
 * Nodes are the categories, in their colours, and the tools, neutral. A solid
 * line runs to a tool's primary category and a dashed one to each category it
 * also serves (alsoIn), so the tools that bridge two shelves are the ones
 * holding the picture together, and they are labelled. "Show named rivals"
 * adds the competes links, drawn over the layout without moving it.
 *
 * Category colour on the category nodes is the legend use of the palette,
 * like the wordmark (CLAUDE.md, colour invariant A, recorded as an exception).
 *
 * d3-force 3.0.0 is bundled from npm and served from this site: a script from
 * a CDN would be a third-party request, which needs consent here (Privacy).
 * With prefers-reduced-motion the layout is computed first and drawn settled;
 * otherwise it settles once on load and never moves again on its own.
 *
 * Keyboard: every node is a link in the tab order with a visible ring; focus
 * highlights its links like hover does; Enter opens its page. Zoom and pan
 * by wheel and drag, or the buttons. Hidden below 900px (globals.css).
 */
const W = 1100, H = 660;

export default function CategoryGraph({ cats = [], tools = [] }) {
  const [pos, setPos] = useState(null);
  const [active, setActive] = useState("");
  const [rivals, setRivals] = useState(false);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const [query, setQuery] = useState("");
  const drag = useRef(null);
  const svgRef = useRef(null);

  const catById = useMemo(() => Object.fromEntries(cats.map((c) => [c.id, c])), [cats]);
  const nodes0 = useMemo(() => [
    ...cats.map((c) => ({ id: `c:${c.id}`, kind: "cat", label: c.label, color: c.color, href: `/categories/${c.id}`, r: 22 })),
    ...tools.map((t) => ({ id: `t:${t.id}`, kind: "tool", label: t.name, href: `/tools/${t.id}`, r: t.also.length ? 7 : 5, bridge: t.also.length > 0, cat: t.cat })),
  ], [cats, tools]);
  const links = useMemo(() => [
    ...tools.map((t) => ({ source: `t:${t.id}`, target: `c:${t.cat}`, kind: "primary" })),
    ...tools.flatMap((t) => t.also.map((c) => ({ source: `t:${t.id}`, target: `c:${c}`, kind: "also" }))),
  ].filter((l) => catById[l.target.slice(2)]), [tools, catById]);
  const rivalLinks = useMemo(() => {
    const ids = new Set(tools.map((t) => t.id)); const seen = new Set(); const out = [];
    for (const t of tools) for (const r of t.competes || []) {
      if (!ids.has(r)) continue;
      const k = [t.id, r].sort().join("|");
      if (!seen.has(k)) { seen.add(k); out.push({ source: `t:${t.id}`, target: `t:${r}`, kind: "rival" }); }
    }
    return out;
  }, [tools]);

  /* The layout: settle once. Reduced motion computes it all before drawing. */
  useEffect(() => {
    const nodes = nodes0.map((n, i) => {
      const a = (2 * Math.PI * i) / Math.max(1, nodes0.length);
      return { ...n, x: W / 2 + Math.cos(a) * 200, y: H / 2 + Math.sin(a) * 200 };
    });
    const ls = links.map((l) => ({ ...l }));
    const sim = forceSimulation(nodes)
      .force("link", forceLink(ls).id((d) => d.id).distance((l) => (l.kind === "primary" ? 55 : 130)).strength((l) => (l.kind === "primary" ? 0.8 : 0.15)))
      .force("charge", forceManyBody().strength((d) => (d.kind === "cat" ? -900 : -45)))
      /* A bridging tool is labelled, so it gets room for its name. */
      .force("collide", forceCollide((d) => d.r + (d.kind === "cat" ? 22 : d.bridge ? 24 : 4)).strength(0.9))
      .force("x", forceX(W / 2).strength(0.07))
      .force("y", forceY(H / 2).strength(0.11))
      /* Everything stays inside the frame, with room for a label below. */
      .force("bounds", () => { for (const n of nodes) { n.x = Math.max(40, Math.min(W - 40, n.x)); n.y = Math.max(30, Math.min(H - 44, n.y)); } });
    const snap = () => setPos(Object.fromEntries(nodes.map((n) => [n.id, { x: n.x, y: n.y }])));
    let reduce = false;
    try { reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { /* default to motion */ }
    if (reduce) { sim.stop(); for (let i = 0; i < 400; i++) sim.tick(); snap(); return () => sim.stop(); }
    let raf = 0;
    sim.on("tick", () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; snap(); }); });
    sim.on("end", snap);
    return () => { sim.stop(); cancelAnimationFrame(raf); };
  }, [nodes0, links]);

  const shown = rivals ? [...links, ...rivalLinks] : links;
  const near = useMemo(() => {
    if (!active) return null;
    const s = new Set([active]);
    for (const l of shown) { if (l.source === active) s.add(l.target); if (l.target === active) s.add(l.source); }
    return s;
  }, [active, shown]);

  const findNode = (q) => {
    const t = q.trim().toLowerCase();
    if (!t) return null;
    return nodes0.find((n) => n.label.toLowerCase() === t) || nodes0.find((n) => n.label.toLowerCase().includes(t)) || null;
  };
  const focusOn = (n) => {
    if (!n || !pos?.[n.id]) return;
    setActive(n.id);
    const k = Math.max(view.k, 1.4);
    setView({ k, x: W / 2 - pos[n.id].x * k, y: H / 2 - pos[n.id].y * k });
  };

  const onWheel = (e) => {
    e.preventDefault();
    const rect = svgRef.current.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W, py = ((e.clientY - rect.top) / rect.height) * H;
    setView((v) => {
      const k = Math.min(3, Math.max(0.5, v.k * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
      return { k, x: px - ((px - v.x) / v.k) * k, y: py - ((py - v.y) / v.k) * k };
    });
  };
  useEffect(() => {
    const el = svgRef.current; if (!el) return;
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });
  const onDown = (e) => { if (e.target.closest("a")) return; drag.current = { x: e.clientX, y: e.clientY, v: view }; };
  const onMove = (e) => {
    if (!drag.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const dx = ((e.clientX - drag.current.x) / rect.width) * W, dy = ((e.clientY - drag.current.y) / rect.height) * H;
    setView({ ...drag.current.v, x: drag.current.v.x + dx, y: drag.current.v.y + dy });
  };
  const zoom = (f) => setView((v) => { const k = Math.min(3, Math.max(0.5, v.k * f)); return { k, x: W / 2 - ((W / 2 - v.x) / v.k) * k, y: H / 2 - ((H / 2 - v.y) / v.k) * k }; });

  const dim = (id) => (near && !near.has(id) ? 0.12 : 1);
  const btn = { fontFamily: "inherit", fontSize: F.sm, color: C.text, background: C.panel, border: `1px solid ${C.line}`, borderRadius: R.control, padding: "4px 10px", cursor: "pointer" };

  return (
    <div>
      <div className="flex flex-wrap items-center" style={{ gap: S.sm, marginTop: S.md }}>
        <form onSubmit={(e) => { e.preventDefault(); focusOn(findNode(query)); }} className="flex items-center" style={{ gap: S.xs }}>
          <label htmlFor="cg-search" style={{ fontSize: F.sm, color: C.muted }}>Find</label>
          <input id="cg-search" list="cg-names" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="A tool or a category"
            style={{ fontFamily: "inherit", fontSize: F.sm, color: C.text, background: C.field, border: `1px solid ${C.line}`, borderRadius: R.control, padding: "4px 8px", width: 220 }} />
          <datalist id="cg-names">{nodes0.map((n) => <option key={n.id} value={n.label} />)}</datalist>
          <button type="submit" style={btn}>Show</button>
        </form>
        <label className="flex items-center" style={{ gap: S.xs, fontSize: F.sm, color: C.muted }}>
          <input type="checkbox" checked={rivals} onChange={(e) => setRivals(e.target.checked)} /> Show named rivals ({rivalLinks.length})
        </label>
        <span style={{ marginLeft: "auto" }} className="flex" >
          <button type="button" style={btn} onClick={() => zoom(1.25)} aria-label="Zoom in">+</button>
          <button type="button" style={{ ...btn, marginLeft: 4 }} onClick={() => zoom(0.8)} aria-label="Zoom out">−</button>
          <button type="button" style={{ ...btn, marginLeft: 4 }} onClick={() => { setView({ x: 0, y: 0, k: 1 }); setActive(""); }}>Reset</button>
        </span>
      </div>

      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width="100%" role="group" aria-label="Tools and the categories they serve. Each node is a link."
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={() => (drag.current = null)} onPointerLeave={() => (drag.current = null)}
        style={{ display: "block", marginTop: S.sm, background: C.panel, border: `1px solid ${C.line}`, borderRadius: R.card, cursor: drag.current ? "grabbing" : "grab", touchAction: "none" }}>
        {!pos && <text x={W / 2} y={H / 2} textAnchor="middle" fill={C.muted} fontSize={14}>Laying out</text>}
        {pos && (
          <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
            {shown.map((l, i) => {
              const a = pos[l.source], b = pos[l.target];
              if (!a || !b) return null;
              const on = near && near.has(l.source) && near.has(l.target) && (l.source === active || l.target === active);
              return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={on ? C.text : C.edge} strokeWidth={(on ? 1.6 : l.kind === "rival" ? 0.8 : 1) / view.k}
                strokeDasharray={l.kind === "also" ? "5 4" : l.kind === "rival" ? "2 4" : undefined}
                opacity={near ? (on ? 1 : 0.08) : l.kind === "rival" ? 0.6 : 0.9} />;
            })}
            {nodes0.map((n) => {
              const p = pos[n.id]; if (!p) return null;
              const isCat = n.kind === "cat";
              const label = isCat || n.bridge || (near && near.has(n.id)) || view.k >= 1.8;
              return (
                <a key={n.id} href={n.href} className="cg-node" aria-label={`${n.label}${isCat ? ", category" : n.bridge ? ", in more than one category" : ""}`}
                  onMouseEnter={() => setActive(n.id)} onMouseLeave={() => setActive("")} onFocus={() => setActive(n.id)} onBlur={() => setActive("")}
                  style={{ opacity: dim(n.id) }}>
                  <circle cx={p.x} cy={p.y} r={n.r}
                    fill={isCat ? n.color : n.bridge ? C.text : C.panel}
                    stroke={isCat ? C.text : C.muted} strokeWidth={(isCat ? 1 : 1.2) / view.k} />
                  {label && (
                    <text x={p.x} y={p.y + (isCat ? n.r + 15 : n.r + 11)} textAnchor="middle"
                      fontSize={(isCat ? 13 : 10.5) / Math.sqrt(view.k)} fontWeight={isCat ? 700 : 400}
                      fill={isCat ? ink(n.color) : C.text} style={{ pointerEvents: "none", paintOrder: "stroke", stroke: C.panel, strokeWidth: 3 / view.k }}>
                      {n.label}
                    </text>
                  )}
                </a>
              );
            })}
          </g>
        )}
      </svg>
      <p style={{ fontSize: F.xs, color: C.dim, margin: `${S.xs}px 0 0` }}>
        Coloured circles are categories. Dark dots are tools filed in more than one; hollow dots are in one. A solid line runs to a tool&apos;s main category, a dashed one to each other category it serves{rivals ? ", and a dotted one between tools that name each other as rivals" : ""}. Click or press Enter on any node to open its page. Scroll or use the buttons to zoom, drag to move.
      </p>
    </div>
  );
}
