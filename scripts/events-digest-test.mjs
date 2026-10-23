#!/usr/bin/env node
/*
 * The monthly events digest (editor and subscribers) and the monthly event
 * refresh. node scripts/events-digest-test.mjs. No server, no keys.
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
process.env.AUTH_SECRET = "events-digest-secret";
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
const { read, write, KEYS } = await L("lib/store.js");
const { detect, send } = await L("lib/notify.js");
const { addFollow, followable, getFollows } = await L("lib/follows.js");
const { monthDigest, forRegion, sendAdminDigest, isDigestDay } = await L("lib/eventDigest.js");
const { regionOf, inRegion, REGIONS } = await L("lib/eventRegions.js");
const R = await L("lib/eventRefresh.js");
const { EVENTS, placed } = await L("lib/events.js");
const follow = await L("app/api/follow/route.js");

let failed = 0;
const ok = (cond, what, extra = "") => {
  quiet(`  ${cond ? "ok  " : "FAIL"}  ${what}${extra ? `  ${extra}` : ""}`);
  if (!cond) failed++;
};
const fs = await import("node:fs");
const src = (p) => fs.readFileSync(join(root, p), "utf8");

/* ---------------- what a month holds ---------------- */
quiet("\nthe month:");
const ym = "2026-11";
const d = monthDigest(EVENTS, ym);
ok(d.starting.length > 0 && d.starting.every((e) => placed(EVENTS, `${ym}-01`).find((p) => p.id === e.id).at.month === ym), "every event listed starts that month", `${d.starting.length} in November`);
ok(d.starting.every((e, i, a) => !i || a[i - 1].when <= e.when || true) && d.starting.map((e) => e.id).join() === [...d.starting].sort((a, b) => placed(EVENTS, `${ym}-01`).find((p) => p.id === a.id).at.date.localeCompare(placed(EVENTS, `${ym}-01`).find((p) => p.id === b.id).at.date)).map((e) => e.id).join(), "ordered by date");
ok(d.starting.every((e) => e.certainty && (e.mode !== "exact" || e.certainty === "confirmed")), "each says whether its date is confirmed, month only, or inferred");
ok(d.starting.every((e) => "city" in e && "country" in e), "each carries city and country");
const fake = [
  { id: "a", name: "Held Nov last year", url: "https://a.test", datePrecision: "unknown", lastHeld: "2025-11-12", city: "Lisbon", country: "Portugal" },
  { id: "b", name: "Past one-off Nov 2025", url: "https://b.test", datePrecision: "exact", startDate: "2025-11-05", city: "Austin", country: "USA" },
  { id: "c", name: "Discontinued", url: "https://c.test", discontinued: true, lastHeld: "2025-11-01", datePrecision: "unknown" },
  { id: "d", name: "Too old", url: "https://d.test", datePrecision: "unknown", lastHeld: "2021-11-01" },
];
const fd = monthDigest(fake, ym);
ok(fd.starting.length === 0, "a month with nothing starting is empty");
ok(fd.chase.map((c) => c.id).sort().join() === "a,b", "chase: no date now, held in this month before; never discontinued or long gone");

/* ---------------- regions ---------------- */
quiet("\nregions:");
ok(regionOf({ country: "UK" }) === "europe" && regionOf({ country: "USA" }) === "north-america" && regionOf({ country: "UAE" }) === "middle-east-africa", "countries map to regions");
ok(regionOf({ country: "Atlantis", lat: 52, lng: 5 }) === "europe" && regionOf({ country: "", lat: 40, lng: -100 }) === "north-america", "coordinates decide when the country is unknown");
ok(inRegion({ city: "Online" }, "europe") && inRegion({ city: "Online" }, "asia-pacific"), "an online event is in every region");
const eu = forRegion(d, "europe");
ok(eu.every((e) => regionOf(e) === "europe" || regionOf(e) === "online") && !eu.some((e) => e.country === "USA"), "a Europe subscriber gets no North American events", `${eu.length} of ${d.starting.length}`);
ok(forRegion(d, "all").length === d.starting.length, "all means all");
ok(REGIONS.every(([r]) => followable(`events-monthly:${r}`)) && !followable("events-monthly:mars"), "each region can be followed, and nothing else");

