"use client";

import { useEffect, useState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { C, S, R, F } from "@/lib/tools";
import { matchesQuery } from "@/lib/search";

/*
 * Search for the index pages that are server components: newsletters and
 * events. Those pages are whole in the first response for a crawler that
 * never runs our JavaScript, so this does not re-render the list. It filters
 * what the server already sent, by toggling `hidden`:
 *
 *   [data-search]        a row, carrying its searchable text (lib/search.js)
 *   [data-search-group]  a section of rows, hidden when none of them match
 *
 * inside the element whose id is `scope`.
 *
 * The box renders only once mounted. With scripting off it could not do
 * anything, and a search box that ignores you is worse than none. Its height
 * is reserved so the page does not shift when it appears.
 */
export default function IndexSearch({ scope, placeholder, label }) {
  const [mounted, setMounted] = useState(false);
  const [q, setQ] = useState("");
  const [none, setNone] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    let root;
    try { root = document.getElementById(scope); } catch {}
    if (!root) return;
    let shown = 0;
    root.querySelectorAll("[data-search]").forEach((el) => {
      const hit = matchesQuery(el.getAttribute("data-search") || "", q);
      el.hidden = !hit;
      if (hit) shown += 1;
    });
    root.querySelectorAll("[data-search-group]").forEach((g) => {
      g.hidden = !g.querySelector("[data-search]:not([hidden])");
    });
    // While searching, the line marking today has nothing to stand between.
    root.querySelectorAll("[data-search-hide]").forEach((el) => { el.hidden = Boolean(q.trim()); });
    setNone(shown === 0 && Boolean(q.trim()));
  }, [q, scope]);

  return (
    <div style={{ minHeight: 36, marginTop: S.xl }}>
      {mounted && (
        <span style={{ position: "relative", display: "flex", alignItems: "center" }}>
          <MagnifyingGlass size={15} color={C.dim} weight="bold"
            style={{ position: "absolute", left: 10, pointerEvents: "none" }} />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") setQ(""); }}
            placeholder={placeholder} aria-label={label}
            style={{
              width: "100%", background: C.panel, border: `1px solid ${C.line}`,
              borderRadius: R.control, padding: "8px 12px 8px 32px", fontSize: F.sm,
              color: C.text, fontFamily: "inherit",
            }} />
        </span>
      )}
      {none && (
        <div role="status" style={{ padding: `${S["2xl"]}px 0 0` }}>
          <p style={{ fontSize: F.lg, margin: 0 }}>Nothing matches that.</p>
          <button onClick={() => setQ("")} className="press"
            style={{
              marginTop: S.sm, background: "none", border: 0, padding: 0, color: C.muted,
              fontSize: F.md, textDecoration: "underline", cursor: "pointer", fontFamily: "inherit",
            }}>Clear the search</button>
        </div>
      )}
    </div>
  );
}
