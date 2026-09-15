"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { C, CATEGORIES, TOOLS, RESOURCE_KINDS, REPORT_KINDS, reportKindOf, catOf, kindOf, LAST_UPDATED, AUTHOR, AUTHOR_URL } from "@/lib/tools";
import { AccountBar, OwnerPanel, useSession } from "./Account";

/* ================================================================== */
/*  Bits                                                               */
/* ================================================================== */
/*
 * The mark is the CATEGORIES colours in catalogue order — every one of them, so
 * adding a category widens the mark rather than breaking it. Category colour
 * is information everywhere else on the page, so the logo doubles as the legend
 * and the palette stays closed — the green in "Tools" is the `aso` colour, not a
 * new accent. app/icon.svg and the share card draw the same mark.
 */
/*
 * Directory counters, buffered in the browser.
 *
 * One request per tool opened would be a write per page view, which is exactly
 * what we are not doing — page traffic belongs to Vercel Analytics. Events
 * accumulate here and go out together: on a short timer, and on the way out of
 * the tab, where sendBeacon survives the page being closed and fetch does not.
 *
 * Nothing identifying is collected. A matcher query is kept as text because
 * what people ask for is the useful signal; it is never paired with a session
 * or an address.
 */
const statQueue = { tools: [], matcher: 0, queries: [] };
let statTimer = null;

function flushStats() {
  if (typeof window === "undefined") return;
  if (statTimer) { clearTimeout(statTimer); statTimer = null; }
  if (!statQueue.tools.length && !statQueue.matcher && !statQueue.queries.length) return;

  const payload = JSON.stringify(statQueue);
  statQueue.tools = []; statQueue.matcher = 0; statQueue.queries = [];

  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/stat", new Blob([payload], { type: "application/json" }));
      return;
    }
  } catch { /* fall through to fetch */ }
  // keepalive so a flush started during unload is still allowed to finish.
  fetch("/api/stat", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: payload, keepalive: true,
  }).catch(() => {});
}

function scheduleFlush() {
  if (typeof window === "undefined" || statTimer) return;
  statTimer = setTimeout(flushStats, 8000);
}

function trackToolOpen(id) {
  if (!id) return;
  statQueue.tools.push(id);
  scheduleFlush();
}

function trackMatcher(query) {
  statQueue.matcher += 1;
  const q = String(query || "").trim();
  if (q) statQueue.queries.push(q.slice(0, 160));
  scheduleFlush();
}

if (typeof window !== "undefined") {
  // visibilitychange fires on tab switch and on close; pagehide covers Safari.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushStats();
  });
  window.addEventListener("pagehide", flushStats);
}

function Wordmark() {
  return (
    <div className="flex items-center" style={{ gap: 9 }}>
      <span className="flex" style={{ gap: 2 }} aria-hidden="true">
        {CATEGORIES.map((c) => (
          <span key={c.id} style={{ width: 3, height: 16, borderRadius: 1.5, background: c.color, display: "inline-block" }} />
        ))}
      </span>
      <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1, whiteSpace: "nowrap" }}>
        Watch For <span style={{ color: "#00E08A" }}>Tools</span>
      </span>
    </div>
  );
}

