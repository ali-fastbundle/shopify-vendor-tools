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
process.env.AUTH_SECRET = "blog-calendar-secret";
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

/*
 * The blog calendar (CLAUDE.md, "The blog calendar"):
 *   node scripts/blog-calendar-test.mjs
 *  - a post publishes through the GitHub path's parsed edit: exactly the
 *    draft flag removed and the date set, refused for a post with no draft
 *  - every post has a file, and the file holds that slug
 *  - readiness: every published post passes; a broken one says why
 *  - ideas take a blog type and a target week (its Monday); the two blog
 *    seeds are shipped and name the posts they became
 *  - Search Console: queries fold, the three groups, and thin data is said
 *    and refused, never proposed from
 *  - nothing publishes by itself: only the publish-post action commits a post
 *  - the route answers 404 to anyone but an admin; the store keys are listed
 */
let failed = 0;
const ok = (c, what, extra = "") => { console.log(`  ${c ? "ok  " : "FAIL"}  ${what}${extra ? `  ${extra}` : ""}`); if (!c) failed++; };
const { readdirSync } = await import("node:fs");
const src = (f) => readFileSync(join(root, f), "utf8");

const { ALL_POSTS, POSTS, POST_FILES, postReadiness } = await L("lib/blog.js");
const { publishPostInSource } = await L("lib/publish.js");

console.log("publishing a post:");
for (const p of ALL_POSTS) {
  const file = POST_FILES[p.slug];
  ok(Boolean(file) && src(file).includes(`slug: "${p.slug}"`), `${p.slug}: mapped to a file that holds it`, file || "no row");
  const raw = src(file);
  const drafted = raw.replace(/\n  date: "([^"]+)",/, '\n  date: "$1",\n  draft: true,');
  const r = publishPostInSource(drafted, p.slug, "2027-01-04");
  ok(!r.error && r.source.includes('date: "2027-01-04"') && !/draft: true/.test(r.source)
    && r.source.split("\n").length === drafted.split("\n").length - 1, `${p.slug}: publish removes the flag and dates it, nothing else`, r.error);
  ok(Boolean(publishPostInSource(raw, p.slug, "2027-01-04").error), `${p.slug}: refused when it is not a draft`);
  ok(Boolean(publishPostInSource(drafted, "not-this-post", "2027-01-04").error), `${p.slug}: refused for the wrong slug`);
}
const files = readdirSync(join(root, "lib/posts")).map((f) => `lib/posts/${f}`);
ok(files.every((f) => Object.values(POST_FILES).includes(f)), "every file in lib/posts has a row in POST_FILES");

console.log("\nreadiness:");
ok(POSTS.every((p) => postReadiness(p).length === 0), "every published post is ready", POSTS.filter((p) => postReadiness(p).length).map((p) => p.slug).join(", "));
const bad = postReadiness({ slug: "x", title: "", description: "short", body: [{ p: "a [b](tool:nope) — c" }] });
ok(bad.length >= 4 && bad.some((x) => /tool:nope/.test(x)) && bad.some((x) => /em dash/.test(x)), "a broken post says what is wrong", bad.join(" | "));

console.log("\nideas:");
const I = await L("lib/ideas.js");
ok(I.mondayOf("2026-11-06") === "2026-11-02" && I.mondayOf("2026-11-02") === "2026-11-02" && I.mondayOf("x") === "", "a target week is its Monday");
const blog = I.sanitiseIdea({ text: "A post about free rank trackers", type: "blog", targetWeek: "2026-11-13" });
ok(blog.type === "blog" && blog.targetWeek === "2026-11-09" && blog.surface === "Blog", "a blog idea keeps its type and week", JSON.stringify(blog));
const feat = I.sanitiseIdea({ text: "A feature idea of some length", targetWeek: "2026-11-13" });
ok(!feat.type && !feat.targetWeek, "a feature idea has no week");
ok(Boolean(I.sanitiseIdea({ text: "A post with a bad date", type: "blog", targetWeek: "soon" }).error), "a bad week is refused");
const ev = I.sanitiseIdea({ text: "Proposed from a query here", type: "blog", source: "search-console", evidence: { query: "q", impressions: "40", clicks: 0, position: 8.25, group: "near-top" } });
ok(ev.source === "search-console" && ev.evidence.impressions === 40 && ev.evidence.position === 8.3, "a proposal keeps its query and numbers as numbers");
for (const id of ["seed-post-replacing-mantle", "seed-post-free-tools-to-start"]) {
  const s = I.SEEDS.find((x) => x.id === id);
  ok(s && s.type === "blog" && s.status === "shipped" && s.closed && POSTS.some((p) => p.slug === s.postSlug), `${id}: shipped, linked to its post`, s?.postSlug);
}
const store = await L("lib/ideaStore.js");
const added = await store.addIdea({ text: "A blog idea added in the test", type: "blog" }, "t");
const moved = await store.updateIdea(added.row.id, { targetWeek: "2026-12-03" }, "t");
ok(moved.row?.targetWeek === "2026-11-30", "an idea moves to a week", moved.error || moved.row?.targetWeek);
const feature = await store.addIdea({ text: "A feature idea in the test" }, "t");
ok(Boolean((await store.updateIdea(feature.row.id, { targetWeek: "2026-12-03" }, "t")).error), "a feature idea cannot take a week");

