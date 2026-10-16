"use client";

/*
 * The admin's four-way toggle for editor use (lib/editorUse.js), with the
 * optional public note and the date. One component for the Catalogue tab on
 * /admin, the admin box on a tool page and the admin state of the listing
 * modal, so the three cannot drift.
 *
 * It renders for admins only, and the route re-checks: rendering this is an
 * affordance, never the permission (invariant 7).
 */
import React, { useState } from "react";
import { C, S, R, F } from "@/lib/tools";
import { EDITOR_USE, NOTE_MAX, editorUseBadge } from "@/lib/editorUse";

const OPTIONS = [{ id: "", label: "Unset" }, ...EDITOR_USE];
const today = () => new Date().toISOString().slice(0, 10);

export default function EditorUseControl({ tool, initial = null, onSaved, compact = false }) {
  const [saved, setSaved] = useState(initial || { value: "", note: "", date: "" });
  const [value, setValue] = useState(saved.value || "");
  const [note, setNote] = useState(saved.note || "");
  const [date, setDate] = useState(saved.date || "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  if (tool?.noRecommend === true) {
    return (
      <p style={{ fontSize: F.sm, color: C.muted, margin: 0, lineHeight: 1.5 }}>
        Editor use is never shown for {tool.name}: it is excluded from recommendation, and that
        exclusion covers anything that reads as the editor's endorsement.
      </p>
    );
  }

  const dirty = value !== (saved.value || "") || note !== (saved.note || "") ||
    (value && date !== (saved.date || ""));

  async function save() {
    setBusy(true); setMsg("");
    try {
      const res = await fetch("/api/admin", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set-editor-use", toolId: tool.id, value, note, date: value ? date || today() : "" }),
      });
      if (!res.ok) { setMsg(await res.text()); return; }
      const d = await res.json();
      setSaved(d.editorUse); setDate(d.editorUse.date || ""); setNote(d.editorUse.note || "");
      setMsg(d.editorUse.value ? `Saved. The badge reads "${editorUseBadge(d.editorUse)}".` : "Saved. Nothing shows.");
      onSaved?.(tool.id, d.editorUse);
    } catch {
      setMsg("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  const input = {
    background: C.panel, border: `1px solid ${C.line}`, borderRadius: R.control,
    padding: "4px 8px", fontSize: F.sm, color: C.text, fontFamily: "inherit",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: S.sm }}>
      <div role="radiogroup" aria-label={`Editor use of ${tool.name}`} className="flex flex-wrap" style={{ gap: S.xs }}>
        {OPTIONS.map((o) => {
          const on = value === o.id;
          return (
            <button key={o.id || "unset"} type="button" role="radio" aria-checked={on}
              onClick={() => { setValue(o.id); if (o.id && !date) setDate(today()); }}
              className="ctl press"
              style={{
                background: on ? C.text : C.panel, color: on ? C.bg : C.text,
                border: `1px solid ${on ? C.text : C.line}`, borderRadius: R.control,
                padding: "4px 10px", fontSize: F.sm, fontWeight: on ? 600 : 500,
                cursor: "pointer", fontFamily: "inherit",
              }}>{o.label}</button>
          );
        })}
      </div>
      {value && (
        <div className="flex flex-wrap items-center" style={{ gap: S.sm }}>
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={NOTE_MAX}
            placeholder={value === "used" ? "Why you stopped, or what you use instead" : value === "tested" ? "What it was tested for" : "Optional one line, shown publicly"}
            aria-label="Note, shown publicly" style={{ ...input, flex: 1, minWidth: compact ? 160 : 260 }} />
          <label style={{ fontSize: F.xs, color: C.dim, display: "inline-flex", alignItems: "center", gap: S.xs }}>
            {value === "used" ? "Until" : "Date"}
            <input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} style={input} />
          </label>
        </div>
      )}
      <div className="flex flex-wrap items-center" style={{ gap: S.sm }}>
        <button type="button" onClick={save} disabled={!dirty || busy} className="ctl press"
          style={{
            background: dirty ? C.accent : C.subtle, color: dirty ? C.onAccent : C.dim,
            border: "none", borderRadius: R.control, padding: "4px 12px", fontSize: F.sm,
            fontWeight: 700, cursor: dirty && !busy ? "pointer" : "default", fontFamily: "inherit",
          }}>{busy ? "Saving" : "Save"}</button>
        {msg
          ? <span style={{ fontSize: F.xs, color: C.muted }}>{msg}</span>
          : saved.at && <span style={{ fontSize: F.xs, color: C.dim }}>Changed {String(saved.at).slice(0, 10)}</span>}
      </div>
    </div>
  );
}
