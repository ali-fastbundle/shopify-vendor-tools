"use client";

/*
 * Save a tool to one of your lists (lib/lists.js): pick a list, or name a new
 * one. One control everywhere: the tool page and the listing modal show it as
 * a button, a card as a bookmark icon. All of them read and write the shared
 * copy of your lists (components/YourLists.jsx), so the sidebar's count and
 * every bookmark agree without a fetch each.
 *
 * On a card it appears only when signed in. Fifty bookmarks for a visitor who
 * cannot use them would be fifty of one affordance, which is why Compare left
 * the cards. On a page about one tool, signed out, it says where to sign in.
 */
import React, { useEffect, useRef, useState } from "react";
import { BookmarkSimple } from "@phosphor-icons/react";
import { C, S, R, F } from "@/lib/tools";
import { useYourLists, usePostList } from "./YourLists";

export default function SaveToList({ toolId, toolName, compact = false }) {
  const { lists, signedIn } = useYourLists();
  const post = usePostList();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");
  const [at, setAt] = useState(null);
  const btnRef = useRef(null);
  const boxRef = useRef(null);
  const saved = (lists || []).some((l) => l.items.some((x) => x.toolId === toolId));

  /* Escape and a click outside close it, as a popover should. */
  useEffect(() => {
    if (!open) return undefined;
    const key = (e) => { if (e.key === "Escape") { setOpen(false); btnRef.current?.focus(); } };
    const click = (e) => {
      if (boxRef.current?.contains(e.target) || btnRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("keydown", key);
    document.addEventListener("mousedown", click);
    return () => { document.removeEventListener("keydown", key); document.removeEventListener("mousedown", click); };
  }, [open]);

  if (compact && !signedIn) return null;

  function toggle(e) {
    e.preventDefault(); e.stopPropagation();
    setMsg("");
    /* A card clips what overflows it, so there the box is fixed to the window,
       under the button. */
    if (compact && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setAt({ top: r.bottom + 6, left: Math.max(8, Math.min(r.right - 280, window.innerWidth - 288)) });
    }
    setOpen((o) => !o);
  }
  async function run(body, done) {
    const d = await post(body);
    if (d.error) { setMsg(d.error); return false; }
    setMsg(done);
    return true;
  }

  const btn = {
    background: C.panel, border: `1px solid ${C.line}`, color: C.text, borderRadius: R.control,
    padding: "6px 12px", fontSize: F.sm, cursor: "pointer", fontFamily: "inherit",
  };
  const label = saved ? `${toolName} is in a list. Save to another` : `Save ${toolName} to a list`;

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      {compact ? (
        <button ref={btnRef} type="button" onClick={toggle} aria-expanded={open} aria-label={label} title={label}
          className="ctl press" style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 28, padding: 0,
            background: saved ? C.text : C.panel, color: saved ? C.bg : C.muted,
            border: `1px solid ${saved ? C.text : C.line}`, borderRadius: R.control, cursor: "pointer",
          }}>
          <BookmarkSimple size={14} weight={saved ? "fill" : "regular"} />
        </button>
      ) : (
        <button ref={btnRef} type="button" className="ctl press" onClick={toggle} aria-expanded={open} style={btn}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: S.xs }}>
            <BookmarkSimple size={14} weight={saved ? "fill" : "regular"} aria-hidden="true" />
            {saved ? "Saved to a list" : "Save to a list"}
          </span>
        </button>
      )}
      {open && (
        <div ref={boxRef} role="dialog" aria-label={`Save ${toolName} to a list`}
          onClick={(e) => e.stopPropagation()}
          style={{
            ...(compact && at ? { position: "fixed", top: at.top, left: at.left } : { position: "absolute", marginTop: S.xs }),
            zIndex: 60, width: 280, background: C.panel, border: `1px solid ${C.line}`, borderRadius: R.card,
            padding: S.md, boxShadow: "var(--c-card-shadow)", textAlign: "left",
          }}>
          {!signedIn ? (
            <p style={{ fontSize: F.sm, color: C.muted, margin: 0, lineHeight: 1.5 }}>Sign in from the sidebar to save {toolName} to a list.</p>
          ) : (
            <>
              {(lists || []).map((l) => {
                const has = l.items.some((x) => x.toolId === toolId);
                return (
                  <button key={l.id} type="button" disabled={has} onClick={() => run({ action: "add", id: l.id, toolId }, `Added to ${l.name}.`)}
                    style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: 0, padding: "4px 0", fontSize: F.sm, color: has ? C.dim : C.text, cursor: has ? "default" : "pointer", fontFamily: "inherit" }}>
                    {l.name}{has ? " (already in it)" : ""}
                  </button>
                );
              })}
              <div className="flex" style={{ gap: S.xs, marginTop: S.sm }}>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New list" aria-label="Name a new list"
                  style={{ flex: 1, minWidth: 0, background: C.panel, border: `1px solid ${C.line}`, borderRadius: R.control, padding: "4px 8px", fontSize: F.sm, color: C.text, fontFamily: "inherit" }} />
                <button type="button" style={btn} disabled={name.trim().length < 2}
                  onClick={async () => { if (await run({ action: "create", name, toolId }, `Saved to ${name}.`)) setName(""); }}>Create</button>
              </div>
              <a href="/lists/mine" style={{ display: "block", fontSize: F.xs, color: C.muted, marginTop: S.sm }}>Manage your lists</a>
            </>
          )}
          {msg && <p role="status" style={{ fontSize: F.xs, color: C.muted, margin: `${S.sm}px 0 0` }}>{msg}</p>}
        </div>
      )}
    </div>
  );
}
