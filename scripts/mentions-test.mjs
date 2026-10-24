#!/usr/bin/env node
/*
 * Mentions (lib/mentions.js): domain matching, the one line, collection,
 * removal reasons. node scripts/mentions-test.mjs. No server, no keys.
 *
 *   node scripts/follow-test.mjs
 *
 * No server and no keys. lib/ and the route handlers are loaded directly with
 * an import hook that resolves `@/` and extensionless paths, against the
 * in-memory store (no UPSTASH variables are set here). The network is stubbed:
 * feeds come from fixtures and Resend from a fetch that records what it was
 * given, so the assertions are about the emails that would have gone out.
 */
import { register } from "node:module";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const k of Object.keys(process.env)) if (/^(UPSTASH|KV)_/.test(k)) delete process.env[k];
process.env.AUTH_SECRET = "mentions-secret";
process.env.RESEND_API_KEY = "re_test";
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
const L = (p) => import(pathToFileURL(join(root, p)).href);
const M = await L("lib/mentions.js");
const { TOOLS } = await L("lib/tools.js");
const { NEWSLETTERS } = await L("lib/newsletters.js");
const { EVENTS } = await L("lib/events.js");
const { allOwners } = await L("lib/ownerIndex.js");
const { read, KEYS } = await L("lib/store.js");
const fs = await import("node:fs");
const src = (p) => fs.readFileSync(join(root, p), "utf8");
let failed = 0;
const ok = (c, w, x = "") => { console.log(`  ${c ? "ok  " : "FAIL"}  ${w}${x ? `  ${x}` : ""}`); if (!c) failed++; };

console.log("what can be mentioned:");
const targets = M.targetsOf({ tools: TOOLS, newsletters: NEWSLETTERS, events: EVENTS, owners: allOwners({ tools: TOOLS, newsletters: NEWSLETTERS, events: EVENTS }) });
ok(targets.length > 60 && ["tool", "newsletter", "event", "owner"].every((k) => targets.some((t) => t.kind === k)), "every kind, by its own domain", `${targets.length} targets, ${M.searchTermsOf(targets).length} domains`);
ok(!targets.some((t) => ["shopify.com", "linkedin.com", "luma.com"].includes(t.domain)), "never a platform that is not one listing's own");
ok(targets.find((t) => t.id === "elevate").needle === "marmeto.com/elevate" && targets.find((t) => t.id === "sasi").needle === "sasi.heymantle.com", "a shared domain is matched by path, a subdomain by its host");

console.log("\nmatching:");
const m = (t) => M.matchTarget(t, targets)?.id;
ok(m("try https://storeleads.app/reports for that") === "storeleads", "a domain in the text names its listing");
ok(m("see www.storeleads.app") === "storeleads", "with www");
ok(!m("Store Leads is great") && !m("a store leads to more sales"), "a name alone never matches");
ok(!m("notstoreleads.app") && !m("storeleads.apps.example"), "on a boundary only");
ok(m("marmeto.com/elevate is free") === "elevate" && m("marmeto.com/orbit") === "orbit" && m("marmeto.com") === "marmeto", "the longest match wins on a shared domain");
ok(m("sasi.heymantle.com") === "sasi" && m("heymantle.com/pricing") === "mantle", "a subdomain goes to its own listing");

console.log("\nthe one line:");
const item = { source: "shopify-community", author: "sam", title: "Best way to find stores using an app?", listing: { name: "Store Leads" } };
const line = M.lineOf(item);
ok(line === "sam linked Store Leads in a Shopify Community thread.", "the fallback line says who linked what, and where", line);
ok(M.lineOf({ source: "bluesky", listing: { name: "Applora" } }) === "A Bluesky post links Applora.", "a post with no heading gets no words from its body");

