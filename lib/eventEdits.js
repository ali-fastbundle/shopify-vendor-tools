/*
 * What an event refresh finding (lib/eventRefresh.js) would change in
 * lib/events.js, decided in code (2026-11-06). Pure and client-safe: the
 * Inbox row renders the same table the server commits.
 *
 * A tool finding applies as an override in Redis. An event cannot: half the
 * site reads lib/events.js directly (the sitemap, the counts, llms.txt, the
 * digest), and mergedEvents() overrides only `one`, `url` and `social`. So an
 * event's Apply is a commit to the file on main, by the GitHub path Publish
 * and the caveat editor use (lib/publish.js, editEventInSource), and undoing
 * it is a second commit that writes back what was there.
 *
 * Mapped, field by field:
 *   date-announced, date-moved, next-edition (field startDate)
 *       startDate, endDate (removed for one day), datePrecision "exact",
 *       dateRaw as the day the page states it, and lastHeld set to the
 *       edition that is over when the old date was a real past one.
 *   next-edition (field nextEdition) with a whole day: the same.
 *   place: city and country; country alone.
 *   venue, format: the one field.
 * Not mapped, and said so: a page gone, off the calendar, ended (a discard is
 * a decision, never an apply), a next edition known only to the month.
 *
 * What it never writes: watch, relevance, audience, the name. Those are
 * editorial; a date confirmation that makes the caveat stale goes through the
 * rewrite, which needs a reason for the caveat and logs it (invariant 1).
 */
import { rangeLabel, dayLabel } from "./events";

export const EVENT_APPLIABLE = ["startDate", "endDate", "datePrecision", "dateRaw", "lastHeld", "city", "country", "venue", "format"];
/* The prose an event rewrite may propose. `watch` only with a reason. */
export const EVENT_REWRITABLE = ["one", "focus", "watch"];
export const EVENT_PROTECTED = ["id", "name", "relevance", "audience", "ownership", "organizer", "annual", "discontinued", "launched", "domain", "logo", "notes", "draft", "updated"];

const isDay = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));

/* "2027-09-09" or "2027-09-09 to 2027-09-11", as compare() writes `new`. */
export function parseWhen(v) {
  const m = /^(\d{4}-\d{2}-\d{2})(?:\s+to\s+(\d{4}-\d{2}-\d{2}))?$/.exec(String(v || "").trim());
  if (!m) return null;
  const start = m[1], end = m[2] && m[2] !== m[1] ? m[2] : "";
  if (end && end < start) return null;
  return { start, end };
}

/* The date as a person would write it, for `dateRaw` on an exact date. */
export function whenLabel(start, end) {
  if (!end) return dayLabel(start);
  return rangeLabel(start, end).replace(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/g, (m) => ({
    Jan: "January", Feb: "February", Mar: "March", Apr: "April", May: "May", Jun: "June", Jul: "July",
    Aug: "August", Sep: "September", Oct: "October", Nov: "November", Dec: "December",
  })[m]);
}

const val = (v) => (v === undefined ? null : v);

/**
 * The edit a finding maps to, against the event as the file has it.
 * Returns { state: "appliable", set, rows, notes } or { state: "unmapped", why }.
 * `set` is { field: value }, where null removes the field (endDate on a
 * one-day event). `rows` is what the Inbox shows: field, from, to.
 */
export function eventEdit(f = {}, e = null) {
  if (!e) return { state: "unmapped", why: "The event is no longer in the catalogue." };
  const set = {};
  const notes = [];

  const dates = (when) => {
    set.startDate = when.start;
    set.endDate = when.end || null;
    set.datePrecision = "exact";
    set.dateRaw = whenLabel(when.start, when.end);
    /* The edition that is over becomes lastHeld, so the record keeps it. */
    if (e.datePrecision === "exact" && isDay(e.startDate) && e.startDate < when.start && f.kind === "next-edition") {
      set.lastHeld = e.startDate;
      if (/\b(19|20)\d{2}\b/.test(e.name || "") && !String(e.name).includes(when.start.slice(0, 4))) {
        notes.push(`The name "${e.name}" carries a year. Change it by hand if the organizer renamed it.`);
      }
    } else if (isDay(e.lastHeld) && e.lastHeld >= when.start) {
      notes.push("lastHeld is on or after the new date. Check it by hand.");
    }
  };

  switch (f.kind) {
    case "date-announced":
    case "date-moved":
    case "next-edition": {
      const when = parseWhen(f.new);
      if (!when) return { state: "unmapped", why: f.field === "nextEdition" ? "The page gives the next edition without a whole day, so there is nothing exact to write." : "The new date is not a whole day." };
      dates(when);
      break;
    }
    case "place": {
      if (f.field === "country") { set.country = f.new; break; }
      const parts = String(f.new || "").split(",").map((s) => s.trim()).filter(Boolean);
      if (parts.length === 1) set.city = parts[0];
      else if (parts.length === 2) { set.city = parts[0]; set.country = parts[1]; }
      else return { state: "unmapped", why: `"${f.new}" does not split cleanly into a city and a country.` };
      notes.push("Coordinates for the old city stop applying. Run scripts/geocode-events.mjs after it deploys.");
      break;
    }
    case "venue": set.venue = f.new; break;
    case "format": {
      if (!["online", "hybrid", "in-person"].includes(f.new)) return { state: "unmapped", why: `"${f.new}" is not a format the catalogue stores.` };
      set.format = f.new;
      break;
    }
    case "ended": return { state: "unmapped", why: "Cancelled or ended is a decision about the listing: discard it or mark it discontinued by hand." };
    case "page-gone": return { state: "unmapped", why: "A dead page needs a new URL or a decision, which is a hand edit." };
    case "off-calendar": return { state: "unmapped", why: "Leaving the organizer's calendar is a reason to look, not a value to write." };
    default: return { state: "unmapped", why: "No field this kind of finding maps to." };
  }

  /* Only what actually changes. */
  const rows = [];
  for (const [field, to] of Object.entries(set)) {
    const from = val(e[field]);
    if ((from ?? "") === (to ?? "")) { delete set[field]; continue; }
    rows.push({ field, from: from ?? "", to: to ?? "" });
  }
  if (!rows.length) return { state: "unmapped", why: "The catalogue already says this." };
  if (/\b(unconfirmed|not confirmed|not announced|no date)\b/i.test(e.watch || "") && (set.startDate || set.datePrecision)) {
    notes.push("The caveat still talks about the date. Rewrite with AI proposes a new one, which needs a reason.");
  }
  return { state: "appliable", set, rows, notes };
}

/** The values the page saw for each field it is about to change. */
export const expectOf = (set, e) => Object.fromEntries(Object.keys(set).map((k) => [k, val(e[k])]));
