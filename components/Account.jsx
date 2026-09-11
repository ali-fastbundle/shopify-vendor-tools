"use client";

import React, { useState, useEffect } from "react";
import { C, catOf } from "@/lib/tools";

/* ------------------------------------------------------------------ */
/*  Session hook                                                       */
/* ------------------------------------------------------------------ */
export function useSession() {
  const [session, setSession] = useState({ loading: true, signedIn: false, owned: [] });

  const refresh = async () => {
    try {
      const r = await fetch("/api/auth/session", { cache: "no-store" });
      const d = await r.json();
      setSession({ loading: false, owned: [], ...d });
    } catch {
      setSession({ loading: false, signedIn: false, configured: false, owned: [] });
    }
  };

  useEffect(() => { refresh(); }, []);
  return [session, refresh];
}

const field = {
  background: "rgba(0,0,0,.3)", border: `1px solid ${C.line}`, borderRadius: 9,
  padding: "9px 12px", fontSize: 14, color: C.text, fontFamily: "inherit", width: "100%",
};

const primary = (on) => ({
  background: on ? "#00E08A" : "rgba(255,255,255,.08)",
  color: on ? "#06110D" : C.dim, border: 0, borderRadius: 9,
  padding: "9px 16px", fontSize: 14, fontWeight: 700,
  cursor: on ? "pointer" : "default", fontFamily: "inherit",
});

