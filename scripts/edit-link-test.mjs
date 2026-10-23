#!/usr/bin/env node
/*
 * Editing a listing from a monitor finding, in one click, and resolving it.
 *
 *   node scripts/edit-link-test.mjs
 *
 * The way in used to be the listing page, Edit, the directory's modal, then
 * Edit again, and an edit made that way left the finding with no destination,
 * so Resolve was refused. Holds that the finding's link opens the form and
 * names the finding, that saving records "edited" as its destination, that
 * Resolve accepts it, and that an edit made elsewhere can be marked by hand.
 * In-memory store, no server, no keys.
 */
import { readFileSync, writeFileSync, mkdtempSync, readdirSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { pathToFileURL } from "url";
import { createHmac } from "crypto";

const ROOT = new URL("..", import.meta.url).pathname;
const SECRET = "editlink-secret";
process.env.AUTH_SECRET = SECRET;
process.env.ADMIN_EMAILS = "admin@test.invalid";

const dir = mkdtempSync(join(tmpdir(), "svt-editlink-"));
mkdirSync(join(dir, "lib"));
for (const f of readdirSync(join(ROOT, "lib"))) {
  if (!f.endsWith(".js")) continue;
  writeFileSync(join(dir, "lib", f),
    readFileSync(join(ROOT, "lib", f), "utf8").replace(/(from\s+"\.\/[a-zA-Z]+)"/g, '$1.js"')
      .replace(/import\("\.\/([a-zA-Z]+)"\)/g, 'import("./$1.js")'));
}
writeFileSync(join(dir, "listing.js"),
  readFileSync(join(ROOT, "app/api/listing/route.js"), "utf8")
    .replace(/from\s+"@\/lib\/([a-zA-Z]+)"/g, 'from "./lib/$1.js"')
    .replace(/import\("@\/lib\/([a-zA-Z]+)"\)/g, 'import("./lib/$1.js")'));
writeFileSync(join(dir, "admin.js"),
  readFileSync(join(ROOT, "app/api/admin/route.js"), "utf8")
    .replace(/from\s+"@\/lib\/([a-zA-Z]+)"/g, 'from "./lib/$1.js"')
    .replace(/import\("@\/lib\/([a-zA-Z]+)"\)/g, 'import("./lib/$1.js")'));

const load = (f) => import(pathToFileURL(join(dir, f)).href);
const monitor = await load("lib/monitor.js");
const store = await load("lib/store.js");
const admin = await load("admin.js");
const listing = await load("listing.js");

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

const { KEYS, pushCapped, read } = store;
const save = (email, body) => listing.POST(new Request("http://localhost/api/listing", {
  method: "POST",
  headers: { "Content-Type": "application/json", Cookie: cookie(email), "x-forwarded-for": "10.0.0.2" },
  body: JSON.stringify(body),
}));

const row = { id: "ranksy-edit-1", at: "2026-10-22T09:00:00Z", entryId: "ranksy", entryName: "Ranksy", kind: "feature", field: "note", what: "x", new: "Added Slack integration", status: "open" };
const other = { ...row, id: "ranksy-edit-2" };
await pushCapped(KEYS.changelog, [row, other], 500);

console.log("before any edit:");
let r = await post("admin@test.invalid", { action: "resolve-change", id: row.id });
ok(r.status === 400, "Resolve is refused with no destination, as before");

console.log("\nan edit opened from the finding:");
r = await save("admin@test.invalid", { toolId: "ranksy", edit: { one: "Follows a keyword through to the customer who paid, now with Slack." }, finding: row.id });
let edited = await read(KEYS.changesEdited, {});
ok(r.status === 200 && edited[row.id]?.via === "form" && edited[row.id].fields.includes("one"), "saving records the edit as the finding's destination, with the fields");
r = await post("admin@test.invalid", { action: "resolve-change", id: row.id });
const seen = await read(KEYS.changesSeen, {});
ok(r.status === 200 && seen[row.id]?.destinations?.includes("edited"), "and Resolve accepts it");

console.log("\nwhat is not recorded:");
r = await save("admin@test.invalid", { toolId: "appjubilee", edit: { one: "Multi-app ASO with automatic keyword discovery." }, finding: other.id });
edited = await read(KEYS.changesEdited, {});
ok(r.status === 200 && !edited[other.id], "a finding about another listing is ignored, and the edit still saves");
r = await save("admin@test.invalid", { toolId: "ranksy", edit: { one: "x y z" }, finding: "no-such-finding" });
ok(r.status === 200 && !(await read(KEYS.changesEdited, {}))["no-such-finding"], "an unknown finding is ignored");

console.log("\nedited elsewhere, marked by hand:");
r = await post("admin@test.invalid", { action: "mark-edited", id: other.id });
edited = await read(KEYS.changesEdited, {});
ok(r.status === 200 && edited[other.id]?.via === "hand", "Edited by hand records it");
r = await post("admin@test.invalid", { action: "unmark-edited", id: other.id });
ok(r.status === 200 && !(await read(KEYS.changesEdited, {}))[other.id], "Not edited takes it back");
ok((await post("someone@test.invalid", { action: "mark-edited", id: other.id })).status === 404, "not an admin: 404");

console.log("\nthe links:");
const adm = src("components/Admin.jsx");
ok(/edit=1&finding=\$\{encodeURIComponent\(r\.id\)\}/.test(adm) && />Edit the listing</.test(adm), "every finding has an Edit the listing link that opens the form and names the finding");
ok(/\/newsletters\/\$\{encodeURIComponent\(r\.entryId\)\}/.test(adm), "a newsletter finding links to the newsletter, not to /tools");
ok(/\$\{href\}&edit=1/.test(src("components/ToolPage.jsx")), "the tool page's Edit this listing opens the form directly");
ok(/params\.get\("edit"\) === "1"/.test(src("components/Directory.jsx")) && /params\.get\("edit"\) !== "1"/.test(src("components/Engagement.jsx")),
  "the directory and the newsletter and event pages read it");
ok(/startEditing/.test(src("components/Account.jsx")) && /finding=\{session\.admin \? finding : ""\}/.test(src("components/Account.jsx")),
  "the owner panel opens the form, and only an admin's save carries the finding");
ok(/monitorDeclined|changesEdited/.test(src("lib/inventory.js")) && /changesEdited/.test(src("lib/inventory.js")), "the key is in the store inventory");

console.log(bad ? `\n${bad} failed` : "\nall passed");
process.exit(bad ? 1 : 0);
