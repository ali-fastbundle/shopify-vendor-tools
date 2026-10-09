#!/usr/bin/env node
/*
 * Following newsletters and events: the double opt-in, detection, and one
 * digest per person.
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
process.env.AUTH_SECRET = "follow-test-secret";
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

/* Resend, recorded. Anything else that reaches the network is a test bug. */
const sent = [];
let resendDown = false;
globalThis.fetch = async (url, init = {}) => {
  if (String(url).includes("api.resend.com")) {
    if (resendDown) return new Response("down", { status: 500 });
    sent.push(JSON.parse(init.body));
    return new Response("{}", { status: 200 });
  }
  throw new Error(`unexpected network call in test: ${url}`);
};
const quiet = console.log;
console.log = (...a) => { if (!String(a[0]).startsWith("[mail]")) quiet(...a); };
const loud = console.error;
console.error = (...a) => { if (!String(a[0]).startsWith("[mail]")) loud(...a); };

const L = (p) => import(pathToFileURL(join(root, p)).href);
const { parseFeed, newSince, rememberFeed } = await L("lib/feeds.js");
const { dueMilestone, detect, send } = await L("lib/notify.js");
const { getFollows, addFollow, removeFollow, stopToken, validStopToken } = await L("lib/follows.js");
const { read, write, KEYS } = await L("lib/store.js");
const { mintFollowToken } = await L("lib/auth.js");
const follow = await L("app/api/follow/route.js");
const confirm = await L("app/api/follow/confirm/route.js");
const remove = await L("app/api/follow/remove/route.js");

