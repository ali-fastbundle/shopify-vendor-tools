/*
 * Event refresh findings, counted (2026-11-06). Pure and client-safe, for the
 * decided list on Updates: per kind, how many were found, acted on, read the
 * same on two runs, and marked wrong. lib/eventRefresh.js is server only.
 */
export const DESTINATIONS = ["applied", "rewritten", "published"];
export const hasDestination = (f = {}) => DESTINATIONS.some((d) => f[d]);

export function eventAccuracy(findings = []) {
  const by = {};
  for (const f of findings) {
    const k = (by[f.kind] ||= { kind: f.kind, label: f.label || f.kind, total: 0, wrong: 0, acted: 0, twice: 0 });
    k.total++;
    if (f.status === "wrong") k.wrong++;
    if (hasDestination(f) || f.status === "done") k.acted++;
    if (f.confidence >= 0.9) k.twice++;
  }
  return Object.values(by).sort((a, b) => b.total - a.total);
}
