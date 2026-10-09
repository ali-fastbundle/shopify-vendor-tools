/*
 * The daily run behind following: work out what happened to the things people
 * follow, then send each person one digest.
 *
 * Two phases with a queue between them, so neither can lose the other's work:
 *
 *   detect()  compares today with what the last run saw (svt:follows:state)
 *             and appends what is new to each follower's pending digest
 *             (svt:follows:queue). State is advanced only for what was read,
 *             so a feed that failed today is simply looked at again tomorrow.
 *   send()    drains the queue, one sendEvent("follow_digest") per person.
 *             A failed send leaves that person's items queued for tomorrow;
 *             a run cut short by the time budget leaves the rest queued.
 *
 * One email per person per day, however many things they follow and however
 * busy the day: six follows and a busy day is one email with six lines, not
 * six emails.
 *
 * What counts as news, by kind:
 *
 *   newsletter, with `rss`   a new issue: title and link, never the body.
 *   newsletter, any          the listing changed: an editor published an entry
 *                            about it to /changes, or its public text changed.
 *                            For a newsletter with no feed, this is all there
 *                            is, and the listing says so.
 *   event                    dates confirmed: it was unknown, approximate or
 *                            inferred, and is now an exact date in the
 *                            catalogue. And approaching: 30 and 7 days out.
 *
 * Dates confirmed is read off the catalogue, never off the monitor or a model.
 * The date in lib/events.js is set by an editor checking the organiser's site,
 * and that is the only thing worth emailing people about (invariant 20: a
 * model is never the last word, and an email cannot be taken back).
 *
 * The first time anything is seen is a baseline, not news. A newly added feed
 * does not mail its last twenty issues, and a newly added event does not
 * announce that its dates were "just" confirmed.
 */
import { createHash } from "crypto";
import { read, write, KEYS } from "./store";
import { mergedNewsletters, mergedEvents } from "./listings";
import { placed, todayISO } from "./events";
import { getFeed } from "./feed";
import { fetchFeed as realFetchFeed, newSince, rememberFeed } from "./feeds";
import { getFollows, followersByItem } from "./follows";
import { sendEvent } from "./mail";

export const MILESTONES = [30, 7];

/* The parts of a newsletter listing a follower would call "it changed". Not
   `updated` or `issueCount`, which move whenever an editor rechecks a count
   and would turn every recheck into an email. */
const LISTING_FIELDS = [
  ["one", "summary"], ["note", "description"], ["watch", "caveat"],
  ["cadence", "publishing schedule"], ["url", "link"], ["author", "author"], ["publisher", "publisher"],
];
const hash = (v) => createHash("sha1").update(JSON.stringify(v ?? "")).digest("base64url").slice(0, 12);

const daysUntil = (from, to) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

const place = (e) => [e.city, e.country].filter((x) => x && !/^n\/a$/i.test(x)).join(", ");

/** Days-out milestone due today for an event, or null. Pure; tested directly. */
export function dueMilestone(days, sent = []) {
  if (days < 0) return null;
  for (const m of [...MILESTONES].sort((a, b) => a - b)) {
    if (days <= m && !sent.includes(m)) return m;
  }
  return null;
}

