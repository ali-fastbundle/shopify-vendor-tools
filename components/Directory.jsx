"use client";

import React, { useState, useEffect, useMemo, useRef, useImperativeHandle } from "react";
import {
  Star, ThumbsUp, ThumbsDown, Check, Plus, X, CaretUp, CaretDown,
  LinkedinLogo, XLogo, GithubLogo, YoutubeLogo, ArrowUpRight, MagnifyingGlass,
} from "@phosphor-icons/react";
import { outbound } from "@/lib/outbound";
import { pendingKinds } from "@/lib/sections";
import { Pill } from "./Pill";
import { C, S, R, F, TRACK, BAND, ink, CATEGORIES, TOOLS, RESOURCE_KINDS, REPORT_KINDS, SOCIALS, reportKindOf, catOf, kindOf, LAST_UPDATED, AUTHOR, AUTHOR_URL, HEADLINE } from "@/lib/tools";
import { AccountBar, OwnerPanel, SignInPrompt, useSession } from "./Account";
import { ThemeToggle } from "./Theme";

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
    <div className="flex items-center" style={{ gap: S.sm }}>
      <span className="flex" style={{ gap: 2 }} aria-hidden="true">
        {CATEGORIES.map((c) => (
          <span key={c.id} style={{ width: 3, height: 16, borderRadius: 1.5, background: c.color, display: "inline-block" }} />
        ))}
      </span>
      <span style={{ fontSize: F.xl, fontWeight: 800, letterSpacing: TRACK.tighter, lineHeight: 1, whiteSpace: "nowrap" }}>
        Watch For <span style={{ color: C.accentInk }}>Tools</span>
      </span>
    </div>
  );
}

/*
 * A tool's mark, best available first: the logo we host under /public/logos/
 * if the entry has one, then the favicon service, then a coloured lettermark.
 * Each step is a fallback for the one before it, so a missing file or a domain
 * with no favicon degrades rather than leaving a hole.
 */
