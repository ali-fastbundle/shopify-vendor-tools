/*
 * The /about text, stored. Server only. What it is and the one rule on it are
 * in lib/aboutText.js.
 *
 *   svt:about = { name, role, paragraphs, at, by, history: [earlier versions] }
 *
 * No key means the text in the file (DEFAULT). Reset deletes the current
 * version back to that, and keeps what it replaced in history.
 */
import { read, write } from "./store";
import { DEFAULT, aboutIssues, paragraphsOf } from "./aboutText";

export const KEY = "svt:about";
const MAX_HISTORY = 10;

/** What the page shows: the saved version, or the file's. Never throws. */
export async function getAbout() {
  try {
    const r = await read(KEY, null);
    if (r?.name && r?.paragraphs?.length) return { name: r.name, role: r.role || "", paragraphs: r.paragraphs, at: r.at || "" };
  } catch {}
  return { ...DEFAULT, at: "" };
}

/** The admin's view: the current text and the history. */
export async function getAboutRecord() {
  return (await read(KEY, null)) || null;
}

export async function saveAbout({ name, role, body } = {}, by = "") {
  const issues = aboutIssues({ name, role, body });
  if (issues.length) return { error: issues.join(" ") };
  const prev = (await read(KEY, null)) || null;
  const current = prev?.paragraphs?.length ? prev : { ...DEFAULT, at: "", by: "file" };
  const next = {
    name: String(name).trim(), role: String(role || "").trim(), paragraphs: paragraphsOf(body),
    at: new Date().toISOString(), by,
    history: [{ name: current.name, role: current.role, paragraphs: current.paragraphs, at: current.at, by: current.by }, ...(prev?.history || [])].slice(0, MAX_HISTORY),
  };
  await write(KEY, next);
  return { record: next };
}

/** Back to the text in the file, keeping the replaced version in history. */
export async function resetAbout(by = "") {
  const prev = (await read(KEY, null)) || null;
  if (!prev?.paragraphs?.length) return { error: "The page already shows the text in the file." };
  const next = {
    history: [{ name: prev.name, role: prev.role, paragraphs: prev.paragraphs, at: prev.at, by: prev.by }, ...(prev.history || [])].slice(0, MAX_HISTORY),
    resetAt: new Date().toISOString(), resetBy: by,
  };
  await write(KEY, next);
  return { record: next };
}
