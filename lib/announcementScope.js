/*
 * Which admin section an announcement belongs to. Pure, client-safe.
 *
 * An announcement whose link is a blog post (or the blog itself) is about the
 * blog, so it lives on the Blog section beside the post it announces, and is
 * counted there. Everything else stays on Write. The rule reads the row's
 * `url`, which every seed and every hand-drafted row carries, so a seed and a
 * row drafted by hand land in the same place by the same test, and a stored
 * row that was edited keeps its place.
 */
export function isBlogAnnouncement(r) {
  const url = String(r?.url || "").trim();
  if (!url) return false;
  let path = url;
  try { path = new URL(url, "https://watchfor.tools").pathname; } catch { return false; }
  return /^\/blog(\/[^/]+)?\/?$/.test(path) && !/\/rss\/?$/.test(path);
}

/** Open means still to post: a draft or ready. */
export const isOpenAnnouncement = (r) => r?.status === "draft" || r?.status === "ready";
