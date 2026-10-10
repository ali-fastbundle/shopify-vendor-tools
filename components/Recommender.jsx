"use client";

import React, { useEffect, useRef, useState } from "react";
import { C, S, R, F, TRACK, formatDay } from "@/lib/tools";
import { outbound } from "@/lib/outbound";
import {
  PRIMING, QUESTIONS, PARTS, SCREENS, questionOf, answered, answerText, MAX_INSTALLS,
} from "@/lib/recommendOptions";
import { useSession, SignInPrompt } from "@/components/Account";
import GrowText from "@/components/GrowText";

/*
 * The growth recommender, as a conversation rather than a form.
 *
 * Four priming screens say what this is before anything is asked, each moved
 * on by a button whose label is an answer. Then one question per screen, in
 * five parts, with the part, a progress bar and Start over always visible.
 * Back never clears anything, every question but the listing URL can be
 * skipped, and progress is saved to the account after every screen
 * (/api/recommend/draft), so somebody who leaves resumes where they stopped.
 *
 * Design: the site's own system (CLAUDE.md), read through the taste skill's
 * form rules: the question is the label, above its one input; errors sit
 * under it; buttons fit on one line; loading is a skeleton shaped like the
 * answer. Nothing moves except under the pointer.
 */

const EMPTY = { url: "", app: null, installs: null, revenue: null, tried: [], problem: "", objective: "", budget: null, timeframe: null };
const isPrime = (step) => step.startsWith("prime");
const indexOf = (step) => SCREENS.indexOf(step);
const nextOf = (step) => SCREENS[Math.min(indexOf(step) + 1, SCREENS.length - 1)];
const prevOf = (step) => SCREENS[Math.max(indexOf(step) - 1, 0)];

/* ---------------- small parts ---------------- */

function Button({ children, onClick, tone = "plain", disabled, busy, type = "button", href }) {
  const go = tone === "go";
  const style = {
    /* Green is the action colour (invariant C): the button that moves the
       person forward is the one that does something. */
    background: disabled ? C.subtle : go ? C.accent : C.panel,
    color: disabled ? C.dim : go ? C.onAccent : C.text,
    border: `1px solid ${go && !disabled ? C.accent : C.line}`, borderRadius: R.control,
    padding: "8px 16px", fontSize: F.sm, fontWeight: 600, fontFamily: "inherit",
    cursor: disabled ? "default" : "pointer", whiteSpace: "nowrap", textDecoration: "none",
    display: "inline-flex", alignItems: "center",
  };
  if (href) return <a href={href} target="_blank" rel="noopener noreferrer" className="ctl press" style={style}>{children}</a>;
  return (
    <button type={type} onClick={onClick} disabled={disabled || busy} className="ctl press" style={style}>
      {busy ? "One moment" : children}
    </button>
  );
}

const plainLink = {
  background: "none", border: 0, padding: 0, color: C.muted, fontSize: F.sm,
  fontFamily: "inherit", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3,
};

function Header({ step, onStartOver, saved }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => { if (!armed) return undefined; const t = setTimeout(() => setArmed(false), 4000); return () => clearTimeout(t); }, [armed]);
  const q = questionOf(step);
  const part = q ? q.part : 0;
  const qi = q ? QUESTIONS.indexOf(q) : -1;
  const pct = step === "result" ? 100 : qi < 0 ? 2 : Math.round((qi / (QUESTIONS.length - 1)) * 100);
  return (
    <div style={{ marginTop: S["2xl"] }}>
      <div className="flex flex-wrap items-center justify-between" style={{ gap: S.sm }}>
        <p className="tnum" style={{ fontSize: F.sm, color: C.muted, margin: 0 }}>
          <b style={{ color: C.text }}>Part {step === "result" ? 5 : part + 1} of 5</b> · {step === "result" ? "Your picks" : PARTS[part]}
          {saved && <span style={{ color: C.dim }}> · saved</span>}
        </p>
        {armed
          ? <span className="flex items-center" style={{ gap: S.sm }}>
              <Button onClick={() => { setArmed(false); onStartOver(); }}>Clear my answers</Button>
              <button type="button" onClick={() => setArmed(false)} style={plainLink}>Keep them</button>
            </span>
          : <button type="button" onClick={() => setArmed(true)} style={plainLink}>Start over</button>}
      </div>
      <div role="progressbar" aria-label="Progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}
        style={{ height: 6, background: C.subtle, borderRadius: R.pill, marginTop: S.sm, overflow: "hidden" }}>
        {/* Progress is a state, not an action, so it is not green. */}
        <div style={{ width: `${pct}%`, height: "100%", background: C.text, borderRadius: R.pill }} />
      </div>
    </div>
  );
}

