"use client";

import React, { useState, useEffect, useMemo, useRef, useImperativeHandle } from "react";
import {
  Star, ThumbsUp, ThumbsDown, Check, Plus, X, CaretUp, CaretDown, Rows,
  LinkedinLogo, XLogo, GithubLogo, YoutubeLogo, ArrowUpRight,
} from "@phosphor-icons/react";
import { outbound } from "@/lib/outbound";
import { pendingKinds } from "@/lib/sections";
import { byHelpfulness, ratingStats, RATING_POLICY, exclusionNote } from "@/lib/reviews";
import { Pill } from "./Pill";
import CopyLink from "./CopyLink";
import GrowText from "./GrowText";
import Vote from "./Vote";
import VisitSite from "./VisitSite";
import { OwnerFact, AlsoFrom } from "./OwnerLine";
import StructuredDetails from "./StructuredDetails";
import { toQuery, passes } from "@/lib/directoryFilters";
import QA from "./QA";
import VendorMedia from "./VendorMedia";
import SaveToList from "./SaveToList";
import { INTEGRATIONS, attributesFor, attributeValue, formatValue, integrationLabel } from "@/lib/categories";
import { launchLabel, launchKey, launchCell, launchedWithinYear } from "@/lib/launched";
import { ownershipOf as resolveOwnership } from "@/lib/owners";
import { editorUseBadge, editorUseRank, hasEditorUse, editorUsePolicy } from "@/lib/editorUse";
import { C, S, R, F, TRACK, BAND, ink, CATEGORIES, TOOLS, RESOURCE_KINDS, REPORT_KINDS, SOCIALS, reportKindOf, reportKindsFor, catOf, kindOf, formatDay, LAST_UPDATED, AUTHOR, AUTHOR_URL, HEADLINE, ownerOf, catsOf, priceLine, secondaryCats, isInCat, isPrimaryCat, recommendable } from "@/lib/tools";
import { OwnerPanel, SignInPrompt, useSession } from "./Account";
import Ask from "./Ask";
import { useFeedForCount } from "./SiteFrame";
import { useDirectoryFilters, setDirectoryFilters, usePublishPanel, useMatcherOpen } from "./ListingParams";

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
const statQueue = { tools: [], matcher: 0, queries: [], sections: [] };
let statTimer = null;

function flushStats() {
  if (typeof window === "undefined") return;
  if (statTimer) { clearTimeout(statTimer); statTimer = null; }
  if (!statQueue.tools.length && !statQueue.matcher && !statQueue.queries.length && !statQueue.sections.length) return;

  const payload = JSON.stringify(statQueue);
  statQueue.tools = []; statQueue.matcher = 0; statQueue.queries = []; statQueue.sections = [];

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

/* A view of a section: the directory on load, and Recent updates when its tab
   is opened in place, which is no navigation and so invisible to Vercel. */
function trackSection(id) {
  statQueue.sections.push(id);
  scheduleFlush();
}

if (typeof window !== "undefined") {
  // visibilitychange fires on tab switch and on close; pagehide covers Safari.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushStats();
  });
  window.addEventListener("pagehide", flushStats);
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
    <img referrerPolicy="no-referrer"
      src={step === "logo" ? tool.logo : `https://www.google.com/s2/favicons?domain=${tool.domain}&sz=128`}
      /* Names the thing rather than announcing that it is an image. It was
         empty, which is right for pure decoration and wrong here: the mark is
         the only thing identifying the tool in a row of cards to somebody
         using a screen reader, and it is what a crawler reads for the entity. */
      alt={`${tool.name} logo`}
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
          <button key={n} type="button"
            // The tooltip names the tool, but the accessible name overrides a
            // title, so the name has to be in the label itself.
            aria-label={`${title ? `${title}, ` : "Rate "}${n} star${n === 1 ? "" : "s"}`}
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

/* GrowText, the textarea for prose, lives in components/GrowText.jsx. */

/* VisitSite, the one outbound-link treatment on a card, lives in components/VisitSite.jsx. */

/*
 * How a tool relates to whoever else built it. One sentence, used by the list
 * view and the compare table so the two cannot describe the same tool
 * differently.
 */
const ownershipOf = (t) => {
  const o = resolveOwnership(t);
  if (!o) return "Independent";
  /* The owner's own product names the owner rather than "Built by" itself. */
  return o.own ? o.name : `${o.verb.charAt(0).toUpperCase()}${o.verb.slice(1)} ${o.name}`;
};

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


/*
 * Every category a tool is in, as links to the category pages.
 *
 * The primary keeps the colour and comes first, because that is the one the
 * spine is drawn in and a second coloured label competing with it is how
 * invariant A erodes. The rest follow after "also in", each in its own ink, so
 * the line says which is which without a legend.
 */
function CategoryLinks({ tool, size = F.sm }) {
  const [primary, ...rest] = catsOf(tool);
  const col = catOf(primary).color;
  return (
    <>
      <a href={`/categories/${primary}`} style={{ color: ink(col), textDecoration: "none", fontSize: size }}>
        {catOf(primary).label}
      </a>
      {rest.length > 0 && (
        <span style={{ fontSize: F.xs, color: C.dim }}>
          {"also in "}
          {rest.map((id, i) => (
            <React.Fragment key={id}>
              {i > 0 && ", "}
              <a href={`/categories/${id}`}
                style={{ color: ink(catOf(id).color), textDecoration: "none" }}>{catOf(id).label}</a>
            </React.Fragment>
          ))}
        </span>
      )}
    </>
  );
}

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

/*
 * The address bar follows the modal.
 *
 * Opening a tool used to leave the URL reading watchfor.tools, so the thing on
 * the screen had no address: it could not be linked, sent to somebody or
 * bookmarked, and a reload dropped you back at the top of the grid. The tool
 * page at /tools/[id] already existed and was reachable only by knowing to
 * middle-click a card title.
 *
 * So opening pushes that path and closing pops it. Next patches pushState and
 * replaceState (app-router.js) to copy its own internal history state onto the
 * new entry and to update the canonical URL without navigating, which is
 * exactly the arrangement wanted here: the URL becomes /tools/x, the directory
 * underneath is untouched, and nothing is refetched. Our own key rides along
 * on the same entry.
 *
 * Back closes the modal rather than leaving the site, because the entry it
 * goes back to is the one the reader was already on. Forward reopens it, since
 * the id is on the entry rather than in a variable.
 *
 * Every access is wrapped. A browser that refuses the History API should cost
 * somebody a shareable URL and nothing else.
 */
