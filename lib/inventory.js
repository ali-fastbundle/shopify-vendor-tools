/*
 * What is actually in the store, and what may be taken out of it.
 *
 * ------------------------------------------------------------------
 *  Why this exists
 * ------------------------------------------------------------------
 * Every panel on /admin shows one slice of the store, shaped for a decision:
 * the queue shows what needs reviewing, the mail log shows the last hundred
 * sends. None of them answers "what is in here", which is the question you have
 * after six months of building the thing, when your own test account, your own
 * test reviews and forty test emails to yourself are sitting in the same rows
 * as the real ones and you cannot see the real state through them.
 *
 * So this reports every key: what it holds, how many rows, and for the small
 * ones the rows themselves. Read first, delete second, and never the other way
 * round. Nothing here guesses what is test data, because nothing here can: a
 * subscriber address that looks like a test is somebody's address if it is not.
 * The console lists them and a person marks them.
 *
 * ------------------------------------------------------------------
 *  What may never be cleared from here
 * ------------------------------------------------------------------
 * `KEEP` is the list and the reasons are not interchangeable:
 *
 *  - **the catalogue and what is published against it** (`svt:overrides`,
 *    `svt:entries`). Invariant 4: a vendor's edits and an admin-published entry
 *    are the catalogue as far as a reader is concerned. Deleting them is
 *    editing the directory, which is not housekeeping.
 *  - **claims** (`svt:claims`). A claim is a vendor's proven relationship to a
 *    listing. Clearing one silently takes away access somebody verified by
 *    email, and invariant 4 already has a deliberate two-button path for that
 *    on purpose.
 *  - **monitor snapshots** (`svt:snapshots`, `svt:monitor`). A snapshot is the
 *    baseline the next diff is taken against. Delete them and the next run has
 *    nothing to compare with, so it reports every tool in the directory as
 *    changed, which is the one output guaranteed not to be read.
 *  - **the tallies** (`svt:stats`). Invariant 27: the counts are deliberately
 *    not derived from the rows, so that "how many suggestions have we had"
 *    survives the rows being deleted. Resetting them to match a cleared list is
 *    exactly the thing they exist not to do.
 *
 * Everything the reset does touch is community signal that can be recreated by
 * the community: votes, reviews, subscribers, and the log of what we emailed.
 */

import { read, write, del, readCapped, writeCapped, readMailLog, readStats, KEYS } from "./store";

const MAILLOG = KEYS.maillog;

/* Shown in full at or below this many rows. Above it, the count is the answer
   and the panel that already renders those rows is where to look. */
const SMALL = 40;

/*
 * Every key this application writes, in the order somebody would want to read
 * them: what people did, then what we queued, then what we sent, then the
 * machinery. A key absent from here is a key nobody can see, so adding a store
 * key means adding a row here in the same commit.
 */