function Logo({ tool, size = 34 }) {
  const [failed, setFailed] = useState(false);
  const color = catOf(tool.cat).color;
  if (failed) {
    return (
      <div
        style={{
          width: size, height: size, borderRadius: 8, flexShrink: 0,
          background: color + "22", color,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontWeight: 700, fontSize: size * 0.42, letterSpacing: "-0.02em",
        }}
      >
        {tool.name.slice(0, 2)}
      </div>
    );
  }
  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${tool.domain}&sz=128`}
      alt=""
      onError={() => setFailed(true)}
      style={{
        width: size, height: size, borderRadius: 8, flexShrink: 0,
        background: "#FFFFFF", objectFit: "contain", padding: 4,
      }}
    />
  );
}

function Stars({ value, onPick, size = 14 }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <span className="inline-flex items-center" style={{ gap: 1 }}>
      {[1, 2, 3, 4, 5].map((n) => {
        const on = n <= shown;
        const s = { fontSize: size, lineHeight: 1, color: on ? "#FFC93C" : "rgba(255,255,255,0.18)" };
        if (!onPick) return <span key={n} style={s}>★</span>;
        return (
          <button key={n} type="button" aria-label={`${n} star`}
            onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)}
            onClick={() => onPick(n)}
            className="cursor-pointer border-0 bg-transparent p-0" style={s}>★</button>
        );
      })}
    </span>
  );
}

/*
 * Third-party scores, shown beside the directory's own rating and never folded
 * into it. G2 and the directory measure different populations, so averaging the
 * two would invent a figure neither source reported.
 *
 * Score, count, source and link only — the reviews themselves are the platform's
 * copyright, so we cite the aggregate and send people there to read them. The
 * capture date rides along because an external score with no date on it is the
 * one most likely to be quietly years old.
 */
function ExternalRatings({ ratings, detail = false }) {
  if (!ratings || !ratings.length) return null;
  return (
    <div className="flex flex-wrap items-center" style={{ gap: detail ? 14 : 10 }}>
      {ratings.map((r) => (
        <a key={`${r.source}${r.url}`} href={r.url} target="_blank" rel="noopener noreferrer"
          title={`${r.source}: ${r.score == null ? "score not captured" : `${r.score} out of ${r.outOf ?? 5}`}${r.count ? `, ${r.count} reviews` : ""}${r.captured ? `, captured ${r.captured}` : ""}`}
          style={{
            fontSize: detail ? 13 : 11.5, color: C.dim, textDecoration: "none",
            display: "inline-flex", alignItems: "baseline", gap: 4, whiteSpace: "nowrap",
          }}>
          {/* out of 5 is the common case and stays implicit; anything else is spelled out
              so a 9.2 from a ten-point scale cannot read as a five-point score. A source
              with a review count but no score captured shows the count alone rather than
              an empty slot where a number should be. */}
          {r.score != null && (
            <span style={{ fontWeight: 700, color: C.muted }}>
              {r.score}{r.outOf && r.outOf !== 5 ? `/${r.outOf}` : ""}
            </span>
          )}
          <span>{r.source}</span>
          {Boolean(r.count) && <span>({r.count})</span>}
          {detail && r.captured && <span style={{ opacity: 0.75 }}>· {r.captured}</span>}
        </a>
      ))}
    </div>
  );
}

function Pill({ color, children, solid }) {
  return (
    <span style={{
      fontSize: 11, lineHeight: 1.6, padding: "1px 7px", borderRadius: 999,
      color: solid ? "#06110D" : color,
      background: solid ? color : color + "1E",
      border: `1px solid ${color}${solid ? "" : "44"}`,
      whiteSpace: "nowrap", fontWeight: solid ? 700 : 500,
    }}>{children}</span>
  );
}

function Social({ social, size = 15 }) {
  const items = [
    ["li", "in", social.li],
    ["x", "𝕏", social.x],
    ["gh", "GH", social.gh],
  ].filter((i) => i[2]);
  if (!items.length) return <span style={{ fontSize: 11, color: C.dim }}>no public profile</span>;
  return (
    <span className="inline-flex items-center" style={{ gap: 6 }}>
      {items.map(([k, label, href]) => (
        <a key={k} href={href} target="_blank" rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          title={k === "li" ? "LinkedIn" : k === "x" ? "X" : "GitHub"}
          style={{
            width: 22, height: 22, borderRadius: 5, display: "inline-flex",
            alignItems: "center", justifyContent: "center",
            border: `1px solid ${C.line}`, color: C.muted, fontSize: 11, fontWeight: 600,
            textDecoration: "none",
          }}>{label}</a>
      ))}
    </span>
  );
}

/* ================================================================== */
/*  Matcher                                                            */
/* ================================================================== */
const EXAMPLES = [
  "Mantle is shutting down and I need to replace my billing analytics",
  "I want to find stores running a competitor's app and pitch them",
  "I run six apps and need keyword tracking across all of them",
  "I want to launch an affiliate program without paying a cut of payouts",
  "I need App Store data my AI agent can query",
];

function localMatch(problem, tools = TOOLS) {
  const words = problem.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  return tools.map((t) => {
    const hay = (t.tags.join(" ") + " " + t.one + " " + t.note + " " + catOf(t.cat).label).toLowerCase();
    let score = 0;
    words.forEach((w) => {
      if (t.tags.some((tag) => tag.includes(w))) score += 3;
      else if (hay.includes(w)) score += 1;
    });
    if (t.dying) score -= 4;
    return { id: t.id, score };
  }).filter((r) => r.score > 0).sort((a, b) => b.score - a.score).slice(0, 4)
    .map((r) => ({ id: r.id, why: "Matched on what you described." }));
}

function Matcher({ tools, onOpen }) {
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  const [picks, setPicks] = useState(null);
  const [note, setNote] = useState("");

  async function run(text) {
    const q = (text ?? problem).trim();
    if (!q) return;
    trackMatcher(q);
    setBusy(true); setPicks(null); setNote("");
    try {
      const res = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problem: q }),
      });
      if (!res.ok) throw new Error("match failed");
      const parsed = await res.json();
      const valid = (parsed.picks || []).filter((p) => tools.some((t) => t.id === p.id));
      setPicks(valid.length ? valid : localMatch(q, tools));
      setNote(parsed.note || "");
    } catch {
      setPicks(localMatch(q, tools));
      setNote("");
    }
    setBusy(false);
  }

  return (
    <div style={{
      background: "linear-gradient(160deg, #10281F 0%, #0A1C16 100%)",
      border: `1px solid ${C.line}`, borderRadius: 14, padding: 22,
      boxShadow: "0 18px 50px rgba(0,0,0,0.45)",
    }}>
      <h2 style={{ fontSize: 19, fontWeight: 600, margin: 0, letterSpacing: "-0.015em" }}>
        What are you trying to solve?
      </h2>
      <p style={{ fontSize: 14, color: C.muted, margin: "6px 0 14px", lineHeight: 1.5, maxWidth: "58ch" }}>
        Describe the problem in your own words. You get back the tools that fit, with the reason.
      </p>

      <div className="flex flex-wrap" style={{ gap: 8 }}>
        <textarea
          value={problem}
          onChange={(e) => setProblem(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) run(); }}
          placeholder="We bill through Mantle and need somewhere to go before 30 September…"
          style={{
            flex: 1, minWidth: 240, minHeight: 68, resize: "vertical",
            background: "rgba(0,0,0,0.32)", border: `1px solid ${C.line}`, borderRadius: 10,
            padding: "11px 13px", fontSize: 14.5, color: C.text, fontFamily: "inherit", lineHeight: 1.5,
          }}
        />
        <button
          onClick={() => run()}
          disabled={busy || !problem.trim()}
          style={{
            alignSelf: "stretch", minWidth: 122, border: 0, borderRadius: 10,
            background: problem.trim() ? "#00E08A" : "rgba(255,255,255,0.08)",
            color: problem.trim() ? "#06110D" : C.dim,
            fontSize: 14.5, fontWeight: 700, cursor: problem.trim() && !busy ? "pointer" : "default",
            fontFamily: "inherit", padding: "0 18px",
          }}
        >
          {busy ? "Matching…" : "Find tools"}
        </button>
      </div>

      <div className="flex flex-wrap mt-3" style={{ gap: 6 }}>
        {EXAMPLES.map((e) => (
          <button key={e} onClick={() => { setProblem(e); run(e); }}
            style={{
              fontSize: 12, color: C.muted, background: "rgba(255,255,255,0.04)",
              border: `1px solid ${C.line}`, borderRadius: 999, padding: "4px 10px",
              cursor: "pointer", fontFamily: "inherit", textAlign: "left",
            }}>{e}</button>
        ))}
      </div>

      {picks && (
        <div className="mt-5">
          {note && <p style={{ fontSize: 14, color: C.text, marginBottom: 12, lineHeight: 1.5 }}>{note}</p>}
          {picks.length === 0 && (
            <p style={{ fontSize: 14, color: C.muted }}>
              Nothing here fits that well. Add what you are looking for in the Suggest tab and it goes on the list.
            </p>
          )}
          <div className="flex flex-col" style={{ gap: 10 }}>
            {picks.map((p) => {
              const t = tools.find((x) => x.id === p.id);
              const col = catOf(t.cat).color;
              return (
                <button key={p.id} onClick={() => onOpen(t.id)}
                  className="flex items-start text-left cursor-pointer"
                  style={{
                    gap: 12, background: "rgba(255,255,255,0.04)", border: `1px solid ${col}44`,
                    borderLeft: `3px solid ${col}`, borderRadius: 10, padding: 12, width: "100%",
                    fontFamily: "inherit", color: C.text,
                  }}>
                  <Logo tool={t} size={30} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="flex flex-wrap items-baseline" style={{ gap: 8 }}>
                      <span style={{ fontSize: 15.5, fontWeight: 600 }}>{t.name}</span>
                      <span style={{ fontSize: 12, color: col }}>{t.price}</span>
                    </span>
                    <span className="block mt-1" style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.5 }}>
                      {p.why}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  App                                                                */
/* ================================================================== */
export default function Directory({ tools: initialTools }) {
  const [tools, setTools] = useState(initialTools || TOOLS);
  const [session, refreshSession] = useSession();
  const [votes, setVotes] = useState({});
  const [reviews, setReviews] = useState({});
  const [mine, setMine] = useState({});
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [cat, setCat] = useState("all");
  const [q, setQ] = useState("");
  const [freeOnly, setFreeOnly] = useState(false);
  const [sort, setSort] = useState("rating");
  const [detail, setDetail] = useState(null);
  const [picked, setPicked] = useState([]);
  const [compare, setCompare] = useState(false);
  const [showSuggest, setShowSuggest] = useState(null);
  const gridRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/data", { cache: "no-store" });
        const d = await res.json();
        setVotes(d.votes || {});
        setReviews(d.reviews || {});
        setSuggestions(Array.isArray(d.suggestions) ? d.suggestions : []);
      } catch {
        setErr("Could not load community data. Ratings are read-only right now.");
      }
      try {
        const raw = localStorage.getItem("svt:mine");
        setMine(raw ? JSON.parse(raw) : {});
      } catch { setMine({}); }
      setLoading(false);
    })();
  }, []);

  async function post(path, body) {
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      setErr("");
      return await res.json();
    } catch (e) {
      setErr("That did not save. Try again in a moment.");
      return null;
    }
  }

  function vote(id, dir) {
    const prev = mine[id] || 0;
    const next = prev === dir ? 0 : dir;
    const cur = votes[id] || { up: 0, down: 0 };
    const upd = { ...cur };
    if (prev === 1) upd.up = Math.max(0, upd.up - 1);
    if (prev === -1) upd.down = Math.max(0, upd.down - 1);
    if (next === 1) upd.up += 1;
    if (next === -1) upd.down += 1;
    const nv = { ...votes, [id]: upd }, nm = { ...mine, [id]: next };
    setVotes(nv); setMine(nm);
    try { localStorage.setItem("svt:mine", JSON.stringify(nm)); } catch {}
    post("/api/vote", { id, previous: prev, next }).then((r) => {
      if (r && r.votes) setVotes(r.votes);
    });
  }

  function addReview(id, author, rating, text) {
    const e = {
      id: Date.now().toString(36), author: author.trim() || "Anonymous",
      rating, text: text.trim(), date: new Date().toISOString().slice(0, 10),
    };
    const nr = { ...reviews, [id]: [e, ...(reviews[id] || [])] };
    setReviews(nr);
    post("/api/review", { id, author: e.author, rating, text: e.text }).then((r) => {
      if (r && r.reviews) setReviews(r.reviews);
    });
  }

  function addSuggestion(s) {
    const ns = [{ ...s, id: Date.now().toString(36), date: new Date().toISOString().slice(0, 10) }, ...suggestions];
    setSuggestions(ns);
    post("/api/suggest", s).then((r) => {
      if (r && r.suggestions) setSuggestions(r.suggestions);
    });
  }

  const avg = (id) => {
    const rs = reviews[id] || [];
    return rs.length ? rs.reduce((a, b) => a + b.rating, 0) / rs.length : 0;
  };
  const net = (id) => {
    const v = votes[id] || { up: 0, down: 0 };
    return v.up - v.down;
  };

  const rows = useMemo(() => {
    let list = tools.filter((t) => cat === "all" || t.cat === cat);
    if (freeOnly) list = list.filter((t) => t.free);
    if (q.trim()) {
      const n = q.toLowerCase();
      list = list.filter((t) =>
        t.name.toLowerCase().includes(n) || t.one.toLowerCase().includes(n) ||
        t.note.toLowerCase().includes(n) || t.tags.some((g) => g.includes(n)));
    }
    const alive = (t) => (t.dying ? 1 : 0);
    const by = {
      // Nothing is rated on day one, so fall back to claimed listings, then
      // free plans, then name. Anything but arbitrary order.
      rating: (a, b) =>
        avg(b.id) - avg(a.id) || net(b.id) - net(a.id) ||
        Number(Boolean(b.claimed)) - Number(Boolean(a.claimed)) ||
        Number(Boolean(b.free)) - Number(Boolean(a.free)) ||
        a.name.localeCompare(b.name),
      votes: (a, b) => net(b.id) - net(a.id) || a.name.localeCompare(b.name),
      name: (a, b) => a.name.localeCompare(b.name),
      cat: (a, b) => a.cat.localeCompare(b.cat) || a.name.localeCompare(b.name),
    };
    return [...list].sort((a, b) => alive(a) - alive(b) || (by[sort] || by.name)(a, b));
  }, [cat, q, sort, freeOnly, votes, reviews]);

  const toggle = (id) =>
    setPicked((p) => p.includes(id) ? p.filter((x) => x !== id) : p.length >= 4 ? p : [...p, id]);

  const totalReviews = Object.values(reviews).reduce((a, b) => a + b.length, 0);
  const openTool = (id) => { trackToolOpen(id); setDetail(id); setCompare(false); };

  return (
    <div style={{ background: C.bg, color: C.text, minHeight: "100vh", fontFamily: "Archivo, Inter, system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800&display=swap');
        *::selection { background: #00E08A; color: #06110D; }
        .card { transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease; }
        .card:hover { transform: translateY(-2px); box-shadow: 0 14px 34px rgba(0,0,0,.5); }
        input, textarea, select { outline: none; }
        input:focus, textarea:focus, select:focus { border-color: #00E08A !important; }
        button:focus-visible, a:focus-visible { outline: 2px solid #00E08A; outline-offset: 2px; }
        ::-webkit-scrollbar { width: 10px; height: 10px; }
        ::-webkit-scrollbar-thumb { background: #1D3B31; border-radius: 6px; }
        @media (prefers-reduced-motion: reduce) { .card { transition: none; } .card:hover { transform: none; } }
      `}</style>

      {/* glow */}
      <div style={{
        position: "absolute", inset: "0 0 auto 0", height: 460, pointerEvents: "none",
        background: "radial-gradient(900px 380px at 18% -8%, rgba(0,224,138,.16), transparent 62%), radial-gradient(700px 320px at 84% -12%, rgba(76,201,240,.13), transparent 60%)",
      }} />

      <div className="mx-auto" style={{ maxWidth: 1140, padding: "0 20px", position: "relative" }}>

        {/* Masthead */}
        <header className="pt-8 pb-7">
          <div className="flex flex-wrap items-center justify-between pb-6" style={{ gap: 14 }}>
            <Wordmark />
            <AccountBar session={session} refresh={refreshSession} />
          </div>
          <div className="flex flex-wrap items-center" style={{ gap: 10 }}>
            {CATEGORIES.map((c) => (
              <span key={c.id} style={{ width: 26, height: 4, borderRadius: 2, background: c.color, display: "inline-block" }} />
            ))}
          </div>
          <h1 style={{ fontSize: 44, fontWeight: 800, letterSpacing: "-0.035em", lineHeight: 1.02, margin: "16px 0 0" }}>
            The Shopify app vendor's toolkit
          </h1>
          <p style={{ fontSize: 15, color: C.muted, margin: "8px 0 0" }}>
            by{" "}
            {AUTHOR_URL
              ? <a href={AUTHOR_URL} target="_blank" rel="noopener noreferrer"
                  style={{ color: C.text, textDecoration: "none", borderBottom: `1px solid ${C.line}` }}>{AUTHOR}</a>
              : AUTHOR}
          </p>
          <p className="mt-3" style={{ fontSize: 16.5, color: C.muted, maxWidth: "60ch", lineHeight: 1.55 }}>
            Every tool built specifically for the people who build Shopify apps. Rankings, store data,
            revenue analytics, partner programs. Open directory, community rated.
          </p>
          <div className="flex flex-wrap items-center mt-5" style={{ gap: 18, fontSize: 13.5, color: C.muted }}>
            <span><b style={{ color: C.text }}>{tools.length}</b> tools</span>
            <span><b style={{ color: C.text }}>{CATEGORIES.length}</b> categories</span>
            <span><b style={{ color: C.text }}>{loading ? "…" : totalReviews}</b> community reviews</span>
            <span style={{ color: C.dim }}>Shopify-exclusive only · last updated {LAST_UPDATED}</span>
          </div>
        </header>

        <Matcher tools={tools} onOpen={openTool} />

        {/* Filters */}
        <div className="mt-10 flex flex-wrap items-center" style={{ gap: 8 }}>
          <FilterChip active={cat === "all"} color="#FFFFFF" onClick={() => setCat("all")}
            label="All" count={tools.length} />
          {CATEGORIES.map((c) => (
            <FilterChip key={c.id} active={cat === c.id} color={c.color} onClick={() => setCat(c.id)}
              label={c.label} count={tools.filter((t) => t.cat === c.id).length} />
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center" style={{ gap: 10 }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tools, tags, notes"
            style={{
              flex: 1, minWidth: 200, background: C.panel, border: `1px solid ${C.line}`,
              borderRadius: 9, padding: "9px 12px", fontSize: 14, color: C.text, fontFamily: "inherit",
            }} />
          <button onClick={() => setFreeOnly((f) => !f)}
            style={{
              background: freeOnly ? "#00E08A" : C.panel, color: freeOnly ? "#06110D" : C.muted,
              border: `1px solid ${freeOnly ? "#00E08A" : C.line}`, borderRadius: 9,
              padding: "9px 14px", fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            }}>Free plan</button>
          <select value={sort} onChange={(e) => setSort(e.target.value)}
            style={{
              background: C.panel, border: `1px solid ${C.line}`, borderRadius: 9,
              padding: "9px 10px", fontSize: 13.5, color: C.text, fontFamily: "inherit",
            }}>
            <option value="rating">Top rated</option>
            <option value="votes">Most liked</option>
            <option value="name">A to Z</option>
            <option value="cat">By category</option>
          </select>
          <button onClick={() => setShowSuggest("tool")}
            style={{
              background: "#00E08A", color: "#06110D", border: 0,
              borderRadius: 9, padding: "9px 16px", fontSize: 13.5, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
            }}>Add a tool {suggestions.length ? `· ${suggestions.length}` : ""}</button>
        </div>

        {cat !== "all" && (
          <p className="mt-4" style={{ fontSize: 14.5, color: C.muted, maxWidth: "62ch", lineHeight: 1.5 }}>
            {catOf(cat).blurb}
          </p>
        )}
        {err && <p className="mt-3" style={{ fontSize: 13, color: "#FF9052" }}>{err}</p>}

        {/* Grid */}
        <div ref={gridRef} className="mt-6 grid" style={{ gap: 14, gridTemplateColumns: "repeat(auto-fill, minmax(292px, 1fr))", paddingBottom: picked.length ? 96 : 40 }}>
          {rows.length === 0 && (
            <div style={{ gridColumn: "1 / -1", padding: "40px 0" }}>
              <p style={{ fontSize: 16 }}>Nothing matches that.</p>
              <p className="mt-1" style={{ fontSize: 14, color: C.muted }}>
                Clear the filters, or add the tool you were expecting to find.
              </p>
              <button onClick={() => setShowSuggest("tool")} style={{
                marginTop: 14, background: "#00E08A", color: "#06110D", border: 0,
                borderRadius: 9, padding: "10px 18px", fontSize: 14, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit",
              }}>Add a tool</button>
            </div>
          )}
          {rows.length > 0 && (
            <button
              onClick={() => setShowSuggest("tool")}
              className="card flex flex-col items-start justify-center text-left"
              style={{
                background: "linear-gradient(155deg, rgba(0,224,138,.10), rgba(76,201,240,.06))",
                border: "1px dashed rgba(0,224,138,.45)", borderRadius: 14, padding: 20,
                minHeight: 190, cursor: "pointer", fontFamily: "inherit", color: C.text,
                order: 999,
              }}
            >
              <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.015em" }}>
                Not finding it?
              </span>
              <span style={{ fontSize: 14, color: C.muted, lineHeight: 1.5, marginTop: 7 }}>
                This list is missing things by definition. Built a tool, or use one that
                belongs here? Add it and it joins the directory after a check.
              </span>
              <span style={{
                marginTop: 14, background: "#00E08A", color: "#06110D", borderRadius: 8,
                padding: "8px 14px", fontSize: 13.5, fontWeight: 700,
              }}>Add a tool</span>
            </button>
          )}
          {rows.map((t) => (
            <Card key={t.id} tool={t} avg={avg(t.id)} reviewCount={(reviews[t.id] || []).length}
              votes={votes[t.id] || { up: 0, down: 0 }} myVote={mine[t.id] || 0}
              onVote={(d) => vote(t.id, d)} onOpen={() => openTool(t.id)}
              picked={picked.includes(t.id)} onPick={() => toggle(t.id)}
              pickFull={picked.length >= 4 && !picked.includes(t.id)} />
          ))}
        </div>

        <Roadmap onSuggest={setShowSuggest} />

        <footer className="pb-16" style={{ borderTop: `1px solid ${C.line}`, paddingTop: 18 }}>
          <p style={{ fontSize: 13, color: C.dim, maxWidth: "78ch", lineHeight: 1.65 }}>
            watchfor.tools is an independent directory. Not affiliated with, endorsed by, or sponsored by
            Shopify. Shopify is a trademark of Shopify Inc.
            No tool here paid to be listed and none of the links are affiliate links.
            Notes were last updated {LAST_UPDATED}. They are an editorial view, not an endorsement, and pricing moves. Tools marked unverified
            were sourced from search results or third parties rather than the vendor's own site. Social
            profiles are linked only where the vendor publishes them. Ratings, reviews and suggestions are
            contributed by visitors and shared with everyone.
          </p>
        </footer>
      </div>

      {/* Compare tray */}
      {picked.length > 0 && !compare && (
        <div style={{
          position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 40,
          background: "rgba(8,22,18,.93)", borderTop: `1px solid ${C.line}`,
          backdropFilter: "blur(10px)", padding: "12px 20px",
        }}>
          <div className="mx-auto flex flex-wrap items-center" style={{ maxWidth: 1140, gap: 10 }}>
            <span style={{ fontSize: 13.5, color: C.muted }}>
              {picked.length} selected{picked.length >= 4 ? " (max)" : ""}
            </span>
            <div className="flex flex-wrap" style={{ gap: 6, flex: 1 }}>
              {picked.map((id) => {
                const t = tools.find((x) => x.id === id);
                return (
                  <button key={id} onClick={() => toggle(id)}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5,
                      background: "rgba(255,255,255,.06)", border: `1px solid ${catOf(t.cat).color}55`,
                      color: C.text, borderRadius: 999, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit",
                    }}>{t.name} <span style={{ color: C.dim }}>×</span></button>
                );
              })}
            </div>
            <button onClick={() => setPicked([])}
              style={{ background: "transparent", border: `1px solid ${C.line}`, color: C.muted, borderRadius: 8, padding: "8px 12px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
              Clear
            </button>
            <button onClick={() => setCompare(true)} disabled={picked.length < 2}
              style={{
                background: picked.length > 1 ? "#00E08A" : "rgba(255,255,255,.08)",
                color: picked.length > 1 ? "#06110D" : C.dim,
                border: 0, borderRadius: 8, padding: "9px 16px", fontSize: 13.5, fontWeight: 700,
                cursor: picked.length > 1 ? "pointer" : "default", fontFamily: "inherit",
              }}>
              Compare {picked.length > 1 ? picked.length : ""}
            </button>
          </div>
        </div>
      )}

      {compare && <CompareModal tools={tools} ids={picked} onClose={() => setCompare(false)} avg={avg} votes={votes} reviews={reviews} />}
      {detail && (
        <DetailModal
          tool={tools.find((t) => t.id === detail)}
          onClose={() => setDetail(null)}
          reviews={reviews[detail] || []}
          onReview={(a, r, x) => addReview(detail, a, r, x)}
          avg={avg(detail)}
          votes={votes[detail] || { up: 0, down: 0 }}
          myVote={mine[detail] || 0}
          onVote={(d) => vote(detail, d)}
          session={session}
          refreshSession={refreshSession}
          onTools={setTools}
        />
      )}
      {showSuggest && <SuggestModal suggestions={suggestions} initialKind={showSuggest} onAdd={addSuggestion} onClose={() => setShowSuggest(null)} />}
    </div>
  );
}

/* ================================================================== */
function FilterChip({ active, color, onClick, label, count }) {
  return (
    <button onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 7,
        background: active ? color : "rgba(255,255,255,0.045)",
        color: active ? "#06110D" : C.text,
        border: `1px solid ${active ? color : C.line}`,
        borderRadius: 999, padding: "7px 13px", fontSize: 13.5,
        fontWeight: active ? 700 : 500, cursor: "pointer", fontFamily: "inherit",
      }}>
      {!active && <span style={{ width: 7, height: 7, borderRadius: 999, background: color }} />}
      {label}
      <span style={{ fontSize: 11.5, opacity: active ? 0.7 : 0.45 }}>{count}</span>
    </button>
  );
}

