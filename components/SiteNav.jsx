import React from "react";
import { C, S, R, F } from "@/lib/tools";

/*
 * The top-level views, on the pages that are one: Directory, Newsletters,
 * Events, Recent updates. The same four in the same order on every index page,
 * so a visitor on /events can get to the newsletters without going home first.
 *
 * Server-rendered and plain anchors throughout: these are real pages, not
 * in-place views. The directory itself keeps its own copy of this row inside
 * Directory.jsx, because there Recent updates is a tab it can render in place.
 *
 * Same visual contract as that row: the current view takes the neutral
 * inversion, the device a selected state uses everywhere on this site. No
 * category colour and no accent.
 */
export const SITE_VIEWS = [
  { id: "directory", label: "Directory", href: "/" },
  { id: "newsletters", label: "Newsletters", href: "/newsletters" },
  { id: "events", label: "Events", href: "/events" },
  { id: "updates", label: "Recent updates", href: "/changes" },
  { id: "blog", label: "Blog", href: "/blog" },
];

export const viewStyle = (on) => ({
  textDecoration: "none",
  background: on ? C.text : "transparent",
  color: on ? C.bg : C.muted,
  border: `1px solid ${on ? C.text : C.line}`,
  borderRadius: R.control, padding: "6px 14px", fontSize: F.sm, fontWeight: 600,
  fontFamily: "inherit", whiteSpace: "nowrap",
});

export default function SiteNav({ current }) {
  return (
    <nav aria-label="Sections" style={{ paddingTop: S["2xl"] }}>
      <div className="flex flex-wrap items-center" style={{ gap: S.xs }}>
        <a href="/" style={{ color: C.text, fontWeight: 800, fontSize: F.md, textDecoration: "none", marginRight: S.md }}>
          watchfor.tools
        </a>
        {SITE_VIEWS.map((v) => (
          <a key={v.id} href={v.href} className="press"
            aria-current={v.id === current ? "page" : undefined}
            style={viewStyle(v.id === current)}>{v.label}</a>
        ))}
      </div>
    </nav>
  );
}
