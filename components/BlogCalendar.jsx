"use client";

import React, { useMemo, useState } from "react";
import { C, S, R, F, TRACK, formatDay } from "@/lib/tools";
import { mondayOf } from "@/lib/ideas";
import { DotsSixVertical } from "@phosphor-icons/react";

/*
 * The blog calendar on /admin (Write tab). Not a CMS: posts are files in
 * lib/posts, and the one way one goes live is Publish here or on the Drafts
 * path, which runs the readiness check and commits the file. A target date is
 * a plan. Nothing publishes on its own. No editor, no media library.
 *
 * Drag a draft or an idea onto a day to move it. Every item also has a date
 * field, because dragging is not something everyone can do.
 */
/* Only this handle drags. A draggable row cannot have its text selected: the
   press starts a drag instead, which is why ideas could not be copied. */
function Handle({ drag, label }) {
  return (
    <span {...drag} role="img" aria-label={`Drag ${label} to a day`} title="Drag to a day on the calendar"
      style={{ cursor: "grab", color: C.dim, display: "inline-flex", alignItems: "center" }}>
      <DotsSixVertical size={16} />
    </span>
  );
}

/* The idea as plain text, with its latest review, for pasting elsewhere. */
export function ideaAsText(i) {
  const r = i.review;
  const lines = [i.title];
  if (i.text && i.text.trim() !== i.title) lines.push("", i.text.trim());
  if (i.targetWeek) lines.push("", `Week of ${i.targetWeek}`);
  if (i.evidence) lines.push(`Search Console: "${i.evidence.query}", ${i.evidence.impressions} impressions, ${i.evidence.clicks} clicks, position ${i.evidence.position}`);
  if (r) {
    lines.push("", `Review: ${VERDICT_LABEL[r.verdict] || r.verdict}. ${r.summary || ""}`.trim());
    if (r.coveredBy?.length) lines.push(`Already covered by: ${r.coveredBy.map((c) => `/blog/${c.slug} (${c.how})`).join("; ")}`);
    if (r.repeats?.length) lines.push(`Repeats: ${r.repeats.map((x) => `${x.id} (${x.how})`).join("; ")}`);
    if (r.listings?.length) lines.push(`Rests on: ${r.listings.join(", ")}`);
    if (r.onlyHere) lines.push(`Only here: ${r.onlyHere}`);
    if (r.readFirst?.length) lines.push(`Read first: ${r.readFirst.join("; ")}`);
    if (r.reader) lines.push(`Who searches: ${r.reader}`);
    if (r.objections?.length) lines.push(`Objections: ${r.objections.join("; ")}`);
  }
  return lines.join("\n");
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    try {
      const t = document.createElement("textarea"); t.value = text; t.style.position = "fixed"; t.style.opacity = "0";
      document.body.appendChild(t); t.select(); const ok = document.execCommand("copy"); t.remove(); return ok;
    } catch { return false; }
  }
}

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const ym = (iso) => String(iso).slice(0, 7);
const today = () => new Date().toISOString().slice(0, 10);
function monthGrid(month) {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const start = new Date(first); start.setUTCDate(1 - ((first.getUTCDay() + 6) % 7));
  return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setUTCDate(start.getUTCDate() + i); return d.toISOString().slice(0, 10); });
}
const shift = (month, n) => { const [y, m] = month.split("-").map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); return d.toISOString().slice(0, 7); };
const monthName = (month) => new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

const box = { background: C.panel, border: `1px solid ${C.line}`, borderRadius: R.card, padding: S.lg };
const btn = { fontFamily: "inherit", fontSize: F.sm, fontWeight: 600, color: C.text, background: C.panel, border: `1px solid ${C.line}`, borderRadius: R.control, padding: "4px 12px", cursor: "pointer" };
const field = { fontFamily: "inherit", fontSize: F.sm, color: C.text, background: C.field, border: `1px solid ${C.line}`, borderRadius: R.control, padding: "4px 8px" };

