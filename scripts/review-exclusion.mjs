#!/usr/bin/env node
/*
 * Excluded reviews: shown, labelled, and counted nowhere.
 *
 *   node scripts/review-exclusion.mjs
 *
 * No server and no keys. Checks the average and the aggregateRating both read
 * the one rule, that an all-excluded listing has no rating at all rather than
 * an empty one, that who excluded a review never leaves the server, that a
 * reviewer editing their own text cannot clear the flag, and the two admin
 * markers: a burst, and a reviewer on the listing's own domain (by equality or
 * subdomain, never substring).
 */
import { register } from "node:module";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const k of Object.keys(process.env)) if (/^(UPSTASH|KV)_/.test(k)) delete process.env[k];
process.env.AUTH_SECRET = "review-test-secret";
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

let failed = 0;
const ok = (cond, what, extra = "") => { console.log(`  ${cond ? "ok  " : "FAIL"}  ${what}${extra ? `  ${extra}` : ""}`); if (!cond) failed++; };
const L = (p) => import(pathToFileURL(join(root, p)).href);
const src = (p) => readFileSync(join(root, p), "utf8");

const { ratingStats, setExclusion, confirmReview, publicReviews, upsertReview, exclusionNote, RATING_POLICY } = await L("lib/reviews.js");
const { ratingOf } = await L("lib/seo.js");
const { signalsFrom, sameSite } = await L("lib/reviewSignals.js");

const rv = (id, rating, date, email, extra = {}) => ({ id, rating, date, email, author: id, text: "t", ...extra });

console.log("\nthe average and the markup read one rule:");
let store = { x: [rv("a", 5, "2026-09-18", "reza@vendor.com"), rv("b", 2, "2026-09-20", "u@gmail.com")] };
ok(ratingStats(store.x).value === 3.5 && ratingOf("x", store).ratingCount === 2, "both count before anything is excluded");
store = setExclusion(store, "x", "a", "vendor", "admin@site").reviews;
ok(ratingStats(store.x).value === 2 && ratingStats(store.x).count === 1, "an excluded review leaves the average");
ok(ratingOf("x", store).ratingValue === 2 && ratingOf("x", store).ratingCount === 1, "and leaves the aggregateRating");
store = setExclusion(store, "x", "b", "unverifiable", "admin@site").reviews;
ok(ratingStats(store.x) === null, "all excluded: no rating, rather than a zero");
ok(ratingOf("x", store) === null, "all excluded: no aggregateRating at all");
ok(store.x.length === 2, "nothing is removed, both reviews are still stored");
store = setExclusion(store, "x", "b", null, "admin@site").reviews;
ok(!store.x.find((r) => r.id === "b").excluded && ratingStats(store.x).count === 1, "count it again restores it");
ok(setExclusion(store, "x", "nope", "vendor").error === "unknown", "an unknown review is refused");
ok(setExclusion(store, "x", "a", "because").error === "reason", "an unknown reason is refused");

console.log("\nwhat a visitor sees:");
const pub = publicReviews(store);
const a = pub.x.find((r) => r.id === "a");
ok(a.excluded && a.excluded.reason === "vendor" && !("by" in a.excluded) && !("at" in a.excluded),
  "the reason is public, who set it and when are not");
ok(!JSON.stringify(pub).includes("admin@site") && !JSON.stringify(pub).includes("reza@"), "no address in the public shape");
ok(exclusionNote(a) === "Not counted in the rating: written by the vendor's own team", "labelled with the reason", exclusionNote(a));
ok(exclusionNote(pub.x.find((r) => r.id === "b")) === "", "a counted review carries no label");

console.log("\nthe reviewer cannot clear it:");
const edited = upsertReview(store, "x", { ...rv("new", 5, "2026-10-01", "reza@vendor.com"), text: "rewritten" }).reviews;
ok(edited.x.find((r) => r.email === "reza@vendor.com").excluded?.reason === "vendor", "editing your review keeps the exclusion");

