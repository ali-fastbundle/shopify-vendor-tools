#!/usr/bin/env node
/*
 * The monitor's accuracy rules: not observed is not removed, a billing toggle
 * makes a page partial, confidence means verification, and a finding marked
 * wrong stays wrong.
 *
 *   node scripts/monitor-accuracy.mjs
 *
 * Built around the two findings that were reported at 0.9 and were wrong.
 * PPSPY "removed annual pricing" when the annual figures sat behind a
 * Monthly/Yearly switch a static fetch never clicks; the markup below is
 * PPSPY's own, as served. No model is called: everything that decides whether
 * a finding exists, and how sure it is, runs in code, which is the point.
 *
 * Same harness as rewrite-test.mjs: lib/ shimmed into a temp directory and the
 * admin route called directly against the in-memory store.
 */

import { readFileSync, writeFileSync, mkdtempSync, readdirSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { pathToFileURL } from "url";
import { createHmac } from "crypto";

const ROOT = new URL("..", import.meta.url).pathname;
const SECRET = "monitor-accuracy-secret";
process.env.AUTH_SECRET = SECRET;
process.env.ADMIN_EMAILS = "admin@test.invalid";

const dir = mkdtempSync(join(tmpdir(), "svt-accuracy-"));
mkdirSync(join(dir, "lib"));
for (const f of readdirSync(join(ROOT, "lib"))) {
  if (!f.endsWith(".js")) continue;
  writeFileSync(join(dir, "lib", f),
    readFileSync(join(ROOT, "lib", f), "utf8").replace(/(from\s+"\.\/[a-zA-Z]+)"/g, '$1.js"'));
}
writeFileSync(join(dir, "route.js"),
  readFileSync(join(ROOT, "app/api/admin/route.js"), "utf8")
    .replace(/from\s+"@\/lib\/([a-zA-Z]+)"/g, 'from "./lib/$1.js"'));

const load = (f) => import(pathToFileURL(join(dir, f)).href);
const m = await load("lib/monitor.js");
const findings = await load("lib/findings.js");
const store = await load("lib/store.js");
const { POST } = await load("route.js");

let bad = 0;
const ok = (c, l, d = "") => {
  console.log(`  ${c ? "ok  " : "FAIL"}  ${l}${d ? `  ${d}` : ""}`);
  if (!c) bad += 1;
};

console.log("billing toggles:");
{
  const PPSPY = `<div class="pricing-way-box"> <div class="pricing-way"> <div class="pricing-way-item pricing-actived" onclick="changePlan('month')" id="monthPlan"> <span>Monthly</span> </div> <div class="pricing-way-item" onclick="changePlan('year')" id="yearPlan"> <span>Yearly</span> <em>- 30%</em> </div> </div> </div>`;
  const t = m.detectBillingToggle(PPSPY);
  ok(t?.partial === true, "PPSPY's Monthly/Yearly switch is detected", t?.why);
  ok(m.detectBillingToggle(`<button role="switch" aria-checked="false"><span>Monthly</span></button><span>Annually</span>`)?.partial,
    "an ARIA switch is detected");
  ok(!m.detectBillingToggle(`<h3>Monthly</h3><p>$49</p><p>Prefer to pay once?</p><h3>Annual</h3><p>$490</p>`),
    "a page that simply lists both periods is not partial");
  ok(!m.detectBillingToggle(`<h3>Monthly</h3><p>$49</p>`), "a monthly-only page is not partial");
}

const PREV = {
  headline: "Find winning products",
  pricing: [
    { tier: "Basic", price: "$39/mo" }, { tier: "Pro", price: "$99/mo" }, { tier: "Business", price: "$299/mo" },
    { tier: "Basic annual", price: "$328/yr" }, { tier: "Pro annual", price: "$832/yr" }, { tier: "Business annual", price: "$2512/yr" },
  ],
  freeTier: true, pricingPublished: true, scale: [], integrations: ["Shopify"],
  status: { windingDown: false, acquired: false, migrating: false, evidence: "" }, company: "",
};
const MONTHLY_ONLY = { ...PREV, pricing: PREV.pricing.slice(0, 3), freeTier: null };

console.log("\nnot observed is not removed:");
{
  const r1 = m.reconcileSnapshot(PREV, MONTHLY_ONLY, { partial: false });
  ok(r1.carried.length === 3 && r1.missingTwice.length === 0, "first miss: the annual figures are carried, not removed",
    `${r1.carried.length} carried`);
  ok(r1.equal, "and the reading counts as unchanged, so no compare call is made");
  ok(r1.snapshot.pricing.length === 6, "the stored baseline still holds all six prices");
  ok(r1.snapshot.freeTier === true, "a free tier that read as null is carried, not lost");

  const r2 = m.reconcileSnapshot(r1.snapshot, MONTHLY_ONLY, { partial: false });
  ok(r2.missingTwice.length === 3, "second consecutive full miss: now a removal candidate", `${r2.missingTwice.length}`);

  let snap = PREV;
  for (let i = 0; i < 5; i++) snap = m.reconcileSnapshot(snap, MONTHLY_ONLY, { partial: true }).snapshot;
  const r3 = m.reconcileSnapshot(snap, MONTHLY_ONLY, { partial: true });
  ok(r3.missingTwice.length === 0 && r3.carried.length === 3, "on a toggle page, absence never accumulates, however many runs");

  const back = m.reconcileSnapshot(r1.snapshot, PREV, { partial: false });
  ok(!back.snapshot._unobserved && back.carried.length === 0, "values reappearing clear the not-observed marks");

  ok(m.pairIdOf(PREV, r1.snapshot) === m.pairIdOf(PREV, { ...r1.snapshot, _unobserved: { pricing: [{ key: "x", runs: 9 }] } }),
    "the pair id ignores the bookkeeping");
}

const ENTRY = { id: "ppspy", name: "PPSPY", url: "https://www.ppspy.com", one: "", note: "", price: "Free plan, then $39 / $99 / $299 a month" };
const MODEL_SAID = { changes: [{
  kind: "pricing", what: "Annual pricing was removed; only monthly plans are listed.",
  old: "$328/yr, $832/yr, $2512/yr", new: "Monthly plans only", url: "https://www.ppspy.com/rank",
  confidence: 0.9, editListing: true, why: "", edit: null,
}] };

console.log("\nthe PPSPY finding itself:");
{
  const r1 = m.reconcileSnapshot(PREV, MONTHLY_ONLY, { partial: false });
  const out = m.cleanChanges(MODEL_SAID, ENTRY, { carried: r1.carried, missingTwice: r1.missingTwice });
  ok(out.length === 0, "a removal of values only unobserved this run is dropped in code, whatever the model wrote");

  const r2 = m.reconcileSnapshot(r1.snapshot, MONTHLY_ONLY, { partial: false });
  const removal = { changes: [{ ...MODEL_SAID.changes[0], old: "$328/yr", new: "removed" }] };
  const kept = m.cleanChanges(removal, ENTRY, { missingTwice: r2.missingTwice });
  ok(kept.length === 1 && kept[0].verification === "missing-twice" && kept[0].confidence === 0.75,
    "missing on two full readings: reportable, at 0.75, labelled missing-twice", JSON.stringify(kept[0] && { v: kept[0].verification, c: kept[0].confidence }));

  const prompt = m.comparePrompt(ENTRY, PREV, r1.snapshot, {
    carried: r1.carried, partialPages: [{ label: "pricing", url: "https://www.ppspy.com/rank", partialWhy: "monthly/annual billing toggle" }],
    mistakes: [{ entryName: "PPSPY", kind: "pricing", reason: "annual prices are behind a toggle", finding: { what: "Annual pricing removed", old: "$328/yr", new: "" } }],
  });
  ok(/NOT OBSERVED THIS RUN/.test(prompt) && /PARTIALLY OBSERVABLE/.test(prompt) && /annual prices are behind a toggle/.test(prompt),
    "the compare prompt names the unobserved values, the partial page and the past mistake");
  ok(!/_unobserved/.test(prompt), "and never shows the model the bookkeeping");
}

console.log("\nconfidence is verification:");
{
  const base = { kind: "pricing", old: "$49/mo", new: "$79/mo", confidence: 0.9, what: "x" };
  ok(m.calibrate(base).confidence === 0.6 && m.calibrate(base).modelConfidence === 0.9,
    "a single reading at 0.9 is shown as 0.6, with the model's 0.9 kept beside it");
  ok(m.calibrate(base, { partial: true }).confidence === 0.4, "pricing from a toggle page is 0.4");
  ok(m.calibrate({ ...base, kind: "new-capability" }, { partial: true }).confidence === 0.6,
    "a toggle only lowers pricing and free-tier findings");

  const row = { id: "r1", ...m.calibrate(base) };
  ok(m.confirmsFinding(row, { pricing: [{ tier: "Starter", price: "$79/mo" }] }) === "confirmed", "read again next run: confirmed");
  ok(m.confirmsFinding(row, { pricing: [{ tier: "Starter", price: "$49/mo" }] }) === "not-repeated", "not read again: not repeated");
  ok(findings.effectiveConfidence(row, { r1: { state: "confirmed" } }).value === 0.9, "confirmed shows as 0.9");
  ok(findings.effectiveConfidence(row, { r1: { state: "not-repeated" } }).value === 0.3, "not repeated shows as 0.3");
  ok(m.confirmsFinding({ kind: "new-capability", new: "Klaviyo" }, { integrations: ["Shopify"] }) === "",
    "a capability not found is left unverified rather than downgraded");
}

console.log("\nmarked wrong stays wrong:");
{
  const pairId = "abcdef0123456789";
  const errors = [{ entryId: "ppspy", pairId, kind: "pricing", reason: "toggle" }];
  const kinds = m.suppressedKinds(errors, "ppspy", pairId);
  const again = m.cleanChanges({ changes: [{ ...MODEL_SAID.changes[0], old: "$39/mo", new: "$49/mo" }] }, ENTRY, { suppressKinds: kinds });
  ok(again.length === 0, "the same kind from the same snapshot pair is never reported again");
  ok(m.suppressedKinds(errors, "ppspy", "another-pair").size === 0, "a different pair is judged afresh");
  const order = m.mistakesFor("ppspy", [{ entryId: "x" }, { entryId: "ppspy" }, { entryId: "y" }]);
  ok(order[0].entryId === "ppspy", "this entry's own mistakes are shown to the model first");
}

console.log("\nthe route:");
{
  const b64 = (s) => Buffer.from(s).toString("base64url");
  const body = b64(JSON.stringify({ t: "session", email: "admin@test.invalid", exp: Date.now() + 864e5 }));
  const COOKIE = `svt_session=${body}.${createHmac("sha256", SECRET).update(body).digest("base64url")}`;
  const call = (payload) => POST(new Request("http://localhost/api/admin", {
    method: "POST", headers: { cookie: COOKIE, "content-type": "application/json" }, body: JSON.stringify(payload),
  }));

  const pairId = "feedface00000001";
  await store.write(store.KEYS.monitorPairs, { [pairId]: { at: new Date().toISOString(), entryId: "ppspy", before: PREV, after: MONTHLY_ONLY } });
  const ROW = {
    id: "chg-pp-1", at: new Date().toISOString(), entryId: "ppspy", entryName: "PPSPY", ...MODEL_SAID.changes[0],
    pairId, verification: "single-run", modelConfidence: 0.9, confidence: 0.6, edit: { state: "unmapped" },
  };
  await store.pushCapped(store.KEYS.changelog, [ROW]);

  const noReason = await call({ action: "mark-wrong", id: ROW.id, reason: "   " });
  ok(noReason.status === 400, "a reason is required", `HTTP ${noReason.status}`);

  const res = await call({ action: "mark-wrong", id: ROW.id, reason: "Annual prices render only after the\nYearly toggle is clicked" });
  ok(res.status === 200, "marking wrong returns 200", `HTTP ${res.status}`);
  const [err] = await store.readCapped(store.KEYS.monitorErrors, 10);
  ok(err?.reason === "Annual prices render only after the Yearly toggle is clicked", "the reason is stored, on one line");
  ok(err?.entryId === "ppspy" && err?.kind === "pricing" && err?.finding?.old === ROW.old, "with the tool and the finding");
  ok(err?.pairId === pairId && err?.pair?.before?.pricing?.length === 6 && err?.pair?.after?.pricing?.length === 3,
    "and the snapshot pair that produced it, inline");
  const seen = await store.read(store.KEYS.changesSeen, {});
  ok(seen[ROW.id]?.via === "wrong", "the finding leaves the Inbox as wrong, not dismissed");
  const twice = await call({ action: "mark-wrong", id: ROW.id, reason: "again" });
  ok(twice.status === 409, "marking it twice is refused");

  const rates = findings.errorRates([ROW, { id: "x2", kind: "pricing" }, { id: "x3", kind: "scale" }], [err], {});
  const pricing = rates.find((g) => g.kind === "pricing");
  ok(pricing.findings === 2 && pricing.wrong === 1 && pricing.rate === 0.5, "the error rate per type is computed from the same rows",
    JSON.stringify(pricing));
  ok(rates[0].kind === "pricing", "worst first");

  const un = await call({ action: "unmark-wrong", id: ROW.id });
  ok(un.status === 200 && (await store.readCapped(store.KEYS.monitorErrors, 10)).length === 0, "unmarking removes the record");
  ok(!(await store.read(store.KEYS.changesSeen, {}))[ROW.id], "and reopens the finding");
}

console.log(bad ? `\n${bad} failed` : "\nall passed");
process.exit(bad ? 1 : 0);
