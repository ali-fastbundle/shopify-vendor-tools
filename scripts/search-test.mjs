#!/usr/bin/env node
/*
 * Search across every section (lib/universalSearch.js, /search).
 *
 *   node scripts/search-test.mjs
 *
 * What it holds: one query finds tools, newsletters, events, posts, owners and
 * categories alike; past events are results, labelled as past, never dropped;
 * drafts are never results; every word must match; and the sidebar, the
 * section searches and the directory all lead to /search. Runs against a
 * temp copy of lib/ with a fixed "today", like the other library tests.
 */
import { mkdtempSync, readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = mkdtempSync(join(tmpdir(), "svt-search-"));
const copy = (sub) => {
  mkdirSync(join(dir, sub), { recursive: true });
  for (const f of readdirSync(join(root, "lib", sub)).filter((x) => x.endsWith(".js"))) {
    const src = readFileSync(join(root, "lib", sub, f), "utf8").replace(/from "(\.\.?\/[\w/.-]+)"/g, 'from "$1.mjs"');
    writeFileSync(join(dir, sub, f.replace(/\.js$/, ".mjs")), src);
  }
};
copy(""); copy("posts");

const { searchAll, summaryLine, cleanQuery } = await import(join(dir, "universalSearch.mjs"));
const { TOOLS, ALL_TOOLS } = await import(join(dir, "tools.mjs"));
const { NEWSLETTERS } = await import(join(dir, "newsletters.mjs"));
const { EVENTS, ALL_EVENTS } = await import(join(dir, "events.mjs"));

let bad = 0;
const ok = (c, l, d = "") => {
  console.log(`  ${c ? "ok  " : "FAIL"}  ${l}${d ? `  ${d}` : ""}`);
  if (!c) bad += 1;
};
const T = "2026-10-21";
const lists = { tools: TOOLS, newsletters: NEWSLETTERS, events: EVENTS };
const run = (q) => searchAll(q, lists, T);
const kinds = (r) => r.groups.map((g) => g.kind);
const ids = (r, kind) => (r.groups.find((g) => g.kind === kind)?.items || []).map((x) => x.id);

console.log("across sections:");
const shop = run("shopify");
ok(["tool", "newsletter", "event", "owner"].every((k) => kinds(shop).includes(k)), "one query reaches tools, newsletters, events and owners", kinds(shop).join(","));
ok(ids(run("warsaw"), "event").length >= 2, "a city finds its events");
ok(ids(run("aso"), "category").includes("aso"), "a category is a result");
ok(run("aso tools compared").groups.some((g) => g.kind === "post"), "a blog post is a result");
ok(ids(run("retail bulletin"), "newsletter").includes("retailbulletin"), "a newsletter by name");

console.log("\npast events:");
const unite = run("unite");
const u = unite.groups.find((g) => g.kind === "event")?.items.find((x) => x.id === "shopify-unite");
ok(Boolean(u), "a discontinued event is still found");
ok(u && u.past && /last held|discontinued/i.test(u.meta), "and is labelled as ended", u?.meta);
const evs = run("shopify").groups.find((g) => g.kind === "event").items;
const firstPast = evs.findIndex((x) => x.past);
ok(firstPast > 0 && evs.slice(firstPast).every((x) => x.past), "upcoming events come before past ones, and the past ones are there",
  `${firstPast} ahead, ${evs.length - firstPast} past`);
const pastDates = evs.filter((x) => x.past).map((x) => x.date);
ok(pastDates.every((d, i) => i === 0 || String(pastDates[i - 1]) >= String(d)), "past events newest first");

console.log("\nrules:");
ok(run("warsaw zzzqqq").total === 0, "every word has to match");
ok(run("WARSAW").total === run("warsaw").total, "case does not matter");
ok(run("a").total === 0 && run("").total === 0, "under two characters returns nothing");
ok(cleanQuery("x".repeat(500)).length === 100, "the query is capped");
const draftTools = ALL_TOOLS.filter((t) => t.draft);
const draftEvents = ALL_EVENTS.filter((e) => e.draft);
ok([...draftTools, ...draftEvents].every((d) => run(d.name).groups.every((g) => !g.items.some((x) => x.id === d.id))),
  "a draft is never a result", `${draftTools.length + draftEvents.length} drafts checked`);
ok(summaryLine(run("warsaw")).startsWith(`${run("warsaw").total} results:`), "the summary counts what is shown", summaryLine(run("warsaw")));
const dying = run("mantle").groups.find((g) => g.kind === "tool")?.items || [];
const firstDying = dying.findIndex((x) => x.dying);
ok(firstDying === -1 || dying.slice(firstDying).every((x) => x.dying), "a tool winding down sorts last");

console.log("\nthe ways in:");
const frame = readFileSync(join(root, "components/SiteFrame.jsx"), "utf8");
ok(/\/search\?q=/.test(frame), "the sidebar box goes to /search");
ok(!/SEARCH_HERE|setDirectoryFilters\(\{ q/.test(frame), "on every page: no section filters in place from the box");
const conf = readFileSync(join(root, "next.config.mjs"), "utf8");
ok(/redirects\(\)/.test(conf) && /"\/", "\/newsletters", "\/events"/.test(conf) && /destination: "\/search"/.test(conf),
  "an old ?q= link on the directory, newsletters or events goes to /search");
const page = readFileSync(join(root, "app/search/page.js"), "utf8");
ok(!/"use client"/.test(page) && /method="get"/.test(page), "the page is server-rendered with a plain GET form");
ok(/index: false/.test(page), "search pages are noindex");
ok(!/askJson|lib\/model/.test(readFileSync(join(root, "lib/universalSearch.js"), "utf8")), "no model call");

console.log(bad ? `\n${bad} failed` : "\nall passed");
process.exit(bad ? 1 : 0);
