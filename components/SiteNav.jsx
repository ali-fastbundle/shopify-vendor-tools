import React from "react";
import { C, S, F } from "@/lib/tools";

/*
 * The top-level views, on the pages that are one: Directory, Newsletters,
 * Events, Recent updates. The same four in the same order on every index page,
 * so a visitor on /events can get to the newsletters without going home first.
 *
 * Server-rendered and plain anchors throughout: these are real pages, not
 * in-place views. The directory itself keeps its own copy of this row inside
 * Directory.jsx, because there Recent updates is a tab it can render in place.
 *
 * Same visual contract as the directory's top bar: the current view takes the
 * neutral inversion, the device a selected state uses everywhere on this site.
 * No category colour and no accent.
 */
export const SITE_VIEWS = [
  { id: "directory", label: "Directory", href: "/" },
  { id: "newsletters", label: "Newsletters", href: "/newsletters" },
  { id: "events", label: "Events", href: "/events" },
  { id: "updates", label: "Recent updates", href: "/changes" },
  { id: "blog", label: "Blog", href: "/blog" },
];

export default function SiteNav({ current }) {
  /* The same frame as the directory's top bar (.topbar, .navtab in
     globals.css): wordmark, then the sections as text tabs, the current one
     in the neutral inversion. */
  return (
    <nav aria-label="Sections" style={{ paddingTop: S.lg }}>
      <div className="topbar">
        <a href="/" className="topbar-brand" style={{ color: C.text, fontWeight: 800, fontSize: F.lg, textDecoration: "none", whiteSpace: "nowrap" }}>
          watchfor.tools
        </a>
        <div className="topbar-tabs">
          {SITE_VIEWS.map((v) => (
            <a key={v.id} href={v.href} className="navtab"
              aria-current={v.id === current ? "page" : undefined}>{v.label}</a>
          ))}
        </div>
      </div>
    </nav>
  );
}
