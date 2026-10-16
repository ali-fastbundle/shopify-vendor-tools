#!/usr/bin/env node
/*
 * Structured data: attributes per category, pricing tiers, integrations.
 * Drafted from the notes, confirmed by a person, and only then public.
 *
 *   node scripts/structured-test.mjs
 *
 * Shims lib/ and the admin route into a temp directory: in-memory store, no
 * server, no keys.
 */
import { readFileSync, writeFileSync, mkdtempSync, readdirSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { pathToFileURL } from "url";
import { createHmac } from "crypto";

const ROOT = new URL("..", import.meta.url).pathname;
const SECRET = "structured-secret";
process.env.AUTH_SECRET = SECRET;
process.env.ADMIN_EMAILS = "admin@test.invalid";
const dir = mkdtempSync(join(tmpdir(), "svt-structured-"));
mkdirSync(join(dir, "lib"));
for (const f of readdirSync(join(ROOT, "lib"))) {
  if (!f.endsWith(".js")) continue;
  writeFileSync(join(dir, "lib", f),
    readFileSync(join(ROOT, "lib", f), "utf8").replace(/(from\s+"\.\/[a-zA-Z]+)"/g, '$1.js"')
      .replace(/import\("\.\/([a-zA-Z]+)"\)/g, 'import("./$1.js")'));
}
writeFileSync(join(dir, "admin.js"),
  readFileSync(join(ROOT, "app/api/admin/route.js"), "utf8")
    .replace(/from\s+"@\/lib\/([a-zA-Z]+)"/g, 'from "./lib/$1.js"')
    .replace(/import\("@\/lib\/([a-zA-Z]+)"\)/g, 'import("./lib/$1.js")'));

const load = (f) => import(pathToFileURL(join(dir, f)).href);
const { TOOLS, CATEGORIES } = await load("lib/tools.js");
const K = await load("lib/categories.js");
const { PROPOSED } = await load("lib/structured.js");
const listings = await load("lib/listings.js");
const rec = await load("lib/recommend.js");
const store = await load("lib/store.js");
const admin = await load("admin.js");

let bad = 0;
const ok = (c, l, d = "") => { console.log(`  ${c ? "ok  " : "FAIL"}  ${l}${d ? `  ${d}` : ""}`); if (!c) bad += 1; };
const src = (f) => readFileSync(join(ROOT, f), "utf8");
const cookie = (email) => {
  const b = Buffer.from(JSON.stringify({ t: "session", email, exp: Date.now() + 864e5 })).toString("base64url");
  return `svt_session=${b}.${createHmac("sha256", SECRET).update(b).digest("base64url")}`;
};
const post = (email, body) => admin.POST(new Request("http://localhost/api/admin", {
  method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie(email), "x-forwarded-for": "10.0.0.4" },
  body: JSON.stringify(body),
}));
const merged = async (id) => (await listings.mergedTools()).find((t) => t.id === id);

console.log("the schema:");
ok(CATEGORIES.every((c) => K.attributesFor(c.id).length >= 3), "every category has an attribute set", CATEGORIES.filter((c) => !K.attributesFor(c.id).length).map((c) => c.id).join(", "));
ok(Object.values(K.ATTRIBUTES).flat().every((a) => ["boolean", "enum", "number", "text"].includes(a.type) && typeof a.comparable === "boolean"),
  "every attribute has a type and says whether it is comparable");
ok(K.INTEGRATIONS.length === 10, "ten integrations in the controlled vocabulary");
ok(K.formatValue({ type: "boolean" }, K.UNKNOWN) === "Unknown", "unknown displays as Unknown");

console.log("\nthe drafts:");
ok(TOOLS.every((t) => PROPOSED[t.id]), "every published tool has a draft", TOOLS.filter((t) => !PROPOSED[t.id]).map((t) => t.id).join(", "));
ok(TOOLS.every((t) => !K.sanitiseStructured(t.cat, PROPOSED[t.id]).error), "and every draft is valid for its category");
const unknowns = TOOLS.reduce((n, t) => n + Object.values(PROPOSED[t.id].attrs).filter((v) => v === K.UNKNOWN).length, 0);
ok(unknowns > 0, "unknown is used where the note is silent", `${unknowns} unknown values`);
ok(TOOLS.every((t) => Object.entries(PROPOSED[t.id].attrs).every(([k, v]) => v === K.UNKNOWN || PROPOSED[t.id].evidence?.[k])),
  "every known attribute value has its quote");
ok(PROPOSED.krutva.pricing.published === false && K.pricingDisplay(PROPOSED.krutva.pricing) === "Not published", "Krutva: not published is the value");
ok(PROPOSED.tracksami.doubts.some((d) => /publish/i.test(d)), "SAMI's catalogue price is flagged against the editor's note");
ok(TOOLS.every((t) => !/—/.test(K.pricingDisplay(PROPOSED[t.id].pricing))), "no derived price has an em dash");

console.log("\nthe price line:");
ok(K.pricingDisplay({ published: true, free: true, tiers: [{ amount: 39, currency: "USD", period: "month", unit: "flat" }, { amount: 89, currency: "USD", period: "month", unit: "flat" }] }) === "Free plan, then $39 / $89 a month", "free plus tiers");
ok(K.pricingDisplay({ published: true, free: false, tiers: [{ amount: 150, currency: "USD", period: "one-time", unit: "per call" }] }) === "$150 per call", "a per-call price has no period");
ok(K.lowestMonthlyUSD({ published: true, tiers: [{ amount: 490, currency: "USD", period: "year", unit: "flat" }, { amount: 49, currency: "USD", period: "month", unit: "flat" }] }) === 40.833333333333336, "a yearly tier counts at a twelfth");
ok(K.sanitiseStructured("aso", { pricing: { published: false, tiers: [{ amount: 9, currency: "USD", period: "month", unit: "flat" }] } }).error, "not published with tiers is refused");
ok(K.sanitiseStructured("aso", { pricing: { published: true }, integrations: ["teams", "slack"] }).data.integrations.join() === "slack", "an integration outside the vocabulary is dropped");

console.log("\nconfirming, and nothing public before it:");
const t0 = TOOLS.find((t) => t.id === "ranksy");
ok(!(await merged("ranksy")).structured && (await merged("ranksy")).price === t0.price, "unconfirmed: no structured data, the file's price string");
ok((await post("someone@test.invalid", { action: "confirm-structured", toolId: "ranksy", data: PROPOSED.ranksy })).status === 404, "a non-admin gets 404");
ok((await post("admin@test.invalid", { action: "confirm-structured", toolId: "ranksy", data: { ...PROPOSED.ranksy, pricing: { published: "maybe" } } })).status === 400, "invalid data is refused on the server");
{
  const r = await post("admin@test.invalid", { action: "confirm-structured", toolId: "ranksy", data: PROPOSED.ranksy });
  ok(r.status === 200, "an admin confirms");
  const m = await merged("ranksy");
  ok(m.structured && m.price === K.pricingDisplay(PROPOSED.ranksy.pricing), "the price line is now derived from the tiers", m.price);
  ok(!("evidence" in m.structured) && !("doubts" in m.structured), "drafting notes never reach a page");
  ok(rec.lowestCost(m) === 39, "the recommender reads the cheapest tier", String(rec.lowestCost(m)));
}
{
  await new Promise((r) => setTimeout(r, 5));
  await listings.saveEdit("ranksy", { price: "$45 / $95 per month" }, "vendor@test.invalid");
  const m = await merged("ranksy");
  ok(m.price === "$45 / $95 per month" && m.structuredStale, "a vendor's later price edit wins and marks the structure stale");
  ok(rec.lowestCost(m) === 45, "and the recommender follows the newer string");
  await store.write("svt:overrides", {});
}
{
  ok((await post("admin@test.invalid", { action: "clear-structured", toolId: "ranksy" })).status === 200, "a confirmation can be cleared");
  ok(!(await merged("ranksy")).structured, "and the tool is back to the file's price");
  ok((await store.read("svt:structured", {})).ranksy.history.length === 1, "keeping what was confirmed in history");
}
ok(listings.PROTECTED.includes("structured") && !listings.EDITABLE.includes("structured"), "structured data is protected from vendor edits");

console.log("\nwhere it shows:");
const publicFiles = ["components/Directory.jsx", "components/ToolPage.jsx", "components/StructuredDetails.jsx", "app/page.js", "app/tools/[id]/page.js"];
ok(publicFiles.every((f) => !/lib\/structured"/.test(src(f))), "no public file imports the drafts");
ok(/StructuredDetails/.test(src("components/ToolPage.jsx")) && /StructuredDetails/.test(src("components/Directory.jsx")), "the tool page and the modal render the details");
ok(/integrationOptions\.length > 0 &&/.test(src("components/Directory.jsx")), "the integrations filter appears only when something is confirmed");
ok(/Not confirmed yet/.test(src("components/Directory.jsx")), "the compare table says when a tool is not confirmed");

console.log(bad ? `\n${bad} failed` : "\nall passed");
process.exit(bad ? 1 : 0);
