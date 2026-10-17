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
/* The rule, applied to every panel rather than a list of names: an open
   <Section> may not draw a list. The ones left open are short by nature. */
const SHORT = ["Monitor accuracy", "Outreach", "Post a vendor announcement", "Growth recommender", "Recommender feedback", "Listing changes"];
const sections = [...src.matchAll(/<Section\s+title="([^"]+)"[\s\S]*?<\/Section>/g)];
for (const m of sections) {
  if (SHORT.includes(m[1])) continue;
  ok(!/\.map\(/.test(m[0]), `${m[1]} draws no open list: a list that can pass ten rows is collapsed`);
}
for (const t of ["Suggestions to review", "Claims to check", "Comments to read", "Questions to read", "Lists published", "Media to approve",
  "Reports and corrections", "Reviews to decide", "Drafts", "Ideas", "Announcements", "Structured data to confirm"]) {
  ok(new RegExp(`<WorkList rows=\\{[^}]+\\} title="${t}"`).test(src), `${t} is a work list: open while ten or fewer, shut with its count past ten`);
}
ok(/function WorkList\(\{ rows = 0, \.\.\.props \}\) \{\s*return <Collapsible \{\.\.\.props\} openWhen=\{rows <= ROW_LIMIT\} \/>/.test(src) && /const ROW_LIMIT = 10;/.test(src), "WorkList opens only at ten rows or fewer");
for (const t of ["Verified claims", "Published from the queue", "Discovered competitors", "Directory stats", "Growth recommender", "Recommender feedback"]) {
  ok(new RegExp(`<Collapsible\\s+title="${t}"`).test(src), `${t} is history, collapsed`);
}
ok(/groups\.length > ROW_LIMIT/.test(src) && /tools with changes/.test(src), "past ten tools the monitor's groups are shut behind a count");
ok(/function resolveReady\(\)/.test(src) && /Resolve \{ready\.length\}/.test(src), "each tool's findings resolve in one press once they have somewhere to go");

console.log("\nwhat a tab's count means:");
ok(/people: reviewsToDecide,/.test(src) && !/people: Object\.keys\(accounts/.test(src), "People counts reviews to decide, not accounts");
ok(!/catalogueCount = Object\.keys\(entryRows/.test(src) && /drafted\(list\)\.filter\(\(e\) => !\(holds/.test(src), "Catalogue counts drafts waiting on a decision, not history");
const cat = src.slice(src.indexOf("function Catalogue("), src.indexOf("function People("));
ok(cat.indexOf("<Drafts") < cat.indexOf("<Tallies"), "Catalogue opens with the drafts, and the running totals follow the work");

console.log(bad ? `\n${bad} failed` : "\nall passed");
process.exit(bad ? 1 : 0);
