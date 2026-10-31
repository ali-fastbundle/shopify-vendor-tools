/*
 * Hand edits the store can see, resolving the findings they answered.
 *
 * A finding often ends with somebody editing the listing by hand, in the file
 * or on the site, and asking them to come back and say so is asking them to
 * confirm something the software can already read. So on each /admin load,
 * an open finding with nothing done to it is resolved when, after the finding
 * was raised:
 *
 *   field    the field it proposed now holds the proposed value (the edit was
 *            made, whoever made it, so this is the strongest signal)
 *   site     an admin edited the listing on the site (an override saved by an
 *            address in ADMIN_EMAILS; a vendor editing their own listing for
 *            some other reason is not an answer to our finding)
 *   file     the entry's `updated` date in its catalogue file moved past the
 *            day the finding was raised, which is the date every editorial
 *            edit sets (invariant 15)
 *
 * Dates compare by day and strictly, so an edit on the same day as the
 * finding is not assumed to answer it: that one is pressed by hand.
 *
 * The finding says so: the record carries the reason, the row shows
 * "Resolved automatically" with it, and the panel lists what this load
 * resolved. Reopen puts the finding back; "Not edited" on the detected edit
 * leaves a "rejected" record so the same detection does not fire again.
 * Findings that already have a destination (published, applied, rewritten)
 * are left alone: they wait for the Resolve the editor chose to press.
 */
import { read, write, KEYS } from "./store";
import { readChangelog } from "./monitor";
import { getOverrides, mergedTools, mergedNewsletters } from "./listings";
import { isAdmin } from "./auth";

const norm = (v) => {
  if (v && typeof v === "object") v = v.name ?? JSON.stringify(v);
  return String(v ?? "").trim().toLowerCase().replace(/\s+/g, " ");
};

/* Pure: which open findings a later edit has answered, and why. */
export function detectHandEdits(rows = [], {
  entries = {}, overrides = {}, seen = {}, published = {}, applied = {}, rewritten = {}, edited = {},
  isAdminEmail = () => false,
} = {}) {
  const out = [];
  for (const r of rows) {
    if (!r?.id || !r.entryId || !r.at) continue;
    if (seen[r.id] || published[r.id] || applied[r.id] || rewritten[r.id]) continue;
    if (edited[r.id] && edited[r.id].via !== "editing") continue;
    const entry = entries[r.entryId];
    if (!entry) continue;
    const day = String(r.at).slice(0, 10);
    const field = r.edit?.field;
    const to = r.edit?.to;

    let reason = "";
    let fields = [];
    if (r.edit?.state === "appliable" && field && to !== undefined && to !== ""
      && norm(entry[field]) === norm(to) && norm(to) !== norm(r.edit.from)) {
      reason = `${field} now reads "${String(to).slice(0, 60)}"`;
      fields = [field];
    } else {
      const o = overrides[r.entryId];
      if (o?.editedAt && o.editedAt > day && isAdminEmail(o.editedBy) && (!field || field in o)) {
        reason = `the listing was edited on the site on ${o.editedAt}`;
        fields = field && field in o ? [field] : [];
      } else if (entry.updated && entry.updated > day) {
        reason = `the listing was updated in the file on ${entry.updated}`;
      }
    }
    if (reason) out.push({ id: r.id, entryId: r.entryId, entryName: r.entryName || entry.name || r.entryId, reason, fields });
  }
  return out;
}

/* Reads, detects, writes. Returns what this load resolved. */
export async function settleHandEdits() {
  const [rows, overrides, tools, newsletters, seen, published, applied, rewritten, edited] = await Promise.all([
    readChangelog(500), getOverrides(), mergedTools(), mergedNewsletters(),
    read(KEYS.changesSeen, {}), read(KEYS.changesPublished, {}), read(KEYS.changesApplied, {}),
    read(KEYS.changesRewritten, {}), read(KEYS.changesEdited, {}),
  ]);
  const entries = {};
  for (const t of tools || []) entries[t.id] = t;
  for (const n of newsletters || []) entries[n.id] = n;
  const found = detectHandEdits(rows, {
    entries, overrides: overrides || {}, seen: seen || {}, published: published || {}, applied: applied || {},
    rewritten: rewritten || {}, edited: edited || {}, isAdminEmail: isAdmin,
  });
  if (!found.length) return [];
  const now = new Date().toISOString();
  const nextEdited = { ...(edited || {}) };
  const nextSeen = { ...(seen || {}) };
  for (const f of found) {
    nextEdited[f.id] = { at: now, by: "auto", via: "detected", toolId: f.entryId, reason: f.reason, fields: f.fields };
    nextSeen[f.id] = { at: now.slice(0, 10), by: "auto", via: "resolved", destinations: ["edited"], auto: f.reason };
  }
  await write(KEYS.changesEdited, nextEdited);
  await write(KEYS.changesSeen, nextSeen);
  console.log(`[monitor] resolved ${found.length} finding${found.length === 1 ? "" : "s"} from detected edits: ${found.map((f) => `${f.entryId}:${f.id}`).join(", ")}`);
  return found;
}
