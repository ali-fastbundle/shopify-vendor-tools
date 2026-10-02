"use client";

/*
 * The one interactive piece of a newsletter page, isolated so NewsletterPage
 * stays a server component that is whole in the first response.
 *
 * Ratings, reviews, reports and claiming work the same as a tool, because they
 * are the same endpoints keyed on the same id: /api/vote, /api/review,
 * /api/report and /api/claim all accept a newsletter id (isListedId and
 * listedEntity were widened to include published newsletters). Claiming and
 * editing reuse OwnerPanel unchanged, passing the newsletter where a tool would
 * go. Nothing here is newsletter-specific except the words.
 */
import React, { useEffect, useRef, useState } from "react";
import { C, S, R, F } from "@/lib/tools";
import { useSession, SignInPrompt, OwnerPanel } from "@/components/Account";

const THUMB_UP = "▲";
const THUMB_DOWN = "▼";

const btn = (on) => ({
  background: on ? C.subtle : "transparent",
  border: `1px solid ${on ? C.edge : C.line}`,
  borderRadius: R.control, padding: "6px 10px", fontSize: F.sm,
  color: C.text, cursor: "pointer", fontFamily: "inherit",
});

export default function NewsletterActions({ newsletter, rating, reviewCount = 0 }) {
  const [session, refresh] = useSession();
  const [votes, setVotes] = useState(null);
  const [myVote, setMyVote] = useState(0);
  const [mine, setMine] = useState(null);
  const id = newsletter.id;

  // Vote counts and the viewer's own review come from the same public read the
  // directory uses, fetched once on mount so the server page stays static.
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const d = await (await fetch("/api/data", { cache: "no-store" })).json();
        if (!live) return;
        setVotes((d.votes && d.votes[id]) || { up: 0, down: 0 });
        const list = (d.reviews && d.reviews[id]) || [];
        setMine(list.find((r) => r.mine) || null);
      } catch { /* a failed read costs the counts and nothing else */ }
    })();
    try { setMyVote(Number(localStorage.getItem(`svt:nlvote:${id}`)) || 0); } catch {}
    return () => { live = false; };
  }, [id]);

  async function vote(dir) {
    const next = myVote === dir ? 0 : dir;
    const previous = myVote;
    setMyVote(next);
    try { localStorage.setItem(`svt:nlvote:${id}`, String(next)); } catch {}
    try {
      const d = await (await fetch("/api/vote", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, previous, next }),
      })).json();
      if (d.votes && d.votes[id]) setVotes(d.votes[id]);
    } catch { /* leave the optimistic state; the next load reconciles */ }
  }

  return (
    <div style={{ marginTop: S.xl, borderTop: `1px solid ${C.line}`, paddingTop: S.lg }}>
      <div className="flex flex-wrap items-center" style={{ gap: S.md }}>
        <button className="press" onClick={() => vote(1)} style={btn(myVote === 1)} aria-pressed={myVote === 1}
          aria-label="Like this newsletter">
          <span className="tnum">{THUMB_UP} {votes ? votes.up : 0}</span>
        </button>
        <button className="press" onClick={() => vote(-1)} style={btn(myVote === -1)} aria-pressed={myVote === -1}
          aria-label="Dislike this newsletter">
          <span className="tnum">{THUMB_DOWN} {votes ? votes.down : 0}</span>
        </button>
        {rating && (
          <span className="tnum" style={{ fontSize: F.sm, color: C.muted }}>
            {rating.ratingValue} from {rating.ratingCount}
          </span>
        )}
      </div>

      <ReviewBlock id={id} name={newsletter.name} session={session} mine={mine} onPosted={setMine} />

      <ReportBlock id={id} name={newsletter.name} />

      {/* Claim + edit, the tool flow unchanged. A newsletter is passed where a
          tool would be; the id, the domain and the editable fields are the same
          shape, and the claim API verifies ownership against the domain. */}
      {!session.loading && (
        <OwnerPanel
          tool={{ ...newsletter, domain: domainOf(newsletter.url) }}
          session={session}
          refresh={refresh}
          onTools={() => { try { location.reload(); } catch {} }}
        />
      )}
    </div>
  );
}

const domainOf = (url) =>
  String(url || "").replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0].toLowerCase();

