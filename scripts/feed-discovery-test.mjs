#!/usr/bin/env node
/*
 * Feed and changelog discovery, verification, and the monitor preferring
 * a feed over a snapshot diff. node scripts/feed-discovery-test.mjs
 *
 *   node scripts/follow-test.mjs
 *
 * No server and no keys. lib/ and the route handlers are loaded directly with
 * an import hook that resolves `@/` and extensionless paths, against the
 * in-memory store (no UPSTASH variables are set here). The network is stubbed:
 * feeds come from fixtures and Resend from a fetch that records what it was
 * given, so the assertions are about the emails that would have gone out.
 */
import { register } from "node:module";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const k of Object.keys(process.env)) if (/^(UPSTASH|KV)_/.test(k)) delete process.env[k];
process.env.AUTH_SECRET = "feeds-secret";
process.env.RESEND_API_KEY = "re_test";
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
const L = (p) => import(pathToFileURL(join(root, p)).href);
const D = await L("lib/feedDiscovery.js");
const Mon = await L("lib/monitor.js");
const { getSnapshots } = Mon;
const fs = await import("node:fs");
let failed = 0;
const ok = (c, w, x = "") => { console.log(`  ${c ? "ok  " : "FAIL"}  ${w}${x ? `  ${x}` : ""}`); if (!c) failed++; };
const today = new Date().toISOString().slice(0, 10);
const daysAgo = (n) => new Date(Date.now() - n * 864e5).toUTCString();
const rss = (dates) => `<?xml version="1.0"?><rss><channel>${dates.map((d, i) => `<item><title>Item ${i}</title><link>https://x.test/${i}</link><guid>g${i}-${d}</guid><pubDate>${d}</pubDate></item>`).join("")}</channel></rss>`;

console.log("what a page offers:");
const html = `<html><head><link rel="alternate" type="application/rss+xml" href="/feed.xml"><link rel="alternate" type="application/rss+xml" href="/comments/feed"></head><body><nav><a href="/pricing">Pricing</a><a href="/changelog">Changelog</a><a href="https://other.test/whats-new">What's new</a></nav><footer><a href="/release-notes">Release notes</a></footer></body></html>`;
const l = D.linksIn(html, "https://tool.test/");
ok(l.feeds.join() === "https://tool.test/feed.xml", "a feed link in the head, and never a comments feed", l.feeds.join());
ok(l.pages.includes("https://tool.test/changelog") && l.pages.includes("https://tool.test/release-notes") && !l.pages.some((u) => u.includes("other.test")), "changelog links in the nav and footer, on the tool's own domain only");
ok(D.newestDateIn("<p>March 3, 2026</p><p>2025-01-02</p><p>12 Jan 2024</p>") === "2026-03-03", "the newest date written on a changelog page");
ok(D.verdict(today) === "active" && D.verdict("2024-01-01") === "stale" && D.verdict("") === "", "active within twelve months, stale before");