const toolPath = (id) => `/tools/${id}`;

/* The tool id on the current history entry, or null if this entry is not one
   of ours. Null is also what a browser with no history state answers, which is
   the same thing as far as anything here is concerned. */
const historyToolId = () => {
  try { return window.history.state?.svtTool || null; } catch { return null; }
};

const SORTS = {
  rating: { label: "Top rated", dir: "desc", value: (t, x) => x.avg(t.id) },
  votes: { label: "Most liked", dir: "desc", value: (t, x) => x.net(t.id) },
  name: { label: "A to Z", dir: "asc", value: (t) => t.name.toLowerCase() },
  cat: { label: "By category", dir: "asc", value: (t) => catOf(t.cat).label.toLowerCase() },
  price: { label: "By price", dir: "asc", value: (t) => priceOf(t) },
  free: { label: "Free plan first", dir: "desc", value: (t) => (t.free ? 1 : 0) },
  external: { label: "By external rating", dir: "desc", value: (t) => externalOf(t) },
  ownership: { label: "By ownership", dir: "asc", value: (t) => ownershipOf(t).toLowerCase() },
  /* Using, then used, then tested, then unset. A fact about the editor, so it
     orders the grid only when somebody asks for it (lib/editorUse.js). */
  editor: { label: "Editor use first", dir: "desc", value: (t) => editorUseRank(t) },
  /* Newest first, unknown last (an unknown date is "", which sorts below any
     date in a descending order). lib/launched.js. */
  launched: { label: "Newest first", dir: "desc", value: (t) => launchKey(t) },
};

/* The four worth browsing by. The rest are reachable from a column header. */
const SELECT_SORTS = ["rating", "votes", "name", "cat", "launched"];

