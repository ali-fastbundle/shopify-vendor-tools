/*
 * Entries published from the admin queue.
 *
 * ------------------------------------------------------------------
 *  Why these are not written into lib/tools.js
 * ------------------------------------------------------------------
 * Two reasons, and the first is not a preference.
 *
 * A Vercel function's filesystem is read only. There is no version of
 * "approve writes the entry to lib/tools.js" that works in production: the
 * write throws, or it lands in a container that is discarded on the next
 * request. The only way an approval can reach the live site from a web page is
 * a store the live site reads, which is this.
 *
 * The second is invariant 4, which survives intact because of the first.
 * `lib/tools.js` stays editorial source that nothing mutates at runtime, these
 * live beside it in Redis, and `mergedTools()` reads both. A bad entry is one
 * key delete away, exactly like a bad vendor override, and the file a human
 * maintains is never rewritten by a machine.
 *
 * `Copy as entry stub` on /admin is how an entry graduates from here into the
 * file. Nothing forces that and nothing breaks without it. It is worth doing
 * for anything meant to last, because the file is reviewable in git and this
 * is not.
 *
 * ------------------------------------------------------------------
 *  Shape
 * ------------------------------------------------------------------
 * The tool shape from lib/tools.js, plus provenance:
 *
 *   source        "suggestion", and the suggestion id it came from.
 *   suggestedBy   how many people asked for it. Renders on the card.
 *   unconfirmed   claims the research could not stand up, as written text.
 *                 Not a boolean: "which parts are unverified" is the useful
 *                 question and a flag cannot answer it.
 *   publishedAt   the day it went live, and what `updated` is set from.
 *   publishedBy   the admin who clicked approve. Somebody is accountable for
 *                 every entry here, which is the whole point of the button.
 *   draftedBy     the model that wrote the first version, or "" for a human.
 *
 * `ratings` is absent and is stripped on the way in, deliberately. External
 * scores are entered by hand from the platform's own page and never scraped,
 * which a model researching a vendor's site cannot honour and would not know
 * it was breaking. That invariant is older than this feature and outranks it.
 */

import { read, write } from "./store";
import { TOOLS, CATEGORIES, SOCIAL_KEYS } from "./tools";

const KEY = "svt:entries";

const clean = (s, max) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, max);

const httpsUrl = (s) => {
  const v = clean(s, 300);
  return /^https?:\/\/[^\s]+\.[^\s]+$/.test(v) ? v : "";
};

export async function getEntries() { return read(KEY, {}); }

/** Published entries as an array, in the tool shape the UI already renders. */
export async function entryList() {
  const entries = await getEntries();
  return Object.values(entries || {}).filter((e) => e && e.id && e.name);
}

/**
 * The catalogue as the site should treat it: the file, plus what has been
 * published from the queue. The file wins on a collision, because a hand
 * written entry is the better one and an id clash means somebody promoted this
 * into lib/tools.js and forgot to drop the stored copy.
 */
export async function catalogueTools() {
  const extra = await entryList();
  const seen = new Set(TOOLS.map((t) => t.id));
  return [...TOOLS, ...extra.filter((e) => !seen.has(e.id))];
}

/** Is this an id anything may be voted on, reviewed or reported against? */
export async function isListedId(id) {
  if (!id || typeof id !== "string") return false;
  if (TOOLS.some((t) => t.id === id)) return true;
  const entries = await getEntries();
  return Boolean(entries && entries[id]);
}

/*
 * ids are permanent and keyed on by votes, reviews and claims, so this is
 * deliberately boring: lowercase letters and digits, derived from the name,
 * and refused rather than mangled if it collides with something already
 * listed. Invariant 3.
 */
export const idFrom = (name) =>
  String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 32);

/* "None", "no caveats", "nothing to watch for" and friends. The instruction to
   the model forbids these; this is the check that they did not arrive anyway. */
const NO_CAVEAT = /^(none|n\/?a|nothing|no caveats?|no concerns?|no issues?|not applicable)\b[.!]*$/i;

/**
 * Coerce whatever arrived into the house shape, or say why it cannot be.
 *
 * Used on the model's draft and again on whatever the admin edited it into,
 * because the second pass is the one that matters: the model's output is
 * reviewed by a person, the browser's is not.
 */
