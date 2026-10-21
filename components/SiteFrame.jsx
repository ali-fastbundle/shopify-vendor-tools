"use client";

import React, { Suspense, createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { List, X, MagnifyingGlass, Sparkle } from "@phosphor-icons/react";
import { C, S, R, F, TRACK, BAND, CATEGORIES, AUTHOR, LAST_UPDATED } from "@/lib/tools";
import { INTEGRATIONS, attributesFor } from "@/lib/categories";
import { AccountBar, SessionContext, useSessionState } from "@/components/Account";
import { ThemeToggle } from "@/components/Theme";
import FooterLinks from "@/components/FooterLinks";
import { ListsProvider, SidebarLists } from "@/components/YourLists";
import { FilterGroups, ActiveFilters } from "@/components/DirectoryFilters";
import {
  PanelProvider, MatcherProvider, usePanel, useMatcherOpen, useDirectoryFilters,
  setDirectoryFilters, clearDirectoryRefinements, useParam, setParam,
} from "@/components/ListingParams";

/*
 * The site frame: a persistent sidebar and a content column, rendered by
 * app/layout.js around every page (2026-10-17). It was one header and one
 * footer; the sidebar is the room the Filters button and the hero were
 * compensating for. What follows is why there is one frame at all.
 *
 * Each page used to draw its own. The homepage had the barred wordmark, the
 * tabs, the account controls and the theme toggle inline in Directory.jsx; the
 * index pages had SiteNav, a plain-text wordmark with no account controls; the
 * detail pages had a breadcrumb and nothing else; and every footer was its own
 * paragraph, one of them missing entirely. Four copies of one frame drift, and
 * they had. A page now renders its content and nothing around it.
 *
 * /admin keeps its own header, so the frame steps aside there.
 *
 * The session is fetched once here and shared through SessionContext, so the
 * header and anything on the page that asks useSession() read the same answer
 * from one request rather than one each.
 */

/* The sections, in order, and which paths count as being in each. A tool page
   and a category page are the directory seen one entry at a time. */
export const SITE_VIEWS = [
  { id: "directory", label: "Directory", href: "/", match: (p) => p === "/" || p.startsWith("/tools/") || p.startsWith("/categories") || p.startsWith("/owners") || p.startsWith("/alternatives") || p.startsWith("/compare") },
  { id: "newsletters", label: "Newsletters", href: "/newsletters", match: (p) => p.startsWith("/newsletters") },
  { id: "events", label: "Events", href: "/events", match: (p) => p.startsWith("/events") },
  /* Published lists, the section. It is in the nav only once it has a list
     worth showing (`when`): a section enters the nav when it has content, not
     when its code ships. /lists/mine is your own lists, a tool, not this. */
  { id: "lists", label: "Lists", href: "/lists", when: (c) => c.lists > 0,
    match: (p) => p === "/lists" || (p.startsWith("/lists/") && p !== "/lists/mine") },
  { id: "updates", label: "Recent updates", href: "/changes", match: (p) => p.startsWith("/changes") },
  { id: "blog", label: "Blog", href: "/blog", match: (p) => p.startsWith("/blog") },
];

const FRAME_WIDTH = { maxWidth: 1280, padding: "0 20px" };

const outsideFrame = (p) => p.startsWith("/admin");

/*
 * How many updates have landed since this visitor last opened Recent updates.
 *
 * localStorage, never an account: "what is new to me" is per browser and
 * nobody's business but theirs. Stamped when /changes is opened, because
 * looking is something a person does. The page that knows the feed (the
 * homepage) hands its timestamps up through UpdatesContext; anywhere else
 * there is nothing to count against and the tab is just a tab.
 *
 * Every access is wrapped. Blocked storage costs the count and nothing else,
 * and a missing mark is no count, which is the direction to fail in.
 */
const SEEN_KEY = "svt:updates:seen";
const readSeen = () => {
  try { return localStorage.getItem(SEEN_KEY) || ""; } catch { return ""; }
};
const stampSeen = () => {
  try { localStorage.setItem(SEEN_KEY, new Date().toISOString()); } catch { /* fine */ }
};

const UpdatesContext = createContext(() => {});

/* A page that has the feed calls this with it, and the header counts. */
export function useFeedForCount(feed) {
  const set = useContext(UpdatesContext);
  useEffect(() => {
    set((feed || []).map((e) => String(e.at || "")));
    return () => set([]);
  }, [feed, set]);
}

export function SiteFrameProvider({ children }) {
  const sessionState = useSessionState();
  const [feedTimes, setFeedTimes] = useState([]);
  return (
    <SessionContext.Provider value={sessionState}>
      <UpdatesContext.Provider value={setFeedTimes}>
        <FeedTimes.Provider value={feedTimes}>
          <ListsProvider><PanelProvider><MatcherProvider>{children}</MatcherProvider></PanelProvider></ListsProvider>
        </FeedTimes.Provider>
      </UpdatesContext.Provider>
    </SessionContext.Provider>
  );
}
const FeedTimes = createContext([]);

export function Wordmark() {
  return (
    <span className="flex items-center" style={{ gap: S.sm }}>
      <span className="flex" style={{ gap: 2 }} aria-hidden="true">
        {CATEGORIES.map((c) => (
          <span key={c.id} style={{ width: 3, height: 16, borderRadius: 1.5, background: c.color, display: "inline-block" }} />
        ))}
      </span>
      <span style={{ fontSize: F.xl, fontWeight: 800, letterSpacing: TRACK.tighter, lineHeight: 1, whiteSpace: "nowrap", color: C.text }}>
        Watch For <span style={{ color: C.accentInk }}>Tools</span>
      </span>
    </span>
  );
}

/*
 * The shell. Source order is the keyboard order: the skip link, then the top
 * bar (below 1200px), then the sidebar, then the content. So the sidebar is
 * reachable before the grid, and the skip link lets anybody past a long filter
 * list in one key.
 *
 * Below 1200px the sidebar is a drawer. Open, it takes focus, keeps Tab inside
 * itself, closes on Escape or the scrim, makes the content inert, and hands
 * focus back to the button that opened it.
 */
export function SiteShell({ counts = {}, categories = [], children }) {
  const path = usePathname() || "/";
  const [open, setOpen] = useState(false);
  const sideRef = useRef(null);
  const mainRef = useRef(null);
  const menuRef = useRef(null);

  /* A new page closes the drawer: it was opened to get somewhere. */
  useEffect(() => { setOpen(false); }, [path]);

  useEffect(() => {
    const main = mainRef.current;
    if (!open) { main?.removeAttribute("inert"); return undefined; }
    main?.setAttribute("inert", "");
    const side = sideRef.current;
    const focusables = () => [...(side?.querySelectorAll('a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])') || [])]
      .filter((el) => el.offsetParent !== null);
    focusables()[0]?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") { setOpen(false); return; }
      if (e.key !== "Tab") return;
      const els = focusables();
      if (!els.length) return;
      const first = els[0], last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    /* Widened past 1200 with it open: it is a column again, not a drawer. */
    const mq = window.matchMedia("(min-width: 1200px)");
    const onWide = () => { if (mq.matches) setOpen(false); };
    document.addEventListener("keydown", onKey);
    mq.addEventListener("change", onWide);
    return () => {
      document.removeEventListener("keydown", onKey);
      mq.removeEventListener("change", onWide);
      main?.removeAttribute("inert");
      menuRef.current?.focus();
    };
  }, [open]);

  if (outsideFrame(path)) return children;
  const current = SITE_VIEWS.find((v) => v.match(path))?.id;
  const views = SITE_VIEWS.filter((v) => !v.when || v.when(counts));

  return (
    <>
      <a href="#content" className="skip-link">Skip to content</a>
      <div className="shell">
        <div className="shell-top">
          <div className="shell-top-row">
            <button ref={menuRef} type="button" onClick={() => setOpen(true)}
              aria-expanded={open} aria-controls="site-sidebar"
              className="ctl press"
              style={{
                display: "inline-flex", alignItems: "center", gap: S.xs, background: C.panel,
                border: `1px solid ${C.line}`, borderRadius: R.control, padding: "8px 12px",
                fontSize: F.sm, fontWeight: 600, color: C.text, cursor: "pointer", fontFamily: "inherit",
              }}>
              <List size={16} /> Menu
            </button>
            <a href="/" aria-label="watchfor.tools, home" style={{ textDecoration: "none" }}><Wordmark /></a>
          </div>
          {/* The sections, never behind a button. */}
          <nav aria-label="Sections" className="shell-tabs">
            {views.map((v) => (
              <a key={v.id} href={v.href} className="navtab" aria-current={v.id === current ? "page" : undefined}>{v.label}</a>
            ))}
          </nav>
        </div>

        {open && <button type="button" className="shell-scrim" aria-label="Close menu" tabIndex={-1} onClick={() => setOpen(false)} />}

        <aside id="site-sidebar" ref={sideRef} className="sidebar" data-open={open ? "true" : "false"} aria-label="Site">
          <Sidebar counts={counts} categories={categories} current={current} path={path} onClose={() => setOpen(false)} />
        </aside>

        <div id="content" ref={mainRef} className="shell-main" tabIndex={-1}>
          {children}
        </div>
      </div>
    </>
  );
}

function Sidebar({ counts, categories, current, path, onClose }) {
  const session = useContext(SessionContext);
  const feedTimes = useContext(FeedTimes);
  const [seenAt, setSeenAt] = useState("");
  /* After mount only: localStorage does not exist on the server. Opening
     Recent updates is the look that stamps the mark. */
  useEffect(() => {
    if (path.startsWith("/changes")) stampSeen();
    setSeenAt(readSeen());
  }, [path]);
  const unread = useMemo(
    () => (seenAt ? feedTimes.filter((at) => at > seenAt).length : 0),
    [feedTimes, seenAt],
  );
  /*
   * A count beside each section. Recent updates counts what is new since this
   * browser last looked, and nothing at zero: the size of a feed says nothing,
   * and a first visit has nothing to be new against (rule E).
   */
  const countOf = (id) => (id === "updates" ? (unread > 0 && current !== "updates" ? unread : null) : counts[id]);
  const directoryish = current === "directory";

  return (
    <>
      <div className="flex items-center justify-between">
        <a href="/" aria-label="watchfor.tools, home" style={{ textDecoration: "none" }}><Wordmark /></a>
        <button type="button" onClick={onClose} aria-label="Close menu" className="sidebar-close press"
          style={{ background: "none", border: 0, padding: 4, color: C.muted, cursor: "pointer" }}><X size={18} /></button>
      </div>

      <nav aria-label="Sections" className="side-nav">
        {SITE_VIEWS.filter((v) => !v.when || v.when(counts)).map((v) => {
          const n = countOf(v.id);
          return (
            <a key={v.id} href={v.href} aria-current={v.id === current ? "page" : undefined}>
              <span>{v.label}</span>
              {n != null && n !== "" && <span className="side-count">{n}</span>}
            </a>
          );
        })}
      </nav>

      {/* The recommender, in the spotlight on every page but its own: the one
          thing here that is built for one visitor's app, and the one place
          a visitor gives an email for something in return. */}
      {!path.startsWith("/recommend") && <GrowthPicks />}

      {/* Your own lists, a tool: signed in only, nothing otherwise. */}
      <SidebarLists />

      <Suspense fallback={<SearchBox value="" onChange={() => {}} />}>
        <SidebarSearch path={path} />
      </Suspense>

      <MatcherPrompt path={path} onClose={onClose} />

      {directoryish && (
        <Suspense fallback={<CategoryList categories={categories} active="all" total={counts.directory} />}>
          <DirectoryRefine categories={categories} total={counts.directory} path={path} onClose={onClose} />
        </Suspense>
      )}
      {current === "updates" && (
        <Suspense fallback={null}><FeedRefine /></Suspense>
      )}

      <div style={{ flex: 1 }} />

      <div style={{ display: "grid", gap: S.md }}>
        {/* Who you are, then one row: Admin, Sign out, and the theme at its end. */}
        <AccountBar session={session[0]} refresh={session[1]} placement="up" trailing={<ThemeToggle />} />
        <FooterLinks />
      </div>
    </>
  );
}

/*
 * Growth picks (/recommend), as a block of its own under the sections. Green
 * is the action colour (colour invariant C), and this is the action the site
 * most wants a visitor to take. It says it needs an email, because it does,
 * and a surprise sign-in is how a form gets abandoned.
 */
function GrowthPicks() {
  return (
    <div style={{ background: C.invite, border: `1px solid ${C.accentEdge}`, borderRadius: R.card, padding: S.md }}>
      <p style={{ fontSize: F.sm, fontWeight: 700, margin: 0, color: C.text }}>Growth picks for your app</p>
      <p style={{ fontSize: F.xs, color: C.muted, margin: `${S.xs}px 0 ${S.sm}px`, lineHeight: 1.5 }}>
        Paste your App Store listing. Get up to three tools that fit it, and what each will not fix.
      </p>
      <a href="/recommend" className="ctl press" style={{
        display: "block", textAlign: "center", background: C.accent, color: C.onAccent, borderRadius: R.control,
        padding: "8px 12px", fontSize: F.sm, fontWeight: 700, textDecoration: "none",
      }}>Get my picks</a>
      <p style={{ fontSize: F.xs, color: C.dim, margin: `${S.xs}px 0 0`, textAlign: "center" }}>Free. Sign in with your email.</p>
    </div>
  );
}

function SearchBox({ value, onChange, onSubmit, placeholder = "Search tools, tags, notes", label = "Search" }) {
  return (
    <form role="search" onSubmit={(e) => { e.preventDefault(); onSubmit?.(); }}
      style={{ position: "relative", display: "flex", alignItems: "center" }}>
      <MagnifyingGlass size={15} color={C.dim} weight="bold" style={{ position: "absolute", left: 10, pointerEvents: "none" }} />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={label}
        style={{
          width: "100%", background: C.panel, border: `1px solid ${C.line}`, borderRadius: R.control,
          padding: "8px 12px 8px 32px", fontSize: F.sm, color: C.text, fontFamily: "inherit",
        }} />
    </form>
  );
}

/*
 * One search, the same on every page: Enter goes to /search, which looks in
 * every section at once and shows the results grouped by section
 * (lib/universalSearch.js). It used to filter the list in place on the
 * directory, newsletters and events, which meant the same box answered a
 * different question depending on the page, and a city typed on the
 * directory found nothing. On /search the box starts from the query on
 * screen.
 */
function SidebarSearch({ path }) {
  const urlQ = useParam("q");
  const [draft, setDraft] = useState(null);
  const value = draft === null ? (path === "/search" ? urlQ : "") : draft;
  return <SearchBox value={value} onChange={setDraft} label="Search everything"
    placeholder="Search tools, events, newsletters"
    onSubmit={() => { if (value.trim()) window.location.assign(`/search?q=${encodeURIComponent(value.trim())}`); }} />;
}

/*
 * The matcher, as one prompt. On the directory it opens the full box at the
 * top of the content column; anywhere else it goes there with the box open.
 */
function MatcherPrompt({ path, onClose }) {
  const [, setOpen] = useMatcherOpen();
  const style = {
    display: "flex", alignItems: "center", gap: S.sm, width: "100%", textAlign: "left",
    background: C.panel, border: `1px solid ${C.line}`, borderRadius: R.control,
    padding: "8px 12px", fontSize: F.sm, color: C.text, fontWeight: 600, cursor: "pointer",
    fontFamily: "inherit", textDecoration: "none",
  };
  const label = <><Sparkle size={15} color={C.accentInk} /> <span>Match a problem to tools</span></>;
  if (path !== "/") return <a href="/?ask=1" className="ctl press" style={style}>{label}</a>;
  return (
    <button type="button" className="ctl press" style={style}
      onClick={() => { setOpen(true); onClose(); requestAnimationFrame(() => document.getElementById("matcher-q")?.focus()); }}>
      {label}
    </button>
  );
}

function CategoryList({ categories, active, total, onPick }) {
  const pick = (id) => (e) => {
    if (!onPick || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault(); onPick(id);
  };
  return (
    <nav aria-label="Categories" className="side-cats">
      <p className="side-head">Categories</p>
      <a href="/" onClick={pick("all")} aria-current={active === "all" ? "true" : undefined}>
        <span aria-hidden="true" style={{ width: 3, height: 14, borderRadius: 2, background: "transparent", flexShrink: 0 }} />
        <span>All</span><span className="side-count">{total}</span>
      </a>
      {categories.map((c) => (
        <a key={c.id} href={`/?cat=${c.id}`} onClick={pick(c.id)} aria-current={active === c.id ? "true" : undefined}>
          <span aria-hidden="true" style={{ width: 3, height: 14, borderRadius: 2, background: c.color, flexShrink: 0 }} />
          <span>{c.label}</span><span className="side-count">{c.n}</span>
        </a>
      ))}
    </nav>
  );
}

/*
 * Categories everywhere in the directory's part of the site; the filters and
 * their chips only on "/", where there is a grid for them to act on. The
 * options come from the page (counts, confirmed integrations), which reads
 * merged data the layout does not.
 */
function DirectoryRefine({ categories, total, path, onClose }) {
  const f = useDirectoryFilters();
  const opts = usePanel("directory");
  /* The tool modal pushes /tools/<id> over the directory. That is still the
     directory underneath, so the sidebar keeps showing its state, as the grid
     does, rather than resetting to All until the modal closes. */
  let inModal = false;
  try { inModal = path.startsWith("/tools/") && Boolean(window.history.state?.svtTool); } catch { /* server */ }
  const onHome = path === "/" || inModal;
  const set = (patch) => setDirectoryFilters(patch);
  return (
    <>
      <CategoryList categories={categories} total={total} active={onHome ? f.cat : "all"} onPick={onHome ? (id) => set({ cat: id }) : null} />
      {onHome && opts && (
        <div>
          <p className="side-head">Filters</p>
          <FilterGroups f={f} set={set} options={opts} />
          <div style={{ marginTop: S.sm }}>
            <ActiveFilters f={f} set={set} onClear={clearDirectoryRefinements}
              labels={{
                integration: (id) => INTEGRATIONS.find((i) => i.id === id)?.label || id,
                attribute: (k) => attributesFor(f.cat).find((a) => a.key === k)?.label || k,
              }} />
          </div>
          {/* In the drawer only: the grid is behind it, so say what the
              choices add up to and go there. */}
          <button type="button" onClick={onClose} className="sidebar-close ctl press"
            style={{
              marginTop: S.md, width: "100%", background: C.text, color: C.bg, border: 0,
              borderRadius: R.control, padding: "8px 16px", fontSize: F.sm, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit",
            }}>
            Show {opts.resultCount} {opts.resultCount === 1 ? "tool" : "tools"}
          </button>
        </div>
      )}
    </>
  );
}

/* Recent updates: by tool and by category, through ?tool= and ?cat=. */
function FeedRefine() {
  const tools = usePanel("feed") || [];
  const tool = useParam("tool") || "all";
  const cat = useParam("cat") || "all";
  /* An empty feed has nothing to filter, so nothing is offered (rule E). */
  if (!tools.length) return null;
  const field = {
    width: "100%", background: C.panel, border: `1px solid ${C.line}`, borderRadius: R.control,
    padding: "8px 10px", fontSize: F.sm, color: C.text, fontFamily: "inherit",
  };
  return (
    <div style={{ display: "grid", gap: S.sm }}>
      <p className="side-head" style={{ margin: 0 }}>Filter updates</p>
      <select value={tool} onChange={(e) => setParam("tool", e.target.value === "all" ? "" : e.target.value)} style={field} aria-label="Filter by tool">
        <option value="all">All tools</option>
        {tools.map((t) => <option key={t.id} value={t.id} style={{ background: C.panel }}>{t.name}</option>)}
      </select>
      <select value={cat} onChange={(e) => setParam("cat", e.target.value === "all" ? "" : e.target.value)} style={field} aria-label="Filter by category">
        <option value="all">All categories</option>
        {CATEGORIES.map((c) => <option key={c.id} value={c.id} style={{ background: C.panel }}>{c.label}</option>)}
      </select>
    </div>
  );
}

/*
 * The footer under the content: the byline and the disclaimer. The links that
 * were here (LinkedIn, About, Contact, Privacy) are at the foot of the sidebar.
 * This stays because it carries the promise: no paid placement and no
 * affiliate links, which has to be visible on every page.
 */
export function SiteFooter() {
  const path = usePathname() || "/";
  if (outsideFrame(path)) return null;
  return (
    <footer className="content" style={{ paddingBottom: BAND.mobile }}>
      <p style={{ fontSize: F.xs, color: C.dim, maxWidth: "78ch", lineHeight: 1.65, margin: `${S["3xl"]}px 0 0`, borderTop: `1px solid ${C.line}`, paddingTop: S.lg }}>
        By{" "}
        <a href="/about" style={{ color: C.muted, textDecoration: "none", borderBottom: `1px solid ${C.line}` }}>{AUTHOR}</a>
        {AUTHOR.endsWith(".") ? " " : ". "}
        watchfor.tools is an independent directory for the people who build Shopify apps. Not
        affiliated with, endorsed by, or sponsored by Shopify. Shopify is a trademark of Shopify Inc.
        No listing here paid to be included and none of the links are affiliate links. Notes were last
        updated {LAST_UPDATED}. They are an editorial view, not an endorsement, and pricing moves. Social
        profiles are linked only where the vendor publishes them. Ratings, reviews and suggestions are
        contributed by visitors and shared with everyone.
      </p>
    </footer>
  );
}
