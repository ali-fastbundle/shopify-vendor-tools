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
  reports: "svt:reports",
  accounts: "svt:accounts",
  stats: "svt:stats",
  queries: "svt:stats:queries",
};

/*
 * Several commands, one round trip. Upstash exposes this at /pipeline; the
 * memory fallback just runs them in order.
 */
async function pipeline(commands) {
  if (!commands.length) return [];
  const res = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Redis pipeline ${res.status}: ${await res.text()}`);
  return res.json();
}

/*
 * Directory counters live in one hash, incremented with HINCRBY rather than
 * read-modify-written, so two instances counting at once cannot lose each
 * other's increments. The whole batch is a single request.
 *
 * Queries are a capped list beside it — a list is the right shape for "the last
 * 50 of something", and LTRIM keeps it that size without a read.
 */
export async function bumpStats(fields = {}, queries = []) {
  const entries = Object.entries(fields).filter(([, n]) => Number.isFinite(n) && n > 0);
  if (!entries.length && !queries.length) return;
  try {
    if (!usingRedis) {
      const stats = memory.get(KEYS.stats) || {};
      for (const [f, n] of entries) stats[f] = (stats[f] || 0) + n;
      memory.set(KEYS.stats, stats);
      if (queries.length) {
        memory.set(KEYS.queries, [...queries.slice().reverse(), ...(memory.get(KEYS.queries) || [])].slice(0, 50));
      }
      return;
    }
    const cmds = entries.map(([f, n]) => ["HINCRBY", KEYS.stats, f, n]);
    if (queries.length) {
      cmds.push(["LPUSH", KEYS.queries, ...queries]);
      cmds.push(["LTRIM", KEYS.queries, 0, 49]);
    }
    await pipeline(cmds);
  } catch (e) {
    console.error("store.bumpStats", e.message);
  }
}

/** Counters and recent queries, shaped for the admin console. */
export async function readStats() {
  try {
    if (!usingRedis) {
      return { fields: memory.get(KEYS.stats) || {}, queries: memory.get(KEYS.queries) || [] };
    }
    const [hash, list] = await pipeline([
      ["HGETALL", KEYS.stats],
      ["LRANGE", KEYS.queries, 0, 49],
    ]);
    // HGETALL comes back as a flat [field, value, field, value, ...] array.
    const flat = hash?.result || [];
    const fields = {};
    for (let i = 0; i < flat.length; i += 2) fields[flat[i]] = Number(flat[i + 1]) || 0;
    return { fields, queries: list?.result || [] };
  } catch (e) {
    console.error("store.readStats", e.message);
    return { fields: {}, queries: [] };
  }
}

