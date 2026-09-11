/*
 * Subscriber list helpers.
 *
 * The unsubscribe token is an HMAC of the address under AUTH_SECRET, so the
 * link works forever, needs nothing stored alongside it, and cannot be guessed
 * or transferred to another address. It is namespaced with a prefix so a token
 * minted here can never be mistaken for a session or login token signed with
 * the same secret.
 *
 * Without AUTH_SECRET there is no token, no valid link, and validate() refuses
 * everything — callers must not send bulk mail in that state.
 */
import { createHmac, timingSafeEqual } from "crypto";
import { read, write, KEYS } from "./store";

const SECRET = process.env.AUTH_SECRET || "";
export const canUnsubscribe = Boolean(SECRET);

export function unsubToken(email) {
  if (!SECRET) return "";
  return createHmac("sha256", SECRET)
    .update("unsubscribe:" + String(email).trim().toLowerCase())
    .digest("base64url");
}

export function validUnsubToken(email, token) {
  const expected = unsubToken(email);
  if (!expected || !token) return false;
  const a = Buffer.from(String(token));
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const unsubLink = (origin, email) =>
  `${origin}/api/subscribe/remove?email=${encodeURIComponent(email)}&token=${unsubToken(email)}`;

export async function getSubscribers() {
  return read(KEYS.subscribers, []);
}

/** Idempotent. Returns whether this call is what actually added the address. */
export async function addSubscriber(email) {
  const list = await getSubscribers();
  if (list.some((s) => s.email === email)) return { added: false };
  await write(KEYS.subscribers, [...list, { email, date: new Date().toISOString().slice(0, 10) }]);
  return { added: true };
}

/** Idempotent, and says nothing about whether the address was there. */
export async function removeSubscriber(email) {
  const list = await getSubscribers();
  const next = list.filter((s) => s.email !== email);
  if (next.length !== list.length) await write(KEYS.subscribers, next);
  return { removed: next.length !== list.length };
}
