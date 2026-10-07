/*
 * What a monitor finding's confidence means, and how often the monitor is
 * wrong. Pure and client-safe, so components/Admin.jsx can import it without
 * pulling in anything that talks to a model (invariant 20).
 *
 * ------------------------------------------------------------------
 *  Confidence is a statement about verification
 * ------------------------------------------------------------------
 * Two findings were reported at 0.9 and were wrong: AppJubilee's pricing page
 * "dead", and PPSPY "removing annual pricing" when the annual figures were
 * behind a Monthly/Yearly toggle a static fetch never clicks. Both were a
 * model sounding sure about one reading. So the number no longer comes from
 * how sure the model sounds; it comes from what we have checked:
 *
 *   0.9   confirmed: the new state was read again on the following run
 *   0.75  missing twice: a value absent on two consecutive full readings
 *   0.6   single run: seen once, the ceiling for anything not yet re-read
 *   0.4   partial page: pricing read from a page with an interactive billing
 *         toggle, where part of the pricing never reaches a static fetch
 *   0.3   not repeated: the following run did not show it again
 *
 * The model's own number is kept as `modelConfidence` and still gates what is
 * reported at all (below 0.6 by its own admission is noise), but it is never
 * what the editor is shown.
 */

export const CAP = {
  confirmed: 0.9,
  "missing-twice": 0.75,
  "single-run": 0.6,
  "partial-page": 0.4,
  "not-repeated": 0.3,
};

export const VERIFICATION_LABEL = {
  confirmed: "confirmed on the next run",
  "missing-twice": "missing on two runs",
  "single-run": "seen once, not yet re-read",
  "partial-page": "page partly hidden behind a toggle",
  "not-repeated": "not seen again on the next run",
};

/**
 * The confidence to show for a row, folding in what later runs found.
 * Rows written before calibration have no `verification` and keep their
 * number, labelled as such.
 */
export function effectiveConfidence(row, verified = {}) {
  const v = verified[row.id];
  if (v?.state === "confirmed") return { value: CAP.confirmed, label: VERIFICATION_LABEL.confirmed, state: "confirmed" };
  if (v?.state === "not-repeated") {
    return { value: Math.min(row.confidence ?? 0, CAP["not-repeated"]), label: VERIFICATION_LABEL["not-repeated"], state: "not-repeated" };
  }
  if (!row.verification) return { value: row.confidence, label: "before calibration", state: "legacy" };
  return { value: row.confidence, label: VERIFICATION_LABEL[row.verification] || row.verification, state: row.verification };
}

/*
 * Error rate per finding type, over the findings still in the window. A rate
 * is only honest when its numerator and denominator come from the same rows,
 * so an error whose finding has aged out of the window is not counted.
 */
export function errorRates(rows = [], errors = [], verified = {}) {
  const inWindow = new Set(rows.map((r) => r.id));
  const wrongIds = new Set(errors.filter((e) => inWindow.has(e.changeId)).map((e) => e.changeId));
  const by = new Map();
  for (const r of rows) {
    const k = r.kind || "?";
    const g = by.get(k) || { kind: k, findings: 0, wrong: 0, confirmed: 0 };
    g.findings += 1;
    if (wrongIds.has(r.id)) g.wrong += 1;
    if (verified[r.id]?.state === "confirmed") g.confirmed += 1;
    by.set(k, g);
  }
  return [...by.values()]
    .map((g) => ({ ...g, rate: g.findings ? g.wrong / g.findings : 0 }))
    .sort((a, b) => b.rate - a.rate || b.findings - a.findings);
}
