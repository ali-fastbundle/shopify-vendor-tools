"use client";

import React, { useState, useEffect } from "react";
import { C, S, R, F, SOCIALS } from "@/lib/tools";

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
  background: C.field, border: `1px solid ${C.line}`, borderRadius: R.control,
  padding: "8px 12px", fontSize: F.md, color: C.text, fontFamily: "inherit", width: "100%",
};

/*
 * Mirrors rootOf/domainOf in app/api/claim/route.js. Duplicated rather than
 * imported because lib/auth.js pulls in node crypto and this is a client
 * component. It only decides which sentence to show — the server decides
 * whether the shortcut actually applies.
 */
const rootOf = (d) => String(d || "").replace(/^www\./, "").toLowerCase();
const domainOfEmail = (e) => String(e || "").split("@")[1] || "";

const primary = (on) => ({
  background: on ? C.accent : C.subtle,
  color: on ? C.onAccent : C.dim, border: 0, borderRadius: R.control,
  padding: "8px 16px", fontSize: F.md, fontWeight: 700,
  cursor: on ? "pointer" : "default", fontFamily: "inherit",
});

/* ------------------------------------------------------------------ */
/*  Asking for a magic link                                            */
/*                                                                     */
/*  Shared by the bar at the top of the page and by the sign-in prompt  */
/*  inside the review form, because there is one way to sign in and     */
/*  two copies of a fetch is how the two ends up behaving differently.  */
/* ------------------------------------------------------------------ */
function useMagicLink(tool = "") {
  const [email, setEmail] = useState("");
  const [state, setState] = useState({ status: "idle" });

  async function submit() {
    if (!email.trim()) return;
    setState({ status: "sending" });
    try {
      const res = await fetch("/api/auth/request", {
        method: "POST", headers: { "Content-Type": "application/json" },
        /* `tool` is where to come back to. The server checks it against the
           catalogue and carries it inside the signed token; see lib/auth.js. */
        body: JSON.stringify({ email, tool }),
      });
      if (!res.ok) {
        setState({ status: "error", message: await res.text() });
        return;
      }
      const d = await res.json();
      setState({ status: "sent", dev: d.dev });
    } catch {
      setState({ status: "error", message: "Could not reach the server." });
    }
  }

  return { email, setEmail, state, submit };
}

/*
 * The inline version, for the places that need somebody signed in before they
 * can do the thing they came to do. `reason` is the caller's sentence about
 * why, and it is required rather than optional: a sign-in wall with no stated
 * reason reads as a toll, and this one has an argument behind it.
 *
 * `returnTo` is a tool id. It makes the link come back to the tool they were
 * rating rather than to the top of the directory, which is the difference
 * between signing in and being interrupted. What they had typed is kept by the
 * form itself, so it survives the trip through the inbox whichever way they
 * come back.
 */
