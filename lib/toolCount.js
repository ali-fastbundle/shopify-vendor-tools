/*
 * The public tool count, in one place.
 *
 * What it means: every published entry, counted once. Published is the file
 * catalogue (lib/tools.js) plus what was published from the admin queue
 * (svt:entries, lib/entries.js catalogueTools), minus drafts. Once means by
 * id, however many categories a tool is filed in: a tool in three categories
 * is one tool in the total and one in each of the three category counts. A
 * tool that is winding down is still listed, so it still counts.
 *
 * Why it exists: the sidebar counted the file alone and the directory heading
 * counted the file plus the queue, so the live site said 54 in one place and
 * 56 in the other. That is the same split lib/ogCard.js was built to end for
 * the share card, and it came back because the counting was still written out
 * by each surface. Now every surface that states a number of tools calls this
 * and nothing else: the sidebar and its category list, the directory heading,
 * the share card, /categories, llms.txt and the announcement figures.
 * scripts/tool-count-test.mjs fails if any two of them disagree.
 *
 * Pure and client-safe. The server read with its cache is lib/toolCountStore.js.
 */
import { published } from "./drafts";
import { CATEGORIES, isInCat, isPrimaryCat } from "./tools";

export function countTools(tools = []) {
  const seen = new Set();
  const list = [];
  for (const t of published(Array.isArray(tools) ? tools : [])) {
    if (t && t.id && !seen.has(t.id)) { seen.add(t.id); list.push(t); }
  }
  const byCategory = {};
  const primaryByCategory = {};
  for (const c of CATEGORIES) {
    byCategory[c.id] = list.filter((t) => isInCat(t, c.id)).length;
    primaryByCategory[c.id] = list.filter((t) => isPrimaryCat(t, c.id)).length;
  }
  /* Most tools first, then by name: the order every category list uses. */
  const order = [...CATEGORIES]
    .sort((a, b) => byCategory[b.id] - byCategory[a.id] || a.label.localeCompare(b.label))
    .map((c) => c.id);
  return { total: list.length, byCategory, primaryByCategory, order };
}
