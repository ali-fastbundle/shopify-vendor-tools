#!/usr/bin/env node
/*
 * Editor use: a fact about the editor, set from /admin, and nothing more.
 *
 *   node scripts/editoruse-test.mjs
 *
 * Checks the values and their wording, that the admin route is the only way
 * in and keeps history, that a vendor override and noRecommend cannot put a
 * value on a listing, and that no rating, structured data, matcher or
 * recommender path reads it.
 *
 * Shims lib/ into a temp directory and calls the admin route directly, so it
 * runs against the in-memory store with no server and no keys.
 */
import { readFileSync, writeFileSync, mkdtempSync, readdirSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { pathToFileURL } from "url";
import { createHmac } from "crypto";

const ROOT = new URL("..", import.meta.url).pathname;
const SECRET = "editoruse-secret";
process.env.AUTH_SECRET = SECRET;
process.env.ADMIN_EMAILS = "admin@test.invalid";

const dir = mkdtempSync(join(tmpdir(), "svt-editoruse-"));
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
const { TOOLS, recommendable } = await load("lib/tools.js");
const EU = await load("lib/editorUse.js");
const listings = await load("lib/listings.js");
const store = await load("lib/store.js");
const admin = await load("admin.js");

let bad = 0;
const ok = (c, l, d = "") => {
  console.log(`  ${c ? "ok  " : "FAIL"}  ${l}${d ? `  ${d}` : ""}`);
  if (!c) bad += 1;
};
const src = (f) => readFileSync(join(ROOT, f), "utf8");
const cookie = (email) => {
  const body = Buffer.from(JSON.stringify({ t: "session", email, exp: Date.now() + 864e5 })).toString("base64url");
  return `svt_session=${body}.${createHmac("sha256", SECRET).update(body).digest("base64url")}`;
};
const post = (email, body) => admin.POST(new Request("http://localhost/api/admin", {
  method: "POST",
  headers: { "Content-Type": "application/json", Cookie: cookie(email), "x-forwarded-for": "10.0.0.1" },
  body: JSON.stringify(body),
}));
const merged = async (id) => (await listings.mergedTools()).find((t) => t.id === id);

console.log("the values and their wording:");
ok(EU.editorUseLine({ value: "using" }) === "Editor uses this.", "using", EU.editorUseLine({ value: "using" }));
ok(EU.editorUseLine({ value: "used", date: "2026-03-04" }) === "Editor used this until March 2026.", "used, with the month", EU.editorUseLine({ value: "used", date: "2026-03-04" }));
ok(EU.editorUseLine({ value: "tested" }) === "Editor tested this.", "tested");
ok(EU.editorUseLine(undefined) === "" && EU.editorUseLine({ value: "" }) === "", "unset says nothing at all");
ok(EU.editorUseBadge({ value: "using" }) === "Editor uses this", "the badge: using");
ok(EU.editorUseBadge({ value: "used", date: "2026-03-04" }) === "Editor used until Mar 2026", "the badge: used, short month", EU.editorUseBadge({ value: "used", date: "2026-03-04" }));
ok(EU.editorUseBadge({}) === "", "the badge: nothing when unset");
for (const f of ["components/ToolPage.jsx", "components/Directory.jsx"]) {
  ok(/<Pill>\{editorUseBadge\(/.test(src(f)), `${f} shows it as a neutral Pill`);
}
ok(EU.sanitiseEditorUse({ value: "loved" }).error, "an unknown value is refused");
ok(EU.sanitiseEditorUse({ value: "using", note: "Good — mostly" }).error, "an em dash in the public note is refused");
ok(EU.sanitiseEditorUse({ value: "using", note: "x".repeat(EU.NOTE_MAX + 1) }).error, "a note longer than one line is refused");
ok(EU.sanitiseEditorUse({ value: "used", date: "2999-01-01" }).error, "a future date is refused");
{
  const c = EU.sanitiseEditorUse({ value: "", note: "left over", date: "2026-01-01" });
  ok(c.value === "" && c.note === "" && c.date === "", "unsetting clears the note and the date");
}
ok(/nobody can use 48 tools/.test(EU.editorUsePolicy(48)) && /not a rating/.test(EU.editorUsePolicy(48)),
  "the policy says it is not a rating and why most are unset");
ok(!/—|;/.test(EU.editorUsePolicy(48)), "and has no em dash or semicolon");

console.log("\nthe admin route:");
const subject = TOOLS.find((t) => t.id === "storeleads") || TOOLS.find(recommendable);
const flagged = TOOLS.find((t) => !recommendable(t));
ok((await post("someone@test.invalid", { action: "set-editor-use", toolId: subject.id, value: "using" })).status === 404,
  "a non-admin gets 404");
ok(!(await merged(subject.id)).editorUse, "nothing is set by default");
{
  const r = await post("admin@test.invalid", { action: "set-editor-use", toolId: subject.id, value: "using", note: "For lead lists." });
  ok(r.status === 200, `an admin sets ${subject.name} to using`, String(r.status));
  const t = await merged(subject.id);
  ok(t.editorUse?.value === "using" && t.editorUse.note === "For lead lists.", "mergedTools carries it");
  ok(/^\d{4}-\d{2}-\d{2}$/.test(t.editorUse.date), "with the date of the change", t.editorUse.date);
  ok(!("by" in t.editorUse) && !("history" in t.editorUse) && !("at" in t.editorUse), "and no address, history or timestamp");
}
{
  await post("admin@test.invalid", { action: "set-editor-use", toolId: subject.id, value: "used", date: "2026-02-01" });
  const rec = (await store.read("svt:editoruse", {}))[subject.id];
  ok(rec.value === "used" && rec.history?.[0]?.value === "using", "a change keeps the previous value in history");
  ok(rec.by === "admin@test.invalid", "and records who changed it, privately");
  await post("admin@test.invalid", { action: "set-editor-use", toolId: subject.id, value: "" });
  ok(!(await merged(subject.id)).editorUse, "unset takes the line off the listing");
  ok((await store.read("svt:editoruse", {}))[subject.id].history.length === 2, "and keeps the record, so it is reversible");
}
ok((await post("admin@test.invalid", { action: "set-editor-use", toolId: "no-such-tool", value: "using" })).status === 400,
  "an unknown id is refused");
ok(src("lib/editorUseStore.js").length && !/tools\.js/.test(src("app/api/admin/route.js").match(/set-editor-use[\s\S]{0,900}/)[0].replace(/catalogueTools/g, "")),
  "the route writes the store, never the catalogue file");

console.log("\nwhat cannot set it:");
if (flagged) {
  const r = await post("admin@test.invalid", { action: "set-editor-use", toolId: flagged.id, value: "using" });
  ok(r.status === 400, `${flagged.name} (noRecommend) is refused`, String(r.status));
  await store.write("svt:editoruse", { [flagged.id]: { value: "using", date: "2026-01-01" } });
  ok(!(await merged(flagged.id)).editorUse, "and a value written straight into the store is not shown on it");
  await store.write("svt:editoruse", {});
}
ok(listings.PROTECTED.includes("editorUse") && !listings.EDITABLE.includes("editorUse") && !listings.APPLIABLE.includes("editorUse"),
  "editorUse is protected: no vendor edit, no monitor apply");
{
  await store.write("svt:overrides", { [subject.id]: { editorUse: { value: "using", date: "2026-01-01" } } });
  ok(!(await merged(subject.id)).editorUse, "a vendor override carrying it is ignored");
  await store.write("svt:overrides", {});
}

console.log("\nwhat never reads it:");
for (const f of ["lib/reviews.js", "lib/seo.js", "app/api/match/route.js", "lib/recommend.js", "app/llms.txt/route.js"]) {
  ok(!/editorUse/.test(src(f)), `${f} does not read it`);
}
ok(/catalogueTools\(\)/.test(src("app/api/match/route.js")) && !/mergedTools/.test(src("app/api/match/route.js")),
  "the matcher prompt is built from the catalogue, which does not carry it");
{
  const d = src("components/Directory.jsx");
  ok(/options\.editorCount > 0 &&/.test(src("components/DirectoryFilters.jsx")), "the directory filter only renders when something is set");
  ok(/editorUsePolicy\(tools\.length\)/.test(d), "the policy is stated where the filter and sort are used");
  ok(/editor: \{ label: "Editor use first"/.test(d), "and there is a sort for it");
  const avg = d.match(/const avg = [^\n]*/)?.[0] || "";
  ok(!/editorUse/.test(avg), "the community average does not read it");
}
ok(/svt:editoruse/.test(src("lib/inventory.js")), "the key is in the store inventory");
ok(EU.editorUseRank({ editorUse: { value: "using" } }) > EU.editorUseRank({ editorUse: { value: "used" } }) &&
  EU.editorUseRank({ editorUse: { value: "used" } }) > EU.editorUseRank({ editorUse: { value: "tested" } }) &&
  EU.editorUseRank({ editorUse: { value: "tested" } }) > EU.editorUseRank({}), "the sort runs using, used, tested, unset");

console.log(bad ? `\n${bad} failed` : "\nall passed");
process.exit(bad ? 1 : 0);
