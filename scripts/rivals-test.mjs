#!/usr/bin/env node
/*
 * Alternatives and head-to-heads: only genuine rivals, differences from
 * confirmed data only, both caveats, one URL per pair, and nothing indexed
 * until it can state a difference.
 *
 *   node scripts/rivals-test.mjs
 *
 * Shims lib/ and the sitemap into a temp directory: in-memory store, no server.
 */
import { readFileSync, writeFileSync, mkdtempSync, readdirSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { pathToFileURL } from "url";

const ROOT = new URL("..", import.meta.url).pathname;
process.env.AUTH_SECRET = "rivals-secret";
const dir = mkdtempSync(join(tmpdir(), "svt-rivals-"));
mkdirSync(join(dir, "lib"));
mkdirSync(join(dir, "lib", "posts"));
for (const f of readdirSync(join(ROOT, "lib"))) {
  if (!f.endsWith(".js")) continue;
  writeFileSync(join(dir, "lib", f),
    readFileSync(join(ROOT, "lib", f), "utf8").replace(/(from\s+"\.\/[a-zA-Z0-9/_-]+)"/g, '$1.js"')
      .replace(/import\("\.\/([a-zA-Z]+)"\)/g, 'import("./$1.js")'));
}
for (const f of readdirSync(join(ROOT, "lib", "posts"))) {
  writeFileSync(join(dir, "lib", "posts", f), readFileSync(join(ROOT, "lib", "posts", f), "utf8").replace(/(from\s+"\.\.?\/[a-zA-Z0-9/_-]+)"/g, '$1.js"'));
}
writeFileSync(join(dir, "sitemap.js"),
  readFileSync(join(ROOT, "app/sitemap.js"), "utf8").replace(/from\s+"@\/lib\/([a-zA-Z]+)"/g, 'from "./lib/$1.js"'));

const load = (f) => import(pathToFileURL(join(dir, f)).href);
const { TOOLS } = await load("lib/tools.js");
const R = await load("lib/rivals.js");
const { PROPOSED } = await load("lib/structured.js");
const { confirmStructured } = await load("lib/structuredStore.js");
const listings = await load("lib/listings.js");
const store = await load("lib/store.js");

let bad = 0;
const ok = (c, l, d = "") => { console.log(`  ${c ? "ok  " : "FAIL"}  ${l}${d ? `  ${d}` : ""}`); if (!c) bad += 1; };
const src = (f) => readFileSync(join(ROOT, f), "utf8");

console.log("which pairs exist:");
const pairs = R.rivalPairs(TOOLS, {});
const all = TOOLS.length * (TOOLS.length - 1) / 2;
ok(pairs.size > 0 && pairs.size < all / 4, "a small fraction of the full matrix", `${pairs.size} of ${all}`);
ok([...pairs.values()].every((p) => {
  const a = TOOLS.find((t) => t.id === p.a), b = TOOLS.find((t) => t.id === p.b);
  return a.cat === b.cat || (a.competes || []).includes(b.id) || (b.competes || []).includes(a.id);
}), "every pair shares a category or is named as rivals");
ok(!pairs.has(R.pairKey("ranksy", "storeleads")), "an ASO tool and a store database are not a pair");
ok(TOOLS.every((t) => R.alternativesOf(t, TOOLS, pairs).length > 0), "every tool has at least one alternative");
{
  const withDiscovery = R.rivalPairs(TOOLS, { rivals: [{ a: "ranksy", b: "storeleads" }], findings: [{ name: "Store Leads", namedBy: ["AppJubilee"] }] });
  ok(withDiscovery.get(R.pairKey("ranksy", "storeleads"))?.why.includes("named on a vendor's comparison page"), "a pair the discovery pass recorded is added");
  ok(withDiscovery.has(R.pairKey("appjubilee", "storeleads")), "and so is an older finding that is now listed");
  ok(!R.rivalPairs(TOOLS, { rivals: [{ a: "ranksy", b: "not-a-tool" }] }).has(R.pairKey("ranksy", "not-a-tool")), "an id that is not published is ignored");
}

console.log("\none URL per pair:");
ok(R.pairSlug("ranksy", "rankbase") === "rankbase-vs-ranksy" && R.pairSlug("rankbase", "ranksy") === "rankbase-vs-ranksy", "both orders give the same slug");
ok(R.parseSlug("a-vs-a") === null && R.parseSlug("junk") === null, "a slug naming one tool twice, or no pair, is refused");
ok(/permanentRedirect\(`\/compare\/\$\{canonical\}`\)/.test(src("app/compare/[pair]/page.js")), "the other order redirects permanently to the canonical one");
ok(/if \(!pair\) return null/.test(src("app/compare/[pair]/page.js")), "a pair that does not compete is a 404");

console.log("\ndifferences:");
const ranksy = () => listings.mergedTools().then((ts) => ts.find((t) => t.id === "ranksy"));
const rankbase = () => listings.mergedTools().then((ts) => ts.find((t) => t.id === "rankbase"));
ok(R.differences(await ranksy(), await rankbase()).length === 0, "nothing is stated while either tool is unconfirmed");
await confirmStructured(TOOLS.find((t) => t.id === "ranksy"), PROPOSED.ranksy, "test");
ok(R.differences(await ranksy(), await rankbase()).length === 0, "or while only one is");
await confirmStructured(TOOLS.find((t) => t.id === "rankbase"), PROPOSED.rankbase, "test");
{
  const d = R.differences(await ranksy(), await rankbase());
  ok(d.length > 0, "both confirmed: differences are stated", d.join(" | "));
  ok(d.some((x) => /\$49 a month, against \$39 for Ranksy/.test(x)), "built from the tiers, not from prose");
  ok(d.every((x) => !/—|;/.test(x)), "and in the house punctuation");
}

console.log("\nindexing:");
{
  const sitemap = (await load("sitemap.js")).default;
  const urls = (await sitemap()).map((u) => u.url);
  ok(urls.includes("https://watchfor.tools/compare/rankbase-vs-ranksy"), "a pair with both tools confirmed is in the sitemap");
  ok(urls.includes("https://watchfor.tools/alternatives/ranksy"), "and so is an alternatives page with a confirmed alternative");
  ok(!urls.some((u) => /compare\/.*storeleads/.test(u)), "pairs not confirmed are not");
  ok(/robots: confirmed\(a\) && confirmed\(b\) \? undefined : \{ index: false, follow: true \}/.test(src("app/compare/[pair]/page.js")), "an unconfirmed head-to-head is noindex, follow");
  ok(/indexable \? undefined : \{ index: false, follow: true \}/.test(src("app/alternatives/[tool]/page.js")), "and so is an unconfirmed alternatives page");
}

console.log("\nwhat the pages carry:");
{
  const c = src("components/Comparisons.jsx");
  ok(/<Watch tool=\{a\}/.test(c) && /<Watch tool=\{b\}/.test(c), "a head-to-head shows both caveats");
  ok(/<Watch tool=\{tool\} \/>/.test(c) && /<Watch tool=\{t\} \/>/.test(c), "an alternatives page shows the subject's caveat and each alternative's");
  ok(/OwnerFact ctx=\{o\}/.test(c) && /\["Ownership"/.test(c), "and the ownership lines");
  ok(/\["Pricing tiers", tiersOf\]/.test(c), "and both pricing structures");
  ok(/href=\{`\/alternatives\/\$\{tool\.id\}`\}/.test(src("components/Categories.jsx")) && /\/alternatives\/\$\{tool\.id\}/.test(src("components/ToolPage.jsx")), "linked from the category page and the tool page");
  ok(!/useState|useEffect/.test(c), "server-rendered, no client state");
}
await store.write("svt:structured", {});

console.log(bad ? `\n${bad} failed` : "\nall passed");
process.exit(bad ? 1 : 0);