/* The question is the heading and the label; focus lands on it when the screen changes. */
function Question({ q, id, children }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus({ preventScroll: false }); }, [q.id]);
  return (
    <section aria-labelledby={`${id}-h`} style={{ marginTop: S["3xl"], maxWidth: 640 }}>
      <h2 id={`${id}-h`} ref={ref} tabIndex={-1} style={{ fontSize: F["2xl"], fontWeight: 700, letterSpacing: TRACK.tighter, margin: 0, lineHeight: 1.25, outline: "none" }}>
        <label htmlFor={id} style={{ cursor: "default" }}>{q.heading}</label>
      </h2>
      {q.help && <p style={{ fontSize: F.md, color: C.muted, lineHeight: 1.55, margin: `${S.sm}px 0 0` }}>{q.help}</p>}
      <div style={{ marginTop: S.xl }}>{children}</div>
    </section>
  );
}

const field = {
  background: C.field, border: `1px solid ${C.edge}`, borderRadius: R.control,
  padding: "8px 12px", fontSize: F.md, color: C.text, fontFamily: "inherit", width: "100%",
};

function Options({ id, q, value, onChange, multi = false }) {
  const pick = (oid) => {
    if (!multi) return onChange(oid);
    const cur = Array.isArray(value) ? value : [];
    if (oid === "nothing") return onChange(cur.includes("nothing") ? [] : ["nothing"]);
    const base = cur.filter((x) => x !== "nothing");
    onChange(base.includes(oid) ? base.filter((x) => x !== oid) : [...base, oid]);
  };
  return (
    <div id={id} role={multi ? "group" : "radiogroup"} aria-label={q.heading} className="flex flex-col" style={{ gap: S.sm }}>
      {q.options.map((o) => {
        const on = multi ? (value || []).includes(o.id) : value === o.id;
        return (
          <label key={o.id} className="ctl flex items-center" style={{
            gap: S.md, background: on ? C.subtle : C.panel, border: `1px solid ${on ? C.text : C.line}`,
            borderRadius: R.control, padding: "12px 16px", fontSize: F.md, cursor: "pointer",
          }}>
            <input type={multi ? "checkbox" : "radio"} name={id} checked={on} onChange={() => pick(o.id)}
              style={{ accentColor: C.text, width: 16, height: 16, flexShrink: 0 }} />
            {o.label}
          </label>
        );
      })}
    </div>
  );
}

/* One input for one question, used on its own screen and inline on Review. */
function Input({ q, id, value, onChange, onSubmit }) {
  if (q.kind === "url") {
    return <input id={id} type="url" inputMode="url" autoComplete="url" value={value || ""}
      placeholder="https://apps.shopify.com/your-app" onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onSubmit?.(); } }} style={field} />;
  }
  if (q.kind === "number") {
    return <input id={id} type="number" min={0} max={MAX_INSTALLS} step={1} inputMode="numeric" value={value ?? ""}
      onChange={(e) => onChange(e.target.value === "" ? null : Math.max(0, Math.floor(Number(e.target.value))))}
      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onSubmit?.(); } }} style={{ ...field, width: 220 }} />;
  }
  if (q.kind === "choice") return <Options id={id} q={q} value={value} onChange={onChange} />;
  if (q.kind === "multi") return <Options id={id} q={q} value={value} onChange={onChange} multi />;
  if (q.kind === "prose") {
    return <GrowText id={id} value={value || ""} onChange={(e) => onChange(e.target.value)} onSubmit={onSubmit}
      rows={q.rows} maxRows={q.rows + 10} maxLength={q.max} style={{ ...field, lineHeight: 1.55 }} />;
  }
  return null;
}

/* ---------------- the flow ---------------- */

