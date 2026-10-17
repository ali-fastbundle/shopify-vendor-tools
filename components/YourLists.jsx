"use client";

/*
 * A signed-in visitor's own lists, fetched once per page and shared.
 *
 * Personal lists are a working tool, not content: they belong to the person
 * looking, they are private until published, and nobody else can see them. So
 * they live in the sidebar under the sections ("Your lists", with a count),
 * and the save control on a card, the modal and the tool page all read and
 * write this one copy. One fetch for the page, and a save in one place shows
 * in the others at once.
 *
 * Signed out there is nothing: no greyed link, no empty heading. Published
 * lists, which other people read, are a separate thing: the /lists section.
 */
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { ListBullets } from "@phosphor-icons/react";
import { C, S, F } from "@/lib/tools";
import { useSession } from "./Account";

const ListsContext = createContext({ lists: null, setLists: () => {}, signedIn: false });

export function ListsProvider({ children }) {
  const [session] = useSession();
  const signedIn = Boolean(session?.signedIn);
  const [lists, setLists] = useState(null);
  useEffect(() => {
    if (!signedIn) { setLists(null); return; }
    let live = true;
    fetch("/api/lists").then((r) => (r.ok ? r.json() : { lists: [] }))
      .then((d) => { if (live) setLists(d.lists || []); })
      .catch(() => { if (live) setLists([]); });
    return () => { live = false; };
  }, [signedIn]);
  return <ListsContext.Provider value={{ lists, setLists, signedIn }}>{children}</ListsContext.Provider>;
}

export const useYourLists = () => useContext(ListsContext);

/** Post a change to /api/lists and put the answer in the shared copy. */
export function usePostList() {
  const { setLists } = useYourLists();
  return useCallback(async (body) => {
    const res = await fetch("/api/lists", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) return { error: await res.text() };
    const d = await res.json();
    setLists(d.lists || []);
    return d;
  }, [setLists]);
}

/* The sidebar block. Nothing at all unless signed in. */
export function SidebarLists() {
  const { lists, signedIn } = useYourLists();
  const [open, setOpen] = useState(false);
  if (!signedIn || lists === null) return null;
  return (
    <div>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="flex items-center" style={{
          width: "100%", gap: S.sm, background: "none", border: 0, padding: "6px 8px", borderRadius: 8,
          cursor: "pointer", fontFamily: "inherit", fontSize: F.md, fontWeight: 600, color: C.muted, textAlign: "left",
        }}>
        <ListBullets size={16} aria-hidden="true" />
        <span style={{ flex: 1 }}>Your lists</span>
        <span className="side-count">{lists.length}</span>
      </button>
      {open && (
        <div style={{ paddingLeft: 32, display: "grid", gap: 2 }}>
          {lists.length === 0
            ? <p style={{ fontSize: F.xs, color: C.dim, margin: "4px 0", lineHeight: 1.5 }}>None yet. Save a tool to start one.</p>
            : lists.map((l) => (
              <a key={l.id} href={`/lists/mine#list-${l.id}`} style={{ fontSize: F.sm, color: C.text, textDecoration: "none", padding: "2px 0" }}>
                {l.name} <span className="tnum" style={{ color: C.dim, fontSize: F.xs }}>{l.items.length}</span>
              </a>
            ))}
          <a href="/lists/mine" style={{ fontSize: F.xs, color: C.muted, padding: "4px 0" }}>Manage your lists</a>
        </div>
      )}
    </div>
  );
}