export default function BlogCalendar({ initial, build = "", canPublish = false }) {
  const [cal, setCal] = useState(initial);
  const [month, setMonth] = useState(ym(today()));
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  /* Where the last message belongs: a draft's slug, an idea's id, or "" for
     the top. A Publish error shown only at the top of the calendar was off
     screen from the button that caused it, so pressing looked like nothing. */
  const [msgAt, setMsgAt] = useState("");
  const [armed, setArmed] = useState("");
  const [text, setText] = useState("");
  const [week, setWeek] = useState("");

  async function act(action, payload = {}, at = "") {
    setBusy(action); setMsg(""); setMsgAt(at);
    try {
      const res = await fetch("/api/admin/blog", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, build, ...payload }) });
      if (!res.ok) { setMsg(await res.text()); return false; }
      const d = await res.json();
      setCal(d.calendar);
      if (d.sha) setMsg(`Committed ${d.sha.slice(0, 7)}. Vercel deploys it in a minute or two.`);
      if (d.added !== undefined) setMsg(`${d.added} idea${d.added === 1 ? "" : "s"} added to the queue.${d.dropped?.length ? ` Dropped: ${d.dropped.join("; ")}.` : ""}`);
      return true;
    } catch (e) { setMsg(String(e.message || e)); return false; } finally { setBusy(""); }
  }

  const drafts = cal.posts.filter((p) => p.draft);
  const live = cal.posts.filter((p) => !p.draft);
  const openIdeas = cal.ideas.filter((i) => !["shipped", "dropped"].includes(i.status));
  const closedIdeas = cal.ideas.filter((i) => ["shipped", "dropped"].includes(i.status));

  const byDay = useMemo(() => {
    const m = {};
    const put = (d, item) => { (m[d] = m[d] || []).push(item); };
    for (const p of live) put(p.date, { kind: "published", key: `p:${p.slug}`, label: p.title, href: `/blog/${p.slug}` });
    for (const p of drafts) if (p.target) put(p.target, { kind: "draft", key: `d:${p.slug}`, label: p.title, slug: p.slug });
    for (const i of openIdeas) if (i.targetWeek) put(i.targetWeek, { kind: "idea", key: `i:${i.id}`, label: i.title, id: i.id });
    return m;
  }, [cal]);

  const onDrop = async (day, e) => {
    e.preventDefault();
    const k = e.dataTransfer.getData("text/plain");
    if (k.startsWith("d:")) await act("schedule-post", { slug: k.slice(2), date: day });
    if (k.startsWith("i:")) await act("schedule-idea", { id: k.slice(2), week: mondayOf(day) });
  };
  const drag = (key) => ({ draggable: true, onDragStart: (e) => e.dataTransfer.setData("text/plain", key) });
  const tone = { published: { background: C.subtle, color: C.text }, draft: { background: C.text, color: C.bg }, idea: { background: "transparent", color: C.muted, border: `1px dashed ${C.edge}` } };

  const s = cal.search;
  const t = today();

  return (
    <section id="blog-calendar" data-panel="work" style={{ marginTop: S.xl }}>
      <h2 style={{ fontSize: F.lg, fontWeight: 700, margin: 0, letterSpacing: TRACK.tight }}>Blog calendar</h2>
      <p style={{ fontSize: F.sm, color: C.muted, margin: `${S.xs}px 0 0`, lineHeight: 1.5 }}>
        Posts are files in lib/posts. A target date is a plan: on the day, Publish runs the readiness check and commits the file. Nothing publishes on its own.{" "}
        {cal.published} published, {drafts.length} in draft, {openIdeas.length} open {openIdeas.length === 1 ? "idea" : "ideas"}.
      </p>
      {msg && !msgAt && <p role="status" style={{ fontSize: F.sm, color: C.text, margin: `${S.sm}px 0 0` }}>{msg}</p>}

      {/* The month */}
      <div style={{ ...box, marginTop: S.md }}>
        <div className="flex items-center" style={{ gap: S.sm }}>
          <button type="button" style={btn} onClick={() => setMonth(shift(month, -1))} aria-label="Previous month">Prev</button>
          <strong style={{ fontSize: F.md, minWidth: 160, textAlign: "center" }}>{monthName(month)}</strong>
          <button type="button" style={btn} onClick={() => setMonth(shift(month, 1))} aria-label="Next month">Next</button>
          <button type="button" style={{ ...btn, marginLeft: "auto" }} onClick={() => setMonth(ym(t))}>This month</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 2, marginTop: S.sm }}>
          {DAY_NAMES.map((d) => <div key={d} style={{ fontSize: F.xs, color: C.dim, padding: "2px 4px" }}>{d}</div>)}
          {monthGrid(month).map((day) => (
            <div key={day} onDragOver={(e) => e.preventDefault()} onDrop={(e) => onDrop(day, e)}
              style={{
                minHeight: 74, padding: 4, borderRadius: 4, border: `1px solid ${day === t ? C.text : C.line}`,
                background: ym(day) === month ? C.bg : "transparent", opacity: ym(day) === month ? 1 : 0.5,
              }}>
              <div style={{ fontSize: F.xs, color: C.dim }}>{Number(day.slice(8))}</div>
              {(byDay[day] || []).map((it) => (
                <div key={it.key} {...(it.kind === "published" ? {} : drag(it.key))} title={`${it.kind}: ${it.label}`}
                  style={{ ...tone[it.kind], fontSize: 11, lineHeight: 1.3, borderRadius: 3, padding: "1px 4px", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: it.kind === "published" ? "default" : "grab" }}>
                  {it.kind === "published" ? <a href={it.href} style={{ color: "inherit", textDecoration: "none" }}>{it.label}</a> : `${it.kind === "idea" ? "Week of: " : ""}${it.label}`}
                </div>
              ))}
            </div>
          ))}
        </div>
        <p style={{ fontSize: F.xs, color: C.dim, margin: `${S.sm}px 0 0` }}>
          Filled grey: published. Dark: a draft on its target date. Dashed: an idea, on the Monday of its target week. Drag a draft or an idea to another day, by the handle beside its name in the lists below.
        </p>
      </div>

      {/* Drafts */}
      <div style={{ ...box, marginTop: S.md }}>
        <strong style={{ fontSize: F.md }}>Drafts</strong>
        {!drafts.length && <p style={{ fontSize: F.sm, color: C.muted, margin: `${S.xs}px 0 0` }}>No post is in draft. A post becomes one by being written into lib/posts with draft: true.</p>}
        {drafts.map((p) => (
          <div key={p.slug} style={{ borderTop: `1px solid ${C.line}`, marginTop: S.sm, paddingTop: S.sm }}>
            <div className="flex flex-wrap items-center" style={{ gap: S.sm }}>
              <Handle drag={drag(`d:${p.slug}`)} label={p.title} />
              <strong style={{ fontSize: F.sm }}>{p.title}</strong>
              <label style={{ fontSize: F.xs, color: C.muted }}>Target <DateField value={p.target} onSave={(d) => act("schedule-post", { slug: p.slug, date: d }, p.slug)} /></label>
              {p.target && p.target <= t && <span style={{ fontSize: F.xs, fontWeight: 700 }}>{p.target === t ? "Due today" : `Due since ${formatDay(p.target)}`}</span>}
            </div>
            <p style={{ fontSize: F.xs, color: C.dim, margin: `${S.xs}px 0 0` }}>{p.file || "no file mapped"}</p>
            {msg && msgAt === p.slug && <p role="status" style={{ fontSize: F.sm, color: C.text, fontWeight: 600, margin: `${S.xs}px 0 0` }}>{msg}</p>}
            {p.problems.length > 0
              ? <ul style={{ margin: `${S.xs}px 0 0`, paddingLeft: S.lg, fontSize: F.xs, color: C.warnInk }}>{p.problems.map((x) => <li key={x}>{x}</li>)}</ul>
              : <p style={{ fontSize: F.xs, color: C.muted, margin: `${S.xs}px 0 0` }}>The mechanical checks pass. Whether it is right is still yours to judge.</p>}
            <div style={{ marginTop: S.xs }}>
              {!canPublish ? <span style={{ fontSize: F.xs, color: C.muted }}>GITHUB_TOKEN is not set, so publishing is the hand edit: remove draft: true and set date.</span>
                : armed === p.slug
                  ? <>
                      <span style={{ fontSize: F.xs, color: C.text }}>Commits {p.file}: removes draft: true and sets date to {formatDay(t)}. </span>
                      <button type="button" style={{ ...btn, background: C.accent, color: C.onAccent, borderColor: C.accent }} disabled={busy === "publish-post" || p.problems.length > 0}
                        onClick={async () => { await act("publish-post", { slug: p.slug, title: p.title }, p.slug); setArmed(""); }}>{busy === "publish-post" ? "Publishing…" : "Publish now"}</button>
                      <button type="button" style={{ ...btn, marginLeft: S.xs }} onClick={() => setArmed("")}>Cancel</button>
                    </>
                  : <button type="button" style={btn} disabled={p.problems.length > 0} title={p.problems.length ? "Fix what is listed first" : ""} onClick={() => setArmed(p.slug)}>Publish</button>}
            </div>
          </div>
        ))}
      </div>

      {/* Blog ideas: the post review, a week, the draft it became */}
      <div style={{ ...box, marginTop: S.md }} id="blog-ideas">
        <strong style={{ fontSize: F.md }}>Blog ideas</strong>
        <p style={{ fontSize: F.xs, color: C.dim, margin: `${S.xs}px 0 0` }}>
          Posts to write. Each is reviewed as a post: is it already written, which listings it rests on, what only this directory can say, and what to read first. Not as a feature, so no invariants and no build size. A week puts it on the calendar. Linking its draft marks it shipped when the draft is published.
        </p>
        {!openIdeas.length && <p style={{ fontSize: F.sm, color: C.muted, margin: `${S.xs}px 0 0` }}>No open blog idea.</p>}
        {openIdeas.map((i) => <IdeaRow key={i.id} i={i} drafts={drafts} live={live} busy={busy} act={act} drag={drag(`i:${i.id}`)} msg={msgAt === i.id ? msg : ""} />)}
        <form onSubmit={async (e) => { e.preventDefault(); if (await act("add-idea", { text, week })) { setText(""); setWeek(""); } }}
          className="flex flex-wrap items-center" style={{ gap: S.sm, marginTop: S.md }}>
          <input style={{ ...field, flex: 1, minWidth: 260 }} placeholder="A post to write: the title and one line on the angle" value={text} onChange={(e) => setText(e.target.value)} />
          <label style={{ fontSize: F.xs, color: C.muted }}>Week of <DateField value={week} onSave={setWeek} /></label>
          <button type="submit" style={btn} disabled={busy === "add-idea" || text.trim().length < 10}>Add idea</button>
        </form>
        {closedIdeas.length > 0 && (
          <details style={{ marginTop: S.md }}>
            <summary style={{ fontSize: F.sm, cursor: "pointer", color: C.muted }}>Written and dropped ({closedIdeas.length})</summary>
            {closedIdeas.map((i) => (
              <p key={i.id} style={{ fontSize: F.xs, color: C.muted, margin: `${S.xs}px 0 0` }}>
                <strong style={{ color: C.text }}>{i.title}</strong>{" "}
                {i.status === "shipped" && i.postSlug ? <>written as <a href={`/blog/${i.postSlug}`} style={{ color: C.text }}>/blog/{i.postSlug}</a></> : i.status === "dropped" ? `dropped${i.dropped?.reason ? `: ${i.dropped.reason}` : ""}` : i.status}{" "}
                <button type="button" style={{ ...btn, fontSize: F.xs, padding: "0 8px" }} disabled={busy === "reopen-idea"} onClick={() => act("reopen-idea", { id: i.id })}>Reopen</button>
              </p>
            ))}
          </details>
        )}
      </div>

      {/* Search Console */}
      <div style={{ ...box, marginTop: S.md }}>
        <strong style={{ fontSize: F.md }}>What Search Console says a post could win</strong>
        <p style={{ fontSize: F.sm, color: C.text, margin: `${S.xs}px 0 0`, lineHeight: 1.55 }}>
          Read this knowing how little there is. The site went live on {cal.context.launched}. {s.firstPull ? `Search Console was first pulled on ${formatDay(s.firstPull.slice(0, 10))}.` : "Nothing has been pulled from Search Console yet."} {cal.context.noindexed.total} pages are kept out of the index until their structured data is confirmed ({cal.context.noindexed.compare} head-to-heads, {cal.context.noindexed.alternatives} alternatives pages), so Google sees a fraction of the site.
        </p>
        {!s.configured && <p style={{ fontSize: F.sm, color: C.warnInk, margin: `${S.sm}px 0 0` }}>Not configured. Set GSC_CLIENT_EMAIL, GSC_PRIVATE_KEY and GSC_SITE in Vercel, and add the service account as a user on the Search Console property.</p>}
        {s.error && <p style={{ fontSize: F.sm, color: C.warnInk, margin: `${S.sm}px 0 0` }}>The last pull failed on {formatDay(String(s.error.at).slice(0, 10))}: {s.error.message}</p>}
        {s.totals && <p className="tnum" style={{ fontSize: F.sm, color: C.muted, margin: `${S.sm}px 0 0` }}>{s.range}: {s.totals.queries} queries, {s.totals.impressions.toLocaleString("en-US")} impressions, {s.totals.clicks} clicks. Pulled {formatDay(s.fetchedAt.slice(0, 10))}, weekly on Tuesdays.</p>}
        {s.thin?.thin && (
          /* What is actually blocking it, and where the fix is. */
          <div style={{ marginTop: S.sm, padding: S.md, borderRadius: R.control, background: C.subtle }}>
            <p style={{ fontSize: F.sm, color: C.text, margin: 0, fontWeight: 600 }}>
              No posts are proposed yet. Google sees too little of the site to rank it for much: {cal.context.noindexed.total} pages are noindexed until their details are confirmed, and {cal.context.toConfirm} {cal.context.toConfirm === 1 ? "tool still needs" : "tools still need"} confirming.
            </p>
            <p style={{ fontSize: F.sm, margin: `${S.xs}px 0 0` }}>
              <a href={cal.context.confirmHref} style={{ color: C.text, fontWeight: 700 }}>Confirm tool details</a>
              <span style={{ color: C.muted }}> on the Listings tab. Each tool confirmed with a rival lets its head-to-head and alternatives pages be indexed.</span>
            </p>
            <p style={{ fontSize: F.xs, color: C.dim, margin: `${S.xs}px 0 0` }}>{s.thin.why}</p>
          </div>
        )}

        {s.groups && [["No clicks yet", "Shown and never clicked: a post could win something Google already shows.", s.groups.noClicks],
          ["Ranking 5 to 20", "Close enough that a better page could move it onto the first screen.", s.groups.nearTop],
          ["No page about it", "Shown, and nothing on the site is about it.", s.groups.noPage]].map(([title, hint, rows]) => (
          <details key={title} style={{ marginTop: S.sm }}>
            <summary style={{ fontSize: F.sm, cursor: "pointer" }}>{title} ({rows.length})</summary>
            <p style={{ fontSize: F.xs, color: C.dim, margin: `${S.xs}px 0 0` }}>{hint}</p>
            {rows.length ? (
              <table className="tnum" style={{ fontSize: F.xs, borderCollapse: "collapse", marginTop: S.xs }}>
                <thead><tr>{["Query", "Impressions", "Clicks", "Position"].map((h) => <th key={h} style={{ textAlign: "left", padding: "2px 12px 2px 0", color: C.muted }}>{h}</th>)}</tr></thead>
                <tbody>{rows.map((q) => <tr key={q.query}><td style={{ padding: "2px 12px 2px 0" }}>{q.query}</td><td>{q.impressions}</td><td>{q.clicks}</td><td>{q.position}</td></tr>)}</tbody>
              </table>
            ) : <p style={{ fontSize: F.xs, color: C.muted, margin: `${S.xs}px 0 0` }}>None with enough impressions to count.</p>}
          </details>
        ))}

        <div className="flex flex-wrap items-center" style={{ gap: S.sm, marginTop: S.md }}>
          <button type="button" style={btn} disabled={!s.configured || busy === "pull-search"} onClick={() => act("pull-search")}>{busy === "pull-search" ? "Pulling" : "Pull now"}</button>
          <button type="button" style={btn} disabled={!s.groups || s.thin?.thin || busy === "propose"} title={s.thin?.thin ? s.thin.why : ""} onClick={() => act("propose")}>{busy === "propose" ? "Proposing" : "Propose posts from these"}</button>
          <span style={{ fontSize: F.xs, color: C.dim }}>Proposals land in the Ideas queue as blog ideas, each citing its query and numbers, for you to keep or drop.</span>
        </div>
      </div>
    </section>
  );
}

