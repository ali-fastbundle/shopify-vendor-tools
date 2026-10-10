#!/usr/bin/env node
/*
 * The subscriber list on /admin: one row per address, honest about consent,
 * removable, and never written anywhere an address should not be.
 *
 *   node scripts/subscribers-test.mjs
 *
 * No server, no keys. Runs the library and the admin route against the
 * in-memory store, captures the console while removing, and reads the
 * sources for the two rules a test of behaviour cannot see: no route returns
 * the list, and Reveal is not remembered.
 */
import { register } from "node:module";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHmac } from "node:crypto";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const k of Object.keys(process.env)) if (/^(UPSTASH|KV)_|^RESEND/.test(k)) delete process.env[k];
process.env.AUTH_SECRET = "subscribers-test-secret";
process.env.ADMIN_EMAILS = "admin@example.com";
const hook = `
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
const ROOT = ${JSON.stringify(pathToFileURL(root + "/").href)};
export async function resolve(spec, ctx, next) {
  let target = null;
  if (spec.startsWith("@/")) target = new URL(spec.slice(2), ROOT).href;
  else if ((spec.startsWith("./") || spec.startsWith("../")) && ctx.parentURL) target = new URL(spec, ctx.parentURL).href;
  if (target && !/\\.[mc]?jsx?$/.test(target)) {
    for (const ext of [".js", ".jsx"]) if (existsSync(fileURLToPath(target + ext))) return next(target + ext, ctx);
  }
  return next(spec, ctx);
}`;
register("data:text/javascript," + encodeURIComponent(hook));

let failed = 0;
const ok = (cond, what, extra = "") => { console.log(`  ${cond ? "ok  " : "FAIL"}  ${what}${extra ? `  ${extra}` : ""}`); if (!cond) failed++; };
const L = (p) => import(pathToFileURL(join(root, p)).href);

const { write, read, readMailLog, KEYS } = await L("lib/store.js");
const { subscriberRows } = await L("lib/subscriberList.js");
const { NEWSLETTERS } = await L("lib/newsletters.js");
const nl = NEWSLETTERS[0];

await write(KEYS.subscribers, [
  { email: "old@site.example", date: "2026-08-01" },
  { email: "signed@site.example", date: "2026-09-01" },
  { email: "both@site.example", date: "2026-07-15" },
]);
await write(KEYS.follows, {
  "both@site.example": { since: "2026-10-01", items: { [nl.id]: "2026-10-01" } },
  "follower@site.example": { since: "2026-10-05", items: { [nl.id]: "2026-10-05" } },
});
await write(KEYS.accounts, { "signed@site.example": { email: "signed@site.example", firstSeen: "2026-09-01", lastSeen: "2026-09-02" } });

console.log("\none row per address, newest first:");
const rows = await subscriberRows();
ok(rows.map((r) => r.email).join() === "follower@site.example,signed@site.example,old@site.example,both@site.example",
  "four addresses, sorted by when they first joined anything", rows.map((r) => `${r.email}@${r.joined}`).join(" "));
const both = rows.find((r) => r.email === "both@site.example");
ok(both.site && both.items.length === 1 && both.joined === "2026-07-15", "on both lists is one row, joined at the earlier date");
ok(both.items[0].name === nl.name, "a follow names the item, not just its id");

console.log("\nconfirmed means something proved the inbox:");
ok(rows.find((r) => r.email === "follower@site.example").confirmed === "follow", "a follow is confirmed by its link");
ok(rows.find((r) => r.email === "signed@site.example").confirmed === "sign-in", "a site-wide address that has signed in is confirmed by the sign-in");
ok(rows.find((r) => r.email === "old@site.example").confirmed === "", "a site-wide address with nothing else is not confirmed, and says so");

console.log("\nremove, through the admin route:");
const route = await L("app/api/admin/route.js");
const sess = (email) => { const b = Buffer.from(JSON.stringify({ t: "session", email, exp: Date.now() + 3600e3 })).toString("base64url"); return `svt_session=${b}.${createHmac("sha256", process.env.AUTH_SECRET).update(b).digest("base64url")}`; };
const call = (body, cookie = sess("admin@example.com")) => route.POST(new Request("http://localhost:3000/api/admin", {
  method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": "10.7.0.1", cookie }, body: JSON.stringify(body) }));

ok((await call({ action: "remove-subscriber", email: "both@site.example" }, "")).status === 404, "signed out: 404");
ok((await call({ action: "remove-subscriber", email: "both@site.example" }, sess("x@example.com"))).status === 404, "not an admin: 404");
ok((await call({ action: "remove-subscriber", email: "not an address" })).status === 400, "something that is not an address is refused");

const logged = [];
const orig = { log: console.log, warn: console.warn, error: console.error, info: console.info };
for (const k of Object.keys(orig)) console[k] = (...a) => { logged.push(a.map(String).join(" ")); };
const mailBefore = (await readMailLog(500)).length;
const res = await call({ action: "remove-subscriber", email: " Both@Site.Example " });
const body = await res.json().catch(() => ({}));
const again = await call({ action: "remove-subscriber", email: "both@site.example" });
Object.assign(console, orig);

ok(res.status === 200 && body.removed === true && Object.keys(body).join() === "removed", "an admin remove answers removed and nothing else, no list");
const site = await read(KEYS.subscribers, []);
const follows = await read(KEYS.follows, {});
ok(!site.some((s) => s.email === "both@site.example") && !follows["both@site.example"], "the address is off the site-wide list and every follow");
ok(site.length === 2 && Object.keys(follows).length === 1, "and nobody else was touched");
ok(again.status === 409, "removing it again says it is not on any list");
ok(!logged.some((l) => /@site\.example/i.test(l)), "no address reached the console", logged.join(" | ").slice(0, 120));
ok((await readMailLog(500)).length === mailBefore, "nothing was written to the mail log");

console.log("\nthe sources:");
const walk = (d, out = []) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p, out); else if (/route\.js$/.test(f)) out.push(p); } return out; };
const returning = walk(join(root, "app/api")).filter((p) => /subscriberRows|getSubscribers\(\)[\s\S]{0,80}Response\.json/.test(readFileSync(p, "utf8")));
ok(returning.length === 0, "no route returns the list", returning.map((p) => p.slice(root.length + 1)).join(", "));
const admin = readFileSync(join(root, "components/Admin.jsx"), "utf8");
const panel = admin.slice(admin.indexOf("function Subscribers("), admin.indexOf("function Subscribers(") + 4000);
ok(/useState\(false\)/.test(panel) && /blur\(/.test(panel), "addresses start blurred");
ok(!/localStorage|sessionStorage|document\.cookie/.test(panel), "and Reveal is not remembered anywhere");
ok(/Bcc/.test(panel), "Copy all still says to send with the addresses hidden from each other");

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
