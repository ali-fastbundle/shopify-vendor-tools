/*
 * Is anything broken?
 *
 * The one question the System tab exists to answer, and it used to take
 * scrolling past five panels to work out. Everything here is cheap: one Redis
 * round trip, one read, and a handful of env lookups. Nothing here reads a
 * secret's value, only whether it is set.
 */

import { ping, read, KEYS, readMailLog } from "./store";
import { getMonitorState } from "./monitor";
import { getDiscovery } from "./discovery";

/*
 * What has to be set for each feature to work, and what breaks without it.
 * The consequence matters more than the name: "RESEND_API_KEY missing" is a
 * fact, "no email is being sent, including sign-in links" is the thing to act
 * on.
 */
const REQUIRED = [
  { key: "AUTH_SECRET", breaks: "Nobody can sign in, so nobody can rate, review or claim." },
  { key: "ADMIN_EMAILS", breaks: "No admin can reach this page." },
  { key: "RESEND_API_KEY", breaks: "No email is sent at all, including sign-in links." },
  { key: "CRON_SECRET", breaks: "The weekly monitor and monthly discovery cannot be invoked." },
];

const EITHER = [
  {
    label: "Redis",
    keys: ["UPSTASH_REDIS_REST_URL", "KV_REST_API_URL"],
    breaks: "Votes, reviews, suggestions and the feed are in memory and vanish on a cold start.",
  },
  {
    label: "A model provider",
    keys: ["ANTHROPIC_API_KEY", "OPENAI_API_KEY"],
    breaks: "The matcher, dedup, research drafts and the monitor all fall back or refuse.",
  },
];

export function envHealth() {
  const missing = [];
  for (const r of REQUIRED) {
    if (!process.env[r.key]) missing.push({ name: r.key, breaks: r.breaks });
  }
  for (const e of EITHER) {
    if (!e.keys.some((k) => process.env[k])) {
      missing.push({ name: e.keys.join(" or "), breaks: e.breaks });
    }
  }
  return missing;
}

/** Everything the status strip shows, in one call. */
export async function health() {
  const [store, monitor, discovery, maillog, cron] = await Promise.all([
    ping(),
    getMonitorState().catch(() => ({})),
    getDiscovery().catch(() => ({})),
    readMailLog(100).catch(() => []),
    read(KEYS.cronLast, {}).catch(() => ({})),
  ]);

  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const mailFailures = maillog.filter((r) => !r.ok && Date.parse(r.at || "") >= dayAgo).length;

  return {
    store,
    env: envHealth(),
    mailFailures,
    mailTotal: maillog.length,
    monitor: {
      at: monitor.lastRunAt || "",
      checked: monitor.lastChecked || 0,
      total: monitor.lastTotal || 0,
      changes: monitor.lastCount || 0,
      stopped: monitor.stopped || "",
    },
    discovery: { at: discovery.at || "", found: (discovery.findings || []).length },
    cron: cron || {},
  };
}
