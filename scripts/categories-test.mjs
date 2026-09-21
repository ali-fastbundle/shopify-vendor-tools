#!/usr/bin/env node
/*
 * More than one category, and a page for each.
 *
 *   node scripts/categories-test.mjs
 *
 * `cat` is the primary and stays single, because three things read it as one
 * value: the spine colour, the label under the name, and the "By category"
 * sort. Colour invariant A only holds while a tool has exactly one colour.
 * `alsoIn` is everything else, and the risk it introduces is a tool that is in
 * a category for the filter but not for the count, or on a page but not in its
 * graph. So this checks that every consumer answers the same question the same
 * way, and that the pages themselves render, 404 and carry their metadata.
 *
 * No server and no keys: lib/ is shimmed into a temp directory and the route
 * modules are called directly, which is how the other library tests here run
 * against the in-memory store.
 */

import { readFileSync, writeFileSync, mkdtempSync, readdirSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { pathToFileURL } from "url";

const ROOT = new URL("..", import.meta.url).pathname;
process.env.AUTH_SECRET = "categories-test-secret";

const dir = mkdtempSync(join(tmpdir(), "svt-cats-"));
mkdirSync(join(dir, "lib"));
for (const f of readdirSync(join(ROOT, "lib"))) {
  if (!f.endsWith(".js")) continue;
  writeFileSync(join(dir, "lib", f),
    readFileSync(join(ROOT, "lib", f), "utf8").replace(/(from\s+"\.\/[a-zA-Z]+)"/g, '$1.js"'));
}
const load = (f) => import(pathToFileURL(join(dir, f)).href);
const T = await load("lib/tools.js");
const seo = await load("lib/seo.js");
const { sanitiseEntry } = await load("lib/entries.js");
const { CATEGORIES, catsOf, secondaryCats, isInCat, isPrimaryCat, findCat, catOf, TOOLS } = T;

let bad = 0;
const ok = (c, l, d = "") => {
  console.log(`  ${c ? "ok  " : "FAIL"}  ${l}${d ? `  ${d}` : ""}`);
  if (!c) bad += 1;
};

/* ------------------------------------------------------------------ */
console.log("the helpers:");
ok(catsOf({ cat: "aso" }).join() === "aso", "a tool with no alsoIn is in one category");
ok(catsOf({ cat: "suite", alsoIn: ["biz", "partner"] }).join() === "suite,biz,partner",
  "primary first, then the rest in order");
ok(catsOf({ cat: "suite", alsoIn: ["suite", "biz"] }).join() === "suite,biz",
  "the primary is deduped out of alsoIn");
ok(catsOf({ cat: "suite", alsoIn: ["biz", "biz"] }).join() === "suite,biz",
  "and so are repeats within it");
ok(catsOf({ cat: "suite", alsoIn: ["nonsense"] }).join() === "suite",
  "an unknown id is dropped rather than rendered");
ok(catsOf({ cat: "nonsense" }).length === 0,
  "an unknown primary yields nothing, so nothing pretends to be in a category");
ok(catsOf({}).length === 0 && catsOf().length === 0, "and an empty entry does not throw");
ok(secondaryCats({ cat: "suite", alsoIn: ["biz"] }).join() === "biz", "secondaryCats drops the primary");
ok(secondaryCats({ cat: "aso" }).length === 0, "and is empty for a single-category tool");

const suite = { cat: "suite", alsoIn: ["biz"] };
ok(isInCat(suite, "suite") && isInCat(suite, "biz"), "isInCat is true for both");
ok(!isInCat(suite, "aso"), "and false for one it is not in");
ok(isPrimaryCat(suite, "suite"), "isPrimaryCat is true for the primary");
ok(!isPrimaryCat(suite, "biz"), "and false for a secondary");

console.log("\nthe strict lookup:");
ok(findCat("aso")?.id === "aso", "findCat finds a real category");
ok(findCat("nonsense") === null, "and returns null for a bad id, so a route can 404");
ok(catOf("nonsense").id === CATEGORIES[0].id,
  "catOf still falls back, which is right inside a render and wrong in a route");

/* ------------------------------------------------------------------ */
console.log("\nthe catalogue as written:");
const ids = new Set(CATEGORIES.map((c) => c.id));
ok(new Set(CATEGORIES.map((c) => c.color)).size === CATEGORIES.length,
  "every category has its own colour, or the spine stops identifying one");
ok(CATEGORIES.every((c) => c.blurb && c.label), "every category has a label and a blurb");
ok(ids.has("support"), "the support category exists");

const withAlso = TOOLS.filter((t) => secondaryCats(t).length);
ok(withAlso.length > 0, "some entries are in more than one category",
  withAlso.map((t) => `${t.id} -> ${secondaryCats(t).join("+")}`).join(", "));
for (const t of TOOLS) {
  const declared = Array.isArray(t.alsoIn) ? t.alsoIn : [];
  const kept = secondaryCats(t);
  ok(declared.length === kept.length,
    `${t.id}: every declared secondary category is a real one`,
    declared.filter((c) => !ids.has(c)).join(", "));
  ok(!declared.includes(t.cat), `${t.id}: does not list its primary twice`);
}

/* The colour twin. Setting a hue without it degrades to the dark value on the
   light theme, which is the one failure ink() is designed to hide and so the
   one nothing would report. */
console.log("\nthe light-theme twins:");
const css = readFileSync(join(ROOT, "app/globals.css"), "utf8");
for (const c of CATEGORIES) {
  const key = `--ink-${c.color.replace("#", "").toLowerCase()}`;
  const hits = css.split(key).length - 1;
  ok(hits === 2, `${c.label} has an ink pair in both theme blocks`, `${hits} of 2`);
}

/* ------------------------------------------------------------------ */
console.log("\nmembership, counts and pages:");
let totalMemberships = 0;
for (const c of CATEGORIES) {
  const members = seo.categoryMembers(c.id, TOOLS);
  const inIt = TOOLS.filter((t) => isInCat(t, c.id));
  totalMemberships += members.length;
  ok(members.length === inIt.length, `${c.label}: the page lists everything in the category`,
    `${members.length}`);
  /* Primary members first, and each marked. A page that mixed them would make
     "is this what it is, or something it also does" unanswerable. */
  const flags = members.map((m) => m.primary);
  ok(flags.indexOf(false) === -1 || !flags.slice(flags.indexOf(false)).includes(true),
    `${c.label}: primary members come first`);
  ok(members.every(({ tool, primary }) => primary === isPrimaryCat(tool, c.id)),
    `${c.label}: each member is marked correctly`);
}
const counts = seo.categoryCounts(TOOLS);
ok(counts.length === CATEGORIES.length, "every category is on the index");
ok(counts.reduce((n, x) => n + x.total, 0) === totalMemberships,
  "the index counts agree with the pages", `${totalMemberships}`);
ok(counts.reduce((n, x) => n + x.primary, 0) === TOOLS.length,
  "and the primary counts add up to the catalogue exactly once",
  `${counts.reduce((n, x) => n + x.primary, 0)} of ${TOOLS.length}`);
ok(counts.every((x) => x.total >= x.primary),
  "a category's total is never below its primary count");

console.log("\nrelated categories:");
for (const c of CATEGORIES) {
  const rel = seo.relatedCategories(c.id, TOOLS);
  ok(rel.length > 0, `${c.label} links to others, so the page is not a dead end`);
  ok(!rel.some((r) => r.cat.id === c.id), `${c.label} does not link to itself`);
  ok(rel.every((r) => r.why), `${c.label}'s links say why they are related`);
}
{
  /* Overlap first: the suites share tools with billing, so billing should be
     named ahead of a category sharing nothing. */
  const rel = seo.relatedCategories("suite", TOOLS);
  ok(rel[0].shared > 0, "a category that shares tools is ranked first",
    `${rel[0].cat.label}, ${rel[0].shared} shared`);
}

console.log("\nmetadata and graphs:");
for (const c of CATEGORIES) {
  const members = seo.categoryMembers(c.id, TOOLS);
  const desc = seo.categoryDescription(c, members.length);
  ok(desc.length > 40 && desc.length <= 300, `${c.label}: description is its own and fits`,
    `${desc.length} chars`);
  ok(!desc.includes("—"), `${c.label}: no em-dash in anything a visitor reads`);

  const g = seo.categoryGraph(c, members);
  const page = g["@graph"].find((x) => x["@type"] === "CollectionPage");
  ok(page.url === `https://watchfor.tools/categories/${c.id}`, `${c.label}: canonical url`);
  ok(page.mainEntity.numberOfItems === members.length, `${c.label}: ItemList count matches`);
  ok(page.breadcrumb.itemListElement.length === 3, `${c.label}: breadcrumb is three deep`);
  /*
   * Invariant 29: an aggregateRating only where a review exists, and no offers
   * key rather than a priceless Offer. Nothing here was reviewed, so neither
   * should appear anywhere in the graph.
   */
  const items = page.mainEntity.itemListElement.map((x) => x.item);
  ok(items.every((i) => !("aggregateRating" in i)),
    `${c.label}: no rating is claimed where none exists`);
  ok(items.every((i) => !("offers" in i) || i.offers.price != null || i.offers.lowPrice != null),
    `${c.label}: no offer is emitted without a price`);
}
{
  const g = seo.categoriesGraph(counts);
  const page = g["@graph"].find((x) => x["@type"] === "CollectionPage");
  ok(page.url === "https://watchfor.tools/categories", "the index graph has its own url");
  ok(page.mainEntity.numberOfItems === CATEGORIES.length, "and lists every category");
}

/* ------------------------------------------------------------------ */
console.log("\nthe entry sanitiser:");
const base = {
  name: "Test Tool", url: "https://test.invalid", one: "A tool.", note: "It does a thing.",
  watch: "Pricing is not published.",
};
{
  const { entry } = sanitiseEntry({ ...base, cat: "aso", alsoIn: ["biz", "partner"] });
  ok(entry.alsoIn.join() === "biz,partner", "valid secondary categories survive");
}
{
  const { entry } = sanitiseEntry({ ...base, cat: "aso", alsoIn: ["aso", "biz", "biz", "nope"] });
  ok(entry.alsoIn.join() === "biz", "the primary, repeats and unknowns are all dropped");
}
{
  const { entry } = sanitiseEntry({ ...base, cat: "aso" });
  ok(!("alsoIn" in entry), "absent rather than an empty array, so the field stays optional");
}
{
  const { entry } = sanitiseEntry({ ...base, cat: "aso", alsoIn: "biz" });
  ok(!("alsoIn" in entry), "a string instead of an array is ignored rather than split");
}
{
  const { entry } = sanitiseEntry({
    ...base, cat: "aso", alsoIn: CATEGORIES.map((c) => c.id),
  });
  ok(entry.alsoIn.length <= 4, "and it cannot file itself into the whole directory",
    `${entry.alsoIn.length}`);
}
{
  const { entry } = sanitiseEntry({ ...base, cat: "aso", editorInterest: true });
  ok(entry.editorInterest === undefined,
    "editorInterest can never arrive over HTTP, in either direction");
}

/* ------------------------------------------------------------------ */
console.log("\nthe surfaces:");
for (const [file, what] of [
  ["components/Directory.jsx", "the grid filter and the counts"],
  ["components/ToolPage.jsx", "the tool page"],
  ["app/llms.txt/route.js", "llms.txt"],
  ["app/sitemap.js", "the sitemap"],
]) {
  const src = readFileSync(join(ROOT, file), "utf8");
  ok(/isInCat|isPrimaryCat|secondaryCats|catsOf/.test(src),
    `${what} reads the helpers rather than t.cat`, file);
}
{
  const src = readFileSync(join(ROOT, "components/Directory.jsx"), "utf8");
  ok(/href=\{`\/categories\/\$\{tool\.cat\}`\}/.test(src),
    "the card's category label is a real link to the category page");
  ok(/cat === "all" \|\| isInCat\(t, cat\)/.test(src),
    "the grid filters on every category, not on the primary alone");
}
{
  const src = readFileSync(join(ROOT, "app/sitemap.js"), "utf8");
  ok(/\/categories\/\$\{c\.id\}/.test(src) && /\/categories`/.test(src),
    "the sitemap carries the index and every category");
}
{
  const src = readFileSync(join(ROOT, "app/categories/[id]/page.js"), "utf8");
  ok(/findCat/.test(src) && /notFound\(\)/.test(src),
    "a bad category id 404s rather than serving the first category");
  ok(/alternates: \{ canonical/.test(src), "and the page declares its canonical");
}

/* ------------------------------------------------------------------ */
/*
 * Related tools, which is where half-built multi-category showed itself.
 *
 * The third tier used to be "the rest of the catalogue" labelled "also
 * listed", sliced to fill eight rows, so a Support & CX page with two siblings
 * rendered those two and then six App Store ASO tools. The label was true of
 * every entry in the directory and therefore said nothing.
 */
console.log("\nrelated tools:");
{
  /* "" is a real answer: the row's own category label already said it. */
  const LABELS = ["named as a direct competitor", "same owner", ""];
  const isCatLabel = (w) => /^both in /.test(w);
  let padded = 0;
  for (const t of TOOLS) {
    const rel = seo.relatedTools(t, TOOLS);
    for (const { tool: r, why } of rel) {
      if (!LABELS.includes(why) && !isCatLabel(why)) {
        ok(false, `${t.name} -> ${r.name}: unrecognised label`, why); continue;
      }
      /* The assertion that matters: every row is related for a stated reason
         that is actually true of the pair, rather than filling a slot. */
      const related = (isCatLabel(why) || why === "")
        ? catsOf(t).some((id) => isInCat(r, id))
        : why === "same owner"
          ? Boolean((t.linked && (r.name === t.linked || r.linked === t.name))
            || (t.suite && r.suite === t.suite)
            || (T.ownerOf(t) && T.ownerOf(r) === T.ownerOf(t)))
          : (t.competes || []).includes(r.id) || (r.competes || []).includes(t.id);
      if (!related) { ok(false, `${t.name} -> ${r.name} is not actually ${why}`); padded += 1; }
      if (isCatLabel(why)) {
        const named = why.replace("both in ", "");
        const cat = CATEGORIES.find((c) => c.label === named);
        if (!cat || !isInCat(t, cat.id) || !isInCat(r, cat.id)) {
          ok(false, `${t.name} -> ${r.name}: label names ${named}, which they are not both in`);
        }
      }
    }
  }
  ok(padded === 0, "no row is padding: every one is related for the reason it states");
  ok(!JSON.stringify(TOOLS.map((t) => seo.relatedTools(t, TOOLS))).includes("also listed"),
    'the meaningless "also listed" tier is gone');

  /* Fewer than three genuine matches shows fewer, rather than reaching. */
  const support = TOOLS.filter((t) => isInCat(t, "support"));
  const apricot = TOOLS.find((t) => t.id === "apricotcx");
  const rel = seo.relatedTools(apricot, TOOLS);
  ok(rel.length === support.length - 1,
    "a thin category shows only its real siblings rather than filling eight rows",
    `${rel.length} rows for ${support.length} support tools`);
  ok(rel.every(({ tool: r }) => isInCat(r, "support")),
    "and every one of them is actually in the category");

  /* A dying tool never leads a list, same rule as every order in the grid. */
  for (const t of TOOLS) {
    const rel = seo.relatedTools(t, TOOLS);
    const firstDying = rel.findIndex(({ tool: r }) => r.dying);
    if (firstDying >= 0) {
      ok(rel.slice(firstDying).every(({ tool: r, why }) =>
        r.dying || why !== rel[firstDying].why),
      `${t.name}: a wind-down does not lead its tier`);
    }
  }

  /* The competitor tier is the only one that may cross a category, and the
     whole reason it exists. Mantle is the case. */
  const mantle = TOOLS.find((t) => t.id === "mantle");
  const mrel = seo.relatedTools(mantle, TOOLS);
  ok(mrel.filter((r) => r.why === "named as a direct competitor").length >= 5,
    "Mantle links to its replacements", `${mrel.filter((r) => r.why === "named as a direct competitor").length}`);
  const crossCat = mrel.filter((r) => r.why === "named as a direct competitor"
    && !catsOf(r.tool).some((id) => isInCat(mantle, id)));
  ok(crossCat.length > 0,
    "including ones sharing no category at all, which overlap cannot find",
    crossCat.map((r) => r.tool.name).join(", "));
  for (const id of mantle.competes) {
    const back = seo.relatedTools(TOOLS.find((t) => t.id === id), TOOLS);
    ok(back.some(({ tool: r }) => r.id === "mantle"),
      `${id} links back to Mantle, so one declaration wires both pages`);
  }
}

console.log("\nevery competes id is real:");
{
  const ids = new Set(TOOLS.map((t) => t.id));
  for (const t of TOOLS) {
    for (const id of t.competes || []) {
      /* A typo here fails silently: the pair simply never links. */
      ok(ids.has(id), `${t.name} names "${id}"`, ids.has(id) ? "" : "no such tool");
      ok(id !== t.id, `${t.name} does not name itself`);
    }
  }
  ok(TOOLS.every((t) => t.competes === undefined || Array.isArray(t.competes)),
    "competes is always an array where present");
}

console.log("\nthe secondary categories, as assessed:");
{
  const by = Object.fromEntries(TOOLS.map((t) => [t.id, secondaryCats(t)]));
  const expect = {
    marmeto: ["biz", "partner"], meridian: ["biz", "aso"], bestappify: ["data"],
    appstorepulse: ["biz"], ranksy: ["biz"], saasinsights: ["aso"],
    letsmetrix: ["detect"], applora: ["aso"], ppspy: ["storedb"], elevate: ["partner"],
  };
  for (const [id, cats] of Object.entries(expect)) {
    ok(JSON.stringify(by[id]) === JSON.stringify(cats),
      `${id} spans ${cats.join(" + ")}`, `got ${JSON.stringify(by[id])}`);
  }
  /* Removed on assessment: you cannot hire a research participant. */
  ok(by.appstoreresearch.length === 0,
    "App Store Research is not filed under Talent & services");
  /* A wind-down is deliberately not multiplied across the directory. */
  ok(TOOLS.filter((t) => t.dying).every((t) => secondaryCats(t).length === 0),
    "no dying tool carries a secondary category");
}

console.log(`\n${bad ? `${bad} FAILED` : "all passed"}`);
process.exit(bad ? 1 : 0);
