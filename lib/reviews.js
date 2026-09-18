/*
 * Community reviews.
 *
 * A rating used to cost nothing: no sign-in, no identity, one click as many
 * times as you liked. That makes the directory's own primary signal the
 * cheapest number on the page, and a five-star average assembled by one person
 * with a browser is worse than no average at all, because it looks like
 * evidence.
 *
 * So a review is now tied to an account. Signing in is the credibility layer
 * and it is meant to cost something: an email you can receive at, and a link
 * you have to click. One review per account per tool, editable rather than
 * duplicated, because the second thing somebody thinks about a tool should
 * replace the first rather than sit next to it under the same name.
 *
 * Votes are deliberately not covered by this. A like is a shrug, it is worth
 * roughly what it costs, and the per-browser and per-IP limits are the right
 * ceiling for a shrug. Asking someone to sign in before they can nod at a card
 * would cost more signal than it protects.
 *
 * ------------------------------------------------------------------
 *  Shape and privacy
 * ------------------------------------------------------------------
 * A stored review carries the reviewer's email, because that is the key the
 * one-per-account rule turns on. It is the only thing here that is not public,
 * so nothing reaches a visitor except through `publicReviews()`, which strips
 * it. The author's display name is what shows, the same as before.
 *
 * `mine` is added per request, never stored: it tells the browser which row is
 * the caller's so the form can open on it and edit it in place.

 */

/** The reviewer's key. Normalised the same way lib/auth.js normalises email. */
const keyOf = (email) => String(email || "").trim().toLowerCase();

/**
 * Reviews as a visitor may see them. Emails are removed here and nowhere else,
 * so a route that forgets to call this ships nothing rather than shipping
 * addresses: every consumer reads the result of this function.
 */
export function publicReviews(reviews = {}, viewerEmail = "") {
  const me = keyOf(viewerEmail);
  const out = {};
  for (const [toolId, list] of Object.entries(reviews || {})) {
    if (!Array.isArray(list)) continue;
    out[toolId] = list.map(({ email, ...rest }) =>
      (me && keyOf(email) === me ? { ...rest, mine: true } : rest));
  }
  return out;
}

/**
 * Write a review, replacing this account's previous one for the same tool.
 *
 * Returns the new map and whether it replaced anything, because an edit and a
 * first review are not the same event to report on.
 */
export function upsertReview(reviews, toolId, review) {
  const list = Array.isArray(reviews[toolId]) ? reviews[toolId] : [];
  const me = keyOf(review.email);
  const previous = list.find((r) => keyOf(r.email) === me) || null;
  const rest = list.filter((r) => keyOf(r.email) !== me);
  /*
   * An edited review keeps its original id and its original date, and carries
   * an `editedAt`. Moving it back to the top of the list would let somebody
   * bump themselves by retyping a full stop, and the date under a review is
   * meant to say when the opinion was formed.
   */
  const entry = previous
    ? { ...previous, ...review, id: previous.id, date: previous.date, editedAt: review.date }
    : review;
  const next = previous
    ? list.map((r) => (keyOf(r.email) === me ? entry : r))
    : [entry, ...rest].slice(0, 200);
  return { reviews: { ...reviews, [toolId]: next }, replaced: Boolean(previous) };
}
