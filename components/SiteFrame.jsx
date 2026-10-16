"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { C, S, F, TRACK, BAND, CATEGORIES, AUTHOR, LAST_UPDATED } from "@/lib/tools";
import { AccountBar, SessionContext, useSessionState } from "@/components/Account";
import { ThemeToggle } from "@/components/Theme";
import FooterLinks from "@/components/FooterLinks";

/*
 * The site frame: one header and one footer, rendered by app/layout.js around
 * every page.
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
  { id: "directory", label: "Directory", href: "/", match: (p) => p === "/" || p.startsWith("/tools/") || p.startsWith("/categories") || p.startsWith("/owners") },
  { id: "newsletters", label: "Newsletters", href: "/newsletters", match: (p) => p.startsWith("/newsletters") },
  { id: "events", label: "Events", href: "/events", match: (p) => p.startsWith("/events") },
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
        <FeedTimes.Provider value={feedTimes}>{children}</FeedTimes.Provider>
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

export function SiteHeader() {
  const path = usePathname() || "/";
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

  if (outsideFrame(path)) return null;
  const current = SITE_VIEWS.find((v) => v.match(path))?.id;

  return (
    <header className="mx-auto" style={{ ...FRAME_WIDTH, paddingTop: S.lg }}>
      <div className="topbar">
        <a href="/" className="topbar-brand" aria-label="watchfor.tools, home" style={{ textDecoration: "none" }}>
          <Wordmark />
        </a>
        <nav aria-label="Sections" className="topbar-tabs">
          {SITE_VIEWS.map((v) => (
            <a key={v.id} href={v.href} className="navtab" aria-current={v.id === current ? "page" : undefined}>
              {v.label}
              {/* Only above zero, only where it is not the current view, and
                  never a coloured dot. Rule E. */}
              {v.id === "updates" && unread > 0 && current !== "updates" && (
                <span className="tnum" style={{ color: C.text, fontWeight: 700 }}>{unread}</span>
              )}
            </a>
          ))}
        </nav>
        {/* minHeight is the signed-out bar's own height: it renders nothing
            until the session loads, and the row grew when it did. */}
        <div className="topbar-account flex items-center" style={{ gap: S.md, minHeight: 38 }}>
          <AccountBar session={session[0]} refresh={session[1]} />
          {/* On a phone the toggle is in the footer: the wordmark, Sign in and
              three theme buttons do not fit one row at 390px. */}
          <span className="theme-top"><ThemeToggle /></span>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const path = usePathname() || "/";
  if (outsideFrame(path)) return null;
  return (
    <footer className="mx-auto" style={{ ...FRAME_WIDTH, paddingBottom: BAND.desktop }}>
      <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: S.lg, marginTop: S["4xl"] }}>
        <div className="theme-foot" style={{ marginBottom: S.lg }}><ThemeToggle /></div>
        <FooterLinks />
        <p style={{ fontSize: F.sm, color: C.dim, maxWidth: "78ch", lineHeight: 1.65, margin: 0 }}>
          By{" "}
          {/* The byline goes to /about, which links LinkedIn. The footer icon
              above still goes straight to LinkedIn. */}
          <a href="/about"
            style={{ color: C.muted, textDecoration: "none", borderBottom: `1px solid ${C.line}` }}>{AUTHOR}</a>
          {AUTHOR.endsWith(".") ? " " : ". "}
          {/* One middle dot on the line, per the dashes-and-dots rule. */}
          <a href="/changes" style={{ color: C.muted }}>Recent updates</a>{" · "}
          <a href="/categories" style={{ color: C.muted }}>Categories</a>{". "}
          watchfor.tools is an independent directory for the people who build Shopify apps. Not
          affiliated with, endorsed by, or sponsored by Shopify. Shopify is a trademark of Shopify Inc.
          No listing here paid to be included and none of the links are affiliate links. Notes were last
          updated {LAST_UPDATED}. They are an editorial view, not an endorsement, and pricing moves. Social
          profiles are linked only where the vendor publishes them. Ratings, reviews and suggestions are
          contributed by visitors and shared with everyone.
        </p>
      </div>
    </footer>
  );
}
