"use client";

/*
 * Ask the directory: one open box, any intent, answered from every section
 * (lib/intentMatch.js, /api/match). It is the first thing in the directory's
 * content column, and the sidebar's prompt brings you here from any page.
 *
 * The answer is grouped by what kind of thing each result is, each with the
 * reason it was returned for this question. When the directory has no
 * answer, or only part of one, it says so plainly, with a way to suggest what
 * is missing: that gap is worth seeing, and nothing is stretched to fill it.
 *
 * The examples span sections so it is visible that this answers more than
 * "which tool". Four are shown, chosen by the day rather than on a timer:
 * nothing on this site moves on its own (CLAUDE.md, Interaction).
 */
import React, { useEffect, useRef, useState } from "react";
import { C, S, R, F, TRACK } from "@/lib/tools";
import { editorUseBadge } from "@/lib/editorUse";
import { Pill } from "@/components/Pill";
import GrowText from "@/components/GrowText";

export const ASK_EXAMPLES = [
  { label: "Replace Mantle", q: "Mantle is shutting down and I need to replace my billing analytics" },
  { label: "Meet other app founders", q: "I want to meet other people who build Shopify apps, in person" },
  { label: "Keep up with Shopify", q: "How do I keep up with what is changing in the Shopify ecosystem?" },
  { label: "Is a vendor trustworthy", q: "Who is behind AppJubilee, and should I trust its comparisons?" },
  { label: "Keyword tracking", q: "I run six apps and need keyword tracking across all of them" },
  { label: "Find merchants to pitch", q: "I want to find stores running a competitor's app and pitch them" },
  { label: "Hire a developer", q: "Where can I find a freelance Shopify developer to help build my app?" },
  { label: "Outsource support", q: "I need someone to answer merchant support tickets around the clock" },
];

/* Four a day, spanning sections, the same on the server and in the browser. */
function examplesFor(date = new Date()) {
  const day = Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 864e5);
  const start = (day * 3) % ASK_EXAMPLES.length;
  return [0, 2, 4, 6].map((i) => ASK_EXAMPLES[(start + i) % ASK_EXAMPLES.length]);
}

