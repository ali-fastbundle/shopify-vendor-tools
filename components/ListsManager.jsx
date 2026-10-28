"use client";

/*
 * /lists/mine: a signed-in visitor's saved lists (lib/lists.js). Name, order,
 * notes, publish under a chosen name, delete. Every change is one save of the
 * whole list, so what is on screen is what is stored.
 */
import React, { useEffect, useState } from "react";
import { C, S, R, F, TRACK } from "@/lib/tools";
import { SignInPrompt, useSession } from "./Account";
import { useYourLists, usePostList } from "./YourLists";
import { LIST_LIMITS as LIMITS } from "@/lib/limits";

const field = {
  background: C.panel, border: `1px solid ${C.line}`, borderRadius: R.control,
  padding: "6px 10px", fontSize: F.sm, color: C.text, fontFamily: "inherit",
};
const small = {
  background: C.panel, border: `1px solid ${C.line}`, borderRadius: R.control, color: C.text,
  padding: "4px 10px", fontSize: F.xs, cursor: "pointer", fontFamily: "inherit",
};

export default function ListsManager({ tools = [] }) {
  const [session] = useSession();
  /* The shared copy (components/YourLists.jsx), so the sidebar's count and
     every bookmark follow what is saved here. */
  const { lists } = useYourLists();
  const send = usePostList();
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");
  const nameOf = (id) => tools.find((t) => t.id === id)?.name || id;

  /* Arriving from the sidebar at #list-<id>: bring that list into view. */
  useEffect(() => {
    if (!lists) return;
    try { document.getElementById(window.location.hash.slice(1))?.scrollIntoView(); } catch {}
  }, [lists]);

  async function post(body) {
    setMsg("");
    const d = await send(body);
    if (d.error) { setMsg(d.error); return null; }
    return d;
  }

  if (session?.loading) return null;
  return (
    <main style={{ background: C.bg, color: C.text }}>
      <div className="mx-auto" style={{ maxWidth: 820, padding: "0 16px" }}>
        <h1 style={{ fontSize: F.hero, fontWeight: 600, margin: `${S["3xl"]}px 0 0`, letterSpacing: TRACK.tighter, lineHeight: 1.05 }}>Your lists</h1>
        <p style={{ fontSize: F.md, color: C.muted, lineHeight: 1.55, margin: `${S.md}px 0 0`, maxWidth: "62ch" }}>
          Save tools to a list, put them in order and add a note to each. A list is private until you publish it. A
          published list shows the name you choose, never your email address.
        </p>
        {!session?.signedIn ? (
          <div style={{ marginTop: S.xl }}>
            <SignInPrompt reason="Lists are saved to your account. One email, no password." />
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center" style={{ gap: S.sm, marginTop: S.xl }}>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name a new list" aria-label="Name a new list"
                maxLength={LIMITS.name} style={{ ...field, flex: 1, minWidth: 220 }} />
              <button type="button" className="press" onClick={async () => { if (await post({ action: "create", name })) setName(""); }}
                disabled={name.trim().length < 2}
                style={{ background: C.accent, color: C.onAccent, border: 0, borderRadius: R.control, padding: "8px 16px", fontSize: F.sm, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: name.trim().length < 2 ? 0.5 : 1 }}>
                Create list
              </button>
            </div>
            {msg && <p style={{ fontSize: F.sm, color: C.warnInk, margin: `${S.sm}px 0 0` }}>{msg}</p>}
            {lists === null ? null : lists.length === 0 ? (
              <p style={{ fontSize: F.sm, color: C.muted, margin: `${S.xl}px 0 0` }}>
                No lists yet. Create one here, or use Save to a list on any tool.
              </p>
            ) : lists.map((l) => <ListEditor key={l.id} list={l} nameOf={nameOf} post={post} />)}
          </>
        )}
      </div>
    </main>
  );
}

