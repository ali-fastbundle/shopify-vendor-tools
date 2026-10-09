"use client";

import React, { useEffect, useState } from "react";
import { C, S, R, F, TRACK, formatDay } from "@/lib/tools";
import { BUDGETS, STAGES, OBJECTIVES, MAX_INSTALLS } from "@/lib/recommendOptions";
import { useSession, SignInPrompt } from "@/components/Account";

/*
 * The growth recommender's form and answer. Signed in only, and the form
 * survives the trip through the inbox: what was typed is kept in this
 * browser under `svt:recommend:draft` until a run succeeds, the same rule as
 * a half-written review (invariant 16).
 *
 * The sentence under the button says exactly what is kept, because it is a
 * promise: the inputs and the answer, never the address.
 */
const DRAFT = "svt:recommend:draft";
const EMPTY = { url: "", budget: "", stage: "", objective: "", installs: "" };

const field = {
  background: C.field, border: `1px solid ${C.line}`, borderRadius: R.control,
  padding: "8px 12px", fontSize: F.md, color: C.text, fontFamily: "inherit", width: "100%",
};
const label = { fontSize: F.sm, fontWeight: 600, display: "block", margin: `${S.lg}px 0 ${S.xs}px` };

function Choice({ name, options, value, onChange }) {
  return (
    <div role="radiogroup" aria-label={name} className="flex flex-col" style={{ gap: S.xs }}>
      {options.map((o) => (
        <label key={o.id} className="flex items-center" style={{ gap: S.sm, fontSize: F.md, cursor: "pointer" }}>
          <input type="radio" name={name} value={o.id} checked={value === o.id} onChange={() => onChange(o.id)}
            style={{ accentColor: C.text, width: 15, height: 15 }} />
          {o.label}
        </label>
      ))}
    </div>
  );
}

export default function Recommender() {
  const [session] = useSession();
  const [form, setForm] = useState(EMPTY);
  const [state, setState] = useState({ status: "idle", message: "" });
  const [answer, setAnswer] = useState(null);

  useEffect(() => {
    try { const d = JSON.parse(localStorage.getItem(DRAFT) || "null"); if (d) setForm({ ...EMPTY, ...d }); } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem(DRAFT, JSON.stringify(form)); } catch {}
  }, [form]);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: typeof v === "string" ? v : v.target.value }));
  const ready = form.url.trim() && form.budget && form.stage && form.objective && form.installs !== "";

  async function submit(e) {
    e.preventDefault();
    if (!ready || state.status === "sending") return;
    setState({ status: "sending", message: "" });
    try {
      const res = await fetch("/api/recommend", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, installs: Number(form.installs) }),
      });
      if (!res.ok) { setState({ status: "error", message: await res.text() }); return; }
      setAnswer(await res.json());
      setState({ status: "done", message: "" });
      try { localStorage.removeItem(DRAFT); } catch {}
    } catch {
      setState({ status: "error", message: "Could not reach the server. What you entered is still here." });
    }
  }

  if (session.loading) return <p style={{ fontSize: F.sm, color: C.dim, marginTop: S["2xl"] }}>Checking whether you are signed in…</p>;

  if (!session.signedIn) {
    return (
      <div style={{ marginTop: S["2xl"], border: `1px solid ${C.line}`, borderRadius: R.card, padding: S.xl, maxWidth: 620 }}>
        <SignInPrompt returnTo="@recommend"
          reason="Recommendations need an account, because each one reads your listing and asks a model on your behalf. One email, no password. Anything you have already filled in here is kept." />
      </div>
    );
  }

  return (
    <>
      <form onSubmit={submit} style={{ marginTop: S["2xl"], maxWidth: 620 }}>
        <label style={{ ...label, marginTop: 0 }} htmlFor="r-url">Your app's App Store listing</label>
        <input id="r-url" type="url" inputMode="url" placeholder="https://apps.shopify.com/your-app"
          value={form.url} onChange={set("url")} style={field} />

        <label style={label} htmlFor="r-installs">Installs, roughly</label>
        <input id="r-installs" type="number" min={0} max={MAX_INSTALLS} step={1} inputMode="numeric"
          value={form.installs} onChange={set("installs")} style={{ ...field, width: 200 }} />

        <span style={label}>What you most want right now</span>
        <Choice name="Objective" options={OBJECTIVES} value={form.objective} onChange={set("objective")} />

        <span style={label}>Stage</span>
        <Choice name="Stage" options={STAGES} value={form.stage} onChange={set("stage")} />

        <span style={label}>Budget for tools</span>
        <Choice name="Budget" options={BUDGETS} value={form.budget} onChange={set("budget")} />

        <div className="flex flex-wrap items-center" style={{ gap: S.md, marginTop: S.xl }}>
          <button type="submit" disabled={!ready || state.status === "sending"} className="press" style={{
            background: ready ? C.accent : C.subtle, color: ready ? C.onAccent : C.dim,
            border: 0, borderRadius: R.control, padding: "12px 20px", fontSize: F.md, fontWeight: 700,
            cursor: ready ? "pointer" : "default", fontFamily: "inherit",
          }}>{state.status === "sending" ? "Reading your listing…" : "Get three picks"}</button>
          {state.status === "error" && <span role="alert" style={{ fontSize: F.sm, color: C.badInk }}>{state.message}</span>}
        </div>
        <p style={{ fontSize: F.xs, color: C.dim, margin: `${S.md}px 0 0`, lineHeight: 1.55, maxWidth: "60ch" }}>
          Your listing is read once, now, from the public App Store page. What you enter here and the three
          picks are kept, without your email address, so we can see what app teams need.
        </p>
      </form>

      {answer && <Answer answer={answer} />}
    </>
  );
}

