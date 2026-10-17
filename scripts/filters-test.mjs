#!/usr/bin/env node
/*
 * The directory's filters: category chips stay on the page as navigation,
 * every refinement sits behind one Filters control and is a removable chip
 * when on, the state is in the URL and read by the server, and categories are
 * ordered by how many tools are in them, computed.
 *
 *   node scripts/filters-test.mjs
 */
import { readFileSync, writeFileSync, mkdtempSync, readdirSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { pathToFileURL } from "url";

const ROOT = new URL("..", import.meta.url).pathname;
const dir = mkdtempSync(join(tmpdir(), "svt-filters-"));
mkdirSync(join(dir, "lib"));
for (const f of readdirSync(join(ROOT, "lib"))) {
  if (!f.endsWith(".js")) continue;
  writeFileSync(join(dir, "lib", f),
    readFileSync(join(ROOT, "lib", f), "utf8").replace(/(from\s+"\.\/[a-zA-Z_-]+)"/g, '$1.js"')
      .replace(/import\("\.\/([a-zA-Z]+)"\)/g, 'import("./$1.js")'));
}
const load = (f) => import(pathToFileURL(join(dir, f)).href);
const DF = await load("lib/directoryFilters.js");
const T = await load("lib/tools.js");
const CATS = await load("lib/categories.js");

let bad = 0;
const ok = (c, l, d = "") => { console.log(`  ${c ? "ok  " : "FAIL"}  ${l}${d ? `  ${d}` : ""}`); if (!c) bad += 1; };
const src = (f) => readFileSync(join(ROOT, f), "utf8");

console.log("the address:");
{
  const cat = T.CATEGORIES.find((c) => CATS.attributesFor(c.id).some((a) => a.type === "boolean"));
  const attr = CATS.attributesFor(cat.id).find((a) => a.type === "boolean").key;
  const int = CATS.INTEGRATIONS.slice(0, 2).map((i) => i.id);
  const f = { ...DF.DEFAULT_FILTERS, cat: cat.id, q: "rank", free: true, used: true, int, has: [attr], sort: "price", view: "list" };
  const q = DF.toQuery(f);
  const back = DF.parseFilters(new URLSearchParams(q.slice(1)));
  ok(JSON.stringify(back) === JSON.stringify(f), "a state survives the round trip through the URL", q);
  ok(DF.toQuery(DF.DEFAULT_FILTERS) === "", "the default state is the bare homepage");
  const junk = DF.parseFilters({ cat: "nonsense", int: "ga4,<script>,nope", has: "x", sort: "drop table", view: "tiles", free: "yes" });
  ok(junk.cat === "all" && junk.sort === "rating" && junk.view === "grid" && !junk.free && !junk.has.length
    && junk.int.every((i) => CATS.INTEGRATIONS.some((x) => x.id === i)), "anything that does not exist is dropped, not trusted");
  ok(DF.parseFilters({ has: attr }).has.length === 0, "a detail without its category is dropped");
  ok(DF.activeCount(f) === 2 + int.length + 1, "the count is refinements only, not category, search or sort");
}

console.log("\npasses:");
{
  const used = () => true, unused = () => false;
  const t = { id: "a", cat: "aso", free: true, structured: { integrations: ["slack"] } };
  ok(DF.passes(t, { free: true, int: [], has: [] }, used), "free plan");
  ok(!DF.passes({ ...t, free: false }, { free: true, int: [], has: [] }, used), "not free is out");
  ok(!DF.passes(t, { used: true, int: [], has: [] }, unused), "editor used reads the editor-use store");
  ok(DF.passes(t, { int: ["ga4", "slack"], has: [] }, used) && !DF.passes(t, { int: ["ga4"], has: [] }, used), "integrations match any of those picked");
}

console.log("\nsort keys agree:");
{
  const block = src("components/Directory.jsx").match(/const SORTS = \{([\s\S]*?)\n\};/)[1];
  const keys = [...block.matchAll(/^  ([a-z]+): \{/gm)].map((m) => m[1]);
  ok(JSON.stringify(keys) === JSON.stringify(DF.SORT_KEYS), "SORT_KEYS matches SORTS in Directory.jsx", keys.join(","));
}

console.log("\ncategory order:");
{
  const ordered = T.categoriesByCount(T.TOOLS);
  const n = (c) => T.TOOLS.filter((t) => T.isInCat(t, c.id)).length;
  ok(ordered.length === T.CATEGORIES.length, "every category is still there");
  ok(ordered.every((c, i) => i === 0 || n(ordered[i - 1]) >= n(c)), "largest first", ordered.map((c) => `${c.id}:${n(c)}`).join(" "));
  const extra = [...T.TOOLS, ...Array.from({ length: 40 }, (_, i) => ({ id: `x${i}`, cat: T.CATEGORIES.at(-1).id }))];
  ok(T.categoriesByCount(extra)[0].id === T.CATEGORIES.at(-1).id, "computed, so a category defined last rises when it grows");
  const frame = src("components/SiteFrame.jsx"), layout = src("app/layout.js");
  ok(/categories: categoriesByCount\(TOOLS\)/.test(layout) && /categories\.map\(\(c\) =>/.test(frame), "the sidebar lists categories in that order");
  ok(frame.indexOf("<span>All</span>") > -1 && frame.indexOf("<span>All</span>") < frame.indexOf("categories.map((c) =>"), "with All first");
  ok(/categoriesByCount\(/.test(src("lib/seo.js")), "the /categories index uses the same order");
  ok(/categoriesByCount\(tools\)/.test(src("app/llms.txt/route.js")), "and llms.txt");
}

console.log("\nthe sidebar and the URL:");
{
  const d = src("components/Directory.jsx");
  const frame = src("components/SiteFrame.jsx");
  const p = src("components/DirectoryFilters.jsx");
  const lp = src("components/ListingParams.jsx");
  ok(/<FilterGroups/.test(frame) && /<ActiveFilters/.test(frame), "the filters and their chips are in the sidebar, open");
  ok(!/FiltersButton|filters-panel/.test(d + frame + p + src("app/globals.css")), "no Filters button, no popover: the sidebar is the room it compensated for");
  ok(/f\.free/.test(p) && /f\.used/.test(p) && /"int"/.test(p) && /"has"/.test(p), "free, editor, integrations and details");
  ok(/Clear all/.test(p), "Clear all");
  ok(!/<select[^>]*sort|ViewToggle/.test(frame), "sort and grid/list stay with the grid, not in the sidebar");
  ok(/useDirectoryFilters\(initialFilters\)/.test(d) && /setDirectoryFilters\(/.test(frame), "the grid reads the URL; the sidebar writes it");
  ok(/replaceState\(null, ""/.test(lp) && !/replaceState\(window\.history\.state/.test(lp + d + frame),
    "replaceState with null, which Next follows (with its own state it skips the router)");
  ok(/initialFilters=\{parseFilters\(searchParams/.test(src("app/page.js")), "the server reads the URL, so a shared link renders filtered");
  ok(/canonical: "\/"/.test(src("app/layout.js")), "a filtered view canonicalises to the homepage");
}

console.log(bad ? `\n${bad} failed` : "\nall passed");
process.exit(bad ? 1 : 0);