function Card({ tool, avg, reviewCount, votes, myVote, onVote, onOpen, picked, onPick, pickFull }) {
  const col = catOf(tool.cat).color;
  return (
    <div className="card flex flex-col" style={{
      background: C.panel, border: `1px solid ${picked ? col : C.line}`,
      borderRadius: 14, overflow: "hidden", position: "relative",
    }}>
      <div style={{ height: 3, background: col }} />
      <div className="flex flex-col p-4" style={{ flex: 1 }}>
        <div className="flex items-start" style={{ gap: 11 }}>
          <Logo tool={tool} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="flex items-baseline flex-wrap" style={{ gap: 7 }}>
              <button onClick={onOpen} style={{
                background: "none", border: 0, padding: 0, cursor: "pointer", fontFamily: "inherit",
                fontSize: 17, fontWeight: 700, color: C.text, letterSpacing: "-0.015em", textAlign: "left",
              }}>{tool.name}</button>
              {tool.dying && <Pill color="#FF6B8A" solid>winding down</Pill>}
              {tool.claimed && <Pill color="#4CC9F0">claimed</Pill>}
            </div>
            <p style={{ fontSize: 12.5, color: col, marginTop: 2 }}>{catOf(tool.cat).label}</p>
          </div>
          <button
            onClick={onPick}
            disabled={pickFull}
            aria-pressed={picked}
            title={pickFull ? "Four tools maximum" : picked ? "Remove from comparison" : "Add to comparison"}
            style={{
              flexShrink: 0, width: 22, height: 22, borderRadius: 6, padding: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: picked ? col : "transparent",
              border: `1px solid ${picked ? col : C.line}`,
              color: picked ? "#06110D" : C.dim,
              cursor: pickFull ? "not-allowed" : "pointer",
              opacity: pickFull ? 0.4 : 1,
              fontSize: 12, fontWeight: 800, lineHeight: 1, fontFamily: "inherit",
            }}
          >
            {picked ? "✓" : "+"}
          </button>
        </div>

        <p className="mt-3" style={{ fontSize: 14, color: C.muted, lineHeight: 1.5, flex: 1 }}>{tool.one}</p>

        <div className="flex flex-wrap items-center mt-3" style={{ gap: 6 }}>
          <Pill color={col}>{tool.price}</Pill>
          {tool.free && <Pill color="#00E08A">free plan</Pill>}
          {tool.suite && <Pill color="#FF9052">{tool.suite}</Pill>}
          {tool.linked && <Pill color="#B08CFF">same owner as {tool.linked}</Pill>}
          {tool.owner && <Pill color="#B08CFF">by {tool.owner}</Pill>}
          {!tool.verified && <Pill color="#7C8F86">unverified</Pill>}
        </div>

        <div className="flex items-center justify-between mt-4 pt-3" style={{ borderTop: `1px solid ${C.line}`, gap: 8 }}>
          <button onClick={onOpen} className="flex items-center" style={{
            gap: 6, background: "none", border: 0, padding: 0, cursor: "pointer", fontFamily: "inherit",
          }}>
            <Stars value={Math.round(avg)} />
            <span style={{ fontSize: 12, color: C.dim }}>{reviewCount || "no"} {reviewCount === 1 ? "review" : "reviews"}</span>
          </button>
          <div className="flex items-center" style={{ gap: 5 }}>
            <Vote dir={1} active={myVote === 1} n={votes.up} onClick={() => onVote(1)} />
            <Vote dir={-1} active={myVote === -1} n={votes.down} onClick={() => onVote(-1)} />
          </div>
        </div>

        {tool.ratings?.length > 0 && (
          <div className="mt-2">
            <ExternalRatings ratings={tool.ratings} />
          </div>
        )}

        <div className="flex items-center justify-between mt-3" style={{ gap: 8 }}>
          <Social social={tool.social} />
          <a href={tool.url} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 12.5, color: col, textDecoration: "none", fontWeight: 600 }}>
            Visit site
          </a>
        </div>
      </div>
    </div>
  );
}

