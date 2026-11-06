#!/usr/bin/env node
/*
 * Event refresh findings get a tool finding's outcomes (2026-11-06).
 *
 *   node scripts/event-actions-test.mjs
 *
 * No server, no keys, no network. GitHub is a stub that serves the real
 * lib/events.js and records the commit. Checks:
 *   - the mapping: which findings become which fields, and which are refused
 *   - the file edit, against every event: only the mapped fields and `updated`
 *     change, a stale page is refused, and undo writes back what was there
 *   - the route: apply, publish, rewrite (a caveat needs a reason and is in the
 *     caveat history), resolve only after a destination, mark wrong with a
 *     reason, unmark, undo
 *   - following: a feed line on an event reaches its followers
 */
import { register } from "node:module";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHmac } from "node:crypto";
import { parse } from "acorn";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const k of Object.keys(process.env)) if (/^(UPSTASH|KV)_|^GITHUB_|^ANTHROPIC|^OPENAI/.test(k)) delete process.env[k];
process.env.AUTH_SECRET = "event-actions-secret";
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

let fileNow = readFileSync(join(root, "lib/events.js"), "utf8");
const puts = [];
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (!u.startsWith("https://api.github.com/repos/")) throw new Error(`unexpected network call: ${u}`);
  if (!init.method || init.method === "GET") return Response.json({ sha: "abc", content: Buffer.from(fileNow).toString("base64") });
  const body = JSON.parse(init.body);
  fileNow = Buffer.from(body.content, "base64").toString("utf8");
  puts.push({ message: body.message, source: fileNow });
  return Response.json({ commit: { sha: `c${puts.length}0000000`, html_url: `https://github.com/x/y/commit/c${puts.length}` } });
};

let failed = 0;
const ok = (c, m) => { if (c) console.log(`  ok  ${m}`); else { failed++; console.log(`  FAIL ${m}`); } };
const L = (p) => import(pathToFileURL(join(root, p)).href);

const { ALL_EVENTS } = await L("lib/events.js");
const { eventEdit, expectOf, parseWhen, whenLabel } = await L("lib/eventEdits.js");
const { editEntryInSource } = await L("lib/publish.js");
const today = "2026-11-06";

/* ---------------- the mapping ---------------- */
console.log("mapping");
const dotdev = ALL_EVENTS.find((e) => e.id === "dotdev");
const ann = eventEdit({ kind: "date-announced", field: "startDate", old: "", new: "2027-09-09" }, dotdev);
ok(ann.state === "appliable", "a date announced on an unscheduled event applies");
ok(ann.set.startDate === "2027-09-09" && ann.set.datePrecision === "exact" && ann.set.dateRaw === "9 September 2027", "startDate, exact precision and the date as written");
ok(!("endDate" in ann.set), "no endDate written for a one-day event that had none");
ok(!("lastHeld" in ann.set), "lastHeld kept as it was when the old date was not a real edition");
ok(ann.notes.some((n) => /caveat/.test(n)), "a caveat that still talks about the date is pointed out");
const range = eventEdit({ kind: "date-announced", field: "startDate", new: "2027-09-09 to 2027-09-11" }, dotdev);
ok(range.set.endDate === "2027-09-11" && range.set.dateRaw === "9 to 11 September 2027", "a range sets endDate and reads in words");
const past = ALL_EVENTS.find((e) => e.datePrecision === "exact" && e.startDate < today && /\b20\d\d\b/.test(e.name));
if (past) {
  const nx = eventEdit({ kind: "next-edition", field: "startDate", new: "2027-10-01" }, past);
  ok(nx.set.lastHeld === past.startDate, "a next edition keeps the finished one as lastHeld");
  ok(nx.notes.some((n) => /name/.test(n)), "a name with a year is pointed out, not changed");
  ok(!("name" in nx.set), "the name is never written");
}
ok(eventEdit({ kind: "next-edition", field: "nextEdition", new: "2027-09" }, dotdev).state === "unmapped", "a next edition known only to the month is not applied");
const place = eventEdit({ kind: "place", field: "city", new: "Montreal, Canada" }, dotdev);
ok(place.set.city === "Montreal" && !("country" in place.set), "a city move writes the city, and the unchanged country is left");
ok(eventEdit({ kind: "place", field: "city", new: "Washington, D.C., USA" }, dotdev).state === "unmapped", "a place that does not split cleanly is not guessed");
ok(eventEdit({ kind: "format", field: "format", new: "online" }, dotdev).set.format === "online", "format");
for (const k of ["ended", "page-gone", "off-calendar"]) ok(eventEdit({ kind: k }, dotdev).state === "unmapped", `${k} is never applied`);
ok(eventEdit({ kind: "date-announced", new: "2027-09-09" }, null).state === "unmapped", "a gone event is not applied");
ok(parseWhen("2027-09-11 to 2027-09-09") === null, "an end before the start is refused");
ok(whenLabel("2027-09-30", "2027-10-02") === "30 September to 2 October 2027", "a range across months");
for (const f of Object.keys(ann.set)) ok(!["watch", "relevance", "audience", "name", "one"].includes(f), `the apply never writes ${f}`);

