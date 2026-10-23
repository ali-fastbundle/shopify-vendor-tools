"use client";

/*
 * The directory's refinements, drawn open in the sidebar (components/SiteFrame.jsx),
 * and the chips that show which are on.
 *
 * They were behind one Filters button with a popover, because the bar above
 * the grid had no room for them. The sidebar is that room, so they are visible:
 * a filter you have to open a panel to discover is a filter most people never
 * use. Every active refinement is also a removable chip, so none is hidden
 * state, and the state itself is the URL (components/ListingParams.jsx).
 *
 * A filter that is on is a state, not an action, so it takes the neutral
 * inversion rather than the action green (colour invariant C).
 */
import React from "react";
import { X } from "@phosphor-icons/react";
import { C, S, R, F } from "@/lib/tools";
import { activeCount } from "@/lib/directoryFilters";

const Check = ({ checked, onChange, label, count }) => (
  <label className="flex items-center" style={{ gap: S.sm, padding: "4px 0", fontSize: F.sm, cursor: "pointer", color: C.text }}>
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    <span style={{ flex: 1, minWidth: 0 }}>{label}</span>
    {count !== undefined && <span className="tnum" style={{ fontSize: F.xs, color: C.dim }}>{count}</span>}
  </label>
);

const Group = ({ title, children }) => (
  <fieldset style={{ border: 0, padding: 0, margin: `0 0 ${S.md}px` }}>
    <legend style={{ fontSize: F.xs, color: C.dim, fontWeight: 600, padding: 0, marginBottom: 2 }}>{title}</legend>
    {children}
  </fieldset>
);

/** Free plan, editor use, integrations and the category's details. */
export function FilterGroups({ f, set, options }) {
  const toggleIn = (key, id, on) => set({ [key]: on ? [...f[key], id] : f[key].filter((x) => x !== id) });
  return (
    <div>
      <Group title="Price">
        <Check checked={f.free} onChange={(v) => set({ free: v })} label="Free plan" count={options.freeCount} />
      </Group>

      {/* Only once a known launch date falls in the last year: a filter that
          can only ever empty the grid is not one. */}
      {options.recentCount > 0 && (
        <Group title="Age">
          <Check checked={f.recent} onChange={(v) => set({ recent: v })} label="Launched in the last year" count={options.recentCount} />
        </Group>
      )}

      {options.editorCount > 0 && (
        <Group title="Editor">
          <Check checked={f.used} onChange={(v) => set({ used: v })} label="Editor has used" count={options.editorCount} />
        </Group>
      )}

      {options.integrations.length > 0 && (
        <Group title="Integrates with (any of)">
          {options.integrations.map((i) => (
            <Check key={i.id} checked={f.int.includes(i.id)} onChange={(v) => toggleIn("int", i.id, v)} label={i.label} count={i.n} />
          ))}
        </Group>
      )}

      {/* Rule E: a category with nothing confirmed renders nothing. The one
          line under "All" is there because the group would otherwise be
          invisible until a category is picked, which nobody would guess. */}
      {f.cat === "all" ? (
        <p style={{ fontSize: F.xs, color: C.dim, margin: 0, lineHeight: 1.5 }}>Pick a category to filter by its details.</p>
      ) : options.attributes.length > 0 && (
        <Group title="Details">
          {options.attributes.map((a) => (
            <Check key={a.key} checked={f.has.includes(a.key)} onChange={(v) => toggleIn("has", a.key, v)} label={a.label} count={a.n} />
          ))}
        </Group>
      )}
    </div>
  );
}

/** The refinements that are on, each removable, so none is hidden state. */
export function ActiveFilters({ f, set, labels, onClear }) {
  const chips = [
    f.free && { k: "free", label: "Free plan", off: () => set({ free: false }) },
    f.used && { k: "used", label: "Editor has used", off: () => set({ used: false }) },
    f.recent && { k: "recent", label: "Launched in the last year", off: () => set({ recent: false }) },
    ...f.int.map((i) => ({ k: `int:${i}`, label: labels.integration(i), off: () => set({ int: f.int.filter((x) => x !== i) }) })),
    ...f.has.map((a) => ({ k: `has:${a}`, label: labels.attribute(a), off: () => set({ has: f.has.filter((x) => x !== a) }) })),
  ].filter(Boolean);
  if (!activeCount(f) || !chips.length) return null;
  return (
    <div className="flex flex-wrap items-center" style={{ gap: S.xs }} aria-label="Active filters">
      {chips.map((c) => (
        <button key={c.k} type="button" onClick={c.off} aria-label={`Remove filter: ${c.label}`} className="press"
          style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            background: C.text, color: C.bg, border: 0, borderRadius: R.pill,
            padding: "4px 8px", fontSize: F.xs, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
          }}>
          {c.label} <X size={11} weight="bold" />
        </button>
      ))}
      <button type="button" onClick={onClear}
        style={{ background: "none", border: 0, padding: "4px 4px", color: C.muted, fontSize: F.xs, textDecoration: "underline", cursor: "pointer", fontFamily: "inherit" }}>
        Clear all
      </button>
    </div>
  );
}