function Vote({ dir, active, n, onClick }) {
  const color = dir === 1 ? "#00E08A" : "#FF6B8A";
  return (
    <button onClick={onClick} aria-pressed={active} aria-label={dir === 1 ? "Like" : "Dislike"}
      className="flex items-center" style={{
        gap: 4, background: active ? color : "rgba(255,255,255,.05)",
        color: active ? "#06110D" : C.muted,
        border: `1px solid ${active ? color : C.line}`, borderRadius: 7,
        padding: "3px 8px", fontSize: 12, cursor: "pointer", fontFamily: "inherit", fontWeight: 600,
      }}>
      <span>{dir === 1 ? "▲" : "▼"}</span><span>{n}</span>
    </button>
  );
}

/* ================================================================== */
function Shell({ children, onClose, width = 860 }) {
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 60, background: "rgba(2,8,6,.78)",
      backdropFilter: "blur(6px)", overflowY: "auto", padding: "36px 16px",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        maxWidth: width, margin: "0 auto", background: C.panel,
        border: `1px solid ${C.line}`, borderRadius: 16,
        boxShadow: "0 30px 80px rgba(0,0,0,.6)", overflow: "hidden",
      }}>{children}</div>
    </div>
  );
}

function DetailModal({ tool, onClose, reviews, onReview, avg, votes, myVote, onVote, session, refreshSession, onTools }) {
  const col = catOf(tool.cat).color;
  return (
    <Shell onClose={onClose} width={760}>
      <div style={{ height: 4, background: col }} />
      <div style={{ padding: 24 }}>
        <div className="flex items-start" style={{ gap: 14 }}>
          <Logo tool={tool} size={46} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontSize: 25, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>{tool.name}</h2>
            <p style={{ fontSize: 13.5, color: col, marginTop: 3 }}>{catOf(tool.cat).label}</p>
          </div>
          <button onClick={onClose} style={{
            background: "rgba(255,255,255,.06)", border: `1px solid ${C.line}`, color: C.muted,
            borderRadius: 8, width: 30, height: 30, cursor: "pointer", fontSize: 15, fontFamily: "inherit",
          }}>×</button>
        </div>

        <div className="flex flex-wrap items-center mt-4" style={{ gap: 7 }}>
          <Pill color={col}>{tool.price}</Pill>
          {tool.free && <Pill color="#00E08A">free plan</Pill>}
          {tool.suite && <Pill color="#FF9052">part of {tool.suite}</Pill>}
          {tool.linked && <Pill color="#B08CFF">same owner as {tool.linked}</Pill>}
          {tool.owner && <Pill color="#B08CFF">by {tool.owner}</Pill>}
          {tool.dying && <Pill color="#FF6B8A" solid>winding down</Pill>}
          {!tool.verified && <Pill color="#7C8F86">unverified</Pill>}
        </div>

        <p className="mt-4" style={{ fontSize: 15.5, lineHeight: 1.62, maxWidth: "68ch" }}>{tool.note}</p>
        <p className="mt-3" style={{ fontSize: 14.5, lineHeight: 1.6, maxWidth: "68ch", color: C.muted }}>
          <span style={{ color: "#FF9052", fontWeight: 700 }}>Watch for. </span>{tool.watch}
        </p>
        {tool.claimed && (
          <p className="mt-2" style={{ fontSize: 12.5, color: C.dim, lineHeight: 1.55, maxWidth: "68ch" }}>
            The summary, description and pricing above are maintained by the vendor
            {tool.editedAt ? `, last updated ${tool.editedAt}` : ""}. The "watch for" note and the
            ratings are not theirs to edit.
          </p>
        )}

        {tool.ratings?.length > 0 && (
          <div className="mt-5">
            <p style={{ fontSize: 12.5, color: C.dim, margin: 0, fontWeight: 600 }}>External ratings</p>
            <div className="mt-2">
              <ExternalRatings ratings={tool.ratings} detail />
            </div>
            <p style={{ fontSize: 12, color: C.dim, margin: "9px 0 0", maxWidth: "68ch", lineHeight: 1.5 }}>
              Collected on other platforms, from a different set of people than the reviews below, and
              deliberately not averaged with them. Follow a link to read them at source.
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center mt-5" style={{ gap: 14 }}>
          <a href={tool.url} target="_blank" rel="noopener noreferrer" style={{
            background: col, color: "#06110D", borderRadius: 9, padding: "9px 16px",
            fontSize: 14, fontWeight: 700, textDecoration: "none",
          }}>{tool.domain}</a>
          <Social social={tool.social} />
          <div className="flex items-center" style={{ gap: 5, marginLeft: "auto" }}>
            <Vote dir={1} active={myVote === 1} n={votes.up} onClick={() => onVote(1)} />
            <Vote dir={-1} active={myVote === -1} n={votes.down} onClick={() => onVote(-1)} />
          </div>
        </div>

        <OwnerPanel tool={tool} session={session} refresh={refreshSession} onTools={onTools} />

        <div className="mt-6" style={{ background: C.raised, border: `1px solid ${C.line}`, borderRadius: 12, padding: 16 }}>
          <ReviewForm name={tool.name} onSubmit={onReview} color={col} />
          {reviews.length > 0 && (
            <div className="mt-5 flex flex-col" style={{ gap: 13 }}>
              {reviews.map((r) => (
                <div key={r.id} style={{ borderTop: `1px solid ${C.line}`, paddingTop: 12 }}>
                  <div className="flex items-baseline flex-wrap" style={{ gap: 8 }}>
                    <Stars value={r.rating} size={13} />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{r.author}</span>
                    <span style={{ fontSize: 12, color: C.dim }}>{r.date}</span>
                  </div>
                  {r.text && <p className="mt-1" style={{ fontSize: 14, lineHeight: 1.55, color: C.muted, maxWidth: "64ch" }}>{r.text}</p>}
                </div>
              ))}
            </div>
          )}
          {reviews.length === 0 && (
            <p className="mt-4" style={{ fontSize: 13.5, color: C.dim }}>
              No reviews yet. If you have used it, you are the most useful person in the room.
            </p>
          )}
        </div>

        <ReportProblem tool={tool} />
      </div>
    </Shell>
  );
}

/*
 * Corrections from anyone, signed in or not — the person who notices a dead
 * link is rarely the person who owns the listing.
 *
 * This posts to /api/report, which writes to a queue and never to the catalogue
 * or to svt:overrides. Nothing a visitor types here reaches the site until an
 * editor has read it and made the change by hand, which is why it can be open
 * to the public at all.
 */
function ReportProblem({ tool }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState(REPORT_KINDS[0].id);
  const [value, setValue] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  const spec = reportKindOf(kind) || REPORT_KINDS[0];
  const field = {
    background: "rgba(0,0,0,.3)", border: `1px solid ${C.line}`, borderRadius: 8,
    padding: "8px 11px", fontSize: 14, color: C.text, fontFamily: "inherit", width: "100%",
  };

  async function submit() {
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toolId: tool.id, kind, value, email }),
      });
      if (!res.ok) { setErr(await res.text()); return; }
      setDone(true); setValue(""); setEmail("");
    } catch {
      setErr("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <p className="mt-5" style={{ fontSize: 13, color: C.muted, lineHeight: 1.55 }}>
        Thanks — that is with the editor. Nothing changes on the listing until someone has checked it.
      </p>
    );
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{
        background: "none", border: 0, padding: 0, marginTop: 20, cursor: "pointer",
        fontFamily: "inherit", fontSize: 12.5, color: C.dim, textDecoration: "underline",
      }}>Report a problem with this listing</button>
    );
  }

  return (
    <div className="mt-5" style={{ border: `1px dashed ${C.line}`, borderRadius: 12, padding: 16 }}>
      <div className="flex items-baseline justify-between" style={{ gap: 10 }}>
        <p style={{ fontSize: 13.5, fontWeight: 700, margin: 0 }}>Report a problem with {tool.name}</p>
        <button onClick={() => setOpen(false)} style={{
          background: "none", border: 0, padding: 0, cursor: "pointer",
          fontFamily: "inherit", fontSize: 12.5, color: C.dim,
        }}>Cancel</button>
      </div>

      <div className="flex flex-wrap mt-3" style={{ gap: 9 }}>
        <select value={kind} onChange={(e) => { setKind(e.target.value); setErr(""); }}
          style={{ ...field, width: 210 }}>
          {REPORT_KINDS.map((k) => (
            <option key={k.id} value={k.id} style={{ background: C.panel }}>{k.label}</option>
          ))}
        </select>
        <input value={value} onChange={(e) => setValue(e.target.value)}
          placeholder={spec.hint} style={{ ...field, flex: 1, minWidth: 220 }} />
      </div>

      <div className="flex flex-wrap items-center mt-2" style={{ gap: 9 }}>
        <input value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="Your email (optional)" style={{ ...field, width: 240 }} />
        <button onClick={submit} disabled={busy} style={{
          background: busy ? "rgba(255,255,255,.08)" : "#00E08A", color: busy ? C.dim : "#06110D",
          border: 0, borderRadius: 8, padding: "9px 16px", fontSize: 13.5, fontWeight: 700,
          cursor: busy ? "default" : "pointer", fontFamily: "inherit",
        }}>{busy ? "Sending…" : "Send report"}</button>
      </div>

      {err && <p style={{ fontSize: 12.5, color: "#FF6B8A", margin: "9px 0 0" }}>{err}</p>}

      <p style={{ fontSize: 12, color: C.dim, margin: "10px 0 0", lineHeight: 1.55, maxWidth: "62ch" }}>
        This goes to the editor, not to the vendor, and nothing is applied automatically. A social
        profile you send is only added once it can be confirmed on the company's own site — we do not
        link a profile the vendor has not published themselves. Your email is optional and only used
        to follow up on this report.
      </p>
    </div>
  );
}

