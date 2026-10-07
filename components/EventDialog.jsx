"use client";

import React, { useEffect, useRef, useState } from "react";
import { C, S, R, F } from "@/lib/tools";
import { EventBody } from "@/components/EventParts";

/*
 * The event modal, as an island beside a list that is already complete in the
 * server HTML. It renders nothing of its own until somebody clicks: every
 * event row is a real anchor to /events/<id>, and this listens for a plain left
 * click on one (`data-event`) and opens the same content in place instead.
 * Middle click, modifier click, no JavaScript and every crawler get the page.
 *
 * The address bar follows the modal, the same arrangement as a tool
 * (invariant 28): opening pushes /events/<id>, closing goes back rather than
 * pushing, and back closes the modal rather than leaving the site. The id lives
 * on the history entry, and is checked against the events this page was given
 * before it opens anything.
 *
 * A native <dialog> opened with showModal(), so focus trapping, Escape and the
 * inert background are the browser's rather than ours.
 */
export default function EventDialog({ events = [], today }) {
  const ref = useRef(null);
  const [openId, setOpenId] = useState(null);
  const byId = useRef(new Map());
  byId.current = new Map(events.map((e) => [e.id, e]));

  useEffect(() => {
    const onClick = (ev) => {
      if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
      const a = ev.target.closest && ev.target.closest("a[data-event]");
      if (!a) return;
      const id = a.getAttribute("data-event");
      if (!byId.current.has(id)) return;
      ev.preventDefault();
      try { window.history.pushState({ ...(window.history.state || {}), svtEvent: id }, "", `/events/${id}`); } catch {}
      setOpenId(id);
    };
    const onPop = () => {
      let id = null;
      try { id = window.history.state && window.history.state.svtEvent; } catch {}
      setOpenId(id && byId.current.has(id) ? id : null);
    };
    document.addEventListener("click", onClick);
    window.addEventListener("popstate", onPop);
    return () => {
      document.removeEventListener("click", onClick);
      window.removeEventListener("popstate", onPop);
    };
  }, []);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (openId && !d.open) { try { d.showModal(); } catch { d.setAttribute("open", ""); } }
    if (!openId && d.open) d.close();
  }, [openId]);

  /* Closing goes back when the entry is one we pushed, so open and close
     leave the history as they found it. */
  const close = () => {
    let ours = false;
    try { ours = Boolean(window.history.state && window.history.state.svtEvent); } catch {}
    if (ours) window.history.back();
    else setOpenId(null);
  };

  const e = openId ? byId.current.get(openId) : null;

  return (
    <dialog ref={ref} aria-labelledby="event-dialog-title"
      onCancel={(ev) => { ev.preventDefault(); close(); }}
      onClick={(ev) => { if (ev.target === ref.current) close(); }}
      style={{
        width: "min(640px, calc(100vw - 32px))", maxHeight: "calc(100dvh - 48px)",
        background: C.panel, color: C.text, border: `1px solid ${C.line}`,
        borderRadius: R.modal, padding: 0, boxShadow: C.shadowLg,
      }}>
      {e && (
        <div style={{ position: "relative" }}>
          <div style={{ height: 4, background: C.edge }} />
          <div style={{ padding: S["2xl"] }}>
            <button type="button" onClick={close} className="press"
              style={{
                position: "absolute", top: S.lg, right: S.lg, background: "transparent",
                border: `1px solid ${C.line}`, borderRadius: R.control, color: C.muted,
                padding: "4px 12px", fontSize: F.sm, cursor: "pointer", fontFamily: "inherit",
              }}>Close</button>
            <div style={{ paddingRight: 72 }}>
              <EventBody e={e} today={today} Heading="h2" headingId="event-dialog-title" />
            </div>
            <p style={{ fontSize: F.xs, margin: `${S.md}px 0 0` }}>
              <a href={`/events/${e.id}`} style={{ color: C.muted }}>Open as its own page</a>
            </p>
          </div>
        </div>
      )}
    </dialog>
  );
}
