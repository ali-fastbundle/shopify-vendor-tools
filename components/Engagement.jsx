"use client";

/*
 * Likes, ratings, reviews, reports and claiming, for any kind of listing.
 *
 * Every section of the directory gets this set, and this is the one copy of it
 * outside the tool grid. The newsletter page used to carry its own, which had
 * already drifted from the house rules a few months in: text glyphs instead of
 * Phosphor, a stored review overwriting a saved draft, no helpfulness votes,
 * and a review list that only updated on reload. A section added next month
 * should get the current rules by importing this, not by copying the last
 * section and inheriting whatever it had got wrong.
 *
 * The server half was already shared: /api/vote, /api/review,
 * /api/review/helpful, /api/report, /api/claim and /api/listing all validate
 * ids through isListedId and listedEntity in lib/entries.js, which is where a
 * new catalogue is registered. Nothing here is specific to a kind except the
 * words, which come from NOUN, and the report kinds, from reportKindsFor.
 *
 * The tool grid keeps its own version because likes and stars live on the
 * card there, in a client component that also filters, sorts and compares.
 * The rules are the same; the layout is not.
 *
 * Reviews arrive as a prop so a server page prints them in the first response
 * for a crawler, and are refreshed from /api/data on mount, which is what adds
 * `mine` and `helpfulByMe` for whoever is looking.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ThumbsUp, ThumbsDown, Star } from "@phosphor-icons/react";
import { C, S, R, F, TRACK, reportKindsFor, reportKindOf } from "@/lib/tools";
import { byHelpfulness } from "@/lib/reviews";
import { useSession, SignInPrompt, OwnerPanel } from "@/components/Account";
import GrowText from "@/components/GrowText";

const NOUN = { tool: "tool", newsletter: "newsletter", event: "event" };

const field = {
  background: C.field, border: `1px solid ${C.line}`, borderRadius: R.control,
  padding: "8px 12px", fontSize: F.md, color: C.text, fontFamily: "inherit", width: "100%",
};
const quiet = {
  background: "none", border: 0, padding: 0, cursor: "pointer", fontFamily: "inherit",
  textDecoration: "underline",
};

/** One decimal, the way the directory shows a community rating. */
export function summarise(reviews = []) {
  if (!reviews.length) return null;
  const avg = reviews.reduce((n, r) => n + (Number(r.rating) || 0), 0) / reviews.length;
  return { value: avg.toFixed(1), count: reviews.length };
}

export default function Engagement({ entity, kind = "tool", initialReviews = [] }) {
  const [session, refresh] = useSession();
  const [votes, setVotes] = useState(null);
  const [myVote, setMyVote] = useState(0);
  const [reviews, setReviews] = useState(initialReviews);
  const id = entity.id;
  const noun = NOUN[kind] || "listing";
  const voteKey = `svt:vote:${id}`;

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const d = await (await fetch("/api/data", { cache: "no-store" })).json();
        if (!live) return;
        setVotes((d.votes && d.votes[id]) || { up: 0, down: 0 });
        if (d.reviews) setReviews(d.reviews[id] || []);
      } catch { /* a failed read costs the counts and nothing else */ }
    })();
    try {
      // `svt:nlvote:` is where the newsletter page kept it before this module.
      const raw = localStorage.getItem(voteKey) ?? localStorage.getItem(`svt:nlvote:${id}`);
      setMyVote(Number(raw) || 0);
    } catch {}
    return () => { live = false; };
  }, [id]);

  async function vote(dir) {
    const next = myVote === dir ? 0 : dir;
    const previous = myVote;
    setMyVote(next);
    try { localStorage.setItem(voteKey, String(next)); } catch {}
    try {
      const d = await (await fetch("/api/vote", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, previous, next }),
      })).json();
      if (d.votes && d.votes[id]) setVotes(d.votes[id]);
    } catch { /* leave the optimistic state; the next load reconciles */ }
  }

  const rating = summarise(reviews);
  const mine = reviews.find((r) => r.mine) || null;

  return (
    <div style={{ marginTop: S.xl, borderTop: `1px solid ${C.line}`, paddingTop: S.lg }}>
      <div className="flex flex-wrap items-center" style={{ gap: S.sm }}>
        <VoteButton dir={1} on={myVote === 1} count={votes?.up ?? 0} noun={noun} onClick={() => vote(1)} />
        <VoteButton dir={-1} on={myVote === -1} count={votes?.down ?? 0} noun={noun} onClick={() => vote(-1)} />
        {rating && (
          <span className="tnum inline-flex items-center" style={{ fontSize: F.sm, color: C.muted, gap: S.xs, marginLeft: S.sm }}>
            <Star size={14} weight="fill" color={C.star} />
            <b style={{ color: C.text }}>{rating.value}</b> from {rating.count} review{rating.count === 1 ? "" : "s"}
          </span>
        )}
      </div>

      <ReviewForm id={id} name={entity.name} noun={noun} session={session} mine={mine}
        onPosted={(list) => setReviews(list)} />

      <ReviewList id={id} reviews={reviews} session={session} onChange={setReviews} />

      <ReportForm id={id} name={entity.name} kind={kind} />

      {!session.loading && (
        <OwnerPanel tool={entity} kind={kind} session={session} refresh={refresh}
          onTools={() => { try { location.reload(); } catch {} }} />
      )}
    </div>
  );
}

