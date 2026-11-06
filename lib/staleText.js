/*
 * Stored sentences that restate a field, and whether they still agree with it
 * (2026-11-06). Pure and client-safe.
 *
 * The rule, the one LAST_UPDATED and the price line already follow: a fact a
 * field holds is said by rendering the field, never by a sentence that copies
 * it. A sentence that copies it goes stale the day the field moves, and
 * nothing notices. Merchant Inspiration Talks had its date confirmed and its
 * caveat went on saying "There is a 2027 save-the-date sign-up but no date."
 *
 * What can be derived is derived: an event's date line and "Not confirmed"
 * come from placeEvent; a newsletter's cadence, issue count and first issue,
 * and a podcast's, are the facts line; a tool's price line is the price or
 * the confirmed tiers. What has to stay prose (a caveat, a measured ratio
 * like "89 of the 292 episodes", a one-line summary) stays prose, and this
 * flags it when it no longer agrees with the field it restates. It never
 * edits: the caveat is editorial (invariant 1), and so is a summary.
 *
 * Each flag: { kind, id, name, field, sentence, text, restates, now, why }.
 * `text` is the whole field so the sentence can be highlighted inside it.
 */

const sentences = (t) => String(t || "").split(/(?<=[.!?])\s+(?=[A-Z0-9"'])/).filter(Boolean);
const PROSE = ["one", "note", "watch", "focus"];

/* An event's date state, as prose. */
export const DATE_STATE = /\b(no date|not announced|not (yet )?confirmed|unconfirmed|save-the-date|date tbc|to be confirmed|no next (edition|date)|names no date|no (date|edition) (for|after))\b/i;

const CADENCE = [
  ["daily", /\bdaily\b/i, /dai|weekday/i],
  ["weekly", /\bweekly\b/i, /weekly|every week|once a week|\b(mon|tues|wednes|thurs|fri|satur|sun)days?\b/i],
  ["fortnightly", /\b(fortnightly|every two weeks)\b/i, /fortnight|two weeks/i],
  ["monthly", /\bmonthly\b/i, /month/i],
  ["twice a week", /\btwice a week\b/i, /twice/i],
];

const num = (s) => Number(String(s).replace(/[,+]/g, ""));

function flag(out, e, kind, field, sentence, restates, now, why) {
  out.push({ kind, id: e.id, name: e.name, field, sentence, text: e[field], restates, now: String(now ?? ""), why });
}

/** One event, placed (with `at`). */
export function eventFlags(e) {
  const out = [];
  if (!e?.at) return out;
  const confirmed = e.at.mode === "exact" && e.at.status !== "past" && !e.at.discontinued;
  for (const field of PROSE) for (const s of sentences(e[field])) {
    if (confirmed && DATE_STATE.test(s)) {
      flag(out, e, "event", field, s, "the date", e.at.label, `The date is confirmed (${e.at.label}), and this says it is not.`);
    }
  }
  return out;
}

/* A newsletter or a podcast: counts, cadence, feeds, a show that stopped. */
function runFlags(e, kind) {
  const out = [];
  const countField = kind === "podcast" ? "episodeCount" : "issueCount";
  const noun = kind === "podcast" ? "episodes?" : "issues?";
  const count = e[countField];
  const stopped = Boolean(e.discontinued);
  for (const field of PROSE) for (const s of sentences(e[field])) {
    /* A count of the whole run that is not the field's. A share ("31 of its
       40 episodes") restates it too, as its total. A run that stopped is a
       record and does not move. */
    if (count && !stopped) {
      const re = new RegExp(`(?:\\bof (?:the |its )?)?\\b(\\d[\\d,]*)\\+?\\s+(?:${noun})\\b`, "gi");
      for (const m of s.matchAll(re)) {
        const share = /\bof\b/i.test(m[0]);
        const n = num(m[1]);
        const after = s.slice(m.index + m[0].length, m.index + m[0].length + 14);
        const before = s.slice(Math.max(0, m.index - 8), m.index);
        const total = share || /^\s+(since|so far|in total|by the end|to date)\b/i.test(after) || /\b(over|about)\s*$/i.test(before) || field === "one";
        if (total && n !== Number(count)) flag(out, e, kind, field, s, countField, count, `Says ${m[1]} ${kind === "podcast" ? "episodes" : "issues"}. The count is ${count}.`);
      }
    }
    /* Cadence: only a summary line or a sentence about the run says it. */
    if (e.cadence && (field === "one" || new RegExp(noun, "i").test(s))) {
      for (const [word, said, held] of CADENCE) {
        if (said.test(s) && !held.test(e.cadence) && !/\b(in|until|before) (19|20)\d\d\b|\bused to\b|\bran\b/i.test(s)) {
          flag(out, e, kind, field, s, "cadence", e.cadence, `Says ${word}. The cadence is "${e.cadence}".`);
        }
      }
    }
    if (/\bno (rss |public )?feed\b/i.test(s) && e.rss) flag(out, e, kind, field, s, "rss", e.rss, "Says there is no feed, and one is recorded.");
    if (/\bno longer publishing\b|\bstopped publishing\b/i.test(s) && kind === "podcast" && !stopped) flag(out, e, kind, field, s, "discontinued", "running", "Says it stopped, and it is not marked as stopped.");
    if (stopped && field === "one" && /\b(weekly|daily|twice a week)\b/i.test(s)) flag(out, e, kind, field, s, "discontinued", "stopped", "Gives a cadence for a show marked as stopped.");
  }
  return out;
}

/* A tool: a named tier's price in prose that is not the confirmed tier's. */
export function toolFlags(t) {
  const out = [];
  const tiers = t?.structured?.pricing?.tiers || [];
  if (!t?.structured?.confirmedAt || !tiers.length) return out;
  for (const field of PROSE) for (const s of sentences(t[field])) {
    for (const tier of tiers) {
      if (!tier.name || typeof tier.amount !== "number") continue;
      const m = new RegExp(`\\b${tier.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b[^.$]{0,24}\\$(\\d[\\d,.]*)`, "i").exec(s);
      if (m && num(m[1]) !== tier.amount && !/\byear|annual/i.test(s.slice(m.index, m.index + m[0].length + 20))) {
        flag(out, t, "tool", field, s, "pricing", `${tier.name} $${tier.amount}`, `Says ${tier.name} is $${m[1]}. The confirmed tier is $${tier.amount}.`);
      }
    }
  }
  return out;
}

/** Every flag across the published catalogues. `events` are placed. */
export function staleFlags({ tools = [], newsletters = [], podcasts = [], events = [] } = {}) {
  return [
    ...events.flatMap(eventFlags),
    ...newsletters.flatMap((n) => runFlags(n, "newsletter")),
    ...podcasts.flatMap((p) => runFlags(p, "podcast")),
    ...tools.flatMap(toolFlags),
  ];
}

/** The field's text split around the flagged sentence, for highlighting. */
export function around(text, sentence) {
  const i = String(text || "").indexOf(sentence);
  if (i < 0) return [String(text || ""), "", ""];
  return [text.slice(0, i), sentence, text.slice(i + sentence.length)];
}
