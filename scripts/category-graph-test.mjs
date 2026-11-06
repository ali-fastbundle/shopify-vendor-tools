#!/usr/bin/env node
/*
 * The category overlap map on /categories (2026-11-06):
 *   node scripts/category-graph-test.mjs
 *  - the list is the content: server-rendered and before the map; the map is
 *    a client island with its heading and counted sentence in server HTML
 *  - d3-force is pinned to an exact version and bundled, never a CDN script
 *  - reduced motion draws a settled layout; nothing else moves on its own
 *  - keyboard: every node is a link with a visible focus ring; focus highlights
 *  - hidden below 900px with a line saying so
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = (f) => readFileSync(join(root, f), "utf8");
let failed = 0;
const ok = (c, what) => { console.log(`  ${c ? "ok  " : "FAIL"}  ${what}`); if (!c) failed++; };

const idx = src("components/Categories.jsx"), graph = src("components/CategoryGraph.jsx"), page = src("app/categories/page.js");
const css = src("app/globals.css"), pkg = JSON.parse(src("package.json"));
ok(!/"use client"/.test(idx) && idx.indexOf("counts.map") < idx.indexOf("<CategoryGraph"), "the category list is server HTML and comes before the map");
ok(/"use client"/.test(graph) && /How the categories overlap/.test(idx) && /graph\.bridging\} of \{graph\.tools\.length\}/.test(idx), "the map is a client island under a server heading and counted sentence");
ok(pkg.dependencies["d3-force"] === "3.0.0", "d3-force is pinned to exactly 3.0.0");
ok(/from "d3-force"/.test(graph) && !/<script|cdnjs|jsdelivr|unpkg/.test(graph + idx + page), "it is bundled and served from this site, never loaded from a CDN");
ok(/prefers-reduced-motion: reduce/.test(graph) && /sim\.stop\(\); for \(let i = 0; i < 400; i\+\+\) sim\.tick\(\); snap\(\)/.test(graph), "reduced motion: the layout is computed first and drawn settled");
ok(/<a key=\{n\.id\} href=\{n\.href\} className="cg-node"/.test(graph) && /onFocus=\{\(\) => setActive\(n\.id\)\}/.test(graph) && /\.cg-node:focus-visible circle/.test(css), "every node is a keyboard link with a focus ring, and focus highlights like hover");
ok(/\.cat-graph \{ display: none; \}/.test(css) && /The map is on wider screens/.test(idx), "hidden below 900px, with a line that says so");
ok(/href: `\/categories\/\$\{c\.id\}`/.test(graph) && /href: `\/tools\/\$\{t\.id\}`/.test(graph), "a node opens its own page");
console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
