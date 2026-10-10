/*
 * One fire-and-forget post to /api/stat, for the counters that are not the
 * directory's own batch (section views, the recommender funnel). Client-safe:
 * no imports, no storage, no identifier. sendBeacon where there is one, so a
 * count posted as the tab closes still arrives.
 *
 * What may be counted is decided by the route, against fixed lists
 * (`STAT_SECTIONS` and the recommender's SCREENS); anything else is dropped.
 */
export const STAT_SECTIONS = ["directory", "newsletters", "events", "updates", "blog", "recommend", "categories"];

export function beacon(payload) {
  if (typeof window === "undefined") return;
  const body = JSON.stringify(payload);
  try {
    if (navigator.sendBeacon && navigator.sendBeacon("/api/stat", new Blob([body], { type: "application/json" }))) return;
  } catch { /* fall through */ }
  fetch("/api/stat", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
}
