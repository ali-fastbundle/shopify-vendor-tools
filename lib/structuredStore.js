/*
 * Confirmed structured data, stored. Server only. The shapes are in
 * lib/categories.js and the proposals in lib/structured.js.
 *
 *   svt:structured = { [toolId]: { data: { attrs, integrations, pricing },
 *                                  confirmedAt, by, history: [earlier] } }
 *
 * A proposal is never public. Confirming is the editor reading the proposal
 * against the note, editing what is wrong, and pressing Confirm; only then do
 * the attributes, integrations and derived price reach a page. Clearing a
 * confirmation keeps the record's history, so it is reversible.
 */
import { read, write } from "./store";
import { sanitiseStructured } from "./categories";

export const KEY = "svt:structured";
const MAX_HISTORY = 10;

export async function getStructured() { return (await read(KEY, {})) || {}; }

/** { [toolId]: { ...data, confirmedAt } } for confirmed tools only. What a page may see. */
export function publicStructured(all = {}) {
  const out = {};
  for (const [id, r] of Object.entries(all || {})) {
    if (r?.data && r.confirmedAt) out[id] = { ...r.data, confirmedAt: r.confirmedAt };
  }
  return out;
}

export async function confirmStructured(tool, input, by = "") {
  if (!tool) return { error: "No published tool with that id." };
  const clean = sanitiseStructured(tool.cat, input);
  if (clean.error) return clean;
  const all = await getStructured();
  const prev = all[tool.id];
  all[tool.id] = {
    data: clean.data, confirmedAt: new Date().toISOString(), by,
    history: [...(prev?.data ? [{ data: prev.data, confirmedAt: prev.confirmedAt, by: prev.by }] : []), ...(prev?.history || [])].slice(0, MAX_HISTORY),
  };
  await write(KEY, all);
  return { record: all[tool.id] };
}

export async function clearStructured(toolId) {
  const all = await getStructured();
  const prev = all[toolId];
  if (!prev?.data) return { error: "Nothing confirmed for that tool." };
  all[toolId] = { history: [{ data: prev.data, confirmedAt: prev.confirmedAt, by: prev.by }, ...(prev.history || [])].slice(0, MAX_HISTORY) };
  await write(KEY, all);
  return { record: all[toolId] };
}
