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
 *
 * ------------------------------------------------------------------
 *  Helpfulness
 * ------------------------------------------------------------------
 * A review carries `helpfulBy`, the addresses of the accounts that marked it
 * useful. Deciding which review people read first is at least as worth gaming
 * as a rating is, so it is gated the same way: signed in, one vote per account
 * per review, and never on your own.
 *
 * The addresses are private for the same reason the reviewer's is, and they
 * leave through the same door: `publicReviews()` turns `helpfulBy` into a count
 * and a `helpfulByMe` flag and drops the list. Nothing else may read it.
 */

/** The reviewer's key. Normalised the same way lib/auth.js normalises email. */
const keyOf = (email) => String(email || "").trim().toLowerCase();

const helpfulList = (review) => (Array.isArray(review?.helpfulBy) ? review.helpfulBy : []);

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
    out[toolId] = list.map(({ email, helpfulBy, ...rest }) => {
      const by = Array.isArray(helpfulBy) ? helpfulBy : [];
      const row = { ...rest, helpful: by.length };
      if (!me) return row;
      if (keyOf(email) === me) row.mine = true;
      if (by.some((e) => keyOf(e) === me)) row.helpfulByMe = true;
      return row;
    });
  }
  return out;
}

/**
 * Display order: most helpful first, most recent to break a tie.
 *
 * `date` rather than `editedAt`, deliberately. The date under a review says
 * when the opinion was formed, which is why an edit does not move it, and
 * letting an edit reorder the list would hand somebody a way to climb it by
 * retyping a full stop. The id is the last tiebreak only so the order is
 * stable across renders.
 */
export const byHelpfulness = (a, b) =>
  (b.helpful || 0) - (a.helpful || 0) ||
  String(b.date || "").localeCompare(String(a.date || "")) ||
  String(b.id || "").localeCompare(String(a.id || ""));

/**
 * Mark a review helpful, or take it back. Toggling, because a vote you cannot
 * withdraw is a vote people do not cast.
 *
 * Returns `{ error }` for the two refusals rather than throwing, so the route
 * decides the status code and the wording. Voting on your own review is one of
 * them: it is the cheapest possible way to move yourself up the list, and no
 * amount of rate limiting makes it not worth doing.
 */
export function toggleHelpful(reviews, toolId, reviewId, email) {
  const list = Array.isArray(reviews[toolId]) ? reviews[toolId] : [];
  const review = list.find((r) => r.id === reviewId);
  if (!review) return { error: "unknown" };
  /*
   * An older review written before sign-in was required has no address, so
   * keyOf() gives "" and this never matches a real session. Anonymous rows stay
   * votable by anyone, which is right: nobody can claim one.
   */
  if (keyOf(review.email) && keyOf(review.email) === keyOf(email)) return { error: "own" };

  const me = keyOf(email);
  const by = helpfulList(review);
  const had = by.some((e) => keyOf(e) === me);
  const next = had ? by.filter((e) => keyOf(e) !== me) : [...by, email];
  return {
    reviews: { ...reviews, [toolId]: list.map((r) => (r.id === reviewId ? { ...r, helpfulBy: next } : r)) },
    marked: !had,
  };
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
  /*
   * Helpfulness was voted on the text, so rewriting the text drops it.
   *
   * Otherwise the top of the list is farmable: post something genuinely useful,
   * collect the votes it earns, then edit it into an advertisement that keeps
   * the position those votes bought. Changing only the rating keeps the votes,
   * because the words people found helpful are still the words on the page.
   */
  const textChanged = previous && String(previous.text || "") !== String(review.text || "");
  const entry = previous
    ? {
      ...previous, ...review,
      id: previous.id, date: previous.date, editedAt: review.date,
      helpfulBy: textChanged ? [] : helpfulList(previous),
    }
    : review;
  const next = previous
    ? list.map((r) => (keyOf(r.email) === me ? entry : r))
    : [entry, ...rest].slice(0, 200);
  return { reviews: { ...reviews, [toolId]: next }, replaced: Boolean(previous) };
}
