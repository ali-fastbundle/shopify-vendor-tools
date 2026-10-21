#!/usr/bin/env node
/*
 * One public tool count, stated the same everywhere.
 *
 *   node scripts/tool-count-test.mjs              # the rule and the wiring
 *   node scripts/tool-count-test.mjs <baseUrl>    # and every surface agrees, live
 *
 * The sidebar once said 54 while the directory heading said 56: one counted
 * lib/tools.js, the other the file plus entries published from the admin
 * queue. The share card had the same split before lib/ogCard.js. So this
 * holds three things:
 *
 *  - what the count means (countTools in lib/toolCount.js): published,
 *    non-draft, once per id however many categories, dying tools included;
 *  - that every surface that states a tool count gets it from countTools and
 *    computes none of its own;
 *  - with a base URL, that the sidebar, the directory heading, the share card,
 *    /categories and llms.txt report the same total and the same count per
 *    category, read from the pages themselves.
 */
import { mkdtempSync, readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = mkdtempSync(join(tmpdir(), "svt-count-"));
const copy = (sub) => {
  mkdirSync(join(dir, sub), { recursive: true });
  for (const f of readdirSync(join(root, "lib", sub)).filter((x) => x.endsWith(".js"))) {
    const src = readFileSync(join(root, "lib", sub, f), "utf8").replace(/from "(\.\.?\/[\w/.-]+)"/g, 'from "$1.mjs"');
    writeFileSync(join(dir, sub, f.replace(/\.js$/, ".mjs")), src);
  }
};
copy(""); copy("posts");
const { countTools } = await import(join(dir, "toolCount.mjs"));
const { TOOLS, ALL_TOOLS, CATEGORIES } = await import(join(dir, "tools.mjs"));

let bad = 0;
const ok = (c, l, d = "") => {
  console.log(`  ${c ? "ok  " : "FAIL"}  ${l}${d ? `  ${d}` : ""}`);
  if (!c) bad += 1;
};
const src = (p) => readFileSync(join(root, p), "utf8");

console.log("what the count means:");
const n = countTools(ALL_TOOLS);
ok(n.total === TOOLS.length, "drafts are not counted", `${ALL_TOOLS.length} written, ${n.total} counted`);
ok(countTools([...TOOLS, ...TOOLS.slice(0, 3)]).total === TOOLS.length, "an id counts once, even when it arrives twice (file and queue)");
const multi = TOOLS.find((t) => (t.alsoIn || []).length);
ok(Boolean(multi) && countTools([multi]).total === 1 && Object.values(countTools([multi]).byCategory).reduce((a, b) => a + b, 0) > 1,
  "a tool in several categories is one tool, and is in each category's count", multi?.id);
ok(CATEGORIES.reduce((a, c) => a + n.primaryByCategory[c.id], 0) === n.total, "primary counts add up to the total exactly once");
const dying = TOOLS.filter((t) => t.dying);
ok(dying.length === 0 || countTools(dying).total === dying.length, "a tool winding down still counts", `${dying.length} dying`);
const extra = { id: "queue-only", name: "Queue Only", cat: CATEGORIES[0].id, one: "x", note: "x", tags: [] };
ok(countTools([...TOOLS, extra]).total === TOOLS.length + 1, "an entry published from the queue counts");
ok(n.order.length === CATEGORIES.length && n.order.every((id, i, a) => i === 0 || n.byCategory[a[i - 1]] >= n.byCategory[id]),
  "categories are ordered by their count");

console.log("\nevery surface counts with countTools:");
const surfaces = {
  "lib/frameData.js": "the sidebar and its categories",
  "app/layout.js": "the sidebar's input",
  "app/page.js": "the directory heading",
  "lib/ogCard.js": "the share card",
  "lib/seo.js": "/categories",
  "app/llms.txt/route.js": "llms.txt",
  "lib/announcements.js": "the announcement figures",
};
for (const [p, what] of Object.entries(surfaces)) {
  ok(/countTools|toolCounts/.test(src(p)), `${what} (${p})`);
}
ok(!/TOOLS\.length|isInCat\(t, c\.id\)\)\.length/.test(src("lib/frameData.js")), "the sidebar computes no count of its own");
ok(!/catalogueTools\(\)\)\.length/.test(src("lib/ogCard.js")) && /countTools\(/.test(src("lib/ogCard.js")), "the share card computes no count of its own");
ok(!/\$\{tools\.length\} tools|of \$\{tools\.length\} tools/.test(src("components/Directory.jsx")), "the heading states the passed total, not the length of its own list");
ok(!/\$\{tools\.length\} tools listed|tools\.filter\(\(t\) => isInCat\(t, c\.id\)\)\.length/.test(src("app/llms.txt/route.js")), "llms.txt computes no count of its own");
ok(/toolsChanged\(\)/.test(src("app/api/admin/route.js")), "publishing or unpublishing a queue entry drops the cached count");
ok(/VERCEL_GIT_COMMIT_SHA/.test(src("lib/toolCountStore.js")), "the cached count is keyed on the build, so a file publish is not shadowed");

const base = process.argv[2];
if (base) {
  console.log(`\nlive, ${base}:`);
  const get = async (p) => { const r = await fetch(base + p, { signal: AbortSignal.timeout(30_000) }); return { r, t: await r.text() }; };
  const strip = (s) => s.replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&");
  const after = (html, needle) => {
    const i = html.indexOf(needle);
    if (i < 0) return null;
    /* From the end of the link's own tag, so its attributes (a 16px font
       size) are not read as the count. */
    const from = html.indexOf(">", i) + 1;
    return Number((strip(html.slice(from, from + 700)).match(/\d+/) || [])[0]);
  };
  const home = (await get("/")).t;
  const sidebar = Number((home.match(/Directory<\/span><span class="side-count">(\d+)/) || [])[1]);
  const heading = Number((home.match(/(\d+) tools for Shopify app builders/) || [])[1]);
  const llms = (await get("/llms.txt")).t;
  const llmsTotal = Number((llms.match(/(\d+) tools listed/) || [])[1]);
  const og = await fetch(`${base}/og`, { signal: AbortSignal.timeout(30_000) });
  const card = Number(og.headers.get("x-og-tools"));
  const totals = { sidebar, heading, card, llms: llmsTotal };
  ok(Object.values(totals).every((v) => Number.isFinite(v) && v > 0), "every surface states a total", JSON.stringify(totals));
  ok(new Set(Object.values(totals)).size === 1, "and they are the same number", JSON.stringify(totals));

  const cats = (await get("/categories")).t;
  const disagree = [];
  for (const c of CATEGORIES) {
    const side = after(home, `href="/?cat=${c.id}"`);
    const index = after(cats, `href="/categories/${c.id}"`);
    const text = Number((llms.match(new RegExp(`categories/${c.id}, (\\d+)\\)`)) || [])[1]);
    if (!(side === index && index === text)) disagree.push(`${c.id}: sidebar ${side}, /categories ${index}, llms ${text}`);
  }
  ok(disagree.length === 0, "every category's count agrees across the sidebar, /categories and llms.txt", disagree.join("; "));
}

console.log(bad ? `\n${bad} failed` : "\nall passed");
process.exit(bad ? 1 : 0);