function ReviewForm({ name, onSubmit, color }) {
  const [author, setAuthor] = useState("");
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [done, setDone] = useState(false);
  const field = {
    background: "rgba(0,0,0,.3)", border: `1px solid ${C.line}`, borderRadius: 8,
    padding: "8px 11px", fontSize: 14, color: C.text, fontFamily: "inherit", width: "100%",
  };
  const submit = () => {
    if (!rating) return;
    onSubmit(author, rating, text);
    setAuthor(""); setRating(0); setText(""); setDone(true);
    setTimeout(() => setDone(false), 2600);
  };
  return (
    <div>
      <div className="flex flex-wrap items-center" style={{ gap: 12 }}>
        <span style={{ fontSize: 14.5, fontWeight: 600 }}>Rate {name}</span>
        <Stars value={rating} onPick={setRating} size={21} />
      </div>
      <div className="flex flex-wrap mt-3" style={{ gap: 8 }}>
        <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Your name"
          style={{ ...field, width: 150, flexShrink: 0 }} />
        <input value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          placeholder="What did you actually find using it?" style={{ ...field, flex: 1, minWidth: 200 }} />
        <button onClick={submit} disabled={!rating} style={{
          background: rating ? color : "rgba(255,255,255,.08)", color: rating ? "#06110D" : C.dim,
          border: 0, borderRadius: 8, padding: "9px 16px", fontSize: 14, fontWeight: 700,
          cursor: rating ? "pointer" : "default", fontFamily: "inherit",
        }}>Post</button>
      </div>
      {!rating && <p className="mt-2" style={{ fontSize: 12.5, color: C.dim }}>Pick a star rating to post.</p>}
      {done && <p className="mt-2" style={{ fontSize: 12.5, color: "#00E08A" }}>Posted. Everyone can see it.</p>}
    </div>
  );
}

