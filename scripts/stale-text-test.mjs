#!/usr/bin/env node
/*
 * Stored sentences that restate a field (lib/staleText.js, 2026-11-06).
 *
 *   node scripts/stale-text-test.mjs
 *
 * No server. The date line and "Not confirmed" are derived, a caveat that
 * still states the old date state is flagged (never edited), counts and
 * cadence in prose are checked against their fields, and the catalogue as
 * committed has no disagreement.
 */
import { register } from "node:module";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
register("data:text/javascript," + encodeURIComponent(`
import { existsSync } from "node:fs"; import { fileURLToPath } from "node:url";
const ROOT = ${JSON.stringify(pathToFileURL(root + "/").href)};
export async function resolve(s, c, n) {
  let t = null;
  if (s.startsWith("@/")) t = new URL(s.slice(2), ROOT).href;
  else if ((s.startsWith("./") || s.startsWith("../")) && c.parentURL) t = new URL(s, c.parentURL).href;
  if (t && !/\\.[mc]?jsx?$/.test(t)) for (const x of [".js", ".jsx"]) if (existsSync(fileURLToPath(t + x))) return n(t + x, c);
  return n(s, c);
}`));
const L = (p) => import(pathToFileURL(join(root, p)).href);
let failed = 0;
const ok = (c, m) => { if (c) console.log(`  ok  ${m}`); else { failed++; console.log(`  FAIL ${m}`); } };

const { staleFlags, eventFlags, toolFlags, around } = await L("lib/staleText.js");
const ev = await L("lib/events.js");
const today = "2026-11-06";

console.log("events: the date line is derived, the caveat is flagged");
const mit = ev.EVENTS.find((e) => e.id === "merchant-inspiration-talks");
const [placedMit] = ev.placed([mit], today);
ok(placedMit.at.mode === "exact" && placedMit.at.label === "9 Sep 2027", "Merchant Inspiration Talks reads as 9 Sep 2027, from its fields");
const parts = readFileSync(join(root, "components/EventParts.jsx"), "utf8");
ok(/at\.mode === "inferred" \? "Not confirmed"/.test(parts) && /Date not confirmed\. Last held \$\{dayLabel\(at\.lastHeld\)\}/.test(parts), "\"Not confirmed\" and the date sentence come from placeEvent, not a stored string");
ok(!/Not confirmed|Date not confirmed/.test(JSON.stringify(ev.EVENTS.map((e) => [e.one, e.watch, e.dateRaw]))), "no event stores the not-confirmed sentence");
ok(!/save-the-date sign-up but no date/.test(mit.watch), "its caveat no longer says there is no date");
const old = { ...mit, watch: `${mit.watch} There is a 2027 save-the-date sign-up but no date.` };
const f = eventFlags(ev.placed([old], today)[0]);
ok(f.length === 1 && f[0].field === "watch" && /no date/.test(f[0].sentence), "a confirmed date with a caveat saying there is none is flagged, with the sentence");
ok(around(old.watch, f[0].sentence)[1] === f[0].sentence, "the sentence can be highlighted inside the field");
const dotdev = ev.EVENTS.find((e) => e.id === "dotdev");
ok(eventFlags(ev.placed([dotdev], today)[0]).length === 0, "an event with no date that says so is not flagged");
ok(eventFlags(ev.placed([{ ...dotdev, datePrecision: "exact", startDate: "2027-07-20" }], today)[0]).some((x) => /No date for the next one/.test(x.sentence)), "once its date is set, the same sentence is flagged");
ok(eventFlags(ev.placed([{ ...mit, startDate: "2026-09-17", lastHeld: undefined, watch: "No date for 2027 yet." }], today)[0]).length === 0, "a past edition is not flagged");

console.log("newsletters and podcasts: counts, cadence, feeds");
const pod = { id: "p", name: "P", episodeCount: 300, cadence: "Weekly", note: "Hosted by A. 292 episodes since October 2020.", watch: "Output slowed from 83 episodes in 2024 to 21 in 2026. 89 of the 292 episodes mention it." };
const pf = staleFlags({ podcasts: [pod] });
ok(pf.filter((x) => x.restates === "episodeCount").length === 2, "a run count and a share's total that are not the field's are flagged");
ok(!pf.some((x) => /83 episodes/.test(x.sentence)), "a count for one year is not a total");
ok(staleFlags({ podcasts: [{ ...pod, discontinued: true }] }).length === 0, "a show that stopped is a record, never flagged on its count");
ok(staleFlags({ newsletters: [{ id: "n", name: "N", cadence: "Daily, weekdays", one: "Weekly read on Shopify." }] }).some((x) => x.restates === "cadence"), "a summary giving a cadence the field does not is flagged");
ok(staleFlags({ newsletters: [{ id: "n", name: "N", cadence: "Weekly, Mondays", one: "Weekly roundup." }] }).length === 0, "and one that agrees is not");
ok(staleFlags({ newsletters: [{ id: "n", name: "N", rss: "https://x/feed", note: "It has no RSS feed." }] }).some((x) => x.restates === "rss"), "\"no feed\" with a feed recorded is flagged");

console.log("tools: a confirmed tier's price in prose");
const tool = { id: "t", name: "T", note: "Pro is $19 a month and Studio $49.", structured: { confirmedAt: "2026-11-01", pricing: { tiers: [{ name: "Pro", amount: 29 }, { name: "Studio", amount: 49 }] } } };
const tf = toolFlags(tool);
ok(tf.length === 1 && /Pro/.test(tf[0].why), "a named tier at a price the confirmed tier is not is flagged");
ok(toolFlags({ ...tool, structured: undefined }).length === 0, "an unconfirmed tool has nothing to disagree with");

console.log("the catalogue as committed");
const all = staleFlags({
  tools: (await L("lib/tools.js")).TOOLS, newsletters: (await L("lib/newsletters.js")).NEWSLETTERS,
  podcasts: (await L("lib/podcasts.js")).PODCASTS, events: ev.placed(ev.EVENTS, today),
});
ok(all.length === 0, `no sentence disagrees with its field (${all.map((x) => `${x.id}.${x.field}`).join(", ") || "none"})`);
const N = (await L("lib/newsletters.js")).NEWSLETTERS, P = (await L("lib/podcasts.js")).PODCASTS;
for (const [list, f2, noun] of [[N, "issueCount", "issues"], [P, "episodeCount", "episodes"]]) {
  const dup = list.filter((e) => !e.discontinued && e[f2] && new RegExp(`\\b${Number(e[f2]).toLocaleString("en-US")} ${noun} since\\b`).test(e.note || ""));
  ok(dup.length === 0, `no note restates its own ${noun} count and start, which the facts line shows (${dup.map((e) => e.id).join(", ") || "none"})`);
}

console.log("the admin");
const src = readFileSync(join(root, "lib/staleText.js"), "utf8");
ok(!/from "\.\/(store|listings|publish|model)"/.test(src), "the checker reads nothing and writes nothing");
const admin = readFileSync(join(root, "components/Admin.jsx"), "utf8");
ok(/<StaleText rows=\{staleText\} \/>/.test(admin) && /backlog\.details \+ staleText\.length/.test(admin), "flags are a work panel on Listings and count towards the tab");
ok(/eventFlags\(placeEvents\(/.test(admin), "an event finding shows what its new date would leave behind");
const page = readFileSync(join(root, "app/admin/page.js"), "utf8");
ok(/key: "staleText"/.test(page), "the admin page loads the flags after its check");

console.log(failed ? `\n${failed} failed` : "\nall passed");
process.exit(failed ? 1 : 0);
