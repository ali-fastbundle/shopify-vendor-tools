"use client";

/*
 * The URL is the state of a listing page, and this is the one way to read and
 * write it.
 *
 * The sidebar lives in the layout and the grid lives in the page, so they
 * cannot share React state. They share the address instead: the sidebar writes
 * ?cat=&q=&free=1… with replaceState, Next 14.2 keeps useSearchParams in step
 * with it, and the grid re-reads.
 *
 * Pass null as the state, never window.history.state. Next's patched
 * replaceState treats a state carrying its own __NA marker as one of its own
 * calls and skips updating the router, so the URL would change and nothing on
 * the page would follow. With null it copies its internal state across itself. The server reads the same parameters
 * (app/page.js), so a filtered link renders filtered in the first HTML.
 *
 * Two bridges carry what only the page knows up to the sidebar: the directory's
 * filter options (counts, confirmed integrations, a category's details), which
 * come from merged data the layout does not read, and the What's moving
 * feed's list of tools. A page publishes; the sidebar renders. Neither is ever
 * a source of state.
 */
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { DEFAULT_FILTERS, parseFilters, toQuery } from "@/lib/directoryFilters";

/* ---------------------------------------------------------------- */
/*  The directory's filters                                           */
/* ---------------------------------------------------------------- */

/**
 * The directory's filters, read off the URL on "/". While the tool modal has
 * pushed /tools/<id>, the last value seen on "/" holds, so the grid behind the
 * modal and the sidebar do not reset and then come back on close.
 */
export function useDirectoryFilters(initial) {
  const path = usePathname() || "/";
  const params = useSearchParams();
  const last = useRef({ ...DEFAULT_FILTERS, ...(initial || {}) });
  if (path === "/") last.current = parseFilters(params);
  return last.current;
}

/**
 * Change some of the directory's filters. On "/" it rewrites the address in
 * place: a filter is not a place to go back to. Anywhere else it goes to the
 * directory with them, which is what a category clicked on a tool page means.
 * Details belong to a category, so changing category drops them.
 */
export function setDirectoryFilters(patch) {
  try {
    const cur = parseFilters(new URLSearchParams(window.location.pathname === "/" ? window.location.search : ""));
    const next = { ...cur, ...patch };
    if ("cat" in patch && patch.cat !== cur.cat && !("has" in patch)) next.has = [];
    const query = toQuery(next);
    if (window.location.pathname === "/") window.history.replaceState(null, "", `/${query}`);
    else window.location.assign(`/${query}`);
  } catch { /* no history API: nothing to filter with */ }
}

export const clearDirectoryRefinements = () =>
  setDirectoryFilters({ free: false, used: false, int: [], has: [] });

/* ---------------------------------------------------------------- */
/*  One text parameter on the current page                            */
/* ---------------------------------------------------------------- */

/** A single query parameter on this page, e.g. ?q= on /newsletters. */
export function useParam(key) {
  const params = useSearchParams();
  return params?.get(key) || "";
}

/** Write one parameter on the current page, dropping it when empty. */
export function setParam(key, value) {
  try {
    const params = new URLSearchParams(window.location.search);
    if (value) params.set(key, value); else params.delete(key);
    const s = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (s ? `?${s}` : "") + window.location.hash);
  } catch { /* fine */ }
}

/* ---------------------------------------------------------------- */
/*  Bridges from a page to the sidebar                                 */
/* ---------------------------------------------------------------- */

const PanelContext = createContext({ panels: {}, setPanel: () => {} });

export function PanelProvider({ children }) {
  const [panels, setPanels] = useState({});
  const setPanel = useRef((key, value) => setPanels((p) => (p[key] === value ? p : { ...p, [key]: value }))).current;
  return <PanelContext.Provider value={{ panels, setPanel }}>{children}</PanelContext.Provider>;
}

/** A page hands the sidebar what it needs to draw this page's filters. */
export function usePublishPanel(key, value) {
  const { setPanel } = useContext(PanelContext);
  useEffect(() => { setPanel(key, value); }, [key, value, setPanel]);
  useEffect(() => () => setPanel(key, null), [key, setPanel]);
}

export function usePanel(key) {
  return useContext(PanelContext).panels[key] || null;
}

/* ---------------------------------------------------------------- */
/*  The matcher, opened from the sidebar, answered in the content     */
/* ---------------------------------------------------------------- */

const MatcherContext = createContext([false, () => {}]);

export function MatcherProvider({ children }) {
  const state = useState(false);
  return <MatcherContext.Provider value={state}>{children}</MatcherContext.Provider>;
}

export const useMatcherOpen = () => useContext(MatcherContext);
