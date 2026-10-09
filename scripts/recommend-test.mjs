#!/usr/bin/env node
/*
 * The growth recommender: what it may recommend, what it may read, and what
 * it keeps.
 *
 *   node scripts/recommend-test.mjs
 *
 * No server and no keys. lib/ and the route are loaded through an import hook,
 * against the in-memory store. The network is stubbed: the App Store listing
 * is a fixture and the model is a fake Anthropic endpoint whose answer is
 * chosen per test, including answers that try to recommend things they must
 * not.
 */
import { register } from "node:module";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHmac } from "node:crypto";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const k of Object.keys(process.env)) if (/^(UPSTASH|KV)_|_API_KEY$|^MATCH_PROVIDER$/.test(k)) delete process.env[k];
process.env.AUTH_SECRET = "recommend-test-secret";

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

const LISTING = `<html><head>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"SoftwareApplication","name":"Bundle Bee","description":"Bundles &amp; volume discounts.","aggregateRating":{"@type":"AggregateRating","ratingValue":4.6,"ratingCount":38}}</script>
</head><body><span>Built for Shopify</span><h2>Pricing</h2><p>Free plan available</p>
<p>Categories</p><a>Upsell and bundles</a><p>Launched</p><p>March 4, 2026</p></body></html>`;

let modelAnswer = null;
const fetched = [];
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  fetched.push(u);
  if (u.startsWith("https://apps.shopify.com/")) {
    return u.endsWith("/missing-app") ? new Response("no", { status: 404 }) : new Response(LISTING, { status: 200 });
  }
  if (u.includes("api.anthropic.com")) {
    if (modelAnswer === null) return new Response("down", { status: 500 });
    return Response.json({ content: [{ type: "text", text: JSON.stringify(modelAnswer) }] });
  }
  throw new Error(`unexpected network call: ${u}`);
};
const quiet = { log: console.log, error: console.error, warn: console.warn };
console.error = (...a) => { if (!/\[(recommend|model)\]/.test(String(a[0]))) quiet.error(...a); };
console.warn = (...a) => { if (!/\[(recommend|mail)\]/.test(String(a[0]))) quiet.warn(...a); };

const L = (p) => import(pathToFileURL(join(root, p)).href);
const { listingHandle, parseListing, monthsSince } = await L("lib/appListing.js");
const { lowestPrice, withinBudget, candidates, cleanPicks, fallbackPicks, summariseRuns, readRuns, situationText } = await L("lib/recommend.js");
const { TOOLS } = await L("lib/tools.js");
const route = await L("app/api/recommend/route.js");

let failed = 0;
const ok = (cond, what, extra = "") => {
  quiet.log(`  ${cond ? "ok  " : "FAIL"}  ${what}${extra ? `  ${extra}` : ""}`);
  if (!cond) failed++;
};
const sess = (email) => { const b = Buffer.from(JSON.stringify({ t: "session", email, exp: Date.now() + 3600e3 })).toString("base64url"); return `svt_session=${b}.${createHmac("sha256", process.env.AUTH_SECRET).update(b).digest("base64url")}`; };
const post = (body, cookie) => route.POST(new Request("http://localhost:3000/api/recommend", {
  method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": "10.9.0.1", ...(cookie ? { cookie } : {}) },
  body: JSON.stringify(body),
}));
const input = { url: "https://apps.shopify.com/bundle-bee", budget: "low", stage: "new", objective: "search", installs: 40 };

quiet.log("\nreading a listing:");
ok(listingHandle("https://apps.shopify.com/bundle-bee?surface_type=search") === "bundle-bee", "a listing URL gives its handle, query dropped");
ok(listingHandle("https://apps.shopify.com/fr/bundle-bee") === "bundle-bee", "a locale prefix is skipped");
ok(listingHandle("http://apps.shopify.com/x") === null && listingHandle("https://evil.example/bundle-bee") === null, "anything but https://apps.shopify.com is refused");
ok(listingHandle("https://apps.shopify.com/search?q=bundles") === "search" ? false : true, "search is not a listing", String(listingHandle("https://apps.shopify.com/search?q=bundles")));
const facts = parseListing(LISTING);
ok(facts.name === "Bundle Bee" && facts.rating === 4.6 && facts.reviews === 38, "name, rating and review count from the listing's own JSON-LD");
ok(facts.launched === "2026-03-04" && facts.category === "Upsell and bundles" && facts.builtForShopify === true, "launch date, category and badge from its labelled text");
ok(!("keywords" in facts) && !/position/i.test(JSON.stringify(facts)), "no keyword position is read");
ok(monthsSince("2026-03-04", "2026-10-10") === 7, "months since launch");