/* ================================================================== */
function CompareModal({ tools, ids, onClose, avg, votes, reviews }) {
  const list = ids.map((id) => tools.find((t) => t.id === id));
  /*
   * Only worth a row if something being compared actually has one. A blank column
   * of "None found" would read as a verdict on the tool, when what it really says
   * is that this corner of the ecosystem is too small for the review platforms.
   */
  const anyRatings = list.some((t) => t.ratings?.length);
  const rowsSpec = [
    ["Category", (t) => catOf(t.cat).label],
    ["What it does", (t) => t.one],
    ["Pricing", (t) => t.price],
    ["Free plan", (t) => (t.free ? "Yes" : "No")],
    ["Community rating", (t) => {
      const a = avg(t.id), n = (reviews[t.id] || []).length;
      return n ? `${a.toFixed(1)} from ${n}` : "Not rated yet";
    }],
    ...(anyRatings ? [["External ratings", (t) => (t.ratings || []).map((r) => (
      r.score == null
        ? `${r.source}, score not captured`
        : `${r.source} ${r.score}${r.outOf && r.outOf !== 5 ? `/${r.outOf}` : ""}`
    )).join(" · ")]] : []),
    ["Likes", (t) => {
      const v = votes[t.id] || { up: 0, down: 0 };
      return `${v.up} up · ${v.down} down`;
    }],
    ["Status", (t) => (t.dying ? "Winding down" : "Active")],
    ["Listing maintained by", (t) => (t.claimed ? "The vendor" : "Editors")],
    ["Ownership", (t) => t.suite ? `Part of ${t.suite}` : t.linked ? `Same owner as ${t.linked}` : t.owner ? `Built by ${t.owner}` : "Independent"],
    ["Research source", (t) => (t.verified ? "Vendor site read directly" : "Third party, unverified")],
    ["Site", (t) => t.domain],
  ];
  const cellW = `${Math.max(24, Math.floor(66 / list.length))}%`;
  return (
    <Shell onClose={onClose} width={1000}>
      <div style={{ padding: 22 }}>
        <div className="flex items-center justify-between" style={{ gap: 12 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>
            Comparing {list.length} tools
          </h2>
          <button onClick={onClose} style={{
            background: "rgba(255,255,255,.06)", border: `1px solid ${C.line}`, color: C.muted,
            borderRadius: 8, width: 30, height: 30, cursor: "pointer", fontSize: 15, fontFamily: "inherit",
          }}>×</button>
        </div>

        <div style={{ overflowX: "auto", marginTop: 18 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
            <thead>
              <tr>
                <th style={{ width: "20%" }} />
                {list.map((t) => (
                  <th key={t.id} style={{ width: cellW, textAlign: "left", padding: "0 12px 14px", verticalAlign: "bottom" }}>
                    <div className="flex items-center" style={{ gap: 9 }}>
                      <Logo tool={t} size={30} />
                      <span style={{ fontSize: 16, fontWeight: 700 }}>{t.name}</span>
                    </div>
                    <div style={{ height: 3, background: catOf(t.cat).color, borderRadius: 2, marginTop: 10 }} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rowsSpec.map(([label, fn], i) => (
                <tr key={label} style={{ background: i % 2 ? "rgba(255,255,255,.025)" : "transparent" }}>
                  <td style={{ padding: "11px 12px", fontSize: 13, color: C.dim, verticalAlign: "top", fontWeight: 600 }}>
                    {label}
                  </td>
                  {list.map((t) => (
                    <td key={t.id} style={{ padding: "11px 12px", fontSize: 14, color: C.text, verticalAlign: "top", lineHeight: 1.45 }}>
                      {fn(t)}
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <td style={{ padding: "11px 12px", fontSize: 13, color: C.dim, fontWeight: 600, verticalAlign: "top" }}>Profiles</td>
                {list.map((t) => (
                  <td key={t.id} style={{ padding: "11px 12px" }}><Social social={t.social} /></td>
                ))}
              </tr>
              <tr>
                <td style={{ padding: "11px 12px", fontSize: 13, color: C.dim, fontWeight: 600, verticalAlign: "top" }}>Watch for</td>
                {list.map((t) => (
                  <td key={t.id} style={{ padding: "11px 12px", fontSize: 13.5, color: C.muted, verticalAlign: "top", lineHeight: 1.5 }}>
                    {t.watch}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </Shell>
  );
}

/* ================================================================== */
/* ================================================================== */
/*  Roadmap                                                            */
/*  Every kind that is not live yet, as a card that opens the suggest  */
/*  modal already pointed at that kind.                                */
/* ================================================================== */
function Roadmap({ onSuggest }) {
  const pending = RESOURCE_KINDS.filter((k) => !k.live);
  return (
    <section className="pt-4 pb-14">
      <h2 style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.12, margin: 0 }}>
        Tools are the first section, not the whole plan
      </h2>
      <p className="mt-3" style={{ fontSize: 15.5, color: C.muted, maxWidth: "64ch", lineHeight: 1.55 }}>
        Software was the easiest part to catalogue, so it went first. The sections below are
        what the rest of the job looks like, and they open in the order people ask for them.
        Nothing in them is written yet. Suggest what belongs and it goes on the list.
      </p>

      <div className="grid mt-6" style={{ gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(262px, 1fr))" }}>
        {pending.map((k) => (
          <button
            key={k.id}
            onClick={() => onSuggest(k.id)}
            className="flex flex-col items-start text-left"
            style={{
              background: C.panel, border: `1px solid ${C.line}`, borderRadius: 13,
              padding: "15px 16px 16px", cursor: "pointer", fontFamily: "inherit",
              color: C.text, height: "100%",
            }}
          >
            <span style={{ width: 26, height: 4, borderRadius: 2, background: k.color, display: "block" }} />
            <span style={{ fontSize: 16.5, fontWeight: 700, letterSpacing: "-0.015em", marginTop: 11 }}>
              {k.label}
            </span>
            <span style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.5, marginTop: 6, flex: 1 }}>
              {k.blurb}
            </span>
            <span style={{ marginTop: 12 }}><Pill color={k.color}>open for suggestions</Pill></span>
          </button>
        ))}
      </div>

      <Subscribe />
    </section>
  );
}

function Subscribe() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState("idle"); /* idle | busy | done | error */
  const [msg, setMsg] = useState("");
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());

  async function submit(e) {
    e.preventDefault();
    if (!valid || state === "busy") return;
    setState("busy"); setMsg("");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) { setState("error"); setMsg(await res.text()); return; }
      setEmail(""); setState("done");
    } catch {
      setState("error"); setMsg("Could not reach the server. Try again in a moment.");
    }
  }

  return (
    <div className="mt-8" style={{
      background: "linear-gradient(160deg, #10281F 0%, #0A1C16 100%)",
      border: `1px solid ${C.line}`, borderRadius: 14, padding: 22,
    }}>
      <h3 style={{ fontSize: 19, fontWeight: 700, margin: 0, letterSpacing: "-0.015em" }}>
        Know when a section opens
      </h3>
      <p style={{ fontSize: 14.5, color: C.muted, margin: "7px 0 0", maxWidth: "60ch", lineHeight: 1.55 }}>
        One email when new tools go into the directory or a section opens. That is the whole
        thing. It is not a newsletter, there is nothing to read weekly, and there is no pitch
        at the bottom.
      </p>

      <form onSubmit={submit} className="flex flex-wrap mt-4" style={{ gap: 8 }}>
        <input
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); if (state !== "idle") setState("idle"); }}
          placeholder="you@yourapp.com"
          aria-label="Email address"
          style={{
            flex: 1, minWidth: 220, maxWidth: 340,
            background: "rgba(0,0,0,.32)", border: `1px solid ${C.line}`, borderRadius: 9,
            padding: "10px 13px", fontSize: 14.5, color: C.text, fontFamily: "inherit",
          }}
        />
        <button type="submit" disabled={!valid || state === "busy"} style={{
          background: valid ? "#00E08A" : "rgba(255,255,255,.08)",
          color: valid ? "#06110D" : C.dim, border: 0, borderRadius: 9,
          padding: "10px 18px", fontSize: 14.5, fontWeight: 700,
          cursor: valid && state !== "busy" ? "pointer" : "default", fontFamily: "inherit",
        }}>
          {state === "busy" ? "Adding…" : "Keep me posted"}
        </button>
      </form>

      {state === "done" && (
        <p className="mt-2" style={{ fontSize: 13, color: "#00E08A" }}>
          Done. You will hear from me when something actually changes.
        </p>
      )}
      {state === "error" && (
        <p className="mt-2" style={{ fontSize: 13, color: "#FF6B8A" }}>{msg || "That did not go through."}</p>
      )}

      <p className="mt-3" style={{ fontSize: 12.5, color: C.dim, maxWidth: "60ch", lineHeight: 1.6 }}>
        Your address is not shared or sold, and it is not passed to any tool listed here.
        It is used for that one email and nothing else. Reply to any of them to be removed.
      </p>
    </div>
  );
}

function SuggestModal({ suggestions, initialKind, onAdd, onClose }) {
  const [kind, setKind] = useState(kindOf(initialKind).id);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [cat, setCat] = useState(CATEGORIES[0].id);
  const [why, setWhy] = useState("");
  const [by, setBy] = useState("");
  const [byEmail, setByEmail] = useState("");
  const [done, setDone] = useState(false);
  const field = {
    background: "rgba(0,0,0,.3)", border: `1px solid ${C.line}`, borderRadius: 9,
    padding: "9px 12px", fontSize: 14, color: C.text, fontFamily: "inherit", width: "100%",
  };
  const submit = () => {
    if (!name.trim()) return;
    onAdd({
      kind, name: name.trim(), url: url.trim(), cat, why: why.trim(),
      by: by.trim() || "Anonymous", email: byEmail.trim(),
    });
    setName(""); setUrl(""); setWhy(""); setDone(true);
    setTimeout(() => setDone(false), 2600);
  };
  return (
    <Shell onClose={onClose} width={880}>
      <div style={{ padding: 24 }}>
        <div className="flex items-center justify-between" style={{ gap: 12 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>
            {kind === "tool" ? "Suggest a tool" : `Suggest something for ${kindOf(kind).label.toLowerCase()}`}
          </h2>
          <button onClick={onClose} style={{
            background: "rgba(255,255,255,.06)", border: `1px solid ${C.line}`, color: C.muted,
            borderRadius: 8, width: 30, height: 30, cursor: "pointer", fontSize: 15, fontFamily: "inherit",
          }}>×</button>
        </div>

        <div className="flex flex-col md:flex-row mt-4" style={{ gap: 28 }}>
          <div style={{ flex: 1 }}>
            <div className="flex flex-wrap" style={{ gap: 6, marginBottom: 14 }}>
              {RESOURCE_KINDS.map((k) => {
                const on = k.id === kind;
                return (
                  <button key={k.id} type="button" onClick={() => setKind(k.id)} aria-pressed={on}
                    style={{
                      background: on ? k.color : "rgba(255,255,255,.045)",
                      color: on ? "#06110D" : C.text,
                      border: `1px solid ${on ? k.color : C.line}`, borderRadius: 999,
                      padding: "5px 11px", fontSize: 12.5, fontWeight: on ? 700 : 500,
                      cursor: "pointer", fontFamily: "inherit",
                    }}>{k.label}</button>
                );
              })}
            </div>
            <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.5, marginBottom: 14 }}>
              {kind === "tool"
                ? "Built something, or use something that belongs here? Add it. Suggestions are public and go into the directory after a check."
                : "This section is not open yet. What gets suggested decides what is in it when it opens, and how soon that happens. Suggestions are public."}
            </p>
            <div className="flex flex-col" style={{ gap: 9 }}>
              <input style={field} value={name} onChange={(e) => setName(e.target.value)}
                placeholder={kind === "tool" ? "Tool name" : "Name"} />
              <input style={field} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
              {kind === "tool" && (
                <select style={field} value={cat} onChange={(e) => setCat(e.target.value)}>
                  {CATEGORIES.map((c) => <option key={c.id} value={c.id} style={{ background: C.panel }}>{c.label}</option>)}
                </select>
              )}
              <textarea style={{ ...field, minHeight: 84, resize: "vertical" }} value={why}
                onChange={(e) => setWhy(e.target.value)}
                placeholder={kind === "tool"
                  ? "What does it do, and what problem does it solve better than the alternatives?"
                  : "What is it, and why is it worth an app vendor's time?"} />
              <div className="flex flex-wrap" style={{ gap: 9 }}>
                <input style={{ ...field, width: 170 }} value={by} onChange={(e) => setBy(e.target.value)} placeholder="Your name" />
                <input style={{ ...field, width: 220 }} value={byEmail} onChange={(e) => setByEmail(e.target.value)}
                  placeholder="Your email (optional)" />
              </div>
              <p style={{ fontSize: 11.5, color: C.dim, margin: "-2px 0 0", lineHeight: 1.5 }}>
                An email only gets you a note when this is looked at. It is not added to the mailing list.
              </p>
              <button onClick={submit} disabled={!name.trim()} style={{
                alignSelf: "flex-start", background: name.trim() ? "#00E08A" : "rgba(255,255,255,.08)",
                color: name.trim() ? "#06110D" : C.dim, border: 0, borderRadius: 9,
                padding: "10px 18px", fontSize: 14, fontWeight: 700,
                cursor: name.trim() ? "pointer" : "default", fontFamily: "inherit",
              }}>Add suggestion</button>
              {done && <p style={{ fontSize: 12.5, color: "#00E08A" }}>Added. Thank you.</p>}
            </div>
          </div>

          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
              Suggested so far <span style={{ color: C.dim, fontWeight: 500 }}>{suggestions.length}</span>
            </h3>
            {suggestions.length === 0 ? (
              <p className="mt-3" style={{ fontSize: 14, color: C.muted, lineHeight: 1.55, maxWidth: "44ch" }}>
                Nothing yet. Known gaps: the email and lifecycle layer Mantle also covered, anything
                aimed at agencies rather than app vendors, and good general tools that are not
                Shopify-exclusive, which this first pass deliberately left out.
              </p>
            ) : (
              <div className="mt-3 flex flex-col">
                {suggestions.map((s) => (
                  <div key={s.id} style={{ borderTop: `1px solid ${C.line}`, padding: "12px 0" }}>
                    <div className="flex flex-wrap items-baseline" style={{ gap: 8 }}>
                      <span style={{ fontSize: 15, fontWeight: 700 }}>{s.name}</span>
                      {s.kind && s.kind !== "tool"
                        ? <span style={{ fontSize: 12, color: kindOf(s.kind).color }}>{kindOf(s.kind).label}</span>
                        : <span style={{ fontSize: 12, color: catOf(s.cat).color }}>{catOf(s.cat).label}</span>}
                    </div>
                    {s.why && <p className="mt-1" style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.5, maxWidth: "50ch" }}>{s.why}</p>}
                    <p className="mt-1" style={{ fontSize: 12, color: C.dim }}>
                      {s.by} · {s.date}
                      {s.url && <> · <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ color: C.muted }}>{s.url.replace(/^https?:\/\//, "")}</a></>}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Shell>
  );
}