function Answer({ answer }) {
  const { app = {}, listingRead, picks = [], path } = answer;
  const facts = [
    app.rating !== undefined ? `${app.rating} from ${Number(app.reviews || 0).toLocaleString("en-US")} reviews` : "",
    app.launched ? `launched ${formatDay(app.launched)}` : "",
    app.category || "",
  ].filter(Boolean).join(". ");
  return (
    <section aria-live="polite" style={{ marginTop: S["3xl"] }}>
      <h2 style={{ fontSize: F.xl, fontWeight: 700, margin: 0, letterSpacing: TRACK.tight }}>
        Three picks{app.name ? ` for ${app.name}` : ""}
      </h2>
      <p style={{ fontSize: F.sm, color: C.muted, margin: `${S.xs}px 0 0`, lineHeight: 1.55, maxWidth: "64ch" }}>
        {listingRead
          ? `Read from your listing: ${facts || "the name only"}. Keyword positions are not included: no free source allows reading them.`
          : "Your listing could not be read just now, so these are from what you entered."}
        {path !== "model" && " Picked by category and budget rather than by the model today."}
      </p>
      <ol style={{ listStyle: "none", padding: 0, margin: `${S.lg}px 0 0` }}>
        {picks.map((p, i) => (
          <li key={p.id} style={{ borderTop: `1px solid ${C.line}`, padding: `${S.lg}px 0` }}>
            <a href={p.path} style={{ color: C.text, fontWeight: 700, fontSize: F.lg, textDecoration: "none" }}>
              <span className="tnum" style={{ color: C.dim, marginRight: S.sm }}>{i + 1}.</span>{p.name}
            </a>
            <p style={{ fontSize: F.md, color: C.text, lineHeight: 1.6, margin: `${S.xs}px 0 0`, maxWidth: "64ch" }}>{p.reason}</p>
            <a href={p.path} style={{ fontSize: F.sm, color: C.muted }}>Price, caveats and reviews on its listing</a>
          </li>
        ))}
      </ol>
      <p style={{ fontSize: F.xs, color: C.dim, lineHeight: 1.55, maxWidth: "64ch" }}>
        Picked from the directory only. Nobody pays to be recommended, and a tool the editor is connected to is never recommended.
      </p>
    </section>
  );
}
