#!/usr/bin/env node
/*
 * Events: placement, status and the imprecise dates.
 *
 *   node scripts/events-test.mjs
 *
 * Status is never stored, so the only place it can be wrong is placeEvent,
 * and the failure that matters most is an inferred date reading as scheduled.
 * Runs against a temp copy of lib/ like the other library tests, with a fixed
 * "today" so the answers do not move with the calendar.
 */
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = mkdtempSync(join(tmpdir(), "svt-events-"));
for (const f of ["events", "drafts", "eventCoords"]) {
  const src = readFileSync(join(root, "lib", `${f}.js`), "utf8").replace(/from "\.\/(\w+)"/g, 'from "./$1.mjs"');
  writeFileSync(join(dir, `${f}.mjs`), src);
}
const { ALL_EVENTS, EVENTS, placeEvent, agenda, placed, countdown, rangeLabel } = await import(join(dir, "events.mjs"));

let bad = 0;
const ok = (c, l, d = "") => {
  console.log(`  ${c ? "ok  " : "FAIL"}  ${l}${d ? `  ${d}` : ""}`);
  if (!c) bad += 1;
};
const T = "2026-10-07";

console.log("the catalogue:");
ok(ALL_EVENTS.every((e) => !("status" in e)), "no entry stores a status");
ok(new Set(ALL_EVENTS.map((e) => e.id)).size === ALL_EVENTS.length, "ids are unique");
ok(EVENTS.every((e) => !e.draft), "drafts are not in EVENTS");
ok(EVENTS.every((e) => e.one && e.watch), "every published entry has one and watch");
ok(ALL_EVENTS.every((e) => !/[–—]/.test([e.name, e.one, e.watch, e.dateRaw, e.audience].join(" "))),
  "no en or em dash in visitor-facing text");
ok(placed(EVENTS, T).every((e) => !("notes" in e)), "notes never leave the module");

console.log("\nexact dates:");
const ex = (start, end) => placeEvent({ name: "x", datePrecision: "exact", startDate: start, endDate: end }, T);
ok(ex("2026-09-01", "2026-09-02").status === "past", "a finished event is past");
ok(ex("2026-11-06").status === "imminent", "30 days out is imminent");
ok(ex("2026-11-07").status === "upcoming", "31 days out is upcoming");
ok(ex("2026-10-05", "2026-10-08").status === "imminent", "an event on now is imminent");
ok(countdown(ex("2026-10-19"), T) === "In 12 days", "countdown", countdown(ex("2026-10-19"), T));
ok(countdown(ex("2026-10-05", "2026-10-08"), T) === "On now", "on now");
ok(rangeLabel("2026-11-30", "2026-12-02") === "30 Nov to 2 Dec 2026", "a range across months");

console.log("\nimprecise dates:");
const mo = placeEvent({ name: "x", datePrecision: "month", startDate: "2023-06", dateRaw: "June 2023" }, T);
ok(mo.mode === "approx" && mo.label === "June 2023" && mo.status === "past", "a month keeps its raw label");
const se = placeEvent({ name: "x", datePrecision: "season", startDate: "2026-09", dateRaw: "Autumn 2026" }, T);
ok(se.status === "imminent", "a season still under way is not past", se.status);

console.log("\ninferred dates:");
const inf = placeEvent({ name: "x", datePrecision: "unknown", startDate: null, lastHeld: "2026-07-21", annual: true }, T);
ok(inf.mode === "inferred" && inf.date === "2027-07-21", "placed at the coming anniversary", inf.date);
ok(/not confirmed/i.test(inf.label) && /21 July 2026/.test(inf.label), "and labelled not confirmed, with the last date", inf.label);
ok(countdown(placeEvent({ name: "x", datePrecision: "unknown", lastHeld: "2025-10-20", annual: true }, T), T) === "",
  "an inferred date never gets a countdown, even when imminent");
const notAnnual = placeEvent({ name: "x", datePrecision: "unknown", lastHeld: "2026-09-09" }, T);
ok(notAnnual.mode === "unscheduled", "without `annual` there is no anniversary to infer");
const stale = placeEvent({ name: "x", datePrecision: "unknown", lastHeld: "2023-05-01", annual: true }, T);
ok(stale.mode === "unscheduled", "a series quiet for two years is not projected forward");

console.log("\ndiscontinued:");
const unite = placeEvent(ALL_EVENTS.find((e) => e.id === "shopify-unite"), T);
ok(unite.status === "past" && unite.discontinued, "Shopify Unite is past, not unscheduled");

console.log("\nthe sheet's unscheduled four:");
const plan = agenda(EVENTS, T);
const un = plan.unscheduled.map((e) => e.id);
ok(un.includes("ecom-collab-club"), "ecom-collab-club is under Dates not announced");
const dtc = placeEvent(ALL_EVENTS.find((e) => e.id === "dtc-dines-vancouver"), T);
ok(dtc.mode === "exact" && dtc.date === "2026-10-29" && dtc.status === "imminent",
  "DTC Dines Vancouver is dated 29 October and imminent", `${dtc.date} ${dtc.status}`);
ok(countdown(dtc, T) === "In 22 days", "with a countdown", countdown(dtc, T));
/* A rule rather than two named entries: these were pinned by id, and the ids
   changed state (published, then one discarded) without the rule changing.
   What must hold is that an unverified event with no known date is never
   given one, whether it is a draft or not. */
const unverifiedUndated = ALL_EVENTS.filter((e) => /^UNVERIFIED/.test(e.notes || "") && e.datePrecision === "unknown");
ok(unverifiedUndated.length > 0, `${unverifiedUndated.length} unverified events with no known date`);
for (const e of unverifiedUndated) {
  ok(placeEvent(e, T).mode === "unscheduled", `${e.id} is placed under Dates not announced, never given a date`);
}

console.log("\nthe timeline:");
const keys = plan.timeline.map((g) => g.key);
ok(keys.join() === [...keys].sort().join(), "one run, oldest first");
ok(plan.timeline.some((g) => g.items.some((e) => e.at.status === "past"))
  && plan.timeline.some((g) => g.items.some((e) => e.at.status !== "past")),
  "past and future share it: past events are not split out");
ok(keys.includes("2022") && !keys.includes("2022-01"), "a year-only date groups under the year, not a made-up month");
ok(plan.nowMonth === "2026-10", "it opens at this month");

console.log("\nthe strip:");
ok(plan.strip.length === 12 && plan.strip[0].month === "2026-10", "twelve months from this one");
ok(plan.strip.every((m) => typeof m.unconfirmed === "number"), "unconfirmed counted apart");
const sep = plan.strip.find((m) => m.month === "2027-09");
ok(plan.strip[0].count === 1, "Oct 2026 counts DTC Dines");
ok(sep.count === 3 && sep.unconfirmed === 2, "Sep 2027: three dated, two not confirmed", JSON.stringify(sep));

console.log(bad ? `\n${bad} failed` : "\nall passed");
process.exit(bad ? 1 : 0);
