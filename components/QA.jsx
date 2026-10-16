"use client";

/*
 * Questions and answers on a tool (lib/qa.js), on the tool page below the
 * reviews and in the listing modal. Kept visually apart from reviews on
 * purpose: no stars, a "Q." and "A." on every entry, and its own heading,
 * because a review is an opinion and this is "does it do X".
 *
 * The server renders the list first (`initial`), so it is in the HTML for a
 * crawler; this component adds asking and answering for a signed-in visitor.
 */
import React, { useState, useEffect } from "react";
import { C, S, R, F, TRACK } from "@/lib/tools";
import { Pill } from "./Pill";
import GrowText from "./GrowText";
import { SignInPrompt, useSession } from "./Account";
import { QUESTION_MAX, ANSWER_MAX } from "@/lib/limits";

const field = {
  background: C.panel, border: `1px solid ${C.line}`, borderRadius: R.control,
  padding: "8px 12px", fontSize: F.sm, color: C.text, fontFamily: "inherit", width: "100%",
};
const button = {
  background: C.accent, color: C.onAccent, border: 0, borderRadius: R.control,
  padding: "6px 14px", fontSize: F.sm, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
};

export default function QA({ toolId, toolName, initial = [], heading = "h2", fetchOnMount = false }) {
  const [session] = useSession();
  const [questions, setQuestions] = useState(initial);
  /* The modal has no server render of its own, so it reads the list on open. */
  useEffect(() => {
    if (!fetchOnMount) return;
    fetch(`/api/qa?tool=${encodeURIComponent(toolId)}`).then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setQuestions(d.questions || [])).catch(() => {});
  }, [fetchOnMount, toolId]);
  const [author, setAuthor] = useState("");
  const [text, setText] = useState("");
  const [answering, setAnswering] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const H = heading;

  async function post(payload) {
    setBusy(true); setMsg("");
    try {
      const res = await fetch("/api/qa", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toolId, author, ...payload }),
      });
      if (!res.ok) { setMsg(await res.text()); return false; }
      setQuestions((await res.json()).questions || []);
      return true;
    } catch { setMsg("Could not reach the server."); return false; } finally { setBusy(false); }
  }

  const ask = async () => { if (await post({ action: "ask", text })) setText(""); };
  const reply = async (questionId) => { if (await post({ action: "answer", questionId, text: answer })) { setAnswer(""); setAnswering(""); } };

  return (
    <section id="questions" style={{ marginTop: S["3xl"] }}>
      <H style={{ fontSize: F.xl, fontWeight: 700, margin: 0, letterSpacing: TRACK.tight }}>
        Questions{questions.length > 0 && <span className="tnum" style={{ fontSize: F.md, color: C.muted, fontWeight: 500, marginLeft: S.sm }}>{questions.length}</span>}
      </H>
      <p style={{ fontSize: F.xs, color: C.dim, lineHeight: 1.5, margin: `${S.xs}px 0 0`, maxWidth: "64ch" }}>
        Ask whether {toolName} does something. Anyone signed in can answer. An answer marked as from the vendor comes
        from the verified owner of this listing. Questions are separate from reviews and do not change the rating.
      </p>

      <div style={{ marginTop: S.md, border: `1px solid ${C.line}`, borderRadius: R.card, padding: S.md, background: C.raised }}>
        {session?.signedIn ? (
          <>
            <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Your name (optional)" aria-label="Your name"
              style={{ ...field, marginBottom: S.sm, maxWidth: 260 }} maxLength={60} />
            <GrowText value={text} onChange={(e) => setText(e.target.value)} onSubmit={ask} rows={2}
              placeholder={`Does ${toolName} ...?`} aria-label={`Your question about ${toolName}`} maxLength={QUESTION_MAX} style={field} />
            <div className="flex flex-wrap items-center" style={{ gap: S.sm, marginTop: S.sm }}>
              <button type="button" onClick={ask} disabled={busy || text.trim().length < 8} className="press" style={{ ...button, opacity: busy || text.trim().length < 8 ? 0.5 : 1 }}>
                Ask
              </button>
              {msg && <span style={{ fontSize: F.xs, color: C.warnInk }}>{msg}</span>}
            </div>
          </>
        ) : (
          <SignInPrompt returnTo={toolId} reason="Questions need an account, so an answer can reach you. One email, no password." />
        )}
      </div>

      {questions.length === 0 ? null : (
        <div style={{ marginTop: S.md }}>
          {questions.map((q) => (
            <div key={q.id} style={{ borderTop: `1px solid ${C.line}`, padding: `${S.md}px 0` }}>
              <p style={{ fontSize: F.md, margin: 0, lineHeight: 1.5 }}>
                <b style={{ color: C.muted, marginRight: S.xs }}>Q.</b>{q.text}
              </p>
              <p style={{ fontSize: F.xs, color: C.dim, margin: `${S.xs}px 0 0` }}>{q.author}, {String(q.at).slice(0, 10)}</p>
              {(q.answers || []).map((a) => (
                <div key={a.id} style={{ margin: `${S.sm}px 0 0 ${S.lg}px`, paddingLeft: S.md, borderLeft: `2px solid ${C.edge}` }}>
                  <p style={{ fontSize: F.sm, margin: 0, lineHeight: 1.55 }}>
                    <b style={{ color: C.muted, marginRight: S.xs }}>A.</b>{a.text}
                  </p>
                  <p className="flex flex-wrap items-center" style={{ fontSize: F.xs, color: C.dim, margin: `${S.xs}px 0 0`, gap: S.sm }}>
                    <span>{a.author}, {String(a.at).slice(0, 10)}</span>
                    {a.vendor && <Pill>From the vendor</Pill>}
                  </p>
                </div>
              ))}
              {session?.signedIn && (answering === q.id ? (
                <div style={{ margin: `${S.sm}px 0 0 ${S.lg}px` }}>
                  <GrowText value={answer} onChange={(e) => setAnswer(e.target.value)} onSubmit={() => reply(q.id)} rows={2}
                    aria-label="Your answer" maxLength={ANSWER_MAX} style={field} />
                  <div className="flex items-center" style={{ gap: S.sm, marginTop: S.xs }}>
                    <button type="button" onClick={() => reply(q.id)} disabled={busy || answer.trim().length < 2} className="press" style={{ ...button, opacity: busy || answer.trim().length < 2 ? 0.5 : 1 }}>Answer</button>
                    <button type="button" onClick={() => { setAnswering(""); setAnswer(""); }} style={{ background: "none", border: 0, color: C.muted, fontSize: F.sm, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => { setAnswering(q.id); setAnswer(""); }}
                  style={{ background: "none", border: 0, padding: 0, marginTop: S.xs, color: C.muted, fontSize: F.xs, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}>
                  Answer this
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
