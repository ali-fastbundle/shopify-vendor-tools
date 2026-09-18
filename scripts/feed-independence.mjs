#!/usr/bin/env node
/*
 * Publishing to the feed must not touch the listing, and applying to the
 * listing must not touch the feed.
 *
 *   node scripts/feed-independence.mjs
 *
 * Invariant 31 says a finding has three independent destinations, and a
 * pricing move usually needs two of them. "Independent" is the sort of claim
 * that is true when it is written and quietly stops being true the first time
 * somebody makes one handler call the other for convenience. Reading the route
 * proves it today; this proves it every time it runs.
 *
 * The route is called directly rather than over HTTP. It takes a plain Request
 * and returns a plain Response, so a server adds nothing but a port to free and
 * a process whose in-memory store this one cannot seed. The @/lib alias is
 * rewritten to relative paths in the shim, the same trick feed-test.mjs uses
 * for extensions.
 */

import { readFileSync, writeFileSync, mkdtempSync, readdirSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { pathToFileURL } from "url";
import { createHmac } from "crypto";

const ROOT = new URL("..", import.meta.url).pathname;
const SECRET = "feed-independence-test-secret";
process.env.AUTH_SECRET = SECRET;
process.env.ADMIN_EMAILS = "admin@test.invalid";

const dir = mkdtempSync(join(tmpdir(), "svt-indep-"));
mkdirSync(join(dir, "lib"));
for (const f of readdirSync(join(ROOT, "lib"))) {
  if (!f.endsWith(".js")) continue;
  writeFileSync(join(dir, "lib", f),
    readFileSync(join(ROOT, "lib", f), "utf8").replace(/(from\s+"\.\/[a-zA-Z]+)"/g, '$1.js"'));
}
writeFileSync(join(dir, "route.js"),
  readFileSync(join(ROOT, "app/api/admin/route.js"), "utf8")
    .replace(/from\s+"@\/lib\/([a-zA-Z]+)"/g, 'from "./lib/$1.js"'));

const load = (f) => import(pathToFileURL(join(dir, f)).href);
const { POST } = await load("route.js");
const store = await load("lib/store.js");
const feed = await load("lib/feed.js");
const listings = await load("lib/listings.js");

const b64 = (s) => Buffer.from(s).toString("base64url");
const body = b64(JSON.stringify({ t: "session", email: "admin@test.invalid", exp: Date.now() + 864e5 }));
const COOKIE = `svt_session=${body}.${createHmac("sha256", SECRET).update(body).digest("base64url")}`;

const call = (payload) => POST(new Request("http://localhost/api/admin", {
  method: "POST",
  headers: { cookie: COOKIE, "content-type": "application/json" },
  body: JSON.stringify(payload),
}));

let bad = 0;
const ok = (c, l, d = "") => {
  console.log(`  ${c ? "ok  " : "FAIL"}  ${l}${d ? `  ${d}` : ""}`);
  if (!c) bad += 1;
};

/* A finding that legitimately wants both destinations: a price moved. */
const TOOL = "applora";
const CHANGE = {
  id: "chg-test-1", at: new Date().toISOString(), entryId: TOOL, kind: "pricing",
  what: "Starter went from $49 to $79 a month.", old: "$49/mo", new: "$79/mo",
  url: "https://applora.io/pricing", confidence: 0.9,
  edit: { state: "appliable", field: "price", from: "from $49/mo", to: "from $79/mo" },
};
/* The changelog is a capped list of JSON strings, not an array under one key,
   so it is seeded through the same helper the monitor writes it with. */
await store.pushCapped(store.KEYS.changelog, [CHANGE]);

const overridesNow = () => store.read("svt:overrides", {});

console.log("publish to feed:");
{
  const before = await overridesNow();
  const res = await call({ action: "publish-to-feed", id: CHANGE.id, headline: "Starter went from $49 to $79 a month." });
  ok(res.status === 200, "returns 200", `HTTP ${res.status} ${res.status === 200 ? "" : await res.clone().text()}`);
  const entries = await feed.feedEntries();
  ok(entries.length === 1, "the feed has the entry", `${entries.length}`);
  ok(entries[0]?.toolId === TOOL, "against the right tool");
  const after = await overridesNow();
  ok(JSON.stringify(before) === JSON.stringify(after), "and the listing overrides are untouched",
    JSON.stringify(after).slice(0, 80));
  const merged = await listings.mergedTools();
  ok(merged.find((t) => t.id === TOOL)?.price !== "from $79/mo",
    "the listing still shows the old price, because publishing is not applying");
}

console.log("\napply to the listing:");
{
  const res = await call({ action: "apply-change", id: CHANGE.id });
  ok(res.status === 200, "returns 200", `HTTP ${res.status}`);
  const merged = await listings.mergedTools();
  ok(merged.find((t) => t.id === TOOL)?.price === "from $79/mo", "the listing now shows the new price");
  const entries = await feed.feedEntries();
  ok(entries.length === 1, "and the feed did not gain a second entry", `${entries.length}`);
}

console.log("\nundo the listing edit:");
{
  const res = await call({ action: "undo-change", id: CHANGE.id });
  ok(res.status === 200, "returns 200", `HTTP ${res.status}`);
  const entries = await feed.feedEntries();
  ok(entries.length === 1, "the feed entry survives an undo of the listing",
    "the two destinations are independent in both directions");
}

console.log("\nunpublish from the feed:");
{
  const res = await call({ action: "unpublish-from-feed", id: CHANGE.id });
  ok(res.status === 200, "returns 200", `HTTP ${res.status}`);
  ok((await feed.feedEntries()).length === 0, "gone from the public feed");
  ok((await store.read("svt:feed", [])).some((r) => r.deletedAt), "but kept with a deletedAt");
}

console.log(`\n${bad ? `${bad} FAILED` : "all passed"}`);
process.exit(bad ? 1 : 0);
