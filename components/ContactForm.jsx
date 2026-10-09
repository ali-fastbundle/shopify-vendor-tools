"use client";

import React, { useEffect, useState } from "react";
import { C, S, R, F } from "@/lib/tools";
import GrowText from "@/components/GrowText";

/*
 * Posts to /api/contact. The address it reaches is never in this page: the
 * route reads it from the environment, so there is nothing here to scrape.
 *
 * `token` is the signed render time the route checks for time-to-submit.
 * `company` is the honeypot: off-screen, out of the tab order and hidden from
 * screen readers, so the only thing that fills it is a script filling every
 * field it finds. A person never sees it.
 *
 * What was typed is kept in this browser until it sends, because the one
 * error a person can hit here, an expired form in a tab left open overnight,
 * is fixed by reloading, and reloading should not cost them the message.
 */
const DRAFT = "svt:contact:draft";

const field = {
  background: C.field, border: `1px solid ${C.line}`, borderRadius: R.control,
  padding: "8px 12px", fontSize: F.md, color: C.text, fontFamily: "inherit", width: "100%",
};
const label = { fontSize: F.sm, fontWeight: 600, display: "block", marginBottom: S.xs };

export default function ContactForm({ token }) {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [company, setCompany] = useState("");
  const [state, setState] = useState({ status: "idle", message: "" });

  useEffect(() => {
    try { const d = JSON.parse(localStorage.getItem(DRAFT) || "null"); if (d) setForm((f) => ({ ...f, ...d })); } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem(DRAFT, JSON.stringify(form)); } catch {}
  }, [form]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    if (e) e.preventDefault();
    if (state.status === "sending") return;
    setState({ status: "sending", message: "" });
    try {
      const res = await fetch("/api/contact", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, company, token }),
      });
      if (!res.ok) { setState({ status: "error", message: await res.text() }); return; }
      try { localStorage.removeItem(DRAFT); } catch {}
      setState({ status: "sent", message: "" });
    } catch {
      setState({ status: "error", message: "Could not reach the server. What you wrote is still here." });
    }
  }

  if (state.status === "sent") {
    return (
      <div role="status" style={{ marginTop: S["2xl"] }}>
        <p style={{ fontSize: F.lg, fontWeight: 700, margin: 0 }}>Sent. Thank you.</p>
        <p style={{ fontSize: F.md, color: C.muted, margin: `${S.sm}px 0 0`, lineHeight: 1.55 }}>
          The reply will come from a person, to {form.email}.
        </p>
      </div>
    );
  }

  const ready = form.email.trim() && form.message.trim().length >= 10;

  return (
    <form onSubmit={submit} style={{ marginTop: S["2xl"], maxWidth: 560 }} noValidate>
      <div style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }} aria-hidden="true">
        <label>
          Company
          <input type="text" name="company" tabIndex={-1} autoComplete="off"
            value={company} onChange={(e) => setCompany(e.target.value)} />
        </label>
      </div>

      <label style={label} htmlFor="c-name">Name <span style={{ color: C.dim, fontWeight: 400 }}>(optional)</span></label>
      <input id="c-name" style={field} value={form.name} onChange={set("name")} maxLength={80} autoComplete="name" />

      <label style={{ ...label, marginTop: S.lg }} htmlFor="c-email">Your email</label>
      <input id="c-email" type="email" required style={field} value={form.email} onChange={set("email")}
        autoComplete="email" maxLength={160} />

      <label style={{ ...label, marginTop: S.lg }} htmlFor="c-message">Message</label>
      <GrowText id="c-message" value={form.message} onChange={set("message")} onSubmit={submit}
        rows={5} maxRows={16} maxLength={4000} style={field} />
      <p style={{ fontSize: F.xs, color: C.dim, margin: `${S.xs}px 0 0` }}>
        Enter makes a new line. Cmd or Ctrl and Enter sends.
      </p>

      <div className="flex flex-wrap items-center" style={{ gap: S.md, marginTop: S.lg }}>
        <button type="submit" disabled={!ready || state.status === "sending"} className="press" style={{
          background: ready ? C.accent : C.subtle, color: ready ? C.onAccent : C.dim,
          border: 0, borderRadius: R.control, padding: "12px 20px", fontSize: F.md, fontWeight: 700,
          cursor: ready ? "pointer" : "default", fontFamily: "inherit",
        }}>{state.status === "sending" ? "Sending…" : "Send message"}</button>
        {state.status === "error" && (
          <span role="alert" style={{ fontSize: F.sm, color: C.badInk }}>{state.message}</span>
        )}
      </div>
      <p style={{ fontSize: F.xs, color: C.dim, margin: `${S.lg}px 0 0`, lineHeight: 1.55, maxWidth: "58ch" }}>
        Your address is used to reply to you and for nothing else. The message is not stored on
        this site; it is sent as one email.
      </p>
    </form>
  );
}