export function sanitiseEntry(input = {}, { existingIds = [] } = {}) {
  const name = clean(input.name, 60);
  if (!name) return { error: "A name is required." };

  const id = clean(input.id, 32).toLowerCase().replace(/[^a-z0-9]/g, "") || idFrom(name);
  if (!id) return { error: "Could not make an id from that name." };
  if (existingIds.includes(id)) {
    return { error: `The id "${id}" is already used. Ids are permanent, so pick another.` };
  }

  const url = httpsUrl(input.url);
  if (!url) return { error: "A full https:// site URL is required." };

  const one = clean(input.one, 140);
  const note = clean(input.note, 1600);
  const watch = clean(input.watch, 1600);
  if (!one) return { error: "`one` is required." };
  if (!note) return { error: "`note` is required." };
  /*
   * The caveat is the product. An entry without one is not a shorter entry, it
   * is a vendor's own description with our name on it, so this refuses rather
   * than publishing a blank. "none" is refused for the same reason, wherever
   * it hides: see NO_CAVEAT.
   */
  if (!watch) return { error: "`watch` is required. An entry without a caveat is the vendor's own page." };
  if (NO_CAVEAT.test(watch)) {
    return { error: "`watch` says there is no caveat. Say what was checked and not found instead." };
  }

  const cat = CATEGORIES.some((c) => c.id === input.cat) ? input.cat : CATEGORIES[0].id;

  /*
   * Secondary categories, validated the same way and with the primary deduped
   * out. Unknown ids are dropped rather than refused: a model or an admin form
   * naming a category that does not exist is a fixable mistake, and losing the
   * whole entry over it is not proportionate. Capped so a drafted entry cannot
   * file itself into the entire directory.
   */
  const alsoIn = (Array.isArray(input.alsoIn) ? input.alsoIn : [])
    .map((id) => clean(id, 24).toLowerCase())
    .filter((id, i, all) =>
      id !== cat && all.indexOf(id) === i && CATEGORIES.some((c) => c.id === id))
    .slice(0, 4);

  const social = {};
  for (const k of SOCIAL_KEYS) {
    const u = httpsUrl(input.social?.[k]);
    if (u) social[k] = u;
  }

  const tags = Array.isArray(input.tags)
    ? [...new Set(input.tags.map((t) => clean(t, 30).toLowerCase()).filter(Boolean))].slice(0, 14)
    : [];

  const unconfirmed = Array.isArray(input.unconfirmed)
    ? input.unconfirmed.map((u) => clean(u, 240)).filter(Boolean).slice(0, 12)
    : [];

  return {
    entry: {
      id, name, cat,
      domain: clean(input.domain, 100).replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").toLowerCase()
        || url.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0],
      url,
      price: clean(input.price, 60) || "Not published",
      free: Boolean(input.free),
      /*
       * Never true from here. `verified: true` means a person read the
       * vendor's own site, and a model reading it is not that. The admin can
       * set it by hand in lib/tools.js when promoting the entry, which is also
       * the moment they would actually have read it.
       */
      verified: false,
      /*
       * `noRecommend` and `competes` are never set from here either. One is a
       * rule about this directory's own behaviour and the other is a judgement
       * about a market that decides whose page a tool appears on, so both are
       * written by hand in lib/tools.js where somebody is on the hook for them
       * in git, rather than asserted by anything arriving over HTTP or out of
       * a model.
       */
      shopifyExclusive: input.shopifyExclusive === false ? false : undefined,
      tags, one, note, watch, social, unconfirmed,
      ...(alsoIn.length ? { alsoIn } : {}),
    },
  };
}

export async function saveEntry(entry, { publishedBy = "", suggestionId = "", suggestedBy = 1, draftedBy = "" } = {}) {
  const entries = await getEntries();
  const today = new Date().toISOString().slice(0, 10);
  const next = {
    ...entry,
    source: suggestionId ? `suggestion:${suggestionId}` : "admin",
    suggestedBy: Math.max(1, Number(suggestedBy) || 1),
    draftedBy,
    publishedBy,
    publishedAt: entries[entry.id]?.publishedAt || today,
    /* Same rule as the file: the day it goes in. Invariant 15. */
    updated: today,
  };
  entries[entry.id] = next;
  await write(KEY, entries);
  return next;
}

export async function removeEntry(id) {
  const entries = await getEntries();
  if (!entries[id]) return { removed: false, entries };
  delete entries[id];
  await write(KEY, entries);
  return { removed: true, entries };
}
