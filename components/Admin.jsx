"use client";

import React, { useState } from "react";
import { outbound } from "@/lib/outbound";
import { C, S, R, F, TRACK, ink, TOOLS, catOf, kindOf, reportKindOf } from "@/lib/tools";
import { ThemeToggle } from "./Theme";

/*
 * Admin console. The server component above this has already checked
 * ADMIN_EMAILS — this is the view, not the gate, and every button posts to
 * /api/admin which re-checks on its own.
 */
export default function AdminPanel({ email, suggestions, claims, subscribers, reports, accounts, stats, maillog }) {
  const [rows, setRows] = useState(suggestions || []);
  const [claimRows, setClaimRows] = useState(claims || {});
  const [reportRows, setReportRows] = useState(reports || []);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  const pending = rows.filter((s) => s.approved === false);
  const approved = rows.filter((s) => s.approved !== false);

  // `tag` separates two buttons that post the same action for the same row,
  // so only the one actually clicked shows as busy.
  async function act(action, id, extra = {}, tag = "") {
    setBusy(action + tag + id); setErr("");
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, id, ...extra }),
      });
      if (!res.ok) { setErr(await res.text()); return; }
      const d = await res.json();
      if (d.suggestions) setRows(d.suggestions);
      if (d.claims) setClaimRows(d.claims);
      if (d.reports) setReportRows(d.reports);
    } catch {
      setErr("Could not reach the server.");
    } finally {
      setBusy("");
    }
  }

  return (
    <main style={{ background: C.bg, color: C.text, minHeight: "100vh" }}>
      <div className="mx-auto px-5" style={{ maxWidth: 1140 }}>
        <header className="pt-8 pb-6">
          <div className="flex flex-wrap items-baseline justify-between" style={{ gap: S.md }}>
            <h1 style={{ fontSize: F.display, fontWeight: 800, letterSpacing: TRACK.tighter, margin: 0 }}>Admin</h1>
            <div className="flex flex-wrap items-center" style={{ gap: S.md }}>
              <span style={{ fontSize: F.sm, color: C.dim }}>
                {email} · <a href="/" style={{ color: C.muted }}>back to the directory</a>
              </span>
              <ThemeToggle />
            </div>
          </div>
          {err && (
            <p className="mt-3" style={{ fontSize: F.sm, color: C.badInk, margin: "12px 0 0" }}>{err}</p>
          )}
        </header>

        <Section
          title="Pending suggestions"
          count={pending.length}
          hint="Stored but not served by /api/data. Approving publishes it immediately. Turning one into a listing is a separate, manual edit to lib/tools.js — give the new entry an `updated` of the day it goes in, and the site-wide date follows on its own."
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

        <ClaimsTable
          title="Verified claims"
          hint="These addresses can edit their listing. Revoke access drops the claim and leaves the published copy as the vendor left it; revoke and revert content also restores the editorial original."
          rows={Object.entries(claimRows).filter(([, c]) => c.status === "verified")}
          act={act} busy={busy} verified
          empty="No verified claims yet."
        />

        <ClaimsTable
          title="Pending claims"
          hint="Started but not proved. They have a token to publish on their own domain; nothing is editable until they do."
          rows={Object.entries(claimRows).filter(([, c]) => c.status !== "verified")}
          act={act} busy={busy}
          empty="Nothing pending."
        />

        <Accounts accounts={accounts || {}} claims={claimRows} />

        <Stats stats={stats || { fields: {}, queries: [] }} />

        <MailLog rows={maillog || []} />

        <NotificationTest />

        <Reports rows={reportRows} act={act} busy={busy} />

        <Subscribers list={subscribers || []} />

        <Compose count={(subscribers || []).length} />

        <div style={{ height: 60 }} />
      </div>
    </main>
  );
}

const cell = { padding: "12px 12px 12px 0", borderBottom: `1px solid ${C.line}`, verticalAlign: "top" };

