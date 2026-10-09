/*
 * The growth recommender: one app's situation in, three tools from the
 * catalogue out, each with a reason tied to that situation.
 *
 * Same provider chain as the matcher (lib/model.js), and the same three
 * guarantees, in the same order:
 *
 *  1. What may be recommended is decided before the prompt is built. Anything
 *     `noRecommend` (invariant 35: the editor is connected to it), anything
 *     winding down, and anything over the stated budget never reaches the
 *     model, so it cannot be picked. The model is shown the filtered list and
 *     its answer is validated against that same list, so an id it invented or
 *     remembered cannot come back either.
 *  2. Every model path has a non-model path (invariant 20). No key, a timeout,
 *     unparseable JSON or too few valid picks all land on `fallbackPicks`,
 *     which ranks by objective, budget and category and writes its reasons
 *     from the person's own inputs. The run records which path answered.
 *  3. Nothing is invented about a tool. The model is given each tool's
 *     one-line summary and price and told to say nothing beyond them, and a
 *     reason is length-capped and scrubbed of em-dashes on the way out.
 *
 * Every run is stored (`svt:recommend:runs`) with what was asked and what was
 * answered, and without the asker's address. What app teams say they need,
 * at what stage and budget, is the most useful thing this produces, and it
 * is useful in aggregate; the address would add nothing to that and would
 * break the promise the sign-in form makes about what an account stores.
 */
import { pushCapped, readCapped } from "./store";
import { askJson } from "./model";
import { catOf, catsOf, recommendable } from "./tools";
import { budgetOf, stageOf, objectiveOf } from "./recommendOptions";
import { monthsSince } from "./appListing";

export const RUNS_KEY = "svt:recommend:runs";
export const RUNS_MAX = 2000;

/* The lowest dollar figure a price line states, or null when it states none. */
export const lowestPrice = (price) => {
  const figures = [...String(price || "").matchAll(/\$\s?(\d[\d,]*(?:\.\d+)?)/g)].map((m) => Number(m[1].replace(/,/g, "")));
  return figures.length ? Math.min(...figures) : null;
};

/*
 * Within budget. A free plan fits every budget. "Nothing yet" admits only
 * those. Otherwise the lowest published figure has to fit; a tool with no
 * figure at all ("Not published") is admitted only on the two larger
 * budgets, because "ask them" is not an answer for somebody with $30.
 */
export function withinBudget(tool, budgetId) {
  const b = budgetOf(budgetId);
  if (!b) return true;
  if (tool.free) return true;
  if (b.max === 0) return false;
  const low = lowestPrice(tool.price);
  if (low === null) return b.max >= 200;
  return low <= b.max;
}

/** What may be recommended for this situation. */
export function candidates(tools, input, app = {}) {
  const own = String(app.name || "").toLowerCase();
  return tools.filter((t) => recommendable(t) && !t.dying && !t.draft && withinBudget(t, input.budget)
    && !(own && t.name.toLowerCase() === own));
}

/* ---------------- the prompt ---------------- */

export const SYSTEM = `You recommend tools to the team behind one Shopify app, from a fixed catalogue of tools built for Shopify app developers.

Pick exactly three tools from the catalogue given. Use only ids from that list.

For each, write a reason of one or two sentences that ties the tool to this team's situation: their objective, budget, stage, install count, rating and reviews, how long ago they launched, or their category. A reason that would read the same for any app is a bad reason.

Say nothing about a tool beyond its summary, price and tags as given. Do not invent features, figures or results, and do not promise outcomes.

Plain, factual English. No marketing language, no exclamation marks, no em dashes.

Return only JSON: {"picks":[{"id":"...","reason":"..."}]}`;

export function situationText(input, app = {}) {
  const months = monthsSince(app.launched);
  return [
    `App: ${app.name || "unknown (the listing could not be read)"}`,
    app.category ? `App Store category: ${app.category}` : "",
    app.rating !== undefined ? `Rating: ${app.rating} from ${app.reviews ?? 0} reviews` : "",
    months !== null ? `Launched: ${app.launched} (${months} months ago)` : "",
    app.pricing ? `Its own pricing: ${app.pricing}` : "",
    app.builtForShopify ? "Has the Built for Shopify badge" : "",
    `Installs, as the team states them: ${input.installs}`,
    `Stage: ${stageOf(input.stage)?.label}`,
    `Budget for tools: ${budgetOf(input.budget)?.label}`,
    `Objective: ${objectiveOf(input.objective)?.label}`,
    `Categories that usually serve this objective: ${(objectiveOf(input.objective)?.cats || []).map((c) => catOf(c).label).join(", ")}`,
    "Keyword positions: not available (no free source permits reading them).",
  ].filter(Boolean).join("\n");
}

