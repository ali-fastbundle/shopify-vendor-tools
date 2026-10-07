"use client";

import { useEffect } from "react";

/*
 * Opens the events timeline at this month. Instant, never smooth: this is a
 * starting position, not motion, and nothing on this site moves on load.
 *
 * Only the timeline's own scroller moves, never the page, so the heading and
 * the month strip stay where a visitor expects them. A URL fragment wins: if
 * somebody followed a link to a particular event or month, the browser has
 * already put it in view and this leaves it there.
 */
export default function TimelineScroll() {
  useEffect(() => {
    try {
      if (window.location.hash) return;
      const box = document.getElementById("event-timeline");
      if (!box) return;
      const target = box.querySelector("[data-now]") || document.getElementById("today");
      if (!target) return;
      box.scrollTop += target.getBoundingClientRect().top - box.getBoundingClientRect().top;
    } catch {}
  }, []);
  return null;
}