console.log("\ndiscovery:");
const site = (pages) => async (url) => {
  const p = pages[url];
  if (p === undefined) return { url, ok: false, state: "unreachable", status: "404" };
  if (p === 403) return { url, ok: false, state: "blocked", status: "403" };
  return { url, finalUrl: url, ok: true, state: "ok", status: "200", type: p.type || "text/html", body: p.body };
};
let r = await D.discoverEntry({ id: "a", url: "https://tool.test/" }, { fetchRaw: site({
  "https://tool.test/": { body: html },
  "https://tool.test/feed.xml": { type: "application/rss+xml", body: rss([daysAgo(10), daysAgo(40)]) },
}) });
ok(r.state === "active" && r.feedUrl === "https://tool.test/feed.xml" && /head/.test(r.how) && r.foundAt, "a declared feed is found, verified, and recorded with how and when", r.how);
r = await D.discoverEntry({ id: "b", url: "https://old.test/" }, { fetchRaw: site({
  "https://old.test/": { body: "<html><body>nothing</body></html>" },
  "https://old.test/changelog": { body: "<html><body><h2>Shipped</h2><p>2023-05-01</p></body></html>" },
}) });
ok(r.state === "stale" && r.changelogUrl === "https://old.test/changelog" && /common path/.test(r.how), "a changelog found on a common path with nothing in a year is recorded as stale", `${r.state} ${r.how}`);
r = await D.discoverEntry({ id: "sami", url: "https://blocked.test/" }, { fetchRaw: site({
  "https://blocked.test/": 403,
  "https://blocked.test/feed": { type: "application/atom+xml", body: `<feed><entry><id>x1</id><title>Category comparisons</title><link href="https://blocked.test/c"/><updated>${new Date().toISOString()}</updated></entry></feed>` },
}) });
ok(r.state === "active" && r.feedUrl === "https://blocked.test/feed" && r.homepage === "blocked", "a blocked homepage still gets the common paths, and a feed there restores coverage");
let calls = 0;
r = await D.discoverEntry({ id: "c", url: "https://hand.test/", changelogUrl: "https://hand.test/my-log" }, { fetchRaw: async (u) => { calls++; return site({ "https://hand.test/my-log": { body: `<html><p>${today}</p></html>` } })(u); } });
ok(r.hand && r.changelogUrl === "https://hand.test/my-log" && r.how === "set by hand" && calls === 1, "a value set by hand is verified, never replaced, and discovery does not run");
r = await D.discoverEntry({ id: "d", url: "https://none.test/" }, { fetchRaw: site({ "https://none.test/": { body: "<html>x</html>" } }) });
ok(r.state === "none" && /nothing found/.test(r.status), "nothing anywhere is recorded as none, with how many places were tried");
r = await D.discoverEntry({ id: "e", url: "https://bad.test/" }, { fetchRaw: site({ "https://bad.test/": { body: "<html>x</html>" }, "https://bad.test/feed": { type: "application/rss+xml", body: "<rss><channel></channel></rss>" } }) });
ok(r.state === "none", "a feed that does not parse into entries counts for nothing");

console.log("\nthe run:");
const entries = [{ id: "sami", url: "https://blocked.test/" }, { id: "x", url: "https://none.test/" }];
const order = [];
await D.runDiscovery(entries, { blind: ["x"], fetchRaw: async (u) => { order.push(u); return { url: u, ok: false, state: "unreachable", status: "404" }; } });
ok(order[0] === "https://none.test/", "the entries the monitor cannot see go first");
const cov = D.feedCoverage([{ id: "a" }, { id: "b" }, { id: "c" }], { a: { state: "active" }, b: { state: "stale" } }, ["a", "c"]);
ok(cov.active === 1 && cov.stale === 1 && cov.none === 1 && cov.blockedCovered.join() === "a" && cov.blockedNot.join() === "c", "coverage: active, stale, none, and which blocked ones a feed covers");

console.log("\nthe monitor prefers the feed:");
ok(Mon.pagesFor({ url: "https://t.test" }, { state: "active", feedUrl: "https://t.test/feed" }).some((p) => p.url === "https://t.test/feed") && !Mon.pagesFor({ url: "https://t.test" }, { state: "stale", feedUrl: "https://t.test/feed" }).some((p) => p.label === "changelog"), "an active discovered feed is read, a stale one is not");
ok(Mon.pagesFor({ url: "https://t.test", changelogUrl: "https://t.test/hand" }, { state: "active", feedUrl: "https://t.test/feed" }).find((p) => p.label === "changelog").url === "https://t.test/hand", "a hand value wins over a discovered one");
const items1 = [{ key: "k1", title: "Slack alerts", link: "https://t.test/1", date: "2026-10-01T00:00:00Z" }];
const first = Mon.feedFindings({ id: "t" }, items1, null);
ok(first.changes.length === 0 && first.seen.keys.includes("k1"), "the first read of a feed is a baseline, not news");
const items2 = [{ key: "k2", title: "Keyword alerts by email", link: "https://t.test/2", date: "2026-10-20T00:00:00Z" }, ...items1];
const second = Mon.feedFindings({ id: "t" }, items2, first.seen);
ok(second.changes.length === 1 && second.changes[0].kind === "shipped" && second.changes[0].confidence === 0.9 && second.changes[0].verification === "vendor-stated", "a new entry is a finding at 0.9: the vendor stated it");
const src = fs.readFileSync(join(root, "lib/monitor.js"), "utf8");
ok(/filter\(\(c\) => c\.kind !== "new-capability"\)/.test(src), "with a working feed, the snapshot's inferred new-capability findings are dropped");
ok(/row\.kind === "shipped"/.test(src), "and a changelog finding does not wait on a second run to be believed");
ok(/feedPageFor|found\.state === "active"/.test(src) && !/from "\.\/feedDiscovery"/.test(src), "the monitor reads discovery's records without importing it");

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
