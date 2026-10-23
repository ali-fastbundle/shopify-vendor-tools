/*
 * The monthly events digest, in two forms, built from one list.
 *
 *   for the editor     every event starting this month, by date, each with its
 *                      city and country and whether the date is confirmed, a
 *                      month only, or inferred from the last edition. Then,
 *                      apart, the events with no date that have historically
 *                      been held in this month: what to chase. Sent to
 *                      ADMIN_EMAILS through sendEvent ("events_month"), and
 *                      not at all when nothing starts this month.
 *   for subscribers    the same month, filtered to the region they chose when
 *                      they signed up. It is a followable item
 *                      ("events-monthly:<region>", lib/follows.js), so it rides
 *                      the daily run in lib/notify.js: double opt-in, a stop
 *                      link, and one email a day with whatever else they follow.
 *                      The chase list is the editor's alone.
 *
 * It runs on the 1st. A run missed on the 1st (a cron that did not fire) is
 * made up on the 2nd or 3rd, and never later: a "this month" email on the 20th
 * is not the same email. Each form records the month it last went out, so a
 * second run that day sends nothing.
 */
import { read, write, KEYS } from "./store";
import { mergedEvents } from "./listings";
import { placed, monthLabel, rangeLabel, todayISO } from "./events";
import { sendEvent } from "./mail";
import { inRegion } from "./eventRegions";

const CATCH_UP_DAYS = 3;
const CHASE_WITHIN_YEARS = 2;

export const isDigestDay = (today) => Number(String(today).slice(8, 10)) <= CATCH_UP_DAYS;

const place = (e) => [e.city, e.country].filter((x) => x && !/^n\/a$/i.test(x)).join(", ");

/* How sure the date is, in the words the email uses. */
export function certainty(at) {
  if (at.mode === "exact") return "confirmed";
  if (at.mode === "approx") return "month announced, day not";
  if (at.mode === "inferred") return "not confirmed, inferred from the last edition";
  return "";
}

/**
 * Events starting in `ym`, and the ones to chase. Pure: `events` are catalogue
 * entries, placed as of the 1st of the month.
 */
export function monthDigest(events = [], ym) {
  const first = `${ym}-01`;
  const all = placed(events, first);
  const starting = all
    .filter((e) => !e.at.discontinued && e.at.month === ym && ["exact", "approx", "inferred"].includes(e.at.mode))
    .sort((a, b) => (a.at.date < b.at.date ? -1 : a.at.date > b.at.date ? 1 : a.name.localeCompare(b.name)))
    .map((e) => ({
      id: e.id, name: e.name, place: place(e), city: e.city || "", country: e.country || "",
      lat: e.lat, lng: e.lng, venue: e.venue || "", format: e.format || "",
      when: e.at.mode === "exact" ? rangeLabel(e.at.date, e.at.end) : e.at.mode === "approx" ? (e.at.label || monthLabel(ym)) : e.at.date ? rangeLabel(e.at.date, e.at.date) : "",
      mode: e.at.mode, certainty: certainty(e.at), url: `/events/${e.id}`,
    }));

  /* No date now, but the last known edition fell in this calendar month. Not
     discontinued, and recent enough that the series may still be running. */
  const mm = ym.slice(5, 7);
  const year = Number(ym.slice(0, 4));
  const chase = all
    .filter((e) => !e.at.discontinued && !starting.some((s) => s.id === e.id))
    .map((e) => {
      const last = e.at.mode === "unscheduled" ? e.lastHeld || ""
        : e.at.status === "past" && e.at.mode === "exact" ? e.at.date : "";
      return { e, last };
    })
    .filter(({ last }) => /^\d{4}-\d{2}-\d{2}$/.test(last) && last.slice(5, 7) === mm
      && Number(last.slice(0, 4)) < year && year - Number(last.slice(0, 4)) <= CHASE_WITHIN_YEARS)
    .sort((a, b) => a.e.name.localeCompare(b.e.name))
    .map(({ e, last }) => ({ id: e.id, name: e.name, place: place(e), lastHeld: last, url: `/events/${e.id}`, source: e.url || "" }));

  return { month: ym, label: monthLabel(ym), starting, chase };
}

/** The subscriber's list for one region. Online events are in every region. */
export const forRegion = (digest, region) => digest.starting.filter((e) => inRegion(e, region));

/** The editor's email, once a month, and only when something starts. */
export async function sendAdminDigest({ today = todayISO(), origin = "", events } = {}) {
  if (!isDigestDay(today)) return { sent: false, why: "not the start of a month" };
  const ym = today.slice(0, 7);
  const state = (await read(KEYS.eventDigest, {})) || {};
  if (state.admin === ym) return { sent: false, why: "already sent this month" };
  const digest = monthDigest(events || await mergedEvents(), ym);
  if (!digest.starting.length) {
    await write(KEYS.eventDigest, { ...state, admin: ym });
    return { sent: false, why: "no events start this month" };
  }
  const result = await sendEvent("events_month", { ...digest, origin });
  if (result.ok && result.sends.length) await write(KEYS.eventDigest, { ...state, admin: ym });
  return { sent: result.ok && result.sends.length > 0, starting: digest.starting.length, chase: digest.chase.length };
}