export default function Recommender() {
  const [session] = useSession();
  const [step, setStep] = useState("prime1");
  const [answers, setAnswers] = useState(EMPTY);
  const [skipped, setSkipped] = useState([]);
  const [saved, setSaved] = useState(false);
  const [listing, setListing] = useState({ status: "idle", reason: "" });
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const loaded = useRef(false);

  /* Resume: a saved draft skips the priming and lands on the screen they left. */
  useEffect(() => {
    if (!session.signedIn || loaded.current) return;
    loaded.current = true;
    fetch("/api/recommend/draft").then((r) => (r.ok ? r.json() : null)).then((d) => {
      const draft = d && d.draft;
      if (!draft) return;
      setAnswers({ ...EMPTY, ...draft.answers });
      setSkipped(draft.skipped || []);
      if (SCREENS.includes(draft.step)) setStep(draft.step);
    }).catch(() => {});
  }, [session.signedIn]);

  function persist(nextStep, a = answers, s = skipped) {
    if (!session.signedIn || isPrime(nextStep)) return;
    setSaved(false);
    fetch("/api/recommend/draft", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: nextStep, answers: a, skipped: s }),
    }).then((r) => setSaved(r.ok)).catch(() => {});
  }

  const go = (to, a, s) => { setError(""); setStep(to); persist(to, a, s); };
  const setAnswer = (key, v) => setAnswers((x) => ({ ...x, [key]: v }));

  function ok(key) {
    const s = skipped.filter((k) => k !== key);
    setSkipped(s);
    go(nextOf(step), answers, s);
  }
  function skip(key) {
    const a = { ...answers, [key]: key === "tried" ? [] : key === "installs" ? null : "" };
    const s = [...new Set([...skipped, key])];
    setAnswers(a); setSkipped(s);
    go(nextOf(step), a, s);
  }

  async function readListing(url, then = "confirm") {
    setListing({ status: "reading", reason: "" }); setError("");
    try {
      const res = await fetch("/api/recommend/listing", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }),
      });
      if (!res.ok) { setListing({ status: "idle", reason: "" }); setError(await res.text()); return null; }
      const d = await res.json();
      const a = { ...answers, url: d.url, app: d.app || null };
      setAnswers(a);
      setListing({ status: d.app ? "found" : "unread", reason: d.reason || "" });
      if (then) go(then, a);
      return a;
    } catch {
      setListing({ status: "idle", reason: "" });
      setError("Could not reach the server. Your answer is still here.");
      return null;
    }
  }

  function startOver() {
    setAnswers(EMPTY); setSkipped([]); setResult(null); setListing({ status: "idle", reason: "" });
    setStep("prime1"); setError("");
    if (session.signedIn) fetch("/api/recommend/draft", { method: "DELETE" }).catch(() => {});
  }

  async function run() {
    setRunning(true); setError(""); setStep("result"); setResult(null);
    try {
      const res = await fetch("/api/recommend", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, skipped }),
      });
      if (!res.ok) { setError(await res.text()); setStep("review"); return; }
      setResult(await res.json());
    } catch {
      setError("Could not reach the server. Your answers are kept; try again.");
      setStep("review");
    } finally {
      setRunning(false);
    }
  }

  /* ---------- priming ---------- */
  if (isPrime(step)) {
    const i = PRIMING.findIndex((p) => p.id === step);
    const p = PRIMING[i];
    return (
      <>
        <Header step={step} onStartOver={startOver} saved={false} />
        <section style={{ marginTop: S["4xl"], maxWidth: 640 }}>
          <h2 tabIndex={-1} style={{ fontSize: F.display, fontWeight: 800, letterSpacing: TRACK.tighter, margin: 0, lineHeight: 1.15 }}>{p.title}</h2>
          <p style={{ fontSize: F.lg, color: C.muted, lineHeight: 1.55, margin: `${S.md}px 0 0` }}>{p.body}</p>
          <div className="flex flex-wrap items-center" style={{ gap: S.lg, marginTop: S["2xl"] }}>
            <Button tone="go" onClick={() => setStep(nextOf(step))}>{p.ok}</Button>
            {i > 0 && <button type="button" onClick={() => setStep(prevOf(step))} style={plainLink}>Back</button>}
          </div>
          <div aria-label={`Screen ${i + 1} of ${PRIMING.length}`} role="img" className="flex" style={{ gap: S.xs, marginTop: S["2xl"] }}>
            {PRIMING.map((x, j) => (
              <span key={x.id} style={{ width: 8, height: 8, borderRadius: R.pill, background: j === i ? C.text : C.edge }} />
            ))}
          </div>
        </section>
      </>
    );
  }

  /* ---------- signed out: the questions need an account to save to ---------- */
  if (!session.loading && !session.signedIn) {
    return (
      <>
        <Header step="url" onStartOver={startOver} saved={false} />
        <div style={{ marginTop: S["3xl"], border: `1px solid ${C.line}`, borderRadius: R.card, padding: S.xl, maxWidth: 640, background: C.panel }}>
          <SignInPrompt returnTo="@recommend"
            reason="Sign in to start. Your answers save to your account as you go, so you can leave and pick up where you stopped. One email, no password." />
        </div>
      </>
    );
  }

  /* ---------- the answer ---------- */
  if (step === "result") {
    return (
      <>
        <Header step="result" onStartOver={startOver} saved={false} />
        {running || !result ? <Skeleton /> : <Answer result={result} answers={answers} onEdit={() => go("review")} />}
      </>
    );
  }

  const q = questionOf(step);
  const id = `r-${q.id}`;
  const back = step === "url" ? null : () => go(prevOf(step));
  const backLink = back && <button type="button" onClick={back} style={plainLink}>Back</button>;
  const errorLine = error && <p role="alert" style={{ fontSize: F.sm, color: C.badInk, margin: `${S.md}px 0 0` }}>{error}</p>;

  /* ---------- Part 1: the listing ---------- */
  if (q.kind === "url") {
    const submit = () => answers.url.trim() && readListing(answers.url.trim());
    return (
      <>
        <Header step={step} onStartOver={startOver} saved={saved} />
        <Question q={q} id={id}>
          <Input q={q} id={id} value={answers.url} onChange={(v) => setAnswer("url", v)} onSubmit={submit} />
          {errorLine}
          <div className="flex flex-wrap items-center" style={{ gap: S.md, marginTop: S.lg }}>
            <Button tone="go" onClick={submit} disabled={!answers.url.trim()} busy={listing.status === "reading"}>OK</Button>
            <Button href={outbound("https://apps.shopify.com")}>Open the App Store</Button>
          </div>
          <p style={{ fontSize: F.xs, color: C.dim, margin: `${S.md}px 0 0` }}>The App Store opens in a new tab. Find your app, copy the address, come back.</p>
        </Question>
      </>
    );
  }

  if (q.kind === "confirm") {
    const app = answers.app;
    return (
      <>
        <Header step={step} onStartOver={startOver} saved={saved} />
        <Question q={app ? q : { ...q, heading: "We could not read that listing.", help: listing.reason || "It may be a temporary problem. You can fix the link, or carry on and we will use what you tell us." }} id={id}>
          {app && (
            <dl id={id} className="drafts-facts" style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: R.card, padding: S.lg, margin: 0 }}>
              {[["App", app.name], ["Category", app.category], ["Rating", app.rating != null ? `${app.rating} out of 5` : ""],
                ["Reviews", app.reviews != null ? app.reviews.toLocaleString("en-US") : ""], ["Launched", app.launched ? formatDay(app.launched) : ""]]
                .filter(([, v]) => v).map(([k, v]) => (
                  <React.Fragment key={k}>
                    <dt style={{ fontSize: F.sm, color: C.muted }}>{k}</dt>
                    <dd className="tnum" style={{ fontSize: F.md, color: C.text, margin: 0, fontWeight: k === "App" ? 700 : 500 }}>{v}</dd>
                  </React.Fragment>
                ))}
            </dl>
          )}
          <div className="flex flex-wrap items-center" style={{ gap: S.md, marginTop: S.xl }}>
            <Button tone="go" onClick={() => go(nextOf(step))}>{app ? "Yes, that's my app" : "Carry on without it"}</Button>
            <Button onClick={() => go("url")}>{app ? "Not my app" : "Fix the link"}</Button>
          </div>
        </Question>
      </>
    );
  }

  /* ---------- Part 5: review ---------- */
  if (q.kind === "review") {
    return (
      <>
        <Header step={step} onStartOver={startOver} saved={saved} />
        <Question q={q} id={id}>
          <div id={id} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: R.card, padding: `0 ${S.lg}px` }}>
            {QUESTIONS.filter((x) => x.key && x.kind !== "confirm" && x.kind !== "review").map((x, i) => (
              <ReviewRow key={x.id} q={x} first={i === 0} answers={answers} skipped={skipped}
                onSave={async (v) => {
                  let a = { ...answers, [x.key]: v };
                  if (x.key === "url") a = (await readListing(v, null)) || a;
                  const s = answered(x.key, a) ? skipped.filter((k) => k !== x.key) : [...new Set([...skipped, x.key])];
                  setAnswers(a); setSkipped(s); persist("review", a, s);
                }} />
            ))}
          </div>
          {errorLine}
          <div className="flex flex-wrap items-center" style={{ gap: S.lg, marginTop: S.xl }}>
            <Button tone="go" onClick={run} disabled={!answers.url}>Get my picks</Button>
            {backLink}
          </div>
          {skipped.length > 0 && (
            <p style={{ fontSize: F.sm, color: C.muted, margin: `${S.md}px 0 0`, lineHeight: 1.5 }}>
              You skipped {skipped.length === 1 ? "one question" : `${skipped.length} questions`}. The picks will have less to go on, and the answer will say so.
            </p>
          )}
          <p style={{ fontSize: F.xs, color: C.dim, margin: `${S.md}px 0 0`, lineHeight: 1.5, maxWidth: "60ch" }}>
            Your answers and the picks are kept, without your email address, so we can see what app teams need. Your saved progress is deleted once you run it.
          </p>
        </Question>
      </>
    );
  }

  /* ---------- Parts 2 to 4: one question, OK, Skip, Back ---------- */
  const value = answers[q.key];
  const has = answered(q.key, answers);
  return (
    <>
      <Header step={step} onStartOver={startOver} saved={saved} />
      <Question q={q} id={id}>
        <Input q={q} id={id} value={value} onChange={(v) => setAnswer(q.key, v)} onSubmit={() => has && ok(q.key)} />
        {errorLine}
        <div className="flex flex-wrap items-center" style={{ gap: S.lg, marginTop: S.xl }}>
          <Button tone="go" onClick={() => ok(q.key)} disabled={!has}>OK</Button>
          <button type="button" onClick={() => skip(q.key)} style={plainLink}>Skip this one</button>
          {backLink}
        </div>
        {q.kind === "prose" && <p style={{ fontSize: F.xs, color: C.dim, margin: `${S.md}px 0 0` }}>Enter starts a new line. Cmd or Ctrl and Enter for OK.</p>}
      </Question>
    </>
  );
}