function ListEditor({ list, nameOf, post }) {
  const [d, setD] = useState({ name: list.name, items: list.items, public: list.public, byName: list.byName || "" });
  const [saved, setSaved] = useState("");
  useEffect(() => { setD({ name: list.name, items: list.items, public: list.public, byName: list.byName || "" }); }, [list]);
  const move = (i, by) => setD((x) => {
    const items = [...x.items]; const j = i + by;
    if (j < 0 || j >= items.length) return x;
    [items[i], items[j]] = [items[j], items[i]];
    return { ...x, items };
  });
  const dirty = JSON.stringify(d) !== JSON.stringify({ name: list.name, items: list.items, public: list.public, byName: list.byName || "" });
  async function save() {
    const r = await post({ action: "save", id: list.id, ...d });
    if (r) setSaved(d.public ? "Saved. It is public." : "Saved. It is private.");
  }
  return (
    <section id={`list-${list.id}`} style={{ marginTop: S.xl, border: `1px solid ${C.line}`, borderRadius: R.card, padding: S.lg, background: C.panel, scrollMarginTop: S.xl }}>
      <input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} aria-label="List name" maxLength={LIMITS.name}
        style={{ ...field, width: "100%", fontSize: F.lg, fontWeight: 700 }} />
      {d.items.length === 0 && <p style={{ fontSize: F.sm, color: C.muted }}>Empty. Use Save to a list on any tool to add it here.</p>}
      <ol style={{ listStyle: "none", padding: 0, margin: `${S.md}px 0 0` }}>
        {d.items.map((it, i) => (
          <li key={it.toolId} style={{ borderTop: `1px solid ${C.line}`, padding: `${S.sm}px 0` }}>
            <div className="flex flex-wrap items-center" style={{ gap: S.sm }}>
              <span className="tnum" style={{ fontSize: F.xs, color: C.dim, width: 20 }}>{i + 1}.</span>
              <a href={`/tools/${it.toolId}`} style={{ fontWeight: 600, color: C.text, flex: 1, minWidth: 140 }}>{nameOf(it.toolId)}</a>
              <button type="button" style={small} onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${nameOf(it.toolId)} up`}>Up</button>
              <button type="button" style={small} onClick={() => move(i, 1)} disabled={i === d.items.length - 1} aria-label={`Move ${nameOf(it.toolId)} down`}>Down</button>
              <button type="button" style={small} onClick={() => setD({ ...d, items: d.items.filter((_, j) => j !== i) })}>Remove</button>
            </div>
            <input value={it.note || ""} placeholder="A note on this one (optional, plain text)" aria-label={`Note on ${nameOf(it.toolId)}`} maxLength={LIMITS.note}
              onChange={(e) => setD({ ...d, items: d.items.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)) })}
              style={{ ...field, width: "100%", marginTop: S.xs }} />
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center" style={{ gap: S.md, marginTop: S.md }}>
        <label style={{ fontSize: F.sm }}>
          <input type="checkbox" checked={d.public} onChange={(e) => setD({ ...d, public: e.target.checked })} /> Public
        </label>
        {d.public && (
          <input value={d.byName} onChange={(e) => setD({ ...d, byName: e.target.value })} placeholder="Name to show as its author" aria-label="Name to show"
            maxLength={LIMITS.byName} style={{ ...field, minWidth: 220 }} />
        )}
        <button type="button" onClick={save} disabled={!dirty} className="press"
          style={{ background: dirty ? C.accent : C.subtle, color: dirty ? C.onAccent : C.dim, border: 0, borderRadius: R.control, padding: "6px 14px", fontSize: F.sm, fontWeight: 700, cursor: dirty ? "pointer" : "default", fontFamily: "inherit" }}>
          Save
        </button>
        {list.public && <a href={`/lists/${list.id}`} style={{ fontSize: F.sm, color: C.text }}>Open the public page</a>}
        <button type="button" style={{ ...small, marginLeft: "auto" }}
          onClick={() => { if (window.confirm(`Delete "${list.name}"? This cannot be undone.`)) post({ action: "delete", id: list.id }); }}>Delete list</button>
      </div>
      {saved && !dirty && <p style={{ fontSize: F.xs, color: C.muted, margin: `${S.xs}px 0 0` }}>{saved}</p>}
    </section>
  );
}
