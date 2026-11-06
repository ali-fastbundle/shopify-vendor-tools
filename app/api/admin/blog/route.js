import { sessionFrom, isAdmin } from "@/lib/auth";
import { allow, ipOf } from "@/lib/ratelimit";
import { ALL_POSTS, POST_FILES, postReadiness } from "@/lib/blog";
import { setPostDate, clearPostDate } from "@/lib/blogSchedule";
import { addIdea, updateIdea, getIdeas, recordCommit } from "@/lib/ideaStore";
import { calendarData } from "@/lib/blogCalendar";

export const dynamic = "force-dynamic";
/* Publishing reads and writes GitHub, and proposing waits on a model. */
export const maxDuration = 120;

/*
 * The blog calendar (CLAUDE.md, "The blog calendar"). Admin only, re-checked
 * on every request and 404 to anyone else (invariant 7).
 *
 *   schedule-post   { slug, date }   a drafted post's target date ("" clears)
 *   schedule-idea   { id, week }     a blog idea's target week ("" clears)
 *   add-idea        { text, week? }  a blog idea in the Ideas queue
 *   publish-post    { slug, title, build }  readiness, then the commit
 *   pull-search                     fetch Search Console now
 *   propose                         post ideas from the queries, if not thin
 *
 * Every answer is the calendar's data, fresh. Nothing here publishes a post
 * on a date: a target date is a plan, and Publish is two presses on the day.
 */
const DENY = () => new Response("Not found", { status: 404 });

export async function POST(request) {
  const session = sessionFrom(request);
  if (!session || !isAdmin(session.email)) return DENY();
  if (!(await allow("admin", ipOf(request), 300, 60 * 60_000))) {
    return new Response("Too many admin actions this hour.", { status: 429 });
  }
  let body;
  try { body = await request.json(); } catch { body = {}; }
  const fresh = async (extra = {}) => Response.json({ calendar: await calendarData(), ...extra });
  const fail = (msg, status = 400) => new Response(msg, { status });
  const action = String(body.action || "");

  if (action === "schedule-post") {
    const post = ALL_POSTS.find((p) => p.slug === body.slug);
    if (!post) return fail("No post with that slug in this build.");
    if (!post.draft) return fail("That post is published. Only a draft has a target date.");
    const r = await setPostDate({ slug: post.slug, date: String(body.date || ""), by: session.email });
    return r.error ? fail(r.error) : fresh();
  }

  if (action === "schedule-idea") {
    const r = await updateIdea(String(body.id || ""), { targetWeek: String(body.week ?? "") }, session.email);
    return r.error ? fail(r.error) : fresh();
  }

  if (action === "add-idea") {
    const r = await addIdea({ text: body.text, type: "blog", targetWeek: body.week || "" }, session.email);
    return r.error ? fail(r.error) : fresh();
  }

  if (action === "publish-post") {
    const { BUILD } = await import("@/lib/draftOutcomes");
    if (body.build !== BUILD) return fail(`This page was rendered by build ${String(body.build || "none").slice(0, 7)} and the server is now ${BUILD.slice(0, 7)}. Reload before publishing.`, 409);
    const post = ALL_POSTS.find((p) => p.slug === body.slug);
    if (!post) return fail("No post with that slug in this build.");
    if (body.title !== undefined && body.title !== post.title) return fail(`The page named this "${body.title}", but this build calls it "${post.title}". Reload.`, 409);
    if (!post.draft) return fail(`${post.title} is not a draft in this build. Reload.`, 409);
    const { commitPostPublish, logPublish } = await import("@/lib/publish");
    const r = await commitPostPublish({ post, path: POST_FILES[post.slug], problems: postReadiness(post) });
    const at = new Date().toISOString();
    if (r.error) {
      await logPublish({ at, by: session.email, kind: "post", id: post.slug, name: post.title, outcome: "publish failed", reason: r.error });
      console.log(`[drafts] publish-post post:${post.slug} failed`);
      return fail(r.error, 502);
    }
    await logPublish({ at, by: session.email, kind: "post", id: post.slug, name: post.title, sha: r.sha, url: r.url, outcome: "published" });
    console.log(`[drafts] publish-post post:${post.slug} ${r.sha.slice(0, 7)}`);
    await clearPostDate(post.slug);
    /* The idea that became this post is shipped by this commit. */
    for (const i of await getIdeas()) {
      if (i.type === "blog" && i.postSlug === post.slug && i.status !== "shipped") await recordCommit(i.id, r.sha.slice(0, 7), session.email);
    }
    return fresh({ sha: r.sha, url: r.url });
  }

  if (action === "pull-search") {
    const { pullSearchConsole } = await import("@/lib/searchConsole");
    const r = await pullSearchConsole();
    return r.error ? fail(r.error, 502) : fresh();
  }

  if (action === "propose") {
    const cal = await calendarData();
    const { proposeFromSearch } = await import("@/lib/searchIdeas");
    const r = await proposeFromSearch({
      opps: cal.search.groups ? { ...cal.search.groups, thin: cal.search.thin } : null,
      range: cal.search.range,
      posts: cal.posts.filter((p) => !p.draft),
      by: session.email,
    });
    return r.error ? fail(r.error, 409) : fresh({ added: r.added.length, dropped: r.dropped });
  }

  return fail("Unknown action.");
}