console.log("\nblog ideas live on Blog, and get a post's review:");
ok(I.isBlogIdea({ type: "blog" }) && I.isBlogIdea({ surface: "Blog" }) && !I.isBlogIdea({ surface: "Directory" }), "a blog idea is typed blog, or an old one filed under Blog");
const adminSrc = src("components/Admin.jsx");
ok(/<Ideas initial=\{ideas\.filter\(\(i\) => !isBlogIdea\(i\)\)\} \/>/.test(adminSrc) && /!isBlogIdea\(r\) && \(r\.status === "new"/.test(adminSrc)
  && /\.filter\(\(i\) => !isBlogIdea\(i\)\)\)\)/.test(adminSrc), "the general Ideas panel and its count leave blog ideas out");
ok(/Blog ideas are reviewed as posts/.test(src("app/api/admin/ideas/route.js")), "the feature review refuses a blog idea");
const PR = await L("lib/postIdeaReview.js");
const pv = PR.validatePostReview({ verdict: "write", summary: "x", coveredBy: [{ slug: "after-mantle", how: "y" }, { slug: "nope", how: "z" }],
  repeats: [{ id: "ghost" }], listings: ["rankbase", "not-a-tool"], readFirst: ["Ranksy pricing page"] },
  { slugs: POSTS.map((p) => p.slug), ideaIds: [], toolIds: (await L("lib/tools.js")).TOOLS.map((t) => t.id) });
ok(pv.kind === "post" && pv.coveredBy.length === 1 && pv.listings.join() === "rankbase" && pv.repeats.length === 0 && pv.dropped.length === 3,
  "the post review keeps what checks out and says what it dropped", pv.dropped.join(" | "));
const prompt = PR.buildPostPrompt({ text: "Free rank trackers compared" }, []);
ok(!/invariant|an afternoon|a few days|a project/i.test(prompt.replace(/do not discuss code, invariants or build effort/i, "")) && /PUBLISHED POSTS/.test(prompt) && /THE CATALOGUE/.test(prompt),
  "a post is not a feature: no invariants and no build size in its review");
ok(!/\bsize\b/.test(JSON.stringify(pv)) && !/invariants/.test(JSON.stringify(pv)), "and none in what is stored");

console.log("\nsearch console:");
const O = await L("lib/searchOpportunities.js");
const few = [{ query: "shopify app rank tracker", page: "/a", clicks: 0, impressions: 3, position: 12 }];
const thin = O.opportunities(few);
ok(thin.thin.thin && /3 impressions/.test(thin.thin.why), "three impressions are thin, and the sentence says the number", thin.thin.why);
const rich = [];
for (let i = 0; i < 14; i++) rich.push({ query: `query ${i}`, page: "/p", clicks: i % 3 ? 0 : 2, impressions: 60 + i * 10, position: 4 + i });
rich.push({ query: "Query 1", page: "/q", clicks: 1, impressions: 30, position: 20 });
const o = O.opportunities(rich, { hasPage: (q) => q !== "query 2" });
ok(!o.thin.thin, "enough data is not thin", o.thin.why);
ok(o.queries.find((q) => q.query === "query 1").impressions === 100, "a query on two pages is folded, case ignored");
ok(o.noClicks.every((q) => q.clicks === 0) && o.noClicks.length > 0, "no-clicks holds only unclicked queries");
ok(o.nearTop.every((q) => q.position >= 5 && q.position <= 20), "near-top holds positions 5 to 20");
ok(o.noPage.length === 1 && o.noPage[0].query === "query 2", "no-page is what the site's search cannot find");
const { proposeFromSearch } = await L("lib/searchIdeas.js");
const refused = await proposeFromSearch({ opps: thin, range: "r" });
ok(Boolean(refused.error) && /impressions/.test(refused.error), "thin data is refused before any model call", refused.error);

