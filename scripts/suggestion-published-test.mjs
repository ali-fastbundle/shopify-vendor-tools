#!/usr/bin/env node
/*
 * A suggestion that becomes a listing leaves the queue as published, with the
 * entry id and the date, by either path, and its interest carries across once.
 *
 *   node scripts/suggestion-published-test.mjs
 */
import { readFileSync, writeFileSync, mkdtempSync, readdirSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { pathToFileURL } from "url";

const ROOT = new URL("..", import.meta.url).pathname;
process.env.AUTH_SECRET = "sp-secret";
const dir = mkdtempSync(join(tmpdir(), "svt-sp-"));
mkdirSync(join(dir, "lib"));
for (const f of readdirSync(join(ROOT, "lib"))) {
  if (!f.endsWith(".js")) continue;
  writeFileSync(join(dir, "lib", f),
    readFileSync(join(ROOT, "lib", f), "utf8").replace(/(from\s+"\.\/[a-zA-Z_-]+)"/g, '$1.js"')
      .replace(/import\("\.\/([a-zA-Z]+)"\)/g, 'import("./$1.js")'));
}
const load = (f) => import(pathToFileURL(join(dir, f)).href);
const P = await load("lib/suggestionPublished.js");
const store = await load("lib/store.js");

let bad = 0;
const ok = (c, l, d = "") => { console.log(`  ${c ? "ok  " : "FAIL"}  ${l}${d ? `  ${d}` : ""}`); if (!c) bad += 1; };
const src = (f) => readFileSync(join(ROOT, f), "utf8");

const suggestions = [
  { id: "s1", name: "Winning Hunter", url: "https://winninghunter.com", kind: "tool", approved: true, count: 3, by: "A", email: "a@x.test", date: "2026-10-01" },
  { id: "s2", name: "Some New Tool", url: "https://somenewtool.test", kind: "tool", approved: false, count: 1 },
  { id: "s3", name: "Old Deleted", url: "https://winninghunter.com", kind: "tool", status: "deleted" },
  { id: "s4", name: "Retail Insider", url: "https://retail-insider.com", kind: "newsletter", approved: false, count: 2 },
];
const catalogue = [
  { id: "winninghunter", name: "Winning Hunter", url: "https://winninghunter.com", domain: "winninghunter.com", kind: "tool" },
  { id: "retailinsider", name: "Retail Insider", url: "https://retail-insider.com/", domain: "retail-insider.com", kind: "newsletter" },
];

console.log("matching:");
{
  const { next, changed } = P.markPublished(suggestions, catalogue, { at: "2026-10-16T10:00:00.000Z" });
  const s1 = next.find((s) => s.id === "s1"), s4 = next.find((s) => s.id === "s4");
  ok(s1.status === "published" && s1.publishedId === "winninghunter" && s1.publishedAt === "2026-10-16T10:00:00.000Z", "a reviewed suggestion now listed is published, with the entry id and the date");
  ok(s4.status === "published" && s4.publishedId === "retailinsider" && s4.approved === true, "an unreviewed one published by hand into a file leaves the Inbox too");
  ok(!next.find((s) => s.id === "s2").status, "one that is not listed stays in the queue");
  ok(next.find((s) => s.id === "s3").status === "deleted", "a deleted row is left alone");
  ok(changed.length === 2, "exactly two changed");
  const cross = P.markPublished([{ id: "x", name: "Retail Insider", url: "https://retail-insider.com", kind: "tool" }], catalogue);
  ok(cross.changed.length === 0, "a tool suggestion does not match a newsletter of the same name");
}

console.log("\npersisting and interest:");
await store.write("svt:suggestions", suggestions);
let r = await P.settlePublished(catalogue);
ok(r.changed.length === 2, "settlePublished marks and saves them");
let interest = await store.read("svt:interest", {});
ok(interest.winninghunter?.count === 3 && interest.retailinsider?.count === 2, "and carries what people asked onto the listing", JSON.stringify(interest));
r = await P.settlePublished(catalogue);
ok(r.changed.length === 0 && (await store.read("svt:interest", {})).winninghunter.count === 3, "running it again changes nothing and does not double the interest");
await store.write("svt:suggestions", [{ id: "s9", name: "Winning Hunter", url: "https://winninghunter.com", kind: "tool", publishedId: "winninghunter", publishedAt: "2026-10-01", count: 5 }]);
await P.settlePublished(catalogue);
ok((await store.read("svt:interest", {})).winninghunter.count === 3, "a suggestion published before through the queue already carried, so it is not carried twice");
ok((await store.read("svt:suggestions", []))[0].publishedAt === "2026-10-01", "and keeps its original date");

console.log("\nthe two paths and the panel:");
const route = src("app/api/admin/route.js");
ok(/status: "published", publishedId: saved\.id/.test(route), "Approve and publish sets the status");
ok(/settlePublished\(\[\{ id: entry\.id/.test(route), "Publish on a file draft marks the suggestion that asked for it");
ok(/\(\{ status, \.\.\.r \}\) => \(\{ \.\.\.r, publishedId: "" \}\)/.test(route), "Unpublish puts it back in the queue");
ok(/settlePublished\(catalogue\)/.test(src("app/admin/page.js")), "/admin catches ones published before this existed");
const admin = src("components/Admin.jsx");
ok(/const live = rows\.filter\(\(s\) => !s\.status\)/.test(admin), "the queue, Inbox and Reviewed lists leave published rows out");
ok(/<Collapsible title="Published suggestions" count=\{publishedSuggestions\.length\}/.test(admin), "they show in a collapsed Published suggestions group (System, Records)");
ok(/!s\.status/.test(src("app/api/data/route.js")), "and leave the public list");

console.log(bad ? `\n${bad} failed` : "\nall passed");
process.exit(bad ? 1 : 0);