console.log("\ncollection:");
const body = "I compared them. SECRET POST BODY. Link: https://www.appstorepulse.com/reports and also Meridian and Orbit.";
const sources = {
  hackernews: async (term) => term === "appstorepulse.com" ? [{ url: "https://news.ycombinator.com/item?id=1", at: "2026-10-20", author: "a", kind: "comment", title: "Show HN: App store data", text: body }] : [],
  reddit: async (term) => term === "the-meridian.ai" ? [{ url: "https://reddit.com/r/x/1", at: "2026-10-20", author: "b", title: "Meridian of Greenwich", text: "Meridian lines" }] : [],
};
let r = await M.collectMentions({ targets, sources, today: "2026-10-24", budgetMs: 60_000 });
let st = await M.getMentions();
const items = Object.values(st.items);
ok(items.length === 1 && items[0].listing.id === "appstorepulse", "a domain mention is kept, a name-only one is not", `${items.length}`);
ok(!JSON.stringify(st).includes("SECRET POST BODY"), "the post's text is never stored");
ok(items[0].status === "new" && items[0].line.includes("AppstorePulse"), "new, for the Inbox, with its one line");
r = await M.collectMentions({ targets, sources, today: "2026-10-24", budgetMs: 60_000 });
ok(r.due === 0, "a domain searched this week is not searched again");
r = await M.collectMentions({ targets, sources, today: "2026-11-02", budgetMs: 60_000 });
ok(Object.values((await M.getMentions()).items).length === 1, "and the same link is never added twice");

console.log("\nremoval:");
const id = items[0].id;
ok((await M.decideMention(id, { action: "remove", reason: "disagree" }, "a@x")).error, "disagreeing is not a reason");
await M.decideMention(id, { action: "remove", reason: "wrong-listing" }, "admin@example.com");
st = await M.getMentions();
ok(st.items[id].status === "removed" && st.items[id].reason === "wrong-listing" && st.items[id].decidedBy, "a removal keeps the row, the reason and who");
ok(M.mentionList(st).length === 0 && M.mentionList(st, { includeRemoved: true }).length === 1, "it leaves the list and stays on record");
ok(Object.keys(M.REMOVAL_REASONS).sort().join() === "private,spam,wrong-listing", "three reasons: wrong listing, spam, private data");
ok(!("status" in M.publicMention(st.items[id])) && !("decidedBy" in M.publicMention(st.items[id])), "the public shape carries no moderation fields");
ok(/"\/api\/cron\/mentions"/.test(src("vercel.json")), "collected by a daily cron, each domain weekly");

console.log("\nwhose words:");
ok(M.isOwnAccount("retailinsider.bsky.social", { domain: "retail-insider.com", name: "Retail Insider" }) && M.isOwnAccount("storeinspect.bsky.social", { domain: "storeinspect.com", name: "StoreInspect" }), "the listing's own account is marked as the vendor's");
ok(!M.isOwnAccount("andreslucero.com", { domain: "builtwith.com", name: "BuiltWith" }), "and somebody else's is not");
ok(M.hasAffiliateLink("https://winninghunter.com/?via=firstsalesociety", "winninghunter.com") && M.hasAffiliateLink("https://partnerstack.com/go/clickup", "partnerstack.com") && !M.hasAffiliateLink("see builtwith.com for that", "builtwith.com"), "a referral link is marked as one");
ok(M.isOwnAccount("someone", { domain: "storeinspect.com", name: "StoreInspect" }, "storeinspect/cli"), "a repository under the vendor's own name is the vendor's");
ok(!M.isThirdParty({ affiliate: true }) && M.isThirdParty({}), "other people's words are the rest");
{
  const { write } = await L("lib/store.js");
  await write(KEYS.mentions, { items: { old1: { id: "old1", own: true, status: "new" } } });
  const self = { bluesky: async (term) => term === "retail-insider.com" ? [
    { url: "https://bsky.app/p/self", at: "2026-11-12", author: "retailinsider.bsky.social", text: "Our story https://retail-insider.com/a" },
    { url: "https://bsky.app/p/other", at: "2026-11-12", author: "someone.bsky.social", text: "Worth reading https://retail-insider.com/a" },
  ] : [] };
  await M.collectMentions({ targets, sources: self, today: "2026-11-20", budgetMs: 60_000 });
  const st = await M.getMentions();
  const authors = Object.values(st.items).map((x) => x.author);
  ok(!authors.includes("retailinsider.bsky.social") && authors.includes("someone.bsky.social"), "the listing's own account is not collected, somebody else posting the same link is");
  ok(!st.items.old1, "and own-account items stored before this are cleared");
}

