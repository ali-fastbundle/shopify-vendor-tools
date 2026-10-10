#!/usr/bin/env node
/*
 * The blog's rules, checked against every post:
 *
 *   node scripts/blog-test.mjs
 *
 *  - every [label](kind:id) resolves to a listing that exists and is published
 *  - a post links listings rather than copying them: no run of twelve words
 *    from any linked tool's `note` or `watch` appears in the post
 *  - criteria come before verdicts, where a post has both
 *  - no em-dash, at most one middle dot per string (the house rules for copy)
 *  - the ASO comparison covers every tool in the category, and states the two
 *    ownership facts it rests on
 *
 * No server. lib/ is loaded through an import hook that resolves `@/` and
 * extensionless paths, the same way scripts/follow-test.mjs does it.
 */
import { register } from "node:module";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

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
const { ALL_POSTS, POSTS, strings, inline, resolveRef, postHtml, postText, mentionsOf, postsForCategory, postsForTool } = await L("lib/blog.js");
const { TOOLS, catsOf, CATEGORIES } = await L("lib/tools.js");

let failed = 0;
const ok = (cond, what, extra = "") => {
  console.log(`  ${cond ? "ok  " : "FAIL"}  ${what}${extra ? `  ${extra}` : ""}`);
  if (!cond) failed++;
};
const words = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9$.,% ]+/g, " ").split(/\s+/).filter(Boolean);

ok(POSTS.every((p) => !p.draft), "drafts are not in POSTS");
ok(new Set(ALL_POSTS.map((p) => p.slug)).size === ALL_POSTS.length, "slugs are unique");

for (const post of POSTS) {
  console.log(`\n${post.slug}:`);
  const all = strings(post);

  const links = all.flatMap((s) => inline(s)).filter((t) => t.t === "link");
  const broken = links.filter((l) => !resolveRef(l.ref)).map((l) => l.ref);
  ok(broken.length === 0, `all ${links.length} links resolve`, broken.join(", "));
  ok(/^\d{4}-\d{2}-\d{2}$/.test(post.date) && (!post.updated || post.updated >= post.date), "dated, and updated is not before published");
  ok(post.description.length >= 50 && post.description.length <= 200, "description is a sentence, not a paragraph", `${post.description.length} chars`);

  const dashes = all.filter((s) => s.includes("—"));
  ok(dashes.length === 0, "no em-dash anywhere", dashes[0]?.slice(0, 60));
  ok(all.every((s) => (s.match(/·/g) || []).length <= 1), "at most one middle dot per line");

  // Link, do not copy.
  const body = words(postText(post, "")).join(" ");
  const copied = [];
  for (const { kind, id } of mentionsOf(post)) {
    if (kind !== "tool") continue;
    const t = TOOLS.find((x) => x.id === id);
    for (const field of ["note", "watch"]) {
      const w = words(t[field]);
      for (let i = 0; i + 12 <= w.length; i++) {
        const run = w.slice(i, i + 12).join(" ");
        if (body.includes(run)) { copied.push(`${id}.${field}: "${run}"`); break; }
      }
    }
  }
  ok(copied.length === 0, "no twelve-word run is copied from a listing's note or watch", copied[0]);

  const heads = post.body.map((b) => b.h2 || "").map((h) => h.toLowerCase());
  const crit = heads.findIndex((h) => /judged|criteria/.test(h));
  const verdict = heads.findIndex((h) => /verdict/.test(h));
  if (verdict >= 0) ok(crit >= 0 && crit < verdict, "criteria are stated before the verdicts");

  const claims = all.flatMap((s) => inline(s)).filter((t) => t.t === "claim");
  ok(claims.every((c) => c.text.trim().length > 0), `${claims.length} unverified claims, none empty`);
  ok(!/<script/i.test(postHtml(post, "https://watchfor.tools")), "the RSS body carries no script");
}

console.log("\nthe ASO comparison:");
const aso = POSTS.find((p) => p.slug === "shopify-app-store-aso-tools-compared");
if (!aso) {
  ok(false, "the post is published");
} else {
  const linked = new Set(mentionsOf(aso).filter((m) => m.kind === "tool").map((m) => m.id));
  const category = TOOLS.filter((t) => catsOf(t).includes("aso")).map((t) => t.id);
  const missing = category.filter((id) => !linked.has(id));
  ok(missing.length === 0, `links every one of the ${category.length} tools in App Store ASO`, missing.join(", "));
  ok(/fourteen/i.test(aso.title) === (category.length === 14), "the number in the title matches the category");
  const text = strings(aso).join("\n");
  ok(/\[AppJubilee\]\(tool:appjubilee\)[^\n]*\[StoreCensus\]\(tool:storecensus\)[^\n]*same company/.test(text),
    "AppJubilee and StoreCensus are stated as one company");
  ok(/AppstorePulse[^\n]*WideBundle[^\n]*The Wide Company/.test(text), "AppstorePulse and WideBundle are stated as one operator, by name");
  ok(/someone who sells none/i.test(aso.title + text), "the frame is stated");
  ok((aso.categories || []).every((c) => CATEGORIES.some((x) => x.id === c)) && postsForCategory("aso").includes(aso),
    "it names real categories, and /categories/aso links it");
  const unlinked = category.filter((id) => !postsForTool(id).includes(aso));
  ok(unlinked.length === 0, "every tool it compares links back to it from its own page", unlinked.join(", "));
}

/* Invariant 11 on the blog: outbound links carry utm_source at render time,
   in the RSS body as on the page; internal, mailto and already-tagged links
   are left alone; the post source never carries it. */
console.log("\nutm on post links:");
{
  const fake = { slug: "t", title: "t", description: "d".repeat(60), date: "2026-10-10", body: [{ p:
    "[out](https://example.com/a?x=1#f) [in](tool:" + TOOLS[0].id + ") [mail](mailto:a@b.co) [tagged](https://example.com/?UTM_SOURCE=x)" }] };
  const html = postHtml(fake, "https://watchfor.tools");
  ok(html.includes('href="https://example.com/a?x=1&amp;utm_source=watchfor.tools#f"'), "an external link is tagged, query kept, fragment last");
  ok(html.includes(`href="https://watchfor.tools/tools/${TOOLS[0].id}"`), "an internal link is not tagged");
  ok(!/mailto[^"]*utm_source/.test(html) && !/UTM_SOURCE=x&amp;utm_source/.test(html), "mailto and already-tagged links are left alone");
  const { readFileSync, readdirSync } = await import("node:fs");
  const src = readdirSync(join(root, "lib/posts")).map((f) => readFileSync(join(root, "lib/posts", f), "utf8")).join("\n");
  ok(!/utm_source/.test(src), "no post source carries utm_source");
  const page = readFileSync(join(root, "components/Blog.jsx"), "utf8");
  ok(/outbound\(href\)/.test(page), "the post page tags external links through outbound()");
}

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
