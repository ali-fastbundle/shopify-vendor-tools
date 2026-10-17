"use client";

import { Suspense, useEffect, useState } from "react";
import { C, S, F } from "@/lib/tools";
import { matchesQuery } from "@/lib/search";
import { useParam, setParam } from "@/components/ListingParams";

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
 * The box itself is in the sidebar now (components/SiteFrame.jsx), which
 * writes ?q= on this page. This reads it, filters, and says so when nothing
 * is left. A searched link is shareable for the same reason the directory's
 * filters are.
 */
function Filter({ scope }) {
  const q = useParam("q");
  const [none, setNone] = useState(false);

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

  if (!q.trim()) return null;
  return (
    <div role="status" style={{ marginTop: S.lg }}>
      {none ? (
        <p style={{ fontSize: F.lg, margin: 0 }}>Nothing matches “{q.trim()}”.</p>
      ) : (
        <p style={{ fontSize: F.sm, color: C.muted, margin: 0 }}>Showing matches for “{q.trim()}”.</p>
      )}
      <button onClick={() => setParam("q", "")} className="press"
        style={{
          marginTop: S.xs, background: "none", border: 0, padding: 0, color: C.muted,
          fontSize: F.sm, textDecoration: "underline", cursor: "pointer", fontFamily: "inherit",
        }}>Clear the search</button>
    </div>
  );
}

/* placeholder and label are kept for the callers; the box they described is
   in the sidebar. */
// eslint-disable-next-line no-unused-vars
export default function IndexSearch({ scope, placeholder, label }) {
  return <Suspense fallback={null}><Filter scope={scope} /></Suspense>;
}
