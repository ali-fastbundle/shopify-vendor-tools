#!/usr/bin/env node
/*
 * What the monitor can see, and the news it cannot.
 *
 *   node scripts/coverage-test.mjs
 *
 * Built around SAMI: it refuses the monitor, shipped a feature, and the
 * monitor said nothing, which is what it also says about a tool with nothing
 * new. So: every listing gets a coverage state, a quiet listing the monitor
 * cannot read is never shown as covered, the readable pages behind a blocked
 * homepage are actually read (a feed, a client-rendered changelog), a reading
 * missing a page cannot produce a removal, a feature has somewhere to show up
 * in a snapshot, and a vendor's own announcement can reach the feed marked as
 * theirs without the private provenance leaving the admin.
 *
 * No server, no keys, no model: lib/ shimmed into a temp directory and the
 * admin route called directly against the in-memory store, the same harness
 * as monitor-accuracy.mjs.
 */

import { readFileSync, writeFileSync, mkdtempSync, readdirSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { pathToFileURL } from "url";
import { createHmac } from "crypto";

const ROOT = new URL("..", import.meta.url).pathname;
const SECRET = "coverage-test-secret";
process.env.AUTH_SECRET = SECRET;
process.env.ADMIN_EMAILS = "admin@test.invalid";

const dir = mkdtempSync(join(tmpdir(), "svt-coverage-"));
mkdirSync(join(dir, "lib"));
for (const f of readdirSync(join(ROOT, "lib"))) {
  if (!f.endsWith(".js")) continue;
  writeFileSync(join(dir, "lib", f),
    readFileSync(join(ROOT, "lib", f), "utf8").replace(/(from\s+"\.\/[a-zA-Z]+)"/g, '$1.js"'));
}
writeFileSync(join(dir, "route.js"),
  readFileSync(join(ROOT, "app/api/admin/route.js"), "utf8")
    .replace(/from\s+"@\/lib\/([a-zA-Z]+)"/g, 'from "./lib/$1.js"'));
writeFileSync(join(dir, "package.json"), JSON.stringify({ type: "module" }));

const load = (f) => import(pathToFileURL(join(dir, f)).href);
const m = await load("lib/monitor.js");
const cov = await load("lib/coverage.js");
const feed = await load("lib/feed.js");
const { TOOLS } = await load("lib/tools.js");
const { NEWSLETTERS } = await load("lib/newsletters.js");
const { POST } = await load("route.js");

let bad = 0;
const ok = (c, l, d = "") => {
  console.log(`  ${c ? "ok  " : "FAIL"}  ${l}${d ? `  ${d}` : ""}`);
  if (!c) bad += 1;
};

console.log("coverage states:");
{
  const now = Date.parse("2026-10-13T09:00:00Z");
  const fresh = "2026-10-12T09:00:00Z";
  const entries = [
    { id: "sami", name: "SAMI", url: "https://www.tracksami.com" },
    { id: "full", name: "Full", url: "https://full.test" },
    { id: "part", name: "Part", url: "https://part.test", changelogUrl: "https://part.test/changelog" },
    { id: "down", name: "Down", url: "https://down.test" },
    { id: "new", name: "New", url: "https://new.test" },
    { id: "old", name: "Old", url: "https://old.test" },
    { id: "nl", name: "Letter", url: "https://nl.test", kind: "newsletter" },
  ];
  const snaps = {
    /* SAMI as production holds it: a snapshot from before the block, and the flag. */
    sami: { at: "2026-09-01T09:00:00Z", snapshot: { headline: "x" }, blocked: true, blockedWhy: "home: 403", blockedAt: "2026-09-08T09:00:00Z",
      pages: [{ label: "home", state: "blocked", status: "403" }] },
    full: { at: fresh, snapshot: { headline: "x" }, failures: 0, pages: [{ label: "home", state: "ok", status: "200" }] },
    part: { at: fresh, snapshot: { headline: "x" }, failures: 0,
      pages: [{ label: "home", state: "blocked", status: "unreadable (65 chars)" }, { label: "changelog", state: "ok", status: "200" }] },
    down: { at: "2026-09-01T09:00:00Z", snapshot: { headline: "x" }, failures: 2, lastFailureWhy: "home: timeout" },
    old: { at: "2026-08-01T09:00:00Z", snapshot: { headline: "x" }, failures: 0 },
    nl: { at: fresh, snapshot: { headline: "x" }, pages: [{ label: "home", state: "ok", status: "200" }] },
  };
  const rows = cov.coverageOf(entries, snaps, { now });
  const by = Object.fromEntries(rows.map((r) => [r.id, r]));
  ok(by.sami.state === "blocked", "a blocked site is blocked even with an old snapshot on file", by.sami.state);
  ok(/No changelog, blog or feed declared/.test(by.sami.detail), "and says there is nothing else declared to read", by.sami.detail);
  ok(by.full.state === "monitored" && !by.full.partial && !by.full.stale, "a full reading is monitored");
  ok(by.part.state === "monitored" && by.part.partial && /changelog/.test(by.part.detail),
    "a reading through the changelog alone is monitored, in part, and says so", by.part.detail);
  ok(by.down.state === "unreachable", "a failing site is unreachable, not monitored");
  ok(by.new.state === "none" && cov.COVERAGE_LABEL.none === "No source", "never read is No source");
  ok(by.old.stale, "a reading older than three weeks is stale");
  ok(by.nl.kind === "newsletter", "newsletters are covered too");
  ok(rows[0].state === "blocked", "blocked sorts first", rows.map((r) => r.id).join(","));
  const out = cov.uncovered(rows).map((r) => r.id).sort().join(",");
  ok(out === "down,new,old,sami", "uncovered is everything the monitor cannot currently see", out);
  const c = cov.coverageCounts(rows);
  ok(c.total === 7 && c.monitored === 4 && c.blocked === 1 && c.partial === 1, "the counts add up", JSON.stringify(c));
}

console.log("\nreadable pages behind a refused homepage:");
{
  const prose = "I expanded the API so you can bring keyword data into the workflows you already use.";
  const inertia = `<!DOCTYPE html><html><head><title>Ranksy</title></head><body><div id="app"></div>
<script data-page="app" type="application/json">${JSON.stringify({ component: "website/changelog", props: {
    quote: { message: "He who is contented is rich, and other rotating wisdom.", author: "Laozi" },
    csrf: "oslpmaDvI9ypyrn32pKmnDjqD1tKUfcRv9BpUGFh",
    searchPulse: [{ date: "2026-10-01", n: 3 }, { date: "2026-10-02", n: 4 }],
    appChangelogs: [{ id: 69, date: "2026-08-31T00:00:00.000000Z", title: "Performance data API", changelog: prose }],
  } })}</script></body></html>`;
  const t = m.readableText(inertia);
  ok(t.includes(prose), "an Inertia page's changelog is read from its page data");
  ok(t.includes("2026-08-31"), "a changelog entry keeps its date");
  ok(!t.includes("2026-10-01"), "a bare run of chart dates is not read");
  ok(!/contented/.test(t), "a rotating quote is not read, so it cannot look like a weekly change");
  ok(!t.includes("oslpma"), "tokens are not read");
  const next = `<html><body><div id="__next"></div><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { intro: prose } } })}</script></body></html>`;
  ok(m.readableText(next).includes(prose), "so is Next's __NEXT_DATA__");
  const visible = `<main><p>${"A page with plenty of visible text on it. ".repeat(10)}</p></main>`;
  ok(m.readableText(visible) === m.readableText(visible) && m.readableText(visible).startsWith("A page"), "a readable page is read as it always was");

  const rss = `<?xml version="1.0"?><rss><channel><item><title>Category Comparisons</title><link>https://x.test/1</link>
<pubDate>Sat, 11 Oct 2026 09:00:00 GMT</pubDate><description><![CDATA[<p>The whole body of the post, which is theirs.</p>]]></description></item></channel></rss>`;
  const ft = m.feedText(rss);
  ok(ft === "2026-10-11 Category Comparisons", "a feed reads as dated titles", JSON.stringify(ft));
  ok(!/body of the post/.test(ft), "and never the body");
}

console.log("\nthe entries that were blocked:");
{
  const ranksy = TOOLS.find((t) => t.id === "ranksy");
  ok(ranksy?.changelogUrl === "https://ranksyapp.com/changelog", "Ranksy is watched through its changelog");
  const ri = NEWSLETTERS.find((n) => n.id === "retailinsider");
  ok(ri?.changelogUrl === ri?.rss, "Retail Insider is watched through its feed");
  ok(m.pagesFor(ranksy).some((p) => p.label === "changelog"), "and the monitor fetches it");
  const sami = TOOLS.find((t) => t.id === "tracksami");
  ok(!sami.changelogUrl, "SAMI has no changelogUrl: there is none to declare");
  const text = `${sami.one} ${sami.note} ${sami.watch}`;
  ok(!/keyword explorer/i.test(text), "Keyword Explorer is not in SAMI's listing until it ships");
  ok(/compare whole categories/i.test(sami.note), "Category Comparisons is integrated into the note");
  ok(sami.price !== "Not published" && !/not on the marketing site/i.test(sami.watch),
    "the listing no longer says pricing is unpublished");
  ok(!sami.watch.includes("—") && !sami.note.includes("—"), "no em-dash");
}

console.log("\na reading missing a page cannot remove anything:");
{
  const prev = { headline: "x", pricing: [{ tier: "Standard", price: "$8/mo" }], capabilities: ["Compare categories"] };
  const next = { headline: "x", pricing: [], capabilities: [] };
  let snap = prev;
  for (let i = 0; i < 4; i++) snap = m.reconcileSnapshot(snap, next, { partial: true }).snapshot;
  const r = m.reconcileSnapshot(snap, next, { partial: true });
  ok(r.missingTwice.length === 0 && r.snapshot.pricing.length === 1, "four incomplete readings in a row remove nothing");
  ok(r.snapshot.capabilities.includes("Compare categories"), "capabilities are carried like pricing");
}

console.log("\na feature has somewhere to show up:");
{
  const before = { headline: "x", pricing: [], scale: [], integrations: [] };
  const after = { headline: "x", pricing: [], scale: [], integrations: [], capabilities: ["Keyword trends", "Compare categories"] };
  const base = m.withBaseline(before, after);
  ok(m.reconcileSnapshot(base, after).equal, "the first reading with capabilities adopts them as the baseline, rather than reporting all of them as new");
  const later = { ...after, capabilities: [...after.capabilities, "Keyword Explorer"] };
  ok(!m.reconcileSnapshot(after, later).equal, "a newly named feature afterwards is a change, and buys the compare call");
  ok(m.withBaseline(after, later) === after, "a snapshot that already has the field is left alone");
}

console.log("\nvendor announcements:");
{
  const b64 = (s) => Buffer.from(s).toString("base64url");
  const body = b64(JSON.stringify({ t: "session", email: "admin@test.invalid", exp: Date.now() + 864e5 }));
  const COOKIE = `svt_session=${body}.${createHmac("sha256", SECRET).update(body).digest("base64url")}`;
  const call = (payload) => POST(new Request("http://localhost/api/admin", {
    method: "POST", headers: { cookie: COOKIE, "content-type": "application/json" }, body: JSON.stringify(payload),
  }));
  const anon = await POST(new Request("http://localhost/api/admin", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "post-vendor-announcement", id: "tracksami", headline: "x".repeat(20), announcedOn: "2026-10-11" }),
  }));
  ok(anon.status === 404, "signed out, the route does not exist", `HTTP ${anon.status}`);

  const HEAD = "Added Category Comparisons, which sets App Store categories side by side on pricing, ratings, reviews and Built for Shopify share.";
  const good = { action: "post-vendor-announcement", id: "tracksami", headline: HEAD, sourceUrl: "https://www.tracksami.com",
    announcedOn: "2026-10-11", sourceNote: "Email from the founder" };

  ok((await call({ ...good, id: "nope" })).status === 400, "an unknown tool is refused");
  ok((await call({ ...good, headline: "Added it — finally." })).status === 400, "an em-dash is refused");
  ok((await call({ ...good, announcedOn: "" })).status === 400, "a vendor announcement needs its date");
  ok((await call({ ...good, sourceUrl: "javascript:alert(1)" })).status === 400, "a non-http source is refused");

  const res = await call(good);
  ok(res.status === 200, "a well-formed announcement is published", `HTTP ${res.status}`);
  const { feedEntry } = await res.json();
  ok(feedEntry.source === "vendor" && feedEntry.announcedOn === "2026-10-11", "marked as the vendor's, with the date they said it");
  ok(feedEntry.kind === "new-capability", "kind defaults to new capability");

  const pub = await feed.feedEntries({ limit: 10 });
  const row = pub.find((r) => r.id === feedEntry.id);
  ok(row && row.source === "vendor", "it is on the public feed");
  ok(row && !("sourceNote" in row) && !("publishedBy" in row), "without the private note or the admin's address");
  const priv = await feed.feedEntries({ limit: 10, withPrivate: true });
  ok(priv.find((r) => r.id === feedEntry.id)?.sourceNote === "Email from the founder", "which the admin read keeps");

  const observed = await feed.addEntry({ headline: "An observed change, published from a finding." }, { tool: { id: "ranksy", name: "Ranksy", cat: "aso" } });
  ok((await call({ action: "unpublish-announcement", id: observed.id })).status === 400,
    "an observed row is not unpublished from here");
  ok((await call({ action: "unpublish-announcement", id: feedEntry.id })).status === 200, "a vendor announcement is");
  ok(!(await feed.feedEntries({ limit: 10 })).some((r) => r.id === feedEntry.id), "and leaves the public feed");
  ok((await feed.getFeed()).some((r) => r.id === feedEntry.id && r.deletedAt), "softly: the row is kept");
}

console.log(bad ? `\n${bad} failed` : "\nall passed");
process.exit(bad ? 1 : 0);
