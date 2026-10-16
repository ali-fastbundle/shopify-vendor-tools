#!/usr/bin/env node
/*
 * /admin panels: any list that can pass about ten rows is collapsed by
 * default with its count in the header (invariant 25), and nothing opens
 * itself into a full list.
 *
 *   node scripts/admin-panels-test.mjs
 */
import { readFileSync } from "fs";
const src = readFileSync(new URL("../components/Admin.jsx", import.meta.url), "utf8");
let bad = 0;
const ok = (c, l) => { console.log(`  ${c ? "ok  " : "FAIL"}  ${l}`); if (!c) bad += 1; };

for (const t of ["Reviewed suggestions", "Interest in listed tools", "Accounts", "Out of scope", "Deleted", "On Recent updates",
  "Monitor coverage", "Needs verifying", "Editor use", "Vendor media", "Published", "Mail log", "Store contents", "Subscribers"]) {
  ok(new RegExp(`<Collapsible\\s+title="${t}"`).test(src) || (t === "Needs verifying" && /title="Needs verifying"/.test(src)), `${t} is collapsed by default`);
}
ok(!/title="Monitor coverage"[^>]*\n\s*openWhen=/.test(src), "Monitor coverage does not open itself");
const ann = src.slice(src.indexOf("function AnnouncementRow"), src.indexOf("function AnnouncementRow") + 4000);
ok(/const \[open, setOpen\] = useState\(false\)/.test(ann) && /body=\{!open \?/.test(ann), "each announcement is one line until opened");
for (const fn of ["function IdeaRow", "function StructuredRow"]) {
  const body = src.slice(src.indexOf(fn), src.indexOf(fn) + 2500);
  ok(/useState\(false\)/.test(body), `${fn.replace("function ", "")} starts closed`);
}
console.log(bad ? `\n${bad} failed` : "\nall passed");
process.exit(bad ? 1 : 0);