const SHAPES = [
  {
    key: KEYS.votes, label: "Votes", group: "community",
    holds: "Likes and dislikes per tool. Anonymous, per browser and per IP limited.",
    reset: true,
    load: async () => {
      const v = await read(KEYS.votes, {});
      return Object.entries(v || {}).map(([id, n]) => ({
        id, label: id, detail: `${n?.up || 0} up, ${n?.down || 0} down`,
      }));
    },
  },
  {
    key: KEYS.reviews, label: "Reviews", group: "community",
    holds: "One review per account per tool, with the reviewer's address and helpfulness votes.",
    reset: true,
    load: async () => {
      const r = await read(KEYS.reviews, {});
      const rows = [];
      for (const [toolId, list] of Object.entries(r || {})) {
        for (const rev of Array.isArray(list) ? list : []) {
          rows.push({
            id: `${toolId}:${rev.id}`,
            label: `${toolId} · ${rev.author || "(no name)"} · ${rev.rating}★`,
            detail: `${rev.email || "(no address)"} · ${rev.date || ""}${rev.text ? ` · "${String(rev.text).slice(0, 60)}"` : ""}`,
            toolId, reviewId: rev.id, email: rev.email || "",
          });
        }
      }
      return rows;
    },
  },
  {
    key: KEYS.accounts, label: "Accounts", group: "community",
    holds: "Email, first seen, last seen. Three fields, and the sign-in copy promises exactly those.",
    /* Not in the reset. An account is somebody's sign-in, and the likely test
       row is one specific address the person running this recognises. */
    load: async () => {
      const a = await read(KEYS.accounts, {});
      return Object.values(a || {}).map((r) => ({
        id: r.email, label: r.email,
        detail: `first seen ${String(r.firstSeen || "").slice(0, 10)} · last seen ${String(r.lastSeen || "").slice(0, 10)}`,
      }));
    },
  },
  {
    key: KEYS.subscribers, label: "Subscribers", group: "community",
    holds: "The mailing list. Write-only over HTTP, per invariant 8.",
    reset: true,
    load: async () => {
      const list = await read(KEYS.subscribers, []);
      return (Array.isArray(list) ? list : []).map((s) => {
        const email = typeof s === "string" ? s : s?.email;
        return { id: email, label: email, detail: typeof s === "string" ? "" : String(s?.date || "").slice(0, 10) };
      }).filter((r) => r.id);
    },
  },
  {
    key: "svt:interest", label: "Interest", group: "community",
    holds: "How many people asked for something already listed, and why. Carries addresses.",
    load: async () => {
      const i = await read("svt:interest", {});
      return Object.entries(i || {}).map(([id, r]) => ({
        id, label: id, detail: `${r?.count || 0} asked${r?.people?.length ? `, ${r.people.length} addresses` : ""}`,
      }));
    },
  },

  {
    key: KEYS.suggestions, label: "Suggestions", group: "queues",
    holds: "The queue, including deleted rows, which are kept on purpose (invariant 27).",
    load: async () => {
      const list = await read(KEYS.suggestions, []);
      return (Array.isArray(list) ? list : []).map((s) => ({
        id: s.id,
        label: `${s.name}${s.status ? ` (${s.status})` : ""}`,
        detail: `${s.via === "discovery" ? "discovery · " : ""}${s.by || "anonymous"} · ${String(s.at || "").slice(0, 10)}`,
      }));
    },
  },
  {
    key: KEYS.reports, label: "Reports", group: "queues",
    holds: "Corrections from anyone. Writes here and nowhere else (invariant 13).",
    load: async () => {
      const list = await read(KEYS.reports, []);
      return (Array.isArray(list) ? list : []).map((r) => ({
        id: r.id,
        label: `${r.toolId || "?"} · ${r.kind || "?"}${r.status ? ` (${r.status})` : ""}`,
        detail: `${String(r.value || "").slice(0, 70)} · ${String(r.at || "").slice(0, 10)}`,
      }));
    },
  },
  {
    key: "svt:discovery", label: "Discovery", group: "queues",
    holds: "The last competitor pass. Cleared from the Discovered panel on the Inbox tab.",
    load: async () => {
      const state = await read("svt:discovery", {});
      return (Array.isArray(state.findings) ? state.findings : []).map((f) => ({
        id: f.name, label: f.name, detail: `named by ${(f.namedBy || []).join(", ") || "?"}`,
      }));
    },
  },
  {
    key: "svt:discovery:dismissed", label: "Discovery dismissals", group: "queues",
    holds: "Names an editor declined, with the reason. Kept for ever so they do not come back.",
    load: async () => {
      const all = await read("svt:discovery:dismissed", {});
      return Object.values(all || {}).map((d) => ({
        id: d.key, label: d.name, detail: `${d.reason || "no reason"} · ${d.by || ""} · ${String(d.at || "").slice(0, 10)}`,
      }));
    },
  },
  {
    key: "svt:feed", label: "Recent updates", group: "queues",
    holds: "The public changes feed. Every row was written by a person.",
    load: async () => {
      const rows = await read("svt:feed", []);
      return (Array.isArray(rows) ? rows : []).map((e) => ({
        id: e.id, label: `${e.toolName} · ${e.date}${e.deletedAt ? " (deleted)" : ""}`,
        detail: String(e.headline || "").slice(0, 80),
      }));
    },
  },

  {
    key: MAILLOG, label: "Mail log", group: "mail",
    holds: "Every send attempted, successful or not. Capped at 500, newest first.",
    reset: true,
    load: async () => {
      const rows = await readMailLog(500);
      return rows.map((r, i) => ({
        id: String(i),
        label: `${r.event} → ${r.cls}${r.test ? " · test" : ""}`,
        detail: `${r.to || "(no recipient)"} · ${r.ok ? "ok" : `FAILED: ${r.error || "?"}`} · ${String(r.at || "").slice(0, 16).replace("T", " ")}`,
        test: Boolean(r.test),
      }));
    },
  },

  {
    key: "svt:claims", label: "Claims", group: "protected",
    holds: "Verified vendor ownership of a listing. Revoked one at a time, with the content decision made explicitly.",
    load: async () => {
      const c = await read("svt:claims", {});
      return Object.entries(c || {}).map(([toolId, r]) => ({
        id: toolId, label: toolId, detail: `${r?.email || "?"} · ${r?.method || "?"} · ${String(r?.at || "").slice(0, 10)}`,
      }));
    },
  },
  {
    key: "svt:overrides", label: "Vendor and monitor edits", group: "protected",
    holds: "What a vendor or an applied monitor proposal changed. Merged over the file on read.",
    load: async () => {
      const o = await read("svt:overrides", {});
      return Object.entries(o || {}).map(([toolId, r]) => ({
        id: toolId, label: toolId, detail: Object.keys(r || {}).join(", ") || "(empty)",
      }));
    },
  },
  {
    key: KEYS.entries, label: "Published entries", group: "protected",
    holds: "Entries published from the admin queue. First-class catalogue members (invariant 22).",
    load: async () => {
      const e = await read(KEYS.entries, {});
      return Object.values(e || {}).map((r) => ({ id: r.id, label: r.name, detail: r.domain || r.url || "" }));
    },
  },
  {
    key: "svt:snapshots", label: "Monitor snapshots", group: "protected",
    holds: "The baseline every weekly diff is taken against. Deleting these makes the next run report every tool as changed.",
    load: async () => {
      const snaps = await read("svt:snapshots", {});
      return Object.entries(snaps || {}).map(([id, r]) => ({
        id, label: id, detail: `${String(r?.at || "").slice(0, 10)}${r?.blocked ? " · blocked" : ""}`,
      }));
    },
  },
  {
    key: KEYS.changelog, label: "Monitor findings", group: "protected",
    holds: "What the monitor has reported. The Inbox reads the latest run out of this.",
    load: async () => (await readCapped(KEYS.changelog, 500)).map((r) => ({
      id: r.id, label: `${r.entryName} · ${r.kind}`, detail: String(r.what || "").slice(0, 70),
    })),
  },
  {
    key: KEYS.stats, label: "Counters", group: "protected",
    holds: "Tallies that outlive the rows they count (invariant 27), plus per-tool opens and matcher uses.",
    load: async () => {
      const { fields } = await readStats();
      return Object.entries(fields || {}).map(([f, n]) => ({ id: f, label: f, detail: String(n) }));
    },
  },
];