const VERDICT_LABEL = { write: "Worth writing", doubtful: "Doubtful", skip: "Do not write" };

/* One blog idea: its week, its evidence, its post review, and what to do with it. */
function IdeaRow({ i, drafts, live, busy, act, drag, msg }) {
  const [dropping, setDropping] = useState(false);
  const [reason, setReason] = useState("");
  const [copied, setCopied] = useState("");
  const r = i.review;
  const full = i.text && i.text.trim() !== i.title ? i.text.trim() : "";
  const copy = async () => { setCopied((await copyText(ideaAsText(i))) ? "Copied" : "The browser refused the clipboard"); setTimeout(() => setCopied(""), 2000); };
  return (
    <div style={{ borderTop: `1px solid ${C.line}`, marginTop: S.sm, paddingTop: S.sm }}>
      <div className="flex flex-wrap items-center" style={{ gap: S.sm }}>
        <Handle drag={drag} label={i.title} />
        <span style={{ fontSize: F.sm, fontWeight: 600 }}>{i.title}</span>
        {i.source === "search-console" && <span style={{ fontSize: F.xs, color: C.muted }}>from Search Console</span>}
        {i.cameFromIdeas && <span style={{ fontSize: F.xs, color: C.muted }}>moved from Ideas</span>}
        <label style={{ fontSize: F.xs, color: C.muted }}>Week of <DateField value={i.targetWeek} onSave={(d) => act("schedule-idea", { id: i.id, week: d }, i.id)} /></label>
      </div>
      {full && <p style={{ fontSize: F.sm, color: C.text, margin: `${S.xs}px 0 0`, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{full}</p>}
      {i.evidence && <p style={{ fontSize: F.xs, color: C.dim, margin: `${S.xs}px 0 0` }}>"{i.evidence.query}": {i.evidence.impressions} impressions, {i.evidence.clicks} clicks, position {i.evidence.position}{i.evidence.range ? `, ${i.evidence.range}` : ""}.</p>}
      {r && (
        <div style={{ fontSize: F.xs, color: C.muted, margin: `${S.xs}px 0 0`, lineHeight: 1.55 }}>
          <span style={{ color: C.text, fontWeight: 700 }}>{VERDICT_LABEL[r.verdict] || r.verdict}. </span>{r.summary}
          {r.coveredBy?.length > 0 && <div>Already covered by {r.coveredBy.map((c) => <a key={c.slug} href={`/blog/${c.slug}`} style={{ color: C.text }}>/blog/{c.slug}</a>)}: {r.coveredBy.map((c) => c.how).join(" ")}</div>}
          {r.repeats?.length > 0 && <div>Repeats {r.repeats.map((x) => x.id).join(", ")}: {r.repeats.map((x) => x.how).join(" ")}</div>}
          {r.listings?.length > 0 && <div>Rests on {r.listings.length} listings: {r.listings.map((id, k) => <React.Fragment key={id}>{k ? ", " : ""}<a href={`/tools/${id}`} style={{ color: C.text }}>{id}</a></React.Fragment>)}</div>}
          {r.onlyHere && <div>Only here: {r.onlyHere}</div>}
          {r.readFirst?.length > 0 && <div>Read first: {r.readFirst.join("; ")}</div>}
          {r.reader && <div>Who searches: {r.reader}</div>}
          {r.objections?.length > 0 && <div>Objections: {r.objections.join("; ")}</div>}
          {r.dropped?.length > 0 && <div style={{ color: C.dim }}>Dropped from the answer: {r.dropped.join("; ")}</div>}
          <div style={{ color: C.dim }}>Reviewed {String(r.at || "").slice(0, 10)}{r.provider ? ` by ${r.provider}` : ""}. Advisory.</div>
        </div>
      )}
      <div className="flex flex-wrap items-center" style={{ gap: S.sm, marginTop: S.xs }}>
        <button type="button" style={btn} onClick={copy} title="Copies the idea and its latest review as plain text">{copied || "Copy"}</button>
        <button type="button" style={btn} disabled={busy === "review-idea"} onClick={() => act("review-idea", { id: i.id })}>{r ? "Review again" : "Review as a post"}</button>
        {(drafts.length > 0 || live.length > 0) && (
          <label style={{ fontSize: F.xs, color: C.muted }} title="A draft ships this idea when the draft is published. A published post ships it now.">Post it became{" "}
            <select style={field} value={i.postSlug} onChange={(e) => act("link-post", { id: i.id, slug: e.target.value }, i.id)}>
              <option value="">none yet</option>
              {drafts.length > 0 && <optgroup label="Drafts: ships when published">{drafts.map((d) => <option key={d.slug} value={d.slug}>{d.title}</option>)}</optgroup>}
              {live.length > 0 && <optgroup label="Published: ships now">{live.map((d) => <option key={d.slug} value={d.slug}>{d.title}</option>)}</optgroup>}
            </select>
          </label>
        )}
        {i.postSlug && drafts.some((d) => d.slug === i.postSlug) && <span style={{ fontSize: F.xs, color: C.muted }}>Ships when that draft is published.</span>}
        {dropping
          ? <>
              <input style={{ ...field, minWidth: 220 }} placeholder="Why it is dropped" value={reason} onChange={(e) => setReason(e.target.value)} />
              <button type="button" style={btn} disabled={reason.trim().length < 5} onClick={async () => { if (await act("drop-idea", { id: i.id, reason })) setDropping(false); }}>Drop it</button>
              <button type="button" style={btn} onClick={() => setDropping(false)}>Cancel</button>
            </>
          : <button type="button" style={btn} onClick={() => setDropping(true)}>Drop</button>}
      </div>
      {msg && <p role="status" style={{ fontSize: F.sm, color: C.text, fontWeight: 600, margin: `${S.xs}px 0 0` }}>{msg}</p>}
    </div>
  );
}

/*
 * A date field that saves a whole date, never a keystroke. Typing "2026" into
 * a native date input passes through years 0002, 0020 and 0202, and saving on
 * every change stored those (2026-11-15). It keeps what is typed locally and
 * saves when the year is plausible, or on leaving the field; the picker gives
 * a whole date at once and saves straight away.
 */
const plausible = (v) => /^(20\d\d)-\d\d-\d\d$/.test(v);
function DateField({ value = "", onSave }) {
  const [v, setV] = useState(value);
  const [saved, setSaved] = useState(value);
  if (value !== saved) { setSaved(value); setV(value); }
  const save = (x) => { if (x === saved) return; if (x === "" || plausible(x)) onSave(x); else setV(saved); };
  return (
    <input type="date" style={field} value={v} min="2020-01-01" max="2099-12-31"
      onChange={(e) => { const x = e.target.value; setV(x); if (x === "" || plausible(x)) save(x); }}
      onBlur={() => save(v)}
      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); save(v); } }} />
  );
}
