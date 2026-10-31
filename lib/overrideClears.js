/*
 * Clearing a stored override from the file.
 *
 * An override in svt:overrides outranks the file (invariant 4), which is right
 * for a vendor's edit and for an applied monitor finding, and wrong when the
 * stored value is the mistake and the correction is a reviewed commit: the
 * commit changes nothing a visitor sees until somebody retypes it on /admin.
 *
 * So an entry may carry a marker:
 *
 *   clearOverride: { fields: ["price"], at: "2026-10-31", reason: "..." }
 *
 * meaning: discard any stored override of these fields that was set on or
 * before `at`, and use the file's value. It is narrow on purpose.
 *
 *   - Only the named fields, never the whole override.
 *   - Only a value set on or before `at`. A vendor who edits the field after
 *     the commit keeps their edit; the marker never reaches past its own date,
 *     and is logged as having kept it. A commit without a marker still changes
 *     nothing an override holds, so a vendor's edit is never overwritten by an
 *     unrelated commit.
 *   - The reason is required, because the log and the admin panel show it.
 *
 * It takes effect on deploy, at read time (`clearedOverride`, used by every
 * merge in lib/listings.js), so the page shows the file's value the moment the
 * new build serves. The stored field is then removed and logged by
 * `settleClears()` on the next /admin load and the daily run, so the store does
 * not keep a value nothing reads. The marker can stay in the file afterwards:
 * it only ever matches values older than itself.
 *
 * A protected field (`watch`, `cat` and the rest) is never in an override to
 * begin with, so a marker naming one does nothing.
 */
import { read, write, readCapped, pushCapped, KEYS } from "./store";

const KEY_OVERRIDES = "svt:overrides";
const META = ["editedAt", "editedBy", "priceAt"];

/** When a field of an override was last set: the price has its own stamp. */
export function fieldSetAt(o = {}, field) {
  return String((field === "price" && o.priceAt) || o.editedAt || "");
}

/* Compared at the marker's own precision: a date-only marker covers the whole
   of that day. An override with no stamp at all is older than any marker. */
const onOrBefore = (setAt, at) => !setAt || setAt.slice(0, String(at).length) <= String(at);

/** A usable marker, or null. Pure. */
export function markerOf(entry = {}) {
  const m = entry.clearOverride;
  if (!m || !Array.isArray(m.fields) || !m.fields.length || !/^\d{4}-\d{2}-\d{2}/.test(String(m.at || "")) || !String(m.reason || "").trim()) return null;
  return { fields: m.fields.filter((f) => typeof f === "string" && !META.includes(f)), at: String(m.at), reason: String(m.reason).trim() };
}

/**
 * The override with the marked fields taken out, and what was decided per
 * field: { override, cleared: [field], kept: [field] }. Pure.
 */
export function clearedOverride(entry, o) {
  const m = markerOf(entry);
  if (!m || !o) return { override: o, cleared: [], kept: [] };
  const cleared = [];
  const kept = [];
  for (const f of m.fields) {
    if (!(f in o)) continue;
    if (onOrBefore(fieldSetAt(o, f), m.at)) cleared.push(f); else kept.push(f);
  }
  if (!cleared.length) return { override: o, cleared, kept };
  const out = { ...o };
  for (const f of cleared) { delete out[f]; if (f === "price") delete out.priceAt; }
  return { override: out, cleared, kept };
}

/** Whether a marker on `price` postdates a confirmed structure, so the file price shows. */
export const fileBeatsConfirmed = (entry, confirmedAt) => {
  const m = markerOf(entry);
  return Boolean(m && m.fields.includes("price") && confirmedAt && String(confirmedAt).slice(0, m.at.length) <= m.at);
};

/**
 * Remove what the markers clear from the store, and log each field once. Runs
 * on /admin load and in the daily run. Returns the new log rows.
 */
export async function settleClears(entries, { build = process.env.VERCEL_GIT_COMMIT_SHA || "" } = {}) {
  const overrides = (await read(KEY_OVERRIDES, {})) || {};
  const log = await readCapped(KEYS.overridesCleared, 500);
  const logged = new Set(log.map((r) => `${r.toolId}|${r.field}|${r.markerAt}|${r.outcome}|${r.setAt}`));
  const rows = [];
  let changed = false;
  for (const e of entries) {
    const m = markerOf(e);
    const o = overrides[e.id];
    if (!m || !o) continue;
    const { override, cleared, kept } = clearedOverride(e, o);
    const now = new Date().toISOString();
    for (const f of cleared) {
      const row = { at: now, toolId: e.id, name: e.name, field: f, outcome: "cleared", value: o[f], setAt: fieldSetAt(o, f), setBy: o.editedBy || "", reason: m.reason, markerAt: m.at, build };
      if (!logged.has(`${e.id}|${f}|${m.at}|cleared|${row.setAt}`)) rows.push(row);
    }
    for (const f of kept) {
      const row = { at: now, toolId: e.id, name: e.name, field: f, outcome: "kept, set after the marker", value: o[f], setAt: fieldSetAt(o, f), setBy: o.editedBy || "", reason: m.reason, markerAt: m.at, build };
      if (!logged.has(`${e.id}|${f}|${m.at}|${row.outcome}|${row.setAt}`)) rows.push(row);
    }
    if (cleared.length) {
      const meaningful = Object.keys(override).filter((k) => !META.includes(k) && !(k === "social" && !Object.keys(override.social || {}).length));
      if (meaningful.length) overrides[e.id] = override; else delete overrides[e.id];
      changed = true;
    }
  }
  if (changed) await write(KEY_OVERRIDES, overrides);
  if (rows.length) {
    await pushCapped(KEYS.overridesCleared, rows, 500);
    for (const r of rows) console.log(`[overrides] ${r.outcome}: ${r.toolId}.${r.field} ${JSON.stringify(r.value)} (set ${r.setAt || "undated"}), ${r.reason}`);
  }
  return rows;
}

export const readClears = (limit = 200) => readCapped(KEYS.overridesCleared, limit);
