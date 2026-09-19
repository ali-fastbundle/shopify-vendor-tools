#!/usr/bin/env node
/*
 * One item, one place.
 *
 *   node scripts/discovery-settled.mjs
 *
 * A discovery finding is a photograph of the month it was taken, checked
 * against two things that both move every week: the catalogue and the
 * suggestion queue. Filtering only when a pass runs meant the list was correct
 * on the day it was written and then slowly stopped being. BuiltWith was named
 * as a competitor, added to the directory a week later, and the list still said
 * "not in the directory" a month after that.
 *
 * So `settled()` decides it, and both the render and the run call it. What is
 * worth asserting is every way an item could end up in two places at once:
 *
 *   - something listed since, by name and by domain, leaves the list
 *   - something in the open queue leaves the list, and a rerun does not bring
 *     it back
 *   - a *deleted* queue row does not count, so the finding returns
 *   - a dismissed name stays gone
 *   - clearing empties the findings and keeps the dismissals
 *
 * Same harness as scripts/discovery-promote.mjs: lib/ is copied into a temp
 * directory with its relative imports given extensions, so this runs against
 * the in-memory store rather than production Redis.
 */

import { readFileSync, writeFileSync, mkdtempSync, readdirSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { pathToFileURL } from "url";

const ROOT = new URL("..", import.meta.url).pathname;

const dir = mkdtempSync(join(tmpdir(), "svt-settled-"));
mkdirSync(join(dir, "lib"));
for (const f of readdirSync(join(ROOT, "lib"))) {
  if (!f.endsWith(".js")) continue;
  writeFileSync(join(dir, "lib", f),
    readFileSync(join(ROOT, "lib", f), "utf8").replace(/(from\s+"\.\/[a-zA-Z]+)"/g, '$1.js"'));
}

const load = (f) => import(pathToFileURL(join(dir, f)).href);
const discovery = await load("lib/discovery.js");
const store = await load("lib/store.js");

let bad = 0;
const ok = (c, l, d = "") => {
  console.log(`  ${c ? "ok  " : "FAIL"}  ${l}${d ? `  ${d}` : ""}`);
  if (!c) bad += 1;
};

const names = (d) => d.findings.map((f) => f.name).sort();

/* Four findings from a pass that ran before any of this happened. */
const FINDINGS = [
  { name: "BuiltWith", url: "https://builtwith.com", namedBy: ["Store Leads"], contexts: [], count: 1 },
  { name: "Wappalyzer", url: "https://www.wappalyzer.com", namedBy: ["Applora"], contexts: [], count: 1 },
  { name: "Apptics", url: "https://apptics.invalid", namedBy: ["SAMI"], contexts: [], count: 1 },
  { name: "Shopalyser", url: "https://shopalyser.invalid", namedBy: ["Ranksy"], contexts: [], count: 1 },
];

const seed = () => store.write("svt:discovery", {
  at: "2026-08-01T09:00:00.000Z", checked: 30, withPages: 6, findings: FINDINGS,
});

/* ---------------------------------------------------------------- */
console.log("\nthe real BuiltWith case, against the real catalogue:");
await seed();
await store.write(store.KEYS.suggestions, []);
{
  /*
   * getDiscovery reads the live catalogue, and BuiltWith is in it: it was
   * added in a75d745, a week after a pass had named it as somebody's
   * competitor. Before this, the stored finding still read "not in the
   * directory" and would have gone on reading that until the next monthly run.
   * It is gone on the first render now, with nothing rerun and nothing edited.
   */
  const d = await discovery.getDiscovery();
  ok(!names(d).includes("BuiltWith"), "a finding listed since the pass is gone on render", names(d).join(", "));
  ok(d.listedSince === 1, "and is counted as having been listed", `${d.listedSince}`);
  ok(d.findings.length === 3, "the three nobody has dealt with are still here", `${d.findings.length}`);
  ok(d.queuedSince === 0, "and none of them is in the queue yet");
}

/* ---------------------------------------------------------------- */
console.log("\nsomething gets added to the directory:");
{
  /* The real BuiltWith case: named on a comparison page, listed since. */
  const catalogue = [{ id: "builtwith", name: "BuiltWith", domain: "builtwith.com", url: "https://builtwith.com" }];
  ok(Boolean(discovery.settled(FINDINGS[0], { catalogue })), "a finding whose name is now listed is settled");
  ok(discovery.settled(FINDINGS[0], { catalogue })?.how === "listed", "and says why", "listed");

  /* Same entry, renamed in the catalogue. The domain is what still matches. */
  const renamed = [{ id: "builtwith", name: "BuiltWith Technology Lookup", domain: "builtwith.com", url: "https://builtwith.com" }];
  ok(Boolean(discovery.settled({ name: "Bwith", url: "https://builtwith.com" }, { catalogue: renamed })),
    "a name that does not match still matches on its domain");

  /* And the guard invariant 17 exists for: a domain with more than one entry
     behind it does not identify a product, so it must not decide this. */
  const shared = [
    { id: "elevate", name: "Elevate", domain: "marmeto.com", url: "https://marmeto.com/elevate" },
    { id: "orbit", name: "Orbit", domain: "marmeto.com", url: "https://marmeto.com/orbit" },
  ];
  ok(discovery.settled({ name: "Pulse", url: "https://marmeto.com/pulse" }, { catalogue: shared }) === null,
    "a shared domain does not settle a different product");
}

/* ---------------------------------------------------------------- */
console.log("\none finding is pushed to the suggestion queue:");
await seed();
await store.write(store.KEYS.suggestions, [
  { id: "s1", name: "Apptics", url: "https://apptics.invalid", domain: "apptics.invalid", kind: "tool", via: "discovery" },
]);
{
  const d = await discovery.getDiscovery();
  ok(!names(d).includes("Apptics"), "it leaves the discovery list", names(d).join(", "));
  ok(d.queuedSince === 1, "and is counted as having gone to the queue", `${d.queuedSince}`);
  ok(d.findings.length === 2, "the two nobody has dealt with are untouched", names(d).join(", "));
}

console.log("\nand a later pass does not put it back:");
{
  /* runDiscovery's own filter, exercised through the predicate both use. */
  const queued = [{ id: "s1", name: "Apptics", url: "https://apptics.invalid", domain: "apptics.invalid", kind: "tool" }];
  ok(discovery.settled({ name: "Apptics", url: "https://apptics.invalid" }, { queued })?.how === "queued",
    "a fresh pass skips it too");
}

console.log("\nbut deleting the queue row is not the same as dismissing it:");
await store.write(store.KEYS.suggestions, [
  { id: "s1", name: "Apptics", url: "https://apptics.invalid", domain: "apptics.invalid", kind: "tool", status: "deleted" },
]);
{
  const d = await discovery.getDiscovery();
  ok(names(d).includes("Apptics"), "the finding comes back", names(d).join(", "));
  ok(d.queuedSince === 0, "and is no longer counted as queued");
}

/* ---------------------------------------------------------------- */
console.log("\ndeclining a name:");
await store.write(store.KEYS.suggestions, []);
await discovery.dismissFinding({ name: "Wappalyzer", url: "https://www.wappalyzer.com", reason: "out of scope", by: "admin@test" });
{
  const d = await discovery.getDiscovery();
  ok(!names(d).includes("Wappalyzer"), "it leaves the list", names(d).join(", "));
  ok(d.dismissed.length === 1, "and is in the dismissed set with its reason", d.dismissed[0]?.reason);
  ok(d.queuedSince === 0, "a dismissal is not counted as queued: it is neither listed nor queued");
  ok(discovery.settled({ name: "Wappalyzer" }, { dismissed: await discovery.getDismissed() })?.how === "dismissed",
    "and a later pass skips it");
}

console.log("\nrestoring it:");
await discovery.restoreFinding(discovery.discoveryKey("Wappalyzer"));
{
  const d = await discovery.getDiscovery();
  ok(names(d).includes("Wappalyzer"), "it is back on the list");
  ok(d.dismissed.length === 0, "and out of the dismissed set");
}

/* ---------------------------------------------------------------- */
console.log("\nclearing the list:");
await discovery.dismissFinding({ name: "Shopalyser", reason: "defunct", by: "admin@test" });
{
  const { cleared } = await discovery.clearDiscovery({ by: "admin@test" });
  const d = await discovery.getDiscovery();
  ok(cleared === 4, "reports how many it threw away", `${cleared}`);
  ok(d.findings.length === 0, "the list is empty");
  ok(d.dismissed.length === 1, "and the dismissals survive: those are decisions, not stale data");
  const raw = await store.read("svt:discovery", {});
  ok(raw.clearedBy === "admin@test", "who cleared it is recorded", raw.clearedBy);
  ok(raw.at === "2026-08-01T09:00:00.000Z", "and the last pass date is kept, so the health strip still reads");
}

console.log(`\n${bad === 0 ? "all passed" : `${bad} FAILED`}\n`);
process.exit(bad === 0 ? 0 : 1);
