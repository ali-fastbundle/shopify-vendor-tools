/*
 * Comments on blog posts.
 *
 * A post is not a listing, so a comment is not a review: there is no rating,
 * nothing is averaged, and one account may comment more than once. Everything
 * else follows the review rules (invariant 16) because the reasons are the
 * same. Signed in, so a comment costs an inbox. The commenter's address is
 * the only private field and leaves through `publicComments()` and nowhere
 * else. The same per-IP limit as a review.
 *
 * ------------------------------------------------------------------
 *  Moderation: shown at once, read by a person afterwards
 * ------------------------------------------------------------------
 * A comment appears the moment it is posted and is flagged for review in the
 * admin Inbox (`reviewed: false`). Holding it back until somebody looked would
 * make every comment wait on the one editor, and a conversation that answers
 * a day later is not one. The editor then does one of three things:
 *
 *   Looks fine   marks it reviewed. It leaves the Inbox.
 *   Hide         takes it off the page with a required reason, and keeps it.
 *                Reversible: Unhide puts it back exactly as it was.
 *   Delete       removes it from the store. For spam and anything that should
 *                not be kept at all. Not reversible, so it asks twice.
 *
 * Every decision is appended to `audit`, which is private like the address.
 * Hidden comments are not served at all: unlike an excluded review, which
 * stays on the page labelled, a hidden comment is something we have decided
 * not to publish.
 */
import { read, write } from "./store";

export const COMMENTS_KEY = "svt:comments";
export const COMMENT_MAX = 2000;
const PER_POST = 500;

/** The id a post is keyed on in votes and comments, distinct from any tool id. */
export const postKey = (slug) => `post:${slug}`;

const keyOf = (email) => String(email || "").trim().toLowerCase();
const clean = (s, max) => String(s ?? "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, max);
const AUDIT_MAX = 20;
const withAudit = (c, row) => ({ ...c, audit: [...(Array.isArray(c.audit) ? c.audit : []), row].slice(-AUDIT_MAX) });

export const readComments = () => read(COMMENTS_KEY, {});

/** Comments as a visitor may see them: hidden ones gone, addresses and moderation stripped. */
export function publicComments(list = [], viewerEmail = "") {
  const me = keyOf(viewerEmail);
  return (Array.isArray(list) ? list : [])
    .filter((c) => c && !c.hidden)
    .map(({ email, reviewed, reviewedBy, reviewedAt, hidden, audit, ...rest }) =>
      (me && keyOf(email) === me ? { ...rest, mine: true } : rest))
    .sort((a, b) => String(a.at).localeCompare(String(b.at)));
}

/** Add a comment to a post's list. Pure. */
export function addComment(all, slug, { author, text, email }, now = new Date().toISOString()) {
  const body = clean(text, COMMENT_MAX);
  if (body.length < 2) return { error: "Write something first." };
  const comment = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    author: clean(author, 40).replace(/\n/g, " ") || "Anonymous",
    text: body, at: now, email, reviewed: false,
  };
  const list = Array.isArray(all?.[slug]) ? all[slug] : [];
  return { comments: { ...all, [slug]: [...list, comment].slice(-PER_POST) }, comment };
}

/** Mark reviewed, hide with a reason, or unhide. Pure. */
export function moderate(all, slug, id, action, { reason = "", by = "" } = {}, now = new Date().toISOString()) {
  const list = Array.isArray(all?.[slug]) ? all[slug] : [];
  const c = list.find((x) => x.id === id);
  if (!c) return { error: "No such comment." };
  let next;
  if (action === "review") {
    next = withAudit({ ...c, reviewed: true, reviewedBy: by, reviewedAt: now }, { action: "reviewed", by, at: now });
  } else if (action === "hide") {
    const why = clean(reason, 200).replace(/\n/g, " ");
    if (!why) return { error: "Say why it is hidden." };
    next = withAudit({ ...c, hidden: { reason: why, by, at: now }, reviewed: true, reviewedBy: by, reviewedAt: now }, { action: "hidden", reason: why, by, at: now });
  } else if (action === "unhide") {
    if (!c.hidden) return { error: "It is not hidden." };
    const { hidden, ...rest } = c;
    next = withAudit(rest, { action: "unhidden", was: hidden.reason, by, at: now });
  } else return { error: "Unknown action." };
  return { comments: { ...all, [slug]: list.map((x) => (x.id === id ? next : x)) } };
}

/** Remove a comment outright. Pure. */
export function removeComment(all, slug, id) {
  const list = Array.isArray(all?.[slug]) ? all[slug] : [];
  if (!list.some((x) => x.id === id)) return { error: "No such comment." };
  return { comments: { ...all, [slug]: list.filter((x) => x.id !== id) } };
}

/** Every comment flattened for /admin, with its post. Server only: carries addresses. */
export function adminComments(all = {}, titleOf = (s) => s) {
  return Object.entries(all || {}).flatMap(([slug, list]) =>
    (Array.isArray(list) ? list : []).map((c) => ({ ...c, slug, postTitle: titleOf(slug) })))
    .sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

export const saveComments = (all) => write(COMMENTS_KEY, all);
