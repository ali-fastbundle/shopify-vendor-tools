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
const item = { source: "reddit", where: "r/shopify", title: "Best way to find stores using an app?", listing: { name: "Store Leads" } };
const line = M.lineOf(item);
ok(/Reddit post in r\/shopify/.test(line) && /links Store Leads/.test(line), "says where it is and what it links", line);
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

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
