/*
 * Everything the blog calendar on /admin shows, read once on the server
 * (2026-11-06). Server only: it reads the store. The page renders it and the
 * routes in app/api/admin/blog change it.
 *
 * Not a CMS. Posts are files (lib/posts), published through the GitHub path
 * like a catalogue draft. The calendar shows them, holds a target date for a
 * draft (lib/blogSchedule.js), places blog ideas by their target week, and
 * shows what Search Console says a post could win, with how little data there
 * is said plainly.
 */
import { ALL_POSTS, POSTS, POST_FILES, postReadiness } from "./blog";
import { TOOLS } from "./tools";
import { NEWSLETTERS } from "./newsletters";
import { PODCASTS } from "./podcasts";
import { COMMUNITIES } from "./communities";
import { EVENTS } from "./events";
import { getSchedule } from "./blogSchedule";
import { getIdeas } from "./ideaStore";
import { ideaTitle } from "./ideas";
import { getSearchData, searchConfigured } from "./searchConsole";
import { opportunities } from "./searchOpportunities";
import { searchAll } from "./universalSearch";
import { rivalPairs, alternativesOf, confirmed } from "./rivals";
import { HISTORY } from "./announcements";

/* Whether any page here is about a query: the site's own search, every word. */
const hasPage = (q) => searchAll(q, { tools: TOOLS, newsletters: NEWSLETTERS, podcasts: PODCASTS, communities: COMMUNITIES, events: EVENTS }).total > 0;

/* Pages the site keeps out of the index until their structured data is
   confirmed (invariant 48): head-to-heads and alternatives pages. The same
   rule the pages use, so the number on the calendar is the real one. */
export function noindexedCount(tools = [], discovery = {}) {
  const pairs = rivalPairs(tools, discovery);
  const byId = new Map(tools.map((t) => [t.id, t]));
  let compare = 0;
  for (const p of pairs.values()) if (!(confirmed(byId.get(p.a)) && confirmed(byId.get(p.b)))) compare++;
  let alternatives = 0;
  for (const t of tools) {
    const alts = alternativesOf(t, tools, pairs);
    if (alts.length && !(confirmed(t) && alts.some((x) => confirmed(x.tool)))) alternatives++;
  }
  return { compare, alternatives, total: compare + alternatives };
}

export async function calendarData({ tools = TOOLS, discovery = {} } = {}) {
  const [schedule, ideas, search] = await Promise.all([getSchedule(), getIdeas(), getSearchData()]);

  const posts = ALL_POSTS.map((p) => ({
    slug: p.slug, title: p.title, description: p.description, date: p.date, updated: p.updated || "",
    draft: Boolean(p.draft), file: POST_FILES[p.slug] || "",
    target: p.draft ? (schedule[p.slug]?.date || "") : "",
    problems: p.draft ? postReadiness(p) : [],
  }));

  const blogIdeas = ideas.filter((i) => i.type === "blog").map((i) => ({
    id: i.id, title: ideaTitle(i), text: i.text, status: i.status, targetWeek: i.targetWeek || "",
    source: i.source || "", evidence: i.evidence || null, postSlug: i.postSlug || "",
  }));

  const range = search?.startDate ? `${search.startDate} to ${search.endDate}` : "";
  const opps = search?.rows ? opportunities(search.rows, { hasPage }) : null;
  const firstPull = (search?.history || []).map((h) => h.fetchedAt).sort()[0] || "";

  return {
    posts,
    published: POSTS.length,
    ideas: blogIdeas,
    search: {
      configured: searchConfigured(),
      fetchedAt: search?.fetchedAt || "", range, error: search?.error || null,
      totals: search?.totals || null, history: (search?.history || []).slice(0, 8),
      firstPull,
      groups: opps ? { noClicks: opps.noClicks, nearTop: opps.nearTop, noPage: opps.noPage } : null,
      thin: opps ? opps.thin : { thin: true, why: "Nothing has been pulled from Search Console yet." },
    },
    context: {
      launched: HISTORY.launched,
      noindexed: noindexedCount(tools, discovery),
    },
  };
}
