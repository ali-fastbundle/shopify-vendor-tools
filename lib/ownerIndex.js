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
import { OWNERS, ownerById, ownershipOf, findOwner, ownerKey, ownerDomain } from "./owners";
import { isVacuousOwner } from "./tools";

const HREF = { tool: (id) => `/tools/${id}`, newsletter: (id) => `/newsletters/${id}`, event: (id) => `/events/${id}` };
const KIND_LABEL = { tool: "Tool", newsletter: "Newsletter", event: "Event" };

/*
 * Every kind of listing an owner can be behind, and the field that names the
 * owner when no structured `ownership` was written: a newsletter's publisher,
 * an event's organizer. A new section that should appear on /owners adds one
 * line here (its list key, its page and its label above), and nothing else.
 */
const KINDS = [
  { kind: "tool", list: "tools", stated: () => "" },
  { kind: "newsletter", list: "newsletters", stated: (e) => e.publisher || "" },
  { kind: "event", list: "events", stated: (e) => e.organizer || "" },
];
const DEFAULT_VERB = { tool: "By", newsletter: "Published by", event: "Organized by" };

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

/**
 * Every owner of a published listing, of any kind, for the /owners index:
 *
 *   { key, id, name, type, url, domain, logo, notes, page, entries: [{ kind,
 *     kindLabel, id, name, href, one, relation, dying }] }
 *
 * The owner is the entry's structured `ownership` where one was written, or
 * else the publisher or organizer it states, matched to a known owner where
 * the names are equal after normalising. Nothing is inferred: an entry that
 * names nobody is on nobody's row. A name that is only the entry's own name
 * says nothing and is left out (invariant 32), unless it is a known owner
 * with other listings, like Mantle. `page` is set only for an owner behind
 * two or more listings (invariant 46); with one, the row links the listing.
 */
export function allOwners(lists = {}) {
  const src = { tools: TOOLS, newsletters: NEWSLETTERS, events: EVENTS, ...lists };
  const rows = new Map();
  for (const { kind, list, stated } of KINDS) {
    for (const e of src[list] || []) {
      let o = ownershipOf(e, kind);
      if (!o) {
        const name = String(stated(e) || "").trim();
        if (!name) continue;
        const known = findOwner(name);
        o = { id: known ? known.id : "", name: known ? known.name : name, verb: "", note: "", own: false };
      }
      const known = o.id ? ownerById(o.id) : null;
      /* Compared on the name and id only, never the domain: an event's
         `domain` is its organizer's own site, so "Nexfal" against nexfal.com
         would read as the event naming itself (ownershipOf does the same for
         a reference in the file). An edition year is not part of the name:
         "Web Summit" organizing "Web Summit 2026" says nothing. */
      const edition = (v) => String(v || "").replace(/\s*['’]?\d{2,4}\b/g, "").trim();
      if (!known && (isVacuousOwner(o.name, { name: e.name, id: e.id }) || isVacuousOwner(o.name, { name: edition(e.name) }))) continue;
      const key = known ? known.id : `name:${ownerKey(o.name)}`;
      if (!rows.has(key)) {
        rows.set(key, {
          key, id: known?.id || "", name: known?.name || o.name, type: known?.type || "",
          /* An owner known only by name has no site here, but an event's
             `domain` is set by hand to its organizer's own site for exactly
             this purpose (lib/events.js), so it lends the mark. Never shown
             as the owner's site: only the logo uses it. */
          url: known?.url || "", domain: known ? ownerDomain(known) : kind === "event" ? (e.domain || "") : "",
          logo: known?.logo || "",
          notes: known?.notes || "", entries: [],
        });
      }
      const ownerName = rows.get(key).name;
      rows.get(key).entries.push({
        kind, kindLabel: KIND_LABEL[kind], id: e.id, name: e.name, one: e.one || "", href: HREF[kind](e.id),
        dying: Boolean(e.dying),
        relation: o.note || (o.own ? `${ownerName}'s own ${kind === "tool" ? "product" : kind}.`
          : `${o.verb ? `${o.verb.charAt(0).toUpperCase()}${o.verb.slice(1)}` : DEFAULT_VERB[kind]} ${ownerName}.`),
      });
    }
  }
  const order = { tool: 0, newsletter: 1, event: 2 };
  return [...rows.values()]
    .map((r) => ({
      ...r,
      entries: r.entries.sort((a, b) => (order[a.kind] ?? 9) - (order[b.kind] ?? 9) || Number(a.dying) - Number(b.dying) || a.name.localeCompare(b.name)),
      /* The same rule the page itself answers by (hasOwnerPage), so the index
         never links a page that 404s: a publisher matched by name counts on
         this row but not towards a page of its own. */
      page: r.id && hasOwnerPage(r.id, src) ? `/owners/${r.id}` : "",
    }))
    .sort((a, b) => b.entries.length - a.entries.length || a.name.localeCompare(b.name));
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
