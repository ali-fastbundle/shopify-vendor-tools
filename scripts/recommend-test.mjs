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
const { lowestPrice, withinBudget, candidates, cleanPicks, fallbackPicks, summariseRuns, readRuns, situationText, costAgainst, recommend } = await L("lib/recommend.js");
const { sanitiseAnswers, sanitiseSkipped, themesOf, QUESTIONS, PRIMING, SCREENS } = await L("lib/recommendOptions.js");
const draftRoute = await L("app/api/recommend/draft/route.js");
const listingRoute = await L("app/api/recommend/listing/route.js");
const { read } = await L("lib/store.js");
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
const answers = {
  url: "https://apps.shopify.com/bundle-bee", installs: 40, revenue: "under1k", tried: ["content"],
  problem: "Nobody finds us in App Store search. We rank nowhere for bundle keywords and installs are flat.",
  objective: "More installs from search without paying for ads.", budget: "low", timeframe: "quarter",
};
const input = { answers, skipped: [] };

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


quiet.log("\nthe questions:");
ok(PRIMING.length === 4 && PRIMING.every((p) => !/^next$/i.test(p.ok)) && PRIMING.map((p) => p.ok).join() === "Let's go,Sounds good,Got it,Makes sense",
  "four priming screens, each moved on by an answer, never Next");
ok(QUESTIONS.filter((q) => q.required).map((q) => q.id).join() === "url", "only the listing URL is required");
ok(QUESTIONS.every((q) => q.heading && /[.?]$/.test(q.heading)), "every question is a sentence");
ok(SCREENS.indexOf("problem") > SCREENS.indexOf("tried") && SCREENS.indexOf("problem") < SCREENS.indexOf("objective"), "what is not working is its own screen, in its own part");
const dirty = sanitiseAnswers({ ...answers, budget: "lots", tried: ["aso", "made-up", "aso"], installs: -5, problem: "x".repeat(5000), extra: "dropped" });
ok(dirty.budget === null && dirty.tried.join() === "aso" && dirty.installs === null && dirty.problem.length === 2000 && !("extra" in dirty),
  "answers are sanitised: unknown choices, duplicates, negatives, length and stray keys");
ok(sanitiseSkipped(["url", "problem", "nonsense"]).join() === "problem", "the URL can never be marked skipped");

quiet.log("\nwhat may be recommended:");
const pool2 = candidates(TOOLS, { budget: "high" });
ok(!pool2.some((t) => t.noRecommend), "nothing flagged noRecommend is a candidate, on any budget");
ok(candidates(TOOLS, { budget: "free" }).every((t) => t.free), "a budget of nothing admits only free plans");
ok(candidates(TOOLS, { budget: "low" }).every((t) => t.free || (lowestPrice(t.price) ?? Infinity) <= 50), "under $50 admits nothing that starts above it");
ok(!candidates(TOOLS, { budget: "high" }, { name: "AppJubilee" }).some((t) => t.id === "appjubilee"), "an app is never recommended to itself");
ok(themesOf(answers.problem)[0]?.id === "search", "their own words point at the right need", themesOf(answers.problem).map((t) => t.id).join());

