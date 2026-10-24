/*
 * The post a mention sits in, and the post it answers. Server only.
 *
 * A thread title says what a thread is about, not what one reply in it said:
 * "Sophisticated 1-Star Review Mercenaries for Hire" is the title over both a
 * developer using LetsMetrix to pull a reviewer's history (post 3) and a
 * recommendation of AppNavigator for quick checks (post 17). So a mention is
 * anchored to its own post, and its summary is written from that post and
 * enough of the one it replies to.
 *
 * The text read here is used to match and to summarise, then dropped: it is
 * never stored and never sent to a browser (invariant 58). Links are kept in
 * the text as their URLs, because a domain is often only in an href: post 3
 * links LetsMetrix behind the words "Shopify App Reviews Detail".
 */
const UA = "watchfor.tools-mentions/1.0 (+https://watchfor.tools)";
const textOf = (html) => String(html || "")
  .replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, " $2 ($1) ")
  .replace(/<[^>]+>/g, " ")
  .replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/\s+/g, " ").trim();

async function getJson(url, headers = {}, fetcher = fetch) {
  const res = await fetcher(url, { headers: { "user-agent": UA, ...headers }, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

/** A Discourse post by id, with its text (links kept), author, date and what it answers. */
export async function discoursePost(base, id, fetcher) {
  const p = await getJson(`${base}/posts/${id}.json`, {}, fetcher);
  return {
    number: p.post_number, author: p.username || "", at: String(p.created_at || "").slice(0, 10),
    url: `${base}/t/${p.topic_slug || "-"}/${p.topic_id}/${p.post_number}`,
    topicId: p.topic_id, text: textOf(p.cooked),
    replyTo: p.reply_to_post_number ? { number: p.reply_to_post_number, author: p.reply_to_user?.username || "" } : null,
  };
}

export async function discourseByNumber(base, topicId, n, fetcher) {
  const p = await getJson(`${base}/posts/by_number/${topicId}/${n}.json`, {}, fetcher);
  return { number: p.post_number, author: p.username || "", text: textOf(p.cooked) };
}

/**
 * The post and the post it answers, for any source a mention can come from.
 * `{ text, reply: { author, text } | null }`; empty text when unreadable.
 */
export async function postContext(m, fetcher = fetch) {
  try {
    if (m.source === "shopify-community" || m.source === "shopify-dev-community") {
      const u = new URL(m.url);
      const base = u.origin;
      const parts = u.pathname.split("/").filter(Boolean);
      const n = Number(parts[parts.length - 1]);
      const topicId = Number(parts[parts.length - 2]);
      const post = await discourseByNumber(base, topicId, n, fetcher);
      let reply = null;
      if (m.replyTo?.number) {
        const r = await discourseByNumber(base, topicId, m.replyTo.number, fetcher).catch(() => null);
        if (r) reply = { author: r.author, text: r.text };
      }
      return { text: post.text, reply };
    }
    if (m.source === "hackernews") {
      const id = new URL(m.url).searchParams.get("id");
      const d = await getJson(`https://hn.algolia.com/api/v1/items/${id}`, {}, fetcher);
      let reply = null;
      if (d.parent_id && d.parent_id !== d.story_id) {
        const p = await getJson(`https://hn.algolia.com/api/v1/items/${d.parent_id}`, {}, fetcher).catch(() => null);
        if (p) reply = { author: p.author || "", text: textOf(p.text || p.title || "") };
      }
      return { text: textOf([d.title, d.text].filter(Boolean).join(". ")), reply };
    }
    if (m.source === "bluesky") {
      const [, handle, , rkey] = new URL(m.url).pathname.split("/").filter(Boolean);
      const d = await getJson(`https://api.bsky.app/xrpc/app.bsky.feed.getPostThread?uri=${encodeURIComponent(`at://${handle}/app.bsky.feed.post/${rkey}`)}&depth=0&parentHeight=1`, {}, fetcher);
      const post = d?.thread?.post;
      const parent = d?.thread?.parent?.post;
      return { text: textOf(post?.record?.text || ""), reply: parent ? { author: parent.author?.handle || "", text: textOf(parent.record?.text || "") } : null };
    }
    if (m.source === "github") {
      const path = new URL(m.url).pathname.replace(/\/pull\//, "/issues/");
      const headers = process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {};
      const d = await getJson(`https://api.github.com/repos${path}`, headers, fetcher);
      return { text: textOf(`${d.title || ""}. ${d.body || ""}`), reply: null };
    }
  } catch { /* unreadable: the caller says so */ }
  return { text: "", reply: null };
}