/* ---------------- the file edit, against every event ---------------- */
console.log("the edit, every event");
const P = { ecmaVersion: "latest", sourceType: "module" };
const src0 = readFileSync(join(root, "lib/events.js"), "utf8");
const propsOf = (src, id) => {
  const t = parse(src, P);
  let hit = null;
  (function walk(n, arr) {
    if (!n || typeof n !== "object" || hit) return;
    if (n.type === "ObjectExpression" && arr && n.properties.some((p) => p.key?.name === "id" && p.value.value === id)) { hit = n; return; }
    for (const k of Object.keys(n)) { const v = n[k]; if (Array.isArray(v)) v.forEach((c) => walk(c, n.type === "ArrayExpression")); else if (v && typeof v.type === "string") walk(v, false); }
  })(t, false);
  return hit ? Object.fromEntries(hit.properties.filter((p) => p.type === "Property").map((p) => [p.key.name ?? p.key.value, src.slice(p.value.start, p.value.end)])) : null;
};
let all = 0, clean = 0, undone = 0;
for (const e of ALL_EVENTS) {
  const ed = eventEdit({ kind: "date-announced", field: "startDate", new: "2031-05-04 to 2031-05-06" }, e);
  if (ed.state !== "appliable") continue;
  all++;
  const set = Object.fromEntries(Object.entries(ed.set).filter(([, v]) => v !== null));
  const remove = Object.entries(ed.set).filter(([, v]) => v === null).map(([k]) => k);
  const r = editEntryInSource(src0, e.id, { set, remove, expect: expectOf(ed.set, e), today });
  if (r.error) { console.log(`    ${e.id}: ${r.error}`); continue; }
  const a = propsOf(src0, e.id), b = propsOf(r.source, e.id);
  const changed = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => a[k] !== b[k]);
  const allowed = new Set([...Object.keys(ed.set), "updated"]);
  if (changed.every((k) => allowed.has(k)) && b.startDate === '"2031-05-04"' && b.updated === `"${today}"`) clean++;
  else console.log(`    ${e.id}: changed ${changed.join(", ")}`);
  /* Undo: the before values written back, expecting what was applied. */
  const inv = editEntryInSource(r.source, e.id, {
    set: Object.fromEntries(Object.entries(r.before).filter(([, x]) => x.present).map(([k, x]) => [k, x.value])),
    remove: Object.entries(r.before).filter(([, x]) => !x.present).map(([k]) => k),
    expect: ed.set, today,
  });
  const c = inv.source && propsOf(inv.source, e.id);
  if (c && Object.keys(a).every((k) => k === "updated" || a[k] === c[k]) && Object.keys(c).every((k) => k in a)) undone++;
  else console.log(`    ${e.id}: undo did not restore (${inv.error || "values differ"})`);
}
ok(all > 0 && clean === all, `apply changes only the mapped fields and updated, ${clean} of ${all} events`);
ok(undone === all, `undo writes back exactly what was there, ${undone} of ${all}`);
const stale = editEntryInSource(src0, "dotdev", { set: { startDate: "2027-09-09" }, expect: { startDate: "2027-01-01" }, today });
ok(Boolean(stale.error) && /not what this page showed/.test(stale.error), "a value that changed on main since the page loaded is refused");
ok(Boolean(editEntryInSource(src0, "nope-not-an-event", { set: { venue: "x" }, today }).error), "an unknown id is refused");