quiet.log("\nwhat may be recommended:");
ok(lowestPrice("$39 / $89 per month") === 39 && lowestPrice("Not published") === null, "the lowest published figure");
const sasi = TOOLS.find((t) => t.id === "sasi"), apricot = TOOLS.find((t) => t.id === "apricotcx");
const pool = candidates(TOOLS, { budget: "high" });
ok(!pool.some((t) => t.noRecommend), "nothing flagged noRecommend is a candidate, on any budget", apricot ? "" : "(no flagged entry to test)");
ok(!pool.some((t) => t.id === "sasi") && sasi?.dying, "nothing winding down is a candidate");
ok(candidates(TOOLS, { budget: "free" }).every((t) => t.free), "a budget of nothing admits only free plans");
ok(candidates(TOOLS, { budget: "low" }).every((t) => t.free || (lowestPrice(t.price) ?? Infinity) <= 50), "under $50 admits nothing that starts above it, and nothing unpriced");
ok(!candidates(TOOLS, { budget: "high" }, { name: "AppJubilee" }).some((t) => t.id === "appjubilee"), "an app is never recommended to itself");

quiet.log("\nwhat the model may say:");
const list = candidates(TOOLS, { budget: "high" });
const picks = cleanPicks({ picks: [
  { id: "apricotcx", reason: "Flagged entries must not come back, whatever the model says." },
  { id: "made-up-tool", reason: "An id the model invented must not come back either." },
  { id: "rankbase", reason: "At 40 installs and three months live — the em-dash goes." },
  { id: "rankbase", reason: "The same tool twice is one pick, not two." },
  { id: "appnavigator", reason: "short" },
  { id: "applora", reason: "Free, and it answers questions across the whole store for a new app." },
  { id: "ranksy", reason: "Fine on its own merits as the third pick in this list." },
  { id: "appvitals", reason: "A fourth valid pick is dropped: three is the answer." },
] }, list);
ok(picks.map((p) => p.id).join() === "rankbase,applora,ranksy", "flagged, invented, duplicate and thin picks are dropped; three kept", picks.map((p) => p.id).join());
ok(!picks.some((p) => p.reason.includes("—")), "em-dashes are scrubbed from reasons");
const fb = fallbackPicks(candidates(TOOLS, input), input, {});
ok(fb.length === 3 && fb.every((p) => /^You want more installs from App Store search, at 40 installs with under \$50 a month to spend\./.test(p.reason)), "the no-model path still ties every reason to their situation, in a sentence", fb[0]?.reason);
ok(/Keyword positions: not available/.test(situationText(input, facts)), "the prompt says keyword position is unavailable rather than leaving it to be guessed");

quiet.log("\nthe route:");
ok((await post(input)).status === 401, "signed out: 401");
ok((await post({ ...input, url: "https://example.com/app" }, sess("a@b.co"))).status === 400, "a URL that is not a listing: 400");
ok((await post({ ...input, installs: -3 }, sess("a@b.co"))).status === 400, "a negative install count: 400");

process.env.ANTHROPIC_API_KEY = "sk-test";
modelAnswer = { picks: [
  { id: "apricotcx", reason: "Should never appear in an answer, flagged as connected." },
  { id: "rankbase", reason: "At 40 installs and seven months live, tracking a few search terms daily shows whether listing edits move anything." },
  { id: "appnavigator", reason: "Free, which fits a budget under $50, and enough to watch the bundle apps ranking above you." },
  { id: "letsmetrix", reason: "Free, and sizes the Upsell and bundles category you launched into in March." },
] };
let res = await post(input, sess("owner@bundlebee.example"));
let j = await res.json();
ok(res.status === 200 && j.picks.length === 3, "a signed-in run returns three picks");
ok(!j.picks.some((p) => p.id === "apricotcx"), "the flagged tool the model tried to slip in is not among them");
ok(j.listingRead && j.app.name === "Bundle Bee" && j.path === "model", "the listing was read and the model answered");
ok(fetched.filter((u) => u.startsWith("https://apps.shopify.com/")).every((u) => !/[?&]q=/.test(u) && !/\/reviews/.test(u)),
  "only listing pages were fetched: no search, no reviews pages");

modelAnswer = null;
res = await post({ ...input, url: "https://apps.shopify.com/missing-app" }, sess("owner@bundlebee.example"));
j = await res.json();
ok(res.status === 200 && j.picks.length === 3 && !j.listingRead && j.path === "fallback", "no listing and no model: still three picks, and the answer says which path it took");

quiet.log("\nwhat is kept:");
const runs = await readRuns(10);
ok(runs.length === 2, "every run is stored", `${runs.length}`);
ok(!JSON.stringify(runs).includes("owner@bundlebee.example") && !JSON.stringify(runs).includes("@"), "no run carries an email address");
ok(runs[1].objective === "search" && runs[1].installs === 40 && runs[1].app.category === "Upsell and bundles", "a run keeps what was asked and what the listing said");
const sum = summariseRuns(runs);
ok(sum.total === 2 && sum.objectives[0][1] === 2 && sum.fallback === 1, "the summary counts what people asked for, and how many fell back");

quiet.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