/* ================================================================== */
/*  App                                                                */
/* ================================================================== */
export default function Directory({ tools: initialTools, toolTotal = 0, feed = [], newsletterCount = 0, initialVotes = {}, initialReviews = {}, owners = {}, initialFilters = {} }) {
  const [tools, setTools] = useState(initialTools || TOOLS);
  const [session, refreshSession] = useSession();
  /* From the server, so the first render is already sorted the way it will
     stay. /api/data still refreshes them, and adds `mine` for the viewer. */
  const [votes, setVotes] = useState(initialVotes);
  const [reviews, setReviews] = useState(initialReviews);
  const [mine, setMine] = useState({});
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  /*
   * Which of the two things the directory is for. The catalogue is the default
   * and always will be: somebody arriving cold has never heard of any of these
   * tools, and "Ranksy raised Starter to $79" means nothing until it does.
   */

  /*
   * Category, search, refinements, sort and view are the URL
   * (components/ListingParams.jsx). The sidebar writes it, this reads it, and
   * the server read the same parameters, so a shared filtered link renders
   * filtered in the first HTML. Only the sort direction is local: it is a
   * click on a column header, not a view anybody sends.
   */
  const f = useDirectoryFilters(initialFilters);
  const { cat, q, view } = f;
  const sort = SORTS[f.sort] ? f.sort : "rating";
  const refine = useMemo(() => ({ free: f.free, used: f.used, int: f.int, has: f.has }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [f.free, f.used, f.int.join(), f.has.join()]);
  const [dir, setDir] = useState(SORTS[sort].dir);
  useEffect(() => { setDir(SORTS[sort].dir); }, [sort]);
  const setSort = (k) => setDirectoryFilters({ sort: k });
  const setView = (v) => setDirectoryFilters({ view: v });
  /* The matcher opens from the sidebar's prompt and answers here. */
  const [matcherOpen, setMatcherOpen] = useMatcherOpen();
  const [matcherAsk, setMatcherAsk] = useState("");
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
  /* Opened from an edit link: which listing, and the finding it answers. */
  const [editIntent, setEditIntent] = useState(null);
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
   * Marking a review helpful. Server-authoritative like the review itself: it
   * can be refused (signed out, or your own review), and the answer decides
   * both the count and the order the list is then drawn in.
   */
  async function markHelpful(toolId, reviewId) {
    try {
      const res = await fetch("/api/review/helpful", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toolId, reviewId }),
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

  /* The counted reviews only (lib/reviews.js ratingStats), so a vendor's own
     review neither moves a card's stars nor lifts it up "Top rated". */
  const avg = (id) => ratingStats(reviews[id])?.value || 0;
  const net = (id) => {
    const v = votes[id] || { up: 0, down: 0 };
    return v.up - v.down;
  };

  const rows = useMemo(() => {
    /*
     * `isInCat`, not `t.cat === cat`. A tool with a secondary category appears
     * under it as well, which is the whole point of `alsoIn`: filtering to
     * Analytics & billing used to hide the two suites that are among the best
     * answers in it. The card still draws its primary colour and its primary
     * label, so the spine keeps meaning one thing.
     */
    let list = tools.filter((t) => cat === "all" || isInCat(t, cat));
    list = list.filter((t) => passes(t, refine, hasEditorUse));
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
  }, [cat, q, sort, dir, refine, votes, reviews]);

  /*
   * Clicking the column you are already sorted by reverses it; clicking a new
   * one starts it in the direction that column is usually wanted in.
   */
  const orderBy = (key) => {
    if (!SORTS[key]) return;
    if (key === sort) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else setSort(key);
  };

  const toggle = (id) =>
    setPicked((p) => p.includes(id) ? p.filter((x) => x !== id) : p.length >= 4 ? p : [...p, id]);

  const totalReviews = Object.values(reviews).reduce((a, b) => a + b.length, 0);
  const editorCount = tools.filter(hasEditorUse).length;
  /* Only integrations at least one confirmed tool has, with their counts. A
     filter that can only return nothing is not offered (rule E). */
  const integrationOptions = INTEGRATIONS
    .map((i) => ({ ...i, n: tools.filter((t) => t.structured?.integrations?.includes(i.id)).length }))
    .filter((i) => i.n > 0);
  /* The category's yes-or-no details with at least one confirmed yes. */
  const attributeOptions = cat === "all" ? [] : attributesFor(cat).filter((a) => a.type === "boolean")
    .map((a) => ({ ...a, n: tools.filter((t) => t.cat === cat && t.structured && attributeValue(a, t.structured) === true).length }))
    .filter((a) => a.n > 0);

  /* Where closing the modal returns to when it was not pushed by us. */
  const query = toQuery({ ...f, sort });

  /* What the sidebar needs to draw the filters, which only this page knows:
     the counts and the confirmed integrations come from merged data. */
  const resultCount = rows.length;
  const panel = useMemo(() => ({
    freeCount: tools.filter((t) => t.free).length, editorCount,
    recentCount: tools.filter((t) => launchedWithinYear(t)).length,
    integrations: integrationOptions, attributes: attributeOptions, resultCount,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [tools, editorCount, JSON.stringify(integrationOptions), JSON.stringify(attributeOptions), resultCount]);
  usePublishPanel("directory", panel);

  /* Arriving from the prompt on another page (/?ask=1): open the box, and take
     the parameter off so a refresh or a copied link does not reopen it. */
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const ask = params.get("ask");
      const suggest = params.get("suggest");
      const why = (params.get("why") || "").trim().slice(0, 500);
      if (ask === null && suggest === null) return;
      params.delete("ask"); params.delete("suggest"); params.delete("why");
      const rest = params.toString();
      window.history.replaceState(null, "", `/${rest ? `?${rest}` : ""}`);
      /* /?suggest=<kind>&why=<text> opens the suggest form, with the text in
         "why" (the 404 page sends people here). An unknown kind is a tool,
         the same default /api/suggest uses. */
      if (suggest !== null) {
        const kind = RESOURCE_KINDS.some((k) => k.id === suggest) ? suggest : "tool";
        setShowSuggest(why ? { kind, why } : kind);
        return;
      }
      /* /?ask=1 opens an empty box; /?ask=<question> asks it. */
      const question = ask === "1" ? "" : ask.trim().slice(0, 500);
      setMatcherAsk(question);
      setMatcherOpen(true);
      if (!question) requestAnimationFrame(() => document.getElementById("ask-q")?.focus());
    } catch { /* fine */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* `rating` is set when the person got here by clicking a star. */
  /* The header counts updates new to this browser; this page has the feed. */
  useFeedForCount(feed);

  /* One directory view per page load, counted with the rest of the batch. */
  useEffect(() => { trackSection("directory"); }, []);

  const openTool = (id, rating = 0) => {
    trackToolOpen(id); setDetail(id);
    setDetailRating(Number.isInteger(rating) ? rating : 0);
    setCompare(false);
    /* Same tool already on the entry means this is a reopen from a popstate,
       and pushing again would stack a duplicate somebody has to press back
       through twice. */
    try {
      if (historyToolId() !== id) {
        window.history.pushState({ svtTool: id }, "", toolPath(id));
      }
    } catch { /* no history API, no shareable URL, everything else unchanged */ }
  };

  /*
   * Closing goes back rather than pushing "/".
   *
   * Both put the right address in the bar; only one of them leaves a history
   * that behaves. Pushing would mean every open and close added two entries,
   * so somebody who browsed six tools has to press back thirteen times to
   * leave the page. Going back is also what the reader has already been taught
   * closing means, since back closes the modal.
   *
   * It is only safe to call because the guard is that the current entry is one
   * we pushed, which means there is an entry underneath it and that entry is
   * this page. Where we did not push, the address is corrected in place.
   */
  const closeTool = () => {
    setDetail(null);
    setDetailRating(0);
    try {
      if (historyToolId()) { window.history.back(); return; }
      if (window.location.pathname.startsWith("/tools/")) {
        window.history.replaceState({}, "", `/${query}`);
      }
    } catch { /* fine */ }
  };

  /*
   * Back and forward, in both directions. The id lives on the history entry
   * rather than in a ref, so forward reopens what back closed, and it is
   * checked against the catalogue before it opens anything for the same reason
   * the sign-in return is: an id off the URL is a string from outside.
   */
  useEffect(() => {
    const onPop = () => {
      const id = historyToolId();
      if (id && tools.some((t) => t.id === id)) { setDetail(id); setDetailRating(0); }
      else setDetail(null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [tools]);

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
   * parameters are stripped first: a refresh should not replay a sign-in, and
   * the URL people copy out of the bar should not carry one.
   *
   * Stripping before opening rather than after, because opening now pushes
   * /tools/<id> and a replaceState afterwards would overwrite that entry and
   * take the id off it with everything else. Order is the whole of it: the
   * landing URL is cleaned in place, then the modal pushes its own address on
   * top of a clean one.
   */
  useEffect(() => {
    let params;
    try { params = new URLSearchParams(window.location.search); } catch { return; }
    if (!params.has("tool") && !params.has("signin")) return;
    const id = params.get("tool");
    /* `edit=1` opens the listing with its edit form already open, for an
       admin or the owner (OwnerPanel decides), and `finding` is the monitor
       finding the edit answers, recorded on save. Stripped with the rest. */
    const wantsEdit = params.get("edit") === "1";
    const finding = params.get("finding") || "";
    params.delete("tool"); params.delete("signin"); params.delete("edit"); params.delete("finding");
    const rest = params.toString();
    try {
      window.history.replaceState(null, "", window.location.pathname + (rest ? `?${rest}` : ""));
    } catch {}
    if (id && (initialTools || TOOLS).some((t) => t.id === id)) {
      if (wantsEdit) setEditIntent({ id, finding: finding.slice(0, 80) });
      openTool(id);
    }
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
    <div className="content" style={{ color: C.text }}>
      <main id="main" tabIndex={-1} style={{ outline: "none" }}>
        {/* Ask the directory (components/Ask.jsx): the primary action, always
            open, answering from every section. The catalogue is directly below
            it, so nobody has to use it to reach the tools. */}
        <Ask key={matcherAsk} initial={matcherAsk} tools={tools} onOpenTool={openTool} onSuggest={setShowSuggest} />

        {/*
          * One row above the first card: the heading, the one-sentence
          * description, sort and the Compare toggle. Search, categories and
          * filters are in the sidebar (components/SiteFrame.jsx), and nothing
          * else sits above the grid.
          */}
        <header className="content-head">
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontSize: F["2xl"], fontWeight: 800, letterSpacing: TRACK.tighter, lineHeight: 1.15, margin: 0 }}>
              {cat === "all" ? HEADLINE : catOf(cat).label}
            </h1>
            <p className="tnum" style={{ fontSize: F.sm, color: C.muted, lineHeight: 1.5, margin: `${S.xs}px 0 0` }}>
              {cat === "all"
                ? `${toolTotal} tools for Shopify app builders in ${CATEGORIES.length} categories, updated ${LAST_UPDATED}.`
                : `${rows.length} of ${toolTotal} tools. ${catOf(cat).blurb}`}
            </p>
          </div>
          <div className="flex items-center" style={{ gap: S.sm }}>
            <select value={sort} aria-label="Sort tools by" className="ctl"
              onChange={(e) => setSort(e.target.value)}
              style={{
                background: C.panel, border: `1px solid ${C.line}`, borderRadius: R.control,
                padding: "8px 10px", fontSize: F.sm, color: C.text, fontFamily: "inherit",
              }}>
              {[...SELECT_SORTS, ...(editorCount > 0 ? ["editor"] : [])].map((k) => (
                <option key={k} value={k} style={{ background: C.panel }}>{SORTS[k].label}</option>
              ))}
              {/* A column header can set an order this list does not offer. Say
                  so rather than showing the wrong option as selected. */}
              {!SELECT_SORTS.includes(sort) && !(sort === "editor" && editorCount > 0) && (
                <option value={sort} style={{ background: C.panel }}>{SORTS[sort].label}</option>
              )}
            </select>
            <ViewToggle view={view} onView={setView} />
          </div>
        </header>

        {/* The one place the site states the editor-use policy: when somebody
            is filtering or sorting by it, which is when they rely on it. */}
        {(refine.used || sort === "editor") && (
          <p style={{ fontSize: F.sm, color: C.muted, maxWidth: "70ch", lineHeight: 1.5, marginTop: S.md }}>
            {editorUsePolicy(toolTotal)}
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
        <div ref={gridRef} style={{ marginTop: S.md, paddingBottom: picked.length ? 96 : BAND.desktop }}>
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
            <div className="cards">
              {rows.map((t, i) => (
                <React.Fragment key={t.id}>
                  <Card tool={t} avg={avg(t.id)} reviewCount={(reviews[t.id] || []).length}
                    votes={votes[t.id] || { up: 0, down: 0 }} myVote={mine[t.id] || 0}
                    onVote={(d) => vote(t.id, d)} onOpen={(r) => openTool(t.id, r)}
                    picked={picked.includes(t.id)} underCat={cat} />
                  {/* In the grid, so nothing sits above the first card, and so a
                      phone sees it, where the sidebar is behind the Menu
                      button. After the first card on a phone, where a row is
                      one card; opening the second row from 768px. CSS shows
                      one of the two (.picks-narrow, .picks-wide). */}
                  {i === 0 && <PicksCard where="picks-narrow" />}
                  {i === Math.min(2, rows.length - 1) && <PicksCard where="picks-wide" />}
                </React.Fragment>
              ))}
              {/* After the cards in the markup, not first with `order: 999`. The
                  page paints while its HTML is still arriving, and as the only
                  item in the grid it painted in the first slot, then got pushed
                  down by every card that streamed in after it. */}
              <button
                onClick={() => setShowSuggest("tool")}
                className="card flex flex-col items-start justify-center text-left"
                style={{
                  background: C.invite,
                  border: `1px dashed ${C.accentEdge}`, borderRadius: R.card, padding: S.xl,
                  minHeight: 190, cursor: "pointer", fontFamily: "inherit", color: C.text,
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
      </main>

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
            <button onClick={() => setCompare(true)} disabled={picked.length < 2} className="ctl press"
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
          owner={owners[detail] || null}
          initialRating={detailRating}
          onClose={closeTool}
          reviews={reviews[detail] || []}
          onReview={(a, r, x) => addReview(detail, a, r, x)}
          onHelpful={(reviewId) => markHelpful(detail, reviewId)}
          avg={avg(detail)}
          votes={votes[detail] || { up: 0, down: 0 }}
          myVote={mine[detail] || 0}
          onVote={(d) => vote(detail, d)}
          session={session}
          refreshSession={refreshSession}
          onTools={setTools}
          startEditing={editIntent?.id === detail}
          finding={editIntent?.id === detail ? editIntent.finding : ""}
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
 * Cards or rows, as one toggle named for what the rows are for. A card gives a
 * tool room to describe itself, which is exactly what makes four of them hard
 * to hold side by side; a row gives up the description to line the facts up in
 * sortable columns, with a box per row to pick two to four for the compare
 * table. That made the list view the compare mode already, so the Compare
 * button that sat on every card moved here, once.
 */
function ViewToggle({ view, onView }) {
  const on = view === "list";
  return (
    <button type="button" onClick={() => onView(on ? "grid" : "list")} aria-pressed={on}
      title={on ? "Back to cards" : "Show as a table: sort any column and pick 2 to 4 tools to compare"}
      className="ctl press flex items-center"
      style={{
        gap: S.xs, background: on ? C.text : C.panel, color: on ? C.bg : C.text,
        border: `1px solid ${on ? C.text : C.line}`, borderRadius: R.control,
        padding: "8px 12px", fontSize: F.sm, fontWeight: 600,
        cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
      }}>
      <Rows size={15} weight={on ? "fill" : "regular"} />Compare
    </button>
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
      {/* Said once, and only until the first pick, which is when it stops
          being news. */}
      {picked.length === 0 && (
        <p style={{ fontSize: F.sm, color: C.muted, margin: `0 0 ${S.sm}px` }}>
          Tick two to four tools to compare them side by side. Click a column to sort.
        </p>
      )}
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
                      <a href={`/tools/${t.id}`}
                        onClick={(e) => {
                          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                          e.preventDefault();
                          onOpen(t.id);
                        }}
                        style={{
                          fontSize: F.md, fontWeight: 700, color: C.text, textDecoration: "none",
                          letterSpacing: TRACK.tight,
                        }}>{t.name}</a>
                      {t.dying && <Pill tone="warn">winding down</Pill>}
                      <NotShopifyOnly tool={t} />
                    </div>
                  </td>
                  {/* Rows compare, so this cell carries every category rather
                      than just the sortable one. The column still sorts on the
                      primary: a sort key with more than one value per row is
                      not a sort key. */}
                  <td style={{ ...cell, fontSize: F.xs }}>
                    <a href={`/categories/${t.cat}`}
                      style={{ color: ink(col), textDecoration: "none" }}>{catOf(t.cat).label}</a>
                    {secondaryCats(t).map((id) => (
                      <span key={id} className="block" style={{ color: C.dim, marginTop: 2 }}>
                        {"also "}
                        <a href={`/categories/${id}`}
                          style={{ color: ink(catOf(id).color), textDecoration: "none" }}>{catOf(id).label}</a>
                      </span>
                    ))}
                  </td>
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
 * anything.
 *
 * `verified` is deliberately absent. It reported our research process rather
 * than anything about the product, and next to a competitor carrying no badge
 * it read as a mark against the tool. It lives in the data and shows on /admin,
 * which is where the question "what still needs checking" is actually asked.
 */
function Facts({ tool, owner }) {
  const facts = [
    tool.free && "free plan",
    /* The owner, linked to its page when it has one. Built on the server
       (ownerContext) and nothing when the owner is the tool itself. */
    owner?.line && <OwnerFact key="owner" ctx={owner} />,
    /* Two or more only. "Suggested by 1 person" is how everything got here and
       says nothing about this one; the number is information once it is
       demand rather than provenance. Counted in lib/interest.js. */
    tool.suggestedBy >= 2 && `suggested by ${tool.suggestedBy} people`,
    launchLabel(tool, "tool"),
    tool.claimed && "claimed",
  ].filter(Boolean);
  if (!facts.length) return null;
  return (
    <span className="flex flex-wrap items-baseline" style={{ gap: S.sm, fontSize: F.xs, color: C.muted }}>
      {facts.map((f, i) => (
        <span key={typeof f === "string" ? f : i} className="inline-flex items-baseline" style={{ gap: S.sm }}>
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
 * The price line, which absorbs the free plan.
 *
 * "Free plan" was a badge sitting next to a price that usually already said
 * so: "Free, Pro $49/mo", "Free tier, then $49 / $149 / $349", "Free under $5k
 * MRR, then $25 / $99". Two elements carrying one fact, and the badge was the
 * one with a border around it.
 *
 * So the badge is gone and the sentence is completed only where the price does
 * not already say it. Where it does, this returns the price untouched, which is
 * most of the catalogue. A `dying` tool is left alone as well, because its
 * price field tends to describe the wind-down rather than a tier and "Free,
 * then winding down" is not a sentence anybody meant to write.
 */
/* priceLine, the price with a free plan folded in, lives in lib/tools.js. */

/*
 * The card, rebuilt around one question: which of these thirty do I open.
 *
 * It had accumulated a badge per feature until it carried fifteen elements,
 * none of them ranked. Everything that answers a question you only ask *after*
 * choosing is now in the detail view, which already rendered every one of them:
 * suite membership, shared ownership, claimed, unverified, "not Shopify-only",
 * external scores, social links and the vote buttons. Nothing was moved, only
 * stopped from being in both places.
 *
 * What is left is what you scan: the mark, the name, the category, what it
 * does, what it costs, what people rate it, and the control that puts it in a
 * comparison. Four lines, one weight each, and a footer.
 *
 * `onOpen(rating)` — called with nothing to just open the tool, and with a
 * number when the person clicked a star, which opens the review form with that
 * rating already picked. Liking a tool never needed a second screen; rating
 * one should not either.
 */
function Card({ tool, avg, reviewCount, votes, myVote, onVote, onOpen, picked, underCat = "all" }) {
  const col = catOf(tool.cat).color;
  /*
   * True when this card is in the grid because of a secondary category rather
   * than its own. Only then is there anything to explain: under "All", or
   * under its primary, the label already says what it is.
   *
   * It passes rule J's bar because it answers the question the grid has just
   * raised. Filtering to Support & CX and finding a card labelled "Ecosystem
   * suites" reads as a bug until it says why it is there, and "a suite that
   * also does this" versus "a company that only does this" is exactly the
   * difference you are scanning for.
   */
  const secondary = underCat !== "all" && !isPrimaryCat(tool, underCat);
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
              {/*
                * An anchor, not a button, and the href is real. Clicking still
                * opens the modal, which is the faster way to browse, but a
                * crawler needs an <a href> to follow and a person needs
                * something to copy or middle-click. preventDefault fires only
                * for a plain left click.
                */}
              {/* `.card-link`: its overlay makes the whole card open this
                  (globals.css), the same on every card in every section. */}
              <a href={`/tools/${tool.id}`} className="card-link"
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                  e.preventDefault();
                  onOpen();
                }}
                style={{
                  fontSize: F.lg, fontWeight: 700, color: C.text, letterSpacing: TRACK.tight,
                  textDecoration: "none",
                }}>{tool.name}</a>
              {/* The one badge left, and the one invariant B allows: a status
                  warning about the product rather than a label on it. It is
                  also the only thing here that tells you not to bother. */}
              {tool.dying && <Pill tone="warn">winding down</Pill>}
            </div>
            {/* A real link to the category page. The card title is an anchor
                for the same reason: a crawler follows hrefs, and a filter chip
                in a client component is not one. */}
            <p style={{ fontSize: F.xs, marginTop: 2 }}>
              <a href={`/categories/${tool.cat}`}
                onClick={(e) => e.stopPropagation()}
                style={{ color: ink(col), textDecoration: "none" }}>{catOf(tool.cat).label}</a>
              {secondary && (
                <span style={{ color: C.dim }}>{` · also in ${catOf(underCat).label}`}</span>
              )}
            </p>
          </div>
        </div>

        <p style={{ fontSize: F.md, color: C.text, lineHeight: 1.5, flex: 1, marginTop: S.md }}>{tool.one}</p>

        {/* One line, one weight, and it now carries the free plan too. */}
        <p className="tnum" style={{ fontSize: F.sm, fontWeight: 700, color: C.text, marginTop: S.md }}>
          {priceLine(tool)}
        </p>

        {/*
          * The footer: what people think, then where to go.
          *
          * Two rows rather than a scatter, each with a left and a right and
          * nothing in the middle. Rating and votes are both the community
          * answering; Visit site and saving to your list are what you do next.
          */}
        <div style={{ borderTop: `1px solid ${C.line}`, marginTop: S.md, paddingTop: S.md }}>
          <div className="flex items-center justify-between" style={{ gap: S.sm }}>
            {/* min-height reserves the row before the vote and review tallies
                arrive from /api/data, so the card does not reflow under the
                pointer a beat after it paints. */}
            <div className="flex items-center" style={{ gap: S.sm, minHeight: 26 }}>
              <Stars value={Math.round(avg)} onPick={(n) => onOpen(n)} title={`Rate ${tool.name}`} />
              {reviewCount > 0 && (
                <button onClick={() => onOpen()} className="tnum" style={{
                  background: "none", border: 0, padding: 0, cursor: "pointer", fontFamily: "inherit",
                  fontSize: F.xs, color: C.dim,
                }}>{reviewCount} {reviewCount === 1 ? "review" : "reviews"}</button>
              )}
            </div>
            <div className="flex items-center" style={{ gap: S.xs }}>
              {/* Named for the tool: 46 buttons all called "Like" are 46 identical
                  buttons to a screen reader or an agent. Same as the newsletter
                  and event cards. */}
              <Vote dir={1} active={myVote === 1} n={votes.up} onClick={() => onVote(1)} label={`Like ${tool.name}`} />
              <Vote dir={-1} active={myVote === -1} n={votes.down} onClick={() => onVote(-1)} label={`Dislike ${tool.name}`} />
            </div>
          </div>

          {/* Compare left the card: one control per card was fifty of the
              same affordance. Picking tools to compare is the list view's job
              (cards browse, rows compare), switched on once with the view
              toggle. */}
          <div className="flex items-center justify-between" style={{ gap: S.sm, marginTop: S.sm }}>
            <VisitSite url={tool.url} />
            {/* Your lists, as a bookmark. Only when signed in: it is your
                working tool, not a choice every visitor has to read past. */}
            <SaveToList toolId={tool.id} toolName={tool.name} compact />
          </div>
        </div>
      </div>
    </div>
  );
}

/*
 * Growth picks (/recommend) as a card in the grid. It looks like a card because
 * it sits among them, and it is told apart by the invite surface and the green
 * button, the action colour. No category spine: it is not a tool.
 */
function PicksCard({ where = "" }) {
  return (
    <a href="/recommend" className={`card flex flex-col items-start justify-center ${where}`}
      style={{
        background: C.invite, border: `1px solid ${C.accentEdge}`, borderRadius: R.card, padding: S.xl,
        minHeight: 190, color: C.text, textDecoration: "none",
      }}>
      <span style={{ fontSize: F.lg, fontWeight: 700, letterSpacing: TRACK.tight }}>Have an app on the App Store?</span>
      <span style={{ fontSize: F.md, color: C.muted, lineHeight: 1.5, marginTop: S.sm }}>
        Paste its listing and answer a few questions. You get up to three tools that fit your app and your budget, and what each one will not fix.
      </span>
      <span style={{
        marginTop: S.lg, background: C.accent, color: C.onAccent, borderRadius: R.control,
        padding: "8px 16px", fontSize: F.sm, fontWeight: 700,
      }}>Get my picks</span>
      <span style={{ fontSize: F.xs, color: C.dim, marginTop: S.sm }}>Free. Sign in with your email.</span>
    </a>
  );
}

/* Vote, the like and dislike control, lives in components/Vote.jsx. */

/* ================================================================== */
function CloseButton({ onClose }) {
  return (
    <button onClick={onClose} aria-label="Close" className="ctl press" style={{
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

function DetailModal({ tool, owner = null, onClose, reviews, onReview, onHelpful, avg, votes, myVote, onVote, session, refreshSession, onTools, initialRating = 0, startEditing = false, finding = "" }) {
  const col = catOf(tool.cat).color;
  /*
   * Most helpful first, most recent to break a tie. The comparator lives in
   * lib/reviews.js beside the rule it implements; sorting a copy rather than
   * the prop keeps this a display decision, which is what it is.
   */
  const ordered = useMemo(() => [...reviews].sort(byHelpfulness), [reviews]);
  return (
    <Shell onClose={onClose} width={760}>
      <div style={{ height: 4, background: col }} />
      <div style={{ padding: S["2xl"] }}>
        <div className="flex items-start" style={{ gap: S.lg }}>
          <Logo tool={tool} size={46} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontSize: F["2xl"], fontWeight: 800, margin: 0, letterSpacing: TRACK.tighter }}>{tool.name}</h2>
            {/*
              * The category, and the address of what you are looking at.
              *
              * This said "permalink" in grey, which is a word for people who
              * already know it means "the URL of this thing" and is invisible
              * to everybody else. It is a control now: it says what it does,
              * and doing it puts the link on the clipboard rather than opening
              * a second copy of the page you are reading.
              */}
            <p className="flex flex-wrap items-baseline" style={{ fontSize: F.sm, marginTop: S.xs, gap: S.md }}>
              <CategoryLinks tool={tool} />
              <CopyLink path={`/tools/${tool.id}`} title={`Copy a link to ${tool.name}`} />
            </p>
          </div>
          <CloseButton onClose={onClose} />
        </div>

        <div className="flex flex-wrap items-baseline" style={{ gap: S.md, marginTop: S.lg }}>
          <span className="tnum" style={{ fontSize: F.md, fontWeight: 700, color: C.text }}>{tool.price}</span>
          <Facts tool={tool} owner={owner} />
          {tool.dying && <Pill tone="warn">winding down</Pill>}
          <NotShopifyOnly tool={tool} />
          {editorUseBadge(tool.editorUse) && <Pill>{editorUseBadge(tool.editorUse)}</Pill>}
        </div>

        <AlsoFrom ctx={owner} />
        <p className="mt-4" style={{ fontSize: F.lg, lineHeight: 1.62, maxWidth: "68ch" }}>{tool.note}</p>
        <p className="mt-3" style={{ fontSize: F.md, lineHeight: 1.6, maxWidth: "68ch", color: C.muted }}>
          <span style={{ color: C.warnInk, fontWeight: 700 }}>Watch for. </span>{tool.watch}
        </p>
        {/* The editor's note, under the caveat. The badge is in the facts row. */}
        {editorUseBadge(tool.editorUse) && tool.editorUse.note && (
          <p className="mt-2" style={{ fontSize: F.sm, lineHeight: 1.55, maxWidth: "68ch", color: C.muted }}>
            <span style={{ fontWeight: 600, color: C.text }}>Editor's note. </span>{tool.editorUse.note}
          </p>
        )}
        {tool.claimed && (
          <p className="mt-2" style={{ fontSize: F.xs, color: C.dim, lineHeight: 1.55, maxWidth: "68ch" }}>
            The summary, description and pricing above are maintained by the vendor
            {tool.editedAt ? `, last updated ${tool.editedAt}` : ""}. The "watch for" note and the
            ratings are not theirs to edit.
          </p>
        )}

        <StructuredDetails tool={tool} />
        <VendorMedia tool={tool} />

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
          <SaveToList toolId={tool.id} toolName={tool.name} />
          <Social social={tool.social} />
          <div className="flex items-center" style={{ gap: S.xs, marginLeft: "auto" }}>
            <Vote dir={1} active={myVote === 1} n={votes.up} onClick={() => onVote(1)} label={`Like ${tool.name}`} />
            <Vote dir={-1} active={myVote === -1} n={votes.down} onClick={() => onVote(-1)} label={`Dislike ${tool.name}`} />
          </div>
        </div>

        <OwnerPanel tool={tool} session={session} refresh={refreshSession} onTools={onTools}
          startEditing={startEditing} finding={finding} />

        <div className="mt-6" style={{ background: C.raised, border: `1px solid ${C.line}`, borderRadius: R.card, padding: S.lg }}>
          <ReviewForm toolId={tool.id} name={tool.name} onSubmit={onReview} initialRating={initialRating}
            session={session} existing={reviews.find((r) => r.mine) || null} />
          {ordered.length > 0 && (
            <div className="mt-5 flex flex-col" style={{ gap: S.md }}>
              <p style={{ fontSize: F.xs, color: C.dim, lineHeight: 1.5, margin: 0 }}>{RATING_POLICY}</p>
              {ordered.map((r) => (
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
                  {exclusionNote(r) && <p className="mt-1" style={{ fontSize: F.xs, color: C.dim, margin: 0 }}>{exclusionNote(r)}</p>}
                  {r.text && <p className="mt-1" style={{ fontSize: F.md, lineHeight: 1.55, color: C.muted, maxWidth: "64ch" }}>{r.text}</p>}
                  <Helpful review={r} signedIn={Boolean(session.signedIn)}
                    onMark={() => onHelpful(r.id)} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Questions, apart from the reviews (lib/qa.js). */}
        <QA toolId={tool.id} toolName={tool.name} heading="h3" fetchOnMount />

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
        <select value={kind} aria-label="Kind of problem"
          onChange={(e) => { setKind(e.target.value); setErr(""); }}
          style={{ ...field, width: 210 }}>
          {reportKindsFor("tool").map((k) => (
            <option key={k.id} value={k.id} style={{ background: C.panel }}>{k.label}</option>
          ))}
        </select>
        <GrowText value={value} onChange={(e) => setValue(e.target.value)} onSubmit={submit}
          placeholder={spec.hint} style={{ ...field, flex: 1, minWidth: 220 }} />
      </div>

      <div className="flex flex-wrap items-center mt-2" style={{ gap: S.sm }}>
        <input value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="Your email (optional)" style={{ ...field, width: 240 }} />
        <button onClick={submit} disabled={busy} className="ctl press" style={{
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
 * Was this review useful, and the answer decides what the next person reads
 * first.
 *
 * The button exists only where it can be pressed. Signed out there is nothing
 * to press, and on your own review there never will be, so a disabled control
 * would be a thing to wonder about rather than an affordance. Both cases keep
 * the count, because the count is information either way.
 *
 * At zero, nothing renders at all. "0 found this helpful" reads as a verdict on
 * the review rather than on how many people have been past it, which is the
 * same reason an empty ratings row renders nothing.
 */
function Helpful({ review, signedIn, onMark }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const n = review.helpful || 0;
  const on = Boolean(review.helpfulByMe);
  const canVote = signedIn && !review.mine;

  async function click() {
    if (busy) return;
    setBusy(true); setErr("");
    const res = await onMark();
    setBusy(false);
    if (!res?.ok) setErr(res?.error || "That did not save.");
  }

  if (!canVote) {
    if (!n) return null;
    return (
      <p className="mt-2 tnum" style={{ fontSize: F.xs, color: C.dim, margin: `${S.sm}px 0 0` }}>
        {n} found this helpful
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center mt-2" style={{ gap: S.sm }}>
      {/* Same gesture as liking a tool, so the same active colour. */}
      <button onClick={click} aria-pressed={on} disabled={busy}
        aria-label={on ? "Remove your helpful vote" : "Mark this review helpful"}
        className="ctl press inline-flex items-center tnum" style={{
          gap: S.xs,
          background: on ? C.accent : C.panel,
          color: on ? C.onAccent : C.muted,
          border: `1px solid ${on ? C.accent : C.line}`, borderRadius: R.control,
          padding: "3px 10px", fontSize: F.xs, fontWeight: 600,
          cursor: busy ? "default" : "pointer", fontFamily: "inherit",
        }}>
        <ThumbsUp size={12} weight={on ? "fill" : "regular"} />
        Helpful{n > 0 ? ` ${n}` : ""}
      </button>
      {err && <span style={{ fontSize: F.xs, color: C.badInk }}>{err}</span>}
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
        <button onClick={submit} disabled={!rating || busy} className="ctl press" style={{
          background: rating && !busy ? C.accent : C.subtle, color: rating && !busy ? C.onAccent : C.dim,
          border: 0, borderRadius: R.control, padding: "8px 16px", fontSize: F.md, fontWeight: 700,
          cursor: rating && !busy ? "pointer" : "default", fontFamily: "inherit",
        }}>{busy ? "Saving…" : existing ? "Update" : "Post"}</button>
      </div>
      {!rating && <p className="mt-2" style={{ fontSize: F.xs, color: C.dim }}>Pick a star rating to post.</p>}
      <p className="mt-2" style={{ fontSize: F.xs, color: C.dim, lineHeight: 1.5, maxWidth: "62ch" }}>
        Posting as {session.email}. Your address is never shown, only the name you put above. One
        rating per account per tool, so posting again replaces this one rather than adding another.
        {existing?.helpful > 0 && (
          <> {existing.helpful} {existing.helpful === 1 ? "person has" : "people have"} marked this
          helpful. Changing the words clears that, because it is what they marked. Changing only the
          stars keeps it.</>
        )}
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
    /* Every category, primary first, because a compare table exists to show a
       difference and "it also does billing" is one of the bigger ones. */
    ["Category", (t) => catsOf(t).map((id) => catOf(id).label).join(", ")],
    ["What it does", (t) => t.one],
    ["Pricing", (t) => t.price],
    ["Free plan", (t) => (t.free ? "Yes" : "No")],
    ["Community rating", (t) => {
      const r = ratingStats(reviews[t.id]);
      return r ? `${r.value.toFixed(1)} from ${r.count}` : "Not rated yet";
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
    ["Launched", (t) => launchCell(t)],
    ["Listing maintained by", (t) => (t.claimed ? "The vendor" : "Editors")],
    ["Ownership", ownershipOf],
    ["Site", (t) => t.domain],
    /* Confirmed structured data (lib/categories.js). The category's comparable
       attributes only when every tool compared shares the category, because an
       ASO tool and a store database are not compared on the same things.
       Unknown shows as Unknown, and a tool not confirmed yet says so. */
    ...(list.some((t) => t.structured) && list.every((t) => t.cat === list[0].cat)
      ? attributesFor(list[0].cat).filter((a) => a.comparable).map((a) => [a.label, (t) => (t.structured ? formatValue(a, attributeValue(a, t.structured)) : "Not confirmed yet")])
      : []),
    ...(list.some((t) => t.structured) ? [["Integrations", (t) => (t.structured
      ? (t.structured.integrations.length ? t.structured.integrations.map(integrationLabel).join(", ") : "None stated")
      : "Not confirmed yet")]] : []),
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
  /*
   * The subscribe block first, then the sections still to come as one line.
   * The roadmap was a heading, a paragraph and a two-column list of blurbs:
   * a promise laid out like content. Each name still opens the suggest form
   * pointed at that section, and its blurb is the tooltip.
   */
  return (
    <section style={{ paddingBottom: BAND.desktop }}>
      <Subscribe />
      {pending.length > 0 && (
        <p style={{ fontSize: F.sm, color: C.muted, lineHeight: 1.7, margin: `${S.lg}px 0 0` }}>
          Coming later, in the order people ask for them:{" "}
          {pending.map((k, i) => (
            <React.Fragment key={k.id}>
              {i > 0 && ", "}
              <button type="button" onClick={() => onSuggest(k.id)} title={`${k.blurb} Suggest something for it.`}
                style={{
                  background: "none", border: 0, padding: 0, cursor: "pointer", fontFamily: "inherit",
                  fontSize: F.sm, color: C.text, textDecoration: "underline", textUnderlineOffset: 3,
                }}>{k.label}</button>
            </React.Fragment>
          ))}
          . Click one to suggest what goes in it.
        </p>
      )}
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
    <div style={{
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
        <button type="submit" disabled={!valid || state === "busy"} className="ctl press" style={{
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
      : res.outOfScope ? { outOfScope: res.outOfScope }
        : res.duplicate ? { duplicate: res.duplicate }
          : { added: true });
    /* An already-listed answer keeps what they typed, so they can correct a
       near-miss rather than retype it. So does an out-of-scope one, since the
       most likely reason for a wrong call is a name we read as something else.
       The other two are finished with. */
    if (!res.alreadyListed && !res.outOfScope) { setName(""); setUrl(""); setWhy(""); }
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
                <select style={field} value={cat} aria-label="Category"
                  onChange={(e) => setCat(e.target.value)}>
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
              <button onClick={submit} disabled={!name.trim() || busy} className="ctl press" style={{
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
                    {s.count > 1 && (
                      <p className="mt-1" style={{ fontSize: F.xs, color: C.accentInk, fontWeight: 600 }}>
                        Suggested by {s.count} people
                      </p>
                    )}
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
  /*
   * Not what this directory is for, said plainly and without pretending it is
   * a failure on their part. They get the boundary, where the thing actually
   * belongs, and the fact that it was kept anyway.
   */
  if (result.outOfScope) {
    return (
      <div>
        <p style={{ fontSize: F.sm, color: C.muted, margin: 0, lineHeight: 1.55, maxWidth: "52ch" }}>
          Thank you, and this one will not be listed. This directory covers tools for the people who
          build Shopify apps: rank trackers, revenue analytics, store databases, partner platforms.
          <b style={{ color: C.text }}> {result.outOfScope.name}</b> looks like a Shopify app for
          merchants running a shop. That is a different thing. It belongs in the Shopify App Store,
          where far more people will find it.
        </p>
        <p style={{ fontSize: F.xs, color: C.dim, margin: "8px 0 0", lineHeight: 1.5, maxWidth: "52ch" }}>
          We have kept a note of it. What people come here looking for is worth knowing, and if we
          have the boundary wrong we would rather hear it this way. If we have read it wrong, change
          the name or URL and send it again.
        </p>
      </div>
    );
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
        <b style={{ color: C.text }}>{listed.name}</b> is already in the directory, so there was
        nothing to add. Thank you for it anyway: asking is recorded even when the answer is a link,
        {listed.count >= 2
          ? <> and <b style={{ color: C.text }}>{listed.count}</b> people have now asked for this one.</>
          : <> and what people go looking for tells us what is hard to find.</>}
      </p>
      <p style={{ fontSize: F.xs, color: C.dim, margin: "6px 0 0", lineHeight: 1.5, maxWidth: "52ch" }}>
        If you meant something else, change the name or the URL and send it again.
      </p>
      <div className="flex flex-wrap items-center mt-3" style={{ gap: S.sm }}>
        {listed.kind === "tool" && onOpenTool ? (
          <button onClick={() => { onClose(); onOpenTool(listed.id); }} className="ctl press" style={{
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
