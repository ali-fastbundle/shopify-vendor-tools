"use client";

import { useMemo, useState } from "react";
import { C, S, R, F, TRACK, formatDay } from "@/lib/tools";
import { mondayOf } from "@/lib/ideas";

/*
 * The blog calendar on /admin (Write tab). Not a CMS: posts are files in
 * lib/posts, and the one way one goes live is Publish here or on the Drafts
 * path, which runs the readiness check and commits the file. A target date is
 * a plan. Nothing publishes on its own. No editor, no media library.
 *
 * Drag a draft or an idea onto a day to move it. Every item also has a date
 * field, because dragging is not something everyone can do.
 */
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
  const [armed, setArmed] = useState("");
  const [text, setText] = useState("");
  const [week, setWeek] = useState("");

  async function act(action, payload = {}) {
    setBusy(action); setMsg("");
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
  const undated = openIdeas.filter((i) => !i.targetWeek);

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
      {msg && <p role="status" style={{ fontSize: F.sm, color: C.text, margin: `${S.sm}px 0 0` }}>{msg}</p>}

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
          Filled grey: published. Dark: a draft on its target date. Dashed: an idea, on the Monday of its target week. Drag a draft or an idea to another day.
        </p>
      </div>

      {/* Drafts */}
      <div style={{ ...box, marginTop: S.md }}>
        <strong style={{ fontSize: F.md }}>Drafts</strong>
        {!drafts.length && <p style={{ fontSize: F.sm, color: C.muted, margin: `${S.xs}px 0 0` }}>No post is in draft. A post becomes one by being written into lib/posts with draft: true.</p>}
        {drafts.map((p) => (
          <div key={p.slug} style={{ borderTop: `1px solid ${C.line}`, marginTop: S.sm, paddingTop: S.sm }} {...drag(`d:${p.slug}`)}>
            <div className="flex flex-wrap items-center" style={{ gap: S.sm }}>
              <strong style={{ fontSize: F.sm }}>{p.title}</strong>
              <label style={{ fontSize: F.xs, color: C.muted }}>Target <input type="date" style={field} value={p.target} onChange={(e) => act("schedule-post", { slug: p.slug, date: e.target.value })} /></label>
              {p.target && p.target <= t && <span style={{ fontSize: F.xs, fontWeight: 700 }}>{p.target === t ? "Due today" : `Due since ${formatDay(p.target)}`}</span>}
            </div>
            <p style={{ fontSize: F.xs, color: C.dim, margin: `${S.xs}px 0 0` }}>{p.file || "no file mapped"}</p>
            {p.problems.length > 0
              ? <ul style={{ margin: `${S.xs}px 0 0`, paddingLeft: S.lg, fontSize: F.xs, color: C.warnInk }}>{p.problems.map((x) => <li key={x}>{x}</li>)}</ul>
              : <p style={{ fontSize: F.xs, color: C.muted, margin: `${S.xs}px 0 0` }}>The mechanical checks pass. Whether it is right is still yours to judge.</p>}
            <div style={{ marginTop: S.xs }}>
              {!canPublish ? <span style={{ fontSize: F.xs, color: C.muted }}>GITHUB_TOKEN is not set, so publishing is the hand edit: remove draft: true and set date.</span>
                : armed === p.slug
                  ? <>
                      <span style={{ fontSize: F.xs, color: C.text }}>Commits {p.file}: removes draft: true and sets date to {formatDay(t)}. </span>
                      <button type="button" style={{ ...btn, background: C.accent, color: C.onAccent, borderColor: C.accent }} disabled={busy === "publish-post" || p.problems.length > 0}
                        onClick={async () => { await act("publish-post", { slug: p.slug, title: p.title }); setArmed(""); }}>Publish now</button>
                      <button type="button" style={{ ...btn, marginLeft: S.xs }} onClick={() => setArmed("")}>Cancel</button>
                    </>
                  : <button type="button" style={btn} disabled={p.problems.length > 0} title={p.problems.length ? "Fix what is listed first" : ""} onClick={() => setArmed(p.slug)}>Publish</button>}
            </div>
          </div>
        ))}
      </div>

      {/* Ideas with no date */}
      <div style={{ ...box, marginTop: S.md }}>
        <strong style={{ fontSize: F.md }}>Blog ideas with no date yet</strong>
        <p style={{ fontSize: F.xs, color: C.dim, margin: `${S.xs}px 0 0` }}>The same queue as Ideas below, type blog. Give one a target week to put it on the calendar.</p>
        {!undated.length && <p style={{ fontSize: F.sm, color: C.muted, margin: `${S.xs}px 0 0` }}>Every open blog idea has a week.</p>}
        {undated.map((i) => (
          <div key={i.id} {...drag(`i:${i.id}`)} style={{ borderTop: `1px solid ${C.line}`, marginTop: S.sm, paddingTop: S.sm }}>
            <div className="flex flex-wrap items-center" style={{ gap: S.sm }}>
              <span style={{ fontSize: F.sm, fontWeight: 600 }}>{i.title}</span>
              {i.source === "search-console" && <span style={{ fontSize: F.xs, color: C.muted }}>from Search Console</span>}
              <label style={{ fontSize: F.xs, color: C.muted }}>Week of <input type="date" style={field} onChange={(e) => e.target.value && act("schedule-idea", { id: i.id, week: e.target.value })} /></label>
            </div>
            {i.evidence && <p style={{ fontSize: F.xs, color: C.dim, margin: `${S.xs}px 0 0` }}>"{i.evidence.query}": {i.evidence.impressions} impressions, {i.evidence.clicks} clicks, position {i.evidence.position}{i.evidence.range ? `, ${i.evidence.range}` : ""}.</p>}
          </div>
        ))}
        <form onSubmit={async (e) => { e.preventDefault(); if (await act("add-idea", { text, week })) { setText(""); setWeek(""); } }}
          className="flex flex-wrap items-center" style={{ gap: S.sm, marginTop: S.md }}>
          <input style={{ ...field, flex: 1, minWidth: 260 }} placeholder="A post to write: the title and one line on the angle" value={text} onChange={(e) => setText(e.target.value)} />
          <label style={{ fontSize: F.xs, color: C.muted }}>Week of <input type="date" style={field} value={week} onChange={(e) => setWeek(e.target.value)} /></label>
          <button type="submit" style={btn} disabled={busy === "add-idea" || text.trim().length < 10}>Add idea</button>
        </form>
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
        {s.thin?.thin && <p style={{ fontSize: F.sm, color: C.text, margin: `${S.sm}px 0 0`, fontWeight: 600 }}>Too thin to propose posts from. {s.thin.why}</p>}

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
