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
import { read, write, KEYS } from "./store";
import { TOOLS, SOCIAL_KEYS, socialLabel, isVacuousOwner } from "./tools";
import { catalogueTools } from "./entries";
import { interestCounts } from "./interest";

export const EDITABLE = ["one", "note", "price", "free", "url", "domain", "social"];

/*
 * ------------------------------------------------------------------
 *  Two different whitelists, and the difference matters
 * ------------------------------------------------------------------
 * `EDITABLE` is what a *vendor* may change about their own listing.
 *
 * `APPLIABLE` is what an *admin* may apply in one click from a monitor
 * proposal. It is wider, because the monitor is not an interested party: it
 * read the vendor's own page and noticed the price moved, and an editor is
 * approving that reading. So it adds the facts a vendor should not get to
 * assert about themselves, like who owns them and whether they are winding
 * down.
 *
 * `PROTECTED` is the set neither may touch by any route, ever. `watch` is the
 * reason this directory exists; `cat` decides where a thing sits; `verified`
 * is a claim about our own process; `ratings` are transcribed by hand from a
 * platform we are not allowed to crawl. A monitor that could rewrite a caveat
 * because a vendor stopped mentioning the thing it warns about is the exact
 * failure the whole arrangement exists to prevent, so a proposal touching any
 * of these is shown and never offered as a button.
 *
 * `mergedTools()` restates the protected fields from the base entry after
 * spreading the override, so even a hand-written override key for one of them
 * is ignored. That restatement is the enforcement; this list is the
 * explanation and what the UI reads to decide which affordance to show.
 */
export const APPLIABLE = [
  "price", "free", "one", "note", "url", "domain", "social", "owner", "linked", "suite", "dying",
];

export const PROTECTED = ["watch", "cat", "verified", "ratings", "updated", "id", "name"];

export const fieldKind = (field) =>
  PROTECTED.includes(field) ? "protected"
    : APPLIABLE.includes(field) ? "appliable"
      : "unknown";
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
  const [base, overrides, claims, interest] = await Promise.all([
    catalogueTools(), getOverrides(), getClaims(), interestCounts(),
  ]);
  return base.map((raw) => {
    /*
     * How many people have asked for this. Redis, not the file, and it applies
     * to a hand-written entry exactly as much as to a published one: the
     * counter is about the tool, not about where the tool is stored.
     */
    const asked = Math.max(Number(raw.suggestedBy) || 0, interest[raw.id] || 0);
    const t = asked > 0 ? { ...raw, suggestedBy: asked } : raw;
    const o = overrides[t.id];
    const c = claims[t.id];
    const owned = c && c.status === "verified";
    if (!o) return owned ? { ...t, claimed: true } : t;
    /*
     * An override that only repeats the tool's own name is dropped here rather
     * than merged and then hidden downstream. The difference matters: an
     * override wins over the file, so suppressing it at render would leave
     * AppJubilee with no owner at all instead of the "Dark Ecommerce Labs, LLC"
     * the file says. Dropping it lets the editorial value through, which is the
     * answer the reader wanted.
     */
    const merged = isVacuousOwner(o.owner, t) ? { ...o, owner: undefined } : o;
    return {
      ...t,
      ...merged,
      ...(merged.owner === undefined ? { owner: t.owner } : {}),
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

/*
 * Apply one field from a monitor proposal, and remember enough to undo it.
 *
 * It writes an override, the same mechanism a vendor edit uses, so it inherits
 * everything that already makes overrides safe: the editorial file is never
 * touched, `mergedTools()` still restates the protected fields over the top,
 * and the whole thing is recoverable by deleting one key.
 *
 * `previous` is the override's own prior state rather than the value a visitor
 * was seeing, because that is what an undo has to put back. If there was no
 * override for this field before, undoing deletes the key and the entry falls
 * back to the file, which is not the same as writing the file's value into an
 * override and leaving it there.
 */
/*
 * Clear stored owner values that only repeat the tool's own name.
 *
 * Suppressing these at render, which `ownerOf` does, stops one displaying. It
 * does not remove it, and a stored field that no page will print is a trap for
 * the next thing that reads the record without knowing: an export, a prompt, a
 * comparison table somebody adds next year. The monitor applied "AppJubilee" as
 * AppJubilee's owner before the rule against proposing it existed, so the bad
 * values are already in `svt:overrides`.
 *
 * Both stores are swept: vendor and monitor edits in `svt:overrides`, and
 * entries published from the admin queue in `svt:entries`. Deleting the key is
 * right rather than writing an empty string, because an override's absence
 * means "whatever the file says" and an empty string would pin it to nothing.
 *
 * Idempotent, and returns what it cleared rather than a count, so the second
 * run reporting nothing is the evidence the first one worked.
 */
export async function sweepOwnership({ by = "" } = {}) {
  const catalogue = await catalogueTools();
  const byId = new Map(catalogue.map((t) => [t.id, t]));
  const cleared = [];

  const overrides = await read(KEY_OVERRIDES, {});
  let touchedOverrides = false;
  for (const [id, fields] of Object.entries(overrides || {})) {
    if (!fields || typeof fields !== "object" || !("owner" in fields)) continue;
    const entry = byId.get(id) || { id };
    if (!isVacuousOwner(fields.owner, entry)) continue;
    cleared.push({ id, from: fields.owner, store: "overrides" });
    delete fields.owner;
    if (!Object.keys(fields).length) delete overrides[id];
    touchedOverrides = true;
  }
  if (touchedOverrides) await write(KEY_OVERRIDES, overrides);

  const entries = await read(KEYS.entries, {});
  let touchedEntries = false;
  for (const [id, entry] of Object.entries(entries || {})) {
    if (!entry || typeof entry !== "object" || !entry.owner) continue;
    if (!isVacuousOwner(entry.owner, entry)) continue;
    cleared.push({ id, from: entry.owner, store: "entries" });
    delete entry.owner;
    touchedEntries = true;
  }
  if (touchedEntries) await write(KEYS.entries, entries);

  if (cleared.length) {
    console.log(`[sweep] cleared ${cleared.length} vacuous owner value(s) by ${by || "script"}:`,
      cleared.map((c) => `${c.id}="${c.from}"`).join(", "));
  }
  return { cleared, count: cleared.length };
}

export async function applyFieldEdit(toolId, field, value, { by = "" } = {}) {
  if (fieldKind(field) !== "appliable") {
    return { error: `${field} is not a field that can be applied automatically.` };
  }
  const overrides = await getOverrides();
  const current = overrides[toolId] || {};
  const had = Object.prototype.hasOwnProperty.call(current, field);

  overrides[toolId] = {
    ...current,
    [field]: value,
    editedAt: new Date().toISOString().slice(0, 10),
    editedBy: by,
  };
  await write(KEY_OVERRIDES, overrides);
  return { previous: { had, value: had ? current[field] : null } };
}

/** Put back exactly what `applyFieldEdit` found, including "there was nothing". */
export async function undoFieldEdit(toolId, field, previous = { had: false, value: null }) {
  const overrides = await getOverrides();
  const current = overrides[toolId];
  if (!current) return { undone: false };

  if (previous.had) current[field] = previous.value;
  else delete current[field];

  /* An override left holding only its own bookkeeping is not an override. */
  const meaningful = Object.keys(current).filter((k) => k !== "editedAt" && k !== "editedBy");
  if (!meaningful.length) delete overrides[toolId];
  else overrides[toolId] = { ...current, editedAt: new Date().toISOString().slice(0, 10) };

  await write(KEY_OVERRIDES, overrides);
  return { undone: true };
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
