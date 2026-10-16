/*
 * Outreach to listed vendors: who was written to, when, how, and what came
 * back. Server only. The Outreach tab on /admin is temporary; this record is
 * what stops one vendor being written to twice.
 *
 *   svt:outreach      = { [toolId]: { status: "contacted" | "replied", contactedAt, via, to,
 *                                     repliedAt, history: [{ at, what, via, to, by }] } }
 *   svt:outreach:meta = { resendAcknowledgedAt, by }
 *
 * "Claimed" is not stored here: it is read from the claims store, so it is
 * true the moment the vendor proves the domain, whoever wrote to them.
 *
 * Every send is a row in svt:maillog, both paths. Through Resend that is
 * sendEvent's own log. Copied to the admin's own mailbox, it is a row this
 * file writes when the admin marks it sent, saying so.
 */
import { read, write, pushMailLog } from "./store";

export const OUTREACH_KEY = "svt:outreach";
export const META_KEY = "svt:outreach:meta";
/* Cold outbound shares a sending domain with the sign-in links, so it is
   rationed: this many a day through Resend, across every vendor. */
export const RESEND_PER_DAY = 5;

export const readOutreach = () => read(OUTREACH_KEY, {});
export const readMeta = () => read(META_KEY, {});

async function record(toolId, change, row) {
  const all = (await readOutreach()) || {};
  const prev = all[toolId] || { history: [] };
  all[toolId] = { ...prev, ...change, history: [{ ...row, at: new Date().toISOString() }, ...(prev.history || [])].slice(0, 30) };
  await write(OUTREACH_KEY, all);
  return all;
}

/** The admin sent it from their own mailbox. Logged to the mail log as such. */
export async function markContacted(toolId, { to = "", via = "own mailbox", subject = "", by = "" } = {}) {
  const at = new Date().toISOString();
  const all = await record(toolId, { status: "contacted", contactedAt: at, via, to }, { what: "contacted", via, to, by });
  await pushMailLog([{ event: "outreach", cls: "user", to: to || "(no address, by LinkedIn)", ok: true, at, via, subject }]);
  return { outreach: all };
}

export async function markReplied(toolId, by = "") {
  const all = (await readOutreach()) || {};
  if (!all[toolId]) return { error: "Mark it contacted first." };
  return { outreach: await record(toolId, { status: "replied", repliedAt: new Date().toISOString() }, { what: "replied", by }) };
}

export async function clearOutreach(toolId, by = "") {
  const all = (await readOutreach()) || {};
  if (!all[toolId]) return { error: "Nothing recorded for that tool." };
  return { outreach: await record(toolId, { status: "", contactedAt: "", repliedAt: "", via: "", to: "" }, { what: "cleared", by }) };
}

export async function acknowledgeResend(by = "") {
  const meta = { ...(await readMeta()), resendAcknowledgedAt: new Date().toISOString(), by };
  await write(META_KEY, meta);
  return meta;
}

export { record as recordOutreach };