let failed = 0;
const ok = (cond, what, extra = "") => {
  quiet(`  ${cond ? "ok  " : "FAIL"}  ${what}${extra ? `  ${extra}` : ""}`);
  if (!cond) failed++;
};
const req = (path, body, headers = {}) => new Request(`http://localhost:3000${path}`, body
  ? { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": headers.ip || "10.0.0.1", ...headers }, body: JSON.stringify(body) }
  : { headers: { "x-forwarded-for": "10.0.0.1" } });

/* ---------------- the feed reader ---------------- */
quiet("\nreading a feed takes titles and links, never bodies:");
const rss = (items) => `<?xml version="1.0"?><rss><channel><title>CPGD</title>${items.map((i) => `
  <item><title><![CDATA[${i.t}]]></title><link>${i.l}</link><guid>${i.g || i.l}</guid>
  <pubDate>${i.d}</pubDate><description><![CDATA[SECRET BODY ${i.t}]]></description><content:encoded>SECRET BODY</content:encoded></item>`).join("")}</channel></rss>`;
const base = [
  { t: "Issue 3", l: "https://cpgdxyz.substack.com/p/three", d: "Mon, 05 Oct 2026 08:00:00 GMT" },
  { t: "Issue 2 &amp; more", l: "https://cpgdxyz.substack.com/p/two", d: "Mon, 28 Sep 2026 08:00:00 GMT" },
];
const parsed = parseFeed(rss(base));
ok(parsed.length === 2 && parsed[0].title === "Issue 3", "RSS items, newest first");
ok(parsed[1].title === "Issue 2 & more", "entities and CDATA decoded");
ok(!JSON.stringify(parsed).includes("SECRET BODY"), "no description or content is kept");
const atom = `<feed><entry><id>tag:x,1</id><title>Atom one</title><link rel="alternate" href="https://x.com/1"/><updated>2026-10-01T00:00:00Z</updated><content>SECRET BODY</content></entry></feed>`;
ok(parseFeed(atom)[0]?.link === "https://x.com/1" && !JSON.stringify(parseFeed(atom)).includes("SECRET"), "Atom entries too");
ok(parseFeed("<html>not a feed</html>").length === 0, "something that is not a feed yields nothing, not everything");

quiet("\nwhat counts as new:");
ok(newSince(parsed, null).length === 0, "the first read is a baseline: nothing is new");
const mem = rememberFeed(parsed);
const plus = parseFeed(rss([{ t: "Issue 4", l: "https://cpgdxyz.substack.com/p/four", d: "Mon, 12 Oct 2026 08:00:00 GMT" }, ...base]));
ok(newSince(plus, mem).map((i) => i.title).join() === "Issue 4", "one new issue is one new item");
const rekeyed = parseFeed(rss(base.map((b) => ({ ...b, g: `new-scheme-${b.t}` }))));
ok(newSince(rekeyed, mem).length === 0, "a feed that changes its guids does not resend old issues");
const flood = parseFeed(rss(Array.from({ length: 9 }, (_, i) => ({ t: `Burst ${i}`, l: `https://x.com/b${i}`, d: `Tue, 13 Oct 2026 0${i}:00:00 GMT` }))));
ok(newSince(flood, mem).length === 3, "at most three new issues per run");

quiet("\nevent reminders:");
ok(dueMilestone(40, []) === null, "40 days out: nothing");
ok(dueMilestone(30, []) === 30, "30 days out: the 30-day reminder");
ok(dueMilestone(20, [30]) === null, "20 days out, 30 already sent: nothing");
ok(dueMilestone(7, [30]) === 7, "7 days out: the 7-day reminder");
ok(dueMilestone(5, []) === 7, "first seen 5 days out: the 7-day line, not a 30-day one");
ok(dueMilestone(-1, []) === null, "after it starts: nothing");

/* ---------------- the double opt-in ---------------- */
quiet("\nthe double opt-in:");
let res = await follow.POST(req("/api/follow", { id: "cpgd", email: "reader@example.org" }));
let j = await res.json();
ok(res.status === 200 && j.confirmed === false, "a signed-out follow asks for confirmation");
ok(Object.keys(await getFollows()).length === 0, "and stores nothing until it is confirmed");
const confirmMail = sent.find((m) => /Confirm: updates about CPGD/.test(m.subject));
ok(Boolean(confirmMail), "the confirmation email went to the address", confirmMail?.to);
const link = (confirmMail?.text.match(/https?:\/\/\S+\/api\/follow\/confirm\?token=\S+/) || [])[0];
ok(Boolean(link), "it carries a confirm link");
res = await confirm.GET(new Request(link, { headers: { "x-forwarded-for": "10.0.0.1" } }));
ok(res.status === 200 && Boolean((await getFollows())["reader@example.org"]?.items?.cpgd), "clicking it stores the follow");
res = await confirm.GET(new Request("http://localhost:3000/api/follow/confirm?token=forged.token"));
ok(res.status === 400, "a forged confirm link is refused");
ok((await follow.POST(req("/api/follow", { id: "kollectify", email: "x@example.org" }))).status === 400, "a tool cannot be followed this way");
ok((await follow.POST(req("/api/follow", { id: "dotdigital-summit", email: "x@example.org" }))).status === 400, "nor a drafted event");

const before = sent.length;
for (let i = 0; i < 4; i++) await follow.POST(req("/api/follow", { id: "web-summit", email: "stranger@example.org" }, { ip: `10.1.0.${i}` }));
ok(sent.length - before === 3, "one address gets at most three confirmations a day, from any number of IPs", `${sent.length - before} sent`);

const { createHmac } = await import("node:crypto");
const sess = (email) => { const b = Buffer.from(JSON.stringify({ t: "session", email, exp: Date.now() + 3600e3 })).toString("base64url"); return `svt_session=${b}.${createHmac("sha256", process.env.AUTH_SECRET).update(b).digest("base64url")}`; };
res = await follow.POST(req("/api/follow", { id: "web-summit", email: "member@example.org" }, { cookie: sess("member@example.org") }));
ok((await res.json()).confirmed === true && Boolean((await getFollows())["member@example.org"]), "signed in with the same address: followed at once");
res = await follow.POST(req("/api/follow", { id: "web-summit", email: "victim@example.org" }, { cookie: sess("member@example.org") }));
ok((await res.json()).confirmed === false && !(await getFollows())["victim@example.org"], "signed in but a different address: still needs confirming");

/* ---------------- detection and the digest ---------------- */
quiet("\none digest per person:");
await addFollow("reader@example.org", "web-summit");
await addFollow("reader@example.org", "retailinsider");
await addFollow("reader@example.org", "shopifyappfounders");
let feed = rss(base);
const feeds = { "https://cpgdxyz.substack.com/feed": () => feed, "https://retail-insider.com/feed": () => rss([]) };
const fetchFeed = async (u) => parseFeed(feeds[u] ? feeds[u]() : "");

let r = await detect({ fetchFeed, today: "2026-09-01", now: "2026-09-01T08:00:00Z" });
ok(r.found === 0, "the first run is a baseline for everything", `${r.found} found`);

// An event whose date was only inferred, now exact; and the feed has a new issue.
const st = await read(KEYS.followState, {});
st.events["web-summit"] = { mode: "inferred", date: "2026-11-01" };
await write(KEYS.followState, st);
feed = rss([{ t: "Issue 4", l: "https://cpgdxyz.substack.com/p/four", d: "Mon, 12 Oct 2026 08:00:00 GMT" }, ...base]);
r = await detect({ fetchFeed, today: "2026-09-02", now: "2026-09-02T08:00:00Z" });
ok(r.found === 2, "a new issue and confirmed dates are found", `${r.found} found`);

sent.length = 0;
let s = await send({ origin: "https://watchfor.tools" });
const toReader = sent.filter((m) => m.to === "reader@example.org" || (Array.isArray(m.to) && m.to.includes("reader@example.org")));
ok(toReader.length === 1, "two pieces of news, one email", `${toReader.length} emails`);
ok(s.sent === 2 && sent.some((m) => [].concat(m.to).includes("member@example.org")), "another follower of the event gets their own, separately");
const digest = toReader[0] || { text: "", html: "", subject: "" };
ok(/CPGD published a new issue: Issue 4/.test(digest.text) && /Web Summit[^\n]*confirmed dates/.test(digest.text), "both are in it");
ok(!/SECRET BODY/.test(digest.text + digest.html), "the issue's body is not");
ok(/utm_source=watchfor\.tools/.test(digest.text), "the issue link carries the outbound tag (invariant 11)");
const stopOne = (digest.text.match(/Stop updates about CPGD: (\S+)/) || [])[1];
const stopAll = (digest.text.match(/Unsubscribe: (\S+)/) || [])[1];
ok(Boolean(stopOne) && Boolean(stopAll), "a stop link per item and one for everything");
ok(!sent.some((m) => /Retail Insider|App Founders/.test(m.text || "")), "followed items with no news are not mentioned");
ok(Object.keys(await read(KEYS.followQueue, {})).length === 0, "the queue is empty after a good send");

r = await detect({ fetchFeed, today: "2026-09-03", now: "2026-09-03T08:00:00Z" });
ok(r.found === 0, "the next day, nothing is resent");

quiet("\nreminders and failures:");
r = await detect({ fetchFeed, today: "2026-10-10", now: "2026-10-10T08:00:00Z" });
ok(r.found === 1, "30 days before Web Summit: a reminder", `${r.found} found`);
resendDown = true;
s = await send({ origin: "https://watchfor.tools" });
const q = await read(KEYS.followQueue, {});
ok(s.failed === 2 && q["reader@example.org"]?.attempts === 1, "a failed send stays queued for tomorrow, with the attempt counted");
resendDown = false;
await removeFollow("reader@example.org", "web-summit");
sent.length = 0;
s = await send({ origin: "https://watchfor.tools" });
ok(!sent.some((m) => [].concat(m.to).includes("reader@example.org")), "an unfollow after queueing wins: nothing is sent about it");
ok(sent.some((m) => [].concat(m.to).includes("member@example.org")), "while the other follower's queued reminder still goes");

quiet("\nstopping:");
const u = new URL(stopOne);
ok(validStopToken(u.searchParams.get("email"), u.searchParams.get("id"), u.searchParams.get("token")), "the stop link verifies");
res = await remove.GET(new Request(`http://localhost:3000/api/follow/remove?email=reader%40example.org&id=retailinsider&token=${u.searchParams.get("token")}`));
ok(res.status === 400, "a stop token for one item cannot stop a different one");
res = await remove.GET(new Request(stopOne, { headers: { "x-forwarded-for": "10.0.0.1" } }));
const left = (await getFollows())["reader@example.org"]?.items || {};
ok(res.status === 200 && !left.cpgd && left.retailinsider, "stopping one item leaves the rest");
res = await remove.GET(new Request(stopAll, { headers: { "x-forwarded-for": "10.0.0.1" } }));
ok(!(await getFollows())["reader@example.org"], "the footer link stops everything");
ok(stopToken("a@b.co", "") !== stopToken("a@b.co", "cpgd"), "all and one are different tokens");

console.log = quiet;
quiet(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
