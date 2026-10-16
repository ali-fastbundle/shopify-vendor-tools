/*
 * Editor use, stored. Server only. See lib/editorUse.js for what it is.
 *
 *   svt:editoruse = { [toolId]: { value, note, date, at, by, history: [...] } }
 *
 * `value` "" is unset. The record is kept when a value is cleared, so every
 * change stays reversible and the history says what it was. `at` is when the
 * toggle changed; `date` is the date the public line uses, which defaults to
 * the day of the change. `by` is the admin's address and never leaves
 * through `publicEditorUse`.
 */
import { read, write } from "./store";
import { sanitiseEditorUse } from "./editorUse";

export const KEY = "svt:editoruse";
const MAX_HISTORY = 20;

export async function getEditorUse() { return read(KEY, {}); }

/** { [id]: { value, note, date } } for set values only. What a page may see. */
export function publicEditorUse(all = {}) {
  const out = {};
  for (const [id, r] of Object.entries(all || {})) {
    if (r?.value) out[id] = { value: r.value, note: r.note || "", date: r.date || "" };
  }
  return out;
}

/**
 * Set or clear one tool's value. `tool` is the catalogue entry, checked by
 * the caller to exist. Refuses an entry with `noRecommend`.
 */
export async function setEditorUse(tool, input, { by = "" } = {}) {
  if (!tool) return { error: "No published tool with that id." };
  if (tool.noRecommend === true) {
    return { error: `${tool.name} is excluded from recommendation, so editor use is never shown for it.` };
  }
  const clean = sanitiseEditorUse(input);
  if (clean.error) return clean;
  const all = (await getEditorUse()) || {};
  const prev = all[tool.id];
  const at = new Date().toISOString();
  const history = [
    ...(prev?.value !== undefined ? [{ value: prev.value, note: prev.note, date: prev.date, at: prev.at, by: prev.by }] : []),
    ...(prev?.history || []),
  ].slice(0, MAX_HISTORY);
  all[tool.id] = { ...clean, at, by, history };
  await write(KEY, all);
  return { record: all[tool.id] };
}
