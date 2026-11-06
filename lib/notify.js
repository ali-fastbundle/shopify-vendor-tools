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
 *                            For an article feed (`feedKind: "articles"`,
 *                            a news site's every story), one line a day
 *                            with how many went up and a link to them.
 *   newsletter, any          the listing changed: an editor published an entry
 *                            about it to /changes, or its public text changed.
 *                            For a newsletter with no feed, this is all there
 *                            is, and the listing says so.
 *   podcast, with `rss`      a new episode: title and link, never the
 *                            description. A show marked discontinued is not
 *                            followable and is not read.
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
import { mergedNewsletters, mergedEvents, mergedPodcasts } from "./listings";
import { placed, todayISO } from "./events";
import { getFeed } from "./feed";
import { fetchFeed as realFetchFeed, newSince, rememberFeed, classifyFeed } from "./feeds";
import { getFollows, followersByItem } from "./follows";
import { sendEvent } from "./mail";
import { monthDigest, forRegion, isDigestDay } from "./eventDigest";
import { MONTHLY_PREFIX } from "./follows";

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
  const [state0, queue, follows, newsletters, events, feedRows, podcasts] = await Promise.all([
    read(KEYS.followState, {}), read(KEYS.followQueue, {}), getFollows(),
    mergedNewsletters(), mergedEvents(), getFeed(), mergedPodcasts(),
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
        /* An article feed is one line a day with the count, never one line
           per article (2026-11-04). A feed declared as issues that turns out
           to carry more than one entry a day is treated the same way and
           logged, because no newsletter issues more often than daily: the
           declaration is wrong or the feed changed under it. */
        const measured = classifyFeed(items);
        const articles = n.feedKind === "articles" || (measured.perWeek !== null && measured.perWeek > 7);
        if (articles && n.feedKind !== "articles") console.warn(`[follow] ${n.id} is declared an issue feed but carries ${measured.perWeek} entries a week; sent as a daily count`);
        if (articles) {
          const fresh = newSince(items, prev, { limit: 500 });
          if (fresh.length) {
            add({ id: n.id, kind: "articles", key: `articles:${n.id}:${today}`, name: n.name, count: fresh.length,
              title: `${fresh.length} article${fresh.length === 1 ? "" : "s"}`, since: today, url: n.articlesUrl || n.url });
          }
        } else {
          for (const i of newSince(items, prev)) {
            add({ id: n.id, kind: "issue", noun: n.feedItem || "issue", key: `issue:${n.id}:${i.key}`, name: n.name, title: i.title || `New ${n.feedItem || "issue"}`, url: i.link || n.url });
          }
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

  /* ---- podcasts ----
     New episodes only, the same way as a newsletter's issues: fetched only
     when somebody follows the show, the first read is a baseline, at most
     three a run. State shares `feeds`, keyed `podcast:<id>` so an id can never
     collide with a newsletter's. */
  for (const p of podcasts) {
    if (!p.rss || p.discontinued || !(followers[p.id] || []).length) continue;
    const k = `podcast:${p.id}`;
    try {
      const items = await fetchFeed(p.rss);
      const prev = state.feeds[k] || null;
      for (const i of newSince(items, prev)) {
        add({ id: p.id, kind: "episode", key: `episode:${p.id}:${i.key}`, name: p.name, title: i.title || "New episode", url: i.link || p.url });
      }
      if (items.length) state.feeds[k] = rememberFeed(items, prev);
    } catch (e) {
      errors.push(`${p.id}: ${e.message}`);
    }
  }

  /* ---- events ---- */
  for (const e of placed(events, today)) {
    const cur = { mode: e.at.mode, date: e.at.date || "" };
    const prev = state.events[e.id];
    state.events[e.id] = cur;
    if (!(followers[e.id] || []).length) continue;

    /* A line on What's moving about this event (an applied or published event
       refresh finding, 2026-11-06). It carries the news in the editor's
       words, so a dates line for the same event this run is not added too. */
    const news = feedRows.filter((r) => !r.deletedAt && r.href === `/events/${e.id}` && r.at > (state.feedSeenAt || now));
    for (const n of news) add({ id: e.id, kind: "news", key: `news:${n.id}`, name: e.name, title: n.headline, url: `/changes#${n.id}` });

    if (e.at.status === "past" || cur.mode !== "exact") continue;

    const days = daysUntil(today, cur.date);
    const r = state.reminded[e.id] && state.reminded[e.id].date === cur.date
      ? state.reminded[e.id] : { date: cur.date, sent: [] };

    /* Confirmed, or a confirmed date that moved (a next edition replacing
       the last one, or a date-moved finding applied). */
    if (prev && (prev.mode !== "exact" || (prev.date && prev.date !== cur.date))) {
      if (!news.length) add({ id: e.id, kind: "dates", key: `dates:${e.id}:${cur.date}`, name: e.name, title: e.at.label, place: place(e), days, url: `/events/${e.id}` });
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

  /* ---- the monthly events digest (lib/eventDigest.js) ----
     Once a month, on the 1st (or the next two days if a run was missed), one
     item per region somebody follows. A region with nothing starting gets no
     item, so its subscribers get no email. */
  const ym = today.slice(0, 7);
  if (isDigestDay(today) && state.monthly !== ym) {
    const digest = monthDigest(events, ym);
    const regions = Object.keys(followers).filter((id) => id.startsWith(MONTHLY_PREFIX));
    for (const id of regions) {
      const list = forRegion(digest, id.slice(MONTHLY_PREFIX.length));
      if (!list.length) continue;
      add({ id, kind: "month", key: `month:${id}:${ym}`, name: "the monthly events digest", title: digest.label, url: "/events", events: list });
    }
    state.monthly = ym;
  }

  /* ---- queue per follower ---- */
  let queued = 0;
  for (const item of found) {
    for (const email of followers[item.id] || []) {
      const list = queue[email] || (queue[email] = { items: [], attempts: 0 });
      list.items = foldArticles([...list.items, item]);
      queued++;
    }
  }

  state.feedSeenAt = now;
  await write(KEYS.followState, state);
  await write(KEYS.followQueue, queue);
  return { found: found.length, queued, errors };
}

/*
 * Never more than one line per publication's articles in a digest, and no
 * item twice. A second run on the same day, or days of a digest that failed
 * to send, add their counts to the line already queued, which keeps the
 * earliest day as `since`. Pure; tested directly.
 */
export function foldArticles(items = []) {
  const out = [];
  for (const it of items) {
    if (it.kind === "articles") {
      const at = out.findIndex((x) => x.kind === "articles" && x.id === it.id);
      if (at >= 0) {
        const count = (out[at].count || 0) + (it.count || 0);
        const since = [out[at].since, it.since].filter(Boolean).sort()[0] || it.since;
        out[at] = { ...out[at], count, since, title: `${count} article${count === 1 ? "" : "s"}` };
        continue;
      }
    } else if (out.some((x) => x.key === it.key)) continue;
    out.push(it);
  }
  return out;
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
