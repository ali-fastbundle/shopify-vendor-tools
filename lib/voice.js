/*
 * Ali's voice, for every prompt that drafts text a visitor will read.
 *
 * The full guide is the `ali-voice` skill (.claude/skills/ali-voice, local
 * only) and the "Public-facing text" section of CLAUDE.md. This is the part a
 * model needs, stated once so the feed drafter, the LinkedIn drafter, the
 * listing rewrite and research all ask for the same thing. Each prompt keeps
 * its own surface rules (first person or not, length, which fields).
 *
 * `voiceIssues` is the code half: a prompt is a request, not a guarantee, so
 * the panels can show what slipped through. It flags; it never rewrites,
 * because "make it two sentences" is a judgement. Pure and client-safe.
 */

export const VOICE_RULES = `Readers may not have English as a first language. Every sentence must be
understood on the first reading. Everything below serves that.
- Short sentences, one idea each. Past about 20 words, it is two sentences.
- Common words: "use" not "utilize", "start" not "commence", "about" not
  "regarding". Technical nouns stay exact: listing, feed, keyword, install,
  changelog, crawler.
- No idioms, no metaphors, no analogies. "A gap in the market" is a metaphor.
  "Nobody was tracking it" is not.
- No marketing words: excited, thrilled, delighted, game-changer, seamless,
  powerful, robust, comprehensive, leverage, unlock, elevate, supercharge,
  revolutionize, cutting-edge, best-in-class, journey, "solution" for software.
- No hedging ("perhaps", "it may be worth", "you might want to") and no "just"
  as a softener.
- NEVER an em dash. No semicolons. No exclamation marks.
- The fact first, no preamble. Numbers over adjectives. If a number is small,
  give the small number.
- Say what is missing or unverified plainly. A claim only the vendor makes is
  marked as the vendor's claim.
- American spelling.`;

export const MARKETING = /\b(excited|thrilled|delighted|proud to|game[- ]?chang\w*|revolutioni[sz]\w*|seamless\w*|powerful|robust|comprehensive|cutting[- ]edge|unlock\w*|supercharg\w*|leverag\w*|elevat\w*|best[- ]in[- ]class|world[- ]class|journey|solutions?|utiliz\w*|incredible|amazing)\b/gi;

const HEDGES = /\b(perhaps|it may be worth|you might want to|just)\b/gi;

/* Sentences, split on terminal punctuation followed by a space and a capital
   or a digit, so "$1.4M" and "e.g. this" do not split. */
export const sentencesOf = (text) =>
  String(text || "").split(/(?<=[.?!])\s+(?=[A-Z0-9"“])/).map((s) => s.trim()).filter(Boolean);

const words = (s) => s.split(/\s+/).filter(Boolean).length;

/** What in this text breaks the voice. Pure. */
export function voiceIssues(text, { maxWords = 20 } = {}) {
  const t = String(text || "");
  const uniq = (re) => [...new Set((t.match(re) || []).map((m) => m.toLowerCase()))];
  return {
    emDash: /—/.test(t),
    semicolons: (t.match(/;/g) || []).length,
    exclamations: (t.match(/!/g) || []).length,
    marketing: uniq(MARKETING),
    hedges: uniq(HEDGES),
    long: sentencesOf(t).filter((s) => words(s) > maxWords + 5)
      .map((s) => `${s.split(/\s+/).slice(0, 6).join(" ")}… (${words(s)} words)`),
  };
}