quiet.log("\nwhat the model may say:");
const list = candidates(TOOLS, { budget: "high" });
const picks = cleanPicks({ picks: [
  { id: "apricotcx", why: "Flagged entries must not come back, whatever the model says.", drivers: ["problem"] },
  { id: "made-up-tool", why: "An id the model invented must not come back either.", drivers: ["problem"] },
  { id: "rankbase", why: "At 40 installs and three months live — the em-dash goes.", limits: "Not ads.", drivers: ["problem", "installs", "made-up", "timeframe"] },
  { id: "rankbase", why: "The same tool twice is one pick, not two." },
  { id: "appnavigator", why: "short" },
  { id: "applora", why: "Free, and it answers questions across the whole store for a new app.", drivers: ["budget"] },
  { id: "ranksy", why: "Fine on its own merits as the third pick in this list.", drivers: [] },
  { id: "appvitals", why: "A fourth valid pick is dropped: three is the most." },
] }, list, { ...answers, timeframe: null });
ok(picks.map((p) => p.id).join() === "rankbase,applora,ranksy", "flagged, invented, duplicate and thin picks are dropped; three at most", picks.map((p) => p.id).join());
ok(!picks.some((p) => p.why.includes("—")), "em-dashes are scrubbed");
ok(picks[0].drivers.join() === "problem,installs", "drivers are only real answer keys the team gave: an unknown key and a skipped one are dropped", picks[0].drivers.join());
ok(cleanPicks({ picks: [{ id: "rankbase", why: "Only one genuinely fits what they described here." }] }, list, answers).length === 1, "fewer than three is allowed when fewer fit");
const fb = fallbackPicks(candidates(TOOLS, { budget: "low" }), answers, {});
ok(fb.length > 0 && fb.every((p) => p.why.startsWith('You wrote "Nobody finds us in App Store search". ') && p.limits), "the no-model path quotes their own words and says what each will not solve", fb[0]?.why);
ok(fallbackPicks(list, { problem: "", objective: "" }).length === 0, "with nothing written there is nothing to rank on, rather than a guess");
const rb = TOOLS.find((t) => t.id === "rankbase");
ok(/within under \$50|free plan|starts at/.test(costAgainst(rb, "high")) && /did not give a budget/.test(costAgainst(rb, null)), "cost is stated against the budget in code, including when there is none");

const { strongThemes } = await L("lib/recommendOptions.js");
ok(strongThemes("Our support inbox is drowning in tickets and we cannot hire.").map((t) => t.id).join() === "support", "one stray keyword does not outvote the need the text is about", strongThemes("Our support inbox is drowning in tickets and we cannot hire.").map((t) => t.id).join());

quiet.log("\nnothing that fits the budget:");
{
  const r = await recommend(TOOLS, { ...answers, problem: "Our support inbox is drowning in tickets and we cannot hire.", objective: "Handle support without hiring.", budget: "free" }, {}, []);
  const supportFree = TOOLS.some((t) => t.cat === "support" && t.free && t.recommendable !== false);
  ok(supportFree ? true : (r.picks.length === 0 && /Nothing in the directory that fits what you described has a free plan, and you have no budget/i.test(r.noneFit)),
    "when nothing relevant is within the budget the answer says so and recommends nothing", r.noneFit || r.picks.map((p) => p.id).join());
}

quiet.log("\nsaving as you go:");
const call = (r, method, body, cookie) => r[method](new Request("http://localhost:3000/api/recommend/x", {
  method, headers: { "Content-Type": "application/json", "x-forwarded-for": "10.9.0.2", ...(cookie ? { cookie } : {}) },
  ...(body ? { body: JSON.stringify(body) } : {}),
}));
ok((await call(draftRoute, "GET", null)).status === 401, "a draft needs an account");
ok((await call(draftRoute, "PUT", { step: "problem", answers: { ...answers, budget: "lots" }, skipped: ["revenue"] }, sess("owner@bundlebee.example"))).status === 200, "a screen saves");
let d = (await (await call(draftRoute, "GET", null, sess("owner@bundlebee.example"))).json()).draft;
ok(d && d.step === "problem" && d.answers.problem === answers.problem && d.answers.budget === null && d.skipped.join() === "revenue", "and resumes where it stopped, sanitised");
ok(!(await (await call(draftRoute, "GET", null, sess("someone@else.example"))).json()).draft, "another account sees nothing of it");
ok(!JSON.stringify(await read("svt:recommend:drafts", {})).includes("@"), "the store holds no address: the key is an HMAC of it");

