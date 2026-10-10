#!/usr/bin/env node
/*
 * Recommender feedback, blog comments and the announcement queue.
 *
 *   node scripts/shipping-test.mjs
 *
 * No server and no keys: the libraries are pure where it matters, and the
 * store falls back to memory.
 */
import { register } from "node:module";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readFileSync } from "node:fs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const k of Object.keys(process.env)) if (/^(UPSTASH|KV)_|_API_KEY$/.test(k)) delete process.env[k];
process.env.AUTH_SECRET = "shipping-test-secret";
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
const L = (p) => import(pathToFileURL(join(root, p)).href);

let failed = 0;
const ok = (c, what, extra = "") => { console.log(`  ${c ? "ok  " : "FAIL"}  ${what}${extra ? `  ${extra}` : ""}`); if (!c) failed++; };

/* ---------- recommender feedback ---------- */
console.log("recommender feedback:");
const fb = await L("lib/recommendFeedback.js");
const auth = await L("lib/auth.js");
const run = { id: "r1", at: "2026-10-10T10:00:00Z", answers: { problem: "No installs", budget: "low" }, app: { name: "Bee" }, path: "model", provider: "anthropic",
  picks: [{ id: "a", name: "A", why: "fits", drivers: ["problem"] }, { id: "b", name: "B", why: "fits too", drivers: [] }] };
let r = fb.applyFeedback(null, run, { pick: "a", vote: -1 });
ok(r.record && r.record.picks.a.vote === -1 && r.record.run.answers.problem === "No installs", "a thumb is saved with a copy of the run's inputs");
r = fb.applyFeedback(r.record, run, { pick: "a", why: "too pricey" });
ok(r.record.picks.a.vote === -1 && r.record.picks.a.why === "too pricey", "a line on why keeps the vote");
ok(fb.applyFeedback(r.record, run, { pick: "zzz", vote: 1 }).error, "a tool not in the run is refused");
ok(fb.applyFeedback(r.record, run, { helped: "maybe" }).error, "helped is yes, partly or no");
r = fb.applyFeedback(r.record, run, { helped: "no", text: "Nothing for retention" });
ok(r.record.helped === "no" && r.record.text === "Nothing for retention", "did-this-help and the free text are stored");
ok(!JSON.stringify(r.record).includes("@"), "no address in the record");
ok(auth.readRunToken(auth.mintRunToken("r1")) === "r1" && auth.readRunToken("forged.token") === null, "the run token round-trips and a forged one fails");
const runs = [run, { ...run, id: "r2" }, { ...run, id: "r3" }];
const many = { r1: { runId: "r1", run, picks: { a: { vote: -1 } } }, r2: { runId: "r2", run, picks: { a: { vote: -1 }, b: { vote: 1 } } }, r3: { runId: "r3", run, picks: { a: { vote: 1 } } } };
const s = fb.summariseFeedback(runs, many);
ok(s.misfits.map((t) => t.id).join() === "a", "recommended often and rejected often is flagged, and only that");
ok(s.mostRejected[0].id === "a" && s.mostRecommended.length === 2, "most recommended and most rejected are counted");

/* ---------- comments ---------- */
console.log("\nblog comments:");
const cm = await L("lib/comments.js");
let all = {};
let a = cm.addComment(all, "p", { author: "Al", text: "Good post", email: "x@y.co" });
ok(a.comment && a.comment.reviewed === false, "a comment is live and unread");
all = a.comments;
let pub = cm.publicComments(all.p, "x@y.co");
ok(pub.length === 1 && pub[0].mine && !("email" in pub[0]) && !("reviewed" in pub[0]), "the public view strips the address and moderation, adds mine");
ok(cm.moderate(all, "p", a.comment.id, "hide", {}).error, "hiding needs a reason");
all = cm.moderate(all, "p", a.comment.id, "hide", { reason: "spam", by: "admin@x" }).comments;
ok(cm.publicComments(all.p).length === 0, "a hidden comment is not served");
ok(!JSON.stringify(cm.publicComments(all.p)).includes("spam"), "nor is the reason");
all = cm.moderate(all, "p", a.comment.id, "unhide", { by: "admin@x" }).comments;
ok(cm.publicComments(all.p).length === 1 && all.p[0].audit.length === 2, "unhide puts it back, and both decisions are audited");
ok(cm.removeComment(all, "p", a.comment.id).comments.p.length === 0, "delete removes it");
const entries = await L("lib/entries.js");
const { POSTS } = await L("lib/blog.js");
ok(await entries.isVotableId(cm.postKey(POSTS[0].slug)), "a published post can be voted on");
ok(!(await entries.isListedId(cm.postKey(POSTS[0].slug))), "but is not a listing, so review, report and claim refuse it");
ok(!(await entries.isVotableId("post:nope")), "an unknown post cannot be voted on");
const route = readFileSync(join(root, "app/api/comment/route.js"), "utf8");
ok(route.indexOf("sessionFrom(request)") < route.indexOf("allow(") && /allow\("comment", ipOf\(request\), 15, 10 \* 60_000\)/.test(route), "sign-in before the limiter, and a review's limit");

/* ---------- announcements ---------- */
console.log("\nannouncements:");
const an = await L("lib/announcements.js");
const rows = await an.getAnnouncements();
ok(an.SEEDS.length === 5 && an.SEEDS.every((x) => rows.some((r) => r.id === x.id)), "five seeds are in the queue before anything is stored");
for (const row of rows) {
  const c = an.checksFor(row);
  ok(!c.hype.length && !c.numbers.length && !c.emDash, `seed "${row.id}" has no hype, no invented figure, no em-dash`, [...c.hype, ...c.numbers].join(", "));
}
ok(an.unsupportedNumbers("We hit 300 merchants with 47 tools", ["Tools listed: 47"]).join() === "300", "an invented figure is caught");
ok(an.hypeIn("Excited to announce this game-changing tool!").length >= 3, "hype is caught");
let u = await an.updateAnnouncement("seed-events", { status: "posted", postedAt: "2026-10-11" }, "admin@x");
ok(u.row.status === "posted" && u.row.postedAt === "2026-10-11", "posted carries its date, and a seed becomes a stored row");
u = await an.updateAnnouncement("seed-events", { status: "ready" });
ok(u.row.postedAt === "", "moving off posted clears the date");
ok((await an.updateAnnouncement("seed-events", { status: "live" })).error, "an unknown status is refused");
ok((await an.getAnnouncements()).filter((r) => r.id === "seed-events").length === 1, "a stored seed is not listed twice");

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
