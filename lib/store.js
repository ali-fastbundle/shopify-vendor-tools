/*
 * Storage layer.
 *
 * Uses Upstash Redis when UPSTASH_REDIS_REST_URL / _TOKEN are set (that is what
 * Vercel provisions for a Redis integration). Falls back to an in-process map so
 * `npm run dev` works with no env at all — that fallback is NOT durable and
 * resets on every cold start, so set the env vars before you share the URL.
 */

const memory = new Map();

/*
 * Vercel injects different names depending on which Marketplace provider you
 * pick. Upstash gives UPSTASH_REDIS_REST_*, the KV-compatible ones give
 * KV_REST_API_*. Accept either so you are not locked to one provider.
 */
const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
export const usingRedis = Boolean(url && token);

async function redis(command) {
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Redis ${res.status}: ${await res.text()}`);
  const { result } = await res.json();
  return result;
}

export async function read(key, fallback) {
  try {
    if (!usingRedis) return memory.has(key) ? memory.get(key) : fallback;
    const raw = await redis(["GET", key]);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.error("store.read", key, e.message);
    return fallback;
  }
}

export async function write(key, value) {
  if (!usingRedis) { memory.set(key, value); return value; }
  await redis(["SET", key, JSON.stringify(value)]);
  return value;
}

export const KEYS = {
  votes: "svt:votes",
  reviews: "svt:reviews",
  suggestions: "svt:suggestions",
  subscribers: "svt:subscribers",
};
