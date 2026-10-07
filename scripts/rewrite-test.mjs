#!/usr/bin/env node
/*
 * AI rewrites of a listing: what they may write, what they never may, and
 * that every one is traceable and undoable.
 *
 *   node scripts/rewrite-test.mjs
 *
 * The model is not called. What matters here is everything around it: a
 * proposal that tries to rewrite the caveat, the category or the owner has
 * those parts dropped and recorded, whether they came from the model or were
 * posted by hand; saving goes through the override and leaves the file alone;
 * Undo puts back exactly what was there; the log ties every save to the
 * finding that prompted it; and publishing and rewriting the same finding are
 * resolved once, together.
 *
 * Same harness as feed-independence.mjs: the route is called directly against
 * the in-memory store, with lib/ shimmed into a temp directory.
 */

import { readFileSync, writeFileSync, mkdtempSync, readdirSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { pathToFileURL } from "url";
import { createHmac } from "crypto";

const ROOT = new URL("..", import.meta.url).pathname;
const SECRET = "rewrite-test-secret";
process.env.AUTH_SECRET = SECRET;
process.env.ADMIN_EMAILS = "admin@test.invalid";
delete process.env.ANTHROPIC_API_KEY;
delete process.env.OPENAI_API_KEY;

const dir = mkdtempSync(join(tmpdir(), "svt-rewrite-"));
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
const { POST } = await load("route.js");
const store = await load("lib/store.js");
const listings = await load("lib/listings.js");
const rewrite = await load("lib/rewrite.js");
const diff = await load("lib/sentencediff.js");

const b64 = (s) => Buffer.from(s).toString("base64url");
const body = b64(JSON.stringify({ t: "session", email: "admin@test.invalid", exp: Date.now() + 864e5 }));
const COOKIE = `svt_session=${body}.${createHmac("sha256", SECRET).update(body).digest("base64url")}`;
const call = (payload) => POST(new Request("http://localhost/api/admin", {
  method: "POST",
  headers: { cookie: COOKIE, "content-type": "application/json" },
  body: JSON.stringify(payload),
}));

let bad = 0;
const ok = (c, l, d = "") => {
  console.log(`  ${c ? "ok  " : "FAIL"}  ${l}${d ? `  ${d}` : ""}`);
  if (!c) bad += 1;
};

console.log("sanitiseProposal:");
{
  const current = { one: "a", note: "First sentence. Second sentence.", price: "$10" };
  const { fields, dropped } = rewrite.sanitiseProposal({
    note: "First sentence, now with Klaviyo — and more. Second sentence.",
    one: "a",
    watch: "No downsides!", cat: "suite", owner: "Somebody", linked: "x", ratings: [], url: "https://x.test",
  }, current);
  ok(Object.keys(fields).join() === "note", "keeps only the description field that changed", Object.keys(fields).join());
  ok(!/[—–]/.test(fields.note), "scrubs the em-dash", fields.note);
  const reasons = Object.fromEntries(dropped.map((d) => [d.field, d.reason]));
  for (const f of ["watch", "cat", "owner", "linked", "ratings"]) ok(reasons[f] === "protected", `${f} is dropped as protected`);
  ok(reasons.url === "outside", "url is dropped as outside a description rewrite");
}

console.log("\nsentence diff:");
{
  const figures = diff.sentences("28.2K apps tracked, 1.1M reviews. Pro is $4.99 on v2.0. Done.");
  ok(figures.length === 3, "decimals and versions do not end a sentence", JSON.stringify(figures));
  const before = "Tracks keyword rankings. Built for app vendors. Exports to CSV.";
  const clause = "Tracks keyword rankings, with alerts in Slack. Built for app vendors. Exports to CSV.";
  const appended = before + " It now integrates with Slack.";
  const a = diff.diffSentences(before, clause);
  ok(a.changedCount === 1 && a.after[0].changed && !a.after[1].changed, "a clause worked in marks one sentence");
  const b = diff.diffSentences(before, appended);
  ok(b.changedCount === 1 && b.after[3]?.changed, "an appended sentence is visible as one");
  ok(diff.growth(before, appended).pct > diff.GROWTH_WARN_PCT, "and it shows as growing the listing",
    `${diff.growth(before, appended).pct}%`);
}

const TOOL = "applora";
const CHANGE = {
  id: "chg-rw-1", at: new Date().toISOString(), entryId: TOOL, kind: "new-capability",
  what: "Added a Slack integration for review alerts.", old: "", new: "Slack integration",
  url: "https://applora.io/integrations", confidence: 0.8, edit: { state: "unmapped" },
};
await store.pushCapped(store.KEYS.changelog, [CHANGE]);

const toolNow = async () => (await listings.mergedTools()).find((t) => t.id === TOOL);
const original = await toolNow();
const NEW_NOTE = `${original.note.replace(/\.$/, "")}, with alerts in Slack.`;

console.log("\nresolve needs a destination:");
{
  const res = await call({ action: "resolve-change", id: CHANGE.id });
  ok(res.status === 400, "resolve with nothing done is refused", `HTTP ${res.status}`);
}

console.log("\nsave a rewrite that tries to touch protected fields:");
{
  const res = await call({
    action: "apply-rewrite", id: CHANGE.id,
    fields: { note: NEW_NOTE, watch: "No downsides!", cat: "suite", owner: "Somebody Else", ratings: [] },
    proposal: { note: NEW_NOTE },
    dropped: [{ field: "watch", reason: "protected" }],
    steer: "one clause only", provider: "test",
  });
  ok(res.status === 200, "returns 200", `HTTP ${res.status} ${res.status === 200 ? "" : await res.clone().text()}`);
  const t = await toolNow();
  ok(t.note === NEW_NOTE, "the note is rewritten");
  ok(t.watch === original.watch, "watch is untouched");
  ok(t.cat === original.cat, "cat is untouched");
  ok(t.owner === original.owner, "owner is untouched");
  ok(JSON.stringify(t.ratings) === JSON.stringify(original.ratings), "ratings are untouched");

  const log = await store.readCapped(store.KEYS.rewriteLog, 10);
  const row = log[0];
  ok(row?.changeId === CHANGE.id && row?.finding?.what === CHANGE.what, "the log names the finding that prompted it");
  ok(row?.finding?.url === CHANGE.url, "and its source page");
  ok(row?.before?.note === original.note && row?.saved?.note === NEW_NOTE, "and the text before and after");
  const droppedFields = (row?.dropped || []).map((d) => d.field);
  ok(["watch", "cat", "owner", "ratings"].every((f) => droppedFields.includes(f)), "and what was dropped", droppedFields.join(","));
  ok(row?.edited === false && row?.steer === "one clause only", "and whether it was edited, and the steer");

  const again = await call({ action: "apply-rewrite", id: CHANGE.id, fields: { note: "Something else." } });
  ok(again.status === 409, "a second rewrite of the same finding waits for Undo", `HTTP ${again.status}`);

  const seen = await store.read(store.KEYS.changesSeen, {});
  ok(!seen[CHANGE.id], "saving does not resolve the finding by itself");
}

console.log("\npublish the same finding, then resolve once:");
{
  const pub = await call({ action: "publish-to-feed", id: CHANGE.id, headline: "Added Slack alerts for new reviews." });
  ok(pub.status === 200, "publishing alongside the rewrite works", `HTTP ${pub.status}`);
  const res = await call({ action: "resolve-change", id: CHANGE.id });
  ok(res.status === 200, "resolve returns 200");
  const seen = await store.read(store.KEYS.changesSeen, {});
  ok(seen[CHANGE.id]?.via === "resolved", "the finding is resolved");
  ok(JSON.stringify(seen[CHANGE.id]?.destinations) === JSON.stringify(["published", "rewritten"]),
    "with both destinations recorded", JSON.stringify(seen[CHANGE.id]?.destinations));
}

console.log("\nundo:");
{
  const res = await call({ action: "undo-rewrite", id: CHANGE.id });
  ok(res.status === 200, "returns 200");
  const t = await toolNow();
  ok(t.note === original.note, "the note is exactly what it was");
  const log = await store.readCapped(store.KEYS.rewriteLog, 10);
  ok(log[0]?.type === "undo" && log[0]?.undoes === log[1]?.id, "the undo is logged against the rewrite it undid");
  const seen = await store.read(store.KEYS.changesSeen, {});
  ok(!seen[CHANGE.id], "and the finding is open again");
}

console.log("\nthe route without a model:");
{
  const r = await rewrite.proposeRewrite({ change: CHANGE, tool: original });
  ok(Boolean(r.error), "proposeRewrite refuses rather than half-working", r.error);
}

console.log(bad ? `\n${bad} failed` : "\nall passed");
process.exit(bad ? 1 : 0);
