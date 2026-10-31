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
import { ownershipFromName } from "./owners";
import { getStructured, publicStructured } from "./structuredStore";
import { readMedia, publicMedia } from "./media";
import { pricingDisplay } from "./categories";
import { catalogueTools } from "./entries";
import { interestCounts } from "./interest";
import { getEditorUse, publicEditorUse } from "./editorUseStore";
import { NEWSLETTERS } from "./newsletters";
import { PODCASTS } from "./podcasts";
import { EVENTS } from "./events";

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
  "price", "free", "one", "note", "url", "domain", "social", "ownership", "dying",
];

/*
 * `alsoIn` is here because it is `cat` with more room. A vendor filing
 * themselves into four more categories is the same act as changing their
 * category, and the monitor has no business proposing it either: which
 * categories a directory has and what belongs in them is the editorial
 * judgement the directory is made of.
 *
 * `competes` is here because naming your rivals is a thing a vendor would very
 * much like to do. It decides who appears in Related tools on somebody else's
 * page, so a vendor who could write it would put themselves on the page of
 * every tool they lose deals to, and one who could clear it would take
 * themselves off Mantle's. It is an editorial judgement about a market, not a
 * fact a vendor gets to assert about a competitor.
 *
 * `noRecommend` is here because it is a rule about this directory's behaviour
 * rather than a fact about a tool. A vendor who could clear it would put
 * themselves back into the matcher, and one who could set it would take a
 * rival out of it.
 */
export const PROTECTED = [
  "watch", "cat", "alsoIn", "verified", "ratings", "updated", "id", "name",
  "noRecommend", "competes", "editorUse", "structured", "vendorMedia",
  /* When it launched is researched from the vendor's own pages and stated as
     a caveat (lib/launched.js); a vendor setting it would set its own age. */
  "launched",
];

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
  const [base, overrides, claims, interest, used, confirmed, media] = await Promise.all([
    catalogueTools(), getOverrides(), getClaims(), interestCounts(),
    getEditorUse().then(publicEditorUse).catch(() => ({})),
    getStructured().then(publicStructured).catch(() => ({})),
    readMedia().catch(() => ({})),
  ]);
  const merged = base.map((raw) => {
    /*
     * How many people have asked for this. Redis, not the file, and it applies
     * to a hand-written entry exactly as much as to a published one: the
     * counter is about the tool, not about where the tool is stored.
     */
    const asked = Math.max(Number(raw.suggestedBy) || 0, interest[raw.id] || 0);
    /*
     * Editor use, from its own key. Never on an entry with `noRecommend`,
     * which is already kept out of anything that reads as the editor's
     * endorsement. Restated below over the override so a vendor key cannot
     * set it.
     */
    const editorUse = raw.noRecommend === true ? undefined : used[raw.id];
    const t = { ...raw, ...(asked > 0 ? { suggestedBy: asked } : {}), ...(editorUse ? { editorUse } : {}) };
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
    /*
     * Ownership is a structured reference now (lib/owners.js). An override
     * carries one when an admin applied a monitor finding. A legacy override
     * still holding a free-text `owner` is read as a reference to the same
     * name. Either way, one that names the tool itself is dropped here, so the
     * file's owner shows instead of nothing (invariant 32).
     */
    const overrideOwnership = o.ownership && typeof o.ownership === "object" ? o.ownership
      : typeof o.owner === "string" ? ownershipFromName(o.owner) : null;
    const { owner: _legacyOwner, linked: _l, suite: _s, ...merged } = o;
    const ownership = overrideOwnership && !isVacuousOwner(overrideOwnership.name, t) ? overrideOwnership : t.ownership;
    return {
      ...t,
      ...merged,
      ownership,
      social: { ...(t.social || {}), ...(o.social || {}) },
      claimed: Boolean(owned),
      editedAt: o.editedAt || null,
      // never overridable, restated so a malformed key cannot leak through
      watch: t.watch, cat: t.cat, alsoIn: t.alsoIn, verified: t.verified,
      id: t.id, name: t.name, ratings: t.ratings, updated: t.updated, launched: t.launched,
      noRecommend: t.noRecommend, competes: t.competes, editorUse: t.editorUse,
      structured: undefined, structuredStale: undefined, vendorMedia: undefined,
    };
  });
  /* Vendor media (lib/media.js): its own approved record, never an override,
     so it cannot be set by a listing edit and cannot change a listing field. */
  return merged.map((t) => {
    const out = withStructured(t, overrides[t.id], confirmed[t.id]);
    const m = publicMedia(media?.[t.id]);
    return m ? { ...out, vendorMedia: m } : out;
  });
}

/*
 * Confirmed structured data (lib/structuredStore.js) on a merged tool, and the
 * price line derived from its tiers, so every reader of `price` (cards, sort,
 * JSON-LD, llms.txt, the recommender) gets the derived string without knowing
 * the structure exists. The one exception: a price string written after the
 * structure was confirmed, by the vendor or by an applied monitor finding,
 * wins, and the tool is marked `structuredStale` for the editor to re-confirm.
 * Vendors keep the right to edit their price, and the newest statement shows.
 */
