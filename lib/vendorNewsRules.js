/*
 * The rules for reading a vendor's message, pure and client-safe, so the
 * admin panel checks a line as it is edited and the server checks it again
 * on publish with the same code. The store and the model calls are in
 * lib/vendorNews.js, which re-exports these.
 */

/* The em-dash scrub lib/rewrite.js does, copied because that file is server only. */
const scrub = (s) => String(s || "")
  .replace(/\s*[\u2014\u2013]\s*/g, ", ").replace(/\s+/g, " ")
  .replace(/\s+([,.;:])/g, "$1").replace(/,\s*,/g, ",").trim();

const clean = (s, max) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, max);

export const STATUSES = ["live", "announced", "unclear"];
export const FIELDS = ["one", "note", "price", "free", "other"];
export const KINDS = ["new-capability", "pricing", "free-tier", "wind-down", "acquisition", "scale", "ownership"];

/* Quotes are compared loosely on the things a model changes without meaning
   to: case, whitespace, curly quotes and dashes, a trailing full stop. */
const norm = (s) => String(s || "").toLowerCase()
  .replace(/[‘’‚′]/g, "'").replace(/[“”„″]/g, '"')
  .replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();

export function quoteIn(quote, text) {
  const q = norm(quote).replace(/[.\s]+$/, "");
  return q.length >= 8 && norm(text).includes(q);
}

/**
 * Keep only what the email supports. Pure. Returns `{ extraction, dropped }`.
 */
export function sanitiseExtraction(raw, email) {
  const src = raw && typeof raw === "object" ? raw : {};
  const dropped = [];
  const items = [];
  for (const it of Array.isArray(src.items) ? src.items.slice(0, 12) : []) {
    const name = clean(it?.name, 80);
    if (!name) continue;
    let status = STATUSES.includes(it?.status) ? it.status : "unclear";
    const quote = clean(it?.quote, 400);
    const found = quoteIn(quote, email);
    if (status === "live" && !found) {
      status = "unclear";
      dropped.push(`"${name}" was read as live, but its quote is not in the email, so it is treated as unclear.`);
    }
    items.push({ name, what: clean(it?.what, 240), status, quote: found ? quote : "" });
  }
  const listingChanges = [];
  for (const c of Array.isArray(src.listingChanges) ? src.listingChanges.slice(0, 8) : []) {
    const what = clean(c?.what, 240);
    if (!what) continue;
    if (!quoteIn(c?.quote, email)) { dropped.push(`A change to the listing ("${what.slice(0, 80)}") had no quote from the email, so it was dropped.`); continue; }
    listingChanges.push({ field: FIELDS.includes(c?.field) ? c.field : "other", what, quote: clean(c.quote, 400) });
  }
  const contradictions = [];
  for (const c of Array.isArray(src.contradictions) ? src.contradictions.slice(0, 8) : []) {
    const said = clean(c?.email, 240);
    if (!said) continue;
    if (!quoteIn(c?.quote, email)) { dropped.push(`A contradiction ("${said.slice(0, 80)}") had no quote from the email, so it was dropped.`); continue; }
    contradictions.push({ listing: clean(c?.listing, 240), email: said, quote: clean(c.quote, 400) });
  }
  return {
    extraction: {
      items, listingChanges, contradictions,
      kind: KINDS.includes(src.kind) ? src.kind : "new-capability",
      summary: scrub(src.summary).slice(0, 240),
    },
    dropped,
  };
}

/* What says a thing is not out yet. Matched per sentence. */
const NOT_YET = /\b(in development|being (developed|built)|developing|not (yet )?(released|live|available|out)|announced|coming|planned|upcoming|will|waitlist|early access|preview)\b/i;

/**
 * Why a feed line cannot go out as written, given what the email said. Pure,
 * client-safe in spirit, and run again by the server on publish.
 */
export function draftIssues(headline, extraction) {
  const issues = [];
  const text = String(headline || "");
  if (/—/.test(text)) issues.push("It has an em-dash.");
  const sentences = text.split(/(?<=[.!?])\s+/);
  for (const it of extraction?.items || []) {
    if (it.status === "live" || it.name.length < 3) continue;
    const name = it.name.toLowerCase();
    const bad = sentences.some((s) => s.toLowerCase().includes(name) && !NOT_YET.test(s));
    if (bad) {
      issues.push(`"${it.name}" is ${it.status === "announced" ? "announced, not released" : "not stated as live"} in the email. Say it is in development, or leave it out.`);
    }
  }
  return issues;
}

/**
 * The finding-shaped object the rewrite reads (lib/rewrite.js), built from
 * the live items and the stated listing changes only. Something announced is
 * named as never to be written into the listing.
 */
export function changeFromNews(rec) {
  const ex = rec.extraction || {};
  const live = (ex.items || []).filter((i) => i.status === "live");
  const notLive = (ex.items || []).filter((i) => i.status !== "live").map((i) => i.name);
  const what = [
    live.length ? `Live, by the vendor's account: ${live.map((i) => `${i.name}${i.what ? ` (${i.what})` : ""}`).join("; ")}.` : "",
    (ex.listingChanges || []).length ? `What it changes about the tool: ${ex.listingChanges.map((c) => `${c.field}: ${c.what}`).join("; ")}.` : "",
  ].filter(Boolean).join(" ");
  return {
    id: rec.id, entryId: rec.toolId, kind: ex.kind || "new-capability", source: "vendor",
    what, old: "", new: "", url: rec.sourceUrl || "", confidence: "the vendor's word, not observed",
    notLive, at: rec.at,
  };
}

/** Set an item's status by hand, when the reading got it wrong. Pure. */
export function withStatuses(rec, statuses = {}) {
  const items = (rec.extraction?.items || []).map((it, i) => (
    STATUSES.includes(statuses[i]) && statuses[i] !== it.status ? { ...it, status: statuses[i], setBy: "editor" } : it));
  return { ...rec, extraction: { ...rec.extraction, items } };
}

/** Which outcomes a record has had. Resolve needs at least one. Pure. */
export function destinationsOf(rec, { feedIds = new Set(), rewritten = {} } = {}) {
  return [
    rec.feedId && feedIds.has(rec.feedId) && "published",
    rewritten[rec.id] && "rewritten",
    rec.editedByHand && "edited",
  ].filter(Boolean);
}