ok(!("reddit" in M.SOURCES) && ["hackernews", "bluesky", "shopify-community", "shopify-dev-community", "github"].every((k) => k in M.SOURCES), "the sources in use, Reddit left out");
{
  const spam = { bluesky: async (term) => term === "partnerstack.com" ? [1, 2, 3].map((i) => ({ url: `https://bsky.app/p/${i}`, at: "2026-10-30", author: "bot.bsky.social", text: `filler ${i} https://partnerstack.com` })) : [] };
  await M.collectMentions({ targets, sources: spam, today: "2026-11-10", budgetMs: 60_000 });
  const rows = Object.values((await M.getMentions()).items).filter((x) => x.author === "bot.bsky.social");
  ok(rows.length === 3 && rows.every((x) => x.repeat && !M.isThirdParty(x)), "one account linking one listing three times is marked, not counted as other people");
}

console.log("\nfrom production: blocked is not empty");
{
  const { write } = await L("lib/store.js");
  await write(KEYS.mentions, {});
  const small = targets.filter((t) => ["storeleads.app", "appstorepulse.com"].includes(t.domain));
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes("api.bsky.app")) return new Response("Forbidden", { status: 403 });
    if (u.includes("api.github.com")) return new Response("<html><title>Just a moment...</title></html>", { status: 200, headers: { "content-type": "text/html" } });
    if (u.includes("community.shopify.dev")) return new Response(JSON.stringify({ posts: [], topics: [] }), { status: 200 });
    if (u.includes("community.shopify.com")) {
      const posts = u.includes("shopify%20after") ? [{ topic_id: 1, post_number: 1, created_at: "2026-11-01", username: "x", blurb: "about shopify" }] : [];
      return new Response(JSON.stringify({ posts, topics: [{ id: 1, title: "t" }] }), { status: 200 });
    }
    if (u.includes("hn.algolia.com")) throw Object.assign(new Error("timed out"), { name: "TimeoutError" });
    return realFetch(url);
  };
  const r = await M.collectMentions({ targets: small, today: "2026-11-10", budgetMs: 60_000 });
  globalThis.fetch = realFetch;
  const st = await M.getMentions();
  ok(st.sources.bluesky.state === "blocked" && /403/.test(st.sources.bluesky.last), "a 403 is recorded as blocked, with the status", st.sources.bluesky.last);
  ok(st.sources.github.state === "blocked" && /instead of JSON/.test(st.sources.github.last), "a page where JSON was expected is a challenge, so blocked");
  ok(st.sources.hackernews.state === "error", "a timeout is failing, not empty");
  ok(st.sources["shopify-dev-community"].state === "empty", "an answer with nothing for a query that always has results is suspicious, not a quiet week");
  ok(st.sources["shopify-community"].state === "ok", "and a working source is answering");
  ok(!Object.keys(st.checked).some((k) => /^(bluesky|github|hackernews)\|/.test(k)), "nothing blocked or failed is marked as searched, so it is tried again");
  ok(M.unreadableSources(st).map((x) => x.source).sort().join() === "bluesky,github,hackernews,shopify-dev-community", "the sources that cannot be read are listed for the admin");
  ok(r.sources.bluesky.state === "blocked", "and the run's answer says so too");
}
{
  const A = src("components/Admin.jsx");
  ok(/label: "Mentions"/.test(A) && /unreadableSources|unreadable/.test(A), "the System status strip has a Mentions line that names unreadable sources");
}