function withStructured(t, o, s) {
  if (!s) return t;
  const newer = o && o.price !== undefined && o.priceAt && o.priceAt > s.confirmedAt;
  if (newer) return { ...t, structured: s, structuredStale: true };
  /* A confirmed price that says the tool is winding down cannot stand on a
     tool that is not: the dying flag is the fact (invariant 23), so the file's
     price shows and the tool goes back to the editor to re-confirm. SASI was
     confirmed as "Free. Winding down with Mantle" before it was found running. */
  if (!t.dying && /wind(ing)?[ -]down|shutting down|shut down/i.test(pricingDisplay(s.pricing))) {
    return { ...t, structured: s, structuredStale: true };
  }
  return {
    ...t,
    structured: s,
    price: pricingDisplay(s.pricing),
    ...(typeof s.pricing?.free === "boolean" ? { free: s.pricing.free } : {}),
  };
}

/*
 * The same merge for newsletters.
 *
 * Claims and overrides are keyed on `id` and stored kind-agnostically, so a
 * publisher who verifies their newsletter and edits it uses exactly the
 * machinery a tool vendor does. What a newsletter publisher may change is the
 * prose and the links (one, note, url, free, social); everything that makes the
 * entry a credibility signal rather than marketing is restated here and cannot
 * be written over: `watch` above all, plus the cadence, the run length, the
 * dates and who publishes it. Same rule as a tool's `watch`, `cat` and
 * `ratings`, applied to the facts that matter for this shape.
 */
export async function mergedNewsletters() {
  const [overrides, claims] = await Promise.all([getOverrides(), getClaims()]);
  return NEWSLETTERS.map((n) => {
    const o = overrides[n.id];
    const c = claims[n.id];
    const owned = c && c.status === "verified";
    if (!o) return owned ? { ...n, claimed: true } : n;
    return {
      ...n,
      ...o,
      social: { ...(n.social || {}), ...(o.social || {}) },
      claimed: Boolean(owned),
      editedAt: o.editedAt || null,
      // Never overridable, restated so a malformed override cannot leak through.
      watch: n.watch, ratings: n.ratings, updated: n.updated,
      id: n.id, name: n.name, shopifySpecific: n.shopifySpecific,
      cadence: n.cadence, issueCount: n.issueCount, started: n.started,
      author: n.author, publisher: n.publisher, platform: n.platform, rss: n.rss,
      ownership: n.ownership,
    };
  });
}

/*
 * The same merge for podcasts. A host may change the prose and the links;
 * everything that makes the entry a record rather than a pitch is restated from
 * the file: the caveat, how a vendor gets in (`reach`), the cadence, the run,
 * the dates, whether it stopped, the feed and who publishes it.
 */
export async function mergedPodcasts() {
  const [overrides, claims] = await Promise.all([getOverrides(), getClaims()]);
  return PODCASTS.map((p) => {
    const o = overrides[p.id];
    const owned = claims[p.id]?.status === "verified";
    if (!o) return owned ? { ...p, claimed: true } : p;
    return {
      ...p,
      ...(o.one ? { one: o.one } : {}),
      ...(o.note ? { note: o.note } : {}),
      ...(o.url ? { url: o.url } : {}),
      ...(typeof o.free === "boolean" ? { free: o.free } : {}),
      social: { ...(p.social || {}), ...(o.social || {}) },
      claimed: Boolean(owned),
      editedAt: o.editedAt || null,
    };
  });
}

/*
 * What an owner may set, per kind. `EDITABLE` is the tool list; the other
 * shapes are narrower because they have less prose and more fact. An event
 * organiser may change how the event is described and where it links, and
 * nothing that is a claim about it: the dates, the place, the audience, the
 * relevance and the caveat are what make the calendar worth trusting, and
 * "the date moved" is a report for an editor, not an edit.
 */
export const EDITABLE_BY_KIND = {
  tool: EDITABLE,
  newsletter: ["one", "note", "url", "free", "social"],
  /* A host may describe the show and where to find it. `reach` is not here:
     a host writing their own rate card into our listing is advertising. */
  podcast: ["one", "note", "url", "free", "social"],
  event: ["one", "url", "social"],
};

/** Drop whatever this kind of listing does not let an owner change. */
export const editableFor = (kind, edit) => {
  const allowed = EDITABLE_BY_KIND[kind] || EDITABLE;
  return Object.fromEntries(Object.entries(edit).filter(([k]) => allowed.includes(k)));
};

/*
 * The same merge for events. Only `one`, `url` and `social` can come from an
 * override; everything else is restated from the file by construction, since
 * the result starts from the entry and copies just those three across.
 */