quiet.log("\nreading the listing first:");
ok((await call(listingRoute, "POST", { url: answers.url })).status === 401, "signed out: 401");
let lr = await (await call(listingRoute, "POST", { url: answers.url }, sess("owner@bundlebee.example"))).json();
ok(lr.app?.name === "Bundle Bee" && lr.app.rating === 4.6 && lr.app.launched === "2026-03-04", "name, rating, reviews and launch date come back to show before anything else");
lr = await (await call(listingRoute, "POST", { url: "https://apps.shopify.com/missing-app" }, sess("owner@bundlebee.example"))).json();
ok(lr.app === null && /no listing/i.test(lr.reason), "a missing listing says so rather than failing");

quiet.log("\nthe run:");
ok((await post(input)).status === 401, "signed out: 401");
ok((await post({ answers: { ...answers, url: "https://example.com/app" } }, sess("a@b.co"))).status === 400, "a URL that is not a listing: 400");
ok((await post({ answers: { ...answers, installs: -3 } }, sess("a@b.co"))).status === 400, "a negative install count: 400");

process.env.ANTHROPIC_API_KEY = "sk-test";
modelAnswer = { picks: [
  { id: "apricotcx", why: "Should never appear in an answer, flagged as connected.", drivers: ["problem"] },
  { id: "rankbase", why: "You rank nowhere for bundle keywords; daily positions show whether listing edits move anything.", limits: "It does not bring installs by itself.", drivers: ["problem", "installs"] },
  { id: "appnavigator", why: "Free, which fits a budget under $50, and enough to watch the bundle apps ranking above you.", limits: "No alerts.", drivers: ["budget", "problem"] },
] };
let res = await post({ answers, skipped: ["revenue"] }, sess("owner@bundlebee.example"));
let j = await res.json();
ok(res.status === 200 && j.picks.length === 2, "a signed-in run returns the valid picks", `${j.picks?.length}`);
ok(!j.picks.some((p) => p.id === "apricotcx"), "the flagged tool the model tried to slip in is not among them");
const p0 = j.picks[0] || {};
const tool0 = TOOLS.find((t) => t.id === p0.id) || {};
ok(p0.why && p0.limits && p0.cost && p0.caveat === tool0.watch, "each pick says why, what it will not solve, cost against the budget, and the listing's own caveat");
ok(p0.drivers?.every((dr) => dr.label && dr.answer) && p0.drivers.some((dr) => dr.key === "problem" && dr.answer === answers.problem), "and which of their answers drove it, with the answer itself");
ok(j.skipped.join() === "revenue", "skipped questions come back to be shown as reducing confidence");
ok(!(await (await call(draftRoute, "GET", null, sess("owner@bundlebee.example"))).json()).draft, "a completed run deletes the saved draft");
ok(fetched.filter((u) => u.startsWith("https://apps.shopify.com/")).every((u) => !/[?&]q=/.test(u) && !/\/reviews/.test(u)), "only listing pages were fetched: no search, no reviews pages");

modelAnswer = null;
res = await post({ answers: { ...answers, url: "https://apps.shopify.com/missing-app" } }, sess("owner@bundlebee.example"));
j = await res.json();
ok(res.status === 200 && j.picks.length > 0 && !j.listingRead && j.path === "fallback", "no listing and no model: still picks from their words, and it says which path");

quiet.log("\nwhat is kept:");
const runs = await readRuns(10);
ok(runs.length === 2, "every run is stored", `${runs.length}`);
ok(!JSON.stringify(runs).includes("@"), "no run carries an email address");
ok(runs[1].answers.problem === answers.problem && runs[1].skipped.join() === "revenue" && runs[1].app.category === "Upsell and bundles", "a run keeps what was said, what was skipped and what the listing said");
const sum = summariseRuns(runs);
ok(sum.total === 2 && sum.objectives[0][0] === "More installs from App Store search" && sum.fallback === 1, "the summary counts what people asked for, from their own words");

quiet.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
