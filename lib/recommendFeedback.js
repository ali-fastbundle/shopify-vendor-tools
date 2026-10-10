/*
 * Feedback on the growth recommender's answers.
 *
 * Per recommendation, not per run: a thumbs up or down on each pick, with an
 * optional line on why, and then one question about the run as a whole, "did
 * this help?", with a free-text box. A run-level score alone would say a run
 * went badly and not which pick did it.
 *
 * ------------------------------------------------------------------
 *  Traceable to what produced it
 * ------------------------------------------------------------------
 * Every record carries a copy of the run it is about: the answers, the
 * listing as read, what was skipped, which path answered (model, fallback),
 * which provider, and every pick with its reason and drivers. Runs live in a
 * capped list and the oldest fall off; a thumbs down whose run has gone would
 * be a complaint with nothing to check it against. So the record keeps its own
 * copy, taken when the first feedback on that run arrives.
 *
 * No address, here or on the run (invariant 42). Who may give feedback is
 * decided by a token minted with the answer (`mintRunToken` in lib/auth.js):
 * holding it is the proof that this run was yours, and it says nothing about
 * who you are.
 *
 * ------------------------------------------------------------------
 *  The signal
 * ------------------------------------------------------------------
 * A tool recommended often and rejected often means the matching is wrong for
 * it: the prompt, the themes, or the tool's own summary is pulling it into
 * runs it does not fit. `toolSignals` puts the two counts side by side and
 * `misfit` marks the tools where both are high, so that is the line /admin
 * reads first.
 */
import { read, write } from "./store";

export const FEEDBACK_KEY = "svt:recommend:feedback";
const MAX_RECORDS = 2000;

export const HELPED = { yes: "Yes", partly: "Partly", no: "No" };

const clean = (s, max) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/** The run as the record keeps it. Pure. */
export function snapshotOf(run = {}) {
  return {
    at: run.at || "",
    handle: run.handle || "",
    url: run.url || "",
    listingRead: Boolean(run.listingRead),
    app: run.app ? { name: run.app.name || "", category: run.app.category || "", rating: run.app.rating ?? null, reviews: run.app.reviews ?? null } : {},
    answers: run.answers || {},
    skipped: Array.isArray(run.skipped) ? run.skipped : [],
    path: run.path || "",
    provider: run.provider || "",
    considered: run.considered ?? null,
    noneFit: run.noneFit || "",
    picks: (run.picks || []).map((p) => ({ id: p.id, name: p.name, why: p.why || "", drivers: p.drivers || [] })),
  };
}

/**
 * Apply one feedback post to a record, or say why it cannot be. Pure.
 *
 * A post carries any of: `pick` + `vote` (1, -1, or 0 to take it back),
 * `pick` + `why`, `helped`, `text`. Partial on purpose: a thumb is saved the
 * moment it is pressed, the line on why when it is written, so leaving after
 * one click still leaves the click.
 */
export function applyFeedback(record, run, post = {}, now = new Date().toISOString()) {
  const base = record || { runId: run.id, at: now, run: snapshotOf(run), picks: {}, helped: "", text: "" };
  const next = { ...base, picks: { ...(base.picks || {}) }, updatedAt: now };
  let touched = false;

  if (post.pick !== undefined) {
    const id = String(post.pick);
    if (!(run.picks || []).some((p) => p.id === id)) return { error: "That tool was not in this run." };
    const prev = next.picks[id] || { vote: 0, why: "" };
    const cur = { ...prev };
    if (post.vote !== undefined) {
      const v = Number(post.vote);
      if (![1, 0, -1].includes(v)) return { error: "A vote is up or down." };
      cur.vote = v;
      touched = true;
    }
    if (post.why !== undefined) { cur.why = clean(post.why, 300); touched = true; }
    next.picks[id] = cur;
  }
  if (post.helped !== undefined) {
    const h = String(post.helped);
    if (h && !HELPED[h]) return { error: "Answer yes, partly or no." };
    next.helped = h;
    touched = true;
  }
  if (post.text !== undefined) { next.text = clean(post.text, 1200); touched = true; }

  if (!touched) return { error: "Nothing to save." };
  return { record: next };
}

export const readFeedback = () => read(FEEDBACK_KEY, {});

export async function saveFeedback(record) {
  const all = await readFeedback();
  all[record.runId] = record;
  /* Capped by age, oldest out, the same ceiling as the runs they describe. */
  const ids = Object.keys(all);
  if (ids.length > MAX_RECORDS) {
    ids.sort((a, b) => String(all[a].updatedAt || all[a].at).localeCompare(String(all[b].updatedAt || all[b].at)));
    for (const id of ids.slice(0, ids.length - MAX_RECORDS)) delete all[id];
  }
  await write(FEEDBACK_KEY, all);
  return record;
}

/*
 * Per tool: how often recommended (from the runs), and how the people it was
 * recommended to voted. A tool is a misfit when it is recommended at least
 * three times, has at least two thumbs down, and at least half of its votes
 * are down. Thresholds this low are right while there is little data: the
 * point is to be told where to look, and a false alarm costs one read.
 */
export const MISFIT = { recommended: 3, down: 2, share: 0.5 };

export function toolSignals(runs = [], feedback = {}) {
  const t = {};
  const at = (id, name) => (t[id] ||= { id, name, recommended: 0, up: 0, down: 0, reasons: [] });
  for (const r of runs) for (const p of r.picks || []) at(p.id, p.name).recommended += 1;
  for (const f of Object.values(feedback || {})) {
    for (const [id, v] of Object.entries(f.picks || {})) {
      const name = (f.run?.picks || []).find((p) => p.id === id)?.name || id;
      const row = at(id, name);
      if (v.vote === 1) row.up += 1;
      if (v.vote === -1) row.down += 1;
      if (v.why) row.reasons.push({ vote: v.vote, why: v.why, runId: f.runId, at: f.updatedAt || f.at });
    }
  }
  return Object.values(t).map((r) => {
    const votes = r.up + r.down;
    const share = votes ? r.down / votes : 0;
    return {
      ...r, votes, rejectShare: share,
      misfit: r.recommended >= MISFIT.recommended && r.down >= MISFIT.down && share >= MISFIT.share,
    };
  });
}

/** What /admin shows. Pure. */
export function summariseFeedback(runs = [], feedback = {}) {
  const records = Object.values(feedback || {}).sort((a, b) => String(b.updatedAt || b.at).localeCompare(String(a.updatedAt || a.at)));
  const tools = toolSignals(runs, feedback);
  const helped = records.reduce((a, f) => { if (f.helped) a[f.helped] = (a[f.helped] || 0) + 1; return a; }, {});
  return {
    records,
    helped,
    mostRecommended: [...tools].filter((x) => x.recommended).sort((a, b) => b.recommended - a.recommended || b.down - a.down).slice(0, 10),
    mostRejected: [...tools].filter((x) => x.down).sort((a, b) => b.down - a.down || b.rejectShare - a.rejectShare).slice(0, 10),
    misfits: tools.filter((x) => x.misfit).sort((a, b) => b.down - a.down),
  };
}