/* One answer on the review screen, editable where it sits. */
function ReviewRow({ q, first, answers, skipped, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(answers[q.key]);
  const [busy, setBusy] = useState(false);
  const id = `rv-${q.id}`;
  const shown = q.key === "url" && answers.app ? `${answers.app.name} (${answers.url.replace(/^https:\/\//, "")})` : answerText(q.key, answers);
  const save = async () => { setBusy(true); await onSave(draft); setBusy(false); setEditing(false); };
  return (
    <div style={{ borderTop: first ? 0 : `1px solid ${C.line}`, padding: `${S.md}px 0` }}>
      <div className="flex items-start justify-between" style={{ gap: S.md }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: F.xs, color: C.muted, margin: 0, fontWeight: 600 }}>{q.short}</p>
          {!editing && (
            <p style={{ fontSize: F.md, color: shown ? C.text : C.dim, margin: "2px 0 0", lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {shown || (skipped.includes(q.key) ? "Skipped" : "Not answered")}
            </p>
          )}
        </div>
        {!editing && <button type="button" onClick={() => { setDraft(answers[q.key]); setEditing(true); }} style={plainLink} aria-label={`Change ${q.short}`}>Change</button>}
      </div>
      {editing && (
        <div style={{ marginTop: S.sm }}>
          <label htmlFor={id} style={{ fontSize: F.sm, color: C.text, display: "block", marginBottom: S.xs }}>{q.heading}</label>
          <Input q={q} id={id} value={draft} onChange={setDraft} onSubmit={save} />
          <div className="flex items-center" style={{ gap: S.md, marginTop: S.sm }}>
            <Button tone="go" onClick={save} busy={busy} disabled={q.required && !String(draft || "").trim()}>Save</Button>
            <button type="button" onClick={() => setEditing(false)} style={plainLink}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* Shaped like the answer, so the page does not jump when it arrives. */
function Skeleton() {
  const bar = (w, h = 12) => <div style={{ width: w, height: h, background: C.subtle, borderRadius: R.control, marginTop: S.sm }} />;
  return (
    <div aria-busy="true" aria-label="Reading your listing and choosing" style={{ marginTop: S["3xl"], maxWidth: 760 }}>
      <p style={{ fontSize: F.md, color: C.muted, margin: 0 }}>Reading your listing and choosing. This takes up to half a minute.</p>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: R.card, padding: S.xl, marginTop: S.lg }}>
          {bar("40%", 18)}{bar("90%")}{bar("80%")}{bar("60%")}
        </div>
      ))}
    </div>
  );
}

const block = (title, body) => body ? (
  <div style={{ marginTop: S.md }}>
    <p style={{ fontSize: F.xs, color: C.muted, fontWeight: 700, margin: 0 }}>{title}</p>
    <p style={{ fontSize: F.md, color: C.text, lineHeight: 1.6, margin: "2px 0 0", maxWidth: "68ch" }}>{body}</p>
  </div>
) : null;

function Answer({ result, answers, onEdit }) {
  const { app = {}, listingRead, picks = [], path, noneFit, skipped = [] } = result;
  return (
    <section style={{ marginTop: S["3xl"], maxWidth: 760 }}>
      <h2 tabIndex={-1} style={{ fontSize: F["2xl"], fontWeight: 700, letterSpacing: TRACK.tighter, margin: 0 }}>
        {noneFit ? "Nothing we would recommend yet" : `${picks.length === 3 ? "Three" : picks.length === 2 ? "Two" : "One"} ${picks.length === 1 ? "tool" : "tools"}${app.name ? ` for ${app.name}` : ""}`}
      </h2>
      {!listingRead && <p style={{ fontSize: F.sm, color: C.muted, margin: `${S.sm}px 0 0` }}>The listing could not be read, so these rest on what you told us.</p>}
      {skipped.length > 0 && (
        <p style={{ fontSize: F.sm, color: C.text, background: C.subtle, borderRadius: R.control, padding: "8px 12px", margin: `${S.md}px 0 0`, lineHeight: 1.5 }}>
          Less to go on: you skipped {skipped.map((k) => questionOf(k)?.short.toLowerCase() || k).join(", ")}. The picks below are less certain for it.
        </p>
      )}

      {noneFit && <p style={{ fontSize: F.md, color: C.text, lineHeight: 1.6, margin: `${S.lg}px 0 0`, maxWidth: "64ch" }}>{noneFit}</p>}

      {picks.map((p) => (
        <article key={p.id} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: R.card, padding: S.xl, marginTop: S.lg, boxShadow: "var(--c-card-shadow)" }}>
          <div className="flex flex-wrap items-baseline" style={{ gap: S.sm }}>
            <a href={p.path} style={{ fontSize: F.xl, fontWeight: 700, color: C.text, textDecoration: "none" }}>{p.name}</a>
            <span style={{ fontSize: F.sm, color: C.muted }}>{p.category}</span>
          </div>
          {block("Why this one", p.why)}
          {block("Cost against your budget", p.cost)}
          {block("What it will not solve", p.limits)}
          {block("Watch for, from its listing", p.caveat)}
          {p.drivers?.length > 0 && (
            <div style={{ marginTop: S.md }}>
              <p style={{ fontSize: F.xs, color: C.muted, fontWeight: 700, margin: 0 }}>Based on your answers</p>
              <ul style={{ listStyle: "none", padding: 0, margin: `${S.xs}px 0 0` }}>
                {p.drivers.map((d) => (
                  <li key={d.key} style={{ fontSize: F.sm, color: C.muted, lineHeight: 1.5, marginTop: 2 }}>
                    <b style={{ color: C.text, fontWeight: 600 }}>{d.label}:</b> {String(d.answer).length > 140 ? `${String(d.answer).slice(0, 140)}…` : d.answer}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <a href={p.path} style={{ display: "inline-block", fontSize: F.sm, color: C.text, marginTop: S.md, textUnderlineOffset: 3 }}>Read the full {p.name} entry</a>
        </article>
      ))}

      {path === "fallback" && picks.length > 0 && (
        <p style={{ fontSize: F.xs, color: C.dim, margin: `${S.lg}px 0 0` }}>
          Written without the usual model, which was unavailable: ranked on the categories your words point to and your budget.
        </p>
      )}
      <div className="flex flex-wrap items-center" style={{ gap: S.md, marginTop: S.xl }}>
        <Button onClick={onEdit}>Change my answers</Button>
      </div>
      <p style={{ fontSize: F.xs, color: C.dim, margin: `${S.md}px 0 0`, lineHeight: 1.5, maxWidth: "60ch" }}>
        Tools the editor of this directory is connected to are never recommended. Nothing here is paid placement.
      </p>
    </section>
  );
}
