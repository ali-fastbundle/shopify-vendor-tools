/*
 * Target dates for drafted blog posts (2026-11-06), the blog calendar's one
 * piece of state that is not a file.
 *
 *   svt:blog:schedule = { [slug]: { date: "YYYY-MM-DD", by, at } }
 *
 * A target date is a plan, not a publication: nothing reads it to publish
 * anything. A post stays `draft: true` in its file until the editor presses
 * Publish on the day, which runs the readiness check and commits the file
 * (lib/publish.js, commitPostPublish). Like a hold on a catalogue draft, it is
 * admin state that says nothing a visitor can see.
 */
import { read, write } from "./store";

export const SCHEDULE = "svt:blog:schedule";
const isDay = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || "")) && Number.isFinite(Date.parse(`${s}T00:00:00Z`));

export async function getSchedule() {
  const s = await read(SCHEDULE, {});
  return s && typeof s === "object" ? s : {};
}

/** Set a drafted post's target date, or clear it with date "". */
export async function setPostDate({ slug, date, by = "" }) {
  if (!/^[a-z0-9-]{3,80}$/.test(String(slug || ""))) return { error: "That is not a post slug." };
  if (date && !isDay(date)) return { error: "That is not a date." };
  const all = await getSchedule();
  if (date) all[slug] = { date, by, at: new Date().toISOString() };
  else delete all[slug];
  await write(SCHEDULE, all);
  return { ok: true, schedule: all };
}

/** A published post's target date is spent: drop it so it does not linger. */
export async function clearPostDate(slug) {
  const all = await getSchedule();
  if (!all[slug]) return;
  delete all[slug];
  await write(SCHEDULE, all);
}
