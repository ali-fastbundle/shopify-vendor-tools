/*
 * The ideas backlog, stored. Server only. What an idea is lives in lib/ideas.js.
 *
 *   svt:ideas = { [id]: { id, text, surface, size, status, createdAt, by,
 *                         reviews: [newest first], log: [status changes],
 *                         dropped: { reason, at }, overrode: { at, verdict, reason },
 *                         commits: [hash], stateNote } }
 *
 * Seeds are merged in until first touched, then stored, the announcement
 * queue's pattern. Nothing is ever deleted: dropping keeps the idea and the
 * reason (invariant 27).
 */
import { read, write } from "./store";
import { SEEDS, STATUSES, SURFACES, SIZES, REASON_MAX, sanitiseIdea, sortIdeas, isCommitHash, latestReview } from "./ideas";

export const KEY = "svt:ideas";
const MAX_REVIEWS = 10;

const stored = async () => (await read(KEY, {})) || {};
const seedRow = (s) => ({ reviews: [], log: [], commits: [], by: "", seeded: true, ...s });

/* A seed's `editorRecord` is the editor's ruling on a review, kept in git, so
   it reaches the stored row too: the row's reviews are in the store, which
   this repository cannot edit, and the ruling has to sit beside them. The
   seed's stateNote travels with it, because the ruling is about the state. */
const withRecord = (row) => {
  const s = SEEDS.find((x) => x.id === row.id);
  if (!s?.editorRecord && !s?.closed) return row;
  const out = { ...row, ...(s.editorRecord ? { editorRecord: s.editorRecord } : {}), stateNote: s.stateNote };
  /* A seed closed in git (`closed`) carries its outcome onto the stored row:
     the status, the commits that shipped it, and what was declined. */
  if (s.closed) {
    out.status = s.status;
    out.commits = [...new Set([...(row.commits || []), ...(s.commits || [])])];
    out.closed = s.closed;
  }
  return out;
};

export async function getIdeas() {
  const all = await stored();
  return sortIdeas([...Object.values(all).map(withRecord), ...SEEDS.filter((s) => !all[s.id]).map(seedRow)]);
}

async function rowOf(all, id) {
  if (all[id]) return all[id];
  const s = SEEDS.find((x) => x.id === id);
  return s ? seedRow(s) : null;
}

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export async function addIdea(input, by = "") {
  const clean = sanitiseIdea(input);
  if (clean.error) return clean;
  const all = await stored();
  const now = new Date().toISOString();
  const row = { id: newId(), ...clean, status: "new", createdAt: now, by, reviews: [], log: [], commits: [] };
  all[row.id] = row;
  await write(KEY, all);
  return { row };
}

/**
 * Edit the text, surface or size, or move the status. Dropped needs a reason.
 * Approving or starting an idea the latest review argued against records the
 * override, with an optional reason, so it can be checked against what
 * happened.
 */
export async function updateIdea(id, { text, surface, size, status, reason } = {}, by = "") {
  const all = await stored();
  const row = await rowOf(all, id);
  if (!row) return { error: "No such idea." };
  const now = new Date().toISOString();
  const next = { ...row };

  if (text !== undefined || surface !== undefined || size !== undefined) {
    const clean = sanitiseIdea({
      text: text ?? row.text, surface: surface ?? row.surface, size: size ?? row.size,
    });
    if (clean.error) return clean;
    Object.assign(next, clean);
  }

  if (status !== undefined && status !== row.status) {
    if (!STATUSES.includes(status)) return { error: "Unknown status." };
    const why = String(reason ?? "").replace(/\s+/g, " ").trim().slice(0, REASON_MAX);
    if (status === "dropped" && why.length < 5) {
      return { error: "Say why it is dropped. The reason is what stops it being proposed again." };
    }
    if (status === "dropped") next.dropped = { reason: why, at: now, by };
    const r = latestReview(row);
    if ((status === "approved" || status === "in progress") && r && r.verdict !== "go" && !row.overrode) {
      next.overrode = { at: now, verdict: r.verdict, reason: why, by };
    }
    next.log = [{ at: now, by, from: row.status, to: status, reason: why }, ...(row.log || [])].slice(0, 50);
    next.status = status;
  }

  next.updatedAt = now;
  all[id] = next;
  await write(KEY, all);
  return { row: next };
}

/** Store a review with the idea, newest first. A new idea becomes reviewed. */
export async function addReview(id, review, by = "") {
  const all = await stored();
  const row = await rowOf(all, id);
  if (!row) return { error: "No such idea." };
  const now = new Date().toISOString();
  const next = { ...row, reviews: [{ ...review, at: now, by }, ...(row.reviews || [])].slice(0, MAX_REVIEWS) };
  if (row.status === "new") {
    next.status = "reviewed";
    next.log = [{ at: now, by, from: "new", to: "reviewed", reason: "AI review" }, ...(row.log || [])].slice(0, 50);
  }
  all[id] = next;
  await write(KEY, all);
  return { row: next };
}

/** The commit that shipped it, pasted back from Claude Code. Marks it shipped. */
export async function recordCommit(id, hash, by = "") {
  const h = String(hash || "").trim().toLowerCase();
  if (!isCommitHash(h)) return { error: "That is not a commit hash. Paste the 7 to 40 characters git prints." };
  const all = await stored();
  const row = await rowOf(all, id);
  if (!row) return { error: "No such idea." };
  if ((row.commits || []).some((c) => c.startsWith(h) || h.startsWith(c))) return { error: "That commit is already recorded." };
  const now = new Date().toISOString();
  const next = { ...row, commits: [...(row.commits || []), h], updatedAt: now };
  if (row.status !== "shipped") {
    next.log = [{ at: now, by, from: row.status, to: "shipped", reason: `commit ${h}` }, ...(row.log || [])].slice(0, 50);
    next.status = "shipped";
  }
  all[id] = next;
  await write(KEY, all);
  return { row: next };
}

export { SURFACES, SIZES };
