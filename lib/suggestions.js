/*
 * Duplicate suggestions.
 *
 * Wappalyzer has been suggested by several different people, which is useful
 * information and was being thrown away: each submission became its own row,
 * the queue filled with the same name, and the one fact worth knowing — that
 * more than one person wanted it — was invisible because it was spread across
 * rows nobody counted.
 *
 * So a submission is matched before it is stored, against two things:
 *
 *   1. the published catalogue for its kind. A match means it is already
 *      listed, and the submitter is told so and given the link, rather than
 *      filing a suggestion for something they could have been reading. Matched
 *      against the *published* list on purpose: a draft is not listed, so
 *      saying "already listed" about one would be a lie, and a suggestion for
 *      something already drafted is exactly the demand signal worth keeping.
 *
 *   2. the existing suggestions. A match increments a count and appends the
 *      submitter to the row that is already there, so the second person to ask
 *      for something makes the first row louder instead of making a new one.
 *
 * The matching is loose on names and exact on domains. Two people typing
 * "Wappalyzer" and "wappalyzer.com" mean the same thing; so do "App Store
 * Research" and "AppStoreResearch". A domain only decides it on its own when
 * one entry lives there, because several vendors here ship more than one
 * product from one site. See `pick`.
 *
 * The cost of a false positive is a submitter told their suggestion joined an
 * existing one, which is recoverable and visible in the queue. The cost of a
 * false negative is the status quo.
 */

const STOP = new Set(["the", "app", "apps", "io", "ai", "hq", "co", "inc", "ltd", "com"]);

/**
 * A name reduced to the part that identifies it: lowercase, letters and digits
 * only, with the decorative words that vendors bolt on either end removed.
 * "The Wappalyzer App" and "wappalyzer" both come out as "wappalyzer".
 */
export function normaliseName(name) {
  const words = String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  const kept = words.filter((w) => !STOP.has(w));
  return (kept.length ? kept : words).join("");
}

/**
 * The registrable-looking part of a URL or a bare domain. Not a public-suffix
 * parse, and it does not need to be: it only has to agree with itself across
 * two spellings of the same site.
 */
export function normaliseDomain(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  const host = raw
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, "")
    .replace(/^www\./, "")
    .split(/[/?#]/)[0]
    .replace(/:\d+$/, "");
  if (!host.includes(".")) return "";
  const parts = host.split(".").filter(Boolean);
  /* Two labels is right for example.com and wrong for example.co.uk, which is
     why the last three are kept when the second-to-last is a short suffix. */
  if (parts.length > 2 && parts[parts.length - 2].length <= 3) return parts.slice(-3).join(".");
  return parts.slice(-2).join(".");
}

/* Levenshtein, iterative, one row at a time. Short strings only. */
function distance(a, b) {
  if (a === b) return 0;
  if (!a.length || !b.length) return Math.max(a.length, b.length);
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(
        prev[j] + 1,
        row[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = row;
  }
  return prev[b.length];
}

/**
 * Do two names mean the same product?
 *
 * Exact after normalising, or one contained in the other once both are long
 * enough that the containment is not an accident, or close enough by edit
 * distance to be a typo. The length floors are what stop "Ana" matching
 * "Analytics" and "Shop" matching everything.
 */
export function sameName(a, b) {
  const x = normaliseName(a), y = normaliseName(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  if (short.length >= 6 && long.includes(short)) return true;
  if (short.length < 5) return false;
  const allowed = long.length > 10 ? 2 : 1;
  return distance(x, y) <= allowed;
}

/** A domain match is exact, or nothing. Two sites are not nearly each other. */
export function sameDomain(a, b) {
  const x = normaliseDomain(a), y = normaliseDomain(b);
  return Boolean(x && y && x === y);
}

/**
 * The one entry in `list` this submission is, or null.
 *
 * Name first, because a name is what somebody is actually naming. A domain is
 * only allowed to decide it when that domain has exactly one entry behind it.
 *
 * That last condition is not a nicety. Marmeto has three listings on
 * marmeto.com and Mantle has two on heymantle.com, so on those domains a URL
 * does not identify a product, and a domain-only match would confidently tell
 * somebody suggesting Orbit that Elevate is already listed. Falling through
 * instead files a suggestion, which is the right answer anyway: a vendor
 * already in the directory shipping something new is exactly the thing worth
 * hearing about.
 */
function pick(submission, list) {
  const byName = list.find((e) => sameName(submission.name, e.name));
  if (byName) return byName;
  const key = normaliseDomain(submission.domain || submission.url);
  if (!key) return null;
  const sameSite = list.filter((e) => normaliseDomain(e.domain || e.url) === key);
  return sameSite.length === 1 ? sameSite[0] : null;
}

/**
 * The entry in `catalogue` this submission is already listed as, or null.
 * Callers pass the published list for the submission's kind.
 */
export function findListed(submission, catalogue = []) {
  return pick(submission, catalogue);
}

/**
 * The existing suggestion this one is a repeat of, or null.
 *
 * Only within the same kind: somebody suggesting a podcast called Shoptalk and
 * somebody suggesting a tool called Shoptalk are not making the same request,
 * and merging them would lose both.
 */
export function findDuplicate(submission, suggestions = []) {
  const kind = submission.kind || "tool";
  return pick(submission, suggestions.filter((s) => (s.kind || "tool") === kind));
}

/**
 * Fold a repeat submission into the row that already exists.
 *
 * The original row is the one that stays: its name, URL, category and `why`
 * are what an editor already read, and a later submitter's spelling does not
 * get to overwrite them. What the repeat adds is the count, the submitter, and
 * their `why` when they wrote one, because the second reason for wanting
 * something is usually not the first reason.
 *
 * `count` is absent on rows written before this existed, so it reads as 1.
 */
export const timesAsked = (s) => Math.max(1, Number(s?.count) || 1);

export function mergeDuplicate(existing, submission) {
  const also = Array.isArray(existing.also) ? existing.also : [];
  return {
    ...existing,
    count: timesAsked(existing) + 1,
    lastAsked: submission.date,
    /* Capped: the count is the signal, the list is the colour. */
    also: [
      ...also,
      { by: submission.by, why: submission.why, date: submission.date, email: submission.email },
    ].slice(-20),
    /* A URL the first person did not give is still worth having. */
    url: existing.url || submission.url || "",
  };
}
