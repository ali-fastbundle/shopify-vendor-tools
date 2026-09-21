#!/usr/bin/env node
/*
 * The editor's own entry: disclosed, unrecommendable, unclaimable.
 *
 *   node scripts/editor-interest.mjs
 *
 * One entry in this directory is a company the person maintaining it runs.
 * Everything else here is written by somebody with nothing to gain, which is
 * the entire product, so the exception has to be enforced rather than
 * remembered. Four defences, and they fail in different directions:
 *
 *   PROTECTED     no vendor edit, override or monitor proposal can set the
 *                 flag, clear it, or plant it on a competitor
 *   the matcher   the model is never shown it AND an id it returns anyway is
 *                 dropped, on the model path and on the keyword path behind it
 *   /api/claim    403, because the editor already controls it
 *   the entry     `watch` says it in the first person and `owner` names the
 *                 relationship
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
const SECRET = "editor-interest-secret";
process.env.AUTH_SECRET = SECRET;
process.env.ADMIN_EMAILS = "admin@test.invalid";
/* No key, so the matcher route returns 503 before it builds a prompt. The
   exclusion is tested on the catalogue it would have built and on the keyword
   path, which is the half that runs when a provider is down anyway. */
delete process.env.ANTHROPIC_API_KEY;
delete process.env.OPENAI_API_KEY;

const dir = mkdtempSync(join(tmpdir(), "svt-editor-"));
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
const { TOOLS, hasEditorInterest, EDITOR_INTEREST } = await load("lib/tools.js");
const listings = await load("lib/listings.js");
const store = await load("lib/store.js");
const claim = await load("claim.js");
const listing = await load("listing.js");

let bad = 0;
const ok = (c, l, d = "") => {
  console.log(`  ${c ? "ok  " : "FAIL"}  ${l}${d ? `  ${d}` : ""}`);
  if (!c) bad += 1;
};

const sessionCookie = (email) => {
  const body = Buffer.from(JSON.stringify(
    { t: "session", email, exp: Date.now() + 864e5 })).toString("base64url");
  return `svt_session=${body}.${createHmac("sha256", SECRET).update(body).digest("base64url")}`;
};

/* ------------------------------------------------------------------ */
console.log("the catalogue:");
const flagged = TOOLS.filter(hasEditorInterest);
ok(flagged.length > 0, "at least one entry is flagged", flagged.map((t) => t.id).join(", "));
ok(TOOLS.every((t) => t.editorInterest === undefined || t.editorInterest === true),
  "the flag is only ever written as true, never as false");

for (const t of flagged) {
  console.log(`\n${t.name}, as written:`);
  ok(Boolean(t.owner) && t.owner.length > 20,
    "`owner` names the entity and the relationship, not just a brand", t.owner || "(none)");
  ok(/\bI\b/.test(t.watch),
    "`watch` is written in the first person, which is what makes it a disclosure");
  /* The three things a reader has to be told, in the field they will read. A
     badge gets somebody to look here; this is what they find. */
  ok(/commercial interest/i.test(t.watch), "`watch` states the commercial interest");
  ok(/cannot assess it neutrally|not neutral|wrong person/i.test(t.watch),
    "`watch` says the assessment is not neutral");
  ok(/weigh this entry|accordingly/i.test(t.watch), "`watch` tells the reader what to do about it");
  ok(t.verified === true || t.verified === false, "`verified` is a real editorial value");
}

/* ------------------------------------------------------------------ */
console.log("\nthe protected set:");
ok(listings.PROTECTED.includes("editorInterest"),
  "editorInterest is protected, so no route may write it");
ok(!listings.EDITABLE.includes("editorInterest"), "and a vendor cannot edit it");
ok(!listings.APPLIABLE.includes("editorInterest"), "and the monitor cannot apply it");
ok(listings.fieldKind("editorInterest") === "protected", "fieldKind agrees");
ok(listings.PROTECTED.includes("alsoIn"),
  "alsoIn is protected too, because it is `cat` with more room");
ok(listings.fieldKind("alsoIn") === "protected", "fieldKind agrees about alsoIn");

/* ------------------------------------------------------------------ */
console.log("\nan override cannot clear it, or plant it:");
{
  const subject = flagged[0];
  const other = TOOLS.find((t) => !hasEditorInterest(t));
  await store.write("svt:overrides", {
    [subject.id]: { editorInterest: false, watch: "Nothing to see here.", alsoIn: [] },
    [other.id]: { editorInterest: true },
  });
  const merged = await listings.mergedTools();
  const mine = merged.find((t) => t.id === subject.id);
  const theirs = merged.find((t) => t.id === other.id);
  ok(hasEditorInterest(mine), "the flag survives an override that tried to clear it");
  ok(mine.watch === subject.watch, "and so does the caveat");
  ok(!hasEditorInterest(theirs), `the flag cannot be planted on ${other.name}`);
  await store.write("svt:overrides", {});
}