export default function Ask({ tools = [], onOpenTool, onSuggest, initial = "" }) {
  const [q, setQ] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [examples] = useState(() => examplesFor());
  const box = useRef(null);

  async function run(text) {
    const question = String(text ?? q).trim();
    if (!question || busy) return;
    setQ(question); setBusy(true); setResult(null);
    try {
      const res = await fetch("/api/match", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: question }),
      });
      if (!res.ok) {
        setResult({ q: question, error: res.status === 429 ? "That is the limit for this hour. Try again later, or search instead." : "Could not answer that right now." });
      } else {
        setResult({ q: question, ...(await res.json()) });
      }
    } catch {
      setResult({ q: question, error: "Could not reach the server." });
    } finally {
      setBusy(false);
    }
  }

  /* Asked from elsewhere (/?ask=<question>): answer it straight away. */
  useEffect(() => { if (initial.trim()) run(initial); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const total = result?.groups?.reduce((n, g) => n + g.items.length, 0) || 0;

  return (
    <section aria-labelledby="ask-h" id="ask" style={{ marginBottom: S.xl, scrollMarginTop: S.lg }}>
      <form onSubmit={(e) => { e.preventDefault(); run(); }}
        style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: R.card, padding: S.md, boxShadow: "var(--c-card-shadow)" }}>
        <label id="ask-h" htmlFor="ask-q" style={{ display: "block", fontSize: F.md, fontWeight: 700, letterSpacing: TRACK.tight }}>
          Ask the directory
        </label>
        <div className="flex flex-wrap" style={{ gap: S.sm, marginTop: S.sm }}>
          <GrowText id="ask-q" ref={box} value={q} onChange={(e) => setQ(e.target.value)} onSubmit={() => run()}
            rows={1} maxRows={6} maxLength={600}
            placeholder="Anything: a problem to solve, people to meet, what to read, a vendor to check"
            style={{
              flex: 1, minWidth: 220, background: C.field, border: `1px solid ${C.line}`, borderRadius: R.control,
              padding: "8px 12px", fontSize: F.md, color: C.text, fontFamily: "inherit",
            }} />
          <button type="submit" disabled={busy || !q.trim()} className="ctl press"
            style={{
              minWidth: 88, border: 0, borderRadius: R.control, padding: "8px 16px",
              background: q.trim() ? C.accent : C.subtle, color: q.trim() ? C.onAccent : C.dim,
              fontSize: F.sm, fontWeight: 700, fontFamily: "inherit", cursor: q.trim() && !busy ? "pointer" : "default",
            }}>{busy ? "Asking…" : "Ask"}</button>
        </div>
        <div className="flex flex-wrap items-center" style={{ gap: S.xs, marginTop: S.sm }}>
          <span style={{ fontSize: F.xs, color: C.dim, marginRight: 2 }}>Try</span>
          {examples.map((e) => (
            <button key={e.label} type="button" title={e.q} onClick={() => run(e.q)} className="ctl press"
              style={{
                fontSize: F.xs, color: C.text, background: C.panel, border: `1px solid ${C.line}`,
                borderRadius: R.pill, padding: "4px 12px", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
              }}>{e.label}</button>
          ))}
        </div>
      </form>

      {busy && <p role="status" style={{ fontSize: F.sm, color: C.muted, margin: `${S.md}px 0 0` }}>Reading the directory for that…</p>}

      {result && !busy && (
        <div role="status" style={{ marginTop: S.md, background: C.panel, border: `1px solid ${C.line}`, borderRadius: R.card, padding: S.lg }}>
          <p style={{ fontSize: F.xs, color: C.dim, margin: 0 }}>You asked</p>
          <p style={{ fontSize: F.md, margin: `${S.xs}px 0 0`, lineHeight: 1.5 }}>{result.q}</p>

          {result.error && <p style={{ fontSize: F.md, color: C.muted, margin: `${S.md}px 0 0` }}>{result.error}</p>}

          {result.path === "keyword" && total > 0 && (
            <p style={{ fontSize: F.sm, color: C.muted, margin: `${S.md}px 0 0`, background: C.subtle, borderRadius: R.control, padding: "8px 12px" }}>
              The AI is not answering right now. These are the closest matches by keyword.
            </p>
          )}
          {result.note && total > 0 && <p style={{ fontSize: F.md, margin: `${S.md}px 0 0`, lineHeight: 1.5 }}>{result.note}</p>}

          {(result.groups || []).map((g) => (
            <div key={g.kind} style={{ marginTop: S.lg }}>
              <h3 className="tnum" style={{ fontSize: F.sm, fontWeight: 700, margin: 0, color: C.muted }}>{g.label}</h3>
              <ul style={{ listStyle: "none", padding: 0, margin: `${S.xs}px 0 0` }}>
                {g.items.map((it) => {
                  const tool = it.kind === "tool" ? tools.find((t) => t.id === it.id) : null;
                  const badge = tool && editorUseBadge(tool.editorUse);
                  return (
                    <li key={`${it.kind}:${it.id}`} style={{ borderTop: `1px solid ${C.line}`, padding: `${S.sm}px 0` }}>
                      <a href={it.href} onClick={(e) => {
                        if (tool && onOpenTool && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey) { e.preventDefault(); onOpenTool(tool.id); }
                      }} style={{ fontSize: F.md, fontWeight: 700, color: C.text, textDecoration: "none" }}>{it.name}</a>
                      {it.meta && <span style={{ fontSize: F.xs, color: C.dim, marginLeft: S.sm }}>{it.meta}</span>}
                      {it.why && <p style={{ fontSize: F.sm, color: C.muted, margin: `${S.xs}px 0 0`, lineHeight: 1.5 }}>{it.why}</p>}
                      {/* Context only, attached here: the model never saw it. */}
                      {badge && <p style={{ margin: `${S.xs}px 0 0` }}><Pill>{badge}</Pill></p>}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          {!result.error && (total === 0 || result.gap) && (
            <div style={{ marginTop: S.lg }}>
              <p style={{ fontSize: F.md, color: total ? C.muted : C.text, margin: 0, lineHeight: 1.55, maxWidth: "62ch" }}>
                {result.gap || "The directory has nothing that answers this yet."}
              </p>
              {onSuggest && (
                <button type="button" onClick={() => onSuggest({ kind: "tool", why: result.q })} className="ctl press"
                  style={{
                    marginTop: S.sm, background: C.panel, color: C.text, border: `1px solid ${C.line}`, borderRadius: R.control,
                    padding: "4px 12px", fontSize: F.sm, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                  }}>Suggest what is missing</button>
              )}
            </div>
          )}

          <p style={{ fontSize: F.sm, color: C.muted, margin: `${S.lg}px 0 0` }}>
            <a href={`/search?q=${encodeURIComponent(result.q)}`} style={{ color: C.text }}>Search everything for these words</a>
            {" or "}
            {/* The recommender, offered after an answer, when it is relevant. */}
            <a href="/recommend" style={{ color: C.text, fontWeight: 600 }}>get three picks for your App Store listing</a>.
          </p>
        </div>
      )}
    </section>
  );
}