/* ------------------------------------------------------------------ */
/*  Sign in / out, top right                                           */
/* ------------------------------------------------------------------ */
export function AccountBar({ session, refresh }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [state, setState] = useState({ status: "idle" });

  async function submit() {
    if (!email.trim()) return;
    setState({ status: "sending" });
    const res = await fetch("/api/auth/request", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      setState({ status: "error", message: await res.text() });
      return;
    }
    const d = await res.json();
    setState({ status: "sent", dev: d.dev });
  }

  async function signOut() {
    await fetch("/api/auth/session", { method: "DELETE" });
    refresh();
  }

  if (session.loading) return null;

  if (session.signedIn) {
    return (
      <div className="flex items-center" style={{ gap: 10 }}>
        <span style={{ fontSize: 13, color: C.muted }}>
          {session.email}
          {session.owned?.length ? ` · ${session.owned.length} claimed` : ""}
        </span>
        {session.admin && (
          <a href="/admin" style={{
            background: "rgba(0,224,138,.12)", border: "1px solid rgba(0,224,138,.45)",
            color: "#00E08A", borderRadius: 8, padding: "6px 11px", fontSize: 12.5,
            fontWeight: 600, textDecoration: "none",
          }}>Admin</a>
        )}
        <button onClick={signOut} style={{
          background: "transparent", border: `1px solid ${C.line}`, color: C.muted,
          borderRadius: 8, padding: "6px 11px", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit",
        }}>Sign out</button>
      </div>
    );
  }

  if (!session.configured) {
    return <span style={{ fontSize: 12.5, color: C.dim }}>Accounts are not enabled</span>;
  }

  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen((o) => !o)} style={{
        background: "rgba(255,255,255,.05)", border: `1px solid ${C.line}`, color: C.text,
        borderRadius: 8, padding: "7px 13px", fontSize: 13, fontWeight: 600,
        cursor: "pointer", fontFamily: "inherit",
      }}>
        Sign in to claim a listing
      </button>

      {open && (
        <div style={{
          position: "absolute", right: 0, top: "calc(100% + 8px)", width: 320, zIndex: 30,
          background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: 16,
          boxShadow: "0 20px 50px rgba(0,0,0,.55)",
        }}>
          {state.status === "sent" ? (
            <>
              <p style={{ fontSize: 14, lineHeight: 1.5, margin: 0 }}>
                Check your inbox. The link works once and expires in 15 minutes.
              </p>
              {state.dev && (
                <p style={{ fontSize: 12.5, color: "#FF9052", marginTop: 8, lineHeight: 1.5 }}>
                  Email is not configured, so the link was written to the server log instead.
                </p>
              )}
            </>
          ) : (
            <>
              <p style={{ fontSize: 13.5, color: C.muted, margin: "0 0 10px", lineHeight: 1.5 }}>
                Built one of these tools? Sign in, then prove you control its domain to edit the listing.
              </p>
              <input style={field} value={email} type="email" placeholder="you@yourcompany.com"
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submit(); }} />
              <button onClick={submit} disabled={!email.trim() || state.status === "sending"}
                style={{ ...primary(Boolean(email.trim())), marginTop: 9, width: "100%" }}>
                {state.status === "sending" ? "Sending…" : "Email me a link"}
              </button>
              {state.status === "error" && (
                <p style={{ fontSize: 12.5, color: "#FF6B8A", marginTop: 8 }}>{state.message}</p>
              )}
              <p style={{ fontSize: 11.5, color: C.dim, marginTop: 10, lineHeight: 1.5 }}>
                No password. We store your email address and nothing else.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Claim + edit, inside the tool detail view                          */
/* ------------------------------------------------------------------ */
export function OwnerPanel({ tool, session, refresh, onTools }) {
  const col = catOf(tool.cat).color;
  const owns = session.owned?.includes(tool.id) || session.admin;
  const [claim, setClaim] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [editing, setEditing] = useState(false);

  async function act(action) {
    setBusy(true); setMsg("");
    const res = await fetch("/api/claim", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toolId: tool.id, action }),
    });
    if (!res.ok) { setMsg(await res.text()); setBusy(false); return; }
    const d = await res.json();
    if (d.status === "verified") { setClaim(null); setMsg(""); await refresh(); }
    else { setClaim(d); setMsg(d.message || ""); }
    setBusy(false);
  }

  if (!session.signedIn) {
    return (
      <p style={{ fontSize: 13, color: C.dim, marginTop: 18, lineHeight: 1.55 }}>
        Is this your tool? Sign in at the top of the page to claim the listing and edit
        how it is described.
      </p>
    );
  }

  if (owns) {
    return (
      <div style={{ marginTop: 18, border: `1px solid ${col}55`, borderRadius: 12, padding: 16 }}>
        <div className="flex flex-wrap items-center justify-between" style={{ gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: col }}>
            {session.admin && !session.owned?.includes(tool.id) ? "Editing as admin" : "You own this listing"}
          </span>
          <button onClick={() => setEditing((e) => !e)} style={{
            background: editing ? "rgba(255,255,255,.06)" : col,
            color: editing ? C.text : "#06110D",
            border: editing ? `1px solid ${C.line}` : 0, borderRadius: 8,
            padding: "7px 14px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
          }}>{editing ? "Cancel" : "Edit details"}</button>
        </div>
        {editing && <EditForm tool={tool} onDone={onTools} onClose={() => setEditing(false)} />}
        {!editing && (
          <p style={{ fontSize: 12.5, color: C.dim, marginTop: 10, lineHeight: 1.55 }}>
            You can change the summary, description, pricing, site and social links. The
            category, the "watch for" note and community ratings stay with the editors.
          </p>
        )}
      </div>
    );
  }

  return (
    <div style={{ marginTop: 18, border: `1px dashed ${C.line}`, borderRadius: 12, padding: 16 }}>
      <p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Is this your tool?</p>
      <p style={{ fontSize: 13.5, color: C.muted, margin: "6px 0 0", lineHeight: 1.55 }}>
        Claim the listing to edit how it is described. You prove it by publishing a short
        string on {tool.domain}, or by signing in with an email at that domain.
      </p>

      {!claim && (
        <button onClick={() => act("start")} disabled={busy}
          style={{ ...primary(true), marginTop: 12 }}>
          {busy ? "Checking…" : "Claim this listing"}
        </button>
      )}

      {claim && (
        <div style={{ marginTop: 14 }}>
          <p style={{ fontSize: 13.5, lineHeight: 1.6, margin: 0 }}>
            Publish this string on <b>{tool.domain}</b>, either way works:
          </p>
          <pre style={{
            background: "rgba(0,0,0,.4)", border: `1px solid ${C.line}`, borderRadius: 8,
            padding: 11, fontSize: 12.5, color: "#00E08A", overflowX: "auto", marginTop: 9,
          }}>{claim.record}</pre>
          <ul style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, paddingLeft: 18, margin: "8px 0 0" }}>
            <li>as a file at <code style={{ color: C.text }}>/.well-known/svt-verify.txt</code>, or</li>
            <li>as a meta tag on your homepage: <code style={{ color: C.text }}>{claim.instructions?.meta}</code></li>
          </ul>
          <button onClick={() => act("verify")} disabled={busy}
            style={{ ...primary(true), marginTop: 12 }}>
            {busy ? "Looking…" : "I have published it, check now"}
          </button>
        </div>
      )}

      {msg && <p style={{ fontSize: 12.5, color: "#FF9052", marginTop: 10, lineHeight: 1.55 }}>{msg}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
function EditForm({ tool, onDone, onClose }) {
  const [form, setForm] = useState({
    one: tool.one || "", note: tool.note || "", price: tool.price || "",
    free: Boolean(tool.free), url: tool.url || "",
    li: tool.social?.li || "", x: tool.social?.x || "", gh: tool.social?.gh || "",
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function save() {
    setBusy(true); setMsg("");
    const res = await fetch("/api/listing", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        toolId: tool.id,
        edit: {
          one: form.one, note: form.note, price: form.price, free: form.free, url: form.url,
          social: { li: form.li, x: form.x, gh: form.gh },
        },
      }),
    });
    if (!res.ok) { setMsg(await res.text()); setBusy(false); return; }
    const d = await res.json();
    onDone(d.tools);
    setBusy(false);
    onClose();
  }

  const label = { fontSize: 12, color: C.dim, fontWeight: 600, display: "block", marginBottom: 4 };

  return (
    <div className="flex flex-col" style={{ gap: 11, marginTop: 14 }}>
      <div>
        <label style={label}>One-line summary, shown on the card</label>
        <input style={field} value={form.one} onChange={set("one")} maxLength={140} />
      </div>
      <div>
        <label style={label}>Description</label>
        <textarea style={{ ...field, minHeight: 120, resize: "vertical", lineHeight: 1.5 }}
          value={form.note} onChange={set("note")} maxLength={1200} />
      </div>
      <div className="flex flex-wrap" style={{ gap: 11 }}>
        <div style={{ flex: 1, minWidth: 170 }}>
          <label style={label}>Pricing, as you want it shown</label>
          <input style={field} value={form.price} onChange={set("price")} maxLength={60} />
        </div>
        <div style={{ flex: 1, minWidth: 170 }}>
          <label style={label}>Website</label>
          <input style={field} value={form.url} onChange={set("url")} placeholder="https://" />
        </div>
      </div>
      <label className="flex items-center" style={{ gap: 8, fontSize: 13.5, cursor: "pointer" }}>
        <input type="checkbox" checked={form.free} style={{ accentColor: "#00E08A", width: 15, height: 15 }}
          onChange={(e) => setForm({ ...form, free: e.target.checked })} />
        Offers a free plan
      </label>
      <div className="flex flex-wrap" style={{ gap: 11 }}>
        <div style={{ flex: 1, minWidth: 150 }}>
          <label style={label}>LinkedIn</label>
          <input style={field} value={form.li} onChange={set("li")} placeholder="https://linkedin.com/company/…" />
        </div>
        <div style={{ flex: 1, minWidth: 150 }}>
          <label style={label}>X</label>
          <input style={field} value={form.x} onChange={set("x")} placeholder="https://x.com/…" />
        </div>
        <div style={{ flex: 1, minWidth: 150 }}>
          <label style={label}>GitHub</label>
          <input style={field} value={form.gh} onChange={set("gh")} placeholder="https://github.com/…" />
        </div>
      </div>
      <div className="flex items-center" style={{ gap: 10 }}>
        <button onClick={save} disabled={busy} style={primary(true)}>
          {busy ? "Saving…" : "Save changes"}
        </button>
        <span style={{ fontSize: 12, color: C.dim }}>
          Edits go live immediately and are marked on the listing.
        </span>
      </div>
      {msg && <p style={{ fontSize: 12.5, color: "#FF6B8A" }}>{msg}</p>}
    </div>
  );
}
