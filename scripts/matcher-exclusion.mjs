#!/usr/bin/env node
/*
 * `noRecommend`: kept out of the matcher, and out of nothing else.
 *
 *   node scripts/matcher-exclusion.mjs
 *
 * This replaced a test for a field called `editorInterest`, which drove a warn
 * badge and a disclosure paragraph asserting that the directory's maintainer
 * had a commercial interest in the entry. That was wrong about a real company
 * and it was published, so both halves of this test matter equally:
 *
 *   the exclusion holds   on the model path AND the keyword path behind it,
 *                         and the flag is in PROTECTED so a vendor cannot
 *                         clear it or set it on a rival
 *   nothing else does     no badge, no disclosure copy, no llms.txt note, no
 *                         compare row, and the listing is claimable like any
 *                         other
 *
 * The second half is the one that would have caught the bug. A flag that
 * quietly grows a rendered claim about somebody is the failure, and a test that
 * only checks the feature works cannot see it.
 *
 * Like the other library tests this shims lib/ into a temp directory and calls
 * the route handlers directly with a plain Request, so it runs against the
 * in-memory store and needs no server and no keys.
 */

import { readFileSync, writeFileSync, mkdtempSync, readdirSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { pathToFileURL } from "url";
import { createHmac } from "crypto";

const ROOT = new URL("..", import.meta.url).pathname;
const SECRET = "matcher-exclusion-secret";
process.env.AUTH_SECRET = SECRET;
process.env.ADMIN_EMAILS = "admin@test.invalid";

const dir = mkdtempSync(join(tmpdir(), "svt-norec-"));
mkdirSync(join(dir, "lib"));
for (const f of readdirSync(join(ROOT, "lib"))) {
  if (!f.endsWith(".js")) continue;
  writeFileSync(join(dir, "lib", f),
    readFileSync(join(ROOT, "lib", f), "utf8").replace(/(from\s+"\.\/[a-zA-Z]+)"/g, '$1.js"'));
}
const route = (from, to) => writeFileSync(join(dir, to),
  readFileSync(join(ROOT, from), "utf8")
    .replace(/from\s+"@\/lib\/([a-zA-Z]+)"/g, 'from "./lib/$1.js"'));
route("app/api/claim/route.js", "claim.js");
route("app/api/listing/route.js", "listing.js");

const load = (f) => import(pathToFileURL(join(dir, f)).href);
const T = await load("lib/tools.js");
const { TOOLS, recommendable } = T;
const listings = await load("lib/listings.js");
const store = await load("lib/store.js");
const { sanitiseEntry } = await load("lib/entries.js");
const claim = await load("claim.js");
const listing = await load("listing.js");

let bad = 0;
const ok = (c, l, d = "") => {
  console.log(`  ${c ? "ok  " : "FAIL"}  ${l}${d ? `  ${d}` : ""}`);
  if (!c) bad += 1;
};
const src = (f) => readFileSync(join(ROOT, f), "utf8");
const sessionCookie = (email) => {
  const body = Buffer.from(JSON.stringify(
    { t: "session", email, exp: Date.now() + 864e5 })).toString("base64url");
  return `svt_session=${body}.${createHmac("sha256", SECRET).update(body).digest("base64url")}`;
};

/* ------------------------------------------------------------------ */
console.log("the flag:");
const flagged = TOOLS.filter((t) => !recommendable(t));
ok(flagged.length > 0, "at least one entry carries it", flagged.map((t) => t.id).join(", "));
ok(TOOLS.every((t) => t.noRecommend === undefined || t.noRecommend === true),
  "it is only ever written as true; absent means recommendable");
ok(recommendable({}) && recommendable(), "absent and empty both mean recommendable");
ok(!recommendable({ noRecommend: true }), "and true means not");
ok(recommendable({ noRecommend: "yes" }),
  "only a real boolean counts, so a truthy string cannot exclude an entry by accident");

/* ------------------------------------------------------------------ */
console.log("\nthe exclusion, on both paths:");
{
  const { catalogueTools } = await load("lib/entries.js");
  const all = await catalogueTools();
  const pool = all.filter(recommendable);
  ok(pool.length === all.length - flagged.length,
    "the pool is the catalogue minus the flagged entries",
    `${all.length} - ${flagged.length} = ${pool.length}`);
  for (const t of flagged) ok(!pool.some((x) => x.id === t.id), `${t.name} is not in it`);

  const route = src("app/api/match/route.js");
  ok(/recommendable/.test(route), "the route imports the rule rather than restating it");
  ok(/clean\(data, tools\)/.test(route),
    "and validates the model's picks against the filtered list, not the full catalogue");

  const client = src("components/Directory.jsx");
  ok((client.match(/filter\(recommendable\)/g) || []).length >= 2,
    "the client filters twice: the keyword fallback and the pick validation",
    `${(client.match(/filter\(recommendable\)/g) || []).length} call sites`);
}

console.log("\nthe protected set:");
ok(listings.PROTECTED.includes("noRecommend"), "noRecommend is protected");
ok(!listings.EDITABLE.includes("noRecommend"), "a vendor cannot edit it");
ok(!listings.APPLIABLE.includes("noRecommend"), "the monitor cannot apply it");
ok(listings.fieldKind("noRecommend") === "protected", "fieldKind agrees");
{
  const subject = flagged[0];
  const other = TOOLS.find(recommendable);
  await store.write("svt:overrides", {
    [subject.id]: { noRecommend: false },
    [other.id]: { noRecommend: true },
  });
  const merged = await listings.mergedTools();
  ok(!recommendable(merged.find((t) => t.id === subject.id)),
    "an override cannot put a flagged entry back into the matcher");
  ok(recommendable(merged.find((t) => t.id === other.id)),
    `and cannot take ${other.name} out of it`);
  await store.write("svt:overrides", {});
}
{
  const { entry } = sanitiseEntry({
    name: "Test", url: "https://test.invalid", one: "A tool.", note: "It does a thing.",
    watch: "Pricing is not published.", cat: "aso", noRecommend: true,
  });
  ok(entry.noRecommend === undefined, "and it cannot arrive over HTTP or out of a model");
}

/* ------------------------------------------------------------------ */
/*
 * The half that would have caught the bug. The flag must have exactly one
 * consequence, so these assert the absence of the rendered claims the previous
 * version of it grew.
 */
console.log("\nand nothing else, which is the part that went wrong before:");
for (const [file, what] of [
  ["components/Directory.jsx", "the card, the list row, the detail view and the compare table"],
  ["components/ToolPage.jsx", "the tool page"],
  ["components/Categories.jsx", "the category pages"],
  ["app/llms.txt/route.js", "llms.txt"],
]) {
  const s = src(file);
  ok(!/maintained by the editor/i.test(s), `${what}: no badge`, file);
  ok(!/commercial interest|not the independent judgement|Disclosure\./i.test(s),
    `${what}: no disclosure copy`, file);
}
ok(T.EDITOR_INTEREST === undefined && T.hasEditorInterest === undefined,
  "the old field and its wording are gone from lib/tools.js, not just unused");

console.log("\nno claim about anybody in the flagged entries:");
for (const t of flagged) {
  ok(!/\bI\b|\bmy\b|\bmine\b/.test(t.watch),
    `${t.name}: watch is not written in the first person`);
  ok(!/commercial interest|maintains this directory|who maintains/i.test(
    `${t.watch} ${t.note} ${t.owner || ""}`),
  `${t.name}: nothing claims a relationship with the directory`);
  ok(!t.owner || !/Ali A\./.test(t.owner), `${t.name}: owner names no editor`);
}

console.log("\nit is still an ordinary listing:");
{
  const subject = flagged[0];
  const res = await claim.POST(new Request("http://localhost/api/claim", {
    method: "POST",
    headers: { cookie: sessionCookie(`someone@${subject.domain}`), "content-type": "application/json" },
    body: JSON.stringify({ toolId: subject.id, action: "start" }),
  }));
  ok(res.status === 200, "it can be claimed like anything else", `HTTP ${res.status}`);
  const claims = await store.read("svt:claims", {});
  ok(Boolean(claims[subject.id]), "and the claim was written");

  /* The editable fields still save, and the protected ones still do not. */
  const edit = await listing.POST(new Request("http://localhost/api/listing", {
    method: "POST",
    headers: { cookie: sessionCookie(`someone@${subject.domain}`), "content-type": "application/json" },
    body: JSON.stringify({
      toolId: subject.id,
      edit: { one: "A vendor edit.", watch: "No downsides!", noRecommend: false },
    }),
  }));
  ok(edit.status === 200, "a vendor edit succeeds", `HTTP ${edit.status}`);
  const merged = await listings.mergedTools();
  const t = merged.find((x) => x.id === subject.id);
  ok(t.one === "A vendor edit.", "the editable field went through");
  ok(t.watch === subject.watch, "watch did not");
  ok(!recommendable(t), "and the exclusion survived the edit");
  await store.write("svt:overrides", {});
  await store.write("svt:claims", {});
}

/* ------------------------------------------------------------------ */
/*
 * House length. The entry that carried the bad disclosure was also about twice
 * the length of anything else here, which is how an apology reads. These are
 * generous bounds rather than tight ones: the point is to catch an entry
 * drifting into an essay, not to police a sentence.
 */
console.log("\nhouse length across the catalogue:");
const sentences = (v) => (String(v || "").match(/[.!?](\s|$)/g) || []).length;
let longest = { note: 0, watch: 0 };
for (const t of TOOLS) {
  longest = {
    note: Math.max(longest.note, (t.note || "").length),
    watch: Math.max(longest.watch, (t.watch || "").length),
  };
  const over = (t.one || "").length > 140 || sentences(t.note) > 10 || sentences(t.watch) > 8;
  if (over) ok(false, `${t.name} is outside house length`,
    `one ${(t.one || "").length}, note ${sentences(t.note)} sentences, watch ${sentences(t.watch)}`);
}
ok(TOOLS.every((t) => (t.one || "").length <= 140), "every `one` is one line");
ok(TOOLS.every((t) => sentences(t.watch) <= 8), "no `watch` runs past eight sentences",
  `longest is ${longest.watch} chars`);
ok(TOOLS.every((t) => sentences(t.note) <= 10), "no `note` runs past ten",
  `longest is ${longest.note} chars`);
for (const t of flagged) {
  ok(sentences(t.note) <= 5 && sentences(t.watch) <= 3,
    `${t.name} matches the others rather than explaining itself`,
    `note ${sentences(t.note)} sentences, watch ${sentences(t.watch)}`);
}

console.log(`\n${bad ? `${bad} FAILED` : "all passed"}`);
process.exit(bad ? 1 : 0);
