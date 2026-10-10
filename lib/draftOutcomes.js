import { read, write } from "./store";
import { ALL_TOOLS } from "./tools";
import { ALL_NEWSLETTERS } from "./newsletters";
import { ALL_EVENTS } from "./events";
import { ALL_COMMUNITIES } from "./communities";
import { ALL_PODCASTS } from "./podcasts";

/*
 * The two outcomes a draft has besides publishing.
 *
 * DISCARD removes the entry from its source file by commit (lib/publish.js),
 * and records here what was decided and why: the name, the domain, the URL,
 * the reason, who and when, the commit, and the entry as it stood. The commit
 * is the record that can be reverted; this is the one the rest of the console
 * reads, so a discarded name shows as "previously discarded: <reason>" when it
 * is suggested again or turns up in discovery, rather than as new and worth
 * another round of research.
 *
 * A record whose id is back in a catalogue file (the commit was reverted) is
 * inert: `liveDiscards` drops it, so bringing an entry back needs nothing
 * here. It is kept rather than deleted, because "this was discarded once,
 * then restored" is history worth having.
 *
 * HOLD keeps a draft a draft and moves it into a collapsed "On hold" group,
 * with a note saying what it is waiting on. It is never a file edit: being on
 * hold says nothing a visitor can see and nothing about whether the entry is
 * published, which stays the file's job alone (invariant 12). It is admin
 * state, and "move it back" is deleting the key.
 *
 * Neither is ever served publicly. Both are read only by /admin and by the
 * server-side cross-references.
 */

export const DISCARDED = "svt:discarded";
export const HOLDS = "svt:drafts:hold";

const keyOf = (kind, id) => `${kind}:${id}`;

const domainOf = (e) => {
  const v = String(e?.domain || e?.url || "").trim();
  try { return new URL(/^https?:\/\//.test(v) ? v : `https://${v}`).hostname.replace(/^www\./, ""); }
  catch { return ""; }
};

export async function getDiscards() {
  const all = await read(DISCARDED, {});
  return Object.values(all || {}).sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

export async function recordDiscard({ kind, entry, reason, by, sha = "", url = "" }) {
  const all = await read(DISCARDED, {});
  all[keyOf(kind, entry.id)] = {
    key: keyOf(kind, entry.id), kind, id: entry.id, name: entry.name || entry.id,
    domain: domainOf(entry), url: entry.url || "",
    reason: String(reason || "").replace(/\s+/g, " ").trim(),
    at: new Date().toISOString(), by, sha, commitUrl: url,
    // The research, as it stood. The commit has it too; this is readable
    // without opening git.
    entry,
  };
  await write(DISCARDED, all);
  return all[keyOf(kind, entry.id)];
}

/** Discards that still stand: their id is not back in any catalogue file. */
export function liveDiscards(discards = [], fileIds = new Set()) {
  return (Array.isArray(discards) ? discards : []).filter((d) => d && !fileIds.has(keyOf(d.kind, d.id)));
}

/*
 * Which build this server is. The Drafts panel renders with it and sends it
 * back with every action, because the panel and the action read the same
 * catalogue file from whichever deployment served them, and those differ for
 * the minute after any commit. Four publishes in 47 seconds left a page
 * offering RetailFest Connect as a draft after the server had published it,
 * and the press was answered "No draft with that id here", which was true and
 * explained nothing. An action from an older page is now refused by name.
 */
export const BUILD = process.env.VERCEL_GIT_COMMIT_SHA || "dev";

const CATALOGUES = { tool: ALL_TOOLS, newsletter: ALL_NEWSLETTERS, event: ALL_EVENTS, group: ALL_COMMUNITIES, podcast: ALL_PODCASTS };
const FILE_OF = { tool: "lib/tools.js", newsletter: "lib/newsletters.js", event: "lib/events.js", group: "lib/communities.js", podcast: "lib/podcasts.js" };
const short = (b) => String(b || "none").slice(0, 7);

/**
 * The one draft lookup every draft action uses. Returns `{ entry }` or
 * `{ error, status }`, and every error says which of the three things
 * disagreed: the build the page was rendered by, the id, or the entry's state
 * in this build. Exact id match only, and the name the page showed must be
 * the name this build has, so a reused or edited id cannot be acted on blind.
 */
export function draftFor({ kind, id, name, build }) {
  const list = CATALOGUES[kind];
  if (!list) return { status: 400, error: `"${kind}" is not a kind of entry kept in a file.` };
  if (build !== BUILD) {
    return { status: 409, error: `This page was rendered by build ${short(build)} and the server is now ${short(BUILD)}, so a draft may have been published, discarded or edited since. Reload before acting on it.` };
  }
  const hits = list.filter((e) => e.id === id);
  if (hits.length === 0) return { status: 400, error: `No ${kind} with id "${id}" in ${FILE_OF[kind]} in build ${short(BUILD)}.` };
  if (hits.length > 1) return { status: 400, error: `More than one ${kind} has id "${id}" in ${FILE_OF[kind]}. Fix that by hand first.` };
  const entry = hits[0];
  if (name !== undefined && name !== entry.name) {
    return { status: 409, error: `The page named this "${name}", but "${id}" in build ${short(BUILD)} is "${entry.name}". Reload before acting on it.` };
  }
  if (!entry.draft) {
    return { status: 409, error: `${entry.name} (${id}) is not a draft in build ${short(BUILD)}: it is published, last updated ${entry.updated || "unknown"}. Reload.` };
  }
  return { entry };
}

/* Every entry in every catalogue file, as "kind:id". */
export const fileKeys = () => new Set([
  ...ALL_TOOLS.map((e) => keyOf("tool", e.id)),
  ...ALL_NEWSLETTERS.map((e) => keyOf("newsletter", e.id)),
  ...ALL_EVENTS.map((e) => keyOf("event", e.id)),
  ...ALL_COMMUNITIES.map((e) => keyOf("group", e.id)),
  ...ALL_PODCASTS.map((e) => keyOf("podcast", e.id)),
]);

/** The discards that still stand, for the cross-references. */
export async function standingDiscards() {
  return liveDiscards(await getDiscards(), fileKeys());
}

export async function getHolds() { return (await read(HOLDS, {})) || {}; }

export async function setHold({ kind, id, note, by }) {
  const why = String(note || "").replace(/\s+/g, " ").trim();
  if (!why) return { error: "Say what it is waiting on." };
  if (why.length > 300) return { error: "Keep the note under 300 characters." };
  const all = await getHolds();
  all[keyOf(kind, id)] = { kind, id, note: why, by, at: new Date().toISOString() };
  await write(HOLDS, all);
  return { holds: all };
}

export async function clearHold({ kind, id }) {
  const all = await getHolds();
  delete all[keyOf(kind, id)];
  await write(HOLDS, all);
  return { holds: all };
}