/* Cleared by "Reset test data", in this order, and nothing else ever is. */
export const RESET_KEYS = SHAPES.filter((s) => s.reset).map((s) => s.key);

/* Named in the confirmation so the button says what it will do. */
export const RESET_LABELS = SHAPES.filter((s) => s.reset).map((s) => s.label.toLowerCase());

export const KEEP_LABELS = [
  "the catalogue and vendor edits", "published entries", "claims",
  "monitor snapshots and findings", "the counters", "suggestions and reports",
];

/**
 * Every key, with a count and, where the collection is small enough to read,
 * its rows. Each `load` is wrapped: one unreadable key reports itself as
 * unreadable rather than emptying the whole page.
 */
export async function storeInventory() {
  return Promise.all(SHAPES.map(async (shape) => {
    try {
      const rows = await shape.load();
      return {
        key: shape.key, label: shape.label, holds: shape.holds, group: shape.group,
        reset: Boolean(shape.reset),
        count: rows.length,
        rows: rows.length <= SMALL ? rows : [],
        truncated: rows.length > SMALL,
      };
    } catch (e) {
      return {
        key: shape.key, label: shape.label, holds: shape.holds, group: shape.group,
        reset: Boolean(shape.reset), count: -1, rows: [], truncated: false,
        error: String(e?.message || e).slice(0, 120),
      };
    }
  }));
}

