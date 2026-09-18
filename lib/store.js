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
  maillog: "svt:maillog",
  entries: "svt:entries",
  dedupelog: "svt:dedupelog",
  changelog: "svt:changelog",
  /* Dismissals live beside the log rather than in it: the log is a capped
     append-only list and rewriting a row inside it would mean reading and
     rewriting all 500. */
  changesSeen: "svt:changes:seen",
  /* When each admin last opened the inbox, so "since your last visit" means
     something. Per admin, because two editors do not share an attention span. */
  adminSeen: "svt:admin:seen",
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

/*
 * The mail audit trail. A capped list, newest first: LPUSH then LTRIM keeps it
 * at 500 without a read, and without two instances racing to rewrite an array.
 *
 * Every attempt lands here, successful or not. Delivery that fails silently is
 * the failure mode this whole mechanism exists to end, so the log is not a
 * debugging aid to switch on later — it is part of sending.
 */
const MAILLOG_MAX = 500;

export async function pushMailLog(entries = []) {
  const rows = entries.filter(Boolean).map((e) => JSON.stringify(e));
  if (!rows.length) return;
  try {
    if (!usingRedis) {
      memory.set(KEYS.maillog, [...rows.slice().reverse(), ...(memory.get(KEYS.maillog) || [])].slice(0, MAILLOG_MAX));
      return;
    }
    await pipeline([
      ["LPUSH", KEYS.maillog, ...rows],
      ["LTRIM", KEYS.maillog, 0, MAILLOG_MAX - 1],
    ]);
  } catch (e) {
    // Never throws: failing to record a send must not fail the send.
    console.error("store.pushMailLog", e.message);
  }
}

export async function readMailLog(limit = 100) {
  try {
    const raw = !usingRedis
      ? (memory.get(KEYS.maillog) || []).slice(0, limit)
      : (await pipeline([["LRANGE", KEYS.maillog, 0, limit - 1]]))[0]?.result || [];
    return raw.map((r) => { try { return JSON.parse(r); } catch { return null; } }).filter(Boolean);
  } catch (e) {
    console.error("store.readMailLog", e.message);
    return [];
  }
}

/*
 * A capped newest-first list, the same shape as the mail log above and for the
 * same reason: LPUSH then LTRIM keeps it bounded without a read, and without
 * two instances racing to rewrite an array.
 *
 * Used for the suggestion dedup log, where the question is always "why did
 * this get merged into that" and the answer has to survive long enough to be
 * asked. Never throws: failing to record a decision must not fail the request
 * that made it.
 */
export async function pushCapped(key, entries = [], max = 200) {
  const rows = entries.filter(Boolean).map((e) => JSON.stringify(e));
  if (!rows.length) return;
  try {
    if (!usingRedis) {
      memory.set(key, [...rows.slice().reverse(), ...(memory.get(key) || [])].slice(0, max));
      return;
    }
    await pipeline([["LPUSH", key, ...rows], ["LTRIM", key, 0, max - 1]]);
  } catch (e) {
    console.error("store.pushCapped", key, e.message);
  }
}

export async function readCapped(key, limit = 100) {
  try {
    const raw = !usingRedis
      ? (memory.get(key) || []).slice(0, limit)
      : (await pipeline([["LRANGE", key, 0, limit - 1]]))[0]?.result || [];
    return raw.map((r) => { try { return JSON.parse(r); } catch { return null; } }).filter(Boolean);
  } catch (e) {
    console.error("store.readCapped", key, e.message);
    return [];
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

