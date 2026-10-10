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

/*
 * ------------------------------------------------------------------
 *  Reviews that are shown but not counted
 * ------------------------------------------------------------------
 * An editor can mark a review "excluded from average". It stays on the
 * listing, labelled with the reason, and counts toward neither the displayed
 * rating nor the aggregateRating markup. The case that forced it: BestAppify's
 * only review was its own founder's five stars, disclosed in the text, and it
 * was the whole of the rating the page published. A fabricated average is
 * worse than none (invariant 16); deleting an honest, disclosed review would
 * be worse than labelling it.
 *
 * `excluded` is { reason, by, at }. `by` is the admin's address and leaves
 * nothing but this file: publicReviews keeps the reason and drops the rest.
 * Every average on the site goes through ratingStats(), so there is one rule.
 */
export const EXCLUSION_REASONS = {
  vendor: { label: "From the vendor", why: "written by the vendor's own team" },
  unverifiable: { label: "Unverifiable", why: "could not be tied to real use of the tool" },
};

/** The one sentence the site says about how ratings work, wherever a rating shows. */
export const RATING_POLICY =
  "Ratings average signed-in reviews. Reviews from the vendor's own team, or that cannot be verified, are shown but not counted.";

/** The label on an excluded review, or "" for one that counts. */
export const exclusionNote = (r) => {
  const why = r && r.excluded && EXCLUSION_REASONS[r.excluded.reason]?.why;
  return why ? `Not counted in the rating: ${why}` : "";
};

/** Whether a review counts toward a rating. */
export const counted = (r) => Boolean(r) && !r.excluded;

/** `{ value, count }` from the reviews that count, or null when none do. */
export function ratingStats(list = []) {
  const c = (Array.isArray(list) ? list : []).filter(counted);
  if (!c.length) return null;
  return { value: c.reduce((n, r) => n + (Number(r.rating) || 0), 0) / c.length, count: c.length };
}

/*
 * The two markers the admin review list raises (lib/reviewSignals.js). They
 * are kinds, so a confirmation can say which ones it covers: confirming a
 * burst says nothing about a reviewer on the vendor's domain, and a marker of
 * a kind added later can still raise a review somebody confirmed for another.
 */
export const MARKERS = {
  burst: "three or more reviews on this listing within seven days",
  domain: "reviewer signed in on the listing's own domain",
};

/*
 * Every decision about a review is appended here, newest last, so a wrong
 * call can be traced and undone knowing what it undid. Private, like the
 * reviewer's address: publicReviews strips it.
 */
const AUDIT_MAX = 20;
const withAudit = (r, row) => ({ ...r, audit: [...(Array.isArray(r.audit) ? r.audit : []), row].slice(-AUDIT_MAX) });

/**
 * Exclude a review with a reason, or unexclude it with reason null. Unexclude
 * is an undo: exclusion is a judgement and some will be wrong. Either way the
 * decision is kept in `audit`, including what an unexclude undid.
 */
export function setExclusion(reviews, toolId, reviewId, reason, by) {
  const list = Array.isArray(reviews?.[toolId]) ? reviews[toolId] : [];
  const target = list.find((r) => r.id === reviewId);
  if (!target) return { error: "unknown" };
  if (reason && !EXCLUSION_REASONS[reason]) return { error: "reason" };
  if (!reason && !target.excluded) return { error: "not-excluded" };
  const at = new Date().toISOString();
  const next = list.map((r) => {
    if (r.id !== reviewId) return r;
    if (!reason) {
      const { excluded, ...rest } = r;
      return withAudit(rest, { action: "unexcluded", was: excluded.reason, by, at });
    }
    return withAudit({ ...r, excluded: { reason, by, at } }, { action: "excluded", reason, by, at });
  });
  return { reviews: { ...reviews, [toolId]: next } };
}

/**
 * Confirm a review: somebody looked and it is fine. It stays counted, and the
 * markers named here stop showing on it. Only the markers it carries now are
 * covered, so a later marker of another kind can still raise it. Refused for
 * an excluded review: confirming one would quietly contradict the exclusion,
 * and unexclude is the way to say the exclusion was wrong.
 */
export function confirmReview(reviews, toolId, reviewId, markers, by) {
  const list = Array.isArray(reviews?.[toolId]) ? reviews[toolId] : [];
  const target = list.find((r) => r.id === reviewId);
  if (!target) return { error: "unknown" };
  if (target.excluded) return { error: "excluded" };
  const kinds = [...new Set((Array.isArray(markers) ? markers : []).filter((m) => MARKERS[m]))];
  if (!kinds.length) return { error: "markers" };
  const at = new Date().toISOString();
  const prev = Array.isArray(target.confirmed?.markers) ? target.confirmed.markers : [];
  const next = list.map((r) => (r.id !== reviewId ? r : withAudit(
    { ...r, confirmed: { by, at, markers: [...new Set([...prev, ...kinds])] } },
    { action: "confirmed", markers: kinds, by, at },
  )));
  return { reviews: { ...reviews, [toolId]: next } };
}

/** The marker kinds a review has been confirmed for. */
export const confirmedFor = (r) => (Array.isArray(r?.confirmed?.markers) ? r.confirmed.markers : []);

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
    // confirmed and audit are moderation records: who looked, when, and every
    // decision. Stripped here with the addresses, so nothing new can leak by
    // being spread through `rest`.
    out[toolId] = list.map(({ email, helpfulBy, excluded, confirmed, audit, ...rest }) => {
      const by = Array.isArray(helpfulBy) ? helpfulBy : [];
      const row = { ...rest, helpful: by.length };
      // The reason is public; who set it is not.
      if (excluded && EXCLUSION_REASONS[excluded.reason]) row.excluded = { reason: excluded.reason };
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
  /*
   * A confirmation was given on the words too, so rewriting the text clears it
   * and the markers come back for another look. An exclusion survives an edit:
   * the reviewer cannot clear it by retyping.
   */
  const { confirmed: _was, ...kept } = previous || {};
  const entry = previous
    ? {
      ...(textChanged ? kept : previous), ...review,
      id: previous.id, date: previous.date, editedAt: review.date,
      helpfulBy: textChanged ? [] : helpfulList(previous),
    }
    : review;
  const next = previous
    ? list.map((r) => (keyOf(r.email) === me ? entry : r))
    : [entry, ...rest].slice(0, 200);
  return { reviews: { ...reviews, [toolId]: next }, replaced: Boolean(previous) };
}