function ReviewBlock({ id, name, session, mine, onPosted }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [author, setAuthor] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const draftKey = `svt:nldraft:${id}`;

  // Pre-fill from a stored review or a saved draft, oldest-last.
  useEffect(() => {
    let r = 0, t = "", a = "";
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) { const d = JSON.parse(raw); r = d.rating || 0; t = d.text || ""; a = d.author || ""; }
    } catch {}
    if (mine) { r = mine.rating || r; t = mine.text || t; a = mine.author || a; }
    if (r || t || a) { setRating(r); setText(t); setAuthor(a); }
  }, [mine]);

  useEffect(() => {
    if (!open) return;
    try { localStorage.setItem(draftKey, JSON.stringify({ rating, text, author })); } catch {}
  }, [rating, text, author, open]);

  async function submit() {
    if (!rating) { setMsg("Pick a rating first."); return; }
    setBusy(true); setMsg("");
    try {
      const res = await fetch("/api/review", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, rating, text, author }),
      });
      if (!res.ok) { setMsg(await res.text()); setBusy(false); return; }
      const d = await res.json();
      const list = (d.reviews && d.reviews[id]) || [];
      onPosted(list.find((r) => r.mine) || null);
      try { localStorage.removeItem(draftKey); } catch {}
      setMsg("Posted. Reload to see it in the list.");
    } catch { setMsg("Could not reach the server."); }
    setBusy(false);
  }

  if (!open) {
    return (
      <div style={{ marginTop: S.lg }}>
        <button onClick={() => setOpen(true)} style={{
          background: "none", border: 0, padding: 0, cursor: "pointer", fontFamily: "inherit",
          fontSize: F.sm, color: C.muted, textDecoration: "underline",
        }}>{mine ? "Edit your review" : "Rate or review this newsletter"}</button>
      </div>
    );
  }

  return (
    <div style={{ marginTop: S.lg, border: `1px solid ${C.line}`, borderRadius: R.card, padding: S.lg }}>
      <div className="flex items-center" style={{ gap: S.xs }}>
        {[1, 2, 3, 4, 5].map((s) => (
          <button key={s} onClick={() => setRating(s)} aria-label={`${s} star${s > 1 ? "s" : ""}`}
            style={{ background: "none", border: 0, cursor: "pointer", fontSize: F.xl, padding: 0,
              color: s <= rating ? C.star : C.starOff, fontFamily: "inherit" }}>★</button>
        ))}
      </div>
      {session.signedIn ? (
        <>
          <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Your name (optional)"
            style={{ ...fieldStyle, marginTop: S.md }} maxLength={40} />
          <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={600}
            placeholder={`What should another app vendor know about ${name}?`}
            style={{ ...fieldStyle, marginTop: S.sm, minHeight: 90, resize: "vertical", lineHeight: 1.5 }} />
          <div className="flex items-center" style={{ gap: S.md, marginTop: S.md }}>
            <button onClick={submit} disabled={busy || !rating} className="press" style={{
              background: rating ? C.accent : C.subtle, color: rating ? C.onAccent : C.dim,
              border: 0, borderRadius: R.control, padding: "8px 16px", fontSize: F.sm, fontWeight: 700,
              cursor: rating ? "pointer" : "default", fontFamily: "inherit",
            }}>{busy ? "Posting…" : mine ? "Update review" : "Post review"}</button>
            <button onClick={() => setOpen(false)} style={{
              background: "none", border: 0, cursor: "pointer", fontFamily: "inherit", fontSize: F.sm, color: C.dim,
            }}>Cancel</button>
          </div>
          {msg && <p style={{ fontSize: F.xs, color: C.muted, margin: `${S.sm}px 0 0` }}>{msg}</p>}
        </>
      ) : (
        <div style={{ marginTop: S.md }}>
          <SignInPrompt reason="Ratings need an account so they mean something. One email, no password. What you have typed is kept." />
        </div>
      )}
    </div>
  );
}

function ReportBlock({ id, name }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState("broken");
  const [value, setValue] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function submit() {
    setBusy(true); setMsg("");
    try {
      const res = await fetch("/api/report", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toolId: id, kind, value, email }),
      });
      setMsg(res.ok ? "Thanks. An editor will take a look." : await res.text());
    } catch { setMsg("Could not reach the server."); }
    setBusy(false);
  }

  if (!open) {
    return (
      <div style={{ marginTop: S.md }}>
        <button onClick={() => setOpen(true)} style={{
          background: "none", border: 0, padding: 0, cursor: "pointer", fontFamily: "inherit",
          fontSize: F.xs, color: C.dim, textDecoration: "underline",
        }}>Report a problem with this listing</button>
      </div>
    );
  }

  return (
    <div style={{ marginTop: S.md, border: `1px dashed ${C.line}`, borderRadius: R.card, padding: S.lg }}>
      <p style={{ fontSize: F.sm, fontWeight: 700, margin: 0 }}>Report a problem with {name}</p>
      <div className="flex flex-wrap items-start" style={{ gap: S.sm, marginTop: S.md }}>
        <select value={kind} aria-label="Kind of problem" onChange={(e) => setKind(e.target.value)}
          style={{ ...fieldStyle, width: 190 }}>
          <option value="broken">Broken link</option>
          <option value="url">Wrong URL</option>
          <option value="social">Missing social profile</option>
          <option value="other">Something else</option>
        </select>
        <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="What is wrong?"
          style={{ ...fieldStyle, flex: 1, minWidth: 200 }} maxLength={500} />
      </div>
      <div className="flex flex-wrap items-center" style={{ gap: S.sm, marginTop: S.sm }}>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Your email (optional)"
          style={{ ...fieldStyle, width: 220 }} />
        <button onClick={submit} disabled={busy} className="press" style={{
          background: C.text, color: C.bg, border: 0, borderRadius: R.control,
          padding: "8px 16px", fontSize: F.sm, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
        }}>{busy ? "Sending…" : "Send report"}</button>
        <button onClick={() => setOpen(false)} style={{
          background: "none", border: 0, cursor: "pointer", fontFamily: "inherit", fontSize: F.xs, color: C.dim,
        }}>Cancel</button>
      </div>
      {msg && <p style={{ fontSize: F.xs, color: C.muted, margin: `${S.sm}px 0 0` }}>{msg}</p>}
    </div>
  );
}

const fieldStyle = {
  background: C.field, border: `1px solid ${C.line}`, borderRadius: R.control,
  padding: "8px 12px", fontSize: F.md, color: C.text, fontFamily: "inherit", width: "100%",
};
