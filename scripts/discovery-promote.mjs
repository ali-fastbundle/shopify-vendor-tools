#!/usr/bin/env node
/*
 * Promoting a discovered competitor into the suggestion queue.
 *
 *   node scripts/discovery-promote.mjs
 *
 * The point of this path is that it creates a suggestion and then gets out of
 * the way, so the things worth asserting are the ones that would let a second
 * pipeline grow back or let a lead escape as a community suggestion:
 *
 *   - it makes exactly one row, and a second click finds the first
 *   - the row is held and is never in the public list, whatever
 *     MODERATE_SUGGESTIONS says
 *   - something already in the directory is refused rather than queued
 *
 * The route is called directly with a plain Request, as in
 * scripts/feed-independence.mjs.
 */

import { readFileSync, writeFileSync, mkdtempSync, readdirSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { pathToFileURL } from "url";
import { createHmac } from "crypto";

const ROOT = new URL("..", import.meta.url).pathname;
const SECRET = "discovery-promote-test-secret";
process.env.AUTH_SECRET = SECRET;
process.env.ADMIN_EMAILS = "admin@test.invalid";
/* The public list must drop these even when nothing is holding them back. */
process.env.MODERATE_SUGGESTIONS = "";

const dir = mkdtempSync(join(tmpdir(), "svt-promote-"));
mkdirSync(join(dir, "lib"));
for (const f of readdirSync(join(ROOT, "lib"))) {
  if (!f.endsWith(".js")) continue;
  writeFileSync(join(dir, "lib", f),
    readFileSync(join(ROOT, "lib", f), "utf8").replace(/(from\s+"\.\/[a-zA-Z]+)"/g, '$1.js"'));
}
const route = (src) => src.replace(/from\s+"@\/lib\/([a-zA-Z]+)"/g, 'from "./lib/$1.js"');
writeFileSync(join(dir, "admin.js"), route(readFileSync(join(ROOT, "app/api/admin/route.js"), "utf8")));

const load = (f) => import(pathToFileURL(join(dir, f)).href);
const { POST } = await load("admin.js");
const store = await load("lib/store.js");

const b64 = (s) => Buffer.from(s).toString("base64url");
const body = b64(JSON.stringify({ t: "session", email: "admin@test.invalid", exp: Date.now() + 864e5 }));
const COOKIE = `svt_session=${body}.${createHmac("sha256", SECRET).update(body).digest("base64url")}`;

const call = (payload) => POST(new Request("http://localhost/api/admin", {
  method: "POST", headers: { cookie: COOKIE, "content-type": "application/json" },
  body: JSON.stringify(payload),
}));

let bad = 0;
const ok = (c, l, d = "") => {
  console.log(`  ${c ? "ok  " : "FAIL"}  ${l}${d ? `  ${d}` : ""}`);
  if (!c) bad += 1;
};

const FINDING = {
  action: "promote-discovery",
  name: "Apptics", url: "https://apptics.invalid",
  namedBy: ["Applora", "SAMI"],
  contexts: ["Applora: listed as an alternative on their compare page"],
};

console.log("promoting a new finding:");
let firstId = "";
{
  const res = await call(FINDING);
  ok(res.status === 200, "returns 200", `HTTP ${res.status} ${res.status === 200 ? "" : await res.clone().text()}`);
  const d = await res.json();
  const rows = await store.read(store.KEYS.suggestions, []);
  ok(rows.length === 1, "one suggestion row exists", `${rows.length}`);
  const row = rows[0];
  firstId = row.id;
  ok(row.via === "discovery", "stamped as coming from discovery");
  ok(row.approved === false, "held, even with MODERATE_SUGGESTIONS unset");
  ok(row.namedBy?.length === 2, "keeps who named it, which is the evidence for looking");
  ok(row.kind === "tool", "queued as a tool");
  ok(Boolean(row.why), "carries a why, so the queue row is readable");
  ok(d.suggestion?.id === row.id, "hands the caller the row to research");
}

console.log("\nclicking it again:");
{
  const res = await call(FINDING);
  ok(res.status === 200, "still 200", `HTTP ${res.status}`);
  const d = await res.json();
  const rows = await store.read(store.KEYS.suggestions, []);
  ok(rows.length === 1, "no second row", `${rows.length}`);
  ok(d.alreadyQueued === true, "says so");
  ok(d.suggestion?.id === firstId, "and returns the row that already exists");
}

console.log("\nsomething already in the directory:");
{
  const res = await call({ action: "promote-discovery", name: "Applora", url: "https://applora.io" });
  ok(res.status === 400, "refused", `HTTP ${res.status}`);
  ok((await res.text()).includes("already in the directory"), "and says why");
  ok((await store.read(store.KEYS.suggestions, [])).length === 1, "nothing queued");
}

console.log("\nno name:");
{
  const res = await call({ action: "promote-discovery", name: "", url: "https://x.invalid" });
  ok(res.status === 400, "refused", `HTTP ${res.status}`);
}

console.log("\nthe public list:");
{
  /* publicList lives in the suggest route, so it is read rather than imported:
     importing it would pull in the whole submission path and its rate limiter. */
  const src = readFileSync(join(ROOT, "app/api/suggest/route.js"), "utf8");
  ok(/via !== "discovery"/.test(src), "drops discovery rows explicitly");
  ok(/approved !== false/.test(src), "as well as anything held");
}

console.log(`\n${bad ? `${bad} FAILED` : "all passed"}`);
process.exit(bad ? 1 : 0);
