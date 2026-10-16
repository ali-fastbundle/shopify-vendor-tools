/*
 * Saved lists: a signed-in visitor names a list, adds tools, orders them and
 * writes a note on each. Private by default. Publishing puts it at
 * /lists/<id> under a name the owner chooses, never their address.
 *
 *   svt:lists = { [id]: { id, owner (email), name, items: [{ toolId, note }],
 *                         public, byName, createdAt, updatedAt,
 *                         reviewed, hidden, hiddenReason } }
 *
 * The owner's address is the only private field and leaves through
 * `publicList` and `ownList`, which strip it. A public list is live at once
 * and lands in the admin Inbox; it is indexed only after a person marked it
 * fine, because a page anyone can publish is the first thing a spammer finds.
 * Notes are plain text and render without links for the same reason.
 *
 * Pure apart from read and write. Ids of tools are checked against the
 * published catalogue by the caller.
 */
import { read, write } from "./store";
import { randomBytes } from "crypto";

export const LISTS_KEY = "svt:lists";
import { LIST_LIMITS } from "./limits";
export const LIMITS = LIST_LIMITS;

const keyOf = (email) => String(email || "").trim().toLowerCase();
const clean = (s, max) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const newId = () => randomBytes(6).toString("base64url");

export const readLists = () => read(LISTS_KEY, {});
export const saveLists = (all) => write(LISTS_KEY, all);

/* What a page may show: no owner address, no moderation fields. */
export const publicList = ({ owner, reviewed, reviewedBy, hidden, hiddenReason, ...rest }) => rest;
/* What the owner sees of their own: everything but the address they already know. */
export const ownList = ({ owner, reviewedBy, ...rest }) => rest;

export function listsOf(all = {}, email) {
  const me = keyOf(email);
  return Object.values(all || {}).filter((l) => l && l.owner === me)
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
    .map(ownList);
}

/* A public byline is a name, not a way to reach somebody. */
const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const LINK = /https?:\/\/|www\.|\.[a-z]{2,}\//i;

function checkItems(items, isTool) {
  if (!Array.isArray(items)) return { error: "No items." };
  if (items.length > LIMITS.items) return { error: `At most ${LIMITS.items} tools in a list.` };
  const seen = new Set();
  const out = [];
  for (const it of items) {
    const toolId = String(it?.toolId || "");
    if (!isTool(toolId)) return { error: `"${toolId}" is not a listed tool.` };
    if (seen.has(toolId)) continue;
    seen.add(toolId);
    const note = clean(it.note, LIMITS.note);
    if (LINK.test(note)) return { error: "Notes are plain text. Leave links out." };
    out.push({ toolId, ...(note ? { note } : {}) });
  }
  return { items: out };
}

export function createList(all, email, { name, toolId = "" }, isTool, now = new Date().toISOString()) {
  const me = keyOf(email);
  if (Object.values(all).filter((l) => l?.owner === me).length >= LIMITS.lists) return { error: `At most ${LIMITS.lists} lists.` };
  const n = clean(name, LIMITS.name);
  if (n.length < 2) return { error: "Give the list a name." };
  if (toolId && !isTool(toolId)) return { error: "Unknown tool." };
  const list = { id: newId(), owner: me, name: n, items: toolId ? [{ toolId }] : [], public: false, byName: "", createdAt: now, updatedAt: now };
  return { all: { ...all, [list.id]: list }, list };
}

/**
 * Replace a list's name, items (order and notes) and publishing in one save.
 * Publishing needs a byline, which may not be an address or a link.
 * Unpublishing keeps the byline for next time. Re-publishing after a change
 * sends it back to the Inbox.
 */
export function saveList(all, email, id, { name, items, public: pub, byName }, isTool, now = new Date().toISOString()) {
  const l = all[id];
  if (!l || l.owner !== keyOf(email)) return { error: "No such list." };
  const n = clean(name ?? l.name, LIMITS.name);
  if (n.length < 2) return { error: "Give the list a name." };
  const checked = checkItems(items ?? l.items, isTool);
  if (checked.error) return checked;
  const by = clean(byName ?? l.byName, LIMITS.byName);
  const wantPublic = pub === undefined ? l.public : Boolean(pub);
  if (wantPublic) {
    if (by.length < 2) return { error: "Say whose name to show on the public list." };
    if (EMAIL.test(by) || LINK.test(by)) return { error: "The name shown is a name, not an address or a link." };
    if (!checked.items.length) return { error: "Add at least one tool before publishing." };
  }
  const changedPublic = wantPublic && (!l.public || n !== l.name || JSON.stringify(checked.items) !== JSON.stringify(l.items) || by !== l.byName);
  const next = {
    ...l, name: n, items: checked.items, public: wantPublic, byName: by, updatedAt: now,
    ...(changedPublic ? { reviewed: false } : {}),
  };
  return { all: { ...all, [id]: next }, list: next };
}

export function addToList(all, email, id, toolId, isTool, now = new Date().toISOString()) {
  const l = all[id];
  if (!l || l.owner !== keyOf(email)) return { error: "No such list." };
  if (!isTool(toolId)) return { error: "Unknown tool." };
  if (l.items.some((x) => x.toolId === toolId)) return { all, list: l };
  if (l.items.length >= LIMITS.items) return { error: `At most ${LIMITS.items} tools in a list.` };
  const next = { ...l, items: [...l.items, { toolId }], updatedAt: now, ...(l.public ? { reviewed: false } : {}) };
  return { all: { ...all, [id]: next }, list: next };
}

export function deleteList(all, email, id) {
  const l = all[id];
  if (!l || l.owner !== keyOf(email)) return { error: "No such list." };
  const { [id]: _gone, ...rest } = all;
  return { all: rest };
}

/** The admin's decisions on a public list: fine (indexable), hide (with a reason), unhide. */
export function moderateList(all, id, action, { reason = "", by = "" } = {}, now = new Date().toISOString()) {
  const l = all[id];
  if (!l) return { error: "No such list." };
  if (action === "hide" && clean(reason, 200).length < 3) return { error: "Say why it is hidden." };
  const next = action === "fine" ? { ...l, reviewed: true, reviewedBy: by, reviewedAt: now }
    : action === "hide" ? { ...l, hidden: true, hiddenReason: clean(reason, 200), reviewed: true }
      : action === "unhide" ? (({ hidden, hiddenReason, ...r }) => r)(l) : null;
  if (!next) return { error: "Unknown action." };
  return { all: { ...all, [id]: next } };
}

/** Shown publicly: published and not hidden. Indexed: also marked fine by a person. */
export const isShown = (l) => Boolean(l?.public && !l.hidden && l.items?.length);
export const isIndexable = (l) => isShown(l) && l.reviewed === true;
