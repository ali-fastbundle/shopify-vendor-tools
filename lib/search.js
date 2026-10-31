/*
 * The text an entry is searched on, and the one matching rule, for the search
 * across every section (lib/universalSearch.js, /search). Pure and
 * server-safe.
 *
 * Arrays are flattened and anything empty dropped, so a caller can pass the
 * raw optional fields of an entry without guarding each one.
 */
export function searchText(...parts) {
  return parts.flat(Infinity)
    .filter((p) => p !== undefined && p !== null && p !== "")
    .map((p) => String(p))
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/* Every word has to appear somewhere, in any order, so "london retail" finds
   the London retail show without the visitor guessing our word order. */
export function matchesQuery(text, query) {
  const words = String(query || "").toLowerCase().split(/\s+/).filter(Boolean);
  return words.every((w) => text.includes(w));
}

/* The text each kind is searched on, defined once. */
export const eventSearchText = (e) =>
  searchText(e.name, e.organizer, e.city, e.country, e.venue, e.one, e.focus, e.audience);

export const newsletterSearchText = (n) =>
  searchText(n.name, n.publisher, n.author, n.cadence, n.one, n.note, n.tags, n.topics);

export const podcastSearchText = (p) =>
  searchText(p.name, p.host, p.publisher, p.cadence, p.one, p.note, p.topics, p.discontinued && "stopped");

export const toolSearchText = (t, catLabels = []) =>
  searchText(t.name, t.one, t.note, t.tags, t.domain, catLabels, t.ownership?.name, t.owner);
