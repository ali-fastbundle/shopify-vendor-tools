/*
 * Claims and vendor edits.
 *
 * The base catalogue in lib/tools.js is editorial and never mutated. Vendor
 * edits live in Redis as overrides and are merged on read, so the original is
 * always recoverable and a bad edit is one key delete away.
 *
 * EDITABLE is the whole contract: a vendor controls how their tool is
 * described and priced. They do not control `watch` (the editorial caveat),
 * `cat`, `verified`, `ratings` (the external scores) or reviews. That line is
 * the point of the directory, so it is enforced server-side rather than just
 * hidden in the UI.
 */
import { read, write } from "./store";
import { TOOLS, SOCIAL_KEYS, socialLabel } from "./tools";
import { catalogueTools } from "./entries";

export const EDITABLE = ["one", "note", "price", "free", "url", "domain", "social"];
const KEY_OVERRIDES = "svt:overrides";
const KEY_CLAIMS = "svt:claims";

export const VERIFY_PREFIX = "svt-verify=";

const clean = (s, max) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, max);

const httpsUrl = (s) => {
  const v = clean(s, 300);
  if (!v) return "";
  return /^https?:\/\/[^\s]+\.[^\s]+$/.test(v) ? v : null;
};

export async function getOverrides() { return read(KEY_OVERRIDES, {}); }
export async function getClaims() { return read(KEY_CLAIMS, {}); }

/**
 * Base catalogue with approved vendor edits merged over the top.
 *
 * "Base catalogue" is now two things: lib/tools.js, and the entries published
 * from the admin queue, which live in Redis because a Vercel filesystem is
 * read only. `catalogueTools()` joins them with the file winning any id
 * collision. Everything below this line is unchanged and does not care which
 * half an entry came from, including the protected-field restatement, so a
 * vendor cannot edit the `watch` on an AI-drafted entry either.
 */
export async function mergedTools() {
  const [base, overrides, claims] = await Promise.all([catalogueTools(), getOverrides(), getClaims()]);
  return base.map((t) => {
    const o = overrides[t.id];
    const c = claims[t.id];
    const owned = c && c.status === "verified";
    if (!o) return owned ? { ...t, claimed: true } : t;
    return {
      ...t,
      ...o,
      social: { ...(t.social || {}), ...(o.social || {}) },
      claimed: Boolean(owned),
      editedAt: o.editedAt || null,
      // never overridable, restated so a malformed key cannot leak through
      watch: t.watch, cat: t.cat, verified: t.verified, id: t.id, name: t.name,
      ratings: t.ratings, updated: t.updated,
    };
  });
}

/** Strip an incoming edit down to the fields a vendor is allowed to set. */
export function sanitiseEdit(input) {
  const out = {};
  if ("one" in input) out.one = clean(input.one, 140);
  if ("note" in input) out.note = clean(input.note, 1200);
  if ("price" in input) out.price = clean(input.price, 60);
  if ("free" in input) out.free = Boolean(input.free);
  if ("domain" in input) out.domain = clean(input.domain, 100).replace(/^https?:\/\//, "").replace(/\/.*$/, "");

  if ("url" in input) {
    const u = httpsUrl(input.url);
    if (u === null) return { error: "That site URL does not look right." };
    out.url = u;
  }
  if ("social" in input && input.social) {
    const s = {};
    for (const k of SOCIAL_KEYS) {
      if (!(k in input.social)) continue;
      const u = httpsUrl(input.social[k]);
      if (u === null) return { error: `That ${socialLabel(k)} URL does not look right.` };
      if (u) s[k] = u;
    }
    out.social = s;
  }
  if (!Object.keys(out).length) return { error: "Nothing to save." };
  return { edit: out };
}

export async function saveEdit(toolId, edit, email) {
  const overrides = await getOverrides();
  overrides[toolId] = {
    ...(overrides[toolId] || {}),
    ...edit,
    social: { ...((overrides[toolId] || {}).social || {}), ...(edit.social || {}) },
    editedAt: new Date().toISOString().slice(0, 10),
    editedBy: email,
  };
  await write(KEY_OVERRIDES, overrides);
  return overrides[toolId];
}

export async function startClaim(toolId, email) {
  const claims = await getClaims();
  const existing = claims[toolId];
  if (existing && existing.status === "verified" && existing.email !== email) {
    return { error: "This listing has already been claimed." };
  }
  const token = existing?.token || Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  claims[toolId] = {
    email, token,
    status: existing?.status === "verified" ? "verified" : "pending",
    startedAt: existing?.startedAt || new Date().toISOString().slice(0, 10),
  };
  await write(KEY_CLAIMS, claims);
  return { claim: claims[toolId] };
}

export async function markVerified(toolId, email, method) {
  const claims = await getClaims();
  claims[toolId] = {
    ...(claims[toolId] || {}),
    email,
    status: "verified",
    method,
    verifiedAt: new Date().toISOString().slice(0, 10),
  };
  await write(KEY_CLAIMS, claims);
  return claims[toolId];
}

/*
 * Admin-only. Drops the claim, and reverts the listing to the editorial
 * original only when asked to.
 *
 * Taking away a vendor's access and un-publishing what they already wrote are
 * two different decisions: a claim revoked for a transfer of ownership should
 * keep the copy, one revoked for abuse should not. The claim and the override
 * are separate keys, so the caller states which it means rather than inheriting
 * whichever the implementation happened to pick.
 */
export async function revokeClaim(toolId, { revertContent = false } = {}) {
  const claims = await getClaims();
  delete claims[toolId];
  await write(KEY_CLAIMS, claims);

  let reverted = false;
  if (revertContent) {
    const overrides = await getOverrides();
    if (overrides[toolId]) {
      delete overrides[toolId];
      await write(KEY_OVERRIDES, overrides);
      reverted = true;
    }
  }
  return { claims, reverted };
}

export async function ownsListing(toolId, email) {
  const claims = await getClaims();
  const c = claims[toolId];
  return Boolean(c && c.status === "verified" && c.email === email);
}

/**
 * Domain control check. Looks for `svt-verify=TOKEN` in either
 * https://domain/.well-known/svt-verify.txt or the homepage HTML, so a vendor
 * can prove it with a static file or a meta tag, whichever their stack allows.
 */
export async function checkDomain(domain, token) {
  const targets = [
    `https://${domain}/.well-known/svt-verify.txt`,
    `https://${domain}/`,
  ];
  for (const url of targets) {
    try {
      const res = await fetch(url, {
        redirect: "follow",
        headers: { "user-agent": "svt-verifier/1.0" },
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      });
      if (!res.ok) continue;
      const body = (await res.text()).slice(0, 200_000);
      if (body.includes(VERIFY_PREFIX + token)) return { ok: true, via: url };
    } catch { /* try the next target */ }
  }
  return { ok: false };
}
