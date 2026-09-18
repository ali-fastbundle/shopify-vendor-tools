#!/usr/bin/env node
/*
 * "New since your last visit", the arithmetic only.
 *
 *   node scripts/updates-count.mjs
 *
 * The count on the Recent updates tab is the one number on the page a visitor
 * has no way to check. If it says 3 and there are 5, or it says 12 to somebody
 * on their first visit, the tab stops being worth looking at, and a counter
 * people have learned to ignore is worse than no counter.
 *
 * So the rule is pinned here rather than left to the component: strictly newer
 * than the stored mark, nothing at all when there is no mark, and no crash when
 * the stored value or an entry's timestamp is rubbish.
 */

const unread = (feed, seenAt) =>
  (seenAt ? feed.filter((e) => String(e.at || "") > seenAt).length : 0);

let bad = 0;
const ok = (c, l, d = "") => {
  console.log(`  ${c ? "ok  " : "FAIL"}  ${l}${d ? `  ${d}` : ""}`);
  if (!c) bad += 1;
};

const FEED = [
  { id: "a", at: "2026-09-18T10:00:00.000Z" },
  { id: "b", at: "2026-09-17T10:00:00.000Z" },
  { id: "c", at: "2026-09-10T10:00:00.000Z" },
];

console.log("a first-time visitor:");
ok(unread(FEED, "") === 0, "no stored mark means no count, not every entry ever",
  `${unread(FEED, "")}`);
ok(unread(FEED, null) === 0, "and a null mark is the same");

console.log("\na returning visitor:");
ok(unread(FEED, "2026-09-17T12:00:00.000Z") === 1, "counts only what landed since", `${unread(FEED, "2026-09-17T12:00:00.000Z")}`);
ok(unread(FEED, "2026-09-01T00:00:00.000Z") === 3, "everything, if they have been away");
ok(unread(FEED, "2026-09-19T00:00:00.000Z") === 0, "nothing, if they were here after the last one");

console.log("\nthe boundary:");
const exact = FEED[0].at;
ok(unread(FEED, exact) === 0,
  "an entry stamped at exactly the mark is not new, or the tab never clears");

console.log("\nrubbish in:");
ok(unread([], "2026-09-17T10:00:00.000Z") === 0, "an empty feed");
ok(unread([{ id: "x" }], "2026-09-17T10:00:00.000Z") === 0, "an entry with no timestamp is not new");
ok(unread([{ id: "x", at: null }], "2026-09-17T10:00:00.000Z") === 0, "nor a null one");
/* String comparison, so a mark that is not a date sorts below every ISO stamp
   and nothing counts as new. It fails closed, to a quiet tab, which is the
   direction to fail in: a count nobody can explain is worse than no count. */
ok(unread(FEED, "not-a-date") === 0, "a corrupt mark shows no count rather than throwing",
  `${unread(FEED, "not-a-date")}`);

/* The component must not read localStorage during render: the server has none,
   so the first client paint would disagree with the HTML it is hydrating. */
console.log("\nthe component:");
const raw = (await import("fs")).readFileSync(new URL("../components/Directory.jsx", import.meta.url), "utf8");
/* Comments talk about role="tab" to explain why it is not used, so they come
   out before the check looks for it. */
const src = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
ok(/useEffect\(\(\) => \{ setSeenAt\(readSeen\(\)\); \}, \[\]\);/.test(src),
  "the stored mark is read after mount, not during render");
ok(/try \{ return localStorage\.getItem/.test(src) && /catch \{ return ""; \}/.test(src),
  "and every access is wrapped, so blocked storage costs the count and nothing else");
ok(!/role="tab"/.test(src), "no role=tab without the arrow-key contract it promises");

console.log(`\n${bad ? `${bad} FAILED` : "all passed"}`);
process.exit(bad ? 1 : 0);
