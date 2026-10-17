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
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BookmarkSimple, ListBullets, Plus, Check } from "@phosphor-icons/react";
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
    /* Fixed to the window on a card, so a scroll would leave it behind. */
    const scroll = () => { if (compact) setOpen(false); };
    document.addEventListener("keydown", key);
    document.addEventListener("mousedown", click);
    window.addEventListener("scroll", scroll, { passive: true });
    return () => {
      document.removeEventListener("keydown", key);
      document.removeEventListener("mousedown", click);
      window.removeEventListener("scroll", scroll);
    };
  }, [open, compact]);

  /* Near the bottom of the window there is no room under the button, so the
     box opens above it instead of running off the screen. Measured after it
     renders, before it paints. */
  useLayoutEffect(() => {
    if (!open || !compact || !at || !boxRef.current) return;
    const h = boxRef.current.offsetHeight;
    if (at.top + h > window.innerHeight - 8 && at.above - h - 6 > 8) {
      setAt((a) => (a && a.top !== a.above - h - 6 ? { ...a, top: a.above - h - 6 } : a));
    }
  }, [open, compact, at, lists]);

  if (compact && !signedIn) return null;

  function toggle(e) {
    e.preventDefault(); e.stopPropagation();
    setMsg("");
    /* On a card the box is portalled to <body> and fixed to the window under
       the button. Inside the card it could not work: the card clips what
       overflows it, and the hover lift (transform) makes a fixed box position
       itself against the card instead of the window, so it opened out of sight
       the moment the pointer was over the card, which is always when clicking. */
    if (compact && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setAt({ top: r.bottom + 6, left: Math.max(8, Math.min(r.right - 280, window.innerWidth - 288)), above: r.top });
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

  const box = (
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
              {/*
                * Your lists as rows you can press, each saying what it holds and
                * what pressing does. They were bare names, which read as text,
                * so a visitor who had just made a list could not tell it was
                * there to choose.
                */}
              <p style={{ fontSize: F.sm, fontWeight: 700, margin: `0 0 ${S.sm}px` }}>Add {toolName} to a list</p>
              {(lists || []).length > 0 && (
                <div style={{ display: "grid", gap: S.xs }}>
                  {lists.map((l) => {
                    const has = l.items.some((x) => x.toolId === toolId);
                    const n = l.items.length;
                    return (
                      <button key={l.id} type="button" disabled={has}
                        onClick={() => run({ action: "add", id: l.id, toolId }, `Added to ${l.name}.`)}
                        aria-label={has ? `${toolName} is already in ${l.name}` : `Add ${toolName} to ${l.name}`}
                        className={has ? undefined : "ctl press"}
                        style={{
                          display: "flex", alignItems: "center", gap: S.sm, width: "100%", textAlign: "left",
                          background: has ? C.subtle : C.panel, border: `1px solid ${C.line}`, borderRadius: R.control,
                          padding: "8px 10px", cursor: has ? "default" : "pointer", fontFamily: "inherit", color: C.text,
                        }}>
                        <ListBullets size={16} color={C.muted} aria-hidden="true" />
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: "block", fontSize: F.sm, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.name}</span>
                          <span className="tnum" style={{ display: "block", fontSize: F.xs, color: C.dim }}>
                            {n} {n === 1 ? "tool" : "tools"}{l.public ? ", published" : ""}
                          </span>
                        </span>
                        {has ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: F.xs, color: C.muted, fontWeight: 600 }}>
                            <Check size={12} weight="bold" aria-hidden="true" /> Added
                          </span>
                        ) : (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: F.xs, fontWeight: 700, color: C.text }}>
                            <Plus size={12} weight="bold" aria-hidden="true" /> Add
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
              <p style={{ fontSize: F.xs, color: C.dim, margin: `${S.md}px 0 ${S.xs}px` }}>
                {(lists || []).length ? "Or start a new list" : "Start your first list"}
              </p>
              <div className="flex" style={{ gap: S.xs }}>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name the list" aria-label="Name a new list"
                  onKeyDown={async (e) => { if (e.key === "Enter" && name.trim().length >= 2) { if (await run({ action: "create", name, toolId }, `Saved to ${name}.`)) setName(""); } }}
                  style={{ flex: 1, minWidth: 0, background: C.panel, border: `1px solid ${C.line}`, borderRadius: R.control, padding: "6px 8px", fontSize: F.sm, color: C.text, fontFamily: "inherit" }} />
                <button type="button" style={btn} disabled={name.trim().length < 2}
                  onClick={async () => { if (await run({ action: "create", name, toolId }, `Saved to ${name}.`)) setName(""); }}>Create</button>
              </div>
              <a href="/lists/mine" style={{ display: "block", fontSize: F.xs, color: C.muted, marginTop: S.sm }}>Manage your lists</a>
            </>
          )}
          {msg && <p role="status" style={{ fontSize: F.xs, color: C.muted, margin: `${S.sm}px 0 0` }}>{msg}</p>}
        </div>
  );

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
      {open && (compact && at && typeof document !== "undefined" ? createPortal(box, document.body) : box)}
    </div>
  );
}
