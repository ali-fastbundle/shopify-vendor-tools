#!/usr/bin/env node
/*
 * Submit a tool that is already listed, twice, and check the counter moves.
 *
 *   node scripts/interest-test.mjs                          # localhost:3000
 *   node scripts/interest-test.mjs https://watchfor.tools --yes-write-to-production
 *
 * This is a live test, not a unit test: it posts real submissions to a real
 * server and reads the real answer back. That is the point. The bug it exists
 * to catch could not have been found any other way, because every part of the
 * route worked in isolation and the failure was the rate limiter three calls
 * earlier in the file.
 *
 * It writes. Two interest records land against the tool it picks, attributed to
 * the submitter name below so they are identifiable in /admin. Against
 * localhost that is free. Against anything else it refuses without the explicit
 * flag, because "I ran the test suite" should never be how production data gets
 * a row nobody meant to add.
 */

const BASE = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");
const FORCE = process.argv.includes("--yes-write-to-production");
const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE);

const BY = "interest-test (safe to delete)";

/* A tool that is in lib/tools.js, so the test does not depend on anything
   somebody published from the admin queue and might unpublish. */
const TOOL = { id: "ranksy", name: "Ranksy", url: "https://ranksyapp.com" };

let failures = 0;
const ok = (cond, label, detail = "") => {
  console.log(`  ${cond ? "ok  " : "FAIL"}  ${label}${detail ? `  ${detail}` : ""}`);
  if (!cond) failures += 1;
};

async function submit(n) {
  const res = await fetch(`${BASE}/api/suggest`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: TOOL.name,
      url: TOOL.url,
      kind: "tool",
      by: BY,
      why: `Automated check, submission ${n}. Safe to delete.`,
    }),
  });
  const text = await res.text();
  let body = null;
  try { body = JSON.parse(text); } catch { /* keep the text for the report */ }
  return { status: res.status, body, text };
}

async function main() {
  console.log(`Interest counter, live, against ${BASE}\n`);

  if (!LOCAL && !FORCE) {
    console.error("Refusing to write to a non-local server without --yes-write-to-production.");
    console.error("It posts two real submissions and leaves two interest records behind.");
    process.exit(2);
  }

  const first = await submit(1);
  console.log(`  first  → HTTP ${first.status}  ${first.text.slice(0, 140)}`);
  ok(first.status === 200, "first submission returns 200, never an error");
  ok(Boolean(first.body?.alreadyListed), "answered as already listed");
  ok(first.body?.alreadyListed?.id === TOOL.id, "matched the right tool", `got ${first.body?.alreadyListed?.id}`);
  ok(Boolean(first.body?.alreadyListed?.url), "carries a link back to the listing");

  const second = await submit(2);
  console.log(`  second → HTTP ${second.status}  ${second.text.slice(0, 140)}`);
  ok(second.status === 200, "second submission returns 200, never an error");

  const a = Number(first.body?.alreadyListed?.count);
  const b = Number(second.body?.alreadyListed?.count);
  ok(Number.isFinite(a) && a >= 1, "first submission reports a count", `count=${a}`);
  ok(b === a + 1, "the counter incremented by exactly one", `${a} → ${b}`);
  ok(b >= 2, "the counter reached at least 2", `count=${b}`);

  /*
   * The regression this file is named after. Three was the old cap, and the
   * fourth already-listed submission in an hour used to come back 429. It
   * must not, because it creates nothing.
   */
  const third = await submit(3);
  const fourth = await submit(4);
  console.log(`  third  → HTTP ${third.status}`);
  console.log(`  fourth → HTTP ${fourth.status}  ${fourth.text.slice(0, 100)}`);
  ok(third.status === 200 && fourth.status === 200,
    "a fourth already-listed submission is still 200, not rate limited");
  ok(Number(fourth.body?.alreadyListed?.count) === a + 3,
    "all four counted", `${a} → ${fourth.body?.alreadyListed?.count}`);

  /* Unreviewed drafts must not be in a public payload. */
  const anyDraft = (first.body?.suggestions || []).some((s) => "draft" in s || "email" in s || "also" in s);
  ok(!anyDraft, "no draft, email or also field in the public suggestions payload");

  console.log(`\n${failures ? `${failures} FAILED` : "all checks passed"}`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => { console.error("test threw:", e.message); process.exit(1); });