export async function mergedEvents() {
  const [overrides, claims] = await Promise.all([getOverrides(), getClaims()]);
  return EVENTS.map((e) => {
    const o = overrides[e.id];
    const owned = claims[e.id]?.status === "verified";
    if (!o) return owned ? { ...e, claimed: true } : e;
    return {
      ...e,
      ...(o.one ? { one: o.one } : {}),
      ...(o.url ? { url: o.url } : {}),
      social: { ...(e.social || {}), ...(o.social || {}) },
      claimed: Boolean(owned),
      editedAt: o.editedAt || null,
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
    if (!fields || typeof fields !== "object") continue;
    const entry = byId.get(id) || { id };
    /* Both shapes: a legacy free-text `owner`, and the structured `ownership`. */
    for (const key of ["owner", "ownership"]) {
      if (!(key in fields)) continue;
      const name = key === "ownership" ? fields.ownership?.name : fields.owner;
      if (!isVacuousOwner(name, entry)) continue;
      cleared.push({ id, from: name, store: "overrides" });
      delete fields[key];
      touchedOverrides = true;
    }
    if (!Object.keys(fields).length) delete overrides[id];
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
  /*
   * Ownership is written as a structured reference (lib/owners.js). A
   * proposal for `owner`, `linked` or `suite`, from the model or from a
   * changelog row stored before the change, lands here as the same thing: the
   * name is matched to a known owner, or kept as a name with no page yet. One
   * that names the tool itself is refused, the rule the monitor already
   * applies before proposing (invariant 32).
   */
  if (["owner", "linked", "suite"].includes(field)) field = "ownership";
  if (field === "ownership" && typeof value === "string") {
    const entry = (await catalogueTools()).find((t) => t.id === toolId) || { id: toolId };
    if (isVacuousOwner(value, entry)) return { error: "That names the tool as its own owner, which says nothing." };
    value = ownershipFromName(value);
  }
  if (fieldKind(field) !== "appliable") {
    return { error: `${field} is not a field that can be applied automatically.` };
  }
  const overrides = await getOverrides();
  const current = overrides[toolId] || {};
  const had = Object.prototype.hasOwnProperty.call(current, field);

  overrides[toolId] = {
    ...current,
    [field]: value,
    ...(field === "price" ? { priceAt: new Date().toISOString() } : {}),
    editedAt: new Date().toISOString().slice(0, 10),
    editedBy: by,
  };
  await write(KEY_OVERRIDES, overrides);
  return { previous: { had, value: had ? current[field] : null } };
}

/*
 * Winding down, set by an admin from the tool page or the listing modal.
 *
 * `dying` is a fact about the product, so a vendor may not assert it about
 * themselves (it is not in EDITABLE), but it moves faster than a release, and
 * the editor sometimes knows before the file does: SASI was marked as dying
 * with Mantle and turned out to be running. So it is an override, like an
 * applied monitor finding (APPLIABLE), never a file edit: undoing it is the
 * same click, and the file stays the editorial default.
 *
 * Setting it to what the file already says removes the override key rather
 * than storing a copy, so "follow the file" is a real state and a later hand
 * edit to lib/tools.js is not shadowed by a stale override.
 *
 * It changes the flag only. The words that describe a wind-down (`one`,
 * `note`, and the caveat) say what they say until somebody edits them, and
 * the control says so where it is pressed.
 */
export async function setDying(toolId, dying, { by = "" } = {}) {
  if (typeof dying !== "boolean") return { error: "Winding down is yes or no." };
  const base = (await catalogueTools()).find((t) => t.id === toolId);
  if (!base) return { error: "No such tool." };
  const overrides = await getOverrides();
  const current = { ...(overrides[toolId] || {}) };
  const fileSays = base.dying === true;
  if (fileSays === dying) delete current.dying;
  else current.dying = dying;
  const meaningful = Object.keys(current).filter((k) => k !== "editedAt" && k !== "editedBy");
  if (!meaningful.length) delete overrides[toolId];
  else overrides[toolId] = { ...current, editedAt: new Date().toISOString().slice(0, 10), editedBy: by };
  await write(KEY_OVERRIDES, overrides);
  console.log(`[dying] ${toolId} -> ${dying} (file says ${fileSays}${fileSays === dying ? ", override removed" : ""})`);
  return { dying, followsFile: fileSays === dying };
}

/** Put back exactly what `applyFieldEdit` found, including "there was nothing". */
export async function undoFieldEdit(toolId, field, previous = { had: false, value: null }) {
  /* The same mapping as applyFieldEdit, so Undo removes what Apply wrote. */
  if (["owner", "linked", "suite"].includes(field)) field = "ownership";
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
    /* When the price string changed, so a confirmed structure older than it
       steps aside (mergedTools, lib/categories.js). */
    ...("price" in edit && edit.price !== (overrides[toolId] || {}).price ? { priceAt: new Date().toISOString() } : {}),
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
