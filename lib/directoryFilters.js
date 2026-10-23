/*
 * The directory's filter state, and its address.
 *
 * Category chips are navigation and stay on the page. Every refinement (free
 * plan, editor used, integrations, a category's yes-or-no details) lives
 * behind one Filters control, shows as a removable chip when it is on, and is
 * written to the URL so a filtered view can be sent, bookmarked and crawled.
 * The server reads the same URL (app/page.js), so a shared link renders
 * filtered in the first HTML, not after hydration.
 *
 * A filtered view canonicalises to the homepage. Each category already has a
 * real page at /categories/<id>, and a canonical per filter combination would
 * be the duplicate-without-canonical problem Search Console reported.
 *
 *   ?cat=aso&q=keyword&free=1&used=1&int=ga4,slack&has=competitorAlerts&sort=price&view=list
 *
 * Pure and client-safe.
 */
import { CATEGORIES } from "./tools";
import { INTEGRATIONS, attributesFor, attributeValue } from "./categories";
import { launchedWithinYear } from "./launched";

/* The orders the URL may name. Must match SORTS in components/Directory.jsx;
   scripts/filters-test.mjs checks they agree. */
export const SORT_KEYS = ["rating", "votes", "name", "cat", "price", "free", "external", "ownership", "editor", "launched"];

export const DEFAULT_FILTERS = { cat: "all", q: "", free: false, used: false, recent: false, int: [], has: [], sort: "rating", view: "grid" };

const list = (v) => String(v || "").split(",").map((s) => s.trim()).filter(Boolean);

/** Filters from URL parameters, each value checked against what exists. */
export function parseFilters(params = {}, { sorts = SORT_KEYS } = {}) {
  const get = (k) => (typeof params.get === "function" ? params.get(k) : params[k]);
  const cat = CATEGORIES.some((c) => c.id === get("cat")) ? get("cat") : "all";
  const ids = INTEGRATIONS.map((i) => i.id);
  const attrKeys = cat === "all" ? [] : attributesFor(cat).filter((a) => a.type === "boolean").map((a) => a.key);
  return {
    cat,
    q: String(get("q") || "").slice(0, 80),
    free: get("free") === "1",
    used: get("used") === "1",
    recent: get("new") === "1",
    int: [...new Set(list(get("int")).filter((i) => ids.includes(i)))],
    has: [...new Set(list(get("has")).filter((k) => attrKeys.includes(k)))],
    sort: sorts.includes(get("sort")) ? get("sort") : "rating",
    view: get("view") === "list" ? "list" : "grid",
  };
}

/** The query string for a state, leaving out everything at its default. */
export function toQuery(f) {
  const p = new URLSearchParams();
  if (f.cat && f.cat !== "all") p.set("cat", f.cat);
  if (f.q?.trim()) p.set("q", f.q.trim());
  if (f.free) p.set("free", "1");
  if (f.used) p.set("used", "1");
  if (f.recent) p.set("new", "1");
  if (f.int?.length) p.set("int", f.int.join(","));
  if (f.has?.length) p.set("has", f.has.join(","));
  if (f.sort && f.sort !== "rating") p.set("sort", f.sort);
  if (f.view === "list") p.set("view", "list");
  const s = p.toString().replace(/%2C/g, ",");
  return s ? `?${s}` : "";
}

/** How many refinements are on. Category, search and sort are not refinements. */
export const activeCount = (f) => Number(Boolean(f.free)) + Number(Boolean(f.used)) + Number(Boolean(f.recent)) + (f.int?.length || 0) + (f.has?.length || 0);

/**
 * Whether a tool passes the refinements. Integrations match any of those
 * picked (the usual rule within one facet); details must all be true. Both
 * read confirmed data only (lib/categories.js), so a draft never filters.
 */
export function passes(t, f, hasEditorUse) {
  if (f.free && !t.free) return false;
  if (f.used && !hasEditorUse(t)) return false;
  /* Launched in the last twelve months, on what is known (lib/launched.js). */
  if (f.recent && !launchedWithinYear(t)) return false;
  if (f.int?.length && !f.int.some((i) => t.structured?.integrations?.includes(i))) return false;
  if (f.has?.length) {
    if (!t.structured) return false;
    for (const key of f.has) {
      const a = attributesFor(t.cat).find((x) => x.key === key);
      if (!a || attributeValue(a, t.structured) !== true) return false;
    }
  }
  return true;
}
