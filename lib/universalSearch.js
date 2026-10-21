import { CATEGORIES, catsOf, catOf, findCat, priceLine, categoryTerm } from "./tools";
import { placed } from "./events";
import { POSTS } from "./blog";
import { ownersWithPages } from "./ownerIndex";
import { searchText, matchesQuery, eventSearchText, newsletterSearchText, toolSearchText } from "./search";

/*
 * One search across every section: tools, categories, newsletters, events,
 * blog posts and owners. It is what the sidebar box runs from any page that
 * has no list of its own, and what a section search links to when the answer
 * might be in another section.
 *
 * Pure and server-safe. It matches the way the section searches do (every
 * word somewhere in the entry, any order, lib/search.js), with no model call,
 * so it costs nothing per search and works with JavaScript off.
 *
 * Past events are results like any other. The directory is also a record of
 * what the ecosystem has held, so an event that ran last year is found the
 * same way as one next month, labelled as past.
 *
 * Callers pass the published lists only (mergedTools and friends), so a draft
 * can never be a result: invariant 12 holds here by what is handed in.
 */

export const MIN_QUERY = 2;
export const MAX_QUERY = 100;

export const cleanQuery = (q) => String(q || "").replace(/\s+/g, " ").trim().slice(0, MAX_QUERY);

/* 0 when the name holds the whole phrase, 1 when it holds every word, 2 when
   only the rest of the entry does. Names first is what a person typing a
   name expects, and it is all the ranking a catalogue this size needs. */
function nameScore(name, q) {
  const n = String(name || "").toLowerCase();
  const lq = q.toLowerCase();
  if (n.includes(lq)) return 0;
  return matchesQuery(n, lq) ? 1 : 2;
}

const byScoreThen = (tiebreak) => (a, b) => a.score - b.score || tiebreak(a, b);
const byName = (a, b) => a.name.localeCompare(b.name);

/* Upcoming soonest first, then undated, then past newest first. */
const EVENT_ORDER = { imminent: 0, upcoming: 0, unscheduled: 1, past: 2 };
function eventTiebreak(a, b) {
  const sa = EVENT_ORDER[a.status] ?? 1, sb = EVENT_ORDER[b.status] ?? 1;
  if (sa !== sb) return sa - sb;
  if (sa === 0) return String(a.date).localeCompare(String(b.date));
  if (sa === 2) return String(b.date).localeCompare(String(a.date));
  return byName(a, b);
}

/* Same as the events index (components/EventParts.jsx). */
const placeOf = (e) =>
  [e.city, e.country].filter((x) => x && !/^n\/a$/i.test(x)).filter((x, i, a) => a.indexOf(x) === i).join(", ");

/**
 * Everything matching `q`, grouped by kind, in display order. Groups with no
 * results are left out (rule E). `lists` takes the published, merged lists.
 */
export function searchAll(q, { tools = [], newsletters = [], events = [], posts = POSTS } = {}, today) {
  const query = cleanQuery(q);
  if (query.length < MIN_QUERY) return { query, groups: [], total: 0 };
  const hit = (text) => matchesQuery(text, query);

  const toolRows = tools
    .filter((t) => hit(toolSearchText(t, catsOf(t).map((id) => findCat(id)?.label))))
    .map((t) => ({
      kind: "tool", id: t.id, name: t.name, href: `/tools/${t.id}`, one: t.one,
      meta: [catOf(t.cat).label, priceLine(t)].filter(Boolean).join(" · "),
      score: nameScore(t.name, query), dying: Boolean(t.dying),
    }))
    /* A tool winding down sorts last here too, as in every order. */
    .sort((a, b) => Number(a.dying) - Number(b.dying) || a.score - b.score || byName(a, b));

  const categoryRows = CATEGORIES
    .filter((c) => hit(searchText(c.label, c.term, c.blurb)))
    .map((c) => ({
      kind: "category", id: c.id, name: categoryTerm(c), href: `/categories/${c.id}`, one: c.blurb,
      meta: `${tools.filter((t) => catsOf(t).includes(c.id)).length} tools`,
      score: nameScore(c.label, query),
    }))
    .sort(byScoreThen(byName));

  const newsletterRows = newsletters
    .filter((n) => hit(newsletterSearchText(n)))
    .map((n) => ({
      kind: "newsletter", id: n.id, name: n.name, href: `/newsletters/${n.id}`, one: n.one,
      meta: [n.publisher, n.cadence].filter(Boolean).join(" · "),
      score: nameScore(n.name, query),
    }))
    .sort(byScoreThen(byName));

  const eventRows = placed(events, today)
    .filter((e) => hit(eventSearchText(e)))
    .map((e) => {
      const past = e.at.status === "past";
      const when = e.at.mode === "inferred" ? "Date TBC" : e.at.label;
      return {
        kind: "event", id: e.id, name: e.name, href: `/events/${e.id}`, one: e.one,
        /* "Past" leads unless the label already says it ended. */
        meta: [past && !/discontinued|last held/i.test(when) ? `Past, ${when}` : when, placeOf(e)].filter(Boolean).join(" | "),
        status: e.at.status, date: e.at.date || e.at.month || e.at.year || "", past,
        score: nameScore(e.name, query),
      };
    })
    /* Time, not name: upcoming soonest first, then undated, then past
       newest first. What is coming up is what most people search events for,
       and the past ones stay findable below them in the order they ran. */
    .sort(eventTiebreak);

  const postRows = posts
    .filter((p) => hit(searchText(p.title, p.description)))
    .map((p) => ({
      kind: "post", id: p.slug, name: p.title, href: `/blog/${p.slug}`, one: p.description,
      meta: p.date, score: nameScore(p.title, query),
    }))
    .sort(byScoreThen((a, b) => String(b.meta).localeCompare(String(a.meta))));

  const ownerRows = ownersWithPages({ tools, newsletters, events })
    .filter((o) => hit(searchText(o.name, o.notes, o.entries.map((x) => x.name))))
    .map((o) => ({
      kind: "owner", id: o.id, name: o.name, href: `/owners/${o.id}`,
      one: o.entries.map((x) => x.name).join(", "),
      meta: `${o.entries.length} listings`, score: nameScore(o.name, query),
    }))
    .sort(byScoreThen(byName));

  const groups = [
    { kind: "tool", label: "Tools", items: toolRows },
    { kind: "category", label: "Categories", items: categoryRows },
    { kind: "newsletter", label: "Newsletters", items: newsletterRows },
    { kind: "event", label: "Events", items: eventRows },
    { kind: "post", label: "Blog posts", items: postRows },
    { kind: "owner", label: "Owners", items: ownerRows },
  ].filter((g) => g.items.length);

  return { query, groups, total: groups.reduce((n, g) => n + g.items.length, 0) };
}

/** "12 results: 5 tools, 4 events, 3 newsletters." Counts as words a person reads. */
export function summaryLine({ groups, total }) {
  if (!total) return "";
  const parts = groups.map((g) => `${g.items.length} ${g.items.length === 1 ? singular(g.label) : g.label.toLowerCase()}`);
  return `${total} result${total === 1 ? "" : "s"}: ${parts.join(", ")}.`;
}

const SINGULAR = { Tools: "tool", Categories: "category", Newsletters: "newsletter", Events: "event", "Blog posts": "blog post", Owners: "owner" };
const singular = (label) => SINGULAR[label] || label.toLowerCase();