/* The same gesture as on a tool card, so the same icons and the same states:
   regular when off, fill when on, neutral rather than coloured. */
function VoteButton({ dir, on, count, noun, onClick }) {
  const Icon = dir === 1 ? ThumbsUp : ThumbsDown;
  return (
    <button onClick={onClick} aria-pressed={on} className="press inline-flex items-center tnum"
      aria-label={`${dir === 1 ? "Like" : "Dislike"} this ${noun}`}
      style={{
        gap: S.xs, background: on ? C.subtle : "transparent",
        border: `1px solid ${on ? C.edge : C.line}`, borderRadius: R.control,
        padding: "6px 10px", fontSize: F.sm, color: C.text, cursor: "pointer", fontFamily: "inherit",
      }}>
      <Icon size={15} weight={on ? "fill" : "regular"} />
      {count}
    </button>
  );
}

/*
 * One review per account per listing, signed in, with the draft kept across
 * the trip through the inbox. Precedence is a saved draft over the stored
 * review: the draft is the newer thing, and it is what they were typing when
 * they left to sign in.
 */
function ReviewForm({ id, name, noun, session, mine, onPosted }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [author, setAuthor] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const draftKey = `svt:draft:${id}`;
  const loaded = useRef(false);

  useEffect(() => {
    let d = null;
    try { const raw = localStorage.getItem(draftKey); if (raw) d = JSON.parse(raw); } catch {}
    if (d && (d.rating || d.text)) {
      setRating(d.rating || 0); setText(d.text || ""); setAuthor(d.author || "");
      if (!loaded.current) setOpen(true);
    } else if (mine) {
      setRating(mine.rating || 0); setText(mine.text || ""); setAuthor(mine.author || "");
    }
    loaded.current = true;
  }, [mine?.id]);

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
      onPosted((d.reviews && d.reviews[id]) || []);
      try { localStorage.removeItem(draftKey); } catch {}
      setMsg(d.replaced ? "Updated." : "Posted. Thank you.");
      setOpen(false);
    } catch { setMsg("Could not reach the server."); }
    setBusy(false);
  }

  if (!open) {
    return (
      <div style={{ marginTop: S.lg }}>
        <button onClick={() => setOpen(true)} style={{ ...quiet, fontSize: F.sm, color: C.muted }}>
          {mine ? "Edit your review" : `Rate or review this ${noun}`}
        </button>
        {msg && <span style={{ fontSize: F.xs, color: C.muted, marginLeft: S.md }}>{msg}</span>}
      </div>
    );
  }

  const losesVotes = mine && mine.helpful > 0 && text !== (mine.text || "");

  return (
    <div style={{ marginTop: S.lg, border: `1px solid ${C.line}`, borderRadius: R.card, padding: S.lg }}>
      <div className="flex items-center" role="radiogroup" aria-label="Rating" style={{ gap: S.xs }}>
        {[1, 2, 3, 4, 5].map((s) => (
          <button key={s} onClick={() => setRating(s)} role="radio" aria-checked={rating === s}
            aria-label={`${s} star${s > 1 ? "s" : ""}`}
            style={{ background: "none", border: 0, cursor: "pointer", padding: 2, lineHeight: 0 }}>
            <Star size={22} weight={s <= rating ? "fill" : "regular"} color={s <= rating ? C.star : C.starOff} />
          </button>
        ))}
      </div>
      {session.signedIn ? (
        <>
          <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Your name (optional)"
            aria-label="Your name" style={{ ...field, marginTop: S.md }} maxLength={40} />
          <GrowText value={text} onChange={(e) => setText(e.target.value)} onSubmit={submit}
            rows={3} maxRows={12} maxLength={600} aria-label="Your review"
            placeholder={`What should another app vendor know about ${name}?`}
            style={{ ...field, marginTop: S.sm }} />
          {losesVotes && (
            <p style={{ fontSize: F.xs, color: C.warnInk, margin: `${S.xs}px 0 0` }}>
              Changing the text clears the {mine.helpful} helpful vote{mine.helpful === 1 ? "" : "s"} on it. Changing only the rating keeps them.
            </p>
          )}
          <div className="flex items-center" style={{ gap: S.md, marginTop: S.md }}>
            <button onClick={submit} disabled={busy || !rating} className="press" style={{
              background: rating ? C.accent : C.subtle, color: rating ? C.onAccent : C.dim,
              border: 0, borderRadius: R.control, padding: "8px 16px", fontSize: F.sm, fontWeight: 700,
              cursor: rating ? "pointer" : "default", fontFamily: "inherit",
            }}>{busy ? "Posting…" : mine ? "Update review" : "Post review"}</button>
            <button onClick={() => setOpen(false)} style={{ ...quiet, textDecoration: "none", fontSize: F.sm, color: C.dim }}>
              Cancel
            </button>
          </div>
          {msg && <p style={{ fontSize: F.xs, color: C.muted, margin: `${S.sm}px 0 0` }}>{msg}</p>}
        </>
      ) : (
        <div style={{ marginTop: S.md }}>
          <SignInPrompt returnTo={id}
            reason="Ratings need an account so they mean something. One email, no password." />
        </div>
      )}
    </div>
  );
}