function Logo({ tool, size = 34 }) {
  const [step, setStep] = useState(tool.logo ? "logo" : "favicon");
  if (step === "letter") {
    return (
      <div
        style={{
          width: size, height: size, borderRadius: R.card, flexShrink: 0,
          background: C.subtle, color: C.muted, border: `1px solid ${C.line}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontWeight: 700, fontSize: size * 0.42, letterSpacing: TRACK.tight,
        }}
      >
        {tool.name.slice(0, 2)}
      </div>
    );
  }
  return (
    <img
      src={step === "logo" ? tool.logo : `https://www.google.com/s2/favicons?domain=${tool.domain}&sz=128`}
      alt=""
      /* Intrinsic size and lazy decoding: 24 marks arriving at their own pace
         used to nudge the card they landed in. The box is reserved now. */
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      onError={() => setStep(step === "logo" ? "favicon" : "letter")}
      style={{
        width: size, height: size, borderRadius: R.card, flexShrink: 0,
        /* White under the mark in both themes: a vendor's logo is drawn for a
           light background and plenty of them are dark-on-transparent. */
        background: "#FFFFFF", objectFit: "contain", padding: S.xs,
      }}
    />
  );
}

/*
 * Picking a star is the review, not a step towards one. Wherever these are
 * clickable, `onPick` gets the number and the caller is expected to carry it
 * straight into the form — clicking three stars means three stars.
 */
function Stars({ value, onPick, size = 14, title }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <span className="inline-flex items-center" style={{ gap: 1 }}>
      {[1, 2, 3, 4, 5].map((n) => {
        const on = n <= shown;
        const star = (
          <Star size={size} weight={on ? "fill" : "regular"} color={on ? C.star : C.starOff} />
        );
        if (!onPick) return <span key={n} style={{ display: "inline-flex" }}>{star}</span>;
        return (
          <button key={n} type="button" aria-label={`Rate ${n} star${n === 1 ? "" : "s"}`}
            title={title}
            onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)}
            onClick={(e) => { e.stopPropagation(); onPick(n); }}
            className="press cursor-pointer border-0 bg-transparent p-0"
            style={{ display: "inline-flex", lineHeight: 0 }}>{star}</button>
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
    <div className="flex flex-wrap items-center" style={{ gap: detail ? S.lg : S.md }}>
      {ratings.map((r) => (
        <a key={`${r.source}${r.url}`} href={outbound(r.url)} target="_blank" rel="noopener noreferrer"
          title={`${r.source}: ${r.score == null ? "score not captured" : `${r.score} out of ${r.outOf ?? 5}`}${r.count ? `, ${r.count} reviews` : ""}${r.captured ? `, captured ${r.captured}` : ""}`}
          style={{
            fontSize: detail ? F.sm : F.xs, color: C.dim, textDecoration: "none",
            display: "inline-flex", alignItems: "baseline", gap: S.xs, whiteSpace: "nowrap",
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

/*
 * A multi-line field that grows with what is typed into it.
 *
 * Enter makes a new line. It does not submit.
 *
 * The review box used to be a single-line input with `Enter` wired to submit,
 * which is the shape of a search box, not of a place to write a paragraph.
 * People wrote two sentences, reached for a line break, and posted half a
 * review instead. Nobody reports that. They just do not come back.
 *
 * Cmd or Ctrl plus Enter still submits, for anyone who expects a keyboard way
 * out of a text box, and the button is always the obvious one.
 */
const GrowText = React.forwardRef(function GrowText(
  { value, onChange, onSubmit, rows = 2, maxRows = 12, style, ...rest }, ref,
) {
  const own = useRef(null);
  /* The node either way, whether the caller passed an object ref, a callback
     ref, or nothing at all. */
  useImperativeHandle(ref, () => own.current, []);

  /* Height follows the content: reset to auto so the box can shrink again when
     text is deleted, then take the scroll height. Floored at `rows` so an empty
     box still reads as somewhere to write a paragraph, and capped at `maxRows`
     so a long review does not push the Post button off the screen. */
  useEffect(() => {
    const node = own.current;
    if (!node) return;
    node.style.height = "auto";
    const cs = getComputedStyle(node);
    const line = parseFloat(cs.lineHeight) || 20;
    const border = node.offsetHeight - node.clientHeight;
    const chrome = border + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const wanted = node.scrollHeight + border;
    const min = line * rows + chrome;
    const max = line * maxRows + chrome;
    node.style.height = `${Math.min(Math.max(wanted, min), max)}px`;
    node.style.overflowY = wanted > max ? "auto" : "hidden";
  }, [value, rows, maxRows]);

  return (
    <textarea
      ref={own}
      rows={rows}
      value={value}
      onChange={onChange}
      onKeyDown={(e) => {
        if (onSubmit && e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          onSubmit();
        }
      }}
      style={{ resize: "none", lineHeight: 1.5, display: "block", ...style }}
      {...rest}
    />
  );
});

/*
 * The one treatment a "go to the tool" link gets, on every card and every row
 * regardless of category: solid, high contrast, bold. It used to take the
 * category colour, which made the most important link on the card a different
 * weight and a different colour nine times over.
 *
 * Text on background is the one pair that inverts correctly in both themes.
 */
function VisitSite({ url, children = "Visit site", size = F.xs }) {
  return (
    <a href={outbound(url)} target="_blank" rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="press inline-flex items-center"
      style={{
        gap: S.xs, background: C.text, color: C.bg, borderRadius: R.control,
        padding: "5px 12px", fontSize: size, fontWeight: 700, textDecoration: "none",
        whiteSpace: "nowrap",
      }}>{children}<ArrowUpRight size={size} weight="bold" /></a>
  );
}

/*
 * How a tool relates to whoever else built it. One sentence, used by the list
 * view and the compare table so the two cannot describe the same tool
 * differently.
 */
const ownershipOf = (t) =>
  t.suite ? `Part of ${t.suite}`
    : t.linked ? `Same owner as ${t.linked}`
      : t.owner ? `Built by ${t.owner}`
        : "Independent";

/*
 * The one badge a tool can carry besides "winding down".
 *
 * A tool is written as `shopifyExclusive: false` or the field is absent; there
 * is no `true`. Nearly everything in this catalogue exists for the Shopify
 * ecosystem and nothing else, so a badge saying so would sit on every card and
 * mean nothing. The badge that carries information is the one on the handful
 * of general tools an app vendor still reaches for, because that is the fact
 * you would otherwise find out on the pricing page.
 *
 * Neutral, like every other attribute badge. It is a note about scope, not a
 * warning: PartnerStack is not worse for being built for B2B SaaS at large,
 * it is just not built for this.
 */
const NotShopifyOnly = ({ tool }) =>
  tool.shopifyExclusive === false ? <Pill>not Shopify-only</Pill> : null;

/* The mark for each network in SOCIALS. A key with no icon here renders
   nothing, so adding a network to the list without a mark degrades to an
   absent link rather than to a broken one. */
const SOCIAL_ICONS = { li: LinkedinLogo, x: XLogo, gh: GithubLogo, yt: YoutubeLogo };

function Social({ social, size = 15 }) {
  const items = SOCIALS
    .map(({ key, label }) => [key, SOCIAL_ICONS[key], label, social?.[key]])
    .filter(([, Icon, , href]) => Icon && href);
  /* Nothing published, nothing rendered. A label announcing the absence is
     louder than the absence, and it is not news about the vendor. */
  if (!items.length) return null;
  return (
    <span className="inline-flex items-center" style={{ gap: S.sm }}>
      {items.map(([k, Icon, label, href]) => (
        <a key={k} href={outbound(href)} target="_blank" rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          title={label}
          aria-label={label}
          style={{
            width: 22, height: 22, borderRadius: R.control, display: "inline-flex",
            alignItems: "center", justifyContent: "center",
            border: `1px solid ${C.line}`, color: C.muted, textDecoration: "none",
          }}><Icon size={size - 2} weight="regular" /></a>
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

/*
 * Four outcomes, and the person can tell which one they got.
 *
 *   ok        the matcher answered with tools that fit
 *   none      the matcher answered and nothing fits — a real answer, not a failure
 *   fallback  the request failed and these are keyword matches, said out loud
 *   failed    the request failed and keyword matching found nothing either
 *
 * The fallback used to be silent, which meant the lesser answer was indis-
 * tinguishable from the real one. Nothing-fits is worth saying plainly too:
 * it is the gap in the directory, and the button turns it into a suggestion.
 */
function Matcher({ tools, onOpen, onSuggest, onAnswered }) {
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [editing, setEditing] = useState(true);

  /* The masthead drops to one column once there is an answer to show. */
  useEffect(() => { onAnswered?.(Boolean(result)); }, [result, onAnswered]);

  async function run(text) {
    const q = (text ?? problem).trim();
    if (!q) return;
    trackMatcher(q);
    setBusy(true); setResult(null);
    try {
      const res = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problem: q }),
      });
      if (!res.ok) throw new Error("match failed");
      const parsed = await res.json();
      const picks = (parsed.picks || []).filter((p) => tools.some((t) => t.id === p.id));
      setResult({ status: picks.length ? "ok" : "none", picks, note: parsed.note || "", query: q });
    } catch {
      const picks = localMatch(q, tools);
      setResult({ status: picks.length ? "fallback" : "failed", picks, note: "", query: q });
    }
    setBusy(false);
    setEditing(false);
  }

  const heading = result && (
    result.status === "none" ? "Nothing fits that well"
      : result.status === "failed" ? "No match"
        : result.status === "fallback"
          ? `${result.picks.length} closest match${result.picks.length === 1 ? "" : "es"} by keyword`
          : `${result.picks.length} tool${result.picks.length === 1 ? "" : "s"} that fit${result.picks.length === 1 ? "s" : ""}`
  );

  return (
    <div>
      <div style={{
        background: C.hero,
        border: `1px solid ${C.line}`, borderRadius: R.card, padding: S.lg,
      }}>
        {!editing && result ? (
          /* Asked and answered: the question shrinks to one line so the answer leads. */
          <div className="flex flex-wrap items-baseline" style={{ gap: S.md }}>
            <span style={{ fontSize: F.xs, color: C.dim, flexShrink: 0 }}>You asked</span>
            <span style={{ fontSize: F.md, color: C.text, flex: 1, minWidth: 180, lineHeight: 1.45 }}>
              {result.query}
            </span>
            <button
              onClick={() => { setProblem(result.query); setEditing(true); }}
              style={{
                background: "none", border: 0, padding: 0, color: C.accentInk, fontSize: F.sm,
                fontWeight: 600, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline",
              }}
            >Change</button>
          </div>
        ) : (
          <>
            <h2 style={{ fontSize: F.md, fontWeight: 700, margin: 0, letterSpacing: TRACK.tight }}>
              What are you trying to solve?
            </h2>
            <div className="flex flex-wrap" style={{ gap: S.sm, marginTop: S.md }}>
              <textarea
                value={problem}
                onChange={(e) => setProblem(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) run(); }}
                /* The placeholder is the explainer the heading and the two-line
                   paragraph used to be. It says the same thing in the place the
                   person is already looking. */
                placeholder="Describe it in your own words. We bill through Mantle and need somewhere to go before 30 September…"
                rows={2}
                style={{
                  flex: 1, minWidth: 200, minHeight: 60, resize: "vertical",
                  background: C.field, border: `1px solid ${C.line}`, borderRadius: R.control,
                  padding: "8px 12px", fontSize: F.sm, color: C.text, fontFamily: "inherit", lineHeight: 1.5,
                }}
              />
              <button
                onClick={() => run()}
                disabled={busy || !problem.trim()}
                className="press"
                style={{
                  alignSelf: "stretch", minWidth: 104, border: 0, borderRadius: R.control,
                  background: problem.trim() ? C.accent : C.subtle,
                  color: problem.trim() ? C.onAccent : C.dim,
                  fontSize: F.sm, fontWeight: 700, cursor: problem.trim() && !busy ? "pointer" : "default",
                  fontFamily: "inherit", padding: "0 16px",
                }}
              >
                {busy ? "Matching…" : "Find tools"}
              </button>
            </div>

            {/* Five example queries were five buttons wide enough to wrap to
                three rows. They are worth having and not worth that space, so
                they open on ask. */}
            <details style={{ marginTop: S.sm }}>
              <summary style={{
                fontSize: F.xs, color: C.dim, cursor: "pointer", listStyle: "none",
                display: "inline-block",
              }}>Show examples</summary>
              <div className="flex flex-col" style={{ gap: S.xs, marginTop: S.sm }}>
                {EXAMPLES.map((e) => (
                  <button key={e} onClick={() => { setProblem(e); run(e); }}
                    style={{
                      fontSize: F.xs, color: C.muted, background: "none",
                      border: 0, padding: 0, cursor: "pointer", fontFamily: "inherit",
                      textAlign: "left", textDecoration: "underline", textUnderlineOffset: 3,
                    }}>{e}</button>
                ))}
              </div>
            </details>
          </>
        )}
      </div>

      {result && (
        <div className="mt-4" style={{
          background: C.panel, border: `1px solid ${C.line}`, borderRadius: R.card, padding: S.xl,
        }}>
          <h3 style={{ fontSize: F.lg, fontWeight: 700, margin: 0, letterSpacing: TRACK.tight }}>{heading}</h3>

          {result.status === "fallback" && (
            <p style={{
              fontSize: F.sm, color: C.muted, lineHeight: 1.5, margin: "12px 0 0",
              background: C.subtle, border: `1px solid ${C.line}`,
              borderRadius: R.control, padding: "8px 12px",
            }}>
              The matcher is having a moment. These are the closest matches by keyword.
            </p>
          )}

          {result.status === "failed" && (
            <p style={{ fontSize: F.md, color: C.muted, lineHeight: 1.55, margin: "12px 0 0", maxWidth: "58ch" }}>
              Could not match that right now. Try rephrasing, or browse the categories below.
            </p>
          )}

          {result.status === "none" && (
            <>
              <p style={{ fontSize: F.md, color: C.muted, lineHeight: 1.55, margin: "12px 0 0", maxWidth: "58ch" }}>
                Nothing here fits that well. That is useful to know, so tell me what you were
                looking for and it goes on the list.
              </p>
              <button
                onClick={() => onSuggest({ kind: "tool", why: result.query })}
                className="press mt-3"
                style={{
                  background: C.accent, color: C.onAccent, border: 0, borderRadius: R.control,
                  padding: "8px 16px", fontSize: F.sm, fontWeight: 700, cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >Tell me what you needed</button>
            </>
          )}

          {result.note && result.picks.length > 0 && (
            <p style={{ fontSize: F.md, color: C.text, margin: "12px 0 0", lineHeight: 1.5, maxWidth: "58ch" }}>
              {result.note}
            </p>
          )}

          {result.picks.length > 0 && (
            <div className="flex flex-col mt-3" style={{ gap: S.md }}>
              {result.picks.map((p) => {
                const t = tools.find((x) => x.id === p.id);
                const col = catOf(t.cat).color;
                return (
                  <button key={p.id} onClick={() => onOpen(t.id)}
                    className="flex items-start text-left cursor-pointer"
                    style={{
                      gap: S.md, background: C.subtle, border: `1px solid ${C.line}`,
                      borderLeft: `3px solid ${col}`, borderRadius: R.control, padding: S.md, width: "100%",
                      fontFamily: "inherit", color: C.text,
                    }}>
                    <Logo tool={t} size={30} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span className="flex flex-wrap items-baseline" style={{ gap: S.sm }}>
                        <span style={{ fontSize: F.lg, fontWeight: 600 }}>{t.name}</span>
                        <span style={{ fontSize: F.xs, color: ink(col) }}>{catOf(t.cat).label}</span>
                        <span style={{ fontSize: F.xs, color: C.dim }}>{t.price}</span>
                      </span>
                      <span className="block mt-1" style={{ fontSize: F.sm, color: C.muted, lineHeight: 1.5 }}>
                        {p.why}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  Ordering                                                           */
/* ================================================================== */
/*
 * Pricing is prose — "From $49/mo", "Free tier, then paid", "Not published" —
 * so this reads the first number out of it, and treats anything that says free
 * without naming a number as zero. A price nobody publishes sorts last rather
 * than free, which is the honest place to put an unknown.
 */
const priceOf = (t) => {
  const m = String(t.price).match(/[\d,]+(\.\d+)?/);
  if (m) return parseFloat(m[0].replace(/,/g, ""));
  return /free/i.test(t.price) ? 0 : Infinity;
};

/*
 * The best external score a tool carries, as a fraction, so a 9.2 out of 10
 * and a 4.6 out of 5 can sit in the same column. No external rating sorts
 * below the worst one — it is an absence, not a zero, and it is never blended
 * into the community rating.
 */
const externalOf = (t) =>
  (t.ratings || []).reduce(
    (best, r) => (r.score == null ? best : Math.max(best, r.score / (r.outOf || 5))), -1);

/*
 * Every order the directory can be put in, declared once. The sort control and
 * the list view's column headers both write to it, so they cannot drift into
 * meaning different things by the same name.
 *
 * `dir` is the direction a column starts in when you first click it: a name
 * wants A to Z, a rating wants the best first. `value` is handed the live vote
 * and review tallies, because two of these orders are not properties of the
 * tool at all.
 */
const SORTS = {
  rating: { label: "Top rated", dir: "desc", value: (t, x) => x.avg(t.id) },
  votes: { label: "Most liked", dir: "desc", value: (t, x) => x.net(t.id) },
  name: { label: "A to Z", dir: "asc", value: (t) => t.name.toLowerCase() },
  cat: { label: "By category", dir: "asc", value: (t) => catOf(t.cat).label.toLowerCase() },
  price: { label: "By price", dir: "asc", value: (t) => priceOf(t) },
  free: { label: "Free plan first", dir: "desc", value: (t) => (t.free ? 1 : 0) },
  external: { label: "By external rating", dir: "desc", value: (t) => externalOf(t) },
  ownership: { label: "By ownership", dir: "asc", value: (t) => ownershipOf(t).toLowerCase() },
};

/* The four worth browsing by. The rest are reachable from a column header. */
const SELECT_SORTS = ["rating", "votes", "name", "cat"];

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
  const [dir, setDir] = useState(SORTS.rating.dir);
  const [view, setView] = useState("grid");
  /* True once the matcher has an answer on screen. Widens the masthead. */
  const [answered, setAnswered] = useState(false);
  const [detail, setDetail] = useState(null);
  /* The star that was clicked to get here, carried into the review form. */
  const [detailRating, setDetailRating] = useState(0);
  const [picked, setPicked] = useState([]);
  const [compare, setCompare] = useState(false);
  /*
   * Either a kind id, or { kind, why } when something wants to prefill the
   * form — the matcher hands over the query that found nothing so the person
   * does not retype it.
   */
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

  /*
   * Not optimistic, unlike voting, and deliberately.
   *
   * A review can be rejected (signed out), and it can replace a row rather than
   * add one, so the shape of the list after the write is the server's to decide.
   * Guessing at it and reconciling afterwards would flash a duplicate on every
   * edit. A vote is a number that cannot fail, which is why that one still is.
   *
   * Returns the failure rather than setting the page-wide error, so the form
   * can say "sign in to rate" next to the button somebody just pressed.
   */
  async function addReview(id, author, rating, text) {
    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, author, rating, text }),
      });
      if (!res.ok) return { ok: false, error: await res.text() };
      const d = await res.json();
      if (d.reviews) setReviews(d.reviews);
      setErr("");
      return { ok: true };
    } catch {
      return { ok: false, error: "Could not reach the server." };
    }
  }

  /*
   * Also not optimistic, for the same reason as a review: a submission can be
   * answered with "already listed" and stored nowhere, or folded into a row
   * that already exists. Prepending a row and then taking it away again is a
   * worse answer than waiting a moment for the real one.
   */
  async function addSuggestion(s) {
    try {
      const res = await fetch("/api/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(s),
      });
      if (!res.ok) return { ok: false, error: await res.text() };
      const d = await res.json();
      if (Array.isArray(d.suggestions)) setSuggestions(d.suggestions);
      setErr("");
      return { ok: true, alreadyListed: d.alreadyListed || null, duplicate: d.duplicate || null };
    } catch {
      return { ok: false, error: "Could not reach the server." };
    }
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
    const spec = SORTS[sort] || SORTS.name;
    const sign = dir === "asc" ? 1 : -1;
    const ctx = { avg, net };
    const cmp = (a, b) => {
      const va = spec.value(a, ctx), vb = spec.value(b, ctx);
      const d = typeof va === "string" ? va.localeCompare(vb) : va - vb;
      // NaN from two unknowns compared, 0 from a real tie: both fall through.
      if (d) return d * sign;
      // Nothing is rated on day one, so ties fall to claimed listings, then
      // free plans, then name. Anything but arbitrary order.
      return net(b.id) - net(a.id) ||
        Number(Boolean(b.claimed)) - Number(Boolean(a.claimed)) ||
        Number(Boolean(b.free)) - Number(Boolean(a.free)) ||
        a.name.localeCompare(b.name);
    };
    /* A shut-down product never leads, whatever the column says. */
    return [...list].sort((a, b) => alive(a) - alive(b) || cmp(a, b));
  }, [cat, q, sort, dir, freeOnly, votes, reviews]);

  /*
   * Clicking the column you are already sorted by reverses it; clicking a new
   * one starts it in the direction that column is usually wanted in.
   */
  const orderBy = (key) => {
    if (!SORTS[key]) return;
    if (key === sort) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSort(key); setDir(SORTS[key].dir); }
  };

  const toggle = (id) =>
    setPicked((p) => p.includes(id) ? p.filter((x) => x !== id) : p.length >= 4 ? p : [...p, id]);

  const totalReviews = Object.values(reviews).reduce((a, b) => a + b.length, 0);
  /* `rating` is set when the person got here by clicking a star. */
  const openTool = (id, rating = 0) => {
    trackToolOpen(id); setDetail(id);
    setDetailRating(Number.isInteger(rating) ? rating : 0);
    setCompare(false);
  };

  /*
   * Coming back from a sign-in link.
   *
   * The callback puts the tool id from the signed token on the URL, so somebody
   * who signed in to rate something lands back on that listing with the form
   * open, rather than at the top of the directory having to find it again. What
   * they had typed is restored by the form itself from localStorage, which is
   * what makes this work even when the link is opened in a different tab.
   *
   * The id is checked against the catalogue before it opens anything, and both
   * parameters are stripped afterwards: a refresh should not replay a sign-in,
   * and the URL people copy out of the bar should not carry one.
   */
  useEffect(() => {
    let params;
    try { params = new URLSearchParams(window.location.search); } catch { return; }
    if (!params.has("tool") && !params.has("signin")) return;
    const id = params.get("tool");
    if (id && (initialTools || TOOLS).some((t) => t.id === id)) openTool(id);
    params.delete("tool"); params.delete("signin");
    const rest = params.toString();
    try {
      window.history.replaceState(null, "", window.location.pathname + (rest ? `?${rest}` : ""));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    /*
     * No <style> block and no font-family. The selection colour, the focus
     * ring, the card hover and the scrollbar live in globals.css now, where
     * they can read the theme's variables; the typeface is set once on <body>
     * by next/font. A stylesheet injected from here could only describe one
     * theme, and would have to be rewritten to describe the other.
     */
    <div style={{ background: C.bg, color: C.text, minHeight: "100vh" }}>
      {/* glow */}
      <div style={{
        position: "absolute", inset: "0 0 auto 0", height: 460, pointerEvents: "none",
        background: C.glow,
      }} />

      <div className="mx-auto" style={{ maxWidth: 1280, padding: "0 20px", position: "relative" }}>

        {/*
          * Masthead.
          *
          * The headline and the matcher used to be stacked, and between them
          * they put the first tool card 709px down the page: on a 1366x768
          * laptop the directory itself was below the fold. They sit side by
          * side now, the matcher is a control rather than a hero panel, and
          * the row of category swatches that sat here is gone. The wordmark
          * already states that legend, and the filter chips below state it
          * again where it is also a control.
          *
          * Two columns above 900px, stacked below.
          */}
        <header style={{ paddingTop: S["3xl"], paddingBottom: S["2xl"] }}>
          <div className="flex flex-wrap items-center justify-between" style={{ gap: S.lg, marginBottom: S["2xl"] }}>
            <Wordmark />
            <div className="flex flex-wrap items-center" style={{ gap: S.md }}>
              <AccountBar session={session} refresh={refreshSession} />
              <ThemeToggle />
            </div>
          </div>

          <div className={answered ? "masthead masthead-answered" : "masthead"}>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ fontSize: F.hero, fontWeight: 800, letterSpacing: TRACK.tighter, lineHeight: 1.05, margin: 0 }}>
                {HEADLINE}
              </h1>
              <p style={{ fontSize: F.lg, color: C.muted, maxWidth: "48ch", lineHeight: 1.5, margin: `${S.md}px 0 0` }}>
                Every tool the people who build Shopify apps actually reach for.
                Open directory, community rated.
              </p>
              <div className="flex flex-wrap items-center tnum" style={{ gap: S.lg, fontSize: F.sm, color: C.muted, marginTop: S.lg }}>
                <span><b style={{ color: C.text }}>{tools.length}</b> tools</span>
                <span><b style={{ color: C.text }}>{CATEGORIES.length}</b> categories</span>
                <span><b style={{ color: C.text }}>{loading ? "\u2026" : totalReviews}</b> community reviews</span>
                <span style={{ color: C.dim }}>Updated {LAST_UPDATED}</span>
              </div>
            </div>
            <Matcher tools={tools} onOpen={openTool} onSuggest={setShowSuggest}
              onAnswered={setAnswered} />
          </div>
        </header>

        {/* Filters */}
        <div className="flex flex-wrap items-center" style={{ gap: S.sm }}>
          {/* No category behind it, so no category colour to borrow: All fills
              with the text colour and inks with the background, which is the
              one pair that inverts correctly in both themes. */}
          <FilterChip active={cat === "all"} color={C.text} ink={C.bg}
            onClick={() => setCat("all")} label="All" count={tools.length} />
          {CATEGORIES.map((c) => (
            <FilterChip key={c.id} active={cat === c.id} color={c.color} onClick={() => setCat(c.id)}
              label={c.label} count={tools.filter((t) => t.cat === c.id).length} />
          ))}
        </div>

        <div className="flex flex-wrap items-center" style={{ gap: S.sm, marginTop: S.md }}>
          <span style={{ position: "relative", flex: 1, minWidth: 200, display: "inline-flex", alignItems: "center" }}>
            <MagnifyingGlass size={15} color={C.dim} weight="bold"
              style={{ position: "absolute", left: 10, pointerEvents: "none" }} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tools, tags, notes"
              aria-label="Search tools, tags and notes"
              style={{
                width: "100%", background: C.panel, border: `1px solid ${C.line}`,
                borderRadius: R.control, padding: "8px 12px 8px 32px", fontSize: F.sm,
                color: C.text, fontFamily: "inherit",
              }} />
          </span>
          {/* A filter that is on is a state, not an action, so it takes the
              neutral inversion rather than the action green. */}
          <button onClick={() => setFreeOnly((f) => !f)} aria-pressed={freeOnly}
            style={{
              background: freeOnly ? C.text : C.panel, color: freeOnly ? C.bg : C.muted,
              border: `1px solid ${freeOnly ? C.text : C.line}`, borderRadius: R.control,
              padding: "8px 16px", fontSize: F.sm, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            }} className="press">Free plan</button>
          <select value={sort}
            onChange={(e) => { setSort(e.target.value); setDir(SORTS[e.target.value].dir); }}
            style={{
              background: C.panel, border: `1px solid ${C.line}`, borderRadius: R.control,
              padding: "8px 10px", fontSize: F.sm, color: C.text, fontFamily: "inherit",
            }}>
            {SELECT_SORTS.map((k) => (
              <option key={k} value={k} style={{ background: C.panel }}>{SORTS[k].label}</option>
            ))}
            {/* A column header can set an order this list does not offer. Say
                so rather than showing the wrong option as selected. */}
            {!SELECT_SORTS.includes(sort) && (
              <option value={sort} style={{ background: C.panel }}>{SORTS[sort].label}</option>
            )}
          </select>
          <ViewToggle view={view} onView={setView} />
          <button onClick={() => setShowSuggest("tool")}
            className="press tnum"
            style={{
              background: C.accent, color: C.onAccent, border: 0,
              borderRadius: R.control, padding: "8px 16px", fontSize: F.sm, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
            }}>Add a tool {suggestions.length ? `(${suggestions.length})` : ""}</button>
        </div>

        {cat !== "all" && (
          <p style={{ fontSize: F.sm, color: C.muted, maxWidth: "70ch", lineHeight: 1.5, marginTop: S.md }}>
            {catOf(cat).blurb}
          </p>
        )}
        {err && (
          <p style={{
            fontSize: F.sm, color: C.warnInk, marginTop: S.md, lineHeight: 1.5,
            border: `1px solid ${C.edge}`, borderRadius: R.control, padding: "8px 12px",
          }}>{err}</p>
        )}

        {/* Cards or rows. Same tools, same order — one is for browsing and
            the other for comparing, and the person says which they are doing. */}
        <div ref={gridRef} style={{ marginTop: S.lg, paddingBottom: picked.length ? 96 : BAND.desktop }}>
          {rows.length === 0 && (
            <div style={{ padding: "48px 0" }}>
              <p style={{ fontSize: F.lg }}>Nothing matches that.</p>
              <p className="mt-1" style={{ fontSize: F.md, color: C.muted }}>
                Clear the filters, or add the tool you were expecting to find.
              </p>
              <button onClick={() => setShowSuggest("tool")} style={{
                marginTop: S.lg, background: C.accent, color: C.onAccent, border: 0,
                borderRadius: R.control, padding: "12px 20px", fontSize: F.md, fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit",
              }}>Add a tool</button>
            </div>
          )}

          {rows.length > 0 && view === "grid" && (
            <div className="grid" style={{ gap: S.md, gridTemplateColumns: "repeat(auto-fill, minmax(272px, 1fr))" }}>
              <button
                onClick={() => setShowSuggest("tool")}
                className="card flex flex-col items-start justify-center text-left"
                style={{
                  background: C.invite,
                  border: `1px dashed ${C.accentEdge}`, borderRadius: R.card, padding: S.xl,
                  minHeight: 190, cursor: "pointer", fontFamily: "inherit", color: C.text,
                  order: 999,
                }}
              >
                <span style={{ fontSize: F.lg, fontWeight: 700, letterSpacing: TRACK.tight }}>
                  Not finding it?
                </span>
                <span style={{ fontSize: F.md, color: C.muted, lineHeight: 1.5, marginTop: S.sm }}>
                  This list is missing things by definition. Built a tool, or use one that
                  belongs here? Add it and it joins the directory after a check.
                </span>
                <span style={{
                  marginTop: S.lg, background: C.accent, color: C.onAccent, borderRadius: R.control,
                  padding: "8px 16px", fontSize: F.sm, fontWeight: 700,
                }}>Add a tool</span>
              </button>
              {rows.map((t) => (
                <Card key={t.id} tool={t} avg={avg(t.id)} reviewCount={(reviews[t.id] || []).length}
                  votes={votes[t.id] || { up: 0, down: 0 }} myVote={mine[t.id] || 0}
                  onVote={(d) => vote(t.id, d)} onOpen={(r) => openTool(t.id, r)}
                  picked={picked.includes(t.id)} onPick={() => toggle(t.id)}
                  pickFull={picked.length >= 4 && !picked.includes(t.id)} />
              ))}
            </div>
          )}

          {rows.length > 0 && view === "list" && (
            <ListView
              rows={rows} avg={avg} reviews={reviews} sort={sort} dir={dir} onSort={orderBy}
              onOpen={openTool} picked={picked} onPick={toggle}
              pickFull={(id) => picked.length >= 4 && !picked.includes(id)}
              onAdd={() => setShowSuggest("tool")}
            />
          )}
        </div>

        <Roadmap onSuggest={setShowSuggest} />

        <footer style={{ borderTop: `1px solid ${C.line}`, paddingTop: S.lg, paddingBottom: BAND.desktop }}>
          <p style={{ fontSize: F.sm, color: C.dim, maxWidth: "78ch", lineHeight: 1.65 }}>
            By{" "}
            {AUTHOR_URL
              ? <a href={outbound(AUTHOR_URL)} target="_blank" rel="noopener noreferrer"
                  style={{ color: C.muted, textDecoration: "none", borderBottom: `1px solid ${C.line}` }}>{AUTHOR}</a>
              : AUTHOR}
            {". "}
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
          background: C.tray, borderTop: `1px solid ${C.line}`,
          backdropFilter: "blur(10px)", padding: "12px 20px",
        }}>
          <div className="mx-auto flex flex-wrap items-center" style={{ maxWidth: 1140, gap: S.md }}>
            <span style={{ fontSize: F.sm, color: C.muted }}>
              {picked.length} selected{picked.length >= 4 ? " (max)" : ""}
            </span>
            <div className="flex flex-wrap" style={{ gap: S.sm, flex: 1 }}>
              {picked.map((id) => {
                const t = tools.find((x) => x.id === id);
                return (
                  <button key={id} onClick={() => toggle(id)}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: S.sm, fontSize: F.xs,
                      background: C.subtle, border: `1px solid ${C.edge}`,
                      color: C.text, borderRadius: R.pill, padding: "4px 12px", cursor: "pointer", fontFamily: "inherit",
                    }}>{t.name} <X size={11} weight="bold" color={C.dim} /></button>
                );
              })}
            </div>
            <button onClick={() => setPicked([])}
              style={{ background: "transparent", border: `1px solid ${C.line}`, color: C.muted, borderRadius: R.control, padding: "8px 12px", fontSize: F.sm, cursor: "pointer", fontFamily: "inherit" }}>
              Clear
            </button>
            <button onClick={() => setCompare(true)} disabled={picked.length < 2} className="press"
              style={{
                background: picked.length > 1 ? C.accent : C.subtle,
                color: picked.length > 1 ? C.onAccent : C.dim,
                border: 0, borderRadius: R.control, padding: "8px 16px", fontSize: F.sm, fontWeight: 700,
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
          key={detail}
          tool={tools.find((t) => t.id === detail)}
          initialRating={detailRating}
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
      {showSuggest && (
        <SuggestModal
          suggestions={suggestions}
          initialKind={typeof showSuggest === "string" ? showSuggest : showSuggest.kind}
          initialWhy={typeof showSuggest === "string" ? "" : showSuggest.why}
          onAdd={addSuggestion}
          onOpenTool={openTool}
          onClose={() => setShowSuggest(null)}
        />
      )}
    </div>
  );
}

/* ================================================================== */
/*
 * `ink` is what sits on the fill when the chip is active. It defaults to the
 * dark ink every category hue is chosen to carry; All passes its own, because
 * its fill is the text colour and that one flips with the theme.
 */
function FilterChip({ active, color, ink: onFill = C.onAccent, onClick, label, count }) {
  return (
    <button onClick={onClick} aria-pressed={active}
      className="press tnum"
      style={{
        display: "inline-flex", alignItems: "center", gap: S.sm,
        background: active ? color : C.subtle,
        color: active ? onFill : C.text,
        border: `1px solid ${active ? color : C.line}`,
        /* 2px underscore of the category hue when the chip is off, the hue as
           the fill when it is on. Same information the dot carried, without a
           row of coloured dots reading as decoration. */
        borderBottom: `2px solid ${color}`,
        borderRadius: R.control, padding: "6px 10px", fontSize: F.sm,
        fontWeight: active ? 600 : 500, cursor: "pointer", fontFamily: "inherit",
      }}>
      {label}
      <span style={{ fontSize: F.xs, opacity: active ? 0.7 : 0.5 }}>{count}</span>
    </button>
  );
}

/*
 * Cards or rows. Two ways of reading the same list: a card gives a tool room to
 * describe itself, which is exactly what makes four of them hard to hold side
 * by side, and a row gives up the description to line the facts up in columns.
 */
function ViewToggle({ view, onView }) {
  return (
    <div role="group" aria-label="Layout" className="flex" style={{
      border: `1px solid ${C.line}`, borderRadius: R.control, overflow: "hidden",
    }}>
      {[["grid", "Grid"], ["list", "List"]].map(([v, label]) => {
        const on = view === v;
        return (
          <button key={v} onClick={() => onView(v)} aria-pressed={on}
            style={{
              background: on ? C.text : C.panel, color: on ? C.bg : C.muted,
              border: 0, padding: "8px 14px", fontSize: F.sm, fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit",
            }}>{label}</button>
        );
      })}
    </div>
  );
}

/*
 * The comparison view. Every column sorts, because a column you can see but
 * cannot order by is a column you have to compare with your finger on the
 * screen. Clicking a header again reverses it.
 *
 * This does not replace the compare modal: that one takes two to four tools and
 * lays out everything about them, including the "watch for" note. This is the
 * pass before it, where you work out which two.
 */
const LIST_COLS = [
  { key: "name", label: "Tool", w: "27%" },
  { key: "cat", label: "Category", w: "14%" },
  { key: "price", label: "Price", w: "14%" },
  { key: "free", label: "Free plan", w: "9%" },
  { key: "rating", label: "Rating", w: "12%" },
  { key: "external", label: "External", w: "12%" },
  { key: "ownership", label: "Ownership", w: "12%" },
];

function ListView({ rows, avg, reviews, sort, dir, onSort, onOpen, picked, onPick, pickFull, onAdd }) {
  const cell = { padding: "10px 12px", fontSize: F.sm, color: C.text, verticalAlign: "middle", lineHeight: 1.4 };
  return (
    <div>
      <div style={{ overflowX: "auto", border: `1px solid ${C.line}`, borderRadius: R.card, background: C.panel }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 860 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.line}` }}>
              {LIST_COLS.map((c) => {
                const on = sort === c.key;
                return (
                  <th key={c.key} scope="col" style={{ width: c.w, textAlign: "left", padding: "10px 12px" }}
                    aria-sort={on ? (dir === "asc" ? "ascending" : "descending") : "none"}>
                    <button onClick={() => onSort(c.key)}
                      title={`Sort by ${c.label.toLowerCase()}`}
                      className="inline-flex items-center"
                      style={{
                        gap: S.xs, background: "none", border: 0, padding: 0, cursor: "pointer",
                        fontFamily: "inherit", fontSize: F.xs, fontWeight: 700,
                        color: on ? C.text : C.dim, whiteSpace: "nowrap",
                      }}>
                      {c.label}
                      <span aria-hidden="true" style={{ opacity: on ? 1 : 0.3, display: "inline-flex" }}>
                        {on && dir === "asc" ? <CaretUp size={9} weight="fill" /> : <CaretDown size={9} weight="fill" />}
                      </span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((t, i) => {
              const col = catOf(t.cat).color;
              const n = (reviews[t.id] || []).length;
              const isPicked = picked.includes(t.id);
              const full = pickFull(t.id);
              return (
                <tr key={t.id} style={{ background: i % 2 ? C.stripe : "transparent" }}>
                  <td style={cell}>
                    <div className="flex items-center" style={{ gap: S.sm }}>
                      <button
                        onClick={() => onPick(t.id)}
                        disabled={full}
                        aria-pressed={isPicked}
                        title={full ? "Four tools maximum" : isPicked ? "Remove from comparison" : "Add to comparison"}
                        style={{
                          flexShrink: 0, width: 20, height: 20, borderRadius: R.control, padding: 0,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          background: isPicked ? C.accent : "transparent",
                          border: `1px solid ${isPicked ? C.accent : C.line}`,
                          color: isPicked ? C.onAccent : C.dim,
                          cursor: full ? "not-allowed" : "pointer", opacity: full ? 0.4 : 1,
                          fontSize: F.xs, fontWeight: 800, lineHeight: 1, fontFamily: "inherit",
                        }}>{isPicked ? <Check size={12} weight="bold" /> : <Plus size={12} weight="bold" />}</button>
                      {/* The spine, turned on its side. Same job as on a card. */}
                      <span aria-hidden="true" style={{ width: 3, height: 20, borderRadius: 2, background: col, flexShrink: 0 }} />
                      <Logo tool={t} size={20} />
                      <button onClick={() => onOpen(t.id)} style={{
                        background: "none", border: 0, padding: 0, cursor: "pointer", fontFamily: "inherit",
                        fontSize: F.md, fontWeight: 700, color: C.text, textAlign: "left",
                        letterSpacing: TRACK.tight,
                      }}>{t.name}</button>
                      {t.dying && <Pill tone="warn">winding down</Pill>}
                      <NotShopifyOnly tool={t} />
                    </div>
                  </td>
                  <td style={{ ...cell, fontSize: F.xs, color: ink(col) }}>{catOf(t.cat).label}</td>
                  <td style={{ ...cell, color: C.muted }}>{t.price}</td>
                  <td style={cell}>{t.free ? "Yes" : ""}</td>
                  <td style={cell}>
                    <span className="inline-flex items-center" style={{ gap: S.xs }}>
                      <Stars value={Math.round(avg(t.id))} size={12}
                        onPick={(r) => onOpen(t.id, r)} title={`Rate ${t.name}`} />
                      {n > 0 && <span style={{ fontSize: F.xs, color: C.dim }}>{n}</span>}
                    </span>
                  </td>
                  <td style={cell}><ExternalRatings ratings={t.ratings} /></td>
                  <td style={{ ...cell, fontSize: F.xs, color: C.muted }}>{ownershipOf(t)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <button onClick={onAdd} style={{
        width: "100%", marginTop: S.md, background: C.invite, border: `1px dashed ${C.accentEdge}`,
        borderRadius: R.card, padding: "12px 16px", fontSize: F.sm, color: C.text,
        cursor: "pointer", fontFamily: "inherit", textAlign: "left",
      }}>
        <b>Not finding it?</b>{" "}
        <span style={{ color: C.muted }}>This list is missing things by definition. Add a tool.</span>
      </button>
    </div>
  );
}

/*
 * Everything true about a tool that is not its price, as one line.
 *
 * Neutral on purpose and restated here rather than in `Pill`: these are
 * attributes, and category colour is the only colour on this page that means
 * anything. Nothing is dropped for tidiness - an unverified listing says so on
 * the card, not only in the detail view.
 */
function Facts({ tool }) {
  const facts = [
    tool.free && "free plan",
    tool.suite && `part of ${tool.suite}`,
    tool.linked && `same owner as ${tool.linked}`,
    tool.owner && `by ${tool.owner}`,
    tool.claimed && "claimed",
    !tool.verified && "unverified",
  ].filter(Boolean);
  if (!facts.length) return null;
  return (
    <span className="flex flex-wrap items-baseline" style={{ gap: S.sm, fontSize: F.xs, color: C.muted }}>
      {facts.map((f, i) => (
        <span key={f} className="inline-flex items-baseline" style={{ gap: S.sm }}>
          {i > 0 && <span aria-hidden="true" style={{
            width: 1, height: 9, background: C.edge, display: "inline-block", opacity: 0.7,
          }} />}
          {f}
        </span>
      ))}
    </span>
  );
}

/*
 * `onOpen(rating)` — called with nothing to just open the tool, and with a
 * number when the person clicked a star, which opens the review form with that
 * rating already picked. Liking a tool never needed a second screen; rating
 * one should not either.
 */
function Card({ tool, avg, reviewCount, votes, myVote, onVote, onOpen, picked, onPick, pickFull }) {
  const col = catOf(tool.cat).color;
  return (
    <div className="card flex flex-col" style={{
      background: C.panel, border: `1px solid ${picked ? C.accentEdge : C.line}`,
      borderRadius: R.card, overflow: "hidden", position: "relative",
    }}>
      <div style={{ height: 3, background: col }} />
      <div className="flex flex-col p-4" style={{ flex: 1 }}>
        <div className="flex items-start" style={{ gap: S.md }}>
          <Logo tool={tool} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="flex items-baseline flex-wrap" style={{ gap: S.sm }}>
              {/* Called with no argument on purpose: onOpen's first argument is
                  a star rating, and a click event is not one. */}
              <button onClick={() => onOpen()} style={{
                background: "none", border: 0, padding: 0, cursor: "pointer", fontFamily: "inherit",
                fontSize: F.lg, fontWeight: 700, color: C.text, letterSpacing: TRACK.tight, textAlign: "left",
              }}>{tool.name}</button>
              {tool.dying && <Pill tone="warn">winding down</Pill>}
              <NotShopifyOnly tool={tool} />
            </div>
            <p style={{ fontSize: F.xs, color: ink(col), marginTop: 2 }}>{catOf(tool.cat).label}</p>
          </div>
          <button
            onClick={onPick}
            disabled={pickFull}
            aria-pressed={picked}
            title={pickFull ? "Four tools maximum" : picked ? "Remove from comparison" : "Add to comparison"}
            style={{
              flexShrink: 0, width: 22, height: 22, borderRadius: R.control, padding: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: picked ? C.accent : "transparent",
              border: `1px solid ${picked ? C.accent : C.line}`,
              color: picked ? C.onAccent : C.dim,
              cursor: pickFull ? "not-allowed" : "pointer",
              opacity: pickFull ? 0.4 : 1,
              fontSize: F.xs, fontWeight: 800, lineHeight: 1, fontFamily: "inherit",
            }}
          >
            {picked ? <Check size={13} weight="bold" /> : <Plus size={13} weight="bold" />}
          </button>
        </div>

        {/* The most useful line on the card, so it is set in the text colour
            rather than the muted one it used to share with the metadata. */}
        <p style={{ fontSize: F.md, color: C.text, lineHeight: 1.5, flex: 1, marginTop: S.md }}>{tool.one}</p>

        {/*
          * Price, then the facts.
          *
          * These were six outlined pills. Once they all went neutral the row
          * became six identical grey capsules, which is a lot of chrome to say
          * "$49, free tier, unverified" - the border was drawing more attention
          * than the words inside it. Same facts, set as type, with the price
          * given the weight it earns and the rest reading as one line.
          */}
        <div className="flex flex-wrap items-baseline" style={{ gap: S.sm, marginTop: S.md }}>
          <span className="tnum" style={{ fontSize: F.sm, fontWeight: 700, color: C.text }}>{tool.price}</span>
          <Facts tool={tool} />
        </div>

        <div className="flex items-center justify-between" style={{
          borderTop: `1px solid ${C.line}`, gap: S.sm, marginTop: S.md, paddingTop: S.md,
        }}>
          {/* min-height reserves the row before the vote and review tallies
              arrive from /api/data, so the card does not reflow under the
              pointer a beat after it paints. */}
          <div className="flex items-center" style={{ gap: S.sm, minHeight: 26 }}>
            <Stars value={Math.round(avg)} onPick={(n) => onOpen(n)}
              title={`Rate ${tool.name}`} />
            {reviewCount > 0 && (
              <button onClick={() => onOpen()} className="tnum" style={{
                background: "none", border: 0, padding: 0, cursor: "pointer", fontFamily: "inherit",
                fontSize: F.xs, color: C.dim,
              }}>{reviewCount} {reviewCount === 1 ? "review" : "reviews"}</button>
            )}
          </div>
          <div className="flex items-center" style={{ gap: S.xs }}>
            <Vote dir={1} active={myVote === 1} n={votes.up} onClick={() => onVote(1)} />
            <Vote dir={-1} active={myVote === -1} n={votes.down} onClick={() => onVote(-1)} />
          </div>
        </div>

        {/* One trailing row, not three. External scores sit beside the links
            because they are both "somewhere else you can read about this". */}
        <div className="flex flex-wrap items-center" style={{ gap: S.md, marginTop: S.md }}>
          <ExternalRatings ratings={tool.ratings} />
          <Social social={tool.social} />
          <span style={{ marginLeft: "auto" }}><VisitSite url={tool.url} /></span>
        </div>
      </div>
    </div>
  );
}

function Vote({ dir, active, n, onClick }) {
  /* Liking is an action, so the active state is the action colour. Disliking
     is the same action pointed the other way, not a warning, so it is neutral. */
  const on = dir === 1
    ? { background: C.accent, color: C.onAccent, border: C.accent }
    : { background: C.text, color: C.bg, border: C.text };
  const Icon = dir === 1 ? ThumbsUp : ThumbsDown;
  return (
    <button onClick={onClick} aria-pressed={active} aria-label={dir === 1 ? "Like" : "Dislike"}
      className="press flex items-center tnum" style={{
        gap: S.xs, background: active ? on.background : C.subtle,
        color: active ? on.color : C.muted,
        border: `1px solid ${active ? on.border : C.line}`, borderRadius: R.control,
        padding: "4px 8px", fontSize: F.xs, cursor: "pointer", fontFamily: "inherit", fontWeight: 600,
      }}>
      <Icon size={13} weight={active ? "fill" : "regular"} /><span>{n}</span>
    </button>
  );
}

/* ================================================================== */
function CloseButton({ onClose }) {
  return (
    <button onClick={onClose} aria-label="Close" className="press" style={{
      background: C.subtle, border: `1px solid ${C.line}`, color: C.muted,
      borderRadius: R.control, width: 30, height: 30, cursor: "pointer",
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0, fontFamily: "inherit",
    }}><X size={15} weight="bold" /></button>
  );
}

function Shell({ children, onClose, width = 860 }) {
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 60, background: C.scrim,
      backdropFilter: "blur(6px)", overflowY: "auto", padding: "32px 16px",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        maxWidth: width, margin: "0 auto", background: C.panel,
        border: `1px solid ${C.line}`, borderRadius: R.modal,
        boxShadow: C.shadowLg, overflow: "hidden",
      }}>{children}</div>
    </div>
  );
}

function DetailModal({ tool, onClose, reviews, onReview, avg, votes, myVote, onVote, session, refreshSession, onTools, initialRating = 0 }) {
  const col = catOf(tool.cat).color;
  return (
    <Shell onClose={onClose} width={760}>
      <div style={{ height: 4, background: col }} />
      <div style={{ padding: S["2xl"] }}>
        <div className="flex items-start" style={{ gap: S.lg }}>
          <Logo tool={tool} size={46} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontSize: F["2xl"], fontWeight: 800, margin: 0, letterSpacing: TRACK.tighter }}>{tool.name}</h2>
            <p style={{ fontSize: F.sm, color: ink(col), marginTop: S.xs }}>{catOf(tool.cat).label}</p>
          </div>
          <CloseButton onClose={onClose} />
        </div>

        <div className="flex flex-wrap items-baseline" style={{ gap: S.md, marginTop: S.lg }}>
          <span className="tnum" style={{ fontSize: F.md, fontWeight: 700, color: C.text }}>{tool.price}</span>
          <Facts tool={tool} />
          {tool.dying && <Pill tone="warn">winding down</Pill>}
          <NotShopifyOnly tool={tool} />
        </div>

        <p className="mt-4" style={{ fontSize: F.lg, lineHeight: 1.62, maxWidth: "68ch" }}>{tool.note}</p>
        <p className="mt-3" style={{ fontSize: F.md, lineHeight: 1.6, maxWidth: "68ch", color: C.muted }}>
          <span style={{ color: C.warnInk, fontWeight: 700 }}>Watch for. </span>{tool.watch}
        </p>
        {tool.claimed && (
          <p className="mt-2" style={{ fontSize: F.xs, color: C.dim, lineHeight: 1.55, maxWidth: "68ch" }}>
            The summary, description and pricing above are maintained by the vendor
            {tool.editedAt ? `, last updated ${tool.editedAt}` : ""}. The "watch for" note and the
            ratings are not theirs to edit.
          </p>
        )}

        {tool.ratings?.length > 0 && (
          <div className="mt-5">
            <p style={{ fontSize: F.xs, color: C.dim, margin: 0, fontWeight: 600 }}>External ratings</p>
            <div className="mt-2">
              <ExternalRatings ratings={tool.ratings} detail />
            </div>
            <p style={{ fontSize: F.xs, color: C.dim, margin: "8px 0 0", maxWidth: "68ch", lineHeight: 1.5 }}>
              Collected on other platforms, from a different set of people than the reviews below, and
              deliberately not averaged with them. Follow a link to read them at source.
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center mt-5" style={{ gap: S.lg }}>
          <VisitSite url={tool.url} size={F.md}>{tool.domain}</VisitSite>
          <Social social={tool.social} />
          <div className="flex items-center" style={{ gap: S.xs, marginLeft: "auto" }}>
            <Vote dir={1} active={myVote === 1} n={votes.up} onClick={() => onVote(1)} />
            <Vote dir={-1} active={myVote === -1} n={votes.down} onClick={() => onVote(-1)} />
          </div>
        </div>

        <OwnerPanel tool={tool} session={session} refresh={refreshSession} onTools={onTools} />

        <div className="mt-6" style={{ background: C.raised, border: `1px solid ${C.line}`, borderRadius: R.card, padding: S.lg }}>
          <ReviewForm toolId={tool.id} name={tool.name} onSubmit={onReview} initialRating={initialRating}
            session={session} existing={reviews.find((r) => r.mine) || null} />
          {reviews.length > 0 && (
            <div className="mt-5 flex flex-col" style={{ gap: S.md }}>
              {reviews.map((r) => (
                <div key={r.id} style={{ borderTop: `1px solid ${C.line}`, paddingTop: S.md }}>
                  <div className="flex items-baseline flex-wrap" style={{ gap: S.sm }}>
                    <Stars value={r.rating} size={F.sm} />
                    <span style={{ fontSize: F.sm, fontWeight: 600 }}>{r.author}</span>
                    <span style={{ fontSize: F.xs, color: C.dim }}>
                      {r.date}{r.editedAt && r.editedAt !== r.date ? `, edited ${r.editedAt}` : ""}
                    </span>
                    {/* Only ever true for the person reading it: the server
                        sets it from their own session and never stores it. */}
                    {r.mine && <span style={{ fontSize: F.xs, color: C.accentInk, fontWeight: 600 }}>yours</span>}
                  </div>
                  {r.text && <p className="mt-1" style={{ fontSize: F.md, lineHeight: 1.55, color: C.muted, maxWidth: "64ch" }}>{r.text}</p>}
                </div>
              ))}
            </div>
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
    background: C.field, border: `1px solid ${C.line}`, borderRadius: R.control,
    padding: "8px 12px", fontSize: F.md, color: C.text, fontFamily: "inherit", width: "100%",
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
      <p className="mt-5" style={{ fontSize: F.sm, color: C.muted, lineHeight: 1.55 }}>
        Thanks. That is with the editor, and nothing changes on the listing until someone has checked it.
      </p>
    );
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{
        background: "none", border: 0, padding: 0, marginTop: S.xl, cursor: "pointer",
        fontFamily: "inherit", fontSize: F.xs, color: C.dim, textDecoration: "underline",
      }}>Report a problem with this listing</button>
    );
  }

  return (
    <div className="mt-5" style={{ border: `1px dashed ${C.line}`, borderRadius: R.card, padding: S.lg }}>
      <div className="flex items-baseline justify-between" style={{ gap: S.md }}>
        <p style={{ fontSize: F.sm, fontWeight: 700, margin: 0 }}>Report a problem with {tool.name}</p>
        <button onClick={() => setOpen(false)} style={{
          background: "none", border: 0, padding: 0, cursor: "pointer",
          fontFamily: "inherit", fontSize: F.xs, color: C.dim,
        }}>Cancel</button>
      </div>

      <div className="flex flex-wrap items-start mt-3" style={{ gap: S.sm }}>
        <select value={kind} onChange={(e) => { setKind(e.target.value); setErr(""); }}
          style={{ ...field, width: 210 }}>
          {REPORT_KINDS.map((k) => (
            <option key={k.id} value={k.id} style={{ background: C.panel }}>{k.label}</option>
          ))}
        </select>
        <GrowText value={value} onChange={(e) => setValue(e.target.value)} onSubmit={submit}
          placeholder={spec.hint} style={{ ...field, flex: 1, minWidth: 220 }} />
      </div>

      <div className="flex flex-wrap items-center mt-2" style={{ gap: S.sm }}>
        <input value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="Your email (optional)" style={{ ...field, width: 240 }} />
        <button onClick={submit} disabled={busy} className="press" style={{
          background: busy ? C.subtle : C.accent, color: busy ? C.dim : C.onAccent,
          border: 0, borderRadius: R.control, padding: "8px 16px", fontSize: F.sm, fontWeight: 700,
          cursor: busy ? "default" : "pointer", fontFamily: "inherit",
        }}>{busy ? "Sending…" : "Send report"}</button>
      </div>

      {err && <p style={{ fontSize: F.xs, color: C.badInk, margin: "8px 0 0" }}>{err}</p>}

      <p style={{ fontSize: F.xs, color: C.dim, margin: "12px 0 0", lineHeight: 1.55, maxWidth: "62ch" }}>
        This goes to the editor, not to the vendor, and nothing is applied automatically. A social
        profile you send is only added once it can be confirmed on the company's own site. We do not
        link a profile the vendor has not published themselves. Your email is optional and only used
        to follow up on this report.
      </p>
    </div>
  );
}

/*
 * `initialRating` arrives when the person clicked a star out on the card or in
 * a row. That click was the rating, so the form opens with it picked and the
 * cursor already in the text field: they carry on writing rather than starting
 * the same decision over.
 *
 * Rating needs an account. That is the credibility layer and it is meant to
 * cost something: an anonymous star is one click repeated as often as somebody
 * likes, and an average assembled that way is worse than none, because it
 * looks like evidence. The stars stay live while signed out on purpose, so the
 * click that brought somebody here is still theirs when they come back from
 * the email rather than a decision they have to make twice.
 *
 * `existing` is this account's review of this tool, when there is one. One per
 * account per tool, so the form opens on it and replaces it. A second opinion
 * about the same tool from the same person is a change of mind, not a second
 * review, and stacking them under one name reads as two people agreeing.
 */
function ReviewForm({ toolId, name, onSubmit, initialRating = 0, session = {}, existing = null }) {
  const [author, setAuthor] = useState("");
  const [rating, setRating] = useState(initialRating);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState("");
  const textRef = useRef(null);

  const signedIn = Boolean(session.signedIn);

  /*
   * What they had typed, kept across the trip through their inbox.
   *
   * Signing in from here means leaving the page, opening an email and coming
   * back, and half-written reviews do not survive that on their own. Losing
   * two sentences to a sign-in wall is the sort of thing nobody complains
   * about, they just do not come back.
   *
   * localStorage rather than a URL or the session, because it has to survive a
   * full navigation while the person is still signed out, and because it is
   * genuinely per-browser: an unposted draft is not something to store on the
   * server. Every access is wrapped, since a browser with storage blocked
   * should lose the draft and nothing else.
   */
  const draftKey = `svt:draft:${toolId}`;

  useEffect(() => {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(draftKey) || "null"); } catch {}
    if (!d) return;
    setAuthor((a) => a || d.author || "");
    setText((t) => t || d.text || "");
    /* A star clicked a moment ago on the card beats one saved earlier. */
    if (!initialRating) setRating((r) => r || d.rating || 0);
  }, [draftKey, initialRating]);

  useEffect(() => {
    /* Nothing typed yet: this fires once on mount, before the restore above
       has anything to put back, and writing here would erase the draft. */
    if (!rating && !author && !text) return;
    try { localStorage.setItem(draftKey, JSON.stringify({ rating, author, text })); } catch {}
  }, [draftKey, rating, author, text]);

  /*
   * Load whatever this account already said, once we know who they are. A
   * draft and the star they arrived on both win over it: the stored review is
   * the oldest of the three opinions, and `existing` arrives after the data
   * fetch, by which point the other two are already in state.
   */
  useEffect(() => {
    if (!existing) return;
    setRating((r) => r || existing.rating);
    setAuthor((a) => a || existing.author || "");
    setText((t) => t || existing.text || "");
  }, [existing]);

  useEffect(() => {
    if (initialRating && signedIn) textRef.current?.focus();
  }, [initialRating, signedIn]);

  const field = {
    background: C.field, border: `1px solid ${C.line}`, borderRadius: R.control,
    padding: "8px 12px", fontSize: F.md, color: C.text, fontFamily: "inherit", width: "100%",
  };

  async function submit() {
    if (!rating || busy) return;
    setBusy(true); setErr(""); setDone("");
    const res = await onSubmit(author, rating, text);
    setBusy(false);
    if (!res?.ok) { setErr(res?.error || "That did not save."); return; }
    /* It is posted, so it is no longer a draft. */
    try { localStorage.removeItem(draftKey); } catch {}
    setDone(existing ? "Updated. It replaced the one you left before." : "Posted. Everyone can see it.");
    setTimeout(() => setDone(""), 3200);
  }

  const heading = (
    <div className="flex flex-wrap items-center" style={{ gap: S.md }}>
      <span style={{ fontSize: F.md, fontWeight: 600 }}>
        {existing ? `Your rating of ${name}` : `Rate ${name}`}
      </span>
      <Stars value={rating} onPick={setRating} size={F.xl} title={`Rate ${name}`} />
    </div>
  );

  /* Nothing known about the visitor yet. Rendering the signed-out wall and
     then replacing it a beat later is worse than one beat of the stars. */
  if (session.loading) return heading;

  if (!signedIn) {
    return (
      <div>
        {heading}
        <div className="mt-3">
          {session.configured === false ? (
            <p style={{ fontSize: F.sm, color: C.muted, margin: 0, lineHeight: 1.55, maxWidth: "58ch" }}>
              Accounts are not enabled on this deployment, so rating is closed. Likes still work and
              do not need one.
            </p>
          ) : (
            <SignInPrompt returnTo={toolId}
              reason="Ratings need an account so they mean something. One email, no password." />
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      {heading}
      <div className="flex flex-wrap items-start mt-3" style={{ gap: S.sm }}>
        <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Your name"
          style={{ ...field, width: 150, flexShrink: 0 }} />
        <GrowText ref={textRef} value={text} onChange={(e) => setText(e.target.value)}
          onSubmit={submit}
          placeholder="What did you actually find using it?"
          style={{ ...field, flex: 1, minWidth: 200 }} />
        <button onClick={submit} disabled={!rating || busy} className="press" style={{
          background: rating && !busy ? C.accent : C.subtle, color: rating && !busy ? C.onAccent : C.dim,
          border: 0, borderRadius: R.control, padding: "8px 16px", fontSize: F.md, fontWeight: 700,
          cursor: rating && !busy ? "pointer" : "default", fontFamily: "inherit",
        }}>{busy ? "Saving…" : existing ? "Update" : "Post"}</button>
      </div>
      {!rating && <p className="mt-2" style={{ fontSize: F.xs, color: C.dim }}>Pick a star rating to post.</p>}
      <p className="mt-2" style={{ fontSize: F.xs, color: C.dim, lineHeight: 1.5, maxWidth: "62ch" }}>
        Posting as {session.email}. Your address is never shown, only the name you put above. One
        rating per account per tool, so posting again replaces this one rather than adding another.
      </p>
      {err && <p className="mt-2" style={{ fontSize: F.xs, color: C.badInk }}>{err}</p>}
      {done && <p className="mt-2" style={{ fontSize: F.xs, color: C.accentInk }}>{done}</p>}
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
  const anySocial = list.some((t) => Object.values(t.social || {}).some(Boolean));
  /* Same rule as the ratings row: only worth asking if one of them answers
     differently. A column of "Shopify only" four times over says nothing. */
  const anyGeneral = list.some((t) => t.shopifyExclusive === false);
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
      return `${v.up} up, ${v.down} down`;
    }],
    ...(anyGeneral ? [["Scope", (t) => (t.shopifyExclusive === false
      ? "General tool, not Shopify-only"
      : "Shopify only")]] : []),
    ["Status", (t) => (t.dying ? "Winding down" : "Active")],
    ["Listing maintained by", (t) => (t.claimed ? "The vendor" : "Editors")],
    ["Ownership", ownershipOf],
    ["Research source", (t) => (t.verified ? "Vendor site read directly" : "Third party, unverified")],
    ["Site", (t) => t.domain],
  ];
  const cellW = `${Math.max(24, Math.floor(66 / list.length))}%`;
  return (
    <Shell onClose={onClose} width={1000}>
      <div style={{ padding: S.xl }}>
        <div className="flex items-center justify-between" style={{ gap: S.md }}>
          <h2 style={{ fontSize: F.xl, fontWeight: 800, margin: 0, letterSpacing: TRACK.tight }}>
            Comparing {list.length} tools
          </h2>
          <CloseButton onClose={onClose} />
        </div>

        <div style={{ overflowX: "auto", marginTop: S.lg }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
            <thead>
              <tr>
                <th style={{ width: "20%" }} />
                {list.map((t) => (
                  <th key={t.id} style={{ width: cellW, textAlign: "left", padding: "0 12px 16px", verticalAlign: "bottom" }}>
                    <div className="flex items-center" style={{ gap: S.sm }}>
                      <Logo tool={t} size={30} />
                      <span style={{ fontSize: F.lg, fontWeight: 700 }}>{t.name}</span>
                    </div>
                    <div style={{ height: 3, background: catOf(t.cat).color, borderRadius: 2, marginTop: S.md }} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rowsSpec.map(([label, fn], i) => (
                <tr key={label} style={{ background: i % 2 ? C.stripe : "transparent" }}>
                  <td style={{ padding: S.md, fontSize: F.sm, color: C.dim, verticalAlign: "top", fontWeight: 600 }}>
                    {label}
                  </td>
                  {list.map((t) => (
                    <td key={t.id} style={{ padding: S.md, fontSize: F.md, color: C.text, verticalAlign: "top", lineHeight: 1.45 }}>
                      {fn(t)}
                    </td>
                  ))}
                </tr>
              ))}
              {anySocial && (
                <tr>
                  <td style={{ padding: S.md, fontSize: F.sm, color: C.dim, fontWeight: 600, verticalAlign: "top" }}>Profiles</td>
                  {list.map((t) => (
                    <td key={t.id} style={{ padding: S.md }}><Social social={t.social} /></td>
                  ))}
                </tr>
              )}
              <tr>
                <td style={{ padding: S.md, fontSize: F.sm, color: C.dim, fontWeight: 600, verticalAlign: "top" }}>Watch for</td>
                {list.map((t) => (
                  <td key={t.id} style={{ padding: S.md, fontSize: F.sm, color: C.muted, verticalAlign: "top", lineHeight: 1.5 }}>
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
/*
 * The sections that are not open yet.
 *
 * These were eight cards in a uniform grid, each ending in the same "open for
 * suggestions" pill. Eight identical cards is the shape of a feature wall, and
 * a label that is identical on all eight carries no information: it says
 * something about the section, so it is said once, at the top.
 *
 * The blurbs all survive. They are what tells someone whether they have
 * something to contribute, and they are the reason to read this at all.
 */
function Roadmap({ onSuggest }) {
  /* Not `RESOURCE_KINDS.filter(k => !k.live)`: a kind switched on with nothing
     published in it is still pending, and belongs here rather than as an empty
     section further up the page. */
  const pending = pendingKinds();
  return (
    <section style={{ paddingBottom: BAND.desktop }}>
      <h2 style={{ fontSize: F["2xl"], fontWeight: 800, letterSpacing: TRACK.tighter, lineHeight: 1.15, margin: 0 }}>
        Tools are the first section, not the whole plan
      </h2>
      <p style={{ fontSize: F.md, color: C.muted, maxWidth: "68ch", lineHeight: 1.55, marginTop: S.md }}>
        Software was the easiest part to catalogue, so it went first. The sections below are
        what the rest of the job looks like, and they open in the order people ask for them.
        Nothing in them is written yet. All of them are open for suggestions, and what gets
        suggested decides what is in them when they open.
      </p>

      <div className="roadmap" style={{ marginTop: S.xl }}>
        {pending.map((k) => (
          <button
            key={k.id}
            onClick={() => onSuggest(k.id)}
            className="press flex items-start text-left"
            style={{
              gap: S.md, background: "none", border: 0, borderTop: `1px solid ${C.line}`,
              padding: `${S.md}px 0`, cursor: "pointer", fontFamily: "inherit", color: C.text,
              width: "100%",
            }}
          >
            <span aria-hidden="true" style={{
              width: 3, alignSelf: "stretch", borderRadius: 2, background: k.color, flexShrink: 0,
            }} />
            <span style={{ minWidth: 0 }}>
              <span className="flex items-center" style={{ gap: S.xs }}>
                <span style={{ fontSize: F.md, fontWeight: 700, letterSpacing: TRACK.tight }}>{k.label}</span>
                <Plus size={11} weight="bold" color={C.dim} />
              </span>
              <span className="block" style={{ fontSize: F.sm, color: C.muted, lineHeight: 1.5, marginTop: 2 }}>
                {k.blurb}
              </span>
            </span>
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
      background: C.hero,
      border: `1px solid ${C.line}`, borderRadius: R.card, padding: S.xl,
    }}>
      <h3 style={{ fontSize: F.xl, fontWeight: 700, margin: 0, letterSpacing: TRACK.tight }}>
        Know when a section opens
      </h3>
      <p style={{ fontSize: F.md, color: C.muted, margin: "8px 0 0", maxWidth: "60ch", lineHeight: 1.55 }}>
        One email when new tools go into the directory or a section opens. That is the whole
        thing. It is not a newsletter, there is nothing to read weekly, and there is no pitch
        at the bottom.
      </p>

      <form onSubmit={submit} className="flex flex-wrap mt-4" style={{ gap: S.sm }}>
        <input
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); if (state !== "idle") setState("idle"); }}
          placeholder="you@yourapp.com"
          aria-label="Email address"
          style={{
            flex: 1, minWidth: 220, maxWidth: 340,
            background: C.field, border: `1px solid ${C.line}`, borderRadius: R.control,
            padding: S.md, fontSize: F.md, color: C.text, fontFamily: "inherit",
          }}
        />
        <button type="submit" disabled={!valid || state === "busy"} className="press" style={{
          background: valid ? C.accent : C.subtle,
          color: valid ? C.onAccent : C.dim, border: 0, borderRadius: R.control,
          padding: "12px 20px", fontSize: F.md, fontWeight: 700,
          cursor: valid && state !== "busy" ? "pointer" : "default", fontFamily: "inherit",
        }}>
          {state === "busy" ? "Adding…" : "Keep me posted"}
        </button>
      </form>

      {state === "done" && (
        <p className="mt-2" style={{ fontSize: F.sm, color: C.accentInk }}>
          Done. You will hear from me when something actually changes.
        </p>
      )}
      {state === "error" && (
        <p className="mt-2" style={{ fontSize: F.sm, color: C.badInk }}>{msg || "That did not go through."}</p>
      )}

      <p className="mt-3" style={{ fontSize: F.xs, color: C.dim, maxWidth: "60ch", lineHeight: 1.6 }}>
        Your address is not shared or sold, and it is not passed to any tool listed here.
        It is used for that one email and nothing else. Reply to any of them to be removed.
      </p>
    </div>
  );
}

function SuggestModal({ suggestions, initialKind, initialWhy = "", onAdd, onOpenTool, onClose }) {
  const [kind, setKind] = useState(kindOf(initialKind).id);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [cat, setCat] = useState(CATEGORIES[0].id);
  const [why, setWhy] = useState(initialWhy);
  const [by, setBy] = useState("");
  const [byEmail, setByEmail] = useState("");
  const [busy, setBusy] = useState(false);
  /*
   * Three outcomes, not one. A submission can be filed, it can turn out to be
   * something already in the directory, or it can be the fourth person to ask
   * for the same thing. Answering all three with "Added. Thank you." is how
   * people ended up suggesting Wappalyzer over and over: nothing they were
   * told distinguished a new row from a repeat.
   */
  const [result, setResult] = useState(null);
  const field = {
    background: C.field, border: `1px solid ${C.line}`, borderRadius: R.control,
    padding: "8px 12px", fontSize: F.md, color: C.text, fontFamily: "inherit", width: "100%",
  };
  const submit = async () => {
    if (!name.trim() || busy) return;
    setBusy(true); setResult(null);
    const res = await onAdd({
      kind, name: name.trim(), url: url.trim(), cat, why: why.trim(),
      by: by.trim() || "Anonymous", email: byEmail.trim(),
    });
    setBusy(false);
    if (!res?.ok) { setResult({ error: res?.error || "That did not save." }); return; }
    setResult(res.alreadyListed ? { listed: res.alreadyListed }
      : res.duplicate ? { duplicate: res.duplicate }
        : { added: true });
    /* An already-listed answer keeps what they typed, so they can correct a
       near-miss rather than retype it. The other two are finished with. */
    if (!res.alreadyListed) { setName(""); setUrl(""); setWhy(""); }
  };
  return (
    <Shell onClose={onClose} width={880}>
      <div style={{ padding: S["2xl"] }}>
        <div className="flex items-center justify-between" style={{ gap: S.md }}>
          <h2 style={{ fontSize: F.xl, fontWeight: 800, margin: 0, letterSpacing: TRACK.tight }}>
            {kind === "tool" ? "Suggest a tool" : `Suggest something for ${kindOf(kind).label.toLowerCase()}`}
          </h2>
          <CloseButton onClose={onClose} />
        </div>

        <div className="flex flex-col md:flex-row mt-4" style={{ gap: S["2xl"] }}>
          <div style={{ flex: 1 }}>
            <div className="flex flex-wrap" style={{ gap: S.sm, marginBottom: S.lg }}>
              {RESOURCE_KINDS.map((k) => {
                const on = k.id === kind;
                return (
                  <button key={k.id} type="button" onClick={() => setKind(k.id)} aria-pressed={on}
                    style={{
                      background: on ? k.color : C.subtle,
                      color: on ? C.onAccent : C.text,
                      border: `1px solid ${on ? k.color : C.line}`, borderRadius: R.pill,
                      padding: "4px 12px", fontSize: F.xs, fontWeight: on ? 700 : 500,
                      cursor: "pointer", fontFamily: "inherit",
                    }}>{k.label}</button>
                );
              })}
            </div>
            <p style={{ fontSize: F.md, color: C.muted, lineHeight: 1.5, marginBottom: S.lg }}>
              {kind === "tool"
                ? "Built something, or use something that belongs here? Add it. Suggestions are public and go into the directory after a check."
                : "This section is not open yet. What gets suggested decides what is in it when it opens, and how soon that happens. Suggestions are public."}
            </p>
            <div className="flex flex-col" style={{ gap: S.sm }}>
              <input style={field} value={name} onChange={(e) => setName(e.target.value)}
                placeholder={kind === "tool" ? "Tool name" : "Name"} />
              <input style={field} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
              {kind === "tool" && (
                <select style={field} value={cat} onChange={(e) => setCat(e.target.value)}>
                  {CATEGORIES.map((c) => <option key={c.id} value={c.id} style={{ background: C.panel }}>{c.label}</option>)}
                </select>
              )}
              <GrowText value={why} onChange={(e) => setWhy(e.target.value)} onSubmit={submit}
                rows={3}
                style={field}
                placeholder={kind === "tool"
                  ? "What does it do, and what problem does it solve better than the alternatives?"
                  : "What is it, and why is it worth an app vendor's time?"} />
              <div className="flex flex-wrap" style={{ gap: S.sm }}>
                <input style={{ ...field, width: 170 }} value={by} onChange={(e) => setBy(e.target.value)} placeholder="Your name" />
                <input style={{ ...field, width: 220 }} value={byEmail} onChange={(e) => setByEmail(e.target.value)}
                  placeholder="Your email (optional)" />
              </div>
              <p style={{ fontSize: F.xs, color: C.dim, margin: "0px 0 0", lineHeight: 1.5 }}>
                An email only gets you a note when this is looked at. It is not added to the mailing list.
              </p>
              <button onClick={submit} disabled={!name.trim() || busy} className="press" style={{
                alignSelf: "flex-start", background: name.trim() && !busy ? C.accent : C.subtle,
                color: name.trim() && !busy ? C.onAccent : C.dim, border: 0, borderRadius: R.control,
                padding: "12px 20px", fontSize: F.md, fontWeight: 700,
                cursor: name.trim() && !busy ? "pointer" : "default", fontFamily: "inherit",
              }}>{busy ? "Checking…" : "Add suggestion"}</button>
              <SuggestResult result={result} onOpenTool={onOpenTool} onClose={onClose} />
            </div>
          </div>

          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: F.lg, fontWeight: 700, margin: 0 }}>
              Suggested so far <span style={{ color: C.dim, fontWeight: 500 }}>{suggestions.length}</span>
            </h3>
            {suggestions.length === 0 ? (
              <p className="mt-3" style={{ fontSize: F.md, color: C.muted, lineHeight: 1.55, maxWidth: "44ch" }}>
                Nothing yet. Known gaps: the email and lifecycle layer Mantle also covered, anything
                aimed at agencies rather than app vendors, and general tools an app vendor really
                does reach for, which get listed and badged rather than left out.
              </p>
            ) : (
              <div className="mt-3 flex flex-col">
                {suggestions.map((s) => (
                  <div key={s.id} style={{ borderTop: `1px solid ${C.line}`, padding: "12px 0" }}>
                    <div className="flex flex-wrap items-baseline" style={{ gap: S.sm }}>
                      <span style={{ fontSize: F.lg, fontWeight: 700 }}>{s.name}</span>
                      {s.kind && s.kind !== "tool"
                        ? <span style={{ fontSize: F.xs, color: ink(kindOf(s.kind).color) }}>{kindOf(s.kind).label}</span>
                        : <span style={{ fontSize: F.xs, color: ink(catOf(s.cat).color) }}>{catOf(s.cat).label}</span>}
                    </div>
                    {s.why && <p className="mt-1" style={{ fontSize: F.sm, color: C.muted, lineHeight: 1.5, maxWidth: "50ch" }}>{s.why}</p>}
                    <p className="mt-1" style={{ fontSize: F.xs, color: C.dim }}>
                      {s.by} · {s.date}
                      {s.url && <>{" "}<a href={outbound(s.url)} target="_blank" rel="noopener noreferrer" style={{ color: C.muted }}>{s.url.replace(/^https?:\/\//, "")}</a></>}
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

/*
 * What happened to a submission, in the submitter's terms.
 *
 * Already listed is the useful one: the answer they wanted is the link, and
 * they were about to wait for an editor to send it to them. Opening the
 * listing from here rather than linking out keeps them on the page they are
 * already looking at, and closes the form behind them.
 */
function SuggestResult({ result, onOpenTool, onClose }) {
  if (!result) return null;
  if (result.error) {
    return <p style={{ fontSize: F.xs, color: C.badInk, margin: 0 }}>{result.error}</p>;
  }
  if (result.added) {
    return <p style={{ fontSize: F.xs, color: C.accentInk, margin: 0 }}>Added. Thank you.</p>;
  }
  if (result.duplicate) {
    const { name, count } = result.duplicate;
    return (
      <p style={{ fontSize: F.sm, color: C.muted, margin: 0, lineHeight: 1.55, maxWidth: "52ch" }}>
        <b style={{ color: C.text }}>{name}</b> was already on the list, so this went on the entry
        that is there rather than starting a second one. <b style={{ color: C.text }}>{count}</b>{" "}
        people have asked for it now, and that number is the part we act on.
      </p>
    );
  }
  const { listed } = result;
  return (
    <div>
      <p style={{ fontSize: F.sm, color: C.muted, margin: 0, lineHeight: 1.55, maxWidth: "52ch" }}>
        <b style={{ color: C.text }}>{listed.name}</b> is already in the directory, so nothing was
        filed. If you meant something else, change the name or the URL and send it again.
      </p>
      <div className="flex flex-wrap items-center mt-3" style={{ gap: S.sm }}>
        {listed.kind === "tool" && onOpenTool ? (
          <button onClick={() => { onClose(); onOpenTool(listed.id); }} className="press" style={{
            background: C.text, color: C.bg, border: 0, borderRadius: R.control,
            padding: "8px 16px", fontSize: F.sm, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
          }}>Read the {listed.name} entry</button>
        ) : (
          listed.url && <VisitSite url={listed.url} size={F.sm}>Go to {listed.name}</VisitSite>
        )}
      </div>
    </div>
  );
}