export function SignInPrompt({ reason, returnTo = "" }) {
  const { email, setEmail, state, submit } = useMagicLink(returnTo);

  if (state.status === "sent") {
    return (
      <div>
        <p style={{ fontSize: F.sm, color: C.text, margin: 0, lineHeight: 1.55, maxWidth: "58ch" }}>
          Check your inbox. The link works once and expires in 15 minutes. It comes back to this
          tool, and what you have written is kept.
        </p>
        {state.dev && (
          <p style={{ fontSize: F.xs, color: C.warnInk, margin: "8px 0 0", lineHeight: 1.5 }}>
            Email is not configured, so the link was written to the server log instead.
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      <p style={{ fontSize: F.sm, color: C.muted, margin: 0, lineHeight: 1.55, maxWidth: "58ch" }}>
        {reason}
      </p>
      <div className="flex flex-wrap items-center" style={{ gap: S.sm, marginTop: S.md }}>
        <input style={{ ...field, width: 240, flexShrink: 0 }} value={email} type="email"
          placeholder="you@yourcompany.com"
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }} />
        <button onClick={submit} disabled={!email.trim() || state.status === "sending"}
          className="press" style={primary(Boolean(email.trim()))}>
          {state.status === "sending" ? "Sending…" : "Email me a link"}
        </button>
      </div>
      {state.status === "error" && (
        <p style={{ fontSize: F.xs, color: C.badInk, margin: "8px 0 0" }}>{state.message}</p>
      )}
      <p style={{ fontSize: F.xs, color: C.dim, margin: "8px 0 0", lineHeight: 1.5 }}>
        We store your email address and when you signed in, and nothing else.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sign in / out, top right                                           */
/* ------------------------------------------------------------------ */
export function AccountBar({ session, refresh }) {
  const [open, setOpen] = useState(false);
  const { email, setEmail, state, submit } = useMagicLink();

  async function signOut() {
    await fetch("/api/auth/session", { method: "DELETE" });
    refresh();
  }

  if (session.loading) return null;

  if (session.signedIn) {
    return (
      <div className="flex items-center" style={{ gap: S.md }}>
        <span style={{ fontSize: F.sm, color: C.muted }}>
          {session.email}
          {session.owned?.length ? ` · ${session.owned.length} claimed` : ""}
        </span>
        {session.admin && (
          <a href="/admin" style={{
            background: C.accentSoft, border: `1px solid ${C.accentEdge}`,
            color: C.accentInk, borderRadius: R.control, padding: "8px 12px", fontSize: F.xs,
            fontWeight: 600, textDecoration: "none",
          }}>Admin</a>
        )}
        <button onClick={signOut} style={{
          background: "transparent", border: `1px solid ${C.line}`, color: C.muted,
          borderRadius: R.control, padding: "8px 12px", fontSize: F.xs, cursor: "pointer", fontFamily: "inherit",
        }}>Sign out</button>
      </div>
    );
  }

  if (!session.configured) {
    return <span style={{ fontSize: F.xs, color: C.dim }}>Accounts are not enabled</span>;
  }

  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen((o) => !o)} style={{
        background: C.subtle, border: `1px solid ${C.line}`, color: C.text,
        borderRadius: R.control, padding: "8px 12px", fontSize: F.sm, fontWeight: 600,
        cursor: "pointer", fontFamily: "inherit",
      }}>
        Sign in
      </button>

      {open && (
        <div style={{
          position: "absolute", right: 0, top: "calc(100% + 8px)", width: 320, zIndex: 30,
          background: C.panel, border: `1px solid ${C.line}`, borderRadius: R.card, padding: S.lg,
          boxShadow: C.shadowLg,
        }}>
          {state.status === "sent" ? (
            <>
              <p style={{ fontSize: F.md, lineHeight: 1.5, margin: 0 }}>
                Check your inbox. The link works once and expires in 15 minutes.
              </p>
              {state.dev && (
                <p style={{ fontSize: F.xs, color: C.warnInk, marginTop: S.sm, lineHeight: 1.5 }}>
                  Email is not configured, so the link was written to the server log instead.
                </p>
              )}
            </>
          ) : (
            <>
              <p style={{ fontSize: F.sm, color: C.muted, margin: "0 0 12px", lineHeight: 1.5 }}>
                Signing in is what lets you rate and review a tool, one rating per account. Built one
                of these tools? Sign in, then prove you control its domain to edit the listing.
              </p>
              <input style={field} value={email} type="email" placeholder="you@yourcompany.com"
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submit(); }} />
              <button onClick={submit} disabled={!email.trim() || state.status === "sending"}
                style={{ ...primary(Boolean(email.trim())), marginTop: S.sm, width: "100%" }}>
                {state.status === "sending" ? "Sending…" : "Email me a link"}
              </button>
              {state.status === "error" && (
                <p style={{ fontSize: F.xs, color: C.badInk, marginTop: S.sm }}>{state.message}</p>
              )}
              <p style={{ fontSize: F.xs, color: C.dim, marginTop: S.md, lineHeight: 1.5 }}>
                No password. We store your email address and when you signed in, and nothing else.
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
  const owns = session.owned?.includes(tool.id) || session.admin;
  // Signing in from the tool's own domain is itself proof, so that path skips publishing.
  const shortcut = rootOf(domainOfEmail(session.email)) === rootOf(tool.domain);
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
      <p style={{ fontSize: F.sm, color: C.dim, marginTop: S.lg, lineHeight: 1.55 }}>
        Is this your tool? Sign in at the top of the page to claim the listing and edit
        how it is described. Any email works, because ownership is proved against the site
        rather than the address you sign in with.
      </p>
    );
  }

  if (owns) {
    return (
      <div style={{ marginTop: S.lg, border: `1px solid ${C.accentEdge}`, borderRadius: R.card, padding: S.lg }}>
        <div className="flex flex-wrap items-center justify-between" style={{ gap: S.md }}>
          <span style={{ fontSize: F.md, fontWeight: 600, color: C.accentInk }}>
            {session.admin && !session.owned?.includes(tool.id) ? "Editing as admin" : "You own this listing"}
          </span>
          <button onClick={() => setEditing((e) => !e)} style={{
            background: editing ? C.subtle : C.accent,
            color: editing ? C.text : C.onAccent,
            border: editing ? `1px solid ${C.line}` : 0, borderRadius: R.control,
            padding: "8px 16px", fontSize: F.sm, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
          }}>{editing ? "Cancel" : "Edit details"}</button>
        </div>
        {editing && <EditForm tool={tool} onDone={onTools} onClose={() => setEditing(false)} />}
        {!editing && (
          <p style={{ fontSize: F.xs, color: C.dim, marginTop: S.md, lineHeight: 1.55 }}>
            You can change the summary, description, pricing, site and social links. The
            category, the "watch for" note and community ratings stay with the editors.
          </p>
        )}
      </div>
    );
  }

  return (
    <div style={{ marginTop: S.lg, border: `1px dashed ${C.line}`, borderRadius: R.card, padding: S.lg }}>
      <p style={{ fontSize: F.md, fontWeight: 700, margin: 0 }}>Is this your tool?</p>
      <p style={{ fontSize: F.sm, color: C.muted, margin: "8px 0 0", lineHeight: 1.55 }}>
        Claim the listing to edit how it is described. You prove it by publishing a short
        string on <b style={{ color: C.text }}>{tool.domain}</b>, either a file or a meta tag,
        whichever your stack makes easy. It is the site that proves ownership, so it does
        not matter which email you signed in with.
      </p>

      {!claim && (
        <>
          {shortcut ? (
            <p style={{ fontSize: F.sm, color: C.muted, margin: "12px 0 0", lineHeight: 1.6 }}>
              You are signed in as <b style={{ color: C.text }}>{session.email}</b>, which is
              already on {tool.domain}. That is proof enough on its own, so you can skip
              publishing anything, so this should verify the moment you click.
            </p>
          ) : (
            <p style={{ fontSize: F.sm, color: C.muted, margin: "12px 0 0", lineHeight: 1.6 }}>
              You are signed in as <b style={{ color: C.text }}>{session.email}</b>. Since that
              is not on {tool.domain}, you will verify by publishing a short string on the
              site. Takes a minute if you can edit the homepage or upload a file.
            </p>
          )}
          <button onClick={() => act("start")} disabled={busy}
            style={{ ...primary(true), marginTop: S.md }}>
            {busy ? "Checking…" : "Claim this listing"}
          </button>
        </>
      )}

      {claim && (
        <div style={{ marginTop: S.lg }}>
          <p style={{ fontSize: F.sm, lineHeight: 1.6, margin: 0 }}>
            Publish this string anywhere on <b>{tool.domain}</b>. Either place below works,
            and you can take it down once the claim is verified.
          </p>
          <pre style={{
            background: C.field, border: `1px solid ${C.line}`, borderRadius: R.control,
            padding: S.md, fontSize: F.xs, color: C.accentInk, overflowX: "auto", marginTop: S.sm,
          }}>{claim.record}</pre>
          <ul style={{ fontSize: F.sm, color: C.muted, lineHeight: 1.6, paddingLeft: S.lg, margin: "8px 0 0" }}>
            <li>as a file at <code style={{ color: C.text }}>/.well-known/svt-verify.txt</code>, or</li>
            <li>as a meta tag on your homepage: <code style={{ color: C.text }}>{claim.instructions?.meta}</code></li>
          </ul>
          <button onClick={() => act("verify")} disabled={busy}
            style={{ ...primary(true), marginTop: S.md }}>
            {busy ? "Looking…" : "I have published it, check now"}
          </button>
        </div>
      )}

      {msg && <p style={{ fontSize: F.xs, color: C.warnInk, marginTop: S.md, lineHeight: 1.55 }}>{msg}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
function EditForm({ tool, onDone, onClose }) {
  const [form, setForm] = useState({
    one: tool.one || "", note: tool.note || "", price: tool.price || "",
    free: Boolean(tool.free), url: tool.url || "",
    /* One field per network in SOCIALS, so a network added there gets an input
       here without anybody remembering to add one. */
    ...Object.fromEntries(SOCIALS.map(({ key }) => [key, tool.social?.[key] || ""])),
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
          social: Object.fromEntries(SOCIALS.map(({ key }) => [key, form[key]])),
        },
      }),
    });
    if (!res.ok) { setMsg(await res.text()); setBusy(false); return; }
    const d = await res.json();
    onDone(d.tools);
    setBusy(false);
    onClose();
  }

  const label = { fontSize: F.xs, color: C.dim, fontWeight: 600, display: "block", marginBottom: S.xs };

  return (
    <div className="flex flex-col" style={{ gap: S.md, marginTop: S.lg }}>
      <div>
        <label style={label}>One-line summary, shown on the card</label>
        <input style={field} value={form.one} onChange={set("one")} maxLength={140} />
      </div>
      <div>
        <label style={label}>Description</label>
        <textarea style={{ ...field, minHeight: 120, resize: "vertical", lineHeight: 1.5 }}
          value={form.note} onChange={set("note")} maxLength={1200} />
      </div>
      <div className="flex flex-wrap" style={{ gap: S.md }}>
        <div style={{ flex: 1, minWidth: 170 }}>
          <label style={label}>Pricing, as you want it shown</label>
          <input style={field} value={form.price} onChange={set("price")} maxLength={60} />
        </div>
        <div style={{ flex: 1, minWidth: 170 }}>
          <label style={label}>Website</label>
          <input style={field} value={form.url} onChange={set("url")} placeholder="https://" />
        </div>
      </div>
      <label className="flex items-center" style={{ gap: S.sm, fontSize: F.sm, cursor: "pointer" }}>
        <input type="checkbox" checked={form.free} style={{ accentColor: C.accent, width: 15, height: 15 }}
          onChange={(e) => setForm({ ...form, free: e.target.checked })} />
        Offers a free plan
      </label>
      <div className="flex flex-wrap" style={{ gap: S.md }}>
        {SOCIALS.map(({ key, label: name, placeholder }) => (
          <div key={key} style={{ flex: 1, minWidth: 150 }}>
            <label style={label}>{name}</label>
            <input style={field} value={form[key]} onChange={set(key)} placeholder={placeholder} />
          </div>
        ))}
      </div>
      <div className="flex items-center" style={{ gap: S.md }}>
        <button onClick={save} disabled={busy} style={primary(true)}>
          {busy ? "Saving…" : "Save changes"}
        </button>
        <span style={{ fontSize: F.xs, color: C.dim }}>
          Edits go live immediately and are marked on the listing.
        </span>
      </div>
      {msg && <p style={{ fontSize: F.xs, color: C.badInk }}>{msg}</p>}
    </div>
  );
}
