/*
 * Questions and answers per tool.
 *
 * A review is an opinion with a rating. A question is "does this do X", and
 * its answer is a fact somebody can check. They are kept apart on the page and
 * in the store, and nothing here touches the rating.
 *
 * The rules are a review's and a comment's (invariant 16): an account to ask
 * or answer, the same per-IP limit, the asker's and answerer's addresses are
 * the only private fields and leave through `publicQA()` and nowhere else.
 * Live at once, then read by a person: a new question lands in the admin
 * Inbox (`reviewed: false`), where it is marked fine, hidden with a reason
 * (kept, reversible) or deleted. An answer can be hidden or deleted the same
 * way from its question's row.
 *
 * An answer from the listing's verified claimant is marked `vendor` when it is
 * written, from the claims store, never from the request. It says the vendor
 * answered, not that the answer is right.
 *
 *   svt:qa = { [toolId]: [ { id, author, text, email, at, reviewed, hidden,
 *                            answers: [{ id, author, text, email, at, vendor, hidden }],
 *                            audit } ] }
 */
import { read, write } from "./store";

export const QA_KEY = "svt:qa";
import { QUESTION_MAX, ANSWER_MAX } from "./limits";
export { QUESTION_MAX, ANSWER_MAX };
const PER_TOOL = 300;
const AUDIT_MAX = 20;

const keyOf = (email) => String(email || "").trim().toLowerCase();
const clean = (s, max) => String(s ?? "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, max);
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const withAudit = (q, row) => ({ ...q, audit: [...(Array.isArray(q.audit) ? q.audit : []), row].slice(-AUDIT_MAX) });

export const readQA = () => read(QA_KEY, {});
export const saveQA = (all) => write(QA_KEY, all);

/** What a visitor may see: hidden ones gone, addresses and moderation stripped, `mine` for the viewer. */
export function publicQA(list = [], viewerEmail = "") {
  const me = keyOf(viewerEmail);
  const strip = ({ email, reviewed, reviewedBy, reviewedAt, hidden, hiddenReason, audit, answers, ...rest }) =>
    (me && keyOf(email) === me ? { ...rest, mine: true } : rest);
  return (Array.isArray(list) ? list : [])
    .filter((q) => q && !q.hidden)
    .map((q) => ({
      ...strip(q),
      answers: (q.answers || []).filter((a) => !a.hidden).map(strip)
        /* The vendor's answer first, then oldest first. */
        .sort((a, b) => Number(Boolean(b.vendor)) - Number(Boolean(a.vendor)) || String(a.at).localeCompare(String(b.at))),
    }))
    .sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

export function addQuestion(all, toolId, { author, text, email }, now = new Date().toISOString()) {
  const body = clean(text, QUESTION_MAX);
  if (body.length < 8) return { error: "Ask a question in a sentence." };
  const q = { id: newId(), author: clean(author, 60) || "Anonymous", text: body, email: keyOf(email), at: now, reviewed: false, answers: [] };
  const list = [q, ...(all[toolId] || [])].slice(0, PER_TOOL);
  return { qa: { ...all, [toolId]: list }, question: q };
}

export function addAnswer(all, toolId, questionId, { author, text, email, vendor = false }, now = new Date().toISOString()) {
  const body = clean(text, ANSWER_MAX);
  if (body.length < 2) return { error: "Write an answer first." };
  const list = all[toolId] || [];
  const q = list.find((x) => x.id === questionId && !x.hidden);
  if (!q) return { error: "That question is not here any more." };
  const a = { id: newId(), author: clean(author, 60) || "Anonymous", text: body, email: keyOf(email), at: now, vendor: Boolean(vendor) };
  const next = list.map((x) => (x.id === questionId ? { ...x, answers: [...(x.answers || []), a] } : x));
  return { qa: { ...all, [toolId]: next }, question: q, answer: a };
}

/**
 * The editor's decisions. `answerId` targets an answer inside the question.
 * fine: marks the question read. hide/unhide: kept, reversible, hide needs a
 * reason. delete: removed for good.
 */
export function moderateQA(all, toolId, questionId, action, { answerId = "", reason = "", by = "" } = {}, now = new Date().toISOString()) {
  const list = all[toolId] || [];
  const q = list.find((x) => x.id === questionId);
  if (!q) return { error: "No such question." };
  if (action === "hide" && clean(reason, 300).length < 3) return { error: "Say why it is hidden." };
  const row = { action, by, at: now, ...(answerId ? { answerId } : {}), ...(reason ? { reason: clean(reason, 300) } : {}) };

  let next;
  if (answerId) {
    if (!(q.answers || []).some((a) => a.id === answerId)) return { error: "No such answer." };
    const answers = action === "delete"
      ? q.answers.filter((a) => a.id !== answerId)
      : q.answers.map((a) => (a.id !== answerId ? a
        : action === "hide" ? { ...a, hidden: true, hiddenReason: clean(reason, 300) }
          : action === "unhide" ? (({ hidden, hiddenReason, ...r }) => r)(a) : a));
    next = list.map((x) => (x.id === questionId ? withAudit({ ...x, answers }, row) : x));
  } else if (action === "delete") {
    next = list.filter((x) => x.id !== questionId);
  } else {
    const changed = action === "fine" ? { ...q, reviewed: true, reviewedBy: by, reviewedAt: now }
      : action === "hide" ? { ...q, hidden: true, hiddenReason: clean(reason, 300), reviewed: true }
        : action === "unhide" ? (({ hidden, hiddenReason, ...r }) => r)(q) : null;
    if (!changed) return { error: "Unknown action." };
    next = list.map((x) => (x.id === questionId ? withAudit(changed, row) : x));
  }
  return { qa: { ...all, [toolId]: next } };
}

/** Every question for the admin, with the tool's name, newest first. */
export function adminQA(all = {}, nameOf = (id) => id) {
  return Object.entries(all || {}).flatMap(([toolId, list]) =>
    (list || []).map((q) => ({ ...q, toolId, toolName: nameOf(toolId) })))
    .sort((a, b) => String(b.at).localeCompare(String(a.at)));
}
