"use client";

/*
 * "Save to a list" on a tool (lib/lists.js): pick one of your lists, or name a
 * new one. Signed out, it says where to sign in instead of opening anything.
 */
import React, { useState } from "react";
import { C, S, R, F } from "@/lib/tools";
import { useSession } from "./Account";

export default function SaveToList({ toolId, toolName }) {
  const [session] = useSession();
  const [open, setOpen] = useState(false);
  const [lists, setLists] = useState(null);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");

  async function toggle() {
    setOpen((o) => !o); setMsg("");
    if (lists === null && session?.signedIn) {
      const r = await fetch("/api/lists");
      setLists(r.ok ? (await r.json()).lists || [] : []);
    }
  }
  async function post(body, done) {
    const res = await fetch("/api/lists", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { setMsg(await res.text()); return; }
    setLists((await res.json()).lists || []);
    setMsg(done);
  }

  const btn = {
    background: C.panel, border: `1px solid ${C.line}`, color: C.text, borderRadius: R.control,
    padding: "6px 12px", fontSize: F.sm, cursor: "pointer", fontFamily: "inherit",
  };
  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button type="button" className="ctl press" onClick={toggle} aria-expanded={open} style={btn}>Save to a list</button>
      {open && (
        <div style={{ position: "absolute", zIndex: 5, marginTop: S.xs, minWidth: 260, background: C.panel, border: `1px solid ${C.line}`, borderRadius: R.card, padding: S.md, boxShadow: "var(--c-card-shadow)" }}>
          {!session?.signedIn ? (
            <p style={{ fontSize: F.sm, color: C.muted, margin: 0, lineHeight: 1.5 }}>Sign in at the top of the page to save {toolName} to a list.</p>
          ) : (
            <>
              {(lists || []).map((l) => {
                const has = l.items.some((x) => x.toolId === toolId);
                return (
                  <button key={l.id} type="button" disabled={has} onClick={() => post({ action: "add", id: l.id, toolId }, `Added to ${l.name}.`)}
                    style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: 0, padding: "4px 0", fontSize: F.sm, color: has ? C.dim : C.text, cursor: has ? "default" : "pointer", fontFamily: "inherit" }}>
                    {l.name}{has ? " (already in it)" : ""}
                  </button>
                );
              })}
              <div className="flex" style={{ gap: S.xs, marginTop: S.sm }}>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New list" aria-label="Name a new list"
                  style={{ flex: 1, background: C.panel, border: `1px solid ${C.line}`, borderRadius: R.control, padding: "4px 8px", fontSize: F.sm, color: C.text, fontFamily: "inherit" }} />
                <button type="button" style={btn} disabled={name.trim().length < 2}
                  onClick={() => post({ action: "create", name, toolId }, `Saved to ${name}.`).then(() => setName(""))}>Create</button>
              </div>
              <a href="/lists" style={{ display: "block", fontSize: F.xs, color: C.muted, marginTop: S.sm }}>Manage your lists</a>
            </>
          )}
          {msg && <p style={{ fontSize: F.xs, color: C.muted, margin: `${S.xs}px 0 0` }}>{msg}</p>}
        </div>
      )}
    </div>
  );
}
