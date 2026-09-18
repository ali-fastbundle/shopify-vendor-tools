#!/usr/bin/env node
/*
 * Vacuous ownership: suppressed at render, and cleared from the store.
 *
 *   node scripts/ownership-test.mjs
 *
 * "AppJubilee is built by AppJubilee" reached the live site, and stopping the
 * monitor proposing it was not enough, because the value had already been
 * applied and was sitting in svt:overrides. So there are two defences and this
 * covers both: ownerOf refuses to print one whatever is stored, and
 * sweepOwnership removes the ones already there.
 *
 * The render half matters most. A sweep fixes what is in the store today; the
 * suppression is what holds if a bad value is written again tomorrow.
 */

import { readFileSync, writeFileSync, mkdtempSync, readdirSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { pathToFileURL } from "url";
import { createHmac } from "crypto";

const ROOT = new URL("..", import.meta.url).pathname;
const SECRET = "ownership-test-secret";
process.env.AUTH_SECRET = SECRET;
process.env.ADMIN_EMAILS = "admin@test.invalid";

const dir = mkdtempSync(join(tmpdir(), "svt-own-"));
mkdirSync(join(dir, "lib"));
for (const f of readdirSync(join(ROOT, "lib"))) {
  if (!f.endsWith(".js")) continue;
  writeFileSync(join(dir, "lib", f),
    readFileSync(join(ROOT, "lib", f), "utf8").replace(/(from\s+"\.\/[a-zA-Z]+)"/g, '$1.js"'));
}
writeFileSync(join(dir, "admin.js"),
  readFileSync(join(ROOT, "app/api/admin/route.js"), "utf8")
    .replace(/from\s+"@\/lib\/([a-zA-Z]+)"/g, 'from "./lib/$1.js"'));

const load = (f) => import(pathToFileURL(join(dir, f)).href);
const { POST } = await load("admin.js");
const store = await load("lib/store.js");
const { ownerOf, isVacuousOwner, TOOLS } = await load("lib/tools.js");
const listings = await load("lib/listings.js");

let bad = 0;
const ok = (c, l, d = "") => {
  console.log(`  ${c ? "ok  " : "FAIL"}  ${l}${d ? `  ${d}` : ""}`);
  if (!c) bad += 1;
};

const AJ = { id: "appjubilee", name: "AppJubilee", domain: "appjubilee.io", url: "https://www.appjubilee.io" };

console.log("what counts as vacuous:");
for (const v of ["AppJubilee", "appjubilee", "AppJubilee Inc", "AppJubilee, LLC",
                 "The AppJubilee App", "appjubilee.io", "https://www.appjubilee.io", ""]) {
  ok(isVacuousOwner(v, AJ), `"${v || "(empty)"}" is not information`);
}

console.log("\nwhat survives:");
for (const v of ["Dark Ecommerce Labs, LLC", "Nick D, Founder", "Marmeto", "Shopify Inc"]) {
  ok(!isVacuousOwner(v, AJ), `"${v}" is a real answer`);
}
/* The case that broke the first version of this rule: a product named after
   the person who built it. Substring matching hid them and would have had the
   sweep delete them. */
const BK = { id: "becketto", name: "Becketto", domain: "becketto.com", url: "https://becketto.com" };
ok(!isVacuousOwner("Beckett Oliphant", BK), '"Beckett Oliphant" survives on Becketto');
ok(isVacuousOwner("Becketto", BK), "but a bare \"Becketto\" does not");
ok(isVacuousOwner("Becketto Ltd", BK), "nor does \"Becketto Ltd\"");

console.log("\nrender suppression:");
ok(ownerOf({ ...AJ, owner: "AppJubilee" }) === "", "ownerOf prints nothing for the brand's own name");
ok(ownerOf({ ...AJ, owner: "Dark Ecommerce Labs, LLC" }) === "Dark Ecommerce Labs, LLC", "and prints a real one");
ok(ownerOf({ ...AJ }) === "", "and handles an absent owner");

console.log("\nthe catalogue as written:");
const aj = TOOLS.find((t) => t.id === "appjubilee");
ok(aj?.owner === "Dark Ecommerce Labs, LLC", "AppJubilee's owner is set in the file", aj?.owner || "(none)");
const vacuous = TOOLS.filter((t) => t.owner && isVacuousOwner(t.owner, t));
ok(vacuous.length === 0, "no entry in lib/tools.js names itself as its own owner",
  vacuous.map((t) => `${t.id}="${t.owner}"`).join(", "));

console.log("\nthe stored sweep:");
{
  /* Exactly the shape that reached production: an applied monitor edit. */
  await store.write("svt:overrides", {
    appjubilee: { owner: "AppJubilee", price: "From $59/mo" },
    tracksami: { owner: "SAMI Inc" },
    ranksy: { owner: "A real parent company", price: "$49" },
  });
  await store.write(store.KEYS.entries, {
    someentry: { id: "someentry", name: "SomeEntry", domain: "someentry.com", owner: "SomeEntry" },
  });

  const b64 = (x) => Buffer.from(x).toString("base64url");
  const body = b64(JSON.stringify({ t: "session", email: "admin@test.invalid", exp: Date.now() + 864e5 }));
  const cookie = `svt_session=${body}.${createHmac("sha256", SECRET).update(body).digest("base64url")}`;
  const res = await POST(new Request("http://localhost/api/admin", {
    method: "POST", headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({ action: "sweep-ownership" }),
  }));
  ok(res.status === 200, "returns 200", `HTTP ${res.status}`);
  const d = await res.json();
  ok(d.count === 3, "cleared all three vacuous values", `${d.count}`);

  const after = await store.read("svt:overrides", {});
  ok(!("owner" in (after.appjubilee || {})), "AppJubilee's owner override is gone");
  ok(after.appjubilee?.price === "From $59/mo", "and its other overrides are untouched");
  ok(!("tracksami" in after), "a row with nothing left is removed, not left empty");
  ok(after.ranksy?.owner === "A real parent company", "a real owner survives the sweep");
  const entries = await store.read(store.KEYS.entries, {});
  ok(!entries.someentry.owner, "published entries are swept too");

  const again = await listings.sweepOwnership({ by: "test" });
  ok(again.count === 0, "running it twice clears nothing, which is how you know it worked");
}

console.log("\nthe merge, where an override outranks the file:");
{
  /* The state production is actually in: the monitor's bad value applied on
     top of an entry whose file now carries the real one. */
  await store.write("svt:overrides", { appjubilee: { owner: "AppJubilee" } });
  const merged = await listings.mergedTools();
  const t = merged.find((x) => x.id === "appjubilee");
  ok(t.owner === "Dark Ecommerce Labs, LLC",
    "the file's real owner shows through, rather than the entry losing its owner entirely",
    `got "${t.owner}"`);
  ok(ownerOf(t) === "Dark Ecommerce Labs, LLC", "and it renders");
}

console.log(`\n${bad ? `${bad} FAILED` : "all passed"}`);
process.exit(bad ? 1 : 0);
