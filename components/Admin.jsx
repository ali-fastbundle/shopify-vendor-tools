"use client";

import React, { useState } from "react";
import { C, TOOLS, catOf, kindOf } from "@/lib/tools";

/*
 * Admin console. The server component above this has already checked
 * ADMIN_EMAILS — this is the view, not the gate, and every button posts to
 * /api/admin which re-checks on its own.
 */
export default function AdminPanel({ email, suggestions, claims, subscribers }) {
  const [rows, setRows] = useState(suggestions || []);
  const [claimRows, setClaimRows] = useState(claims || {});
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  const pending = rows.filter((s) => s.approved === false);
  const approved = rows.filter((s) => s.approved !== false);

  async function act(action, id) {
    setBusy(action + id); setErr("");
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, id }),
      });
      if (!res.ok) { setErr(await res.text()); return; }
      const d = await res.json();
      if (d.suggestions) setRows(d.suggestions);
      if (d.claims) setClaimRows(d.claims);
    } catch {
      setErr("Could not reach the server.");
    } finally {
      setBusy("");
    }
  }

  return (
    <main style={{
      background: C.bg, color: C.text, minHeight: "100vh",
      fontFamily: "Archivo, Inter, system-ui, sans-serif",
    }}>
      <div className="mx-auto px-5" style={{ maxWidth: 1140 }}>
        <header className="pt-8 pb-6">
          <div className="flex flex-wrap items-baseline justify-between" style={{ gap: 10 }}>
            <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.03em", margin: 0 }}>Admin</h1>
            <span style={{ fontSize: 13, color: C.dim }}>
              {email} · <a href="/" style={{ color: C.muted }}>back to the directory</a>
            </span>
          </div>
          {err && (
            <p className="mt-3" style={{ fontSize: 13.5, color: "#FF6B8A", margin: "12px 0 0" }}>{err}</p>
          )}
        </header>

        <Section
          title="Pending suggestions"
          count={pending.length}
          hint="Stored but not served by /api/data. Approving publishes it immediately."
        >
          {pending.length === 0
            ? <Empty>Nothing waiting. With MODERATE_SUGGESTIONS unset, suggestions go live on submit and never land here.</Empty>
            : pending.map((s) => (
              <SuggestionRow key={s.id} s={s}>
                <Btn onClick={() => act("approve-suggestion", s.id)}
                  busy={busy === "approve-suggestion" + s.id} tone="go">Approve</Btn>
                <Btn onClick={() => act("delete-suggestion", s.id)}
                  busy={busy === "delete-suggestion" + s.id} tone="stop">Delete</Btn>
              </SuggestionRow>
            ))}
        </Section>

        <Section title="Approved suggestions" count={approved.length} hint="Public now. Read-only here.">
          {approved.length === 0
            ? <Empty>No suggestions yet.</Empty>
            : approved.map((s) => <SuggestionRow key={s.id} s={s} />)}
        </Section>

        <Section title="Claims" count={Object.keys(claimRows).length}
          hint="A verified claim lets that address edit the listing. Revoking drops the claim; vendor edits already saved stay.">
          {Object.keys(claimRows).length === 0 ? <Empty>No claims yet.</Empty> : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, minWidth: 640 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: C.dim }}>
                    {["Tool", "Email", "Status", "Method", "Date", ""].map((h) => (
                      <th key={h} style={{ fontWeight: 600, padding: "8px 10px 8px 0", borderBottom: `1px solid ${C.line}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(claimRows).map(([toolId, c]) => {
                    const tool = TOOLS.find((t) => t.id === toolId);
                    const verified = c.status === "verified";
                    return (
                      <tr key={toolId}>
                        <td style={cell}>
                          <span style={{ fontWeight: 600 }}>{tool ? tool.name : toolId}</span>
                          {tool && <span style={{ color: catOf(tool.cat).color, marginLeft: 7, fontSize: 12 }}>{catOf(tool.cat).label}</span>}
                        </td>
                        <td style={{ ...cell, color: C.muted }}>{c.email}</td>
                        <td style={cell}>
                          <span style={{
                            fontSize: 11, padding: "1px 7px", borderRadius: 999,
                            color: verified ? "#06110D" : "#FFB020",
                            background: verified ? "#00E08A" : "#FFB0201E",
                            border: `1px solid ${verified ? "#00E08A" : "#FFB02044"}`,
                            fontWeight: verified ? 700 : 500,
                          }}>{c.status}</span>
                        </td>
                        <td style={{ ...cell, color: C.muted }}>{c.method || "—"}</td>
                        <td style={{ ...cell, color: C.dim }}>{c.verifiedAt || c.startedAt || "—"}</td>
                        <td style={{ ...cell, textAlign: "right" }}>
                          <Btn onClick={() => act("revoke-claim", toolId)}
                            busy={busy === "revoke-claim" + toolId} tone="stop">Revoke</Btn>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <Subscribers list={subscribers || []} />

        <Compose count={(subscribers || []).length} />

        <div style={{ height: 60 }} />
      </div>
    </main>
  );
}

const cell = { padding: "10px 10px 10px 0", borderBottom: `1px solid ${C.line}`, verticalAlign: "top" };

function Section({ title, count, hint, children }) {
  return (
    <section className="pb-10">
      <div className="flex flex-wrap items-baseline" style={{ gap: 9 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>{title}</h2>
        <span style={{ fontSize: 13.5, color: C.dim }}>{count}</span>
      </div>
      {hint && <p style={{ fontSize: 13, color: C.muted, margin: "5px 0 0", maxWidth: "72ch", lineHeight: 1.55 }}>{hint}</p>}
      <div className="mt-3" style={{
        background: C.panel, border: `1px solid ${C.line}`, borderRadius: 13, padding: "4px 16px 8px",
      }}>{children}</div>
    </section>
  );
}

function Empty({ children }) {
  return <p style={{ fontSize: 13.5, color: C.dim, lineHeight: 1.55, margin: "14px 0" }}>{children}</p>;
}

function SuggestionRow({ s, children }) {
  const k = kindOf(s.kind);
  return (
    <div style={{ borderTop: `1px solid ${C.line}`, padding: "13px 0" }}>
      <div className="flex flex-wrap items-baseline" style={{ gap: 8 }}>
        <span style={{ fontSize: 15.5, fontWeight: 700 }}>{s.name}</span>
        <span style={{ fontSize: 12, color: k.color }}>{k.label}</span>
        {(!s.kind || s.kind === "tool") && (
          <span style={{ fontSize: 12, color: catOf(s.cat).color }}>{catOf(s.cat).label}</span>
        )}
      </div>
      {s.why && <p style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.55, margin: "5px 0 0", maxWidth: "72ch" }}>{s.why}</p>}
      <p style={{ fontSize: 12, color: C.dim, margin: "5px 0 0" }}>
        {s.by} · {s.date}
        {s.url && <> · <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ color: C.muted }}>{s.url.replace(/^https?:\/\//, "")}</a></>}
      </p>
      {children && <div className="flex mt-2" style={{ gap: 7 }}>{children}</div>}
    </div>
  );
}

function Btn({ onClick, busy, tone, children }) {
  const color = tone === "go" ? "#00E08A" : "#FF6B8A";
  return (
    <button onClick={onClick} disabled={busy} style={{
      background: busy ? "rgba(255,255,255,.06)" : color + "1E",
      color: busy ? C.dim : color,
      border: `1px solid ${color}44`, borderRadius: 8,
      padding: "5px 12px", fontSize: 12.5, fontWeight: 600,
      cursor: busy ? "default" : "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
    }}>{busy ? "…" : children}</button>
  );
}

/*
 * Compose and send. The count in the confirmation comes from the server render,
 * so it is what the list held when the page loaded — the send itself reads the
 * list again, which is why the result reports its own numbers rather than
 * assuming this one.
 */
function Compose({ count }) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");

  const ready = Boolean(subject.trim() && body.trim());

  async function send(test) {
    setBusy(test ? "test" : "send"); setErr(""); setResult(null);
    try {
      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body, test }),
      });
      if (!res.ok) { setErr(await res.text()); return; }
      setResult(await res.json());
      setConfirming(false);
    } catch {
      setErr("Could not reach the server.");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="pb-10">
      <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>Send to the list</h2>
      <p style={{ fontSize: 13, color: C.muted, margin: "5px 0 0", maxWidth: "72ch", lineHeight: 1.55 }}>
        Plain text. An unsubscribe link is appended to every copy automatically, and each
        recipient is sent their own message — nobody sees another subscriber's address.
        Test it on yourself first.
      </p>

      <div className="mt-3 flex flex-col" style={{
        background: C.panel, border: `1px solid ${C.line}`, borderRadius: 13, padding: 16, gap: 10,
      }}>
        <input
          value={subject}
          onChange={(e) => { setSubject(e.target.value); setConfirming(false); }}
          placeholder="Subject"
          style={{
            background: "rgba(0,0,0,.3)", border: `1px solid ${C.line}`, borderRadius: 9,
            padding: "10px 12px", fontSize: 14.5, color: C.text, fontFamily: "inherit", width: "100%",
          }}
        />
        <textarea
          value={body}
          onChange={(e) => { setBody(e.target.value); setConfirming(false); }}
          placeholder="Two new tools went into App Store data this week…"
          style={{
            background: "rgba(0,0,0,.3)", border: `1px solid ${C.line}`, borderRadius: 9,
            padding: "10px 12px", fontSize: 14, color: C.text, fontFamily: "inherit",
            width: "100%", minHeight: 170, resize: "vertical", lineHeight: 1.6,
          }}
        />

        {!confirming ? (
          <div className="flex flex-wrap items-center" style={{ gap: 9 }}>
            <button onClick={() => send(true)} disabled={!ready || Boolean(busy)} style={{
              background: "rgba(255,255,255,.06)", border: `1px solid ${C.line}`,
              color: ready ? C.text : C.dim, borderRadius: 9, padding: "9px 15px",
              fontSize: 13.5, fontWeight: 600, cursor: ready && !busy ? "pointer" : "default",
              fontFamily: "inherit",
            }}>{busy === "test" ? "Sending…" : "Send test to me"}</button>

            <button onClick={() => { setResult(null); setErr(""); setConfirming(true); }}
              disabled={!ready || Boolean(busy) || count === 0} style={{
                background: ready && count ? "#00E08A" : "rgba(255,255,255,.08)",
                color: ready && count ? "#06110D" : C.dim, border: 0, borderRadius: 9,
                padding: "9px 16px", fontSize: 13.5, fontWeight: 700,
                cursor: ready && count && !busy ? "pointer" : "default", fontFamily: "inherit",
              }}>Send to the list</button>

            {count === 0 && <span style={{ fontSize: 12.5, color: C.dim }}>Nobody on the list yet.</span>}
          </div>
        ) : (
          <div style={{
            border: "1px solid rgba(255,107,138,.45)", background: "rgba(255,107,138,.08)",
            borderRadius: 10, padding: 14,
          }}>
            <p style={{ fontSize: 14, margin: 0, lineHeight: 1.55 }}>
              Send <b>{subject}</b> to <b>{count}</b> {count === 1 ? "address" : "addresses"}?
            </p>
            <p style={{ fontSize: 12.5, color: C.muted, margin: "6px 0 0", lineHeight: 1.55 }}>
              There is no recall once this goes out.
            </p>
            <div className="flex flex-wrap mt-3" style={{ gap: 9 }}>
              <button onClick={() => send(false)} disabled={Boolean(busy)} style={{
                background: "#FF6B8A", color: "#06110D", border: 0, borderRadius: 9,
                padding: "9px 16px", fontSize: 13.5, fontWeight: 700,
                cursor: busy ? "default" : "pointer", fontFamily: "inherit",
              }}>{busy === "send" ? "Sending…" : `Yes, send to ${count}`}</button>
              <button onClick={() => setConfirming(false)} disabled={Boolean(busy)} style={{
                background: "transparent", border: `1px solid ${C.line}`, color: C.muted,
                borderRadius: 9, padding: "9px 15px", fontSize: 13.5, fontWeight: 600,
                cursor: busy ? "default" : "pointer", fontFamily: "inherit",
              }}>Cancel</button>
            </div>
          </div>
        )}

        {err && <p style={{ fontSize: 13, color: "#FF6B8A", margin: 0, lineHeight: 1.55 }}>{err}</p>}
        {result && (
          <p style={{ fontSize: 13, color: result.failed ? "#FF9052" : "#00E08A", margin: 0, lineHeight: 1.55 }}>
            {result.test
              ? `Test sent to ${result.to}.`
              : `Sent ${result.sent} of ${result.total}.${result.failed ? ` ${result.failed} failed — check the server log.` : ""}`}
          </p>
        )}
      </div>
    </section>
  );
}

function Subscribers({ list }) {
  const [copied, setCopied] = useState("");

  async function copy() {
    const text = list.map((s) => s.email).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied("Copied " + list.length + " to the clipboard.");
    } catch {
      setCopied("Could not reach the clipboard. This needs HTTPS or localhost.");
    }
    setTimeout(() => setCopied(""), 3000);
  }

  return (
    <section className="pb-10">
      <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>Subscribers</h2>
      <p style={{ fontSize: 13, color: C.muted, margin: "5px 0 0", maxWidth: "72ch", lineHeight: 1.55 }}>
        Addresses are not listed here on purpose. Copy them when you are actually sending,
        and send with the addresses hidden from each other.
      </p>
      <div className="mt-3 flex flex-wrap items-center" style={{
        background: C.panel, border: `1px solid ${C.line}`, borderRadius: 13,
        padding: "16px 18px", gap: 14,
      }}>
        <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1 }}>{list.length}</span>
        <span style={{ fontSize: 13.5, color: C.muted, flex: 1, minWidth: 140 }}>
          {list.length === 1 ? "address" : "addresses"} on the list
        </span>
        <button onClick={copy} disabled={!list.length} style={{
          background: list.length ? "#00E08A" : "rgba(255,255,255,.08)",
          color: list.length ? "#06110D" : C.dim, border: 0, borderRadius: 9,
          padding: "9px 16px", fontSize: 13.5, fontWeight: 700,
          cursor: list.length ? "pointer" : "default", fontFamily: "inherit",
        }}>Copy all</button>
      </div>
      {copied && <p style={{ fontSize: 12.5, color: "#00E08A", margin: "8px 0 0" }}>{copied}</p>}
    </section>
  );
}
