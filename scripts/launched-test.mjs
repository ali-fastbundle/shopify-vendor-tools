#!/usr/bin/env node
/*
 * Launch dates (lib/launched.js, CLAUDE.md invariant 56).
 *
 *   node scripts/launched-test.mjs
 *
 * Every published tool, event and newsletter has a launch value, a date or
 * "unknown"; every date carries its source beside it; the wording per kind;
 * the sort puts unknown last; the last-year filter counts only known dates
 * wholly inside the window; the field is protected from vendors.
 */
import { mkdtempSync, readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = mkdtempSync(join(tmpdir(), "svt-launched-"));
const copy = (sub) => {
  mkdirSync(join(dir, sub), { recursive: true });
  for (const f of readdirSync(join(root, "lib", sub)).filter((x) => x.endsWith(".js"))) {
    const s = readFileSync(join(root, "lib", sub, f), "utf8").replace(/from "(\.\.?\/[\w/.-]+)"/g, 'from "$1.mjs"');
    writeFileSync(join(dir, sub, f.replace(/\.js$/, ".mjs")), s);
  }
};
copy(""); copy("posts");
const L = await import(join(dir, "launched.mjs"));
const { ALL_TOOLS } = await import(join(dir, "tools.mjs"));
const { ALL_EVENTS } = await import(join(dir, "events.mjs"));
const { ALL_NEWSLETTERS } = await import(join(dir, "newsletters.mjs"));
const listings = readFileSync(join(root, "lib/listings.js"), "utf8");

let bad = 0;
const ok = (c, l, d = "") => { console.log(`  ${c ? "ok  " : "FAIL"}  ${l}${d ? `  ${d}` : ""}`); if (!c) bad += 1; };
const src = (p) => readFileSync(join(root, p), "utf8");

console.log("every entry has one:");
const missing = (list) => list.filter((e) => !(L.isLaunchValue(e.launched) || (!e.launched && /^\d{4}(-\d{2}){0,2}$/.test(e.started || "")))).map((e) => e.id);
ok(missing(ALL_TOOLS).length === 0, "every tool", missing(ALL_TOOLS).join(", "));
ok(missing(ALL_EVENTS).length === 0, "every event", missing(ALL_EVENTS).join(", "));
ok(missing(ALL_NEWSLETTERS).length === 0, "every newsletter, through its first issue", missing(ALL_NEWSLETTERS).join(", "));

console.log("\nevery date says where it came from:");
for (const f of ["lib/tools.js", "lib/events.js"]) {
  const lines = src(f).split("\n").filter((l) => /^\s+launched: "\d/.test(l));
  ok(lines.length > 0 && lines.every((l) => /\/\* .+: ".+" \(checked \d{4}-\d{2}-\d{2}\) \*\//.test(l)), `${f}: source and quote beside each of ${lines.length}`);
  const unknowns = src(f).split("\n").filter((l) => /^\s+launched: "unknown"/.test(l));
  ok(unknowns.every((l) => /checked \d{4}-\d{2}-\d{2}/.test(l)), `${f}: each unknown says when it was looked for`);
}

console.log("\nthe wording:");
ok(L.launchLabel({ launched: "2026-10-08" }, "tool") === "Launched 8 October 2026", "a day", L.launchLabel({ launched: "2026-10-08" }));
ok(L.launchLabel({ launched: "2024-07" }, "tool") === "Launched July 2024", "a month");
ok(L.launchLabel({ started: "2024-07" }, "newsletter") === "First issue July 2024", "a newsletter's first issue, from started");
ok(L.launchLabel({ launched: "2016" }, "event") === "First held 2016", "an event's first edition");
ok(L.launchLabel({ launched: "unknown" }, "tool") === "" && L.launchCell({ launched: "unknown" }) === "Unknown", "unknown: nothing on the facts line, Unknown in a table");
ok(L.launchLabel({}, "tool") === "" && !L.isLaunchValue("2024-13x"), "absent reads as unknown; a malformed value is not a value");

console.log("\nsort and filter:");
const sorted = [{ id: "a", launched: "2017" }, { id: "b", launched: "unknown" }, { id: "c", launched: "2017-05" }, { id: "d", launched: "2026-10-08" }]
  .sort((x, y) => L.launchKey(y).localeCompare(L.launchKey(x))).map((x) => x.id).join("");
ok(sorted === "dacb", "newest first, unknown last, a bare year not ahead of a dated day in it", sorted);
ok(L.launchedWithinYear({ launched: "2026-10-08" }, "2026-10-23") && !L.launchedWithinYear({ launched: "2025" }, "2026-10-23")
  && !L.launchedWithinYear({ launched: "unknown" }, "2026-10-23"), "the last year counts only a known date wholly inside it");
ok(/launched: \{ label: "Newest first"/.test(src("components/Directory.jsx")) && /"launched"\]/.test(src("lib/directoryFilters.js")), "the directory sorts by it, and the URL may name the sort");
ok(/get\("new"\) === "1"/.test(src("lib/directoryFilters.js")) && /Launched in the last year/.test(src("components/DirectoryFilters.jsx")), "and filters by it (?new=1)");
ok(/\["Launched", \(t\) => launchCell\(t\)\]/.test(src("components/Directory.jsx")) && /\["Launched", \(t\) => launchCell\(t\)\]/.test(src("components/Comparisons.jsx")), "both compare tables have a Launched row");

console.log("\nprotected:");
ok(/"launched",\s*\n?\s*\];/.test(listings) || /\n  "launched",\n\];/.test(listings), "launched is in PROTECTED");
ok(/launched: t\.launched/.test(listings), "and restated in mergedTools, so an override cannot set it");

console.log(bad ? `\n${bad} failed` : "\nall passed");
process.exit(bad ? 1 : 0);
