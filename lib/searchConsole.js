/*
 * The Search Console pull (2026-11-06): queries, impressions, clicks and
 * average position for the site, weekly, into svt:searchqueries.
 *
 * Configured by three variables, all server-side:
 *   GSC_CLIENT_EMAIL   a Google service account's email
 *   GSC_PRIVATE_KEY    its private key (PEM; "\n" escapes are accepted)
 *   GSC_SITE           the property as Search Console names it, such as
 *                      "sc-domain:watchfor.tools" or "https://watchfor.tools/"
 * The service account must be added as a user on that property. Without the
 * three, nothing is fetched and the calendar says so. No library: the token
 * is a JWT signed with node's crypto and exchanged at Google's token endpoint.
 *
 * The range is the 28 days ending three days ago, because Search Console's
 * recent days are incomplete. What is stored is the site's own query data,
 * which is about pages, not people: no visitor data is in it.
 *
 *   svt:searchqueries = { fetchedAt, site, startDate, endDate, rows: [...],
 *                         totals, history: [{ fetchedAt, startDate, endDate,
 *                         clicks, impressions, queries }], error?,
 *                         proposedQueries: [] }
 */
import { createSign } from "crypto";
import { read, write } from "./store";

export const SEARCH_KEY = "svt:searchqueries";

const env = () => ({
  email: (process.env.GSC_CLIENT_EMAIL || "").trim(),
  key: (process.env.GSC_PRIVATE_KEY || "").replace(/\\n/g, "\n").trim(),
  site: (process.env.GSC_SITE || "").trim(),
});
export const searchConfigured = () => { const e = env(); return Boolean(e.email && e.key && e.site); };

const b64 = (x) => Buffer.from(typeof x === "string" ? x : JSON.stringify(x)).toString("base64url");

async function token({ email, key }) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: "RS256", typ: "JWT" });
  const claim = b64({ iss: email, scope: "https://www.googleapis.com/auth/webmasters.readonly", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 });
  const sig = createSign("RSA-SHA256").update(`${head}.${claim}`).sign(key).toString("base64url");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${head}.${claim}.${sig}` }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) throw new Error(`Google token: ${res.status} ${body.error_description || body.error || ""}`.trim());
  return body.access_token;
}

const day = (d) => d.toISOString().slice(0, 10);
export function rangeFor(now = new Date()) {
  const end = new Date(now); end.setUTCDate(end.getUTCDate() - 3);
  const start = new Date(end); start.setUTCDate(start.getUTCDate() - 27);
  return { startDate: day(start), endDate: day(end) };
}

export async function getSearchData() {
  const s = await read(SEARCH_KEY, null);
  return s && typeof s === "object" ? s : null;
}

/** Pull the last 28 days and store them. Never throws; a failure is stored and shown. */
export async function pullSearchConsole({ now = new Date() } = {}) {
  const e = env();
  const prev = (await getSearchData()) || {};
  if (!searchConfigured()) return { error: "Search Console is not configured: set GSC_CLIENT_EMAIL, GSC_PRIVATE_KEY and GSC_SITE." };
  const { startDate, endDate } = rangeFor(now);
  try {
    const access = await token(e);
    const res = await fetch(`https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(e.site)}/searchAnalytics/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
      body: JSON.stringify({ startDate, endDate, dimensions: ["query", "page"], rowLimit: 5000 }),
      signal: AbortSignal.timeout(30_000),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Search Console: ${res.status} ${body.error?.message || ""}`.trim());
    const rows = (body.rows || []).map((r) => ({
      query: String(r.keys?.[0] || "").slice(0, 200), page: String(r.keys?.[1] || "").slice(0, 300),
      clicks: Number(r.clicks) || 0, impressions: Number(r.impressions) || 0, position: Math.round((Number(r.position) || 0) * 10) / 10,
    }));
    const totals = {
      clicks: rows.reduce((s, r) => s + r.clicks, 0),
      impressions: rows.reduce((s, r) => s + r.impressions, 0),
      queries: new Set(rows.map((r) => r.query.toLowerCase())).size,
    };
    const fetchedAt = now.toISOString();
    const next = {
      fetchedAt, site: e.site, startDate, endDate, rows, totals,
      history: [{ fetchedAt, startDate, endDate, ...totals }, ...(prev.history || [])].slice(0, 30),
      proposedQueries: prev.proposedQueries || [],
    };
    await write(SEARCH_KEY, next);
    console.log(`[search] ${startDate} to ${endDate}: ${totals.queries} queries, ${totals.impressions} impressions, ${totals.clicks} clicks`);
    return { ok: true, totals };
  } catch (err) {
    const message = String(err?.message || err).slice(0, 300);
    await write(SEARCH_KEY, { ...prev, error: { at: now.toISOString(), message } });
    console.error(`[search] pull failed: ${message}`);
    return { error: message };
  }
}

export async function markProposed(queries = []) {
  const prev = (await getSearchData()) || {};
  await write(SEARCH_KEY, { ...prev, proposedQueries: [...new Set([...(prev.proposedQueries || []), ...queries])].slice(-500) });
}
