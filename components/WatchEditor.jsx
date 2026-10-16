"use client";

/*
 * The admin-only caveat editor on a tool page (invariant 1). The current
 * caveat, the new one and a required reason, with the full before and after on
 * screen. Two presses, like Publish: the first arms, the second commits to
 * lib/tools.js on main. The readiness rules run here and again on the server.
 * Below it, every change and attempt to this tool's caveat, who and when.
 *
 * Rendered only for an admin; /api/admin re-checks on every request.
 */
import React, { useEffect, useState } from "react";
import { C, S, R, F } from "@/lib/tools";
import { readiness } from "@/lib/drafts";

const box = { border: `1px solid ${C.line}`, borderRadius: R.control, padding: S.md, fontSize: F.sm, lineHeight: 1.6, whiteSpace: "pre-wrap" };

export default function WatchEditor({ tool, log: initialLog = null }) {
  /* The tool page passes the history from the server. The directory's modal
     has none, so it asks for it when it opens. */
  const [log, setLog] = useState(initialLog || []);
  useEffect(() => {
    if (initialLog) return;
    fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "watch-log", id: tool.id, toolId: tool.id }) })
      .then((r) => (r.ok ? r.json() : null)).then((d) => d && setLog(d.log || [])).catch(() => {});
  }, [initialLog, tool.id]);
  const [after, setAfter] = useState(tool.watch);
  const [reason, setReason] = useState("");
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState(null);
  useEffect(() => { if (!armed) return undefined; const t = setTimeout(() => setArmed(false), 6000); return () => clearTimeout(t); }, [armed]);

  const clean = after.replace(/\s+/g, " ").trim();
  const problems = readiness({ ...tool, watch: clean }, "tool").filter((p) => /watch/i.test(p));
  const changed = clean !== tool.watch;
  const ready = changed && !problems.length && reason.trim().length >= 5 && !done;

  async function commit() {
    setBusy(true); setMsg("");
    try {
      const res = await fetch("/api/admin", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "edit-watch", id: tool.id, toolId: tool.id, before: tool.watch, after: clean, reason }),
      });
      if (!res.ok) { setMsg(await res.text()); return; }
      setDone(await res.json());
    } catch { setMsg("Could not reach the server."); } finally { setBusy(false); setArmed(false); }
  }

  return (
    <div style={{ marginTop: S.lg, borderTop: `1px solid ${C.line}`, paddingTop: S.md }}>
      <p style={{ fontSize: F.sm, fontWeight: 600, margin: 0 }}>The caveat</p>
      <p style={{ fontSize: F.xs, color: C.dim, margin: `${S.xs}px 0 0`, lineHeight: 1.5 }}>
        Admins only. Vendors, the monitor and AI rewrites cannot change it. A change is a commit to lib/tools.js on main,
        with your reason in the message, and goes live when Vercel has deployed it.
      </p>
      <p style={{ fontSize: F.xs, color: C.dim, margin: `${S.sm}px 0 2px` }}>Now</p>
      <div style={{ ...box, color: C.muted }}>{tool.watch}</div>
      <p style={{ fontSize: F.xs, color: C.dim, margin: `${S.sm}px 0 2px` }}>New</p>
      <textarea value={after} onChange={(e) => { setAfter(e.target.value); setArmed(false); }} rows={5} aria-label="New caveat"
        style={{ ...box, width: "100%", color: C.text, background: C.panel, fontFamily: "inherit", resize: "vertical" }} />
      <input value={reason} onChange={(e) => { setReason(e.target.value); setArmed(false); }} maxLength={200}
        placeholder="Why it is changing, in one line (required)" aria-label="Why the caveat is changing"
        style={{ ...box, width: "100%", marginTop: S.sm, background: C.panel, color: C.text, fontFamily: "inherit", whiteSpace: "normal" }} />
      {changed && problems.length > 0 && <p style={{ fontSize: F.xs, color: C.warnInk, margin: `${S.xs}px 0 0` }}>{problems.join(" ")}</p>}
      {armed && (
        <div style={{ marginTop: S.sm, padding: S.md, border: `1px solid ${C.edge}`, borderRadius: R.control }}>
          <p style={{ fontSize: F.sm, fontWeight: 600, margin: 0 }}>Commit this to lib/tools.js on main?</p>
          <p style={{ fontSize: F.xs, color: C.dim, margin: `${S.xs}px 0 0` }}>Before</p>
          <p style={{ fontSize: F.sm, margin: 0, color: C.muted, textDecoration: "line-through" }}>{tool.watch}</p>
          <p style={{ fontSize: F.xs, color: C.dim, margin: `${S.xs}px 0 0` }}>After</p>
          <p style={{ fontSize: F.sm, margin: 0 }}>{clean}</p>
          <p style={{ fontSize: F.xs, color: C.dim, margin: `${S.xs}px 0 0` }}>Reason: {reason.trim()}</p>
        </div>
      )}
      <div className="flex flex-wrap items-center" style={{ gap: S.sm, marginTop: S.sm }}>
        <button type="button" disabled={!ready || busy} onClick={() => (armed ? commit() : setArmed(true))} className="press"
          style={{ background: ready ? (armed ? C.warnInk : C.accent) : C.subtle, color: ready ? C.onAccent : C.dim, border: 0, borderRadius: R.control, padding: "6px 14px", fontSize: F.sm, fontWeight: 700, cursor: ready ? "pointer" : "default", fontFamily: "inherit" }}>
          {busy ? "Committing" : armed ? "Yes, commit it" : "Change the caveat"}
        </button>
        {armed && <button type="button" onClick={() => setArmed(false)} style={{ background: "none", border: 0, color: C.muted, fontSize: F.sm, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>}
        {msg && <span style={{ fontSize: F.xs, color: C.warnInk }}>{msg}</span>}
        {done && <span style={{ fontSize: F.xs, color: C.muted }}>Committed <a href={done.url} target="_blank" rel="noopener noreferrer" style={{ color: C.text }}>{String(done.sha).slice(0, 7)}</a>. Live after the deploy, in a minute or two.</span>}
      </div>
      {log.length > 0 && (
        <div style={{ marginTop: S.md }}>
          <p style={{ fontSize: F.xs, color: C.dim, margin: 0 }}>Caveat changes</p>
          {log.map((l, i) => (
            <p key={i} style={{ fontSize: F.xs, color: l.ok ? C.muted : C.warnInk, margin: `${S.xs}px 0 0`, lineHeight: 1.5 }}>
              {String(l.at).slice(0, 16).replace("T", " ")} · {l.by} · {l.ok ? <>committed {l.url ? <a href={l.url} target="_blank" rel="noopener noreferrer" style={{ color: C.text }}>{String(l.sha).slice(0, 7)}</a> : String(l.sha).slice(0, 7)}</> : `failed: ${l.error}`} · {l.reason}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
