/*
 * Post ideas proposed from Search Console queries (2026-11-06). Server only:
 * it calls the model through lib/model.js.
 *
 * - Refuses when the data is thin (lib/searchOpportunities.js): no idea is
 *   built on a handful of impressions, and the refusal says the numbers.
 * - The model sees the three groups and picks queries from them. A query it
 *   names that is not in the groups is dropped. The numbers on each idea are
 *   attached in code from the data, never written by the model.
 * - Each idea lands in the Ideas queue as type "blog", status new, source
 *   "search-console", with the query and its numbers as `evidence`, for the
 *   editor to accept or drop. Nothing is written as a post.
 * - A query proposed once is not proposed again (svt:searchqueries
 *   proposedQueries), and neither is one an existing idea already cites.
 */
import { askJson, configured } from "./model";
import { VOICE_RULES, voiceIssues } from "./voice";
import { addIdea, getIdeas } from "./ideaStore";
import { markProposed } from "./searchConsole";

const MAX_IDEAS = 5;

export async function proposeFromSearch({ opps, range, posts = [], by = "" }) {
  if (!opps || opps.thin?.thin) return { error: opps?.thin?.why || "Not enough Search Console data to propose anything." };
  if (!configured()) return { error: "No model is configured, so no ideas were proposed." };

  const ideas = await getIdeas();
  const cited = new Set(ideas.map((i) => i.evidence?.query).filter(Boolean));
  const groups = [["no-clicks", opps.noClicks], ["near-top", opps.nearTop], ["no-page", opps.noPage]];
  const candidates = new Map();
  for (const [group, list] of groups) for (const q of list) {
    if (!cited.has(q.query) && !candidates.has(q.query)) candidates.set(q.query, { ...q, group });
  }
  if (!candidates.size) return { error: "Every query in the groups already has an idea, so nothing new was proposed." };

  const list = [...candidates.values()].slice(0, 30)
    .map((q) => `- "${q.query}" [${q.group}] ${q.impressions} impressions, ${q.clicks} clicks, average position ${q.position}`).join("\n");
  const system = `You propose blog posts for watchfor.tools, an independent directory of tools for people who build Shopify apps. Posts compare tools on stated criteria, link listings rather than copy them, and mark claims nobody checked.

${VOICE_RULES}

Answer with JSON only: {"ideas":[{"query":"...","title":"...","angle":"..."}]}.
- At most ${MAX_IDEAS} ideas. Fewer is fine. None is fine: {"ideas":[]}.
- "query" must be copied exactly from the list. Do not invent queries.
- "title" is the post title a searcher would click, in plain words, with the query's words in it.
- "angle" is one or two short sentences: what the post would compare or answer, from this directory's listings.
- Do not state numbers. They are attached separately.
- Do not propose a post that only restates one listing.`;
  const prompt = `Queries from Search Console, ${range}. Groups: no-clicks (shown, never clicked), near-top (average position 5 to 20), no-page (nothing on the site is about it).
${list}

Posts already published: ${posts.map((p) => `"${p.title}"`).join(", ") || "none"}.`;

  let data, provider;
  try { ({ data, provider } = await askJson({ system, prompt, maxTokens: 1200 })); }
  catch (e) { return { error: `The model did not answer usable JSON: ${String(e.message || e).slice(0, 120)}` }; }

  const added = [], dropped = [];
  for (const it of (Array.isArray(data?.ideas) ? data.ideas : []).slice(0, MAX_IDEAS)) {
    const q = candidates.get(String(it?.query || "").trim().toLowerCase());
    if (!q) { dropped.push(`"${it?.query}": not a query in the list`); continue; }
    const title = String(it.title || "").replace(/\s*—\s*/g, ", ").trim().slice(0, 140);
    const angle = String(it.angle || "").replace(/\s*—\s*/g, ", ").trim().slice(0, 500);
    if (title.length < 10) { dropped.push(`"${q.query}": no usable title`); continue; }
    const flags = voiceIssues(`${title}. ${angle}`);
    const text = `${title}\n\n${angle}\n\nFrom Search Console, ${range}: "${q.query}", ${q.impressions} impressions, ${q.clicks} clicks, average position ${q.position} (${q.group === "no-clicks" ? "shown, never clicked" : q.group === "near-top" ? "ranks 5 to 20" : "no page on the site is about it"}).${flags.marketing.length || flags.slop.length ? `\n\nVoice flags: ${[...flags.marketing, ...flags.slop].join(", ")}.` : ""}`;
    const r = await addIdea({ text, type: "blog", source: "search-console", evidence: { ...q, range } }, by || `model:${provider}`);
    if (r.error) dropped.push(`"${q.query}": ${r.error}`); else added.push(r.row);
  }
  await markProposed(added.map((r) => r.evidence.query));
  console.log(`[search] proposed ${added.length} ideas, dropped ${dropped.length}`);
  return { added, dropped, provider };
}