console.log("\nthe markers:");
ok(sameSite("bestappify.com", "bestappify.com") && sameSite("mail.vendor.com", "vendor.com"), "equal or subdomain matches");
ok(!sameSite("notvendor.com", "vendor.com") && !sameSite("gmail.com", "vendor.com"), "a substring does not");
const groups = signalsFrom({
  meridian: [
    rv("m1", 5, "2026-10-04", "alon@gmail.com"), rv("m2", 5, "2026-09-30", "a@x.io"),
    rv("m3", 5, "2026-09-29", "b@meridian.app"), rv("m4", 5, "2026-09-29", "c@y.io"),
  ],
  slow: [rv("s1", 4, "2026-01-01", "a@b.c"), rv("s2", 4, "2026-03-01", "d@e.f"), rv("s3", 4, "2026-06-01", "g@h.i")],
}, [
  { id: "meridian", name: "Meridian", domain: "meridian.app", url: "https://meridian.app", kind: "tool" },
  { id: "slow", name: "Slow", domain: "slow.com", url: "https://slow.com", kind: "tool" },
]);
const m = groups.find((g) => g.id === "meridian");
ok(m.burst && m.burst.count === 4 && m.burst.from === "2026-09-29" && m.burst.to === "2026-10-04", "four in six days is a burst", JSON.stringify(m.burst));
ok(m.domainMatches === 1 && m.reviews.find((r) => r.id === "m3").domainMatch, "the reviewer on the listing's domain is marked");
ok(!groups.find((g) => g.id === "slow").burst, "three spread over five months is not");
ok(groups[0].id === "meridian", "a marked listing sorts first");

console.log("\nthe policy is visible wherever a rating is:");
for (const f of ["components/ToolPage.jsx", "components/Engagement.jsx", "components/Directory.jsx"]) {
  const s = src(f);
  ok(s.includes("RATING_POLICY") && s.includes("exclusionNote("), `${f} shows the policy and the label`);
}
ok(/shown on the listing but not counted/.test(src("app/llms.txt/route.js")), "llms.txt says it");
ok(/not counted/.test(RATING_POLICY), "the policy sentence says not counted");
const admin = src("app/api/admin/route.js");
ok(admin.indexOf('action === "exclude-review"') > admin.indexOf("isAdmin(session.email)"), "the exclude action sits behind the admin check");
ok(!/reviewSignals/.test(src("components/Admin.jsx").split("\n").filter((l) => l.startsWith("import")).join("\n")),
  "the admin component does not import the server-only signals module");

console.log("\nconfirm and unexclude:");
{
  let st = { m: [
    rv("m1", 5, "2026-10-04", "alon@gmail.com"), rv("m2", 5, "2026-09-30", "a@x.io"),
    rv("m3", 5, "2026-09-29", "b@meridian.app"), rv("m4", 5, "2026-09-29", "c@y.io"),
  ] };
  const ents = [{ id: "m", name: "Meridian", domain: "meridian.app", url: "https://meridian.app", kind: "tool" }];
  const g0 = signalsFrom(st, ents)[0];
  ok(g0.needs === 4 && g0.burstOpen.length === 4, "four open, all four in the burst");
  ok(JSON.stringify(g0.reviews.find((r) => r.id === "m3").active) === '["burst","domain"]', "the same-domain review carries both markers");

  st = confirmReview(st, "m", "m1", ["burst"], "admin@site").reviews;
  const g1 = signalsFrom(st, ents)[0];
  ok(g1.reviews.find((r) => r.id === "m1").active.length === 0 && g1.needs === 3, "confirming one clears its marker");
  ok(g1.burstOpen.length === 3 && g1.reviews.filter((r) => r.active.includes("burst")).length === 3, "and leaves the other three in the burst raised");
  ok(ratingStats(st.m).count === 4, "a confirmed review stays counted");
  const c = st.m.find((r) => r.id === "m1");
  ok(c.confirmed.by === "admin@site" && c.confirmed.at && c.audit.at(-1).action === "confirmed", "who and when are recorded, and it is in the history");

  for (const id of g1.burstOpen) st = confirmReview(st, "m", id, ["burst"], "admin@site").reviews;
  const g2 = signalsFrom(st, ents)[0];
  ok(g2.burstOpen.length === 0, "confirming the burst clears it on every review");
  ok(JSON.stringify(g2.reviews.find((r) => r.id === "m3").active) === '["domain"]' && g2.needs === 1,
    "but a same-domain review inside it is still raised, for its own reason");
  ok(signalsFrom(st, ents)[0].reviews.find((r) => r.id === "m2").active.length === 0, "and a confirmed marker is not raised again on the next read");

  ok(confirmReview(st, "m", "m2", ["made-up"], "a").error === "markers", "an unknown marker kind is refused");
  st = setExclusion(st, "m", "m3", "vendor", "admin@site").reviews;
  ok(confirmReview(st, "m", "m3", ["domain"], "a").error === "excluded", "an excluded review cannot be confirmed, only unexcluded");
  ok(signalsFrom(st, ents)[0].needs === 0, "an excluded review needs no decision");
  st = setExclusion(st, "m", "m3", null, "admin@site").reviews;
  const u = st.m.find((r) => r.id === "m3");
  ok(!u.excluded && ratingStats(st.m).count === 4, "unexclude counts it again");
  ok(u.audit.map((a) => a.action).join() === "confirmed,excluded,unexcluded" && u.audit.at(-1).was === "vendor", "and the history keeps every decision, including what was undone", u.audit.map((a) => a.action).join());
  ok(setExclusion(st, "m", "m3", null, "x").error === "not-excluded", "unexcluding a review that is not excluded is refused");
  ok(signalsFrom(st, ents)[0].reviews.find((r) => r.id === "m3").active.join() === "domain", "unexcluded, its open marker is back for a decision");

  const pub = JSON.stringify(publicReviews(st));
  ok(!/"confirmed"|"audit"|admin@site/.test(pub), "neither the confirmation nor the history reaches a visitor");

  const edited = upsertReview(st, "m", { ...rv("x", 5, "2026-10-09", "alon@gmail.com"), text: "rewritten" }).reviews;
  ok(!edited.m.find((r) => r.email === "alon@gmail.com").confirmed, "rewriting the text clears a confirmation, which was given on the words");
  const sameText = upsertReview(st, "m", { ...rv("x", 4, "2026-10-09", "alon@gmail.com") }).reviews;
  ok(Boolean(sameText.m.find((r) => r.email === "alon@gmail.com").confirmed), "changing only the stars keeps it");
}

