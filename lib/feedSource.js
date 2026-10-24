/*
 * Where a feed entry came from, said the same way on the page, in RSS and in
 * the Markdown version (2026-10-24). Three kinds, short and neutral, type and
 * never a badge (rule G):
 *   observed          found by the weekly monitor on the vendor's site
 *   from the vendor   the vendor told the editor directly
 *   mentioned         somebody else's words, linked and attributed (invariant 58)
 * Pure and client-safe.
 */
export const MENTION_SOURCE_NAME = {
  hackernews: "Hacker News", bluesky: "Bluesky", "shopify-community": "Shopify Community",
  "shopify-dev-community": "the Shopify developer community", github: "GitHub",
};

export function sourceOf(e = {}) {
  if (e.source === "mention") {
    const where = MENTION_SOURCE_NAME[e.mentionSource] || e.mentionSource || "";
    return {
      kind: "mentioned",
      label: `Mentioned${e.mentionAuthor ? ` by ${e.mentionAuthor}` : ""}${where ? ` on ${where}` : ""}`,
      note: "Their words, not the directory's.",
      title: "Someone else's words, linked and attributed. Not the directory's.",
    };
  }
  if (e.source === "vendor") {
    return { kind: "vendor", label: "From the vendor", note: "", title: "The vendor told the directory directly." };
  }
  return { kind: "observed", label: "Observed", note: "", title: "Found by the weekly monitor on the vendor's site." };
}

/** The listing's page: a tool by default, or the page the entry recorded. */
export const entryHref = (e = {}) => e.href || `/tools/${e.toolId}`;

const clipTitle = (s, n = 90) => { const x = String(s || "").replace(/\s+/g, " ").trim(); return x.length > n ? `${x.slice(0, n - 1).trim()}…` : x; };

/**
 * Where the mention sits: the post, what it answers, and the thread as
 * context. "Post 17 by Ollie_autoBlogger, in reply to jason_engage, in a
 * thread about “Sophisticated 1-Star Review Mercenaries for Hire”". Pure.
 */
export function contextLine(m) {
  const bits = [];
  bits.push(`${m.post?.number ? `Post ${m.post.number}` : "Posted"} by ${m.author || "an unnamed account"}`);
  if (m.replyTo?.author) bits.push(`in reply to ${m.replyTo.author}`);
  else if (m.replyTo) bits.push("in reply to another post");
  if (m.title) bits.push(`in a thread about “${clipTitle(m.title)}”`);
  return bits.join(", ");
}

