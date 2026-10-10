/*
 * The growth recommender's questions, choices and answer shape, shared by the
 * flow and the routes so the two cannot disagree about what an answer is.
 * Pure and client-safe: no model, no store.
 *
 * One question per screen, in five parts. Every question can be skipped
 * except the listing URL, and a skipped one is passed to the model and shown
 * in the answer as something the picks had less to go on.
 */

export const BUDGETS = [
  { id: "free", label: "Nothing yet", max: 0, phrase: "no budget for tools yet" },
  { id: "low", label: "Under $50 a month", max: 50, phrase: "under $50 a month to spend" },
  { id: "mid", label: "$50 to $200 a month", max: 200, phrase: "$50 to $200 a month to spend" },
  { id: "high", label: "Over $200 a month", max: Infinity, phrase: "over $200 a month to spend" },
];

export const REVENUE = [
  { id: "none", label: "No revenue yet" },
  { id: "under1k", label: "Under $1,000 a month" },
  { id: "1to10k", label: "$1,000 to $10,000 a month" },
  { id: "10to50k", label: "$10,000 to $50,000 a month" },
  { id: "over50k", label: "Over $50,000 a month" },
];

export const TRIED = [
  { id: "aso", label: "Keyword and listing work for App Store search" },
  { id: "ads", label: "App Store ads" },
  { id: "partners", label: "A partner, agency or affiliate programme" },
  { id: "outbound", label: "Reaching out to merchants directly" },
  { id: "content", label: "Content, SEO or a blog" },
  { id: "pricing", label: "Changing the free plan, trial or pricing" },
  { id: "help", label: "Hiring a freelancer or agency to help" },
  { id: "nothing", label: "Nothing yet" },
];

export const TIMEFRAMES = [
  { id: "weeks", label: "In the next few weeks" },
  { id: "quarter", label: "This quarter" },
  { id: "year", label: "This year" },
  { id: "none", label: "No deadline" },
];

/*
 * What a need sounds like, and where its tools live. Used two ways: by the
 * no-model path to rank the catalogue from free text, and by the run summary
 * on /admin to count what people are asking for. The model is not limited to
 * it; it reads the answers themselves.
 */
export const THEMES = [
  { id: "search", label: "More installs from App Store search", cats: ["aso"],
    words: ["aso", "keyword", "search", "rank", "ranking", "installs", "install", "listing", "visibility", "discover", "found", "organic", "app store"] },
  { id: "market", label: "Understand competitors and the market", cats: ["data", "aso", "research"],
    words: ["competitor", "competition", "market", "benchmark", "category", "rivals", "landscape"] },
  { id: "revenue", label: "See revenue, churn and trials clearly", cats: ["biz"],
    words: ["revenue", "mrr", "churn", "trial", "billing", "uninstall", "retention", "analytics", "metrics", "cancel", "subscription"] },
  { id: "outbound", label: "Find merchants to sell to directly", cats: ["storedb", "detect"],
    words: ["outbound", "lead", "leads", "prospect", "cold", "outreach", "sell to", "contact", "sales", "stores using", "find merchants", "target"] },
  { id: "partners", label: "Grow through agencies, partners and affiliates", cats: ["partner"],
    words: ["partner", "partners", "agency", "agencies", "affiliate", "affiliates", "referral", "referrals", "reseller"] },
  { id: "support", label: "Handle support without hiring", cats: ["support"],
    words: ["support", "ticket", "tickets", "helpdesk", "help desk", "customer service", "inbox", "chat"] },
  { id: "help", label: "Get help building or marketing the app", cats: ["talent"],
    words: ["developer", "hire", "freelancer", "contractor", "expert", "build", "marketing help", "designer"] },
  { id: "merchants", label: "Talk to merchants about what they need", cats: ["research"],
    words: ["interview", "feedback", "talk to merchants", "user research", "validate", "what merchants want", "survey"] },
];

const scored = (text) => {
  const t = ` ${String(text || "").toLowerCase()} `;
  return THEMES.map((th) => ({ th, hits: th.words.filter((w) => t.includes(w)).length }))
    .filter((x) => x.hits > 0).sort((a, b) => b.hits - a.hits);
};

/** Themes a piece of text points at, strongest first. Pure. */
export const themesOf = (text) => scored(text).map((x) => x.th);

/*
 * Only the themes the text is mostly about. A keyword table cannot read "we
 * cannot hire", so one stray word is not allowed to outvote four: a theme is
 * kept only when it is within one hit of the strongest. Pure.
 */
export function strongThemes(text) {
  const all = scored(text);
  if (!all.length) return [];
  const top = all[0].hits;
  return all.filter((x) => x.hits >= Math.max(1, top - 1)).map((x) => x.th);
}

/* ---------------- the flow ---------------- */

export const PARTS = ["Your app", "Where you are", "What is not working", "What you want", "Review"];

/*
 * Four priming screens before any question. Each advances on a button whose
 * label is an answer, so moving on is agreeing to something rather than
 * pressing Next.
 */
export const PRIMING = [
  { id: "prime1", title: "Let's find the right tools.", body: "About five minutes. Your answers save as you go.", ok: "Let's go" },
  { id: "prime2", title: "We'll go through a few questions together.", body: "Five short parts, one question at a time. Nothing technical.", ok: "Sounds good" },
  { id: "prime3", title: "The more you tell us, the better the answer.", body: "Thin answers get generic recommendations. Take the five minutes.", ok: "Got it" },
  { id: "prime4", title: "Say it how you'd say it out loud.", body: "Your words, not tidy ones. Half sentences are fine.", ok: "Makes sense" },
];

