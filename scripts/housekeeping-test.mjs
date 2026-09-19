#!/usr/bin/env node
/*
 * The housekeeping panel: what it reports, and what it refuses to delete.
 *
 *   node scripts/housekeeping-test.mjs
 *
 * The reset is one button that deletes four whole collections, so the thing
 * worth a test is not that it works. It is everything it must leave alone, and
 * in particular the monitor snapshots: they are the baseline the next weekly
 * diff is taken against, and a run with nothing to compare against reports
 * every tool in the directory as changed. That failure would not show up until
 * the following Monday, in an email nobody would read twice.
 *
 * Same harness as the other library tests: lib/ is copied into a temp
 * directory with its relative imports given extensions, so this runs against
 * the in-memory store rather than production Redis.
 */

import { readFileSync, writeFileSync, mkdtempSync, readdirSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { pathToFileURL } from "url";

const ROOT = new URL("..", import.meta.url).pathname;

const dir = mkdtempSync(join(tmpdir(), "svt-housekeeping-"));
mkdirSync(join(dir, "lib"));
for (const f of readdirSync(join(ROOT, "lib"))) {
  if (!f.endsWith(".js")) continue;
  writeFileSync(join(dir, "lib", f),
    readFileSync(join(ROOT, "lib", f), "utf8").replace(/(from\s+"\.\/[a-zA-Z]+)"/g, '$1.js"'));
}

const load = (f) => import(pathToFileURL(join(dir, f)).href);
const inv = await load("lib/inventory.js");
const store = await load("lib/store.js");

let bad = 0;
const ok = (c, l, d = "") => {
  console.log(`  ${c ? "ok  " : "FAIL"}  ${l}${d ? `  ${d}` : ""}`);
  if (!c) bad += 1;
};

const K = store.KEYS;

/* Everything the reset must leave exactly as it found it. */
const PROTECTED = {
  "svt:claims": { applora: { email: "vendor@applora.ai", method: "email-domain", at: "2026-05-01" } },
  "svt:overrides": { applora: { price: "Free, Pro $59/mo" } },
  "svt:snapshots": { applora: { at: "2026-09-15T09:00:00.000Z", pricing: ["$49"] } },
  "svt:monitor": { at: "2026-09-15T09:00:00.000Z", ran: 33 },
  "svt:interest": { ranksy: { count: 4, people: [{ by: "someone", email: "a@b.invalid" }] } },
};

async function seed() {
  await store.write(K.votes, { applora: { up: 3, down: 1 }, ranksy: { up: 2, down: 0 } });
  await store.write(K.reviews, {
    applora: [
      { id: "r1", email: "ali@fastbundle.co", author: "Ali", rating: 5, text: "A test review.", date: "2026-09-01" },
      { id: "r2", email: "real@person.invalid", author: "Sam", rating: 4, text: "Genuinely useful.", date: "2026-09-02" },
    ],
    ranksy: [{ id: "r3", email: "ali@fastbundle.co", author: "Ali", rating: 3, date: "2026-09-03" }],
  });
  await store.write(K.subscribers, [
    { email: "test@example.invalid", date: "2026-08-01" },
    { email: "someone@real.invalid", date: "2026-08-02" },
  ]);
  await store.write(K.accounts, {
    "ali@fastbundle.co": { email: "ali@fastbundle.co", firstSeen: "2026-05-01T00:00:00.000Z", lastSeen: "2026-09-18T00:00:00.000Z" },
    "someone@real.invalid": { email: "someone@real.invalid", firstSeen: "2026-09-01T00:00:00.000Z", lastSeen: "2026-09-02T00:00:00.000Z" },
  });
  await store.write(K.suggestions, [{ id: "s1", name: "Something", by: "a visitor", at: "2026-09-01" }]);
  await store.write(K.reports, [{ id: "p1", toolId: "applora", kind: "dead-link", value: "404", at: "2026-09-01" }]);
  await store.write(K.stats, { "suggestions:received": 41, "tool:applora": 903 });
  await store.write(K.entries, { newtool: { id: "newtool", name: "New Tool", domain: "new.invalid" } });
  for (const [key, value] of Object.entries(PROTECTED)) await store.write(key, value);

  await store.del(K.maillog);
  await store.pushMailLog([
    { event: "review", cls: "admin", to: "ali@fastbundle.co", ok: true, at: "2026-09-01T10:00:00.000Z" },
    { event: "subscribe", cls: "user", to: "someone@real.invalid", ok: true, at: "2026-09-02T10:00:00.000Z" },
    { event: "signin_new", cls: "admin", to: "ali@fastbundle.co", ok: true, at: "2026-09-03T10:00:00.000Z", test: true },
  ]);
}

const byKey = (rows, key) => rows.find((r) => r.key === key);

/* ---------------------------------------------------------------- */
console.log("\nreporting what is there:");
await seed();
{
  const rows = await inv.storeInventory();
  ok(byKey(rows, K.votes).count === 2, "counts vote rows", `${byKey(rows, K.votes).count}`);
  ok(byKey(rows, K.reviews).count === 3, "counts reviews across tools", `${byKey(rows, K.reviews).count}`);
  ok(byKey(rows, K.subscribers).count === 2, "counts subscribers");
  ok(byKey(rows, K.maillog).count === 3, "counts mail log rows");
  ok(byKey(rows, "svt:snapshots").count === 1, "and the snapshots, which it will never clear");

  const reviews = byKey(rows, K.reviews).rows;
  ok(reviews.length === 3, "small collections come back with their rows");
  ok(reviews[0].detail.includes("ali@fastbundle.co"),
    "and a review row shows whose it is, which is the whole point of listing them");

  const mail = byKey(rows, K.maillog).rows;
  ok(mail.some((m) => m.test), "a test send is marked as one rather than left to be guessed at");
  ok(mail.filter((m) => m.test).length === 1, "and only the one that was");

  const resets = rows.filter((r) => r.reset).map((r) => r.key).sort();
  ok(JSON.stringify(resets) === JSON.stringify([K.maillog, K.reviews, K.subscribers, K.votes].sort()),
    "exactly four collections are marked as cleared by the reset", resets.join(", "));
}

/* ---------------------------------------------------------------- */
console.log("\nmarking one row at a time:");
{
  let r = await inv.deleteRow("review", "applora:r1");
  ok(r.ok, "a single review goes", r.error || "");
  const reviews = await store.read(K.reviews, {});
  ok(reviews.applora.length === 1 && reviews.applora[0].id === "r2", "and the other one on that tool stays");

  r = await inv.deleteRow("account", "ali@fastbundle.co");
  ok(r.ok, "an account goes");
  ok(!(await store.read(K.accounts, {}))["ali@fastbundle.co"], "and is gone from the record");
  ok(Boolean((await store.read(K.accounts, {}))["someone@real.invalid"]), "the other account is untouched");

  r = await inv.deleteRow("subscriber", "test@example.invalid");
  ok(r.ok, "a subscriber goes");
  ok((await store.read(K.subscribers, [])).length === 1, "and the list is one shorter");

  r = await inv.deleteRow("mail", "0");
  ok(r.ok, "a mail log row goes by position", r.error || "");
  const log = await store.readMailLog(50);
  ok(log.length === 2, "the log is one shorter", `${log.length}`);
  ok(log[0].event === "subscribe", "and the rest keep their order, newest first", log.map((l) => l.event).join(", "));

  /* Deleting the last review on a tool should take the tool's key with it,
     rather than leaving an empty array that reads as "reviewed, zero reviews". */
  await inv.deleteRow("review", "ranksy:r3");
  ok(!("ranksy" in await store.read(K.reviews, {})), "emptying a tool's reviews removes its key entirely");
}

console.log("\nand refusing what it is not for:");
{
  for (const target of ["claim", "override", "snapshot", "entry", "suggestion", "stats", ""]) {
    const r = await inv.deleteRow(target, "applora");
    ok(Boolean(r.error), `"${target || "(empty)"}" is not a target this can delete`, r.error || "IT DELETED SOMETHING");
  }
  ok((await inv.deleteRow("review", "applora:nope")).error, "an id that is not there is an error, not a silent no-op");
  ok((await inv.deleteRow("mail", "99")).error, "and so is a position past the end of the log");
}

/* ---------------------------------------------------------------- */
console.log("\nthe reset:");
await seed();
{
  const { cleared } = await inv.resetTestData({ by: "admin@test" });
  ok(cleared.votes === 2 && cleared.reviews === 3 && cleared.subscribers === 2 && cleared.maillog === 3,
    "it reports what it deleted, so the numbers can be checked against the panel",
    JSON.stringify(cleared));

  ok(Object.keys(await store.read(K.votes, {})).length === 0, "votes are gone");
  ok(Object.keys(await store.read(K.reviews, {})).length === 0, "reviews are gone");
  ok((await store.read(K.subscribers, [])).length === 0, "subscribers are gone");
  ok((await store.readMailLog(50)).length === 0, "the mail log is gone");
}

console.log("\nand what it must never have touched:");
{
  for (const [key, value] of Object.entries(PROTECTED)) {
    const now = await store.read(key, null);
    ok(JSON.stringify(now) === JSON.stringify(value), `${key} is exactly as it was`);
  }
  ok((await store.read(K.suggestions, [])).length === 1, "svt:suggestions is untouched");
  ok((await store.read(K.reports, [])).length === 1, "svt:reports is untouched");
  ok(Object.keys(await store.read(K.entries, {})).length === 1, "svt:entries is untouched");
  const stats = await store.read(K.stats, {});
  ok(stats["suggestions:received"] === 41,
    "and the counters survive the rows, which is the whole of invariant 27");
  ok(Object.keys(await store.read(K.accounts, {})).length === 2,
    "accounts are not in the reset: a sign-in is not test data by default");
}

console.log(`\n${bad === 0 ? "all passed" : `${bad} FAILED`}\n`);
process.exit(bad === 0 ? 0 : 1);
