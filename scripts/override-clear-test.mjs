#!/usr/bin/env node
/*
 * Clearing a stored override from the file (lib/overrideClears.js).
 *
 *   node scripts/override-clear-test.mjs
 *
 * Holds that a `clearOverride` marker removes only the named fields, only
 * values set on or before its date, keeps a vendor's later edit, reaches the
 * merged listing at read time, lets a file price beat an older confirmed
 * structure, and that settleClears removes the stored field and logs it once.
 * In-memory store, no server, no keys.
 */
import { readFileSync, writeFileSync, mkdtempSync, readdirSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { pathToFileURL } from "url";

const ROOT = new URL("..", import.meta.url).pathname;
const dir = mkdtempSync(join(tmpdir(), "svt-clear-"));
mkdirSync(join(dir, "lib", "posts"), { recursive: true });
for (const f of readdirSync(join(ROOT, "lib"))) {
  if (!f.endsWith(".js")) continue;
  writeFileSync(join(dir, "lib", f), readFileSync(join(ROOT, "lib", f), "utf8")
    .replace(/(from\s+"\.\/[a-zA-Z0-9/_-]+)"/g, '$1.js"').replace(/import\("\.\/([a-zA-Z0-9]+)"\)/g, 'import("./$1.js")'));
}
for (const f of readdirSync(join(ROOT, "lib", "posts"))) {
  writeFileSync(join(dir, "lib", "posts", f), readFileSync(join(ROOT, "lib", "posts", f), "utf8").replace(/(from\s+"\.\.?\/[a-zA-Z0-9/_-]+)"/g, '$1.js"'));
}
const load = (f) => import(pathToFileURL(join(dir, f)).href);
const C = await load("lib/overrideClears.js");
const store = await load("lib/store.js");
const listings = await load("lib/listings.js");
const { TOOLS } = await load("lib/tools.js");

let bad = 0;
const ok = (c, l, d = "") => { console.log(`  ${c ? "ok  " : "FAIL"}  ${l}${d ? `  ${d}` : ""}`); if (!c) bad += 1; };

console.log("the rule:");
const entry = { id: "x", name: "X", price: "$29", clearOverride: { fields: ["price"], at: "2026-10-31", reason: "a finding was saved as the price" } };
let r = C.clearedOverride(entry, { price: "Pricing no longer includes a $49/mo Starter tier", priceAt: "2026-10-26T09:00:00Z", editedAt: "2026-10-26", one: "kept" });
ok(!("price" in r.override) && !("priceAt" in r.override) && r.override.one === "kept" && r.cleared.join() === "price", "a price set before the marker is cleared, and nothing else is");
r = C.clearedOverride(entry, { price: "$35", priceAt: "2026-11-02T10:00:00Z", editedAt: "2026-11-02" });
ok(r.override.price === "$35" && r.kept.join() === "price", "a vendor's edit after the marker is kept");
r = C.clearedOverride(entry, { price: "$10", priceAt: "2026-10-31T23:00:00Z" });
ok(!("price" in r.override), "a date-only marker covers the whole of its day");
r = C.clearedOverride({ ...entry, clearOverride: { ...entry.clearOverride, reason: "" } }, { price: "$10" });
ok(r.override.price === "$10", "a marker without a reason does nothing");
r = C.clearedOverride({ id: "y", price: "$1" }, { price: "$2" });
ok(r.override.price === "$2", "no marker, nothing cleared: an unrelated commit never overwrites an edit");
ok(C.fileBeatsConfirmed(entry, "2026-10-20T00:00:00Z") && !C.fileBeatsConfirmed(entry, "2026-11-05T00:00:00Z"), "a marked price beats a structure confirmed before the marker, not one confirmed after");

console.log("\nthrough the merge and the store:");
const marked = TOOLS.filter((t) => C.markerOf(t));
ok(marked.length >= 1, "the catalogue carries markers", marked.map((t) => t.id).join(", "));
const t = marked[0];
await store.write("svt:overrides", { [t.id]: { price: "WRONG", priceAt: "2026-10-01T00:00:00Z", editedAt: "2026-10-01", editedBy: "monitor" } });
const merged = (await listings.mergedTools()).find((x) => x.id === t.id);
ok(merged.price === t.price, "the merged listing shows the file's price at read time", merged.price);
const rows = await C.settleClears(TOOLS);
const after = (await store.read("svt:overrides", {}))[t.id];
ok(rows.some((x) => x.toolId === t.id && x.field === "price" && x.value === "WRONG" && x.outcome === "cleared" && x.reason) && !after, "settleClears removes the stored field, drops an empty override, and logs value, reason and who set it");
ok((await C.settleClears(TOOLS)).length === 0 && (await C.readClears()).filter((x) => x.toolId === t.id).length === 1, "a second run logs nothing new");
ok(/overridesCleared/.test(readFileSync(join(ROOT, "lib/inventory.js"), "utf8")), "the log key is in the store inventory");
ok(/settleClears/.test(readFileSync(join(ROOT, "app/admin/page.js"), "utf8")) && /settleClears/.test(readFileSync(join(ROOT, "app/api/cron/notify/route.js"), "utf8")), "it runs on /admin load and in the daily run");
ok(/Overrides cleared from the file/.test(readFileSync(join(ROOT, "components/Admin.jsx"), "utf8")), "and is shown on /admin");

console.log(bad ? `\n${bad} failed` : "\nall passed");
process.exit(bad ? 1 : 0);
