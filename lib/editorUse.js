/*
 * Editor use: whether the editor has used a tool. A fact, not a rating.
 *
 * Four states. `using`, `used` (no longer), `tested` (tried, did not adopt),
 * and unset, which is the default and the honest state for most of the
 * catalogue: nobody uses every tool in a directory. Unset renders nothing at
 * all, because an absence that announces itself reads as a verdict (rule E).
 *
 * Set from /admin only, stored in Redis (`lib/editorUseStore.js`), merged on
 * read by `mergedTools()`. Never in `lib/tools.js`, never inferred, never
 * writable by a vendor (it is in PROTECTED).
 *
 * What it must never do, and where that is held:
 *  - feed the community average, `aggregateRating` or any rating. Nothing in
 *    lib/reviews.js or lib/seo.js reads it.
 *  - change what the matcher or the recommender picks. Both build their
 *    prompts and candidate lists from `catalogueTools()` or explicit fields,
 *    neither of which carries it. The matcher's answer shows the line beside a
 *    pick, attached in the browser after the model has answered.
 *  - show on an entry carrying `noRecommend`. That flag already keeps the
 *    entry out of anything that reads as the editor's endorsement, so
 *    `mergedTools()` never attaches a value to one and the store refuses to
 *    set one (invariant 35).
 *
 * Pure and client-safe: the directory, the tool page and /admin all read it.
 */

export const EDITOR_USE = [
  { id: "using", label: "Using", line: "Editor uses this" },
  { id: "used", label: "Used", line: "Editor used this" },
  { id: "tested", label: "Tested", line: "Editor tested this" },
];
export const EDITOR_USE_IDS = EDITOR_USE.map((u) => u.id);

export const NOTE_MAX = 160;

/* The one statement of the policy on the site. Shown above the grid when the
   filter or the sort is on, which is when somebody is relying on it. */
export const editorUsePolicy = (total) =>
  `Editor use records which tools the editor has used, and nothing more. It is not a rating. ` +
  `It does not change the community rating or what the matcher recommends. ` +
  `Most tools have no value here, because nobody can use ${total} tools.`;

const MONTHS = ["January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December"];

/* Month and year. The date is when the toggle changed, or what the editor
   typed, and neither is precise to the day about when use stopped. */
export const monthOf = (iso) => {
  const m = /^(\d{4})-(\d{2})/.exec(String(iso || ""));
  return m ? `${MONTHS[Number(m[2]) - 1]} ${m[1]}` : "";
};

/** The public sentence for a value, or "" for unset. */
export function editorUseLine(eu) {
  const u = EDITOR_USE.find((x) => x.id === eu?.value);
  if (!u) return "";
  const until = u.id === "used" && monthOf(eu.date) ? ` until ${monthOf(eu.date)}` : "";
  return `${u.line}${until}.`;
}

/* For the sort: using, then used, then tested, then unset. */
export const editorUseRank = (t) =>
  ({ using: 3, used: 2, tested: 1 })[t?.editorUse?.value] || 0;

export const hasEditorUse = (t) => editorUseRank(t) > 0;

/**
 * Validates an admin's input. Returns { value, note, date } or { error }.
 * `value` "" means unset. A note is one line and public, so the em dash is
 * refused the way every other public field refuses it.
 */
export function sanitiseEditorUse({ value, note, date } = {}, today = new Date().toISOString().slice(0, 10)) {
  const v = String(value ?? "");
  if (v && !EDITOR_USE_IDS.includes(v)) return { error: "Unknown value." };
  const n = String(note ?? "").replace(/\s+/g, " ").trim();
  if (n.length > NOTE_MAX) return { error: `The note is over ${NOTE_MAX} characters. One line.` };
  if (/—/.test(n)) return { error: "The note has an em dash. Use a comma or two sentences." };
  const d = String(date ?? "").trim() || today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return { error: "The date is not YYYY-MM-DD." };
  if (d > today) return { error: "The date is in the future." };
  return { value: v, note: v ? n : "", date: v ? d : "" };
}
