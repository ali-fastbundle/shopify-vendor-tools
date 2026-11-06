#!/usr/bin/env node
/*
 * The stop-slop pass over every public page (2026-11-06), as a report.
 *
 *   node scripts/slop-scan.mjs            # every hit, grouped by where
 *   node scripts/slop-scan.mjs --summary  # counts only
 *   node scripts/slop-scan.mjs --strict   # exit 1 on any hit (for CI later)
 *
 * Reads what a visitor reads: every published catalogue entry's prose, the
 * category and section blurbs, the counted-copy files, the blog, and the
 * visible text in pages and components (JSX text and quoted sentences). It
 * runs `voiceIssues` from lib/voice.js on each, the same check the admin
 * panels show, so the scan and the panels cannot disagree.
 *
 * Not read: components/Admin.jsx (behind auth, CLAUDE.md "Dashes and dots"),
 * and /about's prose, which is Ali's own text kept verbatim (lib/aboutText.js).
 * It flags; it never rewrites, because each pattern has a legitimate use.
 */
import { register } from "node:module";
import { join, dirname, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readFileSync, readdirSync, statSync } from "node:fs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const hook = `
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
const ROOT = ${JSON.stringify(pathToFileURL(root + "/").href)};
export async function resolve(spec, ctx, next) {
  let target = null;
  if (spec.startsWith("@/")) target = new URL(spec.slice(2), ROOT).href;
  else if ((spec.startsWith("./") || spec.startsWith("../")) && ctx.parentURL) target = new URL(spec, ctx.parentURL).href;
  if (target && !/\\.[mc]?jsx?$/.test(target)) {
    for (const ext of [".js", ".jsx"]) if (existsSync(fileURLToPath(target + ext))) return next(target + ext, ctx);
  }
  return next(spec, ctx);
}`;
register("data:text/javascript," + encodeURIComponent(hook));
const L = (p) => import(pathToFileURL(join(root, p)).href);

const { voiceIssues } = await L("lib/voice.js");
const args = new Set(process.argv.slice(2));

const hits = [];
/* Listing names are not marketing words ("Elevate" is a tool). Filled below. */
const NAMES = new Set();
function check(where, text) {
  if (!text || typeof text !== "string") return;
  if (/^\[[a-z]+\]/.test(text)) return;   // a server log line, "[mail] ...", read by nobody outside
  const v = voiceIssues(text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1"));
  v.marketing = v.marketing.filter((m) => !NAMES.has(m) || !new RegExp(`\\b${m[0].toUpperCase()}${m.slice(1)}\\b`).test(text) || /\b[a-z]/.test(text.match(new RegExp(`\\b${m}\\b`, "i"))?.[0] || ""));
  /* A short fragment is a status line in the interface ("Saved.") and a label
     in a listing ("Read-only."). Only in a post is it the dramatic kind. */
  if (!where.startsWith("post:")) v.fragments = [];
  const found = [
    ...(v.emDash ? ["em dash"] : []),
    ...(v.semicolons ? [`${v.semicolons} semicolon${v.semicolons > 1 ? "s" : ""}`] : []),
    ...v.marketing.map((m) => `marketing: ${m}`),
    ...v.hedges.filter((h) => h !== "just").map((h) => `hedge: ${h}`),
    ...v.slop,
    ...v.fragments.map((f) => `fragment: ${f}`),
  ];
  if (found.length) hits.push({ where, found, text });
}

/* ---- catalogues ---- */
const { TOOLS, CATEGORIES, RESOURCE_KINDS } = await L("lib/tools.js");
const kinds = [
  ["tool", TOOLS],
  ["newsletter", (await L("lib/newsletters.js")).NEWSLETTERS],
  ["podcast", (await L("lib/podcasts.js")).PODCASTS],
  ["community", (await L("lib/communities.js")).COMMUNITIES],
  ["event", (await L("lib/events.js")).EVENTS],
];
for (const [, list] of kinds) for (const e of list) NAMES.add(String(e.name).toLowerCase());
const PROSE = ["one", "note", "watch", "reach", "focus", "audience", "blurb", "price"];
for (const [kind, list] of kinds) {
  for (const e of list) for (const f of PROSE) check(`${kind}:${e.id}.${f}`, e[f]);
}
for (const c of CATEGORIES) check(`category:${c.id}.blurb`, c.blurb);
for (const k of RESOURCE_KINDS) check(`section:${k.id}.blurb`, k.blurb);
const { OWNERS } = await L("lib/owners.js");
for (const o of OWNERS) check(`owner:${o.id}.notes`, o.notes);

/* ---- the blog ---- */
const { POSTS, strings } = await L("lib/blog.js");
for (const p of POSTS) strings(p).forEach((s, i) => check(`post:${p.slug}#${i}`, s));

/* ---- visible text in pages, components and copy files ---- */
const SKIP = /components\/Admin\.jsx$|lib\/aboutText\.js$|\/api\/|app\/admin\//;
const walk = (d) => readdirSync(d).flatMap((f) => {
  const p = join(d, f);
  return statSync(p).isDirectory() ? walk(p) : /\.(jsx?|mjs)$/.test(f) ? [p] : [];
});
const files = [...walk(join(root, "components")), ...walk(join(root, "app")),
  ...["lib/podcastCopy.js", "lib/communityCopy.js", "lib/followCopy.js", "lib/recommendOptions.js", "lib/markdown.js", "lib/mail.js"].map((f) => join(root, f))]
  .filter((p) => !SKIP.test(p));
for (const p of files) {
  const src = readFileSync(p, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")          // block comments
    .replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");    // line comments
  const rel = relative(root, p);
  /* JSX text between tags, and quoted strings that read as a sentence. */
  const pieces = [
    ...[...src.matchAll(/>([^<>{}]*[A-Za-z][^<>{}]{12,})</g)].map((m) => m[1]),
    ...[...src.matchAll(/(["'`])((?:(?!\1)[^\\\n]|\\.){20,})\1/g)].map((m) => m[2]).filter((s) => /\s/.test(s) && /[A-Za-z]{3}/.test(s) && !/^[\w./:@#-]+$/.test(s) && !/\b(px|rem|var\(|rgba|flex|grid|http)/.test(s)),
  ].map((s) => s.replace(/\s+/g, " ").replace(/&apos;/g, "'").replace(/&quot;/g, '"').trim())
    /* Code the two patterns can catch: an arrow function's body, a header value. */
    .filter((s) => !/=>|&&|\|\||===|!==|\breturn\b|\bconst\b|\bset[A-Z]\w*\(|\.\w+\(|charset=|rel="|^[)\]};:,.]/.test(s));
  pieces.forEach((s) => check(rel, s));
}

/* ---- report ---- */
const byKind = {};
for (const h of hits) for (const f of h.found) { const k = f.split(":")[0]; byKind[k] = (byKind[k] || 0) + 1; }
if (!args.has("--summary")) {
  for (const h of hits) console.log(`${h.where}\n  ${h.found.join(" | ")}\n  "${h.text.slice(0, 160)}${h.text.length > 160 ? "…" : ""}"`);
}
console.log(`\n${hits.length} strings with something to look at.`, JSON.stringify(byKind));
process.exit(args.has("--strict") && hits.length ? 1 : 0);