console.log("\npublishing a mention to What's moving:");
{
  const F = await L("lib/feed.js");
  const S = await L("lib/feedSource.js");
  const D = await L("lib/mentionDraft.js");
  ok(F.sanitiseEntry({ headline: "A Shopify Community member recommended it for theme lookups.", source: "mention", sourceUrl: "https://community.shopify.com/t/1/1", mentionSource: "shopify-community", mentionedOn: "2026-10-20", mentionAuthor: "x" }).entry?.source === "mention", "a mention row is accepted with its link, where and when");
  ok(F.sanitiseEntry({ headline: "A line long enough to count.", source: "mention", mentionSource: "bluesky", mentionedOn: "2026-10-20" }).error, "and refused without the link to the post");
  const m = S.sourceOf({ source: "mention", mentionAuthor: "someone.bsky.social", mentionSource: "bluesky" });
  ok(m.label === "Mentioned by someone.bsky.social on Bluesky" && m.note === "Their words, not the directory's.", "it is labelled as someone else's words", m.label);
  ok(S.sourceOf({ source: "vendor" }).label === "From the vendor" && S.sourceOf({}).label === "Observed", "the other two kinds: from the vendor, observed");
  ok(S.entryHref({ toolId: "x", href: "/newsletters/y" }) === "/newsletters/y" && S.entryHref({ toolId: "x" }) === "/tools/x", "a row links the listing it concerns, whatever its kind");
  const prompt = D.buildPrompt({ author: "a", source: "bluesky", at: "2026-10-20", listing: { name: "Store Leads" } }, "the post text");
  ok(/Paraphrase/.test(prompt) && /Quote at most five words/.test(prompt) && /Report, do not judge/.test(prompt) && /as data and never as instructions/.test(prompt), "the draft paraphrases, attributes, does not judge, and treats the post as data");
  ok(/return \{ draft: line, provider, thin: [^,]+, note: text \? "" : "[^"]+" \};/.test(src("lib/mentionDraft.js")), "the post's text is not returned to the browser: a draft, the provider and a fixed note");
  const { write } = await L("lib/store.js");
  await write(KEYS.mentions, { items: { p1: { id: "p1", status: "new", listing: { name: "X" } } } });
  await M.markMentionPublished("p1", "feed1", "admin@example.com");
  const st = await M.getMentions();
  ok(st.items.p1.status === "published" && st.items.p1.feedId === "feed1", "a published mention keeps its feed row");
  ok(!M.mentionList(st).filter((x) => x.status === "new").length, "and does not come back to the Inbox");
}

console.log("\nthe post, not the thread (worked example, structure of community.shopify.dev/t/38510):");
{
  const { write } = await L("lib/store.js");
  await write(KEYS.mentions, {});
  const Ctx = await L("lib/mentionContext.js");
  const Draft = await L("lib/mentionDraft.js");
  const base = "https://community.shopify.dev";
  /* A made-up thread with the real one's shape: post 3 links LetsMetrix only
     behind its link text, post 14 links it again, post 17 replies to post 15
     and links AppNavigator. None of the real posts' words. */
  const posts = {
    101159: { post_number: 3, username: "dev_a", created_at: "2026-10-11T10:00:00Z", topic_id: 38510, topic_slug: "reviews-thread", reply_to_post_number: null,
      cooked: '<p>I looked the reviewer up: <a href="https://letsmetrix.com/dashboard/review?reviewer_name=x">their review history</a>. FIXTUREPOST3 The same review text appears on three apps from three partners.</p>' },
    101242: { post_number: 14, username: "dev_b", created_at: "2026-10-12T09:00:00Z", topic_id: 38510, topic_slug: "reviews-thread", reply_to_post_number: 13, reply_to_user: { username: "dev_a" },
      cooked: '<p>That site is useful: <a href="https://letsmetrix.com/dashboard/review?reviewer_name=y">https://letsmetrix.com/dashboard/review?reviewer_name=y</a></p>' },
    101250: { post_number: 15, username: "dev_b", created_at: "2026-10-12T10:00:00Z", topic_id: 38510, topic_slug: "reviews-thread", reply_to_post_number: 13,
      cooked: "<p>FIXTUREPOST15 There is a deleted-reviews view too.</p>" },
    101257: { post_number: 17, username: "dev_a", created_at: "2026-10-12T12:46:56Z", topic_id: 38510, topic_slug: "reviews-thread", reply_to_post_number: 15, reply_to_user: { username: "dev_b" },
      cooked: '<p>FIXTUREPOST17 Also <a href="https://appnavigator.io/">https://appnavigator.io/</a> is lighter, fine for simple checks.</p>' },
  };
  const byNumber = Object.fromEntries(Object.values(posts).map((p) => [p.post_number, p]));
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    const json = (o) => new Response(JSON.stringify(o), { status: 200 });
    if (u.startsWith(`${base}/search.json`)) {
      const term = decodeURIComponent(u).includes("letsmetrix.com") ? [101159, 101242] : decodeURIComponent(u).includes("appnavigator.io") ? [101257] : decodeURIComponent(u).includes("shopify after") ? [101250] : [];
      return json({ posts: term.map((id) => ({ id, topic_id: 38510, post_number: posts[id].post_number, username: posts[id].username, created_at: posts[id].created_at, blurb: "an excerpt with no link" })), topics: [{ id: 38510, title: "Sophisticated 1-Star Review Mercenaries for Hire" }] });
    }
    const m1 = u.match(/\/posts\/(\d+)\.json/); if (m1) return json(posts[m1[1]]);
    const m2 = u.match(/\/posts\/by_number\/38510\/(\d+)\.json/); if (m2) return json(byNumber[m2[1]]);
    return new Response("[]", { status: 200 });
  };
  const two = targets.filter((t) => ["letsmetrix.com", "appnavigator.io"].includes(t.domain));
  const seen = [];
  await M.collectMentions({ targets: two, sources: { "shopify-dev-community": M.SOURCES["shopify-dev-community"] }, today: "2026-10-24", firstSince: "2026-10-01", budgetMs: 60_000, summarise: async (m) => { seen.push(m); return { summary: `summary of post ${m.post?.number}` }; } });
  const items = Object.values((await M.getMentions()).items);
  const lm = items.find((x) => x.listing.id === "letsmetrix"), an = items.find((x) => x.listing.id === "appnavigator");
  ok(items.length === 2 && lm && an, "two mentions, one per tool, not one per thread", `${items.length}`);
  ok(/\/38510\/3$/.test(lm.url) && lm.post.number === 3 && lm.author === "dev_a", "LetsMetrix is anchored to post 3, found from a link inside link text", lm.url);
  ok((lm.alsoIn || []).some((x) => x.number === 14), "post 14 linking it again is recorded on that mention, not as a second one");
  ok(/\/38510\/17$/.test(an.url) && an.replyTo?.author === "dev_b" && an.replyTo.number === 15, "AppNavigator is anchored to post 17, in reply to post 15");
  ok(M.contextLine(an) === "Post 17 by dev_a, in reply to dev_b, in a thread about “Sophisticated 1-Star Review Mercenaries for Hire”", "the admin row reads: in reply to X, in a thread about Y", M.contextLine(an));
  ok(lm.summary === "summary of post 3" && an.summary === "summary of post 17", "each summary is written per post");
  ok(!JSON.stringify(await M.getMentions()).includes("FIXTUREPOST"), "and no post text is stored");
  const ctx = await Ctx.postContext(an);
  const prompt = Draft.summaryPrompt(an, ctx);
  ok(/FIXTUREPOST17/.test(prompt) && /FIXTUREPOST15/.test(prompt) && /THE POST IT REPLIES TO, by dev_b/.test(prompt), "the summary is written from the post and the one it answers, not the title");
  ok(/Your own words/.test(prompt) && /Quote at most five words/.test(prompt), "in our own words, never the post's");
  globalThis.fetch = realFetch;

  const id = an.id;
  await M.decideMention(id, { action: "dismiss" }, "admin@example.com");
  let st = await M.getMentions();
  ok(st.items[id].status === "dismissed" && M.mentionList(st).some((x) => x.id === id), "Dismiss keeps the record and needs no reason");
  ok(!M.mentionList(st).filter((x) => x.status === "new").some((x) => x.id === id), "and clears it from the Inbox");
  await M.decideMention(lm.id, { action: "vendor" }, "admin@example.com");
  st = await M.getMentions();
  ok(st.items[lm.id].vendor && !M.isThirdParty(st.items[lm.id]), "marked from the vendor by hand: kept, visible, never counted as other people");
  ok((await M.decideMention(lm.id, { action: "interest" }, "a")).error, "has an interest needs a note");
  await M.decideMention(lm.id, { action: "interest", reason: "runs a review-analysis platform" }, "admin@example.com");
  st = await M.getMentions();
  ok(st.items[lm.id].interest?.note === "runs a review-analysis platform" && !M.isThirdParty(st.items[lm.id]), "has an interest is recorded with its note, and not counted as neutral");
  const route = src("app/api/admin/route.js");
  ok(/if \(m\.vendor\) return new Response\("Marked as from the vendor/.test(route), "a mention marked from the vendor cannot be published");
  const A = src("components/Admin.jsx");
  ok(/Remove…/.test(A) && /Why remove it\?/.test(A) && !/Remove: \{label\}/.test(A), "the three removal reasons sit behind one Remove control");
}

console.log("\nrelevance: general brands only, judged by the model, kept when filtered:");
{
  const { write } = await L("lib/store.js");
  await write(KEYS.mentions, {});
  const g = (d) => targets.find((t) => t.domain === d);
  ok(g("partnerstack.com")?.general && g("builtwith.com")?.general && !g("appnavigator.io")?.general && !g("storeleads.app")?.general, "general: tools marked shopifyExclusive false; Shopify-only tools are not");
  ok(g("retail-insider.com")?.general && targets.filter((t) => t.kind === "owner").every((t) => t.general), "a newsletter that is not Shopify-specific is general, and so is every owner");
  const rows = {
    bluesky: async (term) => term === "builtwith.com" ? [
      { url: "https://bsky.app/p/w", at: "2026-11-02", author: "webdev", text: "builtwith.com says this site runs WordPress" },
      { url: "https://bsky.app/p/s", at: "2026-11-02", author: "appdev", text: "Using builtwith.com to find Shopify stores for my app" },
    ] : term === "appnavigator.io" ? [{ url: "https://bsky.app/p/a", at: "2026-11-02", author: "x", text: "appnavigator.io is neat" }] : [],
    "shopify-community": async (term) => term === "partnerstack.com" ? [{ url: "https://community.shopify.com/t/1/2", at: "2026-11-02", author: "y", text: "we moved our affiliates to partnerstack.com" }] : [],
  };
  const judged = [];
  const judge = async (m) => { judged.push(m.url); return /shopify/i.test(m.url.includes("/p/s") ? "shopify" : "") ? { relevant: true, reason: "Names Shopify stores and an app." } : { relevant: false, reason: "About WordPress detection, nothing about Shopify." }; };
  const r = await M.collectMentions({ targets, sources: rows, today: "2026-11-10", firstSince: "2026-11-01", budgetMs: 60_000, judge });
  const st = await M.getMentions();
  const by = (u) => Object.values(st.items).find((x) => x.url === u);
  ok(judged.sort().join() === "https://bsky.app/p/s,https://bsky.app/p/w", "only a general brand outside the Shopify forums is judged");
  ok(by("https://bsky.app/p/w").status === "filtered" && /WordPress/.test(by("https://bsky.app/p/w").relevance.reason), "an irrelevant one is kept as filtered, with the model's reason");
  ok(by("https://bsky.app/p/s").status === "new" && by("https://bsky.app/p/s").relevance.by === "model", "a relevant one reaches the Inbox, with the reason it passed");
  ok(by("https://community.shopify.com/t/1/2").status === "new" && by("https://community.shopify.com/t/1/2").relevance.by === "source", "a general brand in the Shopify Community passes by where it was posted");
  ok(by("https://bsky.app/p/a").status === "new" && by("https://bsky.app/p/a").relevance.by === "listing", "a Shopify-only listing skips the test");
  ok(r.found === 4 && r.passed === 3 && r.filtered === 1 && r.byListing.BuiltWith.in === 2 && r.byListing.BuiltWith.passed === 1, "the run reports what came in, what passed, and the split by listing");
  await M.decideMention(by("https://bsky.app/p/w").id, { action: "keep" }, "admin@example.com");
  const kept = Object.values((await M.getMentions()).items).find((x) => x.url === "https://bsky.app/p/w");
  ok(kept.status === "new" && kept.relevance.by === "editor" && /WordPress/.test(kept.relevance.overruled), "Keep it overrules the filter, and the overruled reason is kept");
  await write(KEYS.mentions, {});
  await M.collectMentions({ targets, sources: rows, today: "2026-11-10", firstSince: "2026-11-01", budgetMs: 60_000 });
  const noModel = Object.values((await M.getMentions()).items).filter((x) => x.listing.general && x.source === "bluesky");
  ok(noModel.length === 2 && noModel.every((x) => x.status === "filtered" && x.relevance.by === "pending"), "with no model, a general brand's mention waits as not judged yet, out of the Inbox, never passed by keyword");
  const D = await L("lib/mentionDraft.js");
  const jp = D.judgePrompt({ listing: { name: "BuiltWith" }, author: "a", source: "bluesky" }, { text: "x", reply: null }, ["Store Leads"]);
  ok(/Shopify is named/.test(jp) && /another of these listed tools is mentioned: Store Leads/.test(jp) && /"reason"/.test(jp), "the judge looks for Shopify, an app-vendor topic, another listed tool or an ecosystem handle, and gives a reason");
  ok(/Filtered as not Shopify-relevant/.test(src("components/Admin.jsx")), "filtered mentions are shown in their own collapsed group");
}

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
