import { getSubscribers, removeSubscriber } from "./subscribers";
import { getFollows, removeFollow } from "./follows";
import { getAccounts } from "./accounts";
import { ALL_NEWSLETTERS } from "./newsletters";
import { ALL_EVENTS } from "./events";

/*
 * Everybody on a list, one row per address, for the People tab and nothing
 * else. Two lists feed it and they are not the same kind of consent:
 *
 * - the site-wide list (svt:subscribers) adds an address on the first request
 *   and never confirms it, so "confirmed" there can only be borrowed from
 *   something else that proved the inbox: a sign-in by magic link, or a
 *   follow, which is stored only after its confirm link is clicked;
 * - follows (svt:follows) are confirmed by construction.
 *
 * Server only. It is rendered into /admin behind the isAdmin check and there
 * is no route that returns it, which is invariant 8 with one door instead of
 * none. Nothing here logs an address.
 */

const nameOf = (() => {
  const names = new Map([...ALL_NEWSLETTERS, ...ALL_EVENTS].map((e) => [e.id, e.name]));
  return (id) => names.get(id) || id;
})();

const earliest = (...ds) => ds.filter(Boolean).sort()[0] || "";

export async function subscriberRows() {
  const [site, follows, accounts] = await Promise.all([getSubscribers(), getFollows(), getAccounts()]);
  const rows = new Map();
  const row = (email) => {
    const k = String(email || "").trim().toLowerCase();
    if (!rows.has(k)) rows.set(k, { email: k, joined: "", site: null, items: [] });
    return rows.get(k);
  };

  for (const s of Array.isArray(site) ? site : []) {
    const r = row(s.email);
    r.site = { since: s.date || "" };
    r.joined = earliest(r.joined, s.date);
  }
  for (const [email, me] of Object.entries(follows || {})) {
    const r = row(email);
    for (const [id, since] of Object.entries(me?.items || {})) {
      r.items.push({ id, name: nameOf(id), since });
      r.joined = earliest(r.joined, since);
    }
    r.joined = earliest(r.joined, me?.since);
  }

  const signedIn = new Set(Object.keys(accounts || {}).map((e) => e.toLowerCase()));
  for (const r of rows.values()) {
    r.items.sort((a, b) => String(b.since).localeCompare(String(a.since)));
    r.confirmed = r.items.length ? "follow" : signedIn.has(r.email) ? "sign-in" : "";
  }
  return [...rows.values()].sort((a, b) => String(b.joined).localeCompare(String(a.joined)) || a.email.localeCompare(b.email));
}

/**
 * Take an address off every list: the site-wide one and every follow. For
 * bounces and for people who ask by replying rather than by the link. Their
 * queued digest lines go with the follows, because the daily send skips
 * anybody who no longer follows the item (lib/notify.js).
 */
export async function removeEverywhere(email) {
  const k = String(email || "").trim().toLowerCase();
  if (!k) return { removed: false };
  const before = await subscriberRows();
  if (!before.some((r) => r.email === k)) return { removed: false };
  await removeSubscriber(k);
  await removeFollow(k, "");
  return { removed: true };
}
