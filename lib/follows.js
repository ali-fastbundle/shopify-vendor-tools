/*
 * Following one newsletter or one event: "tell me when something happens to
 * this", delivered as at most one digest a day.
 *
 * Separate from the site-wide list in lib/subscribers.js, which is one list
 * for one kind of announcement. This is many small lists, keyed by item, and
 * a person can be on any number of them without receiving more than one email
 * a day.
 *
 *   svt:follows   { [email]: { since, items: { [id]: since } } }
 *
 * Confirmed addresses only. Following starts with an email carrying a signed
 * link (mintFollowToken in lib/auth.js), and nothing is written until it is
 * clicked, so an address somebody typed for a stranger never reaches the
 * store. A signed-in person following with their own address skips the email,
 * because signing in already proved they read that inbox.
 *
 * Unsubscribe links are HMACs, like the site-wide list's, but in their own
 * namespace so one can never be replayed as the other. One link stops one
 * item; the link with no item stops everything.
 */
import { createHmac, timingSafeEqual } from "crypto";
import { read, write, KEYS } from "./store";
import { NEWSLETTERS } from "./newsletters";
import { EVENTS } from "./events";

const SECRET = process.env.AUTH_SECRET || "";

/**
 * What can be followed: published newsletters and events, nothing else.
 * `hasFeed` says whether new issues can be seen at all.
 */
export function followable(id) {
  if (!id || typeof id !== "string") return null;
  const n = NEWSLETTERS.find((x) => x.id === id);
  if (n) return { id, kind: "newsletter", name: n.name, path: `/newsletters/${id}`, hasFeed: Boolean(n.rss) };
  const e = EVENTS.find((x) => x.id === id);
  if (e) return { id, kind: "event", name: e.name, path: `/events/${id}`, hasFeed: false };
  return null;
}

export async function getFollows() {
  const f = await read(KEYS.follows, {});
  return f && typeof f === "object" && !Array.isArray(f) ? f : {};
}

/** Idempotent. */
export async function addFollow(email, id) {
  const all = await getFollows();
  const today = new Date().toISOString().slice(0, 10);
  const me = all[email] || { since: today, items: {} };
  if (me.items[id]) return { added: false };
  me.items = { ...me.items, [id]: today };
  await write(KEYS.follows, { ...all, [email]: me });
  return { added: true };
}

/** One item, or every item when `id` is empty. Says nothing about what was there. */
export async function removeFollow(email, id = "") {
  const all = await getFollows();
  const me = all[email];
  if (!me) return;
  if (id) {
    const { [id]: _, ...rest } = me.items || {};
    if (Object.keys(rest).length) all[email] = { ...me, items: rest };
    else delete all[email];
  } else {
    delete all[email];
  }
  await write(KEYS.follows, all);
}

/** `{ [id]: [email, ...] }`, for the daily run. */
export function followersByItem(all) {
  const out = {};
  for (const [email, me] of Object.entries(all || {})) {
    for (const id of Object.keys(me?.items || {})) (out[id] ||= []).push(email);
  }
  return out;
}

export function stopToken(email, id = "") {
  if (!SECRET) return "";
  return createHmac("sha256", SECRET)
    .update(`follow-stop:${String(email).trim().toLowerCase()}:${id}`)
    .digest("base64url");
}

export function validStopToken(email, id, token) {
  const expected = stopToken(email, id);
  if (!expected || !token) return false;
  const a = Buffer.from(String(token)), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const stopLink = (origin, email, id = "") =>
  `${origin}/api/follow/remove?email=${encodeURIComponent(email)}${id ? `&id=${encodeURIComponent(id)}` : ""}&token=${stopToken(email, id)}`;