export function buildPrompt(list, input, app) {
  const catalogue = list.map((t) =>
    `${t.id} | ${t.name} | ${catsOf(t).map((c) => catOf(c).label).join(", ")} | ${t.price} | ${t.one} | tags: ${(t.tags || []).join(", ")}`).join("\n");
  return `The team's situation:\n${situationText(input, app)}\n\nCatalogue (id | name | categories | price | summary | tags):\n${catalogue}`;
}

/* ---------------- validating an answer ---------------- */

const tidy = (s) => String(s || "").replace(/\s*—\s*/g, ", ").replace(/\s+/g, " ").trim().slice(0, 400);

/** Keep valid, distinct picks from a model's answer. Pure. */
export function cleanPicks(data, list) {
  const byId = new Map(list.map((t) => [t.id, t]));
  const seen = new Set();
  const out = [];
  for (const p of (data && Array.isArray(data.picks) ? data.picks : [])) {
    const t = byId.get(p && p.id);
    const reason = tidy(p && p.reason);
    if (!t || seen.has(t.id) || reason.length < 20) continue;
    seen.add(t.id);
    out.push({ id: t.id, name: t.name, reason });
    if (out.length === 3) break;
  }
  return out;
}

/* ---------------- without a model ---------------- */

/** Rank by objective, then budget fit, then a free plan, and say why in the person's own terms. Pure. */
export function fallbackPicks(list, input, app = {}, exclude = []) {
  const obj = objectiveOf(input.objective);
  const cats = obj ? obj.cats : [];
  const score = (t) => (cats.includes(t.cat) ? 4 : 0) + (catsOf(t).some((c) => cats.includes(c)) ? 2 : 0)
    + (input.budget === "free" || input.budget === "low" ? (t.free ? 1 : 0) : 0);
  const budget = budgetOf(input.budget);
  const installs = Number(input.installs);
  return list
    .filter((t) => !exclude.includes(t.id) && score(t) > 0)
    .sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name))
    .slice(0, 3)
    .map((t) => ({
      id: t.id, name: t.name,
      reason: tidy(`You want ${obj ? obj.want : "to grow"}, at ${installs.toLocaleString("en-US")} installs with ${budget ? budget.phrase : "your budget"}. ${t.name} is in ${catOf(t.cat).label} and priced ${t.price.replace(/\.$/, "")}: ${t.one.charAt(0).toLowerCase()}${t.one.slice(1)}`),
    }));
}

/* ---------------- one run ---------------- */

export async function recommend(tools, input, app = {}) {
  const list = candidates(tools, input, app);
  let picks = [];
  let provider = "";
  let path = "model";
  try {
    const res = await askJson({ system: SYSTEM, prompt: buildPrompt(list, input, app), maxTokens: 900, timeoutMs: 30_000 });
    provider = res.provider;
    picks = cleanPicks(res.data, list);
  } catch (e) {
    console.error("[recommend] model unavailable —", e.message);
  }
  if (picks.length < 3) {
    const fill = fallbackPicks(list, input, app, picks.map((p) => p.id));
    path = picks.length ? "partial" : "fallback";
    picks = [...picks, ...fill].slice(0, 3);
  }
  return { picks, provider, path, considered: list.length };
}

export async function saveRun(row) {
  await pushCapped(RUNS_KEY, [row], RUNS_MAX);
}

export const readRuns = (limit = 500) => readCapped(RUNS_KEY, limit);

/** What people are asking for, counted. Pure, for the admin summary and its test. */
export function summariseRuns(runs = []) {
  const count = (f) => Object.entries(runs.reduce((a, r) => { const k = f(r); if (k) a[k] = (a[k] || 0) + 1; return a; }, {}))
    .sort((a, b) => b[1] - a[1]);
  return {
    total: runs.length,
    objectives: count((r) => objectiveOf(r.objective)?.label),
    budgets: count((r) => budgetOf(r.budget)?.label),
    stages: count((r) => stageOf(r.stage)?.label),
    categories: count((r) => r.app && r.app.category),
    picked: Object.entries(runs.flatMap((r) => (r.picks || []).map((p) => p.name)).reduce((a, n) => (a[n] = (a[n] || 0) + 1, a), {}))
      .sort((a, b) => b[1] - a[1]),
    fallback: runs.filter((r) => r.path !== "model").length,
  };
}
