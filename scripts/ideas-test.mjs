#!/usr/bin/env node
/*
 * The ideas backlog: capture, statuses, the review's validation, the handoff
 * prompt and the commit record.
 *
 *   node scripts/ideas-test.mjs
 *
 * Shims lib/ into a temp directory and calls the route directly, so it runs
 * against the in-memory store with no server. No model key is set, so the
 * review route is checked for refusing plainly, and the review itself is
 * checked through buildPrompt and validateReview with a canned answer.
 */
import { readFileSync, writeFileSync, mkdtempSync, readdirSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { pathToFileURL } from "url";
import { createHmac } from "crypto";

const ROOT = new URL("..", import.meta.url).pathname;
const SECRET = "ideas-secret";
process.env.AUTH_SECRET = SECRET;
process.env.ADMIN_EMAILS = "admin@test.invalid";
delete process.env.ANTHROPIC_API_KEY;
delete process.env.OPENAI_API_KEY;

const dir = mkdtempSync(join(tmpdir(), "svt-ideas-"));
mkdirSync(join(dir, "lib"));
for (const f of readdirSync(join(ROOT, "lib"))) {
  if (!f.endsWith(".js")) continue;
  writeFileSync(join(dir, "lib", f),
    readFileSync(join(ROOT, "lib", f), "utf8").replace(/(from\s+"\.\/[a-zA-Z]+)"/g, '$1.js"')
      .replace(/import\("\.\/([a-zA-Z]+)"\)/g, 'import("./$1.js")'));
}
writeFileSync(join(dir, "ideas-route.js"),
  readFileSync(join(ROOT, "app/api/admin/ideas/route.js"), "utf8")
    .replace(/from\s+"@\/lib\/([a-zA-Z]+)"/g, 'from "./lib/$1.js"')
    .replace(/import\("@\/lib\/([a-zA-Z]+)"\)/g, 'import("./lib/$1.js")'));

const load = (f) => import(pathToFileURL(join(dir, f)).href);
const I = await load("lib/ideas.js");
const R = await load("lib/ideaReview.js");
const route = await load("ideas-route.js");

let bad = 0;
const ok = (c, l, d = "") => {
  console.log(`  ${c ? "ok  " : "FAIL"}  ${l}${d ? `  ${d}` : ""}`);
  if (!c) bad += 1;
};
const cookie = (email) => {
  const body = Buffer.from(JSON.stringify({ t: "session", email, exp: Date.now() + 864e5 })).toString("base64url");
  return `svt_session=${body}.${createHmac("sha256", SECRET).update(body).digest("base64url")}`;
};
const call = async (body, email = "admin@test.invalid") => {
  const res = await route.POST(new Request("http://localhost/api/admin/ideas", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie(email), "x-forwarded-for": "10.0.0.2" },
    body: JSON.stringify(body),
  }));
  return { status: res.status, body: res.ok ? await res.json() : await res.text() };
};

console.log("seeds:");
{
  const { body } = await call({ action: "update", id: "nothing", status: "new" });
  ok(/No such idea/.test(body), "an unknown id is refused");
  const ideas = (await call({ action: "add", text: "short" })).body;
  ok(/Write the idea first/.test(ideas), "an idea needs a sentence");
}
const first = (await call({ action: "add", text: "Show a changelog per tool as its own RSS feed.", surface: "What's moving", size: "a few days" })).body.ideas;
for (const id of ["seed-social-discussion", "seed-gated-recommender", "seed-vendor-changelog-rss", "seed-brag-video", "seed-homepage-reorg", "seed-retail-insider"]) {
  const s = first.find((r) => r.id === id);
  ok(s && s.stateNote && I.STATUSES.includes(s.status), `${id} is in the queue with a state`, s?.status);
}
ok(first.filter((r) => r.seeded).every((r) => r.commits.every(I.isCommitHash)), "seeded commit hashes are hashes");

for (const id of ["seed-paid-placement", "seed-advisor-service"]) {
  const s = first.find((r) => r.id === id);
  ok(s && s.status === "new" && /No listing here paid to be included/.test(s.stateNote) && /G2 and Capterra/.test(s.stateNote) && /footer line has to change/.test(s.stateNote),
    `${id} is queued with the footer conflict on record`);
}
ok(/No listing here paid to be included/.test(readFileSync(join(ROOT, "lib/ideaReview.js"), "utf8")), "the review is told to check ideas against the footer's promise");

console.log("\nthe queue:");
ok((await call({ action: "add", text: "anything at all here" }, "someone@test.invalid")).status === 404, "a non-admin gets 404");
{
  const ranks = first.map((r) => I.STATUSES.indexOf(r.status));
  ok(ranks.every((x, i) => i === 0 || ranks[i - 1] <= x), "sorted by status", ranks.join(","));
  const added = first.find((r) => !r.seeded);
  ok(added.status === "new" && added.surface === "What's moving" && added.size === "a few days", "a new idea keeps its surface and size");
  const noReason = await call({ action: "update", id: added.id, status: "dropped" });
  ok(noReason.status === 400 && /Say why/.test(noReason.body), "dropping needs a reason");
  const drop = (await call({ action: "update", id: added.id, status: "dropped", reason: "The universal feed already does this." })).body.ideas;
  const d = drop.find((r) => r.id === added.id);
  ok(d.status === "dropped" && d.dropped.reason && d.text, "dropped keeps the idea and the reason");
  ok(d.log[0].from === "new" && d.log[0].to === "dropped", "and the status change is logged");
  const touched = (await call({ action: "update", id: "seed-retail-insider", status: "approved" })).body.ideas;
  ok(touched.find((r) => r.id === "seed-retail-insider").status === "approved", "a seed is stored when first touched");
  ok(touched.filter((r) => r.id === "seed-retail-insider").length === 1, "and appears once");
}