/* Most helpful first. Helpfulness votes need an account and never apply to
   your own review; where a vote is not possible the count is shown instead,
   and nothing at all when there is none (rule E). */
function ReviewList({ id, reviews, session, onChange }) {
  const ordered = useMemo(() => [...reviews].sort(byHelpfulness), [reviews]);
  if (!ordered.length) return null;
  return (
    <section style={{ marginTop: S.xl }}>
      <h2 style={{ fontSize: F.lg, fontWeight: 700, margin: 0, letterSpacing: TRACK.tight }}>What people say</h2>
      <div style={{ marginTop: S.sm }}>
        {ordered.map((r) => (
          <div key={r.id} style={{ borderTop: `1px solid ${C.line}`, padding: `${S.md}px 0` }}>
            <p className="flex flex-wrap items-center" style={{ fontSize: F.sm, margin: 0, gap: S.sm }}>
              <b>{r.author}</b>
              <span className="inline-flex" aria-label={`${r.rating} out of 5`} style={{ gap: 1 }}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} size={12} weight="fill" color={s <= r.rating ? C.star : C.starOff} />
                ))}
              </span>
              <span className="tnum" style={{ color: C.dim }}>{r.date}</span>
            </p>
            {r.text && <p style={{ fontSize: F.md, color: C.muted, lineHeight: 1.55, margin: `${S.xs}px 0 0`, maxWidth: "68ch" }}>{r.text}</p>}
            <Helpful id={id} review={r} session={session} onChange={onChange} />
          </div>
        ))}
      </div>
    </section>
  );
}

