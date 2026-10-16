#!/usr/bin/env node
/*
 * The caveat: one admin-only path that commits to lib/tools.js, and the
 * protection unchanged for everyone else.
 *
 *   node scripts/watch-edit-test.mjs
 */
import { readFileSync, writeFileSync, mkdtempSync, readdirSync, mkdirSync, symlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { pathToFileURL } from "url";
import { createHmac } from "crypto";

const ROOT = new URL("..", import.meta.url).pathname;
const SECRET = "watch-secret";
process.env.AUTH_SECRET = SECRET;
process.env.ADMIN_EMAILS = "admin@test.invalid";
delete process.env.GITHUB_TOKEN;
const dir = mkdtempSync(join(tmpdir(), "svt-watch-"));
mkdirSync(join(dir, "lib"));
symlinkSync(join(ROOT, "node_modules"), join(dir, "node_modules"));
for (const f of readdirSync(join(ROOT, "lib"))) {
  if (!f.endsWith(".js")) continue;
  writeFileSync(join(dir, "lib", f), readFileSync(join(ROOT, "lib", f), "utf8").replace(/(from\s+"\.\/[a-zA-Z_-]+)"/g, '$1.js"').replace(/import\("\.\/([a-zA-Z]+)"\)/g, 'import("./$1.js")'));
}
writeFileSync(join(dir, "admin.js"), readFileSync(join(ROOT, "app/api/admin/route.js"), "utf8").replace(/from\s+"@\/lib\/([a-zA-Z]+)"/g, 'from "./lib/$1.js"').replace(/import\("@\/lib\/([a-zA-Z]+)"\)/g, 'import("./lib/$1.js")'));
const load = (f) => import(pathToFileURL(join(dir, f)).href);
const P = await load("lib/publish.js");
const { TOOLS } = await load("lib/tools.js");
const listings = await load("lib/listings.js");
const rewrite = await load("lib/rewrite.js");
const store = await load("lib/store.js");
const admin = await load("admin.js");

let bad = 0;
const ok = (c, l, d = "") => { console.log(`  ${c ? "ok  " : "FAIL"}  ${l}${d ? `  ${d}` : ""}`); if (!c) bad += 1; };
const cookie = (email) => { const b = Buffer.from(JSON.stringify({ t: "session", email, exp: Date.now() + 864e5 })).toString("base64url"); return `svt_session=${b}.${createHmac("sha256", SECRET).update(b).digest("base64url")}`; };
let n = 1;
const post = async (body, email = "admin@test.invalid") => { const r = await admin.POST(new Request("http://localhost/api/admin", { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie(email), "x-forwarded-for": `10.5.0.${n++}` }, body: JSON.stringify(body) })); return { status: r.status, text: r.ok ? "" : await r.text() }; };

const source = readFileSync(join(ROOT, "lib/tools.js"), "utf8");
const today = "2026-10-16";
const lines = (s) => s.split("\n");

console.log("the edit, against every tool in the file:");
let clean = 0;
for (const t of TOOLS) {
  const r = P.editWatchInSource(source, t.id, { before: t.watch, after: `${t.watch} Checked again.`, today });
  if (r.error) { ok(false, `${t.id}`, r.error); continue; }
  const a = lines(source), b = lines(r.source);
  const diff = b.filter((l, i) => l !== a[i]);
  if (a.length === b.length && diff.length >= 1 && diff.length <= 2 && diff.some((l) => l.includes("Checked again.")) && diff.every((l) => /\bwatch:|updated:/.test(l))) clean += 1;
  else ok(false, `${t.id} changed more than the watch and the date`, diff.join(" | ").slice(0, 200));
}
ok(clean === TOOLS.length, "every tool: only its watch and its updated date change", `${clean} of ${TOOLS.length}`);
{
  const r = P.editWatchInSource(source, "ranksy", { before: TOOLS.find((t) => t.id === "ranksy").watch, after: 'Quote "it" and a \\ back slash', today });
  ok(!r.error && r.source.includes(JSON.stringify('Quote "it" and a \\ back slash')), "quotes and backslashes are escaped, and the file still parses (the edit re-parses it)", r.error || "");
}
ok(/not the one this page showed/.test(P.editWatchInSource(source, "ranksy", { before: "something else", after: "x y z", today }).error || ""), "a caveat changed on main since the page loaded is refused");
ok(/same caveat/.test(P.editWatchInSource(source, "ranksy", { before: TOOLS.find((t) => t.id === "ranksy").watch, after: TOOLS.find((t) => t.id === "ranksy").watch, today }).error || ""), "an unchanged caveat is refused");

console.log("\nthe route:");
const ranksy = TOOLS.find((t) => t.id === "ranksy");
const base = { action: "edit-watch", id: "ranksy", toolId: "ranksy", before: ranksy.watch, reason: "The trial is now 14 days." };
ok((await post({ ...base, after: "New caveat text here." }, "vendor@ranksy.test")).status === 404, "a non-admin gets 404");
ok(/No watch note/.test((await post({ ...base, after: "" })).text), "an empty caveat is refused");
ok(/nothing to watch for/.test((await post({ ...base, after: "None" })).text), "\"none\" is refused");
ok(/em-dash/.test((await post({ ...base, after: "Fine — mostly." })).text), "an em dash is refused");
ok(/why the caveat is changing/.test((await post({ ...base, reason: "", after: "A real new caveat." })).text), "a reason is required");
ok(/GITHUB_TOKEN/.test((await post({ ...base, after: "A real new caveat." })).text), "with no token it says so and commits nothing");
ok((await post({ ...base, toolId: "not-a-tool", after: "A real new caveat." })).status === 400, "an unknown tool is refused");
const log = await store.readCapped("svt:watchlog", 50);
ok(log.length >= 5 && log.every((l) => l.by === "admin@test.invalid" && l.ok === false && l.reason !== undefined), "every attempt is logged with who and why", `${log.length} rows`);

console.log("\nthe protection, unchanged for everyone else:");
ok(listings.PROTECTED.includes("watch") && !listings.EDITABLE.includes("watch") && !listings.APPLIABLE.includes("watch"), "watch is protected: no vendor edit, no monitor apply");
ok(listings.sanitiseEdit({ watch: "No downsides!" }).edit === undefined || !("watch" in (listings.sanitiseEdit({ watch: "No downsides!" }).edit || {})), "a vendor edit carrying watch drops it");
await store.write("svt:overrides", { ranksy: { watch: "No downsides!" } });
ok((await listings.mergedTools()).find((t) => t.id === "ranksy").watch === ranksy.watch, "an override carrying watch is ignored");
await store.write("svt:overrides", {});
ok(rewrite.dropReason("watch") === "protected", "an AI rewrite drops it as protected");
ok(/edit-watch/.test(readFileSync(join(ROOT, "components/WatchEditor.jsx"), "utf8")) && /viewer\.admin && <WatchEditor/.test(readFileSync(join(ROOT, "components/ToolPage.jsx"), "utf8")), "the editor renders only for an admin");

console.log(bad ? `\n${bad} failed` : "\nall passed");
process.exit(bad ? 1 : 0);
