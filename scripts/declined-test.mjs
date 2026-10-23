#!/usr/bin/env node
/*
 * A dismissed finding stays dismissed (findingPrint in lib/monitor.js).
 *
 *   node scripts/declined-test.mjs
 *
 * Every finding gets a fresh row id each run, and the snapshot is a model's
 * reading, so the same news reworded used to come back the week after it was
 * dismissed. Holds the print (reworded alike, a different value different),
 * that Dismiss and Mark as wrong record it and Reopen and Unmark undo it, and
 * that a run filters on it. In-memory store, no server, no keys.
 */
import { readFileSync, writeFileSync, mkdtempSync, readdirSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { pathToFileURL } from "url";
import { createHmac } from "crypto";

const ROOT = new URL("..", import.meta.url).pathname;
const SECRET = "declined-secret";
process.env.AUTH_SECRET = SECRET;
process.env.ADMIN_EMAILS = "admin@test.invalid";

const dir = mkdtempSync(join(tmpdir(), "svt-declined-"));
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
const monitor = await load("lib/monitor.js");
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

const { findingPrint } = monitor;
const { KEYS, pushCapped, read } = store;

console.log("the print:");
const a = { entryId: "ranksy", kind: "feature", field: "note", new: "Added Slack integration" };
const b = { entryId: "ranksy", kind: "feature", field: "note", new: "Slack integration added." };
const c = { entryId: "ranksy", kind: "feature", field: "note", new: "Added HubSpot integration" };
ok(findingPrint(a) === findingPrint(b), "the same news, reworded, prints alike", findingPrint(a));
ok(findingPrint(a) !== findingPrint(c), "a different value prints differently, so a real change is not silenced");
ok(findingPrint(a) !== findingPrint({ ...a, entryId: "appjubilee" }), "per tool");
ok(findingPrint({ entryId: "x", kind: "pricing", old: "$49 Starter", new: "" }) !== findingPrint({ entryId: "x", kind: "pricing", new: "$49 Starter" }),
  "a removal and an addition of the same value are different findings");
ok(findingPrint({ entryId: "x", kind: "pricing", new: "Starter $49/mo" }) !== findingPrint({ entryId: "x", kind: "pricing", new: "Starter $59/mo" }),
  "a price that moved is a new finding");

console.log("\nthe admin actions:");
const row = { id: "ranksy-test-1", at: "2026-10-19T09:00:00Z", entryId: "ranksy", entryName: "Ranksy", kind: "feature", field: "note", what: "x", new: "Added Slack integration", status: "open" };
const wrong = { ...row, id: "ranksy-test-2", kind: "pricing", field: "price", new: "Pro $99/mo" };
await pushCapped(KEYS.changelog, [row, wrong], 500);
let r = await post("admin@test.invalid", { action: "dismiss-change", id: row.id });
let declined = await read(KEYS.monitorDeclined, {});
ok(r.status === 200 && declined[findingPrint(row)]?.via === "dismissed", "Dismiss remembers what the finding said");
ok(Boolean(declined[findingPrint(b)]), "so next week's reworded copy matches it");
r = await post("admin@test.invalid", { action: "reopen-change", id: row.id });
declined = await read(KEYS.monitorDeclined, {});
ok(r.status === 200 && !declined[findingPrint(row)], "Reopen forgets it");
r = await post("admin@test.invalid", { action: "mark-wrong", id: wrong.id, reason: "toggle page" });
declined = await read(KEYS.monitorDeclined, {});
ok(r.status === 200 && declined[findingPrint(wrong)]?.via === "wrong", "Mark as wrong remembers it too");
r = await post("admin@test.invalid", { action: "unmark-wrong", id: wrong.id });
declined = await read(KEYS.monitorDeclined, {});
ok(r.status === 200 && !declined[findingPrint(wrong)], "and Unmark forgets it");
ok((await post("someone@test.invalid", { action: "dismiss-change", id: row.id })).status === 404, "not an admin: 404");

console.log("\nthe run:");
const msrc = src("lib/monitor.js");
ok(/const rows = all\.filter\(\(row\) => !declined\[findingPrint\(row\)\]\)/.test(msrc), "a run drops a finding already declined");
ok(/\[monitor\] dropped/.test(msrc), "and logs what it dropped");
ok(/s\.via === "wrong"/.test(msrc) && /readChangelog\(500\)/.test(msrc), "dismissals from before prints existed still count");
ok(/monitorDeclined/.test(src("lib/inventory.js")), "the key is in the store inventory");

console.log(bad ? `\n${bad} failed` : "\nall passed");
process.exit(bad ? 1 : 0);
