#!/usr/bin/env node
/*
 * What's moving: editing a published entry, and a vendor's message read
 * before it is written up (2026-11-04).
 *
 *   node scripts/vendor-news-test.mjs
 *
 * No server and no keys. lib/ is shimmed into a temp directory as in
 * coverage-test, the admin and announce routes are called with a plain
 * Request, and lib/model.js is replaced by a stub that answers what each test
 * scripts, so the model's side is exactly what the code has to cope with.
 *
 * The SAMI case is the fixture: Justas's email named Category Comparisons as
 * live and Keyword Explorer as in development. Those are different claims and
 * must stay different all the way to the feed and the listing.
 */

import { readFileSync, writeFileSync, mkdtempSync, readdirSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { pathToFileURL } from "url";
import { createHmac } from "crypto";

const ROOT = new URL("..", import.meta.url).pathname;
const SECRET = "vendor-news-test-secret";
process.env.AUTH_SECRET = SECRET;
process.env.ADMIN_EMAILS = "admin@test.invalid";

const dir = mkdtempSync(join(tmpdir(), "svt-vendornews-"));
mkdirSync(join(dir, "lib"));
const fix = (src) => src
  .replace(/(from\s+"\.\/[a-zA-Z]+)"/g, '$1.js"')
  .replace(/from\s+"@\/lib\/([a-zA-Z]+)"/g, 'from "./lib/$1.js"')
  .replace(/import\("@\/lib\/([a-zA-Z]+)"\)/g, 'import("./lib/$1.js")');
for (const f of readdirSync(join(ROOT, "lib"))) {
  if (!f.endsWith(".js")) continue;
  writeFileSync(join(dir, "lib", f), fix(readFileSync(join(ROOT, "lib", f), "utf8")));
}
/* The model, scripted: each call takes the next answer off the queue. */
writeFileSync(join(dir, "lib", "model.js"), `
export const answers = [];
export const prompts = [];
export const configured = () => true;
export async function askJson({ prompt }) {
  prompts.push(prompt);
  const next = answers.shift();
  if (!next) throw new Error("no scripted answer");
  return { data: next, provider: "stub" };
}
export async function askModel() { throw new Error("not scripted"); }
`);
writeFileSync(join(dir, "admin.js"), fix(readFileSync(join(ROOT, "app/api/admin/route.js"), "utf8")));
writeFileSync(join(dir, "announce.js"), fix(readFileSync(join(ROOT, "app/api/admin/announce/route.js"), "utf8")));
writeFileSync(join(dir, "rewrite.js"), fix(readFileSync(join(ROOT, "app/api/admin/rewrite/route.js"), "utf8")));
writeFileSync(join(dir, "package.json"), JSON.stringify({ type: "module" }));

const load = (f) => import(pathToFileURL(join(dir, f)).href);
const feed = await load("lib/feed.js");
const src = await load("lib/feedSource.js");
const V = await load("lib/vendorNews.js");
const model = await load("lib/model.js");
const { POST: ADMIN } = await load("admin.js");
const { POST: ANNOUNCE } = await load("announce.js");
const { POST: REWRITE } = await load("rewrite.js");

let bad = 0;
const ok = (c, l, d = "") => {
  console.log(`  ${c ? "ok  " : "FAIL"}  ${l}${d ? `  ${d}` : ""}`);
  if (!c) bad += 1;
};

const b64 = (s) => Buffer.from(s).toString("base64url");
const body = b64(JSON.stringify({ t: "session", email: "admin@test.invalid", exp: Date.now() + 864e5 }));
const COOKIE = `svt_session=${body}.${createHmac("sha256", SECRET).update(body).digest("base64url")}`;
const req = (url, payload, cookie = COOKIE) => new Request(`http://localhost${url}`, {
  method: "POST", headers: { ...(cookie ? { cookie } : {}), "content-type": "application/json" }, body: JSON.stringify(payload),
});
const admin = (p) => ADMIN(req("/api/admin", p));
const announce = (p) => ANNOUNCE(req("/api/admin/announce", p));

const EMAIL = `Hi Ali,

Quick update from SAMI. Category Comparisons is now live for every account: you can set two App Store categories side by side on pricing, ratings and Built for Shopify share.

We are also working on Keyword Explorer, which is in development and should be out early next year.

Our Standard plan is $8 a month.

Best, Justas`;

const READING = {
  items: [
    { name: "Category Comparisons", what: "sets two App Store categories side by side", status: "live",
      quote: "Category Comparisons is now live for every account" },
    { name: "Keyword Explorer", what: "keyword research", status: "announced",
      quote: "We are also working on Keyword Explorer, which is in development and should be out early next year." },
    /* A model calling something live on a quote the email does not contain. */
    { name: "Slack alerts", what: "alerts in Slack", status: "live", quote: "Slack alerts shipped last week" },
  ],
  listingChanges: [
    { field: "note", what: "compares categories", quote: "you can set two App Store categories side by side" },
    { field: "price", what: "invented", quote: "Enterprise is $999 a month" },
  ],
  contradictions: [{ listing: "Not published", email: "Standard is $8 a month", quote: "Our Standard plan is $8 a month." }],
  kind: "new-capability",
  summary: "Category Comparisons is live; Keyword Explorer is in development.",
};

console.log("reading a message (pure):");
{
  const { extraction, dropped } = V.sanitiseExtraction(READING, EMAIL);
  const by = Object.fromEntries(extraction.items.map((i) => [i.name, i.status]));
  ok(by["Category Comparisons"] === "live", "a live item with its quote stays live");
  ok(by["Keyword Explorer"] === "announced", "an announced item stays announced");
  ok(by["Slack alerts"] === "unclear", "a live item whose quote is not in the email is demoted to unclear");
  ok(extraction.listingChanges.length === 1, "a listing change without a quote in the email is dropped");
  ok(extraction.contradictions.length === 1, "a contradiction with its quote is kept");
  ok(dropped.length === 2, "each drop is listed", dropped.join(" | "));

  ok(V.draftIssues("Added Category Comparisons, which sets two categories side by side.", extraction).length === 0,
    "a line about the live item passes");
  ok(V.draftIssues("Added Category Comparisons and Keyword Explorer.", extraction).length === 1,
    "a line calling Keyword Explorer shipped is refused");
  ok(V.draftIssues("Added Category Comparisons. Keyword Explorer is in development.", extraction).length === 0,
    "saying Keyword Explorer is in development passes");
  ok(V.draftIssues("Slack alerts now post to a channel.", extraction).length === 1,
    "an item the email did not state as live cannot be called shipped either");

  const change = V.changeFromNews({ id: "vn-x", toolId: "tracksami", extraction, sourceUrl: "https://www.tracksami.com" });
  ok(change.source === "vendor" && /Category Comparisons/.test(change.what) && !/Keyword Explorer/.test(change.what),
    "the rewrite is fed the live items only");
  ok(change.notLive.includes("Keyword Explorer"), "and told what is not released");
}

console.log("\nthe announce route reads first and drafts from the reading:");
let rec;
{
  ok((await ANNOUNCE(req("/api/admin/announce", { vendor: {} }, ""))).status === 404, "signed out, 404");
  ok((await announce({ vendor: { toolId: "tracksami", email: "too short", announcedOn: "2026-10-11" } })).status === 400,
    "a message under a sentence is refused before any model call");
  model.answers.push(READING, { announcement: "Added Category Comparisons, which sets two App Store categories side by side.", thin: false, note: "" });
  model.prompts.length = 0;
  const res = await announce({ vendor: { toolId: "tracksami", email: EMAIL, announcedOn: "2026-10-11", sourceUrl: "https://www.tracksami.com", sourceNote: "Email from Justas" } });
  ok(res.status === 200, "a real message is read", `HTTP ${res.status}`);
  const d = await res.json();
  rec = d.record;
  ok(rec?.id?.startsWith("vn-") && rec.status === "open", "a record is kept, open");
  ok(!JSON.stringify(rec).includes("Best, Justas"), "the message itself is not stored");
  ok(model.prompts.length === 2, "two model steps: read, then draft");
  ok(model.prompts[0].includes("Best, Justas"), "the read step sees the message");
  ok(!model.prompts[1].includes("Best, Justas") && !model.prompts[1].includes("early next year"),
    "the draft step never sees the message, only the reading");
  ok(/NOT RELEASED[\s\S]*Keyword Explorer/.test(model.prompts[1]), "and is told Keyword Explorer is not released");
  ok(d.draft && d.issues.length === 0, "the draft comes back with its check");

  /* A draft that breaks the rule is returned with the issue, not hidden. */
  model.answers.push({ announcement: "Added Category Comparisons and Keyword Explorer.", thin: false });
  const again = await (await announce({ newsId: rec.id })).json();
  ok(again.issues.length === 1, "a draft that calls an announced feature shipped is flagged");

  /* Nothing live: no draft call at all. */
  model.answers.push({ ...READING, items: [READING.items[1]] });
  const none = await (await announce({ vendor: { toolId: "tracksami", email: EMAIL, announcedOn: "2026-10-11" } })).json();
  ok(none.draft === "" && none.thin, "when nothing is live, nothing is drafted");
  ok(model.answers.length === 0, "and the draft step was not called");
}

console.log("\npublishing it, and its other outcomes:");
let entryId;
{
  ok((await admin({ action: "resolve-vendor-news", id: rec.id })).status === 400, "resolve is refused before any outcome");
  const bad1 = await admin({ action: "post-vendor-announcement", id: "tracksami", newsId: rec.id,
    headline: "Added Category Comparisons and Keyword Explorer for every account.", announcedOn: "2026-10-11" });
  ok(bad1.status === 400, "the server refuses a line calling Keyword Explorer shipped", await bad1.text());
  const good = await admin({ action: "post-vendor-announcement", id: "tracksami", newsId: rec.id,
    headline: "Added Category Comparisons, which sets two App Store categories side by side.", announcedOn: "2026-10-11",
    sourceUrl: "https://www.tracksami.com", sourceNote: "Email from Justas" });
  ok(good.status === 200, "a line about what is live publishes");
  const g = await good.json();
  entryId = g.feedEntry.id;
  ok(g.feedEntry.source === "vendor" && src.sourceOf(g.feedEntry).label === "From the vendor", "marked From the vendor, never Observed");
  ok(g.record.feedId === entryId, "the record knows its feed entry");
  ok((await admin({ action: "post-vendor-announcement", id: "tracksami", newsId: rec.id,
    headline: "Added Category Comparisons once more, to be sure.", announcedOn: "2026-10-11" })).status === 409,
    "the same message is not published twice");

  model.answers.push({ fields: { note: "A rewritten note that compares categories." }, summary: "worked it in", flag: "" });
  model.prompts.length = 0;
  const rw = await REWRITE(req("/api/admin/rewrite", { id: rec.id }));
  ok(rw.status === 200, "Update the listing proposes a rewrite from the message", `HTTP ${rw.status}`);
  ok(/WHAT THE VENDOR TOLD THE DIRECTORY/.test(model.prompts[0]) && /NOT RELEASED[^\n]*Keyword Explorer/.test(model.prompts[0]),
    "labelled as the vendor's claim, with Keyword Explorer kept out");
  const saved = await admin({ action: "apply-rewrite", id: rec.id, fields: { note: "A rewritten note that compares categories." } });
  ok(saved.status === 200 && (await saved.json()).rewritten[rec.id], "and saves through the same rewrite, log and undo");

  const resolved = await (await admin({ action: "resolve-vendor-news", id: rec.id })).json();
  ok(resolved.record.status === "done" && resolved.record.destinations.join() === "published,rewritten",
    "resolved once, recording both outcomes", resolved.record.destinations?.join());
  ok((await admin({ action: "undo-rewrite", id: rec.id })).status === 200, "the rewrite undoes");
}

console.log("\nediting a published entry:");
{
  const before = (await feed.getFeed()).find((r) => r.id === entryId);
  ok((await admin({ action: "edit-feed-entry", id: entryId, headline: "Has an em-dash — here, which is refused.", kind: "wording" })).status === 400,
    "an em-dash is refused");
  ok((await admin({ action: "edit-feed-entry", id: entryId, headline: before.headline, kind: "wording" })).status === 400,
    "an edit that changes nothing is refused");
  ok((await admin({ action: "edit-feed-entry", id: entryId, headline: "Added Category Comparisons for two categories.", kind: "correction", note: "short" })).status === 400,
    "a correction needs a sentence saying what changed");
  const w = await (await admin({ action: "edit-feed-entry", id: entryId, headline: "Added Category Comparisons: two App Store categories, side by side.", kind: "wording" })).json();
  ok(w.entry.date === before.date && w.entry.at === before.at, "the date and the place in the feed stay");
  ok(w.entry.editedOn && !w.entry.corrections, "a wording fix records editedOn");
  const c = await (await admin({ action: "edit-feed-entry", id: entryId,
    headline: "Added Category Comparisons: two App Store categories, side by side, on the Standard plan.",
    kind: "correction", note: "This did not say which plan has it. It is on Standard." })).json();
  ok(c.entry.corrections?.length === 1, "a correction is recorded");
  const pub = (await feed.feedEntries({ limit: 50 })).find((r) => r.id === entryId);
  const lines = src.revisionsOf(pub).map((v) => v.text);
  ok(lines.some((l) => /^Corrected \d+ [A-Z][a-z]+ \d{4}: This did not say which plan/.test(l)), "it reads as a dated correction", lines.join(" | "));
  ok(!lines.some((l) => /^Edited/.test(l)), "the earlier wording fix is not repeated after the correction");
  ok(!("edits" in pub) && !("publishedBy" in pub), "the edit history and who did it stay private");
  const priv = (await feed.getFeed()).find((r) => r.id === entryId);
  ok(priv.edits.length === 2 && priv.edits[0].before === before.headline, "every earlier text is kept");

  const changes = readFileSync(join(ROOT, "components/ChangesFeed.jsx"), "utf8");
  ok(/revisionsOf\(e\)/.test(changes) && /FeedEntryAdmin/.test(changes), "/changes shows corrections, and the controls to an admin");
  const page = readFileSync(join(ROOT, "app/changes/page.js"), "utf8");
  ok(/isAdmin\(session\.email\)/.test(page), "the page decides admin from the session, on the server");
  ok(/revisionsOf/.test(readFileSync(join(ROOT, "app/changes/rss/route.js"), "utf8"))
    && /revisionsOf/.test(readFileSync(join(ROOT, "lib/markdown.js"), "utf8")), "RSS and the Markdown version carry them too");
}

console.log("\ndeleting, softly and with a reason:");
{
  ok((await admin({ action: "delete-feed-entry", id: entryId })).status === 400, "a reason is required");
  ok((await admin({ action: "delete-feed-entry", id: entryId, reason: "Published twice by mistake" })).status === 200, "with one it goes");
  ok(!(await feed.feedEntries({ limit: 50 })).some((r) => r.id === entryId), "off the public feed");
  const row = (await feed.getFeed()).find((r) => r.id === entryId);
  ok(row.deleteReason === "Published twice by mistake" && row.deletedBy, "kept, with the reason and who");
  ok(!("deleteReason" in feed.publicRow(row)), "the reason is private");
  const r = await (await admin({ action: "restore-feed-entry", id: entryId })).json();
  ok(r.entry && !r.entry.deletedAt && (await feed.feedEntries({ limit: 50 })).some((x) => x.id === entryId), "Restore puts it back");

  /* A monitor row: deleting it stops it being its finding's destination. */
  const KEYS = (await load("lib/store.js")).KEYS;
  const { read, write } = await load("lib/store.js");
  const obs = await feed.addEntry({ headline: "Starter went from $49 to $79 a month." }, { tool: { id: "ranksy", name: "Ranksy", cat: "aso" }, changeId: "chg-1" });
  await write(KEYS.changesPublished, { "chg-1": { feedId: obs.id } });
  await admin({ action: "delete-feed-entry", id: obs.id, reason: "Wrong tier name" });
  ok(!(await read(KEYS.changesPublished, {}))["chg-1"], "a monitor row's finding no longer says it is published");
  await admin({ action: "restore-feed-entry", id: obs.id });
  ok((await read(KEYS.changesPublished, {}))["chg-1"]?.feedId === obs.id, "and says so again when it is restored");
}

console.log(bad ? `\n${bad} failed` : "\nall passed");
process.exit(bad ? 1 : 0);
