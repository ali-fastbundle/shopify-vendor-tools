import { createHmac } from "crypto";
import { read, write } from "./store";
import { sanitiseAnswers, sanitiseSkipped, SCREENS } from "./recommendOptions";

/*
 * A recommender run in progress, saved after every screen so somebody who
 * leaves and comes back resumes where they stopped, on any device they sign
 * in on.
 *
 * Keyed to the account, but not by the address: the key is an HMAC of it
 * under AUTH_SECRET, so the store holds answers about an app and no way to
 * read off whose they are. Deleted when the run completes or on Start over,
 * and the sign-in form says so (components/Account.jsx), because anything
 * kept against an account is part of that promise.
 */
export const DRAFTS = "svt:recommend:drafts";
const MAX_AGE_DAYS = 60;

const keyOf = (email) => createHmac("sha256", process.env.AUTH_SECRET || "dev")
  .update(`recommend-draft:${String(email || "").trim().toLowerCase()}`).digest("base64url").slice(0, 32);

export async function getDraft(email) {
  const all = (await read(DRAFTS, {})) || {};
  const d = all[keyOf(email)];
  if (!d) return null;
  if (Date.now() - Date.parse(d.at || 0) > MAX_AGE_DAYS * 86400e3) return null;
  return d;
}

/** Store one draft, sanitised. Old drafts across all accounts are pruned on the way. */
export async function saveDraft(email, { step, answers, skipped }) {
  const all = (await read(DRAFTS, {})) || {};
  const cutoff = Date.now() - MAX_AGE_DAYS * 86400e3;
  for (const [k, v] of Object.entries(all)) if (Date.parse(v?.at || 0) < cutoff) delete all[k];
  const draft = {
    step: SCREENS.includes(step) ? step : "url",
    answers: sanitiseAnswers(answers),
    skipped: sanitiseSkipped(skipped),
    at: new Date().toISOString(),
  };
  all[keyOf(email)] = draft;
  await write(DRAFTS, all);
  return draft;
}

export async function clearDraft(email) {
  const all = (await read(DRAFTS, {})) || {};
  const k = keyOf(email);
  if (!(k in all)) return;
  delete all[k];
  await write(DRAFTS, all);
}
