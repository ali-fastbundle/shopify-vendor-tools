/*
 * Deliberately simple: a per-IP sliding window held in Upstash (or memory).
 * Enough to stop casual spam on a public directory. Not a security boundary.
 *
 * The address is never stored. The key holds a one-way hash of it, and the
 * key expires when its window does, so the longest anything here lives is the
 * longest window (an hour for anything keyed on an IP). /privacy says so; if
 * either of those stops being true, change that page in the same commit.
 */
import { createHash } from "crypto";
import { read, write } from "./store";

export function ipOf(request) {
  const fwd = request.headers.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0] : request.headers.get("x-real-ip") || "unknown").trim();
}

/* Salted with AUTH_SECRET so the hash of a known address cannot be looked up
   from outside. Long enough not to collide across the visitors of one hour. */
const hashOf = (who) =>
  createHash("sha256").update(`${process.env.AUTH_SECRET || ""}:${who}`).digest("base64url").slice(0, 22);

export async function allow(bucket, ip, limit, windowMs) {
  const key = `svt:rl:${bucket}:${hashOf(ip)}`;
  const now = Date.now();
  const hits = (await read(key, [])).filter((t) => now - t < windowMs);
  if (hits.length >= limit) return false;
  hits.push(now);
  await write(key, hits, { ttlMs: windowMs });
  return true;
}