/**
 * Clear votes, reviews, subscribers and the mail log. Nothing else, ever.
 *
 * Returns what it deleted rather than a bare ok, so the console can report
 * "142 votes, 9 reviews" and the person can see it matched what the panel said
 * a moment earlier. A reset that reports nothing is a reset nobody trusts twice.
 */
export async function resetTestData({ by = "" } = {}) {
  const before = {
    votes: Object.keys(await read(KEYS.votes, {})).length,
    reviews: Object.values(await read(KEYS.reviews, {})).reduce((n, l) => n + (Array.isArray(l) ? l.length : 0), 0),
    subscribers: (await read(KEYS.subscribers, [])).length,
    maillog: (await readMailLog(500)).length,
  };

  await write(KEYS.votes, {});
  await write(KEYS.reviews, {});
  await write(KEYS.subscribers, []);
  await del(MAILLOG);

  return { cleared: before, at: new Date().toISOString(), by };
}

/*
 * Remove one row somebody has marked.
 *
 * Deliberately not a generic "delete anything by key": four targets, each
 * spelled out, so a typo in a request body cannot reach the catalogue. Anything
 * in the protected group has no delete path from here at all.
 */
export async function deleteRow(target, id) {
  const key = String(id || "");
  if (!key) return { error: "Nothing to delete." };

  if (target === "account") {
    const all = await read(KEYS.accounts, {});
    if (!all[key]) return { error: "No account with that address." };
    delete all[key];
    await write(KEYS.accounts, all);
    return { ok: true, removed: key };
  }

  if (target === "subscriber") {
    const list = await read(KEYS.subscribers, []);
    const kept = (Array.isArray(list) ? list : []).filter((s) => (typeof s === "string" ? s : s?.email) !== key);
    if (kept.length === list.length) return { error: "That address is not on the list." };
    await write(KEYS.subscribers, kept);
    return { ok: true, removed: key };
  }

  if (target === "review") {
    /* "<toolId>:<reviewId>", which is how the inventory row is keyed, because a
       review id is only unique within its tool. */
    const [toolId, reviewId] = key.split(":");
    const all = await read(KEYS.reviews, {});
    const list = Array.isArray(all[toolId]) ? all[toolId] : [];
    const kept = list.filter((r) => String(r.id) !== reviewId);
    if (kept.length === list.length) return { error: "No review with that id." };
    if (kept.length) all[toolId] = kept; else delete all[toolId];
    await write(KEYS.reviews, all);
    return { ok: true, removed: key };
  }

  if (target === "mail") {
    /* By position, which is what the inventory row carries: mail log rows have
       no id of their own, and adding one would not make the old rows have it. */
    const rows = await readMailLog(500);
    const index = Number(key);
    if (!Number.isInteger(index) || index < 0 || index >= rows.length) {
      return { error: "No mail log row at that position." };
    }
    const kept = rows.filter((_, i) => i !== index);
    const written = await writeCapped(MAILLOG, kept, 500);
    if (written < 0) return { error: "Could not rewrite the mail log." };
    return { ok: true, removed: `${rows[index].event} → ${rows[index].to}` };
  }

  return { error: "Not something that can be deleted from here." };
}
