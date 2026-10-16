/*
 * What each owner controls, across tools, newsletters and events.
 *
 * Reads the published catalogues (drafts never appear, invariant 12). A
 * caller that has the merged tool list (`mergedTools()`, which includes an
 * ownership the monitor applied as an override) passes it in; otherwise the
 * file is used. Server-side by habit: it imports every catalogue, which a
 * client component has no reason to carry.
 */
import { TOOLS } from "./tools";
import { NEWSLETTERS } from "./newsletters";
import { EVENTS } from "./events";
import { OWNERS, ownerById, ownershipOf } from "./owners";

const HREF = { tool: (id) => `/tools/${id}`, newsletter: (id) => `/newsletters/${id}`, event: (id) => `/events/${id}` };
const KIND_LABEL = { tool: "Tool", newsletter: "Newsletter", event: "Event" };

function everything({ tools = TOOLS, newsletters = NEWSLETTERS, events = EVENTS } = {}) {
  return [
    ...tools.map((e) => ({ kind: "tool", e })),
    ...newsletters.map((e) => ({ kind: "newsletter", e })),
    ...events.map((e) => ({ kind: "event", e })),
  ].flatMap(({ kind, e }) => {
    const o = ownershipOf(e, kind);
    return o?.id ? [{
      kind, kindLabel: KIND_LABEL[kind], id: e.id, name: e.name, one: e.one || "", href: HREF[kind](e.id),
      ownerId: o.id, ownerName: o.name, verb: o.verb, note: o.note, own: o.own, dying: Boolean(e.dying),
    }] : [];
  });
}

/** Every entry an owner controls, tools first, then newsletters, then events. */
export function entriesOf(ownerId, lists) {
  const order = { tool: 0, newsletter: 1, event: 2 };
  return everything(lists).filter((x) => x.ownerId === ownerId)
    .sort((a, b) => order[a.kind] - order[b.kind] || Number(a.dying) - Number(b.dying) || a.name.localeCompare(b.name));
}

/** Owners with two or more published entries: the ones that get a page. */
export function ownersWithPages(lists) {
  const all = everything(lists);
  return OWNERS
    .map((o) => ({ ...o, entries: all.filter((x) => x.ownerId === o.id) }))
    .filter((o) => o.entries.length >= 2);
}

export const hasOwnerPage = (id, lists) => Boolean(id) && entriesOf(id, lists).length >= 2;

/**
 * An entry's owner and its siblings, for the listing: { owner, href, line,
 * siblings: [{ name, href, kindLabel }] } or null. `line` is "" when the
 * owner is the entry itself; the siblings still show.
 */
export function ownerContext(entry, kind = "tool", lists) {
  const o = ownershipOf(entry, kind);
  if (!o) return null;
  const owner = o.id ? ownerById(o.id) : null;
  const members = o.id ? entriesOf(o.id, lists) : [];
  return {
    id: o.id,
    name: owner?.name || o.name,
    display: o.name,
    verb: o.verb,
    line: o.own ? "" : `${o.verb} ${o.name}`,
    href: members.length >= 2 ? `/owners/${o.id}` : "",
    siblings: members.filter((m) => !(m.kind === kind && m.id === entry.id))
      /* An owner's own product is named as "the Mantle listing", because
         "Also from Mantle: Mantle" reads as a mistake. */
      .map((m) => ({ name: m.own ? `the ${m.name} listing` : m.name, href: m.href, kindLabel: m.kindLabel })),
  };
}

/** The same, for every tool at once: { [toolId]: context }, for the directory's modal. */
export function ownerContexts(tools, lists = {}) {
  const l = { ...lists, tools };
  return Object.fromEntries(tools.map((t) => [t.id, ownerContext(t, "tool", l)]).filter(([, c]) => c));
}