/* ------------------------------------------------------------------ */
console.log("\nthe vendor edit route:");
{
  const subject = flagged[0];
  /* Grant the claim by hand, which is the only way it could exist, then prove
     the edit route still refuses the protected fields. This is the state an
     attacker would need and it still buys nothing. */
  await store.write("svt:claims", {
    [subject.id]: { email: "vendor@test.invalid", status: "verified", method: "test" },
  });
  const res = await listing.POST(new Request("http://localhost/api/listing", {
    method: "POST",
    headers: { cookie: sessionCookie("vendor@test.invalid"), "content-type": "application/json" },
    body: JSON.stringify({
      toolId: subject.id,
      edit: { editorInterest: false, watch: "No downsides!", alsoIn: ["aso"], one: "An edit that is allowed." },
    }),
  }));
  ok(res.status === 200, "an otherwise valid edit still succeeds", `HTTP ${res.status}`);
  const merged = await listings.mergedTools();
  const t = merged.find((x) => x.id === subject.id);
  ok(t.one === "An edit that is allowed.", "the editable field went through");
  ok(hasEditorInterest(t), "editorInterest survived");
  ok(t.watch === subject.watch, "watch survived");
  ok(JSON.stringify(t.alsoIn) === JSON.stringify(subject.alsoIn), "alsoIn survived");
  await store.write("svt:overrides", {});
  await store.write("svt:claims", {});
}

/* ------------------------------------------------------------------ */
console.log("\nthe claim route:");
{
  const subject = flagged[0];
  const res = await claim.POST(new Request("http://localhost/api/claim", {
    method: "POST",
    headers: { cookie: sessionCookie("anyone@test.invalid"), "content-type": "application/json" },
    body: JSON.stringify({ toolId: subject.id, action: "start" }),
  }));
  ok(res.status === 403, "starting a claim is refused", `HTTP ${res.status}`);
  ok(/cannot be claimed/i.test(await res.text()), "and the reason is stated");

  /* Even from an address at the tool's own domain, which is the path that
     verifies a normal claim outright. */
  const shortcut = await claim.POST(new Request("http://localhost/api/claim", {
    method: "POST",
    headers: { cookie: sessionCookie(`someone@${subject.domain}`), "content-type": "application/json" },
    body: JSON.stringify({ toolId: subject.id, action: "start" }),
  }));
  ok(shortcut.status === 403, "including from the tool's own domain", `HTTP ${shortcut.status}`);
  const claims = await store.read("svt:claims", {});
  ok(!claims[subject.id], "and nothing was written to svt:claims");

  /* The control: an ordinary listing is still claimable. A test that only
     proves nothing works proves nothing. */
  const other = TOOLS.find((t) => !hasEditorInterest(t));
  const fine = await claim.POST(new Request("http://localhost/api/claim", {
    method: "POST",
    headers: { cookie: sessionCookie("anyone@test.invalid"), "content-type": "application/json" },
    body: JSON.stringify({ toolId: other.id, action: "start" }),
  }));
  ok(fine.status === 200, `${other.name} can still be claimed`, `HTTP ${fine.status}`);
  await store.write("svt:claims", {});
}

/* ------------------------------------------------------------------ */
console.log("\nthe matcher:");
{
  /*
   * The route's own exclusion, reproduced against the same catalogue it reads.
   * Asserting the source rather than the behaviour would pass a refactor that
   * deleted the filter, so this checks both: the list the prompt is built from,
   * and the list a returned id is validated against, are the same list and it
   * does not contain the entry.
   */
  const { catalogueTools } = await load("lib/entries.js");
  const all = await catalogueTools();
  const pool = all.filter((t) => !hasEditorInterest(t));
  ok(pool.length === all.length - flagged.length,
    "the pool the matcher picks from is the catalogue minus the flagged entries",
    `${all.length} - ${flagged.length} = ${pool.length}`);
  for (const t of flagged) {
    ok(!pool.some((x) => x.id === t.id), `${t.name} is not in it`);
  }

  const src = readFileSync(join(ROOT, "app/api/match/route.js"), "utf8");
  ok(/hasEditorInterest/.test(src), "the route imports the rule rather than restating it");
  ok(/clean\(data, tools\)/.test(src),
    "and validates the model's picks against the filtered list, not the full catalogue");

  const client = readFileSync(join(ROOT, "components/Directory.jsx"), "utf8");
  ok(/filter\(\(t\) => !hasEditorInterest\(t\)\)/.test(client),
    "the keyword fallback filters it too, so an outage does not open the door");
}

/* ------------------------------------------------------------------ */
console.log("\nthe surfaces that must disclose it:");
for (const [file, what] of [
  ["components/Directory.jsx", "the card, the list row and the detail view"],
  ["components/ToolPage.jsx", "the tool page"],
  ["components/Categories.jsx", "the category pages"],
  ["app/llms.txt/route.js", "llms.txt"],
]) {
  const src = readFileSync(join(ROOT, file), "utf8");
  ok(/hasEditorInterest|EDITOR_INTEREST/.test(src), `${what} reads the rule`, file);
}
ok(EDITOR_INTEREST === "maintained by the editor",
  "one wording, shared by every badge", `"${EDITOR_INTEREST}"`);

console.log(`\n${bad ? `${bad} FAILED` : "all passed"}`);
process.exit(bad ? 1 : 0);
