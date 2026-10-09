/*
 * The text an index row is searched on, written into the server HTML as
 * `data-search` so components/IndexSearch.jsx can filter rows that were
 * already rendered. Pure and server-safe: the index pages stay server
 * components and only the box itself is client code.
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
