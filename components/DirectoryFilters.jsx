"use client";

/*
 * One Filters control for every refinement (lib/directoryFilters.js), and the
 * chips that show which are on. The panel is a popover under the button on a
 * wide screen and a full-height sheet on a phone (`.filters-panel` in
 * globals.css). Nothing is hidden state: every active refinement is also a
 * chip below the bar with its own remove.
 *
 * A filter that is on is a state, not an action, so it takes the neutral
 * inversion rather than the action green (colour invariant C).
 */
import React, { useEffect, useRef, useState } from "react";
import { Funnel, X } from "@phosphor-icons/react";
import { C, S, R, F } from "@/lib/tools";
import { activeCount } from "@/lib/directoryFilters";

const Check = ({ checked, onChange, label, count }) => (
  <label className="flex items-center" style={{ gap: S.sm, padding: "6px 0", fontSize: F.sm, cursor: "pointer" }}>
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    <span style={{ flex: 1 }}>{label}</span>
    {count !== undefined && <span className="tnum" style={{ fontSize: F.xs, color: C.dim }}>{count}</span>}
  </label>
);

const Group = ({ title, children }) => (
  <fieldset style={{ border: 0, padding: 0, margin: `0 0 ${S.lg}px` }}>
    <legend style={{ fontSize: F.xs, color: C.dim, fontWeight: 600, padding: 0, marginBottom: S.xs }}>{title}</legend>
    {children}
  </fieldset>
);

export function FiltersButton({ f, set, options, onClear }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const n = activeCount(f);
  /* Escape and a click outside close it, as a popover should. */
  useEffect(() => {
    if (!open) return undefined;
    const key = (e) => { if (e.key === "Escape") setOpen(false); };
    const click = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("keydown", key);
    document.addEventListener("mousedown", click);
    return () => { document.removeEventListener("keydown", key); document.removeEventListener("mousedown", click); };
  }, [open]);
  const toggleIn = (key, id, on) => set({ [key]: on ? [...f[key], id] : f[key].filter((x) => x !== id) });

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="dialog"
        className="ctl press tnum"
        style={{
          display: "inline-flex", alignItems: "center", gap: S.xs,
          background: n ? C.text : C.panel, color: n ? C.bg : C.text,
          border: `1px solid ${n ? C.text : C.line}`, borderRadius: R.control,
          padding: "8px 12px", fontSize: F.sm, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
        }}>
        <Funnel size={15} weight={n ? "fill" : "regular"} />
        Filters{n ? ` (${n})` : ""}
      </button>
      {open && (
        <div className="filters-panel" role="dialog" aria-label="Filters"
          style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: R.card, padding: S.lg, boxShadow: "var(--c-card-shadow)" }}>
          <div className="flex items-center justify-between" style={{ marginBottom: S.md }}>
            <span style={{ fontSize: F.md, fontWeight: 700 }}>Filters</span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close filters"
              style={{ background: "none", border: 0, cursor: "pointer", color: C.muted, padding: 4 }}><X size={18} /></button>
          </div>

          <Group title="Price">
            <Check checked={f.free} onChange={(v) => set({ free: v })} label="Free plan" count={options.freeCount} />
          </Group>

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

          <Group title="Details">
            {f.cat === "all" ? (
              <p style={{ fontSize: F.xs, color: C.dim, margin: 0, lineHeight: 1.5 }}>Pick a category to filter by its details, such as competitor alerts or install history.</p>
            ) : options.attributes.length === 0 ? (
              <p style={{ fontSize: F.xs, color: C.dim, margin: 0, lineHeight: 1.5 }}>No details are confirmed for this category yet.</p>
            ) : options.attributes.map((a) => (
              <Check key={a.key} checked={f.has.includes(a.key)} onChange={(v) => toggleIn("has", a.key, v)} label={a.label} count={a.n} />
            ))}
          </Group>

          <div className="flex items-center justify-between" style={{ borderTop: `1px solid ${C.line}`, paddingTop: S.md }}>
            <button type="button" onClick={onClear} disabled={!n}
              style={{ background: "none", border: 0, padding: 0, color: n ? C.text : C.dim, fontSize: F.sm, textDecoration: "underline", cursor: n ? "pointer" : "default", fontFamily: "inherit" }}>
              Clear all
            </button>
            <button type="button" onClick={() => setOpen(false)} className="ctl press"
              style={{ background: C.text, color: C.bg, border: 0, borderRadius: R.control, padding: "8px 16px", fontSize: F.sm, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              Show {options.resultCount} {options.resultCount === 1 ? "tool" : "tools"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** The refinements that are on, each removable, so none is hidden state. */
export function ActiveFilters({ f, set, labels, onClear }) {
  const chips = [
    f.free && { k: "free", label: "Free plan", off: () => set({ free: false }) },
    f.used && { k: "used", label: "Editor has used", off: () => set({ used: false }) },
    ...f.int.map((i) => ({ k: `int:${i}`, label: labels.integration(i), off: () => set({ int: f.int.filter((x) => x !== i) }) })),
    ...f.has.map((a) => ({ k: `has:${a}`, label: labels.attribute(a), off: () => set({ has: f.has.filter((x) => x !== a) }) })),
  ].filter(Boolean);
  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap items-center" style={{ gap: S.xs, marginTop: S.sm }} aria-label="Active filters">
      {chips.map((c) => (
        <button key={c.k} type="button" onClick={c.off} aria-label={`Remove filter: ${c.label}`} className="press"
          style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            background: C.text, color: C.bg, border: 0, borderRadius: R.pill,
            padding: "4px 10px", fontSize: F.xs, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
          }}>
          {c.label} <X size={11} weight="bold" />
        </button>
      ))}
      <button type="button" onClick={onClear}
        style={{ background: "none", border: 0, padding: "4px 6px", color: C.muted, fontSize: F.xs, textDecoration: "underline", cursor: "pointer", fontFamily: "inherit" }}>
        Clear all
      </button>
    </div>
  );
}
