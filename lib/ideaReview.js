/*
 * The AI review of an idea. Server only: it reads CLAUDE.md from disk and
 * calls the model chain (invariant 20).
 *
 * The model is given CLAUDE.md in full, the published catalogue, and every
 * other idea in the backlog with its status, date and, for a dropped one, the
 * reason. It is told to look for what is already built and what was already
 * decided against before anything else, and that its job is to find the
 * objection rather than a reason to approve.
 *
 * Its answer is validated like every other model answer here: an invariant it
 * names must exist in CLAUDE.md, an idea it says this duplicates must exist in
 * the backlog, and the size and verdict must be ones we know. What fails is
 * dropped rather than shown, because an invented invariant number reads as a
 * rule and would be argued with as one.
 *
 * Advisory. It is stored with the idea and decides nothing.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { askJson, configured } from "./model";
import { TOOLS, catOf } from "./tools";
import { NEWSLETTERS } from "./newsletters";
import { EVENTS } from "./events";
import { COMMUNITIES } from "./communities";
import { SIZES, VERDICTS, ideaTitle, latestReview } from "./ideas";

/** CLAUDE.md as deployed. Traced into the route by next.config. */
export function claudeMd() {
  try { return readFileSync(join(process.cwd(), "CLAUDE.md"), "utf8"); } catch { return ""; }
}