console.log("\nthe admin route:");
{
  const { createHmac } = await import("node:crypto");
  const { write, read, KEYS } = await L("lib/store.js");
  const route = await L("app/api/admin/route.js");
  const sess = (email) => { const b = Buffer.from(JSON.stringify({ t: "session", email, exp: Date.now() + 3600e3 })).toString("base64url"); return `svt_session=${b}.${createHmac("sha256", process.env.AUTH_SECRET).update(b).digest("base64url")}`; };
  const call = (body, cookie = sess("admin@example.com")) => route.POST(new Request("http://localhost:3000/api/admin", {
    method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": "10.9.0.1", cookie }, body: JSON.stringify(body) }));
  const { TOOLS } = await L("lib/tools.js");
  const t = TOOLS[0];
  const dom = t.domain;
  await write(KEYS.reviews, { [t.id]: [
    rv("r1", 5, "2026-10-01", "a@gmail.com"), rv("r2", 5, "2026-10-02", "b@gmail.com"), rv("r3", 5, "2026-10-03", `c@${dom}`),
  ] });
  ok((await call({ action: "confirm-burst", toolId: t.id }, sess("someone@example.com"))).status === 404, "not an admin: 404");
  const res = await call({ action: "confirm-burst", toolId: t.id });
  const d = await res.json();
  const g = d.reviewSignals.find((x) => x.id === t.id);
  ok(res.status === 200 && d.confirmed === 3 && g.burstOpen.length === 0, "confirm all in this burst confirms each of them", `${d.confirmed}`);
  ok(g.needs === 1 && g.reviews.find((r) => r.id === "r3").active.join() === "domain", "and leaves the same-domain marker for its own decision");
  ok((await call({ action: "confirm-burst", toolId: t.id })).status === 409, "pressing it again finds nothing left and says so");
  const one = await (await call({ action: "confirm-review", id: "r3", toolId: t.id })).json();
  ok(one.reviewSignals.find((x) => x.id === t.id).needs === 0, "confirming the last one leaves nothing to decide");
  const stored = (await read(KEYS.reviews, {}))[t.id];
  ok(stored.every((r) => r.confirmed?.by === "admin@example.com"), "every confirmation names who made it");
  ok((await call({ action: "unexclude-review", id: "r1", toolId: t.id })).status === 409, "unexcluding a review that is not excluded is refused");
}

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
