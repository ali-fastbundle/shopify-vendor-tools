/*
 * Deliberately simple: a per-IP sliding window held in Upstash (or memory).
 * Enough to stop casual spam on a public directory. Not a security boundary.
 */
import { read, write } from "./store";

export function ipOf(request) {
  const fwd = request.headers.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0] : request.headers.get("x-real-ip") || "unknown").trim();
}

export async function allow(bucket, ip, limit, windowMs) {
  const key = `svt:rl:${bucket}:${ip}`;
  const now = Date.now();
  const hits = (await read(key, [])).filter((t) => now - t < windowMs);
  if (hits.length >= limit) return false;
  hits.push(now);
  await write(key, hits);
  return true;
}
