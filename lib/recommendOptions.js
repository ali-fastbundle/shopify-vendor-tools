/*
 * The choices the growth recommender offers, shared by the form and the
 * route so the two cannot disagree about what a value means. Pure and
 * client-safe: no model, no store.
 *
 * Each objective names the categories where its tools live. That mapping is
 * what the no-model fallback ranks on, and it is shown to the model as a hint
 * rather than a rule, because the best answer to "more installs from search"
 * can be a suite that also does ASO.
 */
export const BUDGETS = [
  { id: "free", label: "Nothing yet", max: 0, phrase: "no budget for tools yet" },
  { id: "low", label: "Under $50 a month", max: 50, phrase: "under $50 a month to spend" },
  { id: "mid", label: "$50 to $200 a month", max: 200, phrase: "$50 to $200 a month to spend" },
  { id: "high", label: "Over $200 a month", max: Infinity, phrase: "over $200 a month to spend" },
];

export const STAGES = [
  { id: "new", label: "Just launched, finding the first merchants" },
  { id: "growing", label: "Growing, with a few paying merchants" },
  { id: "established", label: "Established, with a steady base" },
];

export const OBJECTIVES = [
  { id: "search", label: "More installs from App Store search", want: "more installs from App Store search", cats: ["aso"] },
  { id: "market", label: "Understand competitors and the market", want: "to understand your competitors and the market", cats: ["data", "aso", "research"] },
  { id: "revenue", label: "See revenue, churn and trials clearly", want: "a clear view of revenue, churn and trials", cats: ["biz"] },
  { id: "outbound", label: "Find merchants to sell to directly", want: "to find merchants to sell to directly", cats: ["storedb", "detect"] },
  { id: "partners", label: "Grow through agencies, partners and affiliates", want: "to grow through agencies, partners and affiliates", cats: ["partner"] },
  { id: "support", label: "Handle support without hiring", want: "to handle support without hiring", cats: ["support"] },
  { id: "help", label: "Get help building or marketing the app", want: "help building or marketing the app", cats: ["talent"] },
  { id: "merchants", label: "Talk to merchants about what they need", want: "to talk to merchants about what they need", cats: ["research"] },
];

export const budgetOf = (id) => BUDGETS.find((b) => b.id === id) || null;
export const stageOf = (id) => STAGES.find((s) => s.id === id) || null;
export const objectiveOf = (id) => OBJECTIVES.find((o) => o.id === id) || null;

export const MAX_INSTALLS = 10_000_000;