function Section({ title, count, hint, children }) {
  return (
    <section className="pb-10">
      <div className="flex flex-wrap items-baseline" style={{ gap: S.sm }}>
        <h2 style={{ fontSize: F.xl, fontWeight: 700, margin: 0, letterSpacing: TRACK.tight }}>{title}</h2>
        <span style={{ fontSize: F.sm, color: C.dim }}>{count}</span>
      </div>
      {hint && <p style={{ fontSize: F.sm, color: C.muted, margin: "4px 0 0", maxWidth: "72ch", lineHeight: 1.55 }}>{hint}</p>}
      <div className="mt-3" style={{
        background: C.panel, border: `1px solid ${C.line}`, borderRadius: R.card, padding: "4px 16px 8px",
      }}>{children}</div>
    </section>
  );
}

function Empty({ children }) {
  return <p style={{ fontSize: F.sm, color: C.dim, lineHeight: 1.55, margin: "16px 0" }}>{children}</p>;
}

function SuggestionRow({ s, children }) {
  const k = kindOf(s.kind);
  return (
    <div style={{ borderTop: `1px solid ${C.line}`, padding: "12px 0" }}>
      <div className="flex flex-wrap items-baseline" style={{ gap: S.sm }}>
        <span style={{ fontSize: F.lg, fontWeight: 700 }}>{s.name}</span>
        <span style={{ fontSize: F.xs, color: ink(k.color) }}>{k.label}</span>
        {(!s.kind || s.kind === "tool") && (
          <span style={{ fontSize: F.xs, color: ink(catOf(s.cat).color) }}>{catOf(s.cat).label}</span>
        )}
      </div>
      {s.why && <p style={{ fontSize: F.sm, color: C.muted, lineHeight: 1.55, margin: "4px 0 0", maxWidth: "72ch" }}>{s.why}</p>}
      <p style={{ fontSize: F.xs, color: C.dim, margin: "4px 0 0" }}>
        {s.by} · {s.date}
        {s.url && <> · <a href={outbound(s.url)} target="_blank" rel="noopener noreferrer" style={{ color: C.muted }}>{s.url.replace(/^https?:\/\//, "")}</a></>}
      </p>
      {children && <div className="flex mt-2" style={{ gap: S.sm }}>{children}</div>}
    </div>
  );
}

function Btn({ onClick, busy, tone, children }) {
  const color = tone === "go" ? "#00E08A" : "#FF6B8A";
  return (
    <button onClick={onClick} disabled={busy} style={{
      background: busy ? C.subtle : color + "1E",
      color: busy ? C.dim : ink(color),
      border: `1px solid ${color}44`, borderRadius: R.control,
      padding: "4px 12px", fontSize: F.xs, fontWeight: 600,
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
      <h2 style={{ fontSize: F.xl, fontWeight: 700, margin: 0, letterSpacing: TRACK.tight }}>Send to the list</h2>
      <p style={{ fontSize: F.sm, color: C.muted, margin: "4px 0 0", maxWidth: "72ch", lineHeight: 1.55 }}>
        Plain text. An unsubscribe link is appended to every copy automatically, and each
        recipient is sent their own message — nobody sees another subscriber's address.
        Test it on yourself first.
      </p>

      <div className="mt-3 flex flex-col" style={{
        background: C.panel, border: `1px solid ${C.line}`, borderRadius: R.card, padding: S.lg, gap: S.md,
      }}>
        <input
          value={subject}
          onChange={(e) => { setSubject(e.target.value); setConfirming(false); }}
          placeholder="Subject"
          style={{
            background: C.field, border: `1px solid ${C.line}`, borderRadius: R.control,
            padding: S.md, fontSize: F.md, color: C.text, fontFamily: "inherit", width: "100%",
          }}
        />
        <textarea
          value={body}
          onChange={(e) => { setBody(e.target.value); setConfirming(false); }}
          placeholder="Two new tools went into App Store data this week…"
          style={{
            background: C.field, border: `1px solid ${C.line}`, borderRadius: R.control,
            padding: S.md, fontSize: F.md, color: C.text, fontFamily: "inherit",
            width: "100%", minHeight: 170, resize: "vertical", lineHeight: 1.6,
          }}
        />

        {!confirming ? (
          <div className="flex flex-wrap items-center" style={{ gap: S.sm }}>
            <button onClick={() => send(true)} disabled={!ready || Boolean(busy)} style={{
              background: C.subtle, border: `1px solid ${C.line}`,
              color: ready ? C.text : C.dim, borderRadius: R.control, padding: "8px 16px",
              fontSize: F.sm, fontWeight: 600, cursor: ready && !busy ? "pointer" : "default",
              fontFamily: "inherit",
            }}>{busy === "test" ? "Sending…" : "Send test to me"}</button>

            <button onClick={() => { setResult(null); setErr(""); setConfirming(true); }}
              disabled={!ready || Boolean(busy) || count === 0} style={{
                background: ready && count ? C.accent : C.subtle,
                color: ready && count ? C.onAccent : C.dim, border: 0, borderRadius: R.control,
                padding: "8px 16px", fontSize: F.sm, fontWeight: 700,
                cursor: ready && count && !busy ? "pointer" : "default", fontFamily: "inherit",
              }}>Send to the list</button>

            {count === 0 && <span style={{ fontSize: F.xs, color: C.dim }}>Nobody on the list yet.</span>}
          </div>
        ) : (
          <div style={{
            border: `1px solid ${C.badEdge}`, background: C.badSoft,
            borderRadius: R.control, padding: S.lg,
          }}>
            <p style={{ fontSize: F.md, margin: 0, lineHeight: 1.55 }}>
              Send <b>{subject}</b> to <b>{count}</b> {count === 1 ? "address" : "addresses"}?
            </p>
            <p style={{ fontSize: F.xs, color: C.muted, margin: "8px 0 0", lineHeight: 1.55 }}>
              There is no recall once this goes out.
            </p>
            <div className="flex flex-wrap mt-3" style={{ gap: S.sm }}>
              <button onClick={() => send(false)} disabled={Boolean(busy)} style={{
                background: "#FF6B8A", color: C.onAccent, border: 0, borderRadius: R.control,
                padding: "8px 16px", fontSize: F.sm, fontWeight: 700,
                cursor: busy ? "default" : "pointer", fontFamily: "inherit",
              }}>{busy === "send" ? "Sending…" : `Yes, send to ${count}`}</button>
              <button onClick={() => setConfirming(false)} disabled={Boolean(busy)} style={{
                background: "transparent", border: `1px solid ${C.line}`, color: C.muted,
                borderRadius: R.control, padding: "8px 16px", fontSize: F.sm, fontWeight: 600,
                cursor: busy ? "default" : "pointer", fontFamily: "inherit",
              }}>Cancel</button>
            </div>
          </div>
        )}

        {err && <p style={{ fontSize: F.sm, color: C.badInk, margin: 0, lineHeight: 1.55 }}>{err}</p>}
        {result && (
          <p style={{ fontSize: F.sm, color: result.failed ? C.warnInk : C.accentInk, margin: 0, lineHeight: 1.55 }}>
            {result.test
              ? `Test sent to ${result.to}.`
              : `Sent ${result.sent} of ${result.total}.${result.failed ? ` ${result.failed} failed — check the server log.` : ""}`}
          </p>
        )}
      </div>
    </section>
  );
}

/*
 * Corrections sent in from the site. Nothing here has touched the catalogue —
 * /api/report only ever writes to svt:reports — so resolving one means "I have
 * made the change by hand", not "apply this". Dismissed rows stay, because a
 * dismissal is evidence somebody read it.
 */
/*
 * Corrections sent in from the site. Nothing here has touched the catalogue —
 * /api/report only ever writes to svt:reports — so resolving one means "I have
 * made the change by hand", not "apply this". Dismissed rows stay, because a
 * dismissal is evidence somebody read it.
 */
/*
 * Sends a real notification and reports what came back. Its own fetch rather
 * than act(), because the useful answer here is a diagnostic string, not a
 * refreshed list of rows.
 */
/*
 * One table, two states. Verified claims are the ones that grant edit rights,
 * so they get their own heading rather than a status pill buried in a mixed
 * list; pending ones are a different question (has this vendor published the
 * token yet) and read better apart.
 */
function ClaimsTable({ title, hint, rows, act, busy, verified, empty }) {
  return (
    <Section title={title} count={rows.length} hint={hint}>
      {rows.length === 0 ? <Empty>{empty}</Empty> : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: F.sm, minWidth: 640 }}>
            <thead>
              <tr style={{ textAlign: "left", color: C.dim }}>
                {["Tool", "Email", "Method", verified ? "Verified" : "Started", ""].map((h) => (
                  <th key={h} style={{ fontWeight: 600, padding: "8px 12px 8px 0", borderBottom: `1px solid ${C.line}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(([toolId, c]) => {
                const tool = TOOLS.find((t) => t.id === toolId);
                return (
                  <tr key={toolId}>
                    <td style={cell}>
                      <span style={{ fontWeight: 600 }}>{tool ? tool.name : toolId}</span>
                      {tool && <span style={{ color: ink(catOf(tool.cat).color), marginLeft: S.sm, fontSize: F.xs }}>{catOf(tool.cat).label}</span>}
                    </td>
                    <td style={{ ...cell, color: C.muted }}>{c.email}</td>
                    <td style={{ ...cell, color: C.muted }}>
                      {c.method === "email-domain" ? "email domain" : c.method === "domain" ? "published token" : "—"}
                    </td>
                    <td style={{ ...cell, color: C.dim }}>{(verified ? c.verifiedAt : c.startedAt) || "—"}</td>
                    <td style={{ ...cell, textAlign: "right" }}>
                      <div className="flex flex-wrap justify-end" style={{ gap: S.sm }}>
                        <Btn onClick={() => act("revoke-claim", toolId, { revertContent: false }, "access")}
                          busy={busy === "revoke-claimaccess" + toolId} tone="stop">Revoke access</Btn>
                        <Btn onClick={() => act("revoke-claim", toolId, { revertContent: true }, "revert")}
                          busy={busy === "revoke-claimrevert" + toolId} tone="stop">Revoke and revert content</Btn>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

const when = (iso) => {
  if (!iso) return "—";
  // Stored as a full ISO timestamp; the minute is enough to read at a glance.
  return String(iso).slice(0, 16).replace("T", " ");
};

/*
 * Who has ever signed in. Three fields, because that is all that is stored —
 * see lib/accounts.js. The claimed column is joined here from svt:claims rather
 * than duplicated onto the account record, so there is one source of truth for
 * who owns what.
 */
function Accounts({ accounts, claims }) {
  const rows = Object.values(accounts).sort((a, b) => String(b.lastSeen).localeCompare(String(a.lastSeen)));
  const claimedBy = (email) => Object.entries(claims)
    .filter(([, c]) => c.email === email && c.status === "verified")
    .map(([toolId]) => (TOOLS.find((t) => t.id === toolId)?.name) || toolId);

  return (
    <Section title="Accounts" count={rows.length}
      hint="Created on first sign-in. Email, first seen and last seen — no IP, no user agent, no page history. The sign-in copy promises exactly this, so adding a field here means changing that copy too.">
      {rows.length === 0 ? <Empty>Nobody has signed in yet.</Empty> : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: F.sm, minWidth: 620 }}>
            <thead>
              <tr style={{ textAlign: "left", color: C.dim }}>
                {["Email", "First seen", "Last seen", "Claimed"].map((h) => (
                  <th key={h} style={{ fontWeight: 600, padding: "8px 12px 8px 0", borderBottom: `1px solid ${C.line}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => {
                const owns = claimedBy(a.email);
                return (
                  <tr key={a.email}>
                    <td style={cell}><a href={`mailto:${a.email}`} style={{ color: C.text }}>{a.email}</a></td>
                    <td style={{ ...cell, color: C.dim }}>{when(a.firstSeen)}</td>
                    <td style={{ ...cell, color: C.muted }}>{when(a.lastSeen)}</td>
                    <td style={{ ...cell, color: owns.length ? C.text : C.dim }}>
                      {owns.length ? owns.join(", ") : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

/*
 * Directory counters. Deliberately narrow: page traffic is Vercel Analytics'
 * job, and this holds only the two things it cannot see.
 */
function Stats({ stats }) {
  const fields = stats.fields || {};
  const queries = stats.queries || [];
  const opens = Object.entries(fields)
    .filter(([k]) => k.startsWith("tool:"))
    .map(([k, n]) => [k.slice(5), n])
    .sort((a, b) => b[1] - a[1]);
  const matcherUses = fields["matcher:uses"] || 0;
  const totalOpens = opens.reduce((n, [, v]) => n + v, 0);
  const top = Math.max(1, opens.length ? opens[0][1] : 1);

  return (
    <Section title="Directory stats" count={totalOpens}
      hint="Tool opens and matcher use only. Page views, referrers and paths are in Vercel Analytics and deliberately not duplicated here. Nothing is tied to a person.">
      <div className="flex flex-wrap" style={{ gap: S["2xl"], padding: "12px 0 4px" }}>
        <div>
          <p style={{ fontSize: F["2xl"], fontWeight: 800, margin: 0 }}>{totalOpens}</p>
          <p style={{ fontSize: F.xs, color: C.dim, margin: 0 }}>tool detail opens</p>
        </div>
        <div>
          <p style={{ fontSize: F["2xl"], fontWeight: 800, margin: 0 }}>{matcherUses}</p>
          <p style={{ fontSize: F.xs, color: C.dim, margin: 0 }}>matcher uses</p>
        </div>
      </div>

      {opens.length === 0 ? <Empty>Nothing counted yet.</Empty> : (
        <div className="flex flex-col" style={{ gap: S.sm, padding: "12px 0 8px" }}>
          {opens.slice(0, 15).map(([id, n]) => {
            const tool = TOOLS.find((t) => t.id === id);
            return (
              <div key={id} className="flex items-center" style={{ gap: S.md }}>
                <span style={{ fontSize: F.sm, width: 170, flexShrink: 0 }}>{tool ? tool.name : id}</span>
                <span style={{
                  height: 7, borderRadius: 4, flexShrink: 0,
                  width: `${Math.max(4, Math.round((n / top) * 100))}%`, maxWidth: 380,
                  background: tool ? catOf(tool.cat).color : C.muted,
                }} />
                <span style={{ fontSize: F.xs, color: C.dim }}>{n}</span>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ borderTop: `1px solid ${C.line}`, marginTop: S.md, paddingTop: S.md }}>
        <p style={{ fontSize: F.sm, fontWeight: 600, margin: 0 }}>
          Last {Math.min(queries.length, 50)} matcher queries
        </p>
        {queries.length === 0
          ? <Empty>Nothing asked yet.</Empty>
          : (
            <div className="flex flex-col" style={{ gap: S.xs, marginTop: S.sm }}>
              {queries.slice(0, 50).map((q, i) => (
                <p key={`${i}-${q.slice(0, 12)}`} style={{ fontSize: F.sm, color: C.muted, margin: 0, lineHeight: 1.5 }}>
                  <span style={{ color: C.dim }}>{i + 1}.</span> {q}
                </p>
              ))}
            </div>
          )}
      </div>
    </Section>
  );
}

const MAIL_EVENTS = [
  ["signin_new", "Sign-in (new)"],
  ["signin_return", "Sign-in (returning)"],
  ["signin_link", "Sign-in link"],
  ["subscribe", "Subscribe"],
  ["review", "Review / rating"],
  ["claim_verified", "Claim verified"],
  ["suggestion", "Suggestion"],
  ["report", "Report"],
  ["listing_edited", "Listing edited"],
];

/*
 * The audit trail. Every attempt lands here, so an empty panel after a real
 * event is itself the finding — it means nothing was even tried.
 */
function MailLog({ rows }) {
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const failed24 = rows.filter((r) => !r.ok && Date.parse(r.at || "") >= dayAgo).length;
  const failedAll = rows.filter((r) => !r.ok).length;

  return (
    <Section title="Mail log" count={rows.length}
      hint="Last 100 sends, newest first, from svt:maillog. Every attempt is recorded whether it worked or not — a send that leaves no row here never happened.">
      <div className="flex flex-wrap" style={{ gap: S["2xl"], padding: "12px 0 8px" }}>
        <div>
          <p style={{ fontSize: F["2xl"], fontWeight: 800, margin: 0, color: failed24 ? C.badInk : C.text }}>{failed24}</p>
          <p style={{ fontSize: F.xs, color: C.dim, margin: 0 }}>failures in 24h</p>
        </div>
        <div>
          <p style={{ fontSize: F["2xl"], fontWeight: 800, margin: 0, color: failedAll ? ink("#FFB020") : C.text }}>{failedAll}</p>
          <p style={{ fontSize: F.xs, color: C.dim, margin: 0 }}>failures shown</p>
        </div>
      </div>

      {rows.length === 0 ? <Empty>Nothing sent yet.</Empty> : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: F.sm, minWidth: 680 }}>
            <thead>
              <tr style={{ textAlign: "left", color: C.dim }}>
                {["When", "Event", "To", "Result"].map((h) => (
                  <th key={h} style={{ fontWeight: 600, padding: "8px 12px 8px 0", borderBottom: `1px solid ${C.line}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.at}-${i}`}>
                  <td style={{ ...cell, color: C.dim, whiteSpace: "nowrap" }}>{String(r.at || "").slice(0, 16).replace("T", " ")}</td>
                  <td style={cell}>{r.event}</td>
                  <td style={{ ...cell, color: C.muted }}>
                    <span style={{ color: ink(r.cls === "admin" ? "#4CC9F0" : "#B08CFF") }}>{r.cls}</span>
                    <span style={{ color: C.dim, marginLeft: S.sm }}>{r.to}</span>
                  </td>
                  <td style={{ ...cell, color: r.ok ? C.accentInk : C.badInk, wordBreak: "break-word" }}>
                    {r.ok ? "ok" : `failed — ${r.error || "unknown"}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

/*
 * Fires any event in the matrix with dummy data, addressed to the admin only —
 * testing "what a vendor gets when their claim verifies" must never reach a
 * vendor. Its own fetch rather than act(), because the answer is a diagnostic.
 */
function NotificationTest() {
  const [event, setEvent] = useState(MAIL_EVENTS[0][0]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  async function send() {
    setBusy(true); setResult(null);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test-notification", event }),
      });
      if (!res.ok) { setResult({ ok: false, sends: [], error: `${res.status} ${await res.text()}` }); return; }
      setResult((await res.json()).test);
    } catch {
      setResult({ ok: false, sends: [], error: "Could not reach the server." });
    } finally {
      setBusy(false);
    }
  }

  const field = {
    background: C.field, border: `1px solid ${C.line}`, borderRadius: R.control,
    padding: "8px 12px", fontSize: F.sm, color: C.text, fontFamily: "inherit",
  };

  return (
    <Section title="Test an event" count=""
      hint="Fires a real send through the same dispatcher the routes use, with dummy data, to your address only — including the copy a user would get, so nothing reaches a real vendor.">
      <div className="flex flex-wrap items-center" style={{ gap: S.md, padding: "12px 0 4px" }}>
        <select value={event} onChange={(e) => { setEvent(e.target.value); setResult(null); }} style={{ ...field, width: 210 }}>
          {MAIL_EVENTS.map(([id, label]) => (
            <option key={id} value={id} style={{ background: C.panel }}>{label}</option>
          ))}
        </select>
        <Btn onClick={send} busy={busy} tone="go">Send test</Btn>
      </div>

      {result && (
        <div style={{ padding: "4px 0 12px" }}>
          {result.nothingToSend ? (
            <p style={{ fontSize: F.sm, color: C.muted, margin: 0 }}>
              Nothing sent — this event mails nobody by design.
            </p>
          ) : (
            (result.sends || []).map((sd, i) => (
              <p key={i} style={{ fontSize: F.sm, margin: "2px 0", color: sd.ok ? C.accentInk : C.badInk }}>
                {sd.cls} → {sd.to}: {sd.ok ? "ok" : `failed — ${sd.error}`}
              </p>
            ))
          )}
          {result.error && <p style={{ fontSize: F.sm, color: C.badInk, margin: "2px 0" }}>{result.error}</p>}
          {result.config && (
            <p style={{ fontSize: F.xs, color: C.dim, margin: "8px 0 0", lineHeight: 1.6 }}>
              RESEND_API_KEY {result.config.resendKey ? "set" : "missing"} · ADMIN_EMAILS{" "}
              {result.config.adminEmails || "none"} · from {result.config.from}
            </p>
          )}
        </div>
      )}
    </Section>
  );
}

function Reports({ rows, act, busy }) {
  const open = rows.filter((r) => r.status === "open");
  const closed = rows.filter((r) => r.status !== "open");
  return (
    <Section title="Reported problems" count={open.length}
      hint="Sent by visitors without signing in. Nothing is applied automatically — edit lib/tools.js yourself, then resolve. A submitted social profile only goes in once it is published on the company's own site.">
      {rows.length === 0 ? <Empty>Nothing reported.</Empty> : (
        <div className="flex flex-col" style={{ gap: 2 }}>
          {[...open, ...closed].map((r) => {
            const tool = TOOLS.find((t) => t.id === r.toolId);
            const kind = reportKindOf(r.kind);
            const isOpen = r.status === "open";
            return (
              <div key={r.id} style={{
                borderTop: `1px solid ${C.line}`, padding: "12px 0",
                opacity: isOpen ? 1 : 0.55,
              }}>
                <div className="flex flex-wrap items-baseline" style={{ gap: S.sm }}>
                  <span style={{ fontWeight: 600 }}>{tool ? tool.name : r.toolName || r.toolId}</span>
                  <span style={{ fontSize: F.xs, color: ink("#FFB020") }}>{kind ? kind.label : r.kind}</span>
                  <span style={{ fontSize: F.xs, color: C.dim }}>{r.date}</span>
                  {!isOpen && (
                    <span style={{ fontSize: F.xs, color: C.dim, border: `1px solid ${C.line}`, borderRadius: R.pill, padding: "2px 8px" }}>
                      {r.status}{r.closedAt ? ` ${r.closedAt}` : ""}
                    </span>
                  )}
                </div>
                {r.value && (
                  <p style={{ fontSize: F.sm, color: C.muted, margin: "4px 0 0", lineHeight: 1.5, wordBreak: "break-word" }}>{r.value}</p>
                )}
                <p style={{ fontSize: F.xs, color: C.dim, margin: "4px 0 0" }}>
                  {r.email ? <a href={`mailto:${r.email}`} style={{ color: C.muted }}>{r.email}</a> : "No email given"}
                </p>
                {isOpen && (
                  <div className="flex flex-wrap mt-2" style={{ gap: S.sm }}>
                    <Btn onClick={() => act("resolve-report", r.id, {}, "res")}
                      busy={busy === "resolve-reportres" + r.id} tone="go">Resolve</Btn>
                    <Btn onClick={() => act("dismiss-report", r.id, {}, "dis")}
                      busy={busy === "dismiss-reportdis" + r.id} tone="stop">Dismiss</Btn>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Section>
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
      <h2 style={{ fontSize: F.xl, fontWeight: 700, margin: 0, letterSpacing: TRACK.tight }}>Subscribers</h2>
      <p style={{ fontSize: F.sm, color: C.muted, margin: "4px 0 0", maxWidth: "72ch", lineHeight: 1.55 }}>
        Addresses are not listed here on purpose. Copy them when you are actually sending,
        and send with the addresses hidden from each other.
      </p>
      <div className="mt-3 flex flex-wrap items-center" style={{
        background: C.panel, border: `1px solid ${C.line}`, borderRadius: R.card,
        padding: "16px 20px", gap: S.lg,
      }}>
        <span style={{ fontSize: F.display, fontWeight: 800, letterSpacing: TRACK.tighter, lineHeight: 1 }}>{list.length}</span>
        <span style={{ fontSize: F.sm, color: C.muted, flex: 1, minWidth: 140 }}>
          {list.length === 1 ? "address" : "addresses"} on the list
        </span>
        <button onClick={copy} disabled={!list.length} style={{
          background: list.length ? C.accent : C.subtle,
          color: list.length ? C.onAccent : C.dim, border: 0, borderRadius: R.control,
          padding: "8px 16px", fontSize: F.sm, fontWeight: 700,
          cursor: list.length ? "pointer" : "default", fontFamily: "inherit",
        }}>Copy all</button>
      </div>
      {copied && <p style={{ fontSize: F.xs, color: C.accentInk, margin: "8px 0 0" }}>{copied}</p>}
    </section>
  );
}