console.log("\nnothing publishes by itself:");
const callers = [...readdirSync(join(root, "app"), { recursive: true })].filter((f) => /\.js$/.test(f)).map((f) => `app/${f}`).filter((f) => /commitPostPublish/.test(src(f)));
ok(callers.length === 1 && callers[0] === "app/api/admin/blog/route.js" && /action === "publish-post"/.test(src(callers[0])), "only the publish-post action commits a post", callers.join(", "));
ok(!/publish/i.test(src("app/api/cron/search/route.js").replace(/\/\*[\s\S]*?\*\//g, "")), "the weekly cron never publishes");
ok(!/commit|publish/i.test(src("lib/blogSchedule.js").replace(/\/\*[\s\S]*?\*\//g, "")), "a target date is stored, and nothing reads it to publish");

console.log("\nthe route:");
const { POST } = await L("app/api/admin/blog/route.js");
const res = await POST(new Request("http://x/api/admin/blog", { method: "POST", body: JSON.stringify({ action: "publish-post", slug: "after-mantle" }) }));
ok(res.status === 404, "404 to anyone but an admin", String(res.status));
/* ---------- announcements of a post live on Blog ---------- */
console.log("\nannouncements of a post:");
const AS = await L("lib/announcementScope.js");
const fn = (name) => {
  const at = adminSrc.indexOf(`\nfunction ${name}(`);
  if (at < 0) return "";
  const next = adminSrc.slice(at + 1).search(/\nfunction [A-Z]/);
  return next < 0 ? adminSrc.slice(at) : adminSrc.slice(at, at + 1 + next);
};
ok(AS.isBlogAnnouncement({ url: "https://watchfor.tools/blog/after-mantle" }) && AS.isBlogAnnouncement({ url: "/blog/what-59-tools-say/" })
  && AS.isBlogAnnouncement({ url: "https://watchfor.tools/blog" }), "a link to a post, or to the blog, is a blog announcement");
ok(!AS.isBlogAnnouncement({ url: "https://watchfor.tools" }) && !AS.isBlogAnnouncement({ url: "https://watchfor.tools/blog/rss" })
  && !AS.isBlogAnnouncement({ url: "https://watchfor.tools/tools/shoplist" }) && !AS.isBlogAnnouncement({ url: "" }) && !AS.isBlogAnnouncement({}),
  "the homepage, the RSS feed, a tool page and no link are not");
const AN = await L("lib/announcements.js");
const postSeeds = AN.SEEDS.filter((s) => /\/blog\//.test(s.url || "")).map((s) => s.id);
ok(postSeeds.length >= 4 && postSeeds.every((id) => AS.isBlogAnnouncement(AN.SEEDS.find((s) => s.id === id))), "every seed linking a post is a blog announcement");
ok(/<Announcements initial=\{announcements\} scope="blog" \/>/.test(fn("Blog")) && /<Announcements initial=\{announcements\} scope="write" \/>/.test(fn("Write")),
  "the Blog section lists announcements of a post; Write lists the rest");
ok(/isBlogAnnouncement\(r\) === blog/.test(fn("Announcements")), "each section shows only its own half of the queue");
ok(/announcements: \(announcements \|\| \[\]\)\.filter\(\(r\) => isOpenAnnouncement\(r\) && !isBlogAnnouncement\(r\)\)/.test(adminSrc)
  && /blog: unreadComments\.length \+ draftsDue \+ backlog\.blogAnnouncements/.test(adminSrc), "Write's count leaves them out and Blog's counts them");

const inv = src("lib/inventory.js");
ok(/svt:blog:schedule/.test(inv) && /svt:searchqueries/.test(inv), "both store keys are in the inventory");

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
