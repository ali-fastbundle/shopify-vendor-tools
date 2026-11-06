/*
 * The review a blog idea gets (2026-11-06). A post is not a feature, so it is
 * not checked against the invariants and not sized as build effort (that is
 * lib/ideaReview.js, for features). Server only: it calls the model.
 *
 * What a post review asks, in this order:
 *  1. Is it already written, or already in the blog ideas? A published post or
 *     another idea that covers it, named by its slug or id.
 *  2. Which listings would it rest on? Tool ids, checked against the
 *     catalogue; a comparison needs enough of them to compare.
 *  3. What can this directory say that a vendor's own page cannot: the
 *     caveats, who owns what, prices read on each vendor's pricing page.
 *  4. What has to be read before writing, because the blog marks what it did
 *     not check (invariant 41).
 *  5. Who would search for it, in the words they would type. Search Console
 *     numbers are quoted only when the idea carries them as evidence.
 *  6. The honest objections.
 * Verdict: write, doubtful or skip. Everything named that cannot be checked
 * (a slug, an idea id, a tool id) is dropped and the drop is shown.
 */
import { askJson, configured } from "./model";
import { VOICE_RULES } from "./voice";
import { TOOLS, CATEGORIES, catOf, catsOf } from "./tools";
import { POSTS } from "./blog";
import { ideaTitle } from "./ideas";

export const POST_VERDICTS = { write: "Worth writing", doubtful: "Doubtful", skip: "Do not write" };

const SYSTEM = `You review ideas for blog posts on watchfor.tools, an independent directory of tools for people who build Shopify apps. Its posts compare tools on stated criteria, link each listing rather than copy it, say who owns what, and mark every figure nobody here checked. You are the skeptical second reader: find what already covers the idea and what would make the post thin. A short "do not write this" is a good answer. This is a post, not a software feature: do not discuss code, invariants or build effort.
${VOICE_RULES}
Return only JSON.`;

function catalogue() {
  return CATEGORIES.map((c) => {
    const tools = TOOLS.filter((t) => catsOf(t).includes(c.id));
    return `${c.label} (${tools.length}): ${tools.map((t) => `${t.id} ${t.name}`).join("; ")}`;
  }).join("\n");
}

export function buildPostPrompt(idea, others = []) {
  return `PUBLISHED POSTS
${POSTS.map((p) => `[${p.slug}] ${p.title}: ${p.description}`).join("\n") || "none"}

OTHER BLOG IDEAS
${others.map((i) => `[${i.id}] ${i.status}: ${ideaTitle(i)}${i.dropped ? ` (dropped: ${i.dropped.reason})` : ""}`).join("\n") || "none"}

THE CATALOGUE, BY CATEGORY (tool id, then name)
${catalogue()}

THE IDEA
${idea.text}
${idea.evidence?.query ? `\nSearch Console evidence: "${idea.evidence.query}", ${idea.evidence.impressions} impressions, ${idea.evidence.clicks} clicks, average position ${idea.evidence.position}${idea.evidence.range ? `, ${idea.evidence.range}` : ""}.` : ""}

Return exactly this JSON:
{"summary":"two sentences at most",
 "verdict":"write" | "doubtful" | "skip",
 "coveredBy":[{"slug":"a published post's slug, only if it already covers this","how":"what it covers"}],
 "repeats":[{"id":"another blog idea's id, only if it is the same post","how":"how"}],
 "listings":["tool ids from the catalogue the post would compare or rest on"],
 "onlyHere":"what this directory can say that the vendors' own pages cannot, one or two sentences",
 "readFirst":["what must be read or checked before writing, each specific"],
 "reader":"who would search for this, and the words they would type",
 "objections":["each one specific"]}`;
}

const tidy = (s, n = 400) => String(s || "").replace(/\s*—\s*/g, ", ").trim().slice(0, n);
const list = (v, n = 10) => (Array.isArray(v) ? v : []).map((x) => tidy(x)).filter(Boolean).slice(0, n);

/** Keep what can be checked and drop what cannot. Pure. */
export function validatePostReview(p = {}, { slugs = [], ideaIds = [], toolIds = [] } = {}) {
  const dropped = [];
  const verdict = POST_VERDICTS[p.verdict] ? p.verdict : "doubtful";
  if (!POST_VERDICTS[p.verdict]) dropped.push(`verdict "${p.verdict}" is not one of ours, shown as doubtful`);
  const coveredBy = (Array.isArray(p.coveredBy) ? p.coveredBy : []).flatMap((c) => {
    if (!slugs.includes(String(c?.slug))) { if (c?.slug) dropped.push(`post "${c.slug}" does not exist`); return []; }
    return [{ slug: String(c.slug), how: tidy(c.how, 300) }];
  });
  const repeats = (Array.isArray(p.repeats) ? p.repeats : []).flatMap((r) => {
    if (!ideaIds.includes(String(r?.id))) { if (r?.id) dropped.push(`idea "${r.id}" does not exist`); return []; }
    return [{ id: String(r.id), how: tidy(r.how, 300) }];
  });
  const listings = [...new Set((Array.isArray(p.listings) ? p.listings : []).map(String))].filter((id) => {
    if (toolIds.includes(id)) return true;
    dropped.push(`tool "${id}" is not in the catalogue`);
    return false;
  }).slice(0, 25);
  return {
    kind: "post", summary: tidy(p.summary, 500), verdict, coveredBy, repeats, listings,
    onlyHere: tidy(p.onlyHere, 500), readFirst: list(p.readFirst), reader: tidy(p.reader, 300),
    objections: list(p.objections), dropped,
  };
}

/** Review one blog idea as a post. Returns { review } or { error }. */
export async function reviewPostIdea(idea, blogIdeas = []) {
  if (!configured()) return { error: "No model key is set, so blog ideas cannot be reviewed here." };
  const others = blogIdeas.filter((i) => i.id !== idea.id);
  try {
    const { data, provider } = await askJson({ system: SYSTEM, prompt: buildPostPrompt(idea, others), maxTokens: 1800, timeoutMs: 120_000 });
    const review = validatePostReview(data, { slugs: POSTS.map((p) => p.slug), ideaIds: others.map((i) => i.id), toolIds: TOOLS.map((t) => t.id) });
    return { review: { ...review, provider, title: ideaTitle(idea) } };
  } catch (e) {
    return { error: `The review failed: ${String(e?.message || e).slice(0, 200)}` };
  }
}