console.log("\nthe review:");
{
  const refused = await call({ action: "review", id: "seed-social-discussion" });
  ok(refused.status === 502 && /No model key/.test(refused.body), "with no model key it refuses plainly", refused.body);
  const md = readFileSync(join(ROOT, "CLAUDE.md"), "utf8");
  const refs = R.invariantRefs(md);
  ok(refs["35"] && refs["4"] && refs["A"] && Object.keys(refs).length >= 40, "invariant headings are read from CLAUDE.md", `${Object.keys(refs).length}`);
  const all = (await call({ action: "update", id: "seed-brag-video", text: "The brag launch video for watchfor.tools." })).body.ideas;
  const idea = all.find((r) => r.id === "seed-social-discussion");
  const prompt = R.buildPrompt(idea, all.filter((r) => r.id !== idea.id), md);
  ok(prompt.includes(md.slice(0, 2000)), "the prompt carries CLAUDE.md");
  ok(/The universal feed already does this/.test(prompt), "and every dropped idea with its reason");
  ok(/Check what already exists before anything else/.test(prompt) && /Do not reach|honest objections/i.test(prompt + R.buildPrompt.toString()), "and asks for coverage first and honest objections");
  const v = R.validateReview({
    summary: "Not worth it — yet.", verdict: "maybe", size: "a week",
    invariants: [{ ref: "35", how: "a rendered claim", conflict: true }, { ref: "99", how: "invented" }],
    duplicates: [{ id: "seed-retail-insider", why: "same" }, { id: "nope", why: "invented" }],
    requires: ["a route"], objections: ["Hacker News terms"], covered: [], dependsOn: ["an API key"],
  }, { refs, ids: all.map((r) => r.id) });
  ok(v.invariants.length === 1 && v.invariants[0].name === refs["35"] && v.invariants[0].conflict, "a real invariant is kept, with its name");
  ok(v.duplicates.length === 1, "an invented backlog id is dropped");
  ok(v.verdict === "doubtful" && v.size === "", "an unknown verdict reads as doubtful, an unknown size as none");
  ok(v.dropped.length === 4, "and every drop is stated", v.dropped.join(" | "));
  ok(!/—/.test(v.summary), "the em dash is scrubbed");
}

console.log("\nhandoff and commit:");
{
  const idea = {
    id: "x", text: "Add a thing.\nMore detail.", surface: "Admin", size: "an afternoon", status: "approved",
    reviews: [{ verdict: "doubtful", summary: "s", requires: ["One", "Two"], invariants: [{ ref: "7", name: "Admin routes", how: "re-check", conflict: false }], objections: ["It is small."], dependsOn: [], covered: [] }],
    overrode: { at: "2026-10-16T00:00:00Z", reason: "Worth it anyway." },
  };
  const p = I.handoffPrompt(idea);
  ok(/^Add a thing\./.test(p) && /CHANGES\n1\. One\n2\. Two/.test(p), "numbered changes");
  ok(/INVARIANTS THAT APPLY\n- 7 \(Admin routes\)/.test(p), "the invariants that apply");
  ok(/Approved over the review on 2026-10-16: Worth it anyway\./.test(p), "the override, with its reason");
  ok(/npm run build/.test(p) && /git rev-parse HEAD origin\/main/.test(p) && /commit hash/.test(p), "the build, commit, push, verify ending");
  ok(/has not been reviewed/.test(I.handoffPrompt({ text: "Plain idea here" })), "and says so when there is no review");
  const badHash = await call({ action: "commit", id: "seed-retail-insider", hash: "not-a-hash" });
  ok(badHash.status === 400, "a non-hash is refused");
  const shipped = (await call({ action: "commit", id: "seed-retail-insider", hash: "67f2a7e" })).body.ideas.find((r) => r.id === "seed-retail-insider");
  ok(shipped.status === "shipped" && shipped.commits.includes("67f2a7e"), "recording a commit marks it shipped");
  ok((await call({ action: "commit", id: "seed-retail-insider", hash: "67f2a7e04bf6" })).status === 400, "the same commit twice is refused");
}

console.log("\nthe editor's ruling on a review:");
{
  const store = await load("lib/store.js");
  const S = await load("lib/ideaStore.js");
  const seed = I.SEEDS.find((x) => x.editorRecord);
  ok(Boolean(seed), "a seed carries a ruling", seed?.id);
  /* Stored, with an old review and an old note, as production holds it. */
  const all = (await store.read(S.KEY, {})) || {};
  all[seed.id] = { ...seed, editorRecord: undefined, stateNote: "old note", reviews: [{ at: "2026-10-17", verdict: "against", objections: ["Monetized influence"] }], log: [], commits: [] };
  await store.write(S.KEY, all);
  const row = (await S.getIdeas()).find((x) => x.id === seed.id);
  ok(row.editorRecord?.struck?.length > 0 && row.stateNote === seed.stateNote && row.reviews.length === 1, "it reaches the stored row, beside the review it rules on");
  ok(/THE EDITOR'S RULING ON EARLIER REVIEWS/.test(R.buildPrompt(row, [], "## x")) && R.buildPrompt(row, [], "## x").includes(seed.editorRecord.objections[0]), "the next review is told what was struck and starts from the real objections");
  const h = I.handoffPrompt(row);
  ok(/Struck: Monetized influence/.test(h) && /Real objection: Name collision/.test(h), "and the hand-off prompt says the same");
}

console.log(bad ? `\n${bad} failed` : "\nall passed");
process.exit(bad ? 1 : 0);
