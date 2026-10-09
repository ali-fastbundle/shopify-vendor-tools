#!/usr/bin/env node
/*
 * The share card's URL version cannot drift from what the card draws.
 *
 *   node scripts/og-test.mjs [baseUrl]
 *
 * The library half needs nothing running: it publishes an entry into the
 * in-memory store the way the admin queue does and checks the count the card
 * draws and the version both move with it. The source half checks the image
 * route and the homepage both read lib/ogCard.js and that nothing else builds
 * an og version. With a base URL, the live half compares the version in the
 * homepage's og:image with the `x-og-version` the image itself reports.
 */
import { register } from "node:module";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const k of Object.keys(process.env)) if (/^(UPSTASH|KV)_/.test(k)) delete process.env[k];
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

let failed = 0;
const ok = (cond, what, extra = "") => { console.log(`  ${cond ? "ok  " : "FAIL"}  ${what}${extra ? `  ${extra}` : ""}`); if (!cond) failed++; };
const L = (p) => import(pathToFileURL(join(root, p)).href);

console.log("\nthe version follows what the card draws:");
const { ogFacts, ogVersion } = await L("lib/ogCard.js");
const { TOOLS } = await L("lib/tools.js");
const { write } = await L("lib/store.js");
const before = await ogFacts();
ok(before.toolCount === TOOLS.length, "with nothing in the queue, the card counts the file", `${before.toolCount}`);
await write("svt:entries", { queuetool: { id: "queuetool", name: "Queue Tool", cat: "aso", one: "x", note: "y", watch: "z", price: "Free", free: true, tags: [] } });
const after = await ogFacts();
ok(after.toolCount === TOOLS.length + 1, "a tool published from the admin queue is counted", `${after.toolCount}`);
ok(ogVersion(after) !== ogVersion(before), "and the version moves with it, which is the case that went stale");
ok(ogVersion(await ogFacts()) === ogVersion(after), "the same facts give the same version, so caches are kept when nothing changed");

console.log("\nboth sides read the one function:");
const route = readFileSync(join(root, "app/og/route.js"), "utf8");
const page = readFileSync(join(root, "app/page.js"), "utf8");
const layout = readFileSync(join(root, "app/layout.js"), "utf8");
ok(/ogFacts\(\)/.test(route) && /x-og-version/.test(route), "the image draws ogFacts() and reports its version");
ok(/ogVersion\(await ogFacts\(\)\)/.test(page), "the homepage versions its og:image on the same facts");
ok(!/og\?v=/.test(layout) && !/TOOLS\.length/.test(layout), "the layout builds no version of its own");

const base = process.argv[2];
if (base) {
  console.log(`\nlive, ${base}:`);
  const html = await (await fetch(base)).text();
  const pageV = (html.match(/og:image" content="[^"]*\?v=([^"&]+)/) || [])[1];
  const res = await fetch(`${base.replace(/\/$/, "")}/og?v=check`);
  const imageV = res.headers.get("x-og-version");
  ok(pageV && imageV && pageV === imageV, "the homepage's og:image version is the image's own", `page ${pageV}, image ${imageV}`);
}

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
