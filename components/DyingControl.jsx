"use client";

/*
 * Winding down, on or off, for an admin (lib/listings.js setDying). On the
 * tool page's admin box and in the admin state of the listing modal, so the
 * two cannot drift. It renders for admins only and the route re-checks:
 * rendering this is an affordance, never the permission (invariant 7).
 *
 * Two presses, like every change that alters what a visitor reads about a
 * company: the first says what will change, the second does it. The flag is
 * the badge, the sort and whether the matcher and the recommender can pick
 * it. The words are separate, and the control says which ones to check.
 */
import React, { useState } from "react";
import { C, S, R, F } from "@/lib/tools";

export default function DyingControl({ tool, onSaved }) {
  const [dying, setDying] = useState(tool.dying === true);
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const next = !dying;

  async function save() {
    setBusy(true); setMsg("");
    try {
      const res = await fetch("/api/admin", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set-dying", toolId: tool.id, dying: next }),
      });
      if (!res.ok) { setMsg(await res.text()); return; }
      const d = await res.json();
      setDying(d.dying);
      setMsg(`Saved. ${tool.name} is ${d.dying ? "marked as winding down" : "no longer marked as winding down"}${d.followsFile ? ", which is what the file says" : ""}. Check the summary, description and caveat still match.`);
      onSaved?.(tool.id, d.dying);
    } catch {
      setMsg("Could not reach the server.");
    } finally {
      setBusy(false); setArmed(false);
    }
  }

  const btn = {
    background: armed ? C.text : C.panel, color: armed ? C.bg : C.text,
    border: `1px solid ${armed ? C.text : C.line}`, borderRadius: R.control,
    padding: "4px 10px", fontSize: F.sm, fontWeight: 600, cursor: busy ? "default" : "pointer", fontFamily: "inherit",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: S.sm }}>
      <p style={{ fontSize: F.sm, color: C.muted, margin: 0, lineHeight: 1.5 }}>
        {dying ? "Marked as winding down: the badge shows, it sorts last, and the matcher and the recommender leave it out."
          : "Not marked as winding down."}
      </p>
      <div className="flex flex-wrap items-center" style={{ gap: S.sm }}>
        <button type="button" disabled={busy} className="ctl press" style={btn}
          onClick={() => (armed ? save() : setArmed(true))}>
          {armed ? `Confirm: ${next ? "mark as winding down" : "mark as active"}` : next ? "Mark as winding down" : "Mark as active"}
        </button>
        {armed && (
          <button type="button" onClick={() => setArmed(false)} className="press"
            style={{ background: "none", border: 0, padding: 0, color: C.muted, fontSize: F.sm, cursor: "pointer", fontFamily: "inherit" }}>
            Cancel
          </button>
        )}
      </div>
      {armed && (
        <p style={{ fontSize: F.xs, color: C.muted, margin: 0, lineHeight: 1.5 }}>
          This changes the flag only. The summary and description are in Edit this listing, and the caveat is the caveat editor above.
        </p>
      )}
      {msg && <p role="status" style={{ fontSize: F.xs, color: C.text, margin: 0, lineHeight: 1.5 }}>{msg}</p>}
    </div>
  );
}
