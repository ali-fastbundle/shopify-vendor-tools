"use client";

import React, { useState } from "react";
import GrowText from "./GrowText";
import { C, S, R, F, formatDay } from "@/lib/tools";

/*
 * Edit or delete one What's moving entry, for an admin (2026-11-04).
 *
 * One control in two places: under each entry on /changes, where the admin
 * reads it as a visitor does, and on the "On What's moving" list in /admin.
 * The server re-checks isAdmin on every press (invariant 7); rendering this is
 * an affordance, never the permission.
 *
 * Edit keeps the id, the date and the place in the feed. The editor says
 * which kind of edit it is, because they read differently to a visitor:
 *   - a wording fix changes no fact, and the entry says "Edited <date>";
 *   - a correction changes what the entry claims, and the entry says
 *     "Corrected <date>: <what changed>", the way the ASO post does. A
 *     correction is never a silent rewrite.
 * Delete is soft and needs a reason. Both are two presses.
 */
const FIELD = {
  width: "100%", boxSizing: "border-box", fontFamily: "inherit", fontSize: F.sm,
  background: C.field, color: C.text, border: `1px solid ${C.line}`, borderRadius: R.control,
  padding: "8px 12px", lineHeight: 1.55,
};

function Btn({ children, onClick, tone, disabled, busy }) {
  const go = tone === "go";
  const stop = tone === "stop";
  return (
    <button type="button" onClick={onClick} disabled={disabled || busy} className="ctl press"
      style={{
        fontFamily: "inherit", fontSize: F.xs, fontWeight: 600, padding: "4px 12px",
        borderRadius: R.control, cursor: disabled || busy ? "default" : "pointer",
        opacity: disabled ? 0.5 : 1,
        background: go ? C.accent : C.panel, color: go ? C.onAccent : stop ? C.badInk : C.text,
        border: `1px solid ${go ? C.accent : C.line}`,
      }}>{busy ? "Working…" : children}</button>
  );
}

async function post(action, id, extra) {
  try {
    const res = await fetch("/api/admin", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, id, ...extra }),
    });
    if (!res.ok) return { error: await res.text() };
    return await res.json();
  } catch { return { error: "Could not reach the server." }; }
}

export default function FeedEntryAdmin({ entry, onChange }) {
  const [mode, setMode] = useState("");
  const [headline, setHeadline] = useState(entry.headline || "");
  const [kind, setKind] = useState("wording");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const close = () => { setMode(""); setArmed(false); setErr(""); };
  const changed = headline.trim() !== String(entry.headline || "").trim();
  const editReady = headline.trim().length >= 12 && (kind === "correction" ? note.trim().length >= 12 : changed);

  async function save() {
    if (!armed) { setArmed(true); return; }
    setBusy(true); setErr("");
    const d = await post("edit-feed-entry", entry.id, { headline, kind, note });
    setBusy(false);
    if (d.error) { setErr(d.error); setArmed(false); return; }
    onChange?.(d.entry);
    setNote(""); close();
  }

  async function remove() {
    if (!armed) { setArmed(true); return; }
    setBusy(true); setErr("");
    const d = await post("delete-feed-entry", entry.id, { reason });
    setBusy(false);
    if (d.error) { setErr(d.error); setArmed(false); return; }
    onChange?.(null);
    close();
  }

  const quiet = { background: "none", border: 0, padding: 0, cursor: "pointer", fontFamily: "inherit", fontSize: F.xs, color: C.muted, textDecoration: "underline" };

  if (!mode) {
    return (
      <span className="flex flex-wrap items-center" style={{ gap: S.md }}>
        <button type="button" onClick={() => { setHeadline(entry.headline || ""); setMode("edit"); }} style={quiet}>Edit</button>
        <button type="button" onClick={() => setMode("delete")} style={quiet}>Delete</button>
      </span>
    );
  }

  return (
    <div style={{ background: C.raised, border: `1px solid ${C.line}`, borderRadius: R.card, padding: S.md, marginTop: S.sm, maxWidth: "72ch" }}>
      {mode === "edit" ? (
        <>
          <GrowText value={headline} onChange={(e) => { setHeadline(e.target.value); setArmed(false); }} rows={3}
            aria-label="The entry" style={FIELD} />
          <div className="flex flex-wrap" style={{ gap: S.lg, marginTop: S.sm, fontSize: F.xs, color: C.text }}>
            <label className="flex items-center" style={{ gap: 6 }}>
              <input type="radio" checked={kind === "wording"} onChange={() => { setKind("wording"); setArmed(false); }} />
              Wording fix, no fact changed
            </label>
            <label className="flex items-center" style={{ gap: 6 }}>
              <input type="radio" checked={kind === "correction"} onChange={() => { setKind("correction"); setArmed(false); }} />
              Correction, it said something wrong
            </label>
          </div>
          {kind === "correction" && (
            <div style={{ marginTop: S.sm }}>
              <GrowText value={note} onChange={(e) => { setNote(e.target.value); setArmed(false); }} rows={2}
                placeholder="What changed, in one sentence. Example: this said the free plan was gone. It is still offered, with 3 keywords."
                aria-label="What the correction changed" style={FIELD} />
            </div>
          )}
          <p style={{ fontSize: F.xs, color: C.dim, margin: `${S.sm}px 0 0`, lineHeight: 1.5 }}>
            The date and the place in the feed stay. {kind === "correction"
              ? `The entry will say "Corrected ${formatDay(new Date().toISOString().slice(0, 10))}:" and your sentence.`
              : "The entry will say \"Edited\" with today's date."} The old text is kept in the record.
          </p>
          {armed && (
            <div style={{ borderTop: `1px solid ${C.line}`, marginTop: S.sm, paddingTop: S.sm, fontSize: F.xs, color: C.dim, lineHeight: 1.6 }}>
              <span style={{ display: "block" }}>Before: <span style={{ color: C.muted }}>{entry.headline}</span></span>
              <span style={{ display: "block" }}>After: <span style={{ color: C.text }}>{headline.trim()}</span></span>
              {kind === "correction" && <span style={{ display: "block" }}>Correction: <span style={{ color: C.text }}>{note.trim()}</span></span>}
            </div>
          )}
          <div className="flex flex-wrap items-center" style={{ gap: S.sm, marginTop: S.sm }}>
            <Btn tone="go" onClick={save} busy={busy} disabled={!editReady}>{armed ? "Save it" : "Review the edit"}</Btn>
            <Btn onClick={close}>Cancel</Btn>
          </div>
        </>
      ) : (
        <>
          <input value={reason} onChange={(e) => { setReason(e.target.value); setArmed(false); }} style={FIELD}
            placeholder="Why it comes down, one line. Kept with the entry, never shown."
            aria-label="Why it is deleted" />
          <p style={{ fontSize: F.xs, color: C.dim, margin: `${S.sm}px 0 0`, lineHeight: 1.5 }}>
            Soft: the entry leaves /changes, the RSS and the Markdown version, and the row is kept with the reason.
            Restore is on the Updates tab.
          </p>
          <div className="flex flex-wrap items-center" style={{ gap: S.sm, marginTop: S.sm }}>
            <Btn tone="stop" onClick={remove} busy={busy} disabled={reason.trim().length < 4}>{armed ? "Delete it" : "Delete"}</Btn>
            <Btn onClick={close}>Cancel</Btn>
          </div>
        </>
      )}
      {err && <p style={{ fontSize: F.xs, color: C.badInk, margin: `${S.sm}px 0 0` }}>{err}</p>}
    </div>
  );
}
