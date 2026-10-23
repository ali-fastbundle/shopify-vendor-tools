#!/usr/bin/env node
/*
 * Winding down, toggled by an admin (lib/listings.js setDying).
 *
 *   node scripts/dying-test.mjs
 *
 * Holds that only an admin can set it, that it is an override over the file
 * and never a file edit, that setting it back to what the file says removes
 * the override rather than storing a copy, that every reader sees it
 * (mergedTools, and the matcher, which reads the catalogue directly), and
 * that a vendor still cannot assert it. Runs against the in-memory store with
 * no server and no keys, like editoruse-test.
 */
import { readFileSync, writeFileSync, mkdtempSync, readdirSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { pathToFileURL } from "url";
import { createHmac } from "crypto";

const ROOT = new URL("..", import.meta.url).pathname;
const SECRET = "dying-secret";
process.env.AUTH_SECRET = SECRET;
process.env.ADMIN_EMAILS = "admin@test.invalid";

const dir = mkdtempSync(join(tmpdir(), "svt-dying-"));
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
const { TOOLS } = await load("lib/tools.js");
const listings = await load("lib/listings.js");
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
const override = async (id) => (await listings.getOverrides())[id];

const alive = TOOLS.find((t) => !t.dying);
const dying = TOOLS.find((t) => t.dying);

console.log("who may set it:");
ok((await post("someone@test.invalid", { action: "set-dying", toolId: alive.id, dying: true })).status === 404, "not an admin: 404, as every admin route answers");
ok(!listings.EDITABLE.includes("dying"), "a vendor cannot assert it about their own listing");
ok(listings.APPLIABLE.includes("dying") && !listings.PROTECTED.includes("dying"), "it is an admin-applied fact, not a protected one");

console.log("\non a tool the file says is active:");
let r = await post("admin@test.invalid", { action: "set-dying", toolId: alive.id, dying: true });
ok(r.status === 200 && (await merged(alive.id)).dying === true, "marked as winding down, and every merged read sees it", alive.id);
ok((await override(alive.id))?.dying === true, "stored as an override, not in the file");
r = await post("admin@test.invalid", { action: "set-dying", toolId: alive.id, dying: false });
ok(r.status === 200 && !(await merged(alive.id)).dying, "marked active again");
ok((await override(alive.id)) === undefined, "and back to what the file says removes the override, leaving no copy");

if (dying) {
  console.log("\non a tool the file says is winding down:");
  r = await post("admin@test.invalid", { action: "set-dying", toolId: dying.id, dying: false });
  ok(r.status === 200 && (await merged(dying.id)).dying === false, "an override can say it is active after all", dying.id);
  r = await post("admin@test.invalid", { action: "set-dying", toolId: dying.id, dying: true });
  ok((await override(dying.id)) === undefined && (await merged(dying.id)).dying === true, "and setting it back follows the file again");
}

console.log("\nbad input:");
ok((await post("admin@test.invalid", { action: "set-dying", toolId: "no-such-tool", dying: true })).status === 400, "an unknown id is refused");
ok((await post("admin@test.invalid", { action: "set-dying", toolId: alive.id, dying: "yes" })).status === 400, "only true or false");

console.log("\nthe ways in:");
const match = src("app/api/match/route.js");
ok(/getOverrides\(\)/.test(match) && /"dying" in overrides/.test(match), "the matcher reads the override, since it does not read mergedTools");
ok(/DyingControl/.test(src("components/ToolPage.jsx")) && /viewer\.admin && \(\s*<div[^]*?<DyingControl/.test(src("components/ToolPage.jsx")), "the tool page shows the toggle to an admin only");
ok(/session\.admin && kind === "tool" && \(\s*<div[^]*?<DyingControl/.test(src("components/Account.jsx")), "the listing modal shows it to an admin only");

console.log(bad ? `\n${bad} failed` : "\nall passed");
process.exit(bad ? 1 : 0);