/* ---------------- the route ---------------- */
console.log("route");
process.env.GITHUB_TOKEN = "stub";
const { write, read, KEYS } = await L("lib/store.js");
const route = await L("app/api/admin/route.js");
const sess = (email) => { const b = Buffer.from(JSON.stringify({ t: "session", email, exp: Date.now() + 3600e3 })).toString("base64url"); return `svt_session=${b}.${createHmac("sha256", process.env.AUTH_SECRET).update(b).digest("base64url")}`; };
const admin = sess("admin@example.com");
const call = async (body, cookie = admin) => {
  const res = await route.POST(new Request("http://localhost:3000/api/admin", { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": "10.3.0.1", cookie }, body: JSON.stringify(body) }));
  return { status: res.status, text: res.ok ? "" : await res.text(), json: res.ok ? await res.json() : null };
};
const finding = (id, extra = {}) => ({ id, print: `dotdev|date-announced|startDate|${id}`, at: "2026-11-01T00:00:00Z", status: "open", kind: "date-announced", field: "startDate", old: "Date not confirmed", new: "2027-09-09", quote: "See you September 9, 2027", eventId: "dotdev", eventName: "DotDev", label: "Dates announced", confidence: 0.6, why: "read once", source: "https://dotdev.shopify.com/", ...extra });
await write(KEYS.eventFindings, [finding("f1"), finding("f2"), finding("f3", { kind: "venue", field: "venue", new: "Enercare Centre" })]);
await write(KEYS.eventRefresh, { events: {}, declined: [] });

ok((await call({ action: "event-apply", id: "f1" }, sess("nobody@example.com"))).status === 404, "a non-admin gets 404");
ok((await call({ action: "event-finding", id: "f1", decision: "resolved" })).status === 400, "Resolve is refused with nothing done");
const ap = await call({ action: "event-apply", id: "f1", expect: expectOf(eventEdit(finding("f1"), dotdev).set, dotdev) });
ok(ap.status === 200, `apply commits (${ap.text})`);
const f1 = () => read(KEYS.eventFindings, []).then((r) => r.find((x) => x.id === "f1"));
ok((await f1()).applied?.sha && (await f1()).status === "open", "applied is recorded with its commit, and the finding stays open");
ok(/DotDev: startDate absent to 2027-09-09/.test(puts.at(-1).message) && /Quote: "See you September 9, 2027"/.test(puts.at(-1).message), "the commit message names the fields and the quote");
ok(propsOf(fileNow, "dotdev").startDate === '"2027-09-09"', "the file on main has the date");
ok((await call({ action: "event-apply", id: "f1" })).status === 400, "applying twice is refused");

const pub = await call({ action: "event-publish", id: "f1", headline: "Next edition is on 9 September 2027 in Toronto." });
ok(pub.status === 200 && (await f1()).published?.feedId, "publish records the feed row on the finding");
const feed = await read("svt:feed", []);
const feedId = (await f1()).published.feedId;
const row = feed.find((r) => r.id === feedId);
ok(row?.href === "/events/dotdev" && row.toolId === "dotdev", "the feed row links the event's page");
ok((await call({ action: "event-publish", id: "f1", headline: "Again, a second line." })).status === 400, "publishing twice is refused");

const rw = await call({ action: "event-apply-rewrite", id: "f1", fields: { watch: "Tickets were $499 and 2026 sold out. The 2027 date is set." } });
ok(rw.status === 400 && /why/.test(rw.text), "a caveat change without a reason is refused");
const rw2 = await call({ action: "event-apply-rewrite", id: "f1", fields: { watch: "Tickets were $499 and 2026 sold out. The 2027 date is set.", notes: "x", relevance: "low" }, reason: "the organizer confirmed the 2027 date" });
ok(rw2.status === 200, `a caveat change with a reason commits (${rw2.text})`);
ok(propsOf(fileNow, "dotdev").relevance === propsOf(src0, "dotdev").relevance && propsOf(fileNow, "dotdev").notes === propsOf(src0, "dotdev").notes, "fields outside one, focus and watch are dropped");
const { readWatchLog } = await L("lib/publish.js");
ok((await readWatchLog(10)).some((l) => l.kind === "event" && l.id === "dotdev" && l.reason && l.via === "rewrite"), "the caveat change is in the caveat history with its reason");
ok((await call({ action: "event-apply-rewrite", id: "f1", fields: { watch: "None." }, reason: "testing a bad caveat" })).status === 400, "rewriting twice is refused");

ok((await call({ action: "event-finding", id: "f1", decision: "resolved" })).status === 200 && (await f1()).status === "resolved", "Resolve closes it once a destination exists");

ok((await call({ action: "event-finding", id: "f2", decision: "wrong" })).status === 400, "Mark as wrong needs a reason");
ok((await call({ action: "event-finding", id: "f2", decision: "wrong", reason: "that is the 2026 date" })).status === 200, "Mark as wrong with a reason");
const st = await read(KEYS.eventRefresh, {});
ok(st.wrong?.[0]?.reason === "that is the 2026 date" && st.declined.includes(finding("f2").print), "a wrong finding is kept as an example and never raised again");
const { readPrompt } = await L("lib/eventRefresh.js");
ok(/marked wrong/.test(readPrompt(dotdev, "page", today, st.wrong)) && /that is the 2026 date/.test(readPrompt(dotdev, "page", today, st.wrong)), "the event's mistakes go into its next reading");
ok((await call({ action: "event-finding", id: "f2", decision: "open" })).status === 200 && !(await read(KEYS.eventRefresh, {})).declined.includes(finding("f2").print), "Unmark puts it back and forgets the example");

const n0 = puts.length;
ok((await call({ action: "event-undo-rewrite", id: "f1" })).status === 200 && propsOf(fileNow, "dotdev").watch === propsOf(src0, "dotdev").watch, "Undo rewrite commits the old caveat back");
ok((await call({ action: "event-undo-apply", id: "f1" })).status === 200 && propsOf(fileNow, "dotdev").startDate === "null" && propsOf(fileNow, "dotdev").dateRaw === propsOf(src0, "dotdev").dateRaw, "Undo writes the old dates back");
ok(puts.length === n0 + 2, "each undo is one commit");
ok((await call({ action: "event-unpublish", id: "f1" })).status === 200 && (await read("svt:feed", [])).find((r) => r.id === row.id)?.deletedAt, "Remove from updates soft-deletes the feed row");

delete process.env.GITHUB_TOKEN;
ok(/GITHUB_TOKEN/.test((await call({ action: "event-apply", id: "f3" })).text), "without GITHUB_TOKEN, apply says what is missing");

/* ---------------- following, and the page ---------------- */
console.log("following and the page");
const notify = readFileSync(join(root, "lib/notify.js"), "utf8");
ok(/r\.href === `\/events\/\$\{e\.id\}`/.test(notify), "a feed line about an event goes to the event's followers");
ok(/prev\.date !== cur\.date/.test(notify), "a confirmed date that moves is news to followers too");
const adminSrc = readFileSync(join(root, "components/Admin.jsx"), "utf8");
for (const label of ["Publish to What's moving", "Rewrite with AI", "Mark as wrong", "Resolve", "Edited by hand", "Undo rewrite", "Remove from updates"]) {
  ok(adminSrc.slice(adminSrc.indexOf("function EventFindingRow"), adminSrc.indexOf("function EventFindingsDecided")).includes(label), `the event row offers ${label}`);
}
ok(!/from "@\/lib\/eventRefresh"/.test(adminSrc), "the client never imports the server refresh module");
const { sanitiseEntry } = await L("lib/feed.js");
ok(sanitiseEntry({ headline: "A line long enough here.", href: "/events/dotdev" }).entry.href === "/events/dotdev", "a feed row may link a listing path");
ok(!("href" in sanitiseEntry({ headline: "A line long enough here.", href: "https://evil.example" }).entry), "and nothing else");

console.log(failed ? `\n${failed} failed` : "\nall passed");
process.exit(failed ? 1 : 0);
