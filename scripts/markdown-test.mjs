#!/usr/bin/env node
/*
 * The Markdown version of every content page (lib/markdown.js).
 *
 *   node scripts/markdown-test.mjs [baseUrl]     # default http://localhost:3000
 *
 * Holds: every content route answers its .md with text/markdown and a
 * canonical Link to the HTML page; every tool, newsletter and event carries
 * its caveat under a "Watch for" label; nothing the page does not show is in
 * it (research notes, the verified flag, private review data, addresses);
 * what the page marks as unchecked is marked; a missing page is a 404; and
 * the four ways to find it are in place: the head link, the footer line,
 * llms.txt and robots.txt.
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");
let bad = 0;
const ok = (c, l, d = "") => {
  console.log(`  ${c ? "ok  " : "FAIL"}  ${l}${d ? `  ${d}` : ""}`);
  if (!c) bad += 1;
};
const get = async (p) => {
  const r = await fetch(BASE + p, { signal: AbortSignal.timeout(30_000), redirect: "manual" });
  return { status: r.status, type: r.headers.get("content-type") || "", link: r.headers.get("link") || "", text: await r.text() };
};
const src = (p) => readFileSync(join(root, p), "utf8");

/* Ids from the catalogue files, published only. */
const pick = (file, re) => [...src(file).matchAll(re)].map((m) => m[1]);
const toolIds = pick("lib/tools.js", /^\s+id: "([a-z0-9-]+)", name:/gm);
const newsletterIds = pick("lib/newsletters.js", /^\s{4}id: "([a-z0-9-]+)",$/gm);
const eventIds = pick("lib/events.js", /^\s{4}id: "([a-z0-9-]+)",$/gm);

console.log("every content route:");
const fixed = ["/index.md", "/newsletters.md", "/events.md", "/blog.md", "/changes.md", "/about.md",
  "/categories/aso.md", "/owners/mantle.md", "/blog/shopify-app-store-aso-tools-compared.md"];
for (const p of fixed) {
  const r = await get(p);
  ok(r.status === 200 && /text\/markdown/.test(r.type) && /rel="canonical"/.test(r.link) && r.text.startsWith("# "), p, `${r.status} ${r.type}`);
}

console.log("\nthe caveat, labelled, on every entry:");
const draftRe = (file) => new Set([...src(file).matchAll(/id: "([a-z0-9-]+)"[^]*?(?=\n  \{|\n\];)/g)]
  .filter((m) => /\n\s+draft: true,/.test(m[0])).map((m) => m[1]));
const drafts = new Set([...draftRe("lib/tools.js"), ...draftRe("lib/events.js"), ...draftRe("lib/newsletters.js")]);
let missing = [];
for (const [kind, ids] of [["tools", toolIds], ["newsletters", newsletterIds], ["events", eventIds]]) {
  for (const id of ids) {
    const r = await get(`/${kind}/${id}.md`);
    if (drafts.has(id)) { if (r.status !== 404) missing.push(`${kind}/${id} is a draft and answered ${r.status}`); continue; }
    if (r.status !== 200 || !/\n## Watch for\n\n\S/.test(r.text)) missing.push(`${kind}/${id}: ${r.status}`);
  }
}
ok(missing.length === 0, `every published tool, newsletter and event has "## Watch for" with text, and a draft has no .md`,
  missing.length ? missing.slice(0, 5).join("; ") : `${toolIds.length + newsletterIds.length + eventIds.length} checked`);

console.log("\nnothing the page does not show:");
const ev = await get("/events.md");
const notes = [...src("lib/events.js").matchAll(/notes: "([^"]{30,})"/g)].map((m) => m[1].slice(0, 40));
ok(notes.every((n) => !ev.text.includes(n)), "an event's research notes never appear");
const sample = (await Promise.all(["sasi", "apricotcx", "appjubilee", "luseri"].map((id) => get(`/tools/${id}.md`)))).map((r) => r.text).join("\n");
ok(!/verified|svt_|@[a-z0-9-]+\.[a-z]{2,}/i.test(sample.replace(/https?:\/\/\S+/g, "")), "no verified flag, store key or email address in a tool's text");
ok(!/\bnotes?:\s/i.test(sample), "no research notes on a tool");

console.log("\nwhat is not checked is marked:");
ok(/Date not confirmed|Dates not announced/.test(ev.text), "an unconfirmed event date says so");
ok(/by the organizer's count/.test(ev.text) || /by the organizer's count/.test((await get("/events/holiday-a-list.md")).text), "attendance is the organizer's count");
const post = (await get("/blog/shopify-app-store-aso-tools-compared.md")).text;
ok(/†/.test(post) && /Marked † means the vendor's own claim/.test(post), "the blog's dagger and its legend");

console.log("\nmissing pages:");
for (const p of ["/tools/no-such-tool.md", "/contact.md", "/categories/nonsense.md", "/privacy.md"]) {
  ok((await get(p)).status === 404, `${p} is a 404`);
}

console.log("\nhow to find it:");
const page = (await get("/tools/sasi")).text;
ok(/<link rel="alternate" type="text\/markdown"[^>]*href="[^"]*\/tools\/sasi\.md"/.test(page), "the head links the tool page's .md");
ok(/<link rel="alternate" type="text\/markdown"[^>]*href="[^"]*\/index\.md"/.test((await get("/")).text), "the home page links /index.md");
ok(/href="\/tools\/sasi\.md"[^>]*>Plain text for agents</.test(page), "a quiet footer line on a content page");
ok(!/Plain text for agents/.test((await get("/contact")).text), "and none on a page with no Markdown version");
ok(/## Markdown versions/.test((await get("/llms.txt")).text), "llms.txt states the rule");
const robots = (await get("/robots.txt")).text;
ok(/Allow: \/\*\.md\$/.test(robots) && /Disallow: \/md\//.test(robots), "robots.txt allows .md by name and keeps the internal /md/ out");

console.log(bad ? `\n${bad} failed` : "\nall passed");
process.exit(bad ? 1 : 0);
