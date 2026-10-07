/*
 * A sentence-level diff, for showing an editor what a rewrite changed.
 *
 * Sentences rather than words because that is the unit a listing is edited
 * in and the unit the rewrite rules are written in: "a new integration becomes
 * a clause in the existing note". A word diff of a rewritten paragraph is a
 * confetti of tiny marks nobody can read; a sentence diff says which sentences
 * to read again, which is the question.
 *
 * Pure and dependency-free, so components/Admin.jsx can import it without
 * pulling in anything that talks to a model (invariant 20).
 */

/*
 * Split prose into sentences, keeping each one's trailing space.
 *
 * A sentence ends at terminal punctuation followed by whitespace or the end
 * of the text, never at a bare full stop: listings are full of "28.2K",
 * "1.1M", "v2.0" and "$4.99", and splitting on those cut a figure in half.
 */
export function sentences(text) {
  const s = String(text || "");
  if (!s.trim()) return [];
  const parts = s.match(/[\s\S]*?(?:[.!?]+["')\]]*(?=\s|$)\s*|$)/g) || [s];
  return parts.filter((p) => p.trim());
}

const norm = (x) => x.replace(/\s+/g, " ").trim().toLowerCase();

/*
 * Longest common subsequence over normalised sentences. A sentence present in
 * both, in order, is unchanged; everything else in the old text was removed or
 * rewritten and everything else in the new text was added or rewritten.
 */
export function diffSentences(before, after) {
  const a = sentences(before);
  const b = sentences(after);
  const n = a.length;
  const m = b.length;
  const L = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      L[i][j] = norm(a[i]) === norm(b[j]) ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    }
  }
  const keepA = new Set();
  const keepB = new Set();
  for (let i = 0, j = 0; i < n && j < m;) {
    if (norm(a[i]) === norm(b[j])) { keepA.add(i); keepB.add(j); i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) i++;
    else j++;
  }
  return {
    before: a.map((text, i) => ({ text, changed: !keepA.has(i) })),
    after: b.map((text, j) => ({ text, changed: !keepB.has(j) })),
    changedCount: b.filter((_, j) => !keepB.has(j)).length,
  };
}

/*
 * How much longer the new text is, as a percentage. A listing describes what
 * a tool is, and the rule is that it stays about the same length however many
 * things ship, so the editor sees this figure next to every proposal.
 */
export function growth(before, after) {
  const x = String(before || "").trim().length;
  const y = String(after || "").trim().length;
  return { from: x, to: y, pct: x ? Math.round(((y - x) / x) * 100) : (y ? 100 : 0) };
}

/* Past this, the proposal is flagged as growing the listing. */
export const GROWTH_WARN_PCT = 15;
