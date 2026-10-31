import { read, KEYS } from "@/lib/store";
import { mergedTools, mergedNewsletters, mergedEvents, mergedPodcasts } from "@/lib/listings";
import { publicReviews } from "@/lib/reviews";
import { feedEntries } from "@/lib/feed";
import { getAbout } from "@/lib/aboutStore";
import { AUTHOR_URL } from "@/lib/tools";
import { todayISO } from "@/lib/events";
import { SITE } from "@/lib/seo";
import {
  toolMarkdown, indexMarkdown, categoryMarkdown, newsletterMarkdown, newslettersMarkdown, podcastMarkdown, podcastsMarkdown,
  eventMarkdown, eventsMarkdown, ownerMarkdown, ownersMarkdown, postMarkdown, blogMarkdown, changesMarkdown, aboutMarkdown,
} from "@/lib/markdown";

/*
 * Every content page as Markdown, at its own path plus .md. middleware.js
 * rewrites `/tools/sasi.md` here as `/md/tools/sasi`; the address in the bar
 * stays the .md one. Built from the same loaders as the HTML page, per request,
 * because those pages are dynamic too (an event's past or upcoming is today's
 * answer, and vendor edits are live). lib/markdown.js holds what each page
 * says and the rule that nothing here may say more than the page does.
 */
export const dynamic = "force-dynamic";

const reviews = async () => publicReviews(await read(KEYS.reviews, {}));

async function build(parts) {
  const [a, b, extra] = parts;
  if (extra) return null;
  if (!a || a === "index") return b ? null : indexMarkdown({ tools: await mergedTools(), reviews: await reviews() });
  if (a === "tools" && b) {
    const [tools, r, discovery] = await Promise.all([mergedTools(), reviews(), read("svt:discovery", {})]);
    return { md: toolMarkdown(b, { tools, reviews: r, discovery: discovery || {} }), path: `/tools/${b}` };
  }
  if (a === "categories" && b) return { md: categoryMarkdown(b, { tools: await mergedTools() }), path: `/categories/${b}` };
  if (a === "newsletters") {
    const [newsletters, r] = await Promise.all([mergedNewsletters(), reviews()]);
    if (!b) return { md: newslettersMarkdown({ newsletters, reviews: r }), path: "/newsletters" };
    const [tools, events] = await Promise.all([mergedTools(), mergedEvents()]);
    return { md: newsletterMarkdown(b, { newsletters, tools, events, reviews: r }), path: `/newsletters/${b}` };
  }
  if (a === "podcasts") {
    const podcasts = await mergedPodcasts();
    if (!b) return { md: podcastsMarkdown({ podcasts }), path: "/podcasts" };
    const [tools, newsletters, events, r] = await Promise.all([mergedTools(), mergedNewsletters(), mergedEvents(), reviews()]);
    return { md: podcastMarkdown(b, { podcasts, tools, newsletters, events, reviews: r }), path: `/podcasts/${b}` };
  }
  if (a === "events") {
    const events = await mergedEvents();
    if (!b) return { md: eventsMarkdown({ events }, todayISO()), path: "/events" };
    const [tools, newsletters, r] = await Promise.all([mergedTools(), mergedNewsletters(), reviews()]);
    return { md: eventMarkdown(b, { events, tools, newsletters, reviews: r }, todayISO()), path: `/events/${b}` };
  }
  if (a === "owners") {
    const [tools, newsletters, events] = await Promise.all([mergedTools(), mergedNewsletters(), mergedEvents()]);
    if (!b) return { md: ownersMarkdown({ tools, newsletters, events }), path: "/owners" };
    return { md: ownerMarkdown(b, { tools, newsletters, events }), path: `/owners/${b}` };
  }
  if (a === "blog") return b ? { md: postMarkdown(b), path: `/blog/${b}` } : { md: blogMarkdown(), path: "/blog" };
  if (a === "changes" && !b) return { md: changesMarkdown({ entries: await feedEntries({ limit: 300 }) }), path: "/changes" };
  if (a === "about" && !b) return { md: aboutMarkdown(await getAbout(), { authorUrl: AUTHOR_URL }), path: "/about" };
  return null;
}

export async function GET(_request, { params }) {
  const parts = (params?.path || []).map((p) => decodeURIComponent(p));
  let out = await build(parts);
  /* The index builder returns the text itself; give it the shape the rest use. */
  if (typeof out === "string") out = { md: out, path: "/" };
  if (!out?.md) {
    return new Response("Not found. Append .md to a content page's path: a tool, a category, a newsletter, a podcast, an event, an owner, a blog post, or /index.md, /events.md, /newsletters.md, /podcasts.md, /owners.md, /blog.md, /changes.md, /about.md.\n", {
      status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  return new Response(out.md, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      /* The HTML page is the canonical one; this is the same page in another format. */
      Link: `<${SITE}${out.path === "/" ? "" : out.path}>; rel="canonical"`,
      "Cache-Control": "public, max-age=0, s-maxage=300",
    },
  });
}
