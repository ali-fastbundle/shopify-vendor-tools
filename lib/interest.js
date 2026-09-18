/*
 * Interest: how many people have asked for a tool that is already listed.
 *
 * Suggesting something already in the catalogue used to be a dead end. The
 * submitter got told it was already listed and nothing was recorded, which
 * threw away the one thing the submission was actually evidence of: that
 * somebody went looking for this and did not find it easily, and cared enough
 * to type it in. The fourth person to do that is telling us something about
 * the tool and something about our own navigation.
 *
 * So it is counted. In Redis, under `svt:interest`, keyed on the tool id and
 * never in `lib/tools.js`: that file is editorial source and a counter that
 * moves every time a stranger fills in a form is the opposite of editorial.
 * Invariant 4. `mergedTools()` reads this the same way it reads vendor
 * overrides and published entries.
 *
 * ------------------------------------------------------------------
 *  Shape
 * ------------------------------------------------------------------
 *   { [toolId]: { count, people: [{ by, why, email, date }] } }
 *
 * `people` carries addresses, so it is stripped on every public read exactly
 * like a suggestion's `also`. The count is public; who asked is not.
 *
 * `count` and `people.length` are deliberately allowed to disagree: the list is
 * capped and a publication carries a count across from a suggestion that had
 * more submitters than the cap. The count is the number, the list is the
 * colour.
 */

import { read, write } from "./store";

const KEY = "svt:interest";

/* The reasons are editorial input, not an audit log. Twenty is more than
   anyone reads and enough to see a pattern. */
const MAX_PEOPLE = 20;

const clean = (s, max) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, max);

export async function getInterest() { return read(KEY, {}); }

/** Just the counts, which is all the public side of the site ever needs. */
export async function interestCounts() {
  const all = await getInterest();
  const out = {};
  for (const [id, v] of Object.entries(all || {})) {
    const n = Math.max(0, Number(v?.count) || 0);
    if (n > 0) out[id] = n;
  }
  return out;
}

/**
 * Record that somebody asked for a tool that is already listed.
 *
 * Returns the new count so the route can tell them where they stand, which is
 * the difference between "we already have that" and "you and three other
 * people already have that".
 */
export async function addInterest(toolId, person = {}) {
  const all = await getInterest();
  const current = all[toolId] || { count: 0, people: [] };
  const people = Array.isArray(current.people) ? current.people : [];

  const next = {
    count: Math.max(0, Number(current.count) || 0) + 1,
    people: [
      ...people,
      {
        by: clean(person.by, 40) || "Anonymous",
        why: clean(person.why, 600),
        email: clean(person.email, 160),
        date: person.date || new Date().toISOString().slice(0, 10),
      },
    ].slice(-MAX_PEOPLE),
  };

  all[toolId] = next;
  await write(KEY, all);
  return next.count;
}

/**
 * Carry a suggestion's accumulated demand onto the tool it became.
 *
 * Called when a draft is published. Without it, the four people who asked for
 * something before it existed are erased at the moment it starts existing,
 * which is exactly backwards: that is when their asking is proven right.
 *
 * Additive rather than assigning, so publishing twice does not reset a counter
 * that has been climbing since, and so a tool that already had interest keeps
 * it.
 */
export async function carryInterest(toolId, { count = 0, people = [] } = {}) {
  const wanted = Math.max(0, Number(count) || 0);
  if (!toolId || (!wanted && !people.length)) return 0;

  const all = await getInterest();
  const current = all[toolId] || { count: 0, people: [] };
  const existing = Array.isArray(current.people) ? current.people : [];

  const carried = (Array.isArray(people) ? people : []).map((p) => ({
    by: clean(p.by, 40) || "Anonymous",
    why: clean(p.why, 600),
    email: clean(p.email, 160),
    date: p.date || "",
  }));

  all[toolId] = {
    count: (Math.max(0, Number(current.count) || 0)) + wanted,
    people: [...existing, ...carried].slice(-MAX_PEOPLE),
  };
  await write(KEY, all);
  return all[toolId].count;
}