/* ---------------- subscribers: opt-in and one email a day ---------------- */
quiet("\nsubscribers:");
const res = await follow.POST(new Request("http://localhost:3000/api/follow", { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.0.9" }, body: JSON.stringify({ id: "events-monthly:europe", email: "eu@example.org" }) }));
ok(res.status === 200 && (await res.json()).confirmed === false && !Object.keys(await getFollows()).length, "double opt-in: a confirmation, nothing stored");
ok(sent.some((m) => /Confirm: updates about the monthly events digest for Europe/.test(m.subject)), "the confirmation names the digest and the region");
sent.length = 0;
await addFollow("eu@example.org", "events-monthly:europe");
await addFollow("na@example.org", "events-monthly:north-america");
const euEvent = eu[0];
if (euEvent) await addFollow("eu@example.org", euEvent.id);
await detect({ today: "2026-10-20", fetchFeed: async () => [] });
let q = await read(KEYS.followQueue, {});
ok(!(q["eu@example.org"]?.items || []).some((i) => i.kind === "month"), "nothing mid-month");
await detect({ today: `${ym}-01`, fetchFeed: async () => [] });
q = await read(KEYS.followQueue, {});
const euItems = q["eu@example.org"]?.items || [];
ok(euItems.filter((i) => i.kind === "month").length === 1 && euItems.find((i) => i.kind === "month").events.length === eu.length, "on the 1st, one digest item with the region's events");
const before = euItems.length;
await detect({ today: `${ym}-02`, fetchFeed: async () => [] });
q = await read(KEYS.followQueue, {});
ok((q["eu@example.org"]?.items || []).filter((i) => i.kind === "month").length === 1, "a second run that month adds nothing");
await send({ origin: "https://watchfor.tools" });
const toEu = sent.filter((m) => [].concat(m.to).includes("eu@example.org"));
ok(toEu.length === 1, "one email to that person that day, whatever else they follow", `${before} items`);
ok(/Events starting in November 2026/.test(toEu[0]?.text || "") && /Stop the monthly events digest/.test(toEu[0]?.text || ""), "it lists the month and carries its own stop link");
ok(!/(Las Vegas|Salt Lake City|New York|Toronto)/.test(toEu[0]?.text || "") || eu.some((e) => /USA|Canada/.test(e.country)), "no North American cities in the Europe digest");
ok(/unsubscribe|Stop/i.test(toEu[0]?.text || ""), "with an unsubscribe link");

/* ---------------- the editor's digest ---------------- */
quiet("\nthe editor's digest:");
sent.length = 0;
let r = await sendAdminDigest({ today: "2026-10-15", origin: "https://watchfor.tools" });
ok(!r.sent && sent.length === 0, "nothing mid-month");
r = await sendAdminDigest({ today: `${ym}-01`, origin: "https://watchfor.tools" });
const adminMail = sent.find((m) => /Events in November 2026/.test(m.subject));
ok(r.sent && Boolean(adminMail) && [].concat(adminMail.to).includes("admin@example.com"), "on the 1st, to ADMIN_EMAILS");
ok(d.starting.every((e) => adminMail.text.includes(e.name)), "every event starting, with how sure its date is");
ok((await L("lib/store.js")).readCapped && (await (await L("lib/store.js")).readCapped("svt:maillog", 50)).some((m) => m.event === "events_month"), "in the mail log");
sent.length = 0;
r = await sendAdminDigest({ today: `${ym}-01`, origin: "x" });
ok(!r.sent && sent.length === 0, "and once only");
r = await sendAdminDigest({ today: "2026-11-01", origin: "x", events: fake });
await write(KEYS.eventDigest, {});
r = await sendAdminDigest({ today: "2027-02-01", origin: "x", events: fake });
ok(!r.sent && /no events/.test(r.why), "an empty month sends nothing");
ok(isDigestDay("2026-11-03") && !isDigestDay("2026-11-04"), "a missed 1st is made up by the 3rd, never later");

/* ---------------- the refresh ---------------- */
quiet("\nthe refresh:");
const today = "2026-10-23";
const ev = [
  { id: "dated", name: "Dated Summit", url: "https://dated.test/", datePrecision: "exact", startDate: "2026-12-03", city: "Berlin", country: "Germany", venue: "Messe" },
  { id: "tbd", name: "TBD Meetup", url: "https://tbd.test/", datePrecision: "unknown", lastHeld: "2025-11-20", city: "London", country: "UK" },
  { id: "blocked", name: "Walled Expo", url: "https://walled.test/", datePrecision: "exact", startDate: "2026-12-10", city: "Paris", country: "France" },
  { id: "gone", name: "Gone Fest", url: "https://gone.test/", datePrecision: "exact", startDate: "2026-12-12", city: "Madrid", country: "Spain" },
  { id: "cal", name: "Calendar Day", url: "https://cal.test/e", calendarUrl: "https://cal.test/calendar", datePrecision: "exact", startDate: "2026-12-20", city: "Oslo", country: "Norway" },
];
const pages = {
  "https://dated.test/": "Dated Summit returns on 3 December 2026 at Messe Berlin, Berlin, Germany. Join us in person.",
  "https://tbd.test/": "TBD Meetup 2026 is on 18 November 2026 in London, UK. Tickets now on sale.",
  "https://cal.test/e": "Calendar Day on 20 December 2026 in Oslo, Norway.",
  "https://cal.test/calendar": "Upcoming: Winter Social, Spring Gathering.",
};
const fetchPage = async ({ label, url }) => {
  if (url.includes("walled")) return { label, url, ok: false, state: "blocked", status: "403" };
  if (url.includes("gone")) return { label, url, ok: false, state: "unreachable", status: "404" };
  return { label, url, ok: true, state: "ok", status: "200", text: pages[url] || "" };
};
const answers = {
  dated: { startDate: "2026-12-03", dateQuote: "3 December 2026", city: "Berlin", country: "Germany", placeQuote: "Berlin, Germany", venue: "Messe Berlin", venueQuote: "Messe Berlin", format: "in-person", formatQuote: "in person", ended: false },
  tbd: { startDate: "2026-11-18", dateQuote: "18 November 2026", city: "London", country: "United Kingdom", placeQuote: "London, UK", ended: false },
  cal: { startDate: "2026-12-20", dateQuote: "20 December 2026", ended: true, endedQuote: "this quote is not on the page" },
};
let asked = 0;
const askJson = async ({ prompt }) => { asked++; const id = ev.find((e) => prompt.includes(e.name)).id; return { data: answers[id] || {} }; };
await write(KEYS.eventFindings, []); await write(KEYS.eventRefresh, {});
sent.length = 0;
let run = await R.runEventRefresh({ events: ev, today, fetchPage, askJson, hasModel: true, origin: "x" });
let f = await R.getEventFindings();
ok(f.length === 1 && f[0].eventId === "tbd" && f[0].kind === "date-announced" && f[0].confidence === R.CONF.once, "an unannounced date now on the page is one finding, at 0.6", f.map((x) => `${x.eventId}:${x.kind}`).join());
ok(!f.some((x) => x.eventId === "dated"), "equivalent values are not findings (Messe and Messe Berlin, UK and United Kingdom)");
ok(!f.some((x) => x.kind === "ended"), "a value whose quote is not on the page is dropped");
ok(!f.some((x) => x.eventId === "blocked"), "a 403 is blocked, never dead");
ok(!f.some((x) => x.eventId === "gone"), "one failed fetch is not a dead page");
ok(sent.some((m) => /Event refresh: 1 finding/.test(m.subject)), "the editor is told, and only about something found");
run = await R.runEventRefresh({ events: ev, today, fetchPage, askJson, hasModel: true, origin: "x" });
f = await R.getEventFindings();
ok(f.find((x) => x.eventId === "tbd").confidence === R.CONF.twice && f.filter((x) => x.eventId === "tbd").length === 1, "read the same again: one finding, now at 0.9");
ok(f.some((x) => x.eventId === "gone" && x.kind === "page-gone" && x.confidence === R.CONF.dead), "unreachable on two runs: a dead page at 0.75");
ok(f.some((x) => x.eventId === "cal" && x.kind === "off-calendar"), "missing from the organizer's calendar on two reads");
const tbd = f.find((x) => x.eventId === "tbd");
await R.decideEventFinding(tbd.id, "dismissed", "admin@example.com");
await write(KEYS.eventFindings, (await R.getEventFindings()).filter((x) => x.id !== tbd.id));
await R.runEventRefresh({ events: ev, today, fetchPage, askJson, hasModel: true, origin: "x" });
ok(!(await R.getEventFindings()).some((x) => x.eventId === "tbd"), "a dismissed reading is not raised again");
const moved = R.compare({ ...ev[0], at: placed([ev[0]], today)[0].at }, { startDate: "2026-12-05", dateQuote: "5 December" }, today);
ok(moved.length === 1 && moved[0].kind === "date-moved", "a confirmed date the page states differently is a move");
const online = R.compare({ ...ev[0], at: placed([ev[0]], today)[0].at }, { format: "online", formatQuote: "online only" }, today);
ok(online.some((x) => x.kind === "format" && x.new === "online"), "going online-only is a finding");
const pastE = { id: "p", name: "P", url: "https://p.test", datePrecision: "exact", startDate: "2026-05-01", city: "Rome", country: "Italy" };
ok(R.compare({ ...pastE, at: placed([pastE], today)[0].at }, { startDate: "2027-05-06", dateQuote: "6 May 2027" }, today)[0]?.kind === "next-edition", "a past edition with a later one on the page: next edition");
ok(R.compare({ ...ev[0], at: placed([ev[0]], today)[0].at }, { ended: true, endedQuote: "cancelled" }, today).some((x) => x.kind === "ended") && /flag for discard/i.test(R.KIND_LABEL.ended), "a cancellation is flagged for discard, not removed");
const before2 = asked;
await R.runEventRefresh({ events: ev, today, fetchPage, askJson, hasModel: false, origin: "x" });
ok(asked === before2, "with no model, nothing is asked and availability still runs");
const cov = R.coverageOf(ev.concat({ id: "nourl", name: "No URL" }), await R.getEventRefresh());
ok(cov.find((c) => c.id === "blocked").state === "blocked" && cov.find((c) => c.id === "nourl").state === "no-source" && cov.find((c) => c.id === "dated").state === "read-no-model", "coverage per event: blocked, no source, read without the model");
ok(!/write(File)?Sync|lib\/events\.js|commit/i.test(src("lib/eventRefresh.js").replace(/\/\*[\s\S]*?\*\//g, "")), "nothing in the refresh writes the catalogue");
ok(/"0 6 1 \* \*"/.test(src("vercel.json")) && /cron\/events/.test(src("vercel.json")), "it runs monthly, on the 1st");

console.log = quiet;
quiet(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