export async function detect({ fetchFeed = realFetchFeed, today = todayISO(), now = new Date().toISOString() } = {}) {
  const [state0, queue, follows, newsletters, events, feedRows] = await Promise.all([
    read(KEYS.followState, {}), read(KEYS.followQueue, {}), getFollows(),
    mergedNewsletters(), mergedEvents(), getFeed(),
  ]);
  const state = { feeds: {}, listings: {}, events: {}, reminded: {}, feedSeenAt: "", ...(state0 || {}) };
  const followers = followersByItem(follows);
  const found = [];
  const errors = [];
  const add = (item) => found.push(item);

  /* ---- newsletters ---- */
  for (const n of newsletters) {
    const watched = (followers[n.id] || []).length > 0;

    // New issues. Only fetched when somebody follows it: there is no reason to
    // poll a publisher's feed daily on behalf of nobody.
    if (n.rss && watched) {
      try {
        const items = await fetchFeed(n.rss);
        const prev = state.feeds[n.id] || null;
        for (const i of newSince(items, prev)) {
          add({ id: n.id, kind: "issue", key: `issue:${n.id}:${i.key}`, name: n.name, title: i.title || "New issue", url: i.link || n.url });
        }
        if (items.length) state.feeds[n.id] = rememberFeed(items, prev);
      } catch (e) {
        errors.push(`${n.id}: ${e.message}`);
      }
    }

    // The listing changed. Field by field, so the line can say what.
    const now_ = Object.fromEntries(LISTING_FIELDS.map(([f]) => [f, hash(n[f])]));
    const before = state.listings[n.id];
    if (before && watched) {
      const changed = LISTING_FIELDS.filter(([f]) => before[f] !== now_[f]).map(([, label]) => label);
      const entry = feedRows.find((r) => r.toolId === n.id && r.at > (state.feedSeenAt || now));
      if (entry) {
        add({ id: n.id, kind: "news", key: `news:${entry.id}`, name: n.name, title: entry.headline, url: `/changes#${entry.id}` });
      } else if (changed.length) {
        add({ id: n.id, kind: "listing", key: `listing:${n.id}:${hash(now_)}`, name: n.name, title: changed.join(", "), url: `/newsletters/${n.id}` });
      }
    }
    state.listings[n.id] = now_;
  }

  /* ---- events ---- */
  for (const e of placed(events, today)) {
    const cur = { mode: e.at.mode, date: e.at.date || "" };
    const prev = state.events[e.id];
    state.events[e.id] = cur;
    if (!(followers[e.id] || []).length) continue;
    if (e.at.status === "past" || cur.mode !== "exact") continue;

    const days = daysUntil(today, cur.date);
    const r = state.reminded[e.id] && state.reminded[e.id].date === cur.date
      ? state.reminded[e.id] : { date: cur.date, sent: [] };

    if (prev && prev.mode !== "exact") {
      add({ id: e.id, kind: "dates", key: `dates:${e.id}:${cur.date}`, name: e.name, title: e.at.label, place: place(e), days, url: `/events/${e.id}` });
      // The announcement already says how far off it is; do not send a
      // reminder for a window it has already landed inside.
      for (const m of MILESTONES) if (days <= m && !r.sent.includes(m)) r.sent.push(m);
    } else {
      const m = dueMilestone(days, r.sent);
      if (m !== null) {
        add({ id: e.id, kind: "soon", key: `soon:${e.id}:${cur.date}:${m}`, name: e.name, title: e.at.label, place: place(e), days, url: `/events/${e.id}` });
        // Anything wider than the window it is in is spent too: an event first
        // followed 5 days out gets the 7-day line and never a "30 days" one.
        for (const k of MILESTONES) if (k >= m && !r.sent.includes(k)) r.sent.push(k);
      }
    }
    state.reminded[e.id] = r;
  }

  /* ---- queue per follower ---- */
  let queued = 0;
  for (const item of found) {
    for (const email of followers[item.id] || []) {
      const list = queue[email] || (queue[email] = { items: [], attempts: 0 });
      if (list.items.some((x) => x.key === item.key)) continue;
      list.items.push(item);
      queued++;
    }
  }

  state.feedSeenAt = now;
  await write(KEYS.followState, state);
  await write(KEYS.followQueue, queue);
  return { found: found.length, queued, errors };
}

const MAX_ATTEMPTS = 5;

export async function send({ origin, budgetMs = 120_000 } = {}) {
  const started = Date.now();
  const [queue, follows] = await Promise.all([read(KEYS.followQueue, {}), getFollows()]);
  let sent = 0, failed = 0, left = 0;

  for (const email of Object.keys(queue)) {
    if (Date.now() - started > budgetMs) { left++; continue; }
    // Only what they still follow: an unsubscribe after the item was queued wins.
    const still = (follows[email] && follows[email].items) || {};
    const items = (queue[email].items || []).filter((i) => still[i.id]);
    if (!items.length) { delete queue[email]; continue; }

    const result = await sendEvent("follow_digest", { email, items, origin });
    if (result.ok && result.sends.length) {
      delete queue[email];
      sent++;
    } else {
      queue[email] = { items, attempts: (queue[email].attempts || 0) + 1 };
      // A digest that has failed for five days is not going to arrive; the
      // mail log has every attempt, so dropping it loses no evidence.
      if (queue[email].attempts >= MAX_ATTEMPTS) delete queue[email];
      failed++;
    }
  }
  await write(KEYS.followQueue, queue);
  return { sent, failed, left };
}
