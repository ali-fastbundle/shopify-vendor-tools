#!/usr/bin/env node
/*
 * The changes feed library, and the contract between what it writes and what
 * the public pages read.
 *
 *   node scripts/feed-test.mjs
 *
 * The field-contract check is the point of this file. /changes and the "Recent
 * changes" sections render from entries lib/feed.js produces, and a field
 * renamed in one and not the other is invisible to the build. That is the same
 * class of bug that took /admin down, so it gets a test rather than a promise.
 *
 * The lib files import each other without file extensions, which Next resolves
 * and plain Node does not, so this copies them to a temp directory with the
 * extensions added and imports from there. Nothing in lib/ changes.
 */

import { readFileSync, writeFileSync, mkdtempSync, readdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { pathToFileURL } from "url";

const ROOT = new URL("..", import.meta.url).pathname;
const shim = mkdtempSync(join(tmpdir(), "svt-feed-"));
for (const f of readdirSync(join(ROOT, "lib"))) {
  if (!f.endsWith(".js")) continue;
  const src = readFileSync(join(ROOT, "lib", f), "utf8").replace(/(from\s+"\.\/[a-zA-Z]+)"/g, '$1.js"');
  writeFileSync(join(shim, f), src);
}
const load = (f) => import(pathToFileURL(join(shim, f)).href);

const { sanitiseEntry, addEntry, feedEntries, feedByTool, feedSince, removeEntry } = await load("feed.js");
const { read } = await load("store.js");

let bad = 0;
const ok = (c, l, d = "") => {
  console.log(`  ${c ? "ok  " : "FAIL"}  ${l}${d ? `  ${d}` : ""}`);
  if (!c) bad += 1;
};

console.log("sanitise:");
ok(Boolean(sanitiseEntry({ headline: "" }).error), "empty headline refused");
ok(Boolean(sanitiseEntry({ headline: "too short" }).error), "very short headline refused");
const dash = sanitiseEntry({ headline: "Raised prices — again, sharply." });
ok(Boolean(dash.error), "em-dash refused", dash.error || "");
ok(!sanitiseEntry({ headline: "Starter went from $49 to $79 a month." }).error, "a real sentence passes");

console.log("\nadd and read back:");
const tool = { id: "ranksy", name: "Ranksy", cat: "aso" };
const { entry } = sanitiseEntry({
  headline: "Starter went from $49 to $79 a month.",
  sourceUrl: "https://ranksyapp.com/pricing",
  kind: "pricing",
});
const saved = await addEntry(entry, { tool, changeId: "chg1", publishedBy: "ali@x" });
ok(Boolean(saved.id && saved.at && saved.date), "gets an id, an at and a date");

/*
 * `e` and `c` are also the event argument in the filter handlers, so DOM
 * properties are excluded rather than counted as missing feed fields.
 */
const EVENT_PROPS = new Set([
  "target", "currentTarget", "preventDefault", "stopPropagation",
  "key", "metaKey", "ctrlKey", "shiftKey", "altKey", "button",
]);
const produced = new Set([...Object.keys(saved), "domain", "logo"]);
const fieldsRead = (file, varName) => {
  const src = readFileSync(join(ROOT, file), "utf8");
  return [...new Set([...src.matchAll(new RegExp(`\\b${varName}\\.([a-zA-Z]+)`, "g"))].map((m) => m[1]))]
    .filter((k) => !EVENT_PROPS.has(k));
};
for (const [file, v, label] of [
  ["components/ChangesFeed.jsx", "e", "ChangesFeed"],
  ["components/ToolPage.jsx", "c", "ToolPage's Recent changes"],
]) {
  const missing = fieldsRead(file, v).filter((k) => !produced.has(k));
  ok(missing.length === 0, `every field ${label} reads is produced by addEntry`,
    missing.length ? `missing: ${missing.join(", ")}` : "");
}

console.log("\nordering and scoping:");
await addEntry(sanitiseEntry({ headline: "Added a Slack integration for alerts." }).entry,
  { tool: { id: "sami", name: "SAMI", cat: "aso" } });
const all = await feedEntries();
ok(all.length === 2, "both entries listed", `got ${all.length}`);
ok(all[0].toolName === "SAMI", "newest first", all[0].toolName);
ok((await feedEntries({ toolId: "ranksy" })).length === 1, "scoped by tool");
ok(Object.keys(await feedByTool()).sort().join(",") === "ranksy,sami", "grouped by tool");
ok((await feedSince(new Date(Date.now() - 60_000).toISOString())).length === 2, "since a minute ago returns both");
ok((await feedSince(new Date(Date.now() + 60_000).toISOString())).length === 0, "since the future returns none");

console.log("\nsoft delete:");
await removeEntry(saved.id, { by: "ali@x" });
ok((await feedEntries()).length === 1, "removed from the public list");
const raw = await read("svt:feed", []);
ok(raw.length === 2 && raw.some((r) => r.deletedAt), "but the record is kept, with a deletedAt");

console.log(`\n${bad ? `${bad} FAILED` : "all passed"}`);
process.exit(bad ? 1 : 0);
