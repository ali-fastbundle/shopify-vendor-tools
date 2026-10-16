/*
 * Which tools genuinely compete, and how two of them differ.
 *
 * A pair is a rivalry when one of three things is true, and nothing else
 * makes one:
 *   same category   the same primary `cat`
 *   named rivals    `competes` on either entry (editorial, lib/tools.js)
 *   vendor named    a vendor's own comparison page names the other, as
 *                   recorded by the discovery pass (`rivals`, and older
 *                   findings that have since been listed)
 *
 * That is about 145 pairs out of the 1,128 a full matrix would make. The
 * matrix is the programmatic churn this directory exists against: a page
 * comparing a support agency with a store database is a page nobody needs.
 *
 * Differences are built in code from confirmed structured data
 * (lib/categories.js) and never written by a model. Where either tool is not
 * confirmed, no difference is stated, and the page says so rather than
 * guessing from prose.
 */
import { attributesFor, attributeValue, formatValue, isUnknown, lowestMonthlyUSD, integrationLabel } from "./categories";
import { findListed } from "./suggestions";

export const pairKey = (a, b) => [a, b].sort().join("|");
export const pairSlug = (a, b) => [a, b].sort().join("-vs-");
export const parseSlug = (slug) => {
  const parts = String(slug || "").split("-vs-");
  return parts.length === 2 && parts[0] && parts[1] && parts[0] !== parts[1] ? parts : null;
};

/** Every genuine pair: Map("a|b" -> { a, b, why: [...] }). */
export function rivalPairs(tools = [], discovery = {}) {
  const ids = new Set(tools.map((t) => t.id));
  const byName = new Map(tools.map((t) => [t.name.toLowerCase(), t.id]));
  const pairs = new Map();
  const add = (a, b, why) => {
    if (!a || !b || a === b || !ids.has(a) || !ids.has(b)) return;
    const k = pairKey(a, b);
    const p = pairs.get(k) || { a: k.split("|")[0], b: k.split("|")[1], why: [] };
    if (!p.why.includes(why)) p.why.push(why);
    pairs.set(k, p);
  };
  for (const x of tools) {
    for (const y of tools) {
      if (x.id < y.id && x.cat === y.cat) add(x.id, y.id, "same category");
    }
    for (const c of x.competes || []) add(x.id, c, "named rivals");
  }
  for (const r of discovery?.rivals || []) add(r.a, r.b, "named on a vendor's comparison page");
  /* Findings stored before `rivals` existed, for a name that is now listed. */
  for (const f of discovery?.findings || []) {
    const listed = findListed({ name: f.name, url: f.url || "", domain: "", kind: "tool" }, tools);
    if (!listed) continue;
    for (const by of f.namedBy || []) add(byName.get(String(by).toLowerCase()), listed.id, "named on a vendor's comparison page");
  }
  return pairs;
}

/** The tools that compete with one: named rivals first, then the category, wind-downs last. */
export function alternativesOf(tool, tools, pairs) {
  const out = [];
  for (const p of pairs.values()) {
    const other = p.a === tool.id ? p.b : p.b === tool.id ? p.a : null;
    const t = other && tools.find((x) => x.id === other);
    if (t) out.push({ tool: t, why: p.why });
  }
  const named = (x) => (x.why.some((w) => w !== "same category") ? 0 : 1);
  return out.sort((x, y) => named(x) - named(y) || Number(Boolean(x.tool.dying)) - Number(Boolean(y.tool.dying)) || x.tool.name.localeCompare(y.tool.name));
}

/*
 * How `alt` differs from `subject`, as short sentences about `alt`. Only from
 * confirmed data on both, only where both values are known and differ, at
 * most `max`. Empty means nothing can be stated, not that they are the same.
 */
export function differences(subject, alt, max = 4) {
  const s = subject?.structured, a = alt?.structured;
  if (!s || !a || subject.structuredStale || alt.structuredStale) return [];
  const out = [];
  const name = subject.name;

  const sp = s.pricing, ap = a.pricing;
  if (ap.free === true && sp.free === false) out.push(`Has a free plan. ${name} does not.`);
  else if (ap.free === false && sp.free === true) out.push(`Has no free plan. ${name} does.`);
  if (ap.published === false && sp.published === true) out.push(`Does not publish its price. ${name} does.`);
  else if (ap.published === true && sp.published === false) out.push(`Publishes its price. ${name} does not.`);
  const al = lowestMonthlyUSD(ap), sl = lowestMonthlyUSD(sp);
  if (al !== null && sl !== null && al !== sl) {
    out.push(`Paid plans start at $${Math.round(al)} a month, against $${Math.round(sl)} for ${name}.`);
  }

  if (alt.cat === subject.cat) {
    for (const attr of attributesFor(alt.cat).filter((x) => x.comparable)) {
      const av = attributeValue(attr, a), sv = attributeValue(attr, s);
      if (isUnknown(av) || isUnknown(sv) || av === sv) continue;
      out.push(`${attr.label}: ${formatValue(attr, av)}, against ${formatValue(attr, sv)} for ${name}.`);
    }
  }

  const extra = (a.integrations || []).filter((i) => !(s.integrations || []).includes(i));
  if (extra.length) out.push(`Lists ${extra.map(integrationLabel).join(", ")}, which ${name} does not list.`);

  return out.slice(0, max);
}

/** Whether a page has enough confirmed data to be worth a search engine's time. */
export const confirmed = (t) => Boolean(t?.structured) && !t.structuredStale;