function Helpful({ id, review, session, onChange }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const n = review.helpful || 0;
  const on = Boolean(review.helpfulByMe);
  const canVote = session.signedIn && !review.mine;

  async function click() {
    if (busy) return;
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/review/helpful", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toolId: id, reviewId: review.id }),
      });
      if (!res.ok) setErr(await res.text());
      else { const d = await res.json(); onChange((d.reviews && d.reviews[id]) || []); }
    } catch { setErr("That did not save."); }
    setBusy(false);
  }

  if (!canVote) {
    if (!n) return null;
    return <p className="tnum" style={{ fontSize: F.xs, color: C.dim, margin: `${S.sm}px 0 0` }}>{n} found this helpful</p>;
  }
  return (
    <div className="flex flex-wrap items-center" style={{ gap: S.sm, marginTop: S.sm }}>
      <button onClick={click} aria-pressed={on} disabled={busy}
        aria-label={on ? "Remove your helpful vote" : "Mark this review helpful"}
        className="press inline-flex items-center tnum" style={{
          gap: S.xs, background: on ? C.accent : C.subtle, color: on ? C.onAccent : C.muted,
          border: `1px solid ${on ? C.accent : C.line}`, borderRadius: R.control,
          padding: "4px 8px", fontSize: F.xs, fontWeight: 600,
          cursor: busy ? "default" : "pointer", fontFamily: "inherit",
        }}>
        <ThumbsUp size={12} weight={on ? "fill" : "regular"} />
        Helpful{n > 0 ? ` ${n}` : ""}
      </button>
      {err && <span style={{ fontSize: F.xs, color: C.badInk }}>{err}</span>}
    </div>
  );
}

/* Open to anyone, signed in or not: the person who spots a dead link is rarely
   the person who owns the listing. It writes to the report queue and nowhere
   else (invariant 13). */
function ReportForm({ id, name, kind }) {
  const kinds = reportKindsFor(kind);
  const [open, setOpen] = useState(false);
  const [which, setWhich] = useState(kinds[0].id);
  const [value, setValue] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [sent, setSent] = useState(false);
  const spec = reportKindOf(which) || kinds[0];

  async function submit() {
    setBusy(true); setMsg("");
    try {
      const res = await fetch("/api/report", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toolId: id, kind: which, value, email }),
      });
      if (res.ok) { setSent(true); setMsg("Thanks. An editor will take a look."); }
      else setMsg(await res.text());
    } catch { setMsg("Could not reach the server."); }
    setBusy(false);
  }

  if (!open || sent) {
    return (
      <div style={{ marginTop: S.md }}>
        {sent
          ? <p style={{ fontSize: F.xs, color: C.muted, margin: 0 }}>{msg}</p>
          : <button onClick={() => setOpen(true)} style={{ ...quiet, fontSize: F.xs, color: C.dim }}>
              Report a problem with this listing
            </button>}
      </div>
    );
  }

  return (
    <div style={{ marginTop: S.md, border: `1px dashed ${C.line}`, borderRadius: R.card, padding: S.lg }}>
      <p style={{ fontSize: F.sm, fontWeight: 700, margin: 0 }}>Report a problem with {name}</p>
      <div className="flex flex-wrap items-start" style={{ gap: S.sm, marginTop: S.md }}>
        <select value={which} aria-label="Kind of problem" onChange={(e) => setWhich(e.target.value)}
          style={{ ...field, width: 210 }}>
          {kinds.map((k) => <option key={k.id} value={k.id} style={{ background: C.panel }}>{k.label}</option>)}
        </select>
        <GrowText value={value} onChange={(e) => setValue(e.target.value)} onSubmit={submit}
          rows={1} maxRows={6} maxLength={500} aria-label="Details" placeholder={spec.hint}
          style={{ ...field, flex: 1, minWidth: 200, width: "auto" }} />
      </div>
      <div className="flex flex-wrap items-center" style={{ gap: S.sm, marginTop: S.sm }}>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Your email (optional)"
          aria-label="Your email, optional" type="email" style={{ ...field, width: 220 }} />
        <button onClick={submit} disabled={busy} className="press" style={{
          background: C.text, color: C.bg, border: 0, borderRadius: R.control,
          padding: "8px 16px", fontSize: F.sm, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
        }}>{busy ? "Sending…" : "Send report"}</button>
        <button onClick={() => setOpen(false)} style={{ ...quiet, textDecoration: "none", fontSize: F.xs, color: C.dim }}>Cancel</button>
      </div>
      {msg && <p style={{ fontSize: F.xs, color: C.badInk, margin: `${S.sm}px 0 0` }}>{msg}</p>}
    </div>
  );
}
