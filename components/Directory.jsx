"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { C, CATEGORIES, TOOLS, catOf } from "@/lib/tools";

/* ================================================================== */
/*  Bits                                                               */
/* ================================================================== */
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

function localMatch(problem) {
  const words = problem.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  return TOOLS.map((t) => {
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

function Matcher({ onOpen }) {
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  const [picks, setPicks] = useState(null);
  const [note, setNote] = useState("");

  async function run(text) {
    const q = (text ?? problem).trim();
    if (!q) return;
    setBusy(true); setPicks(null); setNote("");
    try {
      const res = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problem: q }),
      });
      if (!res.ok) throw new Error("match failed");
      const parsed = await res.json();
      const valid = (parsed.picks || []).filter((p) => TOOLS.some((t) => t.id === p.id));
      setPicks(valid.length ? valid : localMatch(q));
      setNote(parsed.note || "");
    } catch {
      setPicks(localMatch(q));
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
              const t = TOOLS.find((x) => x.id === p.id);
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
export default function Directory() {
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
  const [showSuggest, setShowSuggest] = useState(false);
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
    let list = TOOLS.filter((t) => cat === "all" || t.cat === cat);
    if (freeOnly) list = list.filter((t) => t.free);
    if (q.trim()) {
      const n = q.toLowerCase();
      list = list.filter((t) =>
        t.name.toLowerCase().includes(n) || t.one.toLowerCase().includes(n) ||
        t.note.toLowerCase().includes(n) || t.tags.some((g) => g.includes(n)));
    }
    if (sort === "rating") list = [...list].sort((a, b) => avg(b.id) - avg(a.id) || net(b.id) - net(a.id));
    if (sort === "votes") list = [...list].sort((a, b) => net(b.id) - net(a.id));
    if (sort === "name") list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "cat") list = [...list].sort((a, b) => a.cat.localeCompare(b.cat) || a.name.localeCompare(b.name));
    return list;
  }, [cat, q, sort, freeOnly, votes, reviews]);

  const toggle = (id) =>
    setPicked((p) => p.includes(id) ? p.filter((x) => x !== id) : p.length >= 4 ? p : [...p, id]);

  const totalReviews = Object.values(reviews).reduce((a, b) => a + b.length, 0);
  const openTool = (id) => { setDetail(id); setCompare(false); };

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
        <header className="pt-12 pb-7">
          <div className="flex flex-wrap items-center" style={{ gap: 10 }}>
            {CATEGORIES.map((c) => (
              <span key={c.id} style={{ width: 26, height: 4, borderRadius: 2, background: c.color, display: "inline-block" }} />
            ))}
          </div>
          <h1 style={{ fontSize: 44, fontWeight: 800, letterSpacing: "-0.035em", lineHeight: 1.02, margin: "16px 0 0" }}>
            The Shopify app vendor's toolkit
          </h1>
          <p className="mt-3" style={{ fontSize: 16.5, color: C.muted, maxWidth: "60ch", lineHeight: 1.55 }}>
            Every tool built specifically for the people who build Shopify apps. Rankings, store data,
            revenue analytics, partner programs. Open directory, community rated.
          </p>
          <div className="flex flex-wrap items-center mt-5" style={{ gap: 18, fontSize: 13.5, color: C.muted }}>
            <span><b style={{ color: C.text }}>{TOOLS.length}</b> tools</span>
            <span><b style={{ color: C.text }}>{CATEGORIES.length}</b> categories</span>
            <span><b style={{ color: C.text }}>{loading ? "…" : totalReviews}</b> community reviews</span>
            <span style={{ color: C.dim }}>Shopify-exclusive only · researched 11 Sep 2026</span>
          </div>
        </header>

        <Matcher onOpen={openTool} />

        {/* Filters */}
        <div className="mt-10 flex flex-wrap items-center" style={{ gap: 8 }}>
          <FilterChip active={cat === "all"} color="#FFFFFF" onClick={() => setCat("all")}
            label="All" count={TOOLS.length} />
          {CATEGORIES.map((c) => (
            <FilterChip key={c.id} active={cat === c.id} color={c.color} onClick={() => setCat(c.id)}
              label={c.label} count={TOOLS.filter((t) => t.cat === c.id).length} />
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
          <button onClick={() => setShowSuggest(true)}
            style={{
              background: "transparent", color: C.text, border: `1px dashed ${C.line}`,
              borderRadius: 9, padding: "9px 14px", fontSize: 13.5, fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit",
            }}>Suggest a tool {suggestions.length ? `(${suggestions.length})` : ""}</button>
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
                Clear the filters, or suggest the tool you were expecting to find.
              </p>
            </div>
          )}
          {rows.map((t) => (
            <Card key={t.id} tool={t} avg={avg(t.id)} reviewCount={(reviews[t.id] || []).length}
              votes={votes[t.id] || { up: 0, down: 0 }} myVote={mine[t.id] || 0}
              onVote={(d) => vote(t.id, d)} onOpen={() => openTool(t.id)}
              picked={picked.includes(t.id)} onPick={() => toggle(t.id)}
              pickFull={picked.length >= 4 && !picked.includes(t.id)} />
          ))}
        </div>

        <footer className="pb-16" style={{ borderTop: `1px solid ${C.line}`, paddingTop: 18 }}>
          <p style={{ fontSize: 13, color: C.dim, maxWidth: "78ch", lineHeight: 1.65 }}>
            Independent directory. No tool here paid to be listed and none of the links are affiliate links.
            Notes are a single research pass, not an endorsement, and pricing moves. Tools marked unverified
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
                const t = TOOLS.find((x) => x.id === id);
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

      {compare && <CompareModal ids={picked} onClose={() => setCompare(false)} avg={avg} votes={votes} reviews={reviews} />}
      {detail && (
        <DetailModal
          tool={TOOLS.find((t) => t.id === detail)}
          onClose={() => setDetail(null)}
          reviews={reviews[detail] || []}
          onReview={(a, r, x) => addReview(detail, a, r, x)}
          avg={avg(detail)}
          votes={votes[detail] || { up: 0, down: 0 }}
          myVote={mine[detail] || 0}
          onVote={(d) => vote(detail, d)}
        />
      )}
      {showSuggest && <SuggestModal suggestions={suggestions} onAdd={addSuggestion} onClose={() => setShowSuggest(false)} />}
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
            </div>
            <p style={{ fontSize: 12.5, color: col, marginTop: 2 }}>{catOf(tool.cat).label}</p>
          </div>
          <label title={pickFull ? "Four maximum" : "Select to compare"}
            style={{ cursor: pickFull ? "not-allowed" : "pointer", flexShrink: 0, padding: 2 }}>
            <input type="checkbox" checked={picked} disabled={pickFull} onChange={onPick}
              style={{ accentColor: col, width: 16, height: 16, cursor: "inherit" }} />
          </label>
        </div>

        <p className="mt-3" style={{ fontSize: 14, color: C.muted, lineHeight: 1.5, flex: 1 }}>{tool.one}</p>

        <div className="flex flex-wrap items-center mt-3" style={{ gap: 6 }}>
          <Pill color={col}>{tool.price}</Pill>
          {tool.free && <Pill color="#00E08A">free plan</Pill>}
          {tool.suite && <Pill color="#FF9052">{tool.suite}</Pill>}
          {tool.linked && <Pill color="#B08CFF">owner of {tool.linked}</Pill>}
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

function DetailModal({ tool, onClose, reviews, onReview, avg, votes, myVote, onVote }) {
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
          {tool.dying && <Pill color="#FF6B8A" solid>winding down</Pill>}
          {!tool.verified && <Pill color="#7C8F86">unverified</Pill>}
        </div>

        <p className="mt-4" style={{ fontSize: 15.5, lineHeight: 1.62, maxWidth: "68ch" }}>{tool.note}</p>
        <p className="mt-3" style={{ fontSize: 14.5, lineHeight: 1.6, maxWidth: "68ch", color: C.muted }}>
          <span style={{ color: "#FF9052", fontWeight: 700 }}>Watch for. </span>{tool.watch}
        </p>

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
      </div>
    </Shell>
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
function CompareModal({ ids, onClose, avg, votes, reviews }) {
  const list = ids.map((id) => TOOLS.find((t) => t.id === id));
  const rowsSpec = [
    ["Category", (t) => catOf(t.cat).label],
    ["What it does", (t) => t.one],
    ["Pricing", (t) => t.price],
    ["Free plan", (t) => (t.free ? "Yes" : "No")],
    ["Community rating", (t) => {
      const a = avg(t.id), n = (reviews[t.id] || []).length;
      return n ? `${a.toFixed(1)} from ${n}` : "Not rated yet";
    }],
    ["Likes", (t) => {
      const v = votes[t.id] || { up: 0, down: 0 };
      return `${v.up} up · ${v.down} down`;
    }],
    ["Status", (t) => (t.dying ? "Winding down" : "Active")],
    ["Ownership", (t) => t.suite ? `Part of ${t.suite}` : t.linked ? `Same owner as ${t.linked}` : "Independent"],
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
function SuggestModal({ suggestions, onAdd, onClose }) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [cat, setCat] = useState(CATEGORIES[0].id);
  const [why, setWhy] = useState("");
  const [by, setBy] = useState("");
  const [done, setDone] = useState(false);
  const field = {
    background: "rgba(0,0,0,.3)", border: `1px solid ${C.line}`, borderRadius: 9,
    padding: "9px 12px", fontSize: 14, color: C.text, fontFamily: "inherit", width: "100%",
  };
  const submit = () => {
    if (!name.trim()) return;
    onAdd({ name: name.trim(), url: url.trim(), cat, why: why.trim(), by: by.trim() || "Anonymous" });
    setName(""); setUrl(""); setWhy(""); setDone(true);
    setTimeout(() => setDone(false), 2600);
  };
  return (
    <Shell onClose={onClose} width={880}>
      <div style={{ padding: 24 }}>
        <div className="flex items-center justify-between" style={{ gap: 12 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>Suggest a tool</h2>
          <button onClick={onClose} style={{
            background: "rgba(255,255,255,.06)", border: `1px solid ${C.line}`, color: C.muted,
            borderRadius: 8, width: 30, height: 30, cursor: "pointer", fontSize: 15, fontFamily: "inherit",
          }}>×</button>
        </div>

        <div className="flex flex-col md:flex-row mt-4" style={{ gap: 28 }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.5, marginBottom: 14 }}>
              Built something, or use something that belongs here? Add it. Suggestions are public
              and go into the directory after a check.
            </p>
            <div className="flex flex-col" style={{ gap: 9 }}>
              <input style={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Tool name" />
              <input style={field} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
              <select style={field} value={cat} onChange={(e) => setCat(e.target.value)}>
                {CATEGORIES.map((c) => <option key={c.id} value={c.id} style={{ background: C.panel }}>{c.label}</option>)}
              </select>
              <textarea style={{ ...field, minHeight: 84, resize: "vertical" }} value={why}
                onChange={(e) => setWhy(e.target.value)}
                placeholder="What does it do, and what problem does it solve better than the alternatives?" />
              <input style={{ ...field, width: 170 }} value={by} onChange={(e) => setBy(e.target.value)} placeholder="Your name" />
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
                      <span style={{ fontSize: 12, color: catOf(s.cat).color }}>{catOf(s.cat).label}</span>
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