/*
 * The questions, in order. `key` is the answer it writes; `short` is how the
 * review screen and the answer name it. `confirm` is the listing check, a
 * screen of its own between the URL and Part 2.
 */
export const QUESTIONS = [
  { id: "url", part: 0, key: "url", kind: "url", required: true, short: "Listing",
    heading: "Which app is this for?",
    help: "Paste its Shopify App Store listing URL. We read that one public page and nothing else." },
  { id: "confirm", part: 0, key: "app", kind: "confirm", short: "App",
    heading: "Is this your app?",
    help: "This is what the listing says. If it is the wrong app, fix the link." },
  { id: "installs", part: 1, key: "installs", kind: "number", short: "Installs",
    heading: "Roughly how many stores have it installed?",
    help: "A rough number is fine. The App Store does not show this, so it only comes from you." },
  { id: "revenue", part: 1, key: "revenue", kind: "choice", options: REVENUE, short: "Revenue",
    heading: "Where is revenue at?",
    help: "Optional. It changes what is worth paying for." },
  { id: "tried", part: 1, key: "tried", kind: "multi", options: TRIED, short: "Already tried",
    heading: "What have you already tried?",
    help: "Pick everything that applies, so we do not suggest what you have done." },
  { id: "problem", part: 2, key: "problem", kind: "prose", rows: 7, max: 2000, short: "Not working",
    heading: "What is not working right now?",
    help: "This is the answer that decides how good the recommendations are, so it gets its own screen. What you tried, what happened, what you expected instead." },
  { id: "objective", part: 3, key: "objective", kind: "prose", rows: 3, max: 600, short: "Objective",
    heading: "What do you want to happen next?",
    help: "In your words. More installs, fewer uninstalls, your first agency partner, whatever it really is." },
  { id: "budget", part: 3, key: "budget", kind: "choice", options: BUDGETS, short: "Budget",
    heading: "What could you spend on tools each month?",
    help: "A range is enough. Nothing over it will be recommended." },
  { id: "timeframe", part: 3, key: "timeframe", kind: "choice", options: TIMEFRAMES, short: "Timeframe",
    heading: "When do you need this working?",
    help: "Something to show in weeks and something that pays off over a year are different tools." },
  { id: "review", part: 4, kind: "review", short: "Review",
    heading: "Here is everything you told us.",
    help: "Change anything in place, then get your picks." },
];

export const SCREENS = [...PRIMING.map((p) => p.id), ...QUESTIONS.map((q) => q.id)];
export const questionOf = (id) => QUESTIONS.find((q) => q.id === id) || null;
export const budgetOf = (id) => BUDGETS.find((b) => b.id === id) || null;
export const optionLabel = (options, id) => options.find((o) => o.id === id)?.label || "";

export const MAX_INSTALLS = 10_000_000;

/*
 * The answers, as stored and as sent. Everything is trimmed and capped, and an
 * unknown choice id is dropped rather than kept, so a stored draft can only
 * ever hold values this file defines. Pure; the routes run it on every write.
 */
const text = (v, max) => String(v ?? "").replace(/\u0000/g, "").trim().slice(0, max);
const pickId = (v, options) => (options.some((o) => o.id === v) ? v : null);
const ANSWERED_KEYS = ["url", "installs", "revenue", "tried", "problem", "objective", "budget", "timeframe"];

export function sanitiseAnswers(a = {}) {
  const app = a.app && typeof a.app === "object" ? {
    name: text(a.app.name, 120), category: text(a.app.category, 60),
    rating: Number.isFinite(Number(a.app.rating)) && a.app.rating !== null && a.app.rating !== "" ? Number(a.app.rating) : null,
    reviews: Number.isInteger(Number(a.app.reviews)) && a.app.reviews !== null && a.app.reviews !== "" ? Number(a.app.reviews) : null,
    launched: /^\d{4}-\d{2}-\d{2}$/.test(String(a.app.launched || "")) ? a.app.launched : "",
  } : null;
  const installs = Number(a.installs);
  return {
    url: text(a.url, 300),
    app: app && app.name ? app : null,
    installs: a.installs === null || a.installs === "" || a.installs === undefined || !Number.isInteger(installs) || installs < 0 || installs > MAX_INSTALLS ? null : installs,
    revenue: pickId(a.revenue, REVENUE),
    tried: [...new Set((Array.isArray(a.tried) ? a.tried : []).filter((t) => TRIED.some((o) => o.id === t)))],
    problem: text(a.problem, 2000),
    objective: text(a.objective, 600),
    budget: pickId(a.budget, BUDGETS),
    timeframe: pickId(a.timeframe, TIMEFRAMES),
  };
}

export const sanitiseSkipped = (s) => [...new Set((Array.isArray(s) ? s : []).filter((k) => ANSWERED_KEYS.includes(k) && k !== "url"))];

/** Whether a question has an answer, as distinct from being skipped. */
export function answered(key, a) {
  const v = a?.[key];
  if (key === "tried") return Array.isArray(v) && v.length > 0;
  return v !== null && v !== undefined && v !== "";
}

/** The answer as one line of words, for the review screen and the output. */
export function answerText(key, a) {
  const v = a?.[key];
  if (!answered(key, a)) return "";
  if (key === "installs") return `${Number(v).toLocaleString("en-US")} installs`;
  if (key === "revenue") return optionLabel(REVENUE, v);
  if (key === "budget") return optionLabel(BUDGETS, v);
  if (key === "timeframe") return optionLabel(TIMEFRAMES, v);
  if (key === "tried") return v.map((t) => optionLabel(TRIED, t)).join(", ");
  return String(v);
}