/** Every numbered and lettered invariant heading in CLAUDE.md: { "35": "A flag may..." }. */
export function invariantRefs(md = claudeMd()) {
  const out = {};
  for (const m of md.matchAll(/^\*\*([0-9]{1,2}|[A-J])\. (.+?)\*\*/gm)) out[m[1]] = m[2].replace(/`/g, "").trim();
  return out;
}

const SYSTEM =
  "You review product ideas for watchfor.tools, a directory of tools for Shopify app vendors. " +
  "You are the skeptical second reader. Your job is to find what is wrong with an idea, what already " +
  "covers it, and what it would really cost. Do not reach for a reason to approve. A short honest " +
  "'do not do this' is a good answer. Write plainly: short sentences, no marketing words, no em dash. " +
  "Return only JSON.";

function catalogueBlock() {
  const tools = TOOLS.map((t) => `${t.id} | ${t.name} | ${catOf(t.cat).label} | ${t.one}`).join("\n");
  return `Published tools (${TOOLS.length}):\n${tools}\n\n` +
    `Published newsletters (${NEWSLETTERS.length}): ${NEWSLETTERS.map((n) => n.name).join(", ")}\n` +
    `Published events (${EVENTS.length}): ${EVENTS.map((e) => e.name).join(", ")}\n` +
    `Published communities (${COMMUNITIES.length}): ${COMMUNITIES.map((c) => c.name).join(", ") || "none"}`;
}

function backlogBlock(others) {
  if (!others.length) return "No other ideas in the backlog.";
  return others.map((i) => {
    const r = latestReview(i);
    return [
      `[${i.id}] ${i.status}, added ${String(i.createdAt).slice(0, 10)}: ${String(i.text).slice(0, 400)}`,
      i.stateNote ? `  state: ${i.stateNote}` : "",
      i.dropped ? `  dropped ${String(i.dropped.at).slice(0, 10)} because: ${i.dropped.reason}` : "",
      r ? `  last review: ${VERDICTS[r.verdict] || r.verdict}. ${r.summary || ""}` : "",
    ].filter(Boolean).join("\n");
  }).join("\n");
}

export function buildPrompt(idea, others, md = claudeMd()) {
  return `THE PROJECT RULES (CLAUDE.md, in full)
${md}

THE CATALOGUE
${catalogueBlock()}

THE REST OF THE BACKLOG
${backlogBlock(others)}

THE IDEA TO REVIEW
${idea.surface ? `Surface: ${idea.surface}\n` : ""}${idea.size ? `The editor's size guess: ${idea.size}\n` : ""}${idea.stateNote ? `What is already true about it: ${idea.stateNote}\n` : ""}${idea.text}

HOW TO REVIEW IT, IN THIS ORDER
1. Check what already exists before anything else: the features and files described in CLAUDE.md, the catalogue, and the rest of the backlog. If something covers it in full or in part, say what and where.
2. If it repeats an idea in the backlog that was dropped, or something CLAUDE.md records as decided against or removed (for example a field, badge or tool that was taken out), say when and why it was decided.
3. Name the invariants it touches by their number or letter in CLAUDE.md, and say whether it conflicts with one. Look hard at: the protected fields (watch, cat, ratings and the rest), the category colour rules, the Shopify-only boundary for tools, a listing not growing every time something changes, the card answering one question, the fold budget, drafts staying invisible, and a person approving anything public.
4. Say concretely what it would require: files, routes, store keys, data that has to be gathered by hand, and any third party whose terms matter.
5. Give your honest objections. If the idea is a bad one, say so and why.
6. Size it: "an afternoon", "a few days" or "a project".
7. Say what it depends on that does not exist yet.

Return exactly this JSON:
{"summary":"two sentences at most",
 "verdict":"go" | "doubtful" | "against",
 "requires":["one concrete piece of work per item"],
 "covered":["what already exists that covers part or all of it, and where"],
 "duplicates":[{"id":"backlog id, only if it repeats one","why":"how"}],
 "decidedBefore":"when and why this was decided against before, or empty string",
 "invariants":[{"ref":"35","how":"how it touches it","conflict":true}],
 "objections":["each one specific"],
 "size":"an afternoon" | "a few days" | "a project",
 "dependsOn":["what is needed and does not exist yet"]}`;
}

const strs = (v, n = 12, max = 400) =>
  (Array.isArray(v) ? v : []).map((s) => String(s || "").replace(/\s*—\s*/g, ", ").trim().slice(0, max)).filter(Boolean).slice(0, n);

/** Keep what can be checked and drop what cannot. Pure. */
export function validateReview(parsed = {}, { refs = {}, ids = [] } = {}) {
  const dropped = [];
  const invariants = (Array.isArray(parsed.invariants) ? parsed.invariants : []).flatMap((x) => {
    const ref = String(x?.ref ?? "").replace(/^#|^invariant\s*/i, "").trim().toUpperCase();
    if (!refs[ref]) { dropped.push(`invariant "${x?.ref}" is not in CLAUDE.md`); return []; }
    return [{ ref, name: refs[ref], how: String(x.how || "").replace(/\s*—\s*/g, ", ").slice(0, 400), conflict: x.conflict === true }];
  }).slice(0, 12);
  const duplicates = (Array.isArray(parsed.duplicates) ? parsed.duplicates : []).flatMap((d) => {
    if (!ids.includes(String(d?.id))) { if (d?.id) dropped.push(`backlog id "${d.id}" does not exist`); return []; }
    return [{ id: String(d.id), why: String(d.why || "").slice(0, 300) }];
  });
  const verdict = VERDICTS[parsed.verdict] ? parsed.verdict : "doubtful";
  if (!VERDICTS[parsed.verdict]) dropped.push(`verdict "${parsed.verdict}" is not one of ours, shown as doubtful`);
  const size = SIZES.includes(parsed.size) ? parsed.size : "";
  if (!size && parsed.size) dropped.push(`size "${parsed.size}" is not one of ours`);
  return {
    summary: String(parsed.summary || "").replace(/\s*—\s*/g, ", ").slice(0, 500),
    verdict, size, invariants, duplicates,
    decidedBefore: String(parsed.decidedBefore || "").slice(0, 500),
    requires: strs(parsed.requires),
    covered: strs(parsed.covered),
    objections: strs(parsed.objections),
    dependsOn: strs(parsed.dependsOn),
    dropped,
  };
}

/** Review one idea against everything else. Returns { review } or { error }. */
export async function reviewIdea(idea, all = []) {
  if (!configured()) return { error: "No model key is set, so ideas cannot be reviewed here." };
  const md = claudeMd();
  if (!md) return { error: "CLAUDE.md is not readable on this deployment, and a review without it would be guessing." };
  const others = all.filter((i) => i.id !== idea.id);
  try {
    const { data, provider } = await askJson({
      system: SYSTEM, prompt: buildPrompt(idea, others, md), maxTokens: 3000, timeoutMs: 180_000,
    });
    const review = validateReview(data, { refs: invariantRefs(md), ids: others.map((i) => i.id) });
    return { review: { ...review, provider, title: ideaTitle(idea) } };
  } catch (e) {
    return { error: `The review failed: ${String(e?.message || e).slice(0, 200)}` };
  }
}
