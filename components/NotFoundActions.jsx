"use client";

import React, { useState } from "react";
import { C, S, R, F, TRACK } from "@/lib/tools";
import GrowText from "./GrowText";

/*
 * The two ways out of a 404: ask the matcher, or suggest the thing.
 *
 * One box feeds both, because what somebody types when a page is missing is
 * both a question and, if nothing answers it, a suggestion. Each button hands
 * the text to the directory through the URL (`/?ask=` and `/?suggest=&why=`),
 * which opens the matcher or the suggest form there. Nothing is sent from
 * this page itself, so the rules on /api/match and /api/suggest stay where
 * they are.
 */
export default function NotFoundActions() {
  const [text, setText] = useState("");
  const q = text.trim();

  const go = (path) => { window.location.href = path; };
  const ask = () => go(q ? `/?ask=${encodeURIComponent(q)}` : "/?ask=1");
  const suggest = () => go(q ? `/?suggest=tool&why=${encodeURIComponent(q)}` : "/?suggest=tool");

  const btn = (primary) => ({
    fontSize: F.md, fontWeight: 700, padding: "8px 16px", borderRadius: R.control,
    border: primary ? 0 : `1px solid ${C.line}`, cursor: "pointer", fontFamily: "inherit",
    background: primary ? C.accent : C.panel, color: primary ? C.onAccent : C.text,
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); ask(); }} style={{
      marginTop: S["2xl"], background: C.panel, border: `1px solid ${C.line}`,
      borderRadius: R.card, padding: S.lg, boxShadow: "var(--c-card-shadow)",
    }}>
      <label htmlFor="nf-q" style={{ display: "block", fontSize: F.lg, fontWeight: 700, letterSpacing: TRACK.tight }}>
        What were you looking for?
      </label>
      <p style={{ fontSize: F.sm, color: C.muted, margin: `${S.xs}px 0 ${S.md}px`, lineHeight: 1.5 }}>
        Describe the problem in your own words. The AI search reads every tool in the
        directory and picks the ones that fit.
      </p>
      <GrowText
        id="nf-q" value={text} onChange={(e) => setText(e.target.value)} onSubmit={ask}
        rows={2} maxRows={6} maxLength={500}
        placeholder="e.g. track my app's keyword rankings in the App Store"
        style={{
          width: "100%", fontSize: F.md, fontFamily: "inherit", color: C.text, background: C.bg,
          border: `1px solid ${C.line}`, borderRadius: R.control, padding: "8px 12px",
        }}
      />
      <div className="flex flex-wrap items-center" style={{ gap: S.sm, marginTop: S.md }}>
        <button type="submit" className="ctl press" style={btn(true)}>Find tools</button>
        <button type="button" className="ctl press" onClick={suggest} style={btn(false)}>Suggest it instead</button>
      </div>
      <p style={{ fontSize: F.xs, color: C.dim, margin: `${S.md}px 0 0`, lineHeight: 1.5 }}>
        Not in the directory? Suggest it. A person reads every suggestion.
      </p>
    </form>
  );
}
