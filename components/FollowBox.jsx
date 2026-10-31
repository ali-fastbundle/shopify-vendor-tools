"use client";

import React, { useEffect, useState } from "react";
import { Bell } from "@phosphor-icons/react";
import { C, S, R, F } from "@/lib/tools";
import { whatYouGet } from "@/lib/followCopy";
import { REGIONS } from "@/lib/eventRegions";

/*
 * Follow one newsletter or one event by email. Posts to /api/follow, which
 * either follows at once (signed in, same address) or sends a confirmation
 * link and stores nothing until it is clicked.
 *
 * The sentence above the field is the promise, and it is the same sentence
 * the confirmation email repeats (lib/followCopy.js). For a newsletter with no
 * feed it says plainly that new issues cannot be seen, rather than offering
 * something that will never fire.
 *
 * A signed-in visitor's address is filled in for them; anybody else types
 * one. The answer never says whether the address already follows this.
 *
 * kind "events-month" is the monthly events digest on /events: the same box,
 * with a region picked first, so the id followed is "events-monthly:<region>"
 * (lib/eventDigest.js).
 */
export default function FollowBox({ id, kind, name, hasFeed = false }) {
  const [email, setEmail] = useState("");
  const [region, setRegion] = useState("all");
  const monthly = kind === "events-month";
  const [state, setState] = useState({ status: "idle", message: "" });

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const s = await (await fetch("/api/auth/session", { cache: "no-store" })).json();
        if (live && s && s.email) setEmail((e) => e || s.email);
      } catch {}
    })();
    return () => { live = false; };
  }, []);

  async function submit(e) {
    if (e) e.preventDefault();
    if (state.status === "sending") return;
    setState({ status: "sending", message: "" });
    try {
      const res = await fetch("/api/follow", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: monthly ? `events-monthly:${region}` : id, email }),
      });
      if (!res.ok) { setState({ status: "error", message: await res.text() }); return; }
      const d = await res.json();
      setState({ status: d.confirmed ? "done" : "check", message: "" });
    } catch {
      setState({ status: "error", message: "Could not reach the server." });
    }
  }

  const heading = monthly ? "Every month, what is coming up"
    : kind === "event" ? "Get updates about this event"
    : kind === "podcast" ? "Get new episodes by email"
    : hasFeed ? "Get new issues by email" : "Get told when this listing changes";

  return (
    <section aria-label={heading} style={{
      marginTop: S.xl, border: `1px solid ${C.line}`, borderRadius: R.card, padding: S.lg,
    }}>
      <p className="inline-flex items-center" style={{ fontSize: F.md, fontWeight: 700, margin: 0, gap: S.sm }}>
        <Bell size={16} weight="regular" /> {heading}
      </p>
      <p style={{ fontSize: F.sm, color: C.muted, margin: `${S.xs}px 0 0`, lineHeight: 1.55, maxWidth: "62ch" }}>
        {whatYouGet(kind, hasFeed)} Everything you follow comes in one email a day at most.
      </p>

      {state.status === "done" && (
        <p role="status" style={{ fontSize: F.sm, margin: `${S.md}px 0 0` }}>
          Done. {monthly ? "The digest arrives on the 1st." : `You are following ${name}.`} Every email has a link to stop.
        </p>
      )}
      {state.status === "check" && (
        <p role="status" style={{ fontSize: F.sm, margin: `${S.md}px 0 0`, lineHeight: 1.55 }}>
          Check your inbox and press Confirm. Nothing is sent, and the address is not kept, until you do.
        </p>
      )}
      {(state.status === "idle" || state.status === "sending" || state.status === "error") && (
        <form onSubmit={submit} className="flex flex-wrap items-center" style={{ gap: S.sm, marginTop: S.md }}>
          {monthly && (
            <select value={region} onChange={(e) => setRegion(e.target.value)} aria-label="Which events" className="ctl"
              style={{
                background: C.panel, border: `1px solid ${C.line}`, borderRadius: R.control,
                padding: "8px 12px", fontSize: F.md, color: C.text, fontFamily: "inherit",
              }}>
              {REGIONS.map(([r, label]) => <option key={r} value={r}>{r === "all" ? label : `Only ${label}`}</option>)}
            </select>
          )}
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="you@yourcompany.com" aria-label="Your email" autoComplete="email"
            style={{
              background: C.field, border: `1px solid ${C.line}`, borderRadius: R.control,
              padding: "8px 12px", fontSize: F.md, color: C.text, fontFamily: "inherit", width: 260, maxWidth: "100%",
            }} />
          <button type="submit" disabled={!email.trim() || state.status === "sending"} className="press" style={{
            background: email.trim() ? C.accent : C.subtle, color: email.trim() ? C.onAccent : C.dim,
            border: 0, borderRadius: R.control, padding: "8px 16px", fontSize: F.sm, fontWeight: 700,
            cursor: email.trim() ? "pointer" : "default", fontFamily: "inherit",
          }}>{state.status === "sending" ? "Sending…" : "Follow"}</button>
          {state.status === "error" && <span role="alert" style={{ fontSize: F.sm, color: C.badInk }}>{state.message}</span>}
        </form>
      )}
    </section>
  );
}
