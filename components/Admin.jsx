"use client";

import React, { useState, useEffect, useMemo, useContext, createContext } from "react";
import { contextLine } from "@/lib/feedSource";
import { outbound } from "@/lib/outbound";
import { C, S, R, F, TRACK, ink, ALL_TOOLS, CATEGORIES, SOCIALS, catOf, kindOf, reportKindOf } from "@/lib/tools";
import { ALL_NEWSLETTERS } from "@/lib/newsletters";
import { ALL_COMMUNITIES } from "@/lib/communities";
import { ALL_PODCASTS } from "@/lib/podcasts";
import { ALL_YOUTUBE } from "@/lib/youtube";
import { ALL_AWARDS } from "@/lib/awards";
import { ALL_EVENTS } from "@/lib/events";
import { drafted, published, readiness } from "@/lib/drafts";
import { timesAsked, findDiscarded, normaliseDomain } from "@/lib/suggestions";
import { TALLIES, pendingCount } from "@/lib/tallies";
import { diffSentences, growth, GROWTH_WARN_PCT } from "@/lib/sentencediff";
import { effectiveConfidence, errorRates, CAP, VERIFICATION_LABEL, editDone } from "@/lib/findings";
import { COVERAGE_LABEL, coverageCounts, uncovered } from "@/lib/coverage";
import { Pill } from "./Pill";
import EditorUseControl from "./EditorUseControl";
import { editorUseLine } from "@/lib/editorUse";
import { attributesFor, INTEGRATIONS, PERIODS, UNITS, CURRENCIES, UNKNOWN, isUnknown, pricingDisplay, sanitiseStructured } from "@/lib/categories";
import { PROPOSED } from "@/lib/structured";
import { DEFAULT_SUBJECT, DEFAULT_BODY, PLACEHOLDERS, valuesFor, fill, unfilled } from "@/lib/outreachTemplate";
import { voiceIssues } from "@/lib/voice";
import { ownershipLine } from "@/lib/owners";
import { DEFAULT as ABOUT_DEFAULT, bodyOf, paragraphsOf, aboutIssues, inlineTokens, isAllowedHref, LINKS_MAX } from "@/lib/aboutText";
import { STATUSES as IDEA_STATUSES, SURFACES, SIZES, VERDICTS, sortIdeas, latestReview, ideaTitle, handoffPrompt, isCommitHash } from "@/lib/ideas";
import { EXCLUSION_REASONS } from "@/lib/reviews";
import { ThemeToggle } from "./Theme";
import { SCREENS, PRIMING, questionOf } from "@/lib/recommendOptions";
import { STAT_SECTIONS } from "@/lib/beacon";
import { ADMIN_TABS, resolveAdminTab } from "@/lib/adminTabs";

/*
 * Admin console.
 *
 * The server component above this has already checked ADMIN_EMAILS. This is the
 * view, not the gate, and every button posts to /api/admin which re-checks on
 * its own.
 *
 * ------------------------------------------------------------------
 *  Six tabs, each one job, each in two layers (2026-10-23)
 * ------------------------------------------------------------------
 * It had grown to ten tabs added in the order they were built, with Catalogue
 * holding six unrelated jobs and every panel at the same weight. Now:
 *
 *   Inbox     is there anything for me. A summary line first, then the queues
 *             other people's actions create, reviews to decide included.
 *   Updates   the monitor's findings, a vendor's announcement, the feed.
 *   Listings  the entries: drafts and details to confirm, then reference.
 *   Write     what you author: LinkedIn posts, the list email, the About page;
 *             ideas and outreach as reference.
 *   Audience  who uses the site: the recommender, stats, interest, accounts,
 *             subscribers, verified claims. Nothing there is work.
 *   System    is anything broken: the status line, then Records, Logs, Tools.
 *
 * Every tab is work first (WorkList, open while ten rows or fewer), then one
 * `Reference` group: lighter, shut, and adding nothing to the tab's count. A
 * count is work waiting, never volume.
 *
 * Every list on every tab is the same `Row`, and every two-press action is the
 * same `ConfirmBtn`, so a confirmation looks the same everywhere it is.
 *
 * The palette and the type scale are the public site's, from lib/tools.js.
 * There is no second design language here.
 */

/* The tabs, and the map from the ten this replaced, live in lib/adminTabs.js:
   the server page reads them too, to redirect an old ?tab= to its panel. */
const TABS = ADMIN_TABS;

/*
 * Every collection defaults to empty right here, in the signature.
 *
 * Most of these Redis keys postdate the first deployment, so a store that has
 * not seen a feature yet returns nothing for it and the panel should render
 * its empty state rather than throw. A default in the declaration is the
 * cheapest possible version of that: it is a statement about the shape of the
 * prop, and it removes the temptation to sprinkle `|| []` through the render,
 * which is a null-check around a wiring bug rather than a fix for one.
 */
export default function AdminPanel({
  email,
  suggestions = [],
  claims = {},
  subscribers = [],
  subscriberRows = [],
  reports = [],
  accounts = {},
  stats = { fields: {}, queries: [] },
  recommend = { runs: [], summary: null },
  askLog = [],
  eventFindings = [],
  mentions = [],
  mentionSources = { lastRunAt: "", sources: {} },
  eventCoverage = [],
  eventRefresh = {},
  announcements = [],
  comments = [],
  questions = [],
  lists = [],
  media = { live: {}, pending: {} },
  outreach = { contacts: {}, state: {}, meta: {} },
  publishing = { canPublish: false, log: [] },
  maillog = [],
  entries = {},
  editorUse = {},
  ideas = [],
  structured = {},
  priceOverrides = {},
  about = null,
  aboutPhoto = "",
  dedupelog = [],
  changelog = [],
  monitor = {},
  changesSeen = {},
  interest = {},
  lastVisit = "",
  appliedChanges = {},
  discovery = { findings: [] },
  coverage = [],
  publishedChanges = {},
  rewrittenChanges = {},
  editedChanges = {},
  autoResolved = [],
  rewriteLog = [],
  monitorErrors = [],
  verifiedChanges = {},
  feed = [],
  health = null,
  inventory = [],
  reviewSignals = [],
  discards = [],
  holds = {},
  initialTab = "inbox",
}) {
  /*
   * The tab comes from the URL, so every tab renders on the server.
   *
   * Useful in itself: /admin?tab=audience is a link somebody can send. It also
   * makes each tab reachable without a browser, which is how the whole page
   * shipped broken once. Only the default tab server-renders, so a bad
   * reference in Listings, Audience or System is invisible to any check that
   * loads /admin and reads the response.
   */
  const [tab, setTab] = useState(resolveAdminTab(initialTab).tab);
  /* Holds live here, not in the drafts list, because two panels read them:
     Drafts (work) and On hold (reference), and the Listings count. */
  const [holdMap, setHoldMap] = useState(holds || {});
  const [rows, setRows] = useState(suggestions || []);
  const [claimRows, setClaimRows] = useState(claims || {});
  const [reportRows, setReportRows] = useState(reports || []);
  const [entryRows, setEntryRows] = useState(entries || {});
  const [reviewRows, setReviewRows] = useState(reviewSignals);
  const [eventRows, setEventRows] = useState(eventFindings);
  const [mentionRows, setMentionRows] = useState(mentions);
  const newMentions = mentionRows.filter((m) => m.status === "new");
  const openEventFindings = eventRows.filter((f) => f.status === "open");
  const [commentRows, setCommentRows] = useState(comments);
  const unreadComments = commentRows.filter((c) => !c.reviewed);
  const [questionRows, setQuestionRows] = useState(questions);
  const [listRows, setListRows] = useState(lists);
  const [mediaState, setMediaState] = useState(media);
  const pendingMedia = Object.entries(mediaState.pending || {});
  const unreadLists = listRows.filter((l) => !l.reviewed && !l.hidden);
  const unreadQuestions = questionRows.filter((q) => !q.reviewed);
  const [seen, setSeen] = useState(changesSeen || {});
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  /* Out of scope never enters the queue: it needs no decision, it was answered
     at submission time, and it would inflate the one count on this page that is
     supposed to mean "there is work here". */
  const deletedRows = rows.filter((s) => s.status === "deleted");
  /* Published leaves the queue for its own collapsed group: the request became
     a listing (lib/suggestionPublished.js). */
  const publishedRows = rows.filter((s) => s.status === "published")
    .sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)));
  const live = rows.filter((s) => !s.status);
  const outOfScopeRows = live.filter((s) => s.outOfScope);
  const inScope = live.filter((s) => !s.outOfScope);
  const pending = inScope.filter((s) => s.approved === false);
  const reviewed = inScope.filter((s) => s.approved !== false);
  const openReports = reportRows.filter((r) => r.status === "open");
  const pendingClaims = Object.entries(claimRows).filter(([, c]) => c.status !== "verified");
  const verifiedClaims = Object.entries(claimRows).filter(([, c]) => c.status === "verified");

  const openChanges = (changelog || []).filter((r) => !isHandled(r.id, seen, publishedChanges || {}, appliedChanges || {}));
  /* "Since your last visit" is computed against the value the server rendered
     with, which is the visit before this one: the stamp below updates after. */
  const sinceVisit = lastVisit
    ? openChanges.filter((r) => String(r.at || "") > String(lastVisit))
    : openChanges;

  /* Most asked first, everywhere a queue is shown. Demand decides order. */
  const byDemand = (a, b) => timesAsked(b) - timesAsked(a);

  /*
   * What is waiting, one number per queue. The tab labels, the Inbox's summary
   * line and the lists' own headers all read these, so the three can never
   * disagree. A tab's count is what needs you there, never what exists: drafts
   * waiting on Publish, Discard or Hold (not the ones on hold, which were
   * decided), reviews still to decide (not reviews), announcements in draft or
   * ready. Reference panels add nothing to any of it.
   */
  const reviewsToDecide = (reviewRows || []).reduce((n, g) => n + (g.needs || 0), 0);
  const waiting = {
    suggestions: pending.length,
    reports: openReports.length,
    claims: pendingClaims.length,
    comments: unreadComments.length,
    questions: unreadQuestions.length,
    lists: unreadLists.length,
    media: pendingMedia.length,
    reviews: reviewsToDecide,
    events: openEventFindings.length,
    mentions: newMentions.length,
  };
  const backlog = {
    drafts: [
      ["tool", ALL_TOOLS], ["newsletter", ALL_NEWSLETTERS], ["group", ALL_COMMUNITIES], ["podcast", ALL_PODCASTS],
      ["youtube", ALL_YOUTUBE], ["award", ALL_AWARDS], ["event", ALL_EVENTS],
    ].reduce((n, [kind, list]) => n + drafted(list).filter((e) => !holdMap[`${kind}:${e.id}`]).length, 0),
    details: published(ALL_TOOLS).filter((t) => !structured?.[t.id]?.confirmedAt || priceOverrides?.[t.id]?.priceAt > structured[t.id].confirmedAt).length,
    announcements: (announcements || []).filter((r) => r.status === "draft" || r.status === "ready").length,
    ideas: (ideas || []).filter((r) => r.status === "new" || r.status === "reviewed").length,
  };
  const inboxCount = Object.values(waiting).reduce((a, b) => a + b, 0);
  const counts = {
    inbox: inboxCount,
    updates: openChanges.length,
    listings: backlog.drafts + backlog.details,
    write: backlog.announcements,
    audience: 0,
    system: 0,
  };

  function go(id) {
    setTab(id);
    /* Keep the URL honest without a navigation, so a reload and a
       copied link both land where the person is looking. */
    try {
      const u = new URL(window.location.href);
      if (id === "inbox") u.searchParams.delete("tab");
      else u.searchParams.set("tab", id);
      window.history.replaceState(null, "", u);
      window.scrollTo(0, 0);
    } catch { /* history is not essential to switching tabs */ }
  }

  /* Stamp the visit once, after the render that used the old value. */
  useEffect(() => {
    fetch("/api/admin", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "seen-inbox" }),
    }).catch(() => {});
  }, []);

  // `tag` separates two buttons that post the same action for the same row,
  // so only the one actually clicked shows as busy.
  async function act(action, id, extra = {}, tag = "") {
    setBusy(action + tag + id); setErr("");
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, id, ...extra }),
      });
      if (!res.ok) { setErr(await res.text()); return; }
      const d = await res.json();
      if (d.suggestions) setRows(d.suggestions);
      if (d.claims) setClaimRows(d.claims);
      if (d.reports) setReportRows(d.reports);
      if (d.entries) setEntryRows(d.entries);
      if (d.reviewSignals) setReviewRows(d.reviewSignals);
      if (d.eventFindings) setEventRows(d.eventFindings);
      if (d.mentions) setMentionRows(d.mentions);
      if (d.comments) setCommentRows(d.comments);
      if (d.questions) setQuestionRows(d.questions);
      if (d.lists) setListRows(d.lists);
      if (d.media) setMediaState(d.media);
    } catch {
      setErr("Could not reach the server.");
    } finally {
      setBusy("");
    }
  }

  return (
    <StandingDiscards.Provider value={discards.filter((d) => d.standing)}>
    <main style={{ background: C.bg, color: C.text, minHeight: "100vh" }}>
      <div className="mx-auto px-5" style={{ maxWidth: 1140 }}>
        <header className="pt-8" style={{ paddingBottom: S.lg }}>
          <div className="flex flex-wrap items-baseline justify-between" style={{ gap: S.md }}>
            <h1 style={{ fontSize: F.display, fontWeight: 800, letterSpacing: TRACK.tighter, margin: 0 }}>Admin</h1>
            <div className="flex flex-wrap items-center" style={{ gap: S.md }}>
              <span style={{ fontSize: F.sm, color: C.dim }}>
                {email} · <a href="/" style={{ color: C.muted }}>back to the directory</a>
              </span>
              <ThemeToggle />
            </div>
          </div>
          {err && (
            <p className="mt-3" style={{ fontSize: F.sm, color: C.badInk, margin: "12px 0 0" }}>{err}</p>
          )}
        </header>

        <nav className="flex flex-wrap" style={{
          gap: S.xs, borderBottom: `1px solid ${C.line}`, marginBottom: S["2xl"],
        }}>
          {TABS.map(([id, label]) => {
            const on = tab === id;
            const n = counts[id];
            return (
              <button key={id} onClick={() => go(id)} aria-current={on ? "page" : undefined}
                style={{
                  background: "none", border: 0, borderBottom: `2px solid ${on ? C.accent : "transparent"}`,
                  padding: "8px 14px", marginBottom: -1, cursor: "pointer", fontFamily: "inherit",
                  fontSize: F.md, fontWeight: on ? 700 : 500, color: on ? C.text : C.muted,
                }}>
                {label}
                {n > 0 && (
                  <span className="tnum" style={{
                    marginLeft: S.sm, fontSize: F.xs, fontWeight: 700,
                    color: (id === "inbox" || id === "updates") && n > 0 ? C.accentInk : C.dim,
                  }}>{n}</span>
                )}
              </button>
            );
          })}
        </nav>

        {tab === "inbox" && (
          <Inbox
            waiting={waiting}
            backlog={backlog}
            pending={[...pending].sort(byDemand)}
            reports={reportRows}
            claims={pendingClaims}
            openChanges={openChanges}
            onTab={go}
            comments={unreadComments}
            questions={unreadQuestions}
            lists={unreadLists}
            media={pendingMedia}
            reviews={reviewRows}
            events={openEventFindings}
            mentions={newMentions}
            canCommit={Boolean(publishing?.canPublish)}
            act={act}
            busy={busy}
            onSuggestions={setRows}
            onEntries={setEntryRows}
          />
        )}

        {tab === "updates" && (
          <RecentUpdates feed={feed}
            changes={changelog || []} sinceVisit={sinceVisit} monitor={monitor} seen={seen} coverage={coverage}
            appliedChanges={appliedChanges || {}} publishedChanges={publishedChanges || {}}
            rewrittenChanges={rewrittenChanges || {}} editedChanges={editedChanges || {}} verifiedChanges={verifiedChanges || {}} onSeen={setSeen}
            autoResolved={autoResolved || []}
            eventCoverage={eventCoverage} eventRefresh={eventRefresh} />
        )}

        {tab === "listings" && (
          <Listings
            publishing={publishing}
            holds={holdMap}
            onHolds={setHoldMap}
            structured={structured}
            priceOverrides={priceOverrides}
            entries={entryRows}
            onEntries={setEntryRows}
            onSuggestions={setRows}
            editorUse={editorUse}
            mediaLive={mediaState.live || {}}
            discovery={discovery}
            act={act}
            busy={busy}
          />
        )}

        {tab === "write" && (
          <Write
            announcements={announcements}
            subscribers={subscribers || []}
            feed={feed}
            about={about}
            aboutPhoto={aboutPhoto}
            ideas={ideas}
            outreach={outreach}
            claims={claims || {}}
          />
        )}

        {tab === "audience" && (
          <Audience stats={stats} interest={interest || {}} entries={entryRows} recommend={recommend} askLog={askLog} mentions={mentionRows} mentionSources={mentionSources}
            accounts={accounts || {}} claims={claimRows} verified={verifiedClaims}
            subscribers={subscribers || []} subscriberRows={subscriberRows}
            reviews={reviewRows} comments={commentRows} act={act} busy={busy} />
        )}

        {tab === "system" && (
          <System mentionSources={mentionSources} stats={stats} maillog={maillog || []} dedupelog={dedupelog || []} rewriteLog={rewriteLog || []}
            monitorErrors={monitorErrors || []} verifiedChanges={verifiedChanges || {}}
            health={health} coverage={coverage} changelog={changelog || []}
            inventory={inventory || []}
            publishing={publishing} discards={discards}
            reviewed={[...reviewed].sort(byDemand)} outOfScope={outOfScopeRows} deleted={deletedRows}
            publishedSuggestions={publishedRows} allSuggestions={rows}
            onSuggestions={setRows} onEntries={setEntryRows}
            act={act} busy={busy} />
        )}

        <div style={{ height: 60 }} />
      </div>
    </main>
    </StandingDiscards.Provider>
  );
}

/* ================================================================== */
/*  Tabs                                                               */
/* ================================================================== */

/*
 * The first thing on the page: is there anything for me.
 *
 * One line per queue with its number, each a link to its list on this tab,
 * and the monitor's findings, which are decided on Updates. Under it, quieter,
 * your own backlog: drafts, details to confirm, announcements and ideas. Both
 * lines read the numbers the tab labels read, so they cannot disagree.
 */
const WAITING_LABEL = {
  suggestions: ["suggestion", "suggestions", "q-suggestions"],
  reports: ["report", "reports", "q-reports"],
  claims: ["claim to check", "claims to check", "q-claims"],
  comments: ["comment", "comments", "q-comments"],
  questions: ["question", "questions", "q-questions"],
  lists: ["list published", "lists published", "q-lists"],
  media: ["media set", "media sets", "q-media"],
  reviews: ["review to decide", "reviews to decide", "q-reviews"],
  events: ["event finding", "event findings", "q-events"],
  mentions: ["mention to read", "mentions to read", "q-mentions"],
};

function Summary({ waiting = {}, backlog = {}, findings = 0, onTab }) {
  const parts = Object.entries(waiting).filter(([, n]) => n > 0);
  const link = { color: C.text, fontWeight: 700, textDecoration: "underline", textUnderlineOffset: 3 };
  const tabLink = (label, id) => (
    <button onClick={() => onTab(id)} style={{ ...link, background: "none", border: 0, padding: 0, cursor: "pointer", fontFamily: "inherit", fontSize: "inherit" }}>{label}</button>
  );
  const back = [
    backlog.drafts > 0 && ["draft", "drafts", "listings"],
    backlog.details > 0 && ["listing with details to confirm", "listings with details to confirm", "listings"],
    backlog.announcements > 0 && ["announcement to post", "announcements to post", "write"],
    backlog.ideas > 0 && ["idea to decide", "ideas to decide", "write"],
  ].filter(Boolean);
  const n = (key, one, many) => `${backlog[key]} ${backlog[key] === 1 ? one : many}`;
  const keyOf = { draft: "drafts", "listing with details to confirm": "details", "announcement to post": "announcements", "idea to decide": "ideas" };
  return (
    <section data-summary="" style={{ paddingBottom: S["2xl"] }}>
      <p style={{ fontSize: F.lg, margin: 0, lineHeight: 1.7 }}>
        {parts.length || findings
          ? <>
              <span style={{ fontWeight: 700 }}>Waiting on you: </span>
              {parts.map(([key, count], i) => {
                const [one, many, anchor] = WAITING_LABEL[key];
                return <React.Fragment key={key}>{i ? ", " : ""}<a href={`#${anchor}`} style={link}>{count} {count === 1 ? one : many}</a></React.Fragment>;
              })}
              {findings > 0 && <>{parts.length ? ", " : ""}{tabLink(`${findings} monitor finding${findings === 1 ? "" : "s"}`, "updates")}</>}
              .
            </>
          : <span style={{ color: C.muted }}>Nothing is waiting on you.</span>}
      </p>
      {back.length > 0 && (
        <p style={{ fontSize: F.sm, color: C.muted, margin: `${S.xs}px 0 0`, lineHeight: 1.6 }}>
          Your backlog:{" "}
          {back.map(([one, many, tab], i) => (
            <React.Fragment key={one}>{i ? ", " : ""}
              <button onClick={() => onTab(tab)} style={{ background: "none", border: 0, padding: 0, cursor: "pointer", fontFamily: "inherit", fontSize: "inherit", color: C.muted, textDecoration: "underline", textUnderlineOffset: 3 }}>
                {n(keyOf[one], one, many)}
              </button>
            </React.Fragment>
          ))}.
        </p>
      )}
    </section>
  );
}

function Inbox({ waiting = {}, backlog = {}, pending = [], reports = [], claims = [], openChanges = [], onTab, comments = [], questions = [], lists = [], media = [], reviews = [], events = [], mentions = [], canCommit = false, act, busy, onSuggestions, onEntries }) {
  return (
    <>
      <Summary waiting={waiting} backlog={backlog} findings={openChanges.length} onTab={onTab} />

      <WorkList rows={pending.length} title="Suggestions to review" anchor="q-suggestions"
        count={pending.length}
        hint="Sorted by how many people asked. Mark reviewed clears the moderation hold so the row is public; it does not create a listing. Research and draft writes one for you to check, and Approve and publish puts it in the store, not the file."
      >
        {pending.length === 0
          ? <Empty>Nothing waiting. With MODERATE_SUGGESTIONS unset, suggestions go public on submit and never land here.</Empty>
          : pending.map((s) => (
            <SuggestionRow key={s.id} s={s}
              footer={<DraftPanel s={s} onSuggestions={onSuggestions} onEntries={onEntries} />}>
              <Btn onClick={() => act("mark-reviewed", s.id)}
                busy={busy === "mark-reviewed" + s.id} tone="go">Mark reviewed</Btn>
              <ConfirmBtn onConfirm={() => act("delete-suggestion", s.id)}
                busy={busy === "delete-suggestion" + s.id}>Delete</ConfirmBtn>
            </SuggestionRow>
          ))}
      </WorkList>

      <OpenReports rows={reports} act={act} busy={busy} />

      <ReviewsToDecide groups={reviews} act={act} busy={busy} />

      {events.length > 0 && <EventFindings rows={events} act={act} busy={busy} />}

      {mentions.length > 0 && <MentionsToRead rows={mentions} act={act} busy={busy} />}

      {comments.length > 0 && (
        <WorkList rows={comments.length} title="Comments to read" count={comments.length} anchor="q-comments"
          hint="Blog comments are live the moment they are posted. Read each one: Looks fine takes it out of here, Hide takes it off the post with a reason and keeps it, Delete removes it for good.">
          {comments.map((c) => <CommentRow key={c.slug + c.id} c={c} act={act} busy={busy} />)}
        </WorkList>
      )}

      {media.length > 0 && (
        <WorkList rows={media.length} title="Media to approve" count={media.length} anchor="q-media"
          hint="Screenshots and demo links from verified vendors. Nothing shows until you approve. Approving commits the new images to the repository in one commit and puts the set on the listing, labelled as the vendor's. Reject needs a reason, which the vendor is sent.">
          {media.map(([toolId, p]) => <MediaRow key={toolId} toolId={toolId} p={p} canCommit={canCommit} act={act} busy={busy} />)}
        </WorkList>
      )}

      {lists.length > 0 && (
        <WorkList rows={lists.length} title="Lists published" count={lists.length} anchor="q-lists"
          hint="Lists visitors made public. They are live at once and not indexed until you mark one fine. Hide takes one off the site with a reason and keeps it.">
          {lists.map((l) => <ListRow key={l.id} l={l} act={act} busy={busy} />)}
        </WorkList>
      )}

      {questions.length > 0 && (
        <WorkList rows={questions.length} title="Questions to read" count={questions.length} anchor="q-questions"
          hint="Questions on tool pages are live the moment they are asked. Looks fine takes one out of here. Hide takes a question or an answer off the page with a reason and keeps it. Delete removes it for good.">
          {questions.map((q) => <QuestionRow key={q.toolId + q.id} q={q} act={act} busy={busy} />)}
        </WorkList>
      )}

      <WorkList rows={claims.length} title="Claims to check" anchor="q-claims"
        count={claims.length}
        hint="Started but not proved. They have a token to publish on their own domain; nothing is editable until they do."
      >
        {claims.length === 0
          ? <Empty>No claims waiting.</Empty>
          : claims.map(([toolId, c]) => <ClaimRow key={toolId} toolId={toolId} c={c} act={act} busy={busy} />)}
      </WorkList>
    </>
  );
}

/*
 * The directory's entries. Work first: drafts waiting on Publish, Hold or
 * Discard, and confirmed details still to confirm. Then reference: what is
 * held, live but unverified, editor use, entries published from the queue,
 * vendor media, and the competitors vendors name that are not listed.
 */
function Listings({ publishing = { canPublish: false, log: [] }, holds = {}, onHolds, structured = {}, priceOverrides = {}, entries = {}, onEntries, onSuggestions, editorUse = {}, mediaLive = {}, discovery = { findings: [] }, act, busy }) {
  return (
    <>
      <Drafts publishing={publishing} holds={holds} onHolds={onHolds} part="work" />
      <StructuredData initial={structured} priceOverrides={priceOverrides} />

      <Reference>
        <Drafts publishing={publishing} holds={holds} onHolds={onHolds} part="held" />
        <NeedsVerifying />
        <EditorUse editorUse={editorUse} entries={entries} />
        <PublishedEntries entries={entries} onEntries={onEntries} act={act} busy={busy} />
        <Collapsible title="Vendor media" count={Object.keys(mediaLive).length}
          hint="Screenshots and demo links vendors supplied and you approved, as they show on each listing. Remove takes them off the listing. The image files stay in the repository's history.">
          {Object.keys(mediaLive).length === 0 ? <Empty>No vendor media on any listing.</Empty>
            : Object.entries(mediaLive).map(([toolId, m]) => (
              <Row key={toolId}
                title={<a href={`/tools/${toolId}`} target="_blank" rel="noopener noreferrer" style={{ color: C.text }}>{ALL_TOOLS.find((t) => t.id === toolId)?.name || toolId}</a>}
                meta={`${m.screenshots.length} screenshot${m.screenshots.length === 1 ? "" : "s"}${m.video ? ", a video link" : ""} · approved ${String(m.approvedAt).slice(0, 10)} by ${m.approvedBy}${m.commit ? ` · commit ${m.commit.slice(0, 7)}` : ""}`}
                actions={<ConfirmBtn busy={busy === "media-remove" + toolId} onConfirm={() => act("media-remove", toolId, { toolId })} confirm="Take it off the listing?">Remove</ConfirmBtn>}
              />
            ))}
        </Collapsible>
        <Discovered discovery={discovery} onSuggestions={onSuggestions} onEntries={onEntries} />
      </Reference>
    </>
  );
}

/*
 * What you write. Work: LinkedIn posts in draft or ready, the email to the
 * list, the About page. Reference: the ideas backlog, and outreach while the
 * round runs (temporary, invariant 52).
 */
function Write({ announcements = [], subscribers = [], feed = [], about = null, aboutPhoto = "", ideas = [], outreach = { contacts: {}, state: {}, meta: {} }, claims = {} }) {
  return (
    <>
      <Announcements initial={announcements} />
      <Compose count={subscribers.length} feed={feed} />
      <AboutPage initial={about} photo={aboutPhoto} />

      <Reference>
        <Ideas initial={ideas} />
        <Outreach initial={outreach} claims={claims} />
      </Reference>
    </>
  );
}

/*
 * Reviews, sorted into what still needs a decision and what has had one.
 *
 * Markers are prompts to read, never verdicts: a burst (three or more in seven
 * days) and a reviewer whose address is on the listing's own domain, computed
 * on the server in lib/reviewSignals.js because the second needs the address.
 *
 * Each review in a burst is its own decision. Confirm clears the markers that
 * review carries now and keeps it counted; Exclude takes it out of the average
 * and the markup and labels it; Unexclude undoes that, because some
 * exclusions will be wrong. Every one of them is recorded with who and when.
 * "Confirm all in this burst" is the common case of a burst that turns out to
 * be genuine, and it covers the burst marker only: a reviewer on the vendor's
 * domain inside the burst is still raised.
 *
 * The heading counts what is unreviewed, not what exists. The open section is
 * the work; the decided ones are collapsed below it.
 */
/* One blog comment, with every decision available from where it is shown. */
function CommentRow({ c, act, busy }) {
  const [reason, setReason] = useState("");
  const [hiding, setHiding] = useState(false);
  const k = (a) => a + c.id;
  return (
    <Row
      title={c.author}
      tag={c.hidden ? "hidden" : c.reviewed ? "read" : "unread"}
      tagColor={c.hidden ? C.warnInk : C.muted}
      badges={<a href={`/blog/${c.slug}#comment-${c.id}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: F.xs, color: C.muted }}>{c.postTitle}</a>}
      dim={Boolean(c.hidden)}
      body={<p style={{ margin: 0, whiteSpace: "pre-wrap", color: C.text }}>{c.text}</p>}
      meta={`${String(c.at).slice(0, 16).replace("T", " ")} · ${c.email}${c.hidden ? ` · hidden by ${c.hidden.by}: ${c.hidden.reason}` : c.reviewedBy ? ` · read by ${c.reviewedBy}` : ""}`}
      actions={<>
        {!c.reviewed && <Btn tone="go" busy={busy === k("review-comment")} onClick={() => act("review-comment", c.id, { slug: c.slug })}>Looks fine</Btn>}
        {!c.hidden && !hiding && <Btn onClick={() => setHiding(true)}>Hide</Btn>}
        {!c.hidden && hiding && (
          <span className="inline-flex items-center" style={{ gap: S.xs }}>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why it is hidden (required)" maxLength={200}
              aria-label="Why it is hidden" style={{ ...FIELD, width: 260, padding: "2px 8px", fontSize: F.xs }} />
            <Btn disabled={!reason.trim()} busy={busy === k("hide-comment")} onClick={() => act("hide-comment", c.id, { slug: c.slug, reason })}>Hide it</Btn>
            <Btn onClick={() => setHiding(false)}>Cancel</Btn>
          </span>
        )}
        {c.hidden && <Btn busy={busy === k("unhide-comment")} onClick={() => act("unhide-comment", c.id, { slug: c.slug })}>Unhide</Btn>}
        <ConfirmBtn busy={busy === k("delete-comment")} onConfirm={() => act("delete-comment", c.id, { slug: c.slug })} confirm="Delete for good">Delete</ConfirmBtn>
      </>}
    />
  );
}

/* A vendor's media submission, with the images as sent (lib/media.js). */
function MediaRow({ toolId, p, canCommit, act, busy }) {
  const [reason, setReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const name = ALL_TOOLS.find((t) => t.id === toolId)?.name || toolId;
  const needsCommit = p.screenshots.some((s) => s.data);
  return (
    <Row
      title={<a href={`/tools/${toolId}`} target="_blank" rel="noopener noreferrer" style={{ color: C.text }}>{name}</a>}
      tag="waiting"
      body={<>
        <div className="flex flex-wrap" style={{ gap: S.sm, marginTop: S.xs }}>
          {p.screenshots.map((s, i) => (
            <figure key={i} style={{ margin: 0, width: 220 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.data ? `data:${s.type};base64,${s.data}` : s.path} alt={s.alt} style={{ width: 220, height: "auto", border: `1px solid ${C.line}`, borderRadius: R.control }} />
              <figcaption style={{ fontSize: F.xs, color: C.muted, marginTop: 2 }}>{s.data ? "New" : "Kept"}. Alt: {s.alt}</figcaption>
            </figure>
          ))}
        </div>
        {p.video && <p style={{ margin: `${S.sm}px 0 0` }}>Video: <a href={p.video} target="_blank" rel="noopener noreferrer" style={{ color: C.text }}>{p.video}</a></p>}
      </>}
      meta={`From ${p.submittedBy} · ${String(p.submittedAt).slice(0, 16).replace("T", " ")}${needsCommit && !canCommit ? " · GITHUB_TOKEN is not set, so new images cannot be committed" : ""}`}
      actions={<>
        <Btn tone="go" disabled={needsCommit && !canCommit} busy={busy === "media-approve" + toolId} onClick={() => act("media-approve", toolId, { toolId })}>Approve</Btn>
        {!rejecting ? <Btn onClick={() => setRejecting(true)}>Reject</Btn> : (
          <span className="inline-flex items-center" style={{ gap: S.xs }}>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why, sent to the vendor (required)" maxLength={300}
              aria-label="Why it is rejected" style={{ ...FIELD, width: 280, padding: "2px 8px", fontSize: F.xs }} />
            <Btn tone="stop" disabled={reason.trim().length < 3} busy={busy === "media-reject" + toolId} onClick={() => act("media-reject", toolId, { toolId, reason })}>Reject it</Btn>
            <Btn onClick={() => setRejecting(false)}>Cancel</Btn>
          </span>
        )}
      </>}
    />
  );
}

/* A list a visitor published (lib/lists.js). */
function ListRow({ l, act, busy }) {
  const [reason, setReason] = useState("");
  const [hiding, setHiding] = useState(false);
  return (
    <Row
      title={<a href={`/lists/${l.id}`} target="_blank" rel="noopener noreferrer" style={{ color: C.text }}>{l.name}</a>}
      tag={l.hidden ? "hidden" : l.reviewed ? "indexed" : "not read"}
      tagColor={l.hidden ? C.warnInk : C.muted}
      dim={Boolean(l.hidden)}
      body={<p style={{ margin: 0 }}>By “{l.byName}”, {l.items.length} tools. {l.items.filter((x) => x.note).map((x) => `${x.toolId}: ${x.note}`).join(" · ")}</p>}
      meta={`${l.owner} · updated ${String(l.updatedAt).slice(0, 10)}${l.hidden ? ` · hidden: ${l.hiddenReason}` : ""}`}
      actions={<>
        {!l.reviewed && !l.hidden && <Btn tone="go" busy={busy === "list-fine" + l.id} onClick={() => act("list-fine", l.id)}>Looks fine</Btn>}
        {!l.hidden && !hiding && <Btn onClick={() => setHiding(true)}>Hide</Btn>}
        {!l.hidden && hiding && (
          <span className="inline-flex items-center" style={{ gap: S.xs }}>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why it is hidden (required)" maxLength={200}
              aria-label="Why it is hidden" style={{ ...FIELD, width: 240, padding: "2px 8px", fontSize: F.xs }} />
            <Btn disabled={reason.trim().length < 3} busy={busy === "list-hide" + l.id} onClick={() => act("list-hide", l.id, { reason })}>Hide it</Btn>
            <Btn onClick={() => setHiding(false)}>Cancel</Btn>
          </span>
        )}
        {l.hidden && <Btn busy={busy === "list-unhide" + l.id} onClick={() => act("list-unhide", l.id)}>Unhide</Btn>}
      </>}
    />
  );
}

/* A question on a tool, and its answers, each hideable (lib/qa.js). */
function QuestionRow({ q, act, busy }) {
  const [reason, setReason] = useState("");
  const [hiding, setHiding] = useState(""); // "" | "q" | answer id
  const k = (a, x = "") => a + x + q.id;
  const hideBox = (answerId) => (
    <span className="inline-flex items-center" style={{ gap: S.xs }}>
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why it is hidden (required)" maxLength={200}
        aria-label="Why it is hidden" style={{ ...FIELD, width: 240, padding: "2px 8px", fontSize: F.xs }} />
      <Btn disabled={reason.trim().length < 3} busy={busy === k("qa-hide", answerId)}
        onClick={() => act("qa-hide", q.id, { toolId: q.toolId, answerId, reason }, answerId)}>Hide it</Btn>
      <Btn onClick={() => setHiding("")}>Cancel</Btn>
    </span>
  );
  return (
    <Row
      title={q.author}
      tag={q.hidden ? "hidden" : q.reviewed ? "read" : "unread"}
      tagColor={q.hidden ? C.warnInk : C.muted}
      badges={<a href={`/tools/${q.toolId}#questions`} target="_blank" rel="noopener noreferrer" style={{ fontSize: F.xs, color: C.muted }}>{q.toolName}</a>}
      dim={Boolean(q.hidden)}
      body={<>
        <p style={{ margin: 0, whiteSpace: "pre-wrap", color: C.text }}><b>Q.</b> {q.text}</p>
        {(q.answers || []).map((a) => (
          <div key={a.id} style={{ marginTop: S.sm, paddingLeft: S.md, borderLeft: `2px solid ${C.edge}`, opacity: a.hidden ? 0.55 : 1 }}>
            <p style={{ margin: 0, whiteSpace: "pre-wrap", color: C.text }}><b>A.</b> {a.text}</p>
            <p style={{ margin: "2px 0 0", fontSize: F.xs, color: C.dim }}>
              {a.author} · {a.email}{a.vendor ? " · from the vendor" : ""}{a.hidden ? ` · hidden: ${a.hiddenReason}` : ""}
            </p>
            <div className="flex flex-wrap" style={{ gap: S.xs, marginTop: S.xs }}>
              {!a.hidden && hiding !== a.id && <Btn onClick={() => { setHiding(a.id); setReason(""); }}>Hide answer</Btn>}
              {!a.hidden && hiding === a.id && hideBox(a.id)}
              {a.hidden && <Btn busy={busy === k("qa-unhide", a.id)} onClick={() => act("qa-unhide", q.id, { toolId: q.toolId, answerId: a.id }, a.id)}>Unhide answer</Btn>}
              <ConfirmBtn busy={busy === k("qa-delete", a.id)} onConfirm={() => act("qa-delete", q.id, { toolId: q.toolId, answerId: a.id }, a.id)} confirm="Delete for good">Delete answer</ConfirmBtn>
            </div>
          </div>
        ))}
      </>}
      meta={`${String(q.at).slice(0, 16).replace("T", " ")} · ${q.email}${q.hidden ? ` · hidden: ${q.hiddenReason}` : q.reviewedBy ? ` · read by ${q.reviewedBy}` : ""}`}
      actions={<>
        {!q.reviewed && <Btn tone="go" busy={busy === k("qa-fine")} onClick={() => act("qa-fine", q.id, { toolId: q.toolId })}>Looks fine</Btn>}
        {!q.hidden && hiding !== "q" && <Btn onClick={() => { setHiding("q"); setReason(""); }}>Hide</Btn>}
        {!q.hidden && hiding === "q" && hideBox("")}
        {q.hidden && <Btn busy={busy === k("qa-unhide")} onClick={() => act("qa-unhide", q.id, { toolId: q.toolId })}>Unhide</Btn>}
        <ConfirmBtn busy={busy === k("qa-delete")} onConfirm={() => act("qa-delete", q.id, { toolId: q.toolId })} confirm="Delete for good">Delete</ConfirmBtn>
      </>}
    />
  );
}

const MARKER_LABEL = { burst: "in a burst", domain: "same domain as listing" };

function sortReviews(groups = []) {
  const all = groups.flatMap((g) => g.reviews.map((r) => ({ g, r })));
  return {
    all,
    open: groups.filter((g) => g.needs > 0),
    excluded: all.filter(({ r }) => r.excluded),
    confirmed: all.filter(({ r }) => !r.excluded && r.confirmed && !r.active.length),
    rest: all.filter(({ r }) => !r.excluded && !r.confirmed && !r.active.length),
  };
}

/* The work half, on the Inbox: listings with a review nobody has decided. */
function ReviewsToDecide({ groups = [], act, busy }) {
  const { all, open } = sortReviews(groups);
  const needs = open.reduce((n, g) => n + g.needs, 0);
  return (
    <WorkList rows={open.length} title="Reviews to decide" count={needs} anchor="q-reviews"
      hint="Reviews carrying a marker nobody has looked at. Markers say look, not exclude. Confirm keeps a review counted and clears what it was raised for; Exclude keeps it on the listing, labelled, and out of the average and the structured-data rating. Decided reviews are on Audience.">
      {open.length === 0
        ? <Empty>{all.length ? "Nothing needs a decision." : "No reviews yet."}</Empty>
        : open.map((g) => <ReviewGroup key={g.id} g={g} act={act} busy={busy} />)}
    </WorkList>
  );
}

/* The record half, in Audience's reference: every review already decided. */
function ReviewsRecord({ groups = [], act, busy }) {
  const { excluded, confirmed, rest } = sortReviews(groups);
  const item = ({ g, r }) => <ReviewItem key={`${g.id}:${r.id}`} g={g} r={r} act={act} busy={busy} showListing />;
  return (
    <>
      <Collapsible title="Excluded reviews" count={excluded.length}
        hint="Shown on the listing with the reason, counted nowhere. Unexclude if the call was wrong; the exclusion stays in the review's history.">
        {excluded.length === 0 ? <Empty>No review is excluded.</Empty> : excluded.map(item)}
      </Collapsible>
      <Collapsible title="Confirmed reviews" count={confirmed.length}
        hint="Looked at and fine. Not raised again by the marker it was confirmed for; a marker of another kind, or an edit to the text, brings it back.">
        {confirmed.length === 0 ? <Empty>No review is confirmed.</Empty> : confirmed.map(item)}
      </Collapsible>
      <Collapsible title="Other reviews" count={rest.length}
        hint="No marker and no decision. The same controls apply.">
        {rest.length === 0 ? <Empty>No other reviews.</Empty> : rest.map(item)}
      </Collapsible>
    </>
  );
}

/* One listing's open reviews, and the bulk confirm when it has a burst. */
function ReviewGroup({ g, act, busy }) {
  const openReviews = g.reviews.filter((r) => r.active.length);
  const summary = g.average == null ? "no rating shown" : `${g.average} from ${g.counted} counted`;
  return (
    <Row
      title={<a href={`/${g.kind === "newsletter" ? "newsletters" : "tools"}/${g.id}`}
        style={{ color: C.text, textDecoration: "none" }}>{g.name}</a>}
      badges={<>
        <span className="tnum" style={{ fontSize: F.xs, color: C.dim }}>
          {g.needs} of {g.reviews.length} to decide, {summary}{g.domain ? `, ${g.domain}` : ""}
        </span>
        {g.burst && g.burstOpen.length > 0 && (
          <Pill tone="warn">{g.burst.count} in {BURST_DAYS} days, {g.burst.from} to {g.burst.to}</Pill>
        )}
      </>}
      actions={g.burstOpen.length > 1 ? (
        <ConfirmBtn tone="go" busy={busy === `confirm-burst${g.id}`}
          confirm={`Confirm ${g.burstOpen.length} as genuine`}
          note="Clears the burst marker on each and keeps them counted. A same-domain marker stays."
          onConfirm={() => act("confirm-burst", "", { toolId: g.id }, g.id)}>
          Confirm all {g.burstOpen.length} in this burst
        </ConfirmBtn>
      ) : null}
    >
      {openReviews.map((r) => <ReviewItem key={r.id} g={g} r={r} act={act} busy={busy} />)}
    </Row>
  );
}

const dayOf = (iso) => String(iso || "").slice(0, 10);

/* One review, with the controls its state allows. */
function ReviewItem({ g, r, act, busy, showListing = false }) {
  const last = r.audit[r.audit.length - 1];
  const lastLine = last
    ? `last: ${last.action}${last.reason ? ` (${EXCLUSION_REASONS[last.reason]?.label.toLowerCase() || last.reason})` : ""}${last.was ? ` (was ${EXCLUSION_REASONS[last.was]?.label.toLowerCase() || last.was})` : ""}${last.markers ? ` (${last.markers.join(", ")})` : ""} by ${last.by} ${dayOf(last.at)}`
    : "";
  const exclude = Object.entries(EXCLUSION_REASONS).map(([key, x]) => (
    <Btn key={key} tone="stop" busy={busy === `exclude-review${g.id + key}${r.id}`}
      onClick={() => act("exclude-review", r.id, { toolId: g.id, reason: key }, g.id + key)}>
      Exclude: {x.label.toLowerCase()}
    </Btn>
  ));
  return (
    <Row
      dim={Boolean(r.excluded)}
      title={<span style={{ fontSize: F.md }}>
        {showListing && <span style={{ color: C.muted, fontWeight: 600 }}>{g.name} · </span>}
        {r.author || "Anonymous"} <span className="tnum" style={{ color: C.muted, fontWeight: 500 }}>{r.rating}/5</span>
      </span>}
      badges={<>
        {r.excluded && <Pill>excluded: {EXCLUSION_REASONS[r.excluded.reason]?.label || r.excluded.reason}</Pill>}
        {r.active.map((m) => <Pill key={m} tone="warn">{MARKER_LABEL[m] || m}</Pill>)}
        {r.confirmed && !r.active.length && !r.excluded && <Pill>confirmed</Pill>}
      </>}
      body={r.text || <span style={{ color: C.dim }}>No text.</span>}
      meta={[
        r.date, r.editedAt && r.editedAt !== r.date ? `edited ${r.editedAt}` : "", r.email,
        r.excluded ? `excluded by ${r.excluded.by || "?"} ${dayOf(r.excluded.at)}` : "",
        r.confirmed ? `confirmed (${r.confirmed.markers.join(", ")}) by ${r.confirmed.by} ${dayOf(r.confirmed.at)}` : "",
        lastLine && !r.excluded && !r.confirmed ? lastLine : "",
      ].filter(Boolean).join(" · ")}
      actions={r.excluded
        ? <Btn busy={busy === `unexclude-review${g.id}${r.id}`}
            onClick={() => act("unexclude-review", r.id, { toolId: g.id }, g.id)}>Unexclude</Btn>
        : <>
            {r.active.length > 0 && (
              <Btn tone="go" busy={busy === `confirm-review${g.id}${r.id}`}
                onClick={() => act("confirm-review", r.id, { toolId: g.id }, g.id)}>Confirm</Btn>
            )}
            {exclude}
          </>}
    />
  );
}
const BURST_DAYS = 7;

/*
 * "Is anything broken?"
 *
 * That is the only question this tab exists to answer, and it used to take
 * scrolling past five open panels to work it out. The strip answers it in one
 * screen; everything under it is closed until something in the strip says to
 * look. A dumping ground with the diagnosis buried in it is a tab people stop
 * opening.
 */
function System({ mentionSources = { lastRunAt: "", sources: {} }, stats = { fields: {}, queries: [] }, maillog = [], dedupelog = [], rewriteLog = [], monitorErrors = [], verifiedChanges = {}, health, coverage = [], changelog = [], inventory = [], publishing = { canPublish: false, log: [] }, discards = [], reviewed = [], outOfScope = [], deleted = [], publishedSuggestions = [], allSuggestions = [], onSuggestions, onEntries, act, busy }) {
  return (
    <>
      <StatusStrip health={health} maillog={maillog} coverage={coverage} mentionSources={mentionSources} />

      {/* What happened to things that were once work. */}
      <Reference title="Records">
        <Collapsible title="Reviewed suggestions" count={reviewed.length}
          hint="Public on the site. Still suggestions, not listings. Sorted by how many people asked.">
          {reviewed.length === 0
            ? <Empty>No suggestions yet.</Empty>
            : reviewed.map((s) => (
              <SuggestionRow key={s.id} s={s}
                footer={<DraftPanel s={s} onSuggestions={onSuggestions} onEntries={onEntries} />}>
                <ConfirmBtn onConfirm={() => act("delete-suggestion", s.id)}
                  busy={busy === "delete-suggestion" + s.id}>Delete</ConfirmBtn>
              </SuggestionRow>
            ))}
        </Collapsible>
        <Collapsible title="Published suggestions" count={publishedSuggestions.length}
          hint="Suggestions that became listings, with the entry and the date. They have left the queue and the public list. What people asked carried across to the listing's interest count.">
          {publishedSuggestions.length === 0 ? <Empty>No suggestion has become a listing yet.</Empty>
            : publishedSuggestions.map((s) => (
              <Row key={s.id} title={s.name}
                badges={<Pill>{`asked ${timesAsked(s)}`}</Pill>}
                meta={<>Published {String(s.publishedAt).slice(0, 10)} as{" "}
                  <a href={`/${s.publishedKind === "newsletter" ? "newsletters" : s.publishedKind === "event" ? "events" : "tools"}/${s.publishedId}`} target="_blank" rel="noopener noreferrer" style={{ color: C.text }}>{s.publishedId}</a>
                  {s.date ? ` · suggested ${String(s.date).slice(0, 10)}` : ""}</>}
              />
            ))}
        </Collapsible>
        <OutOfScope rows={outOfScope} />
        <Deleted rows={deleted} act={act} busy={busy} />
        <Drafts publishing={publishing} discards={discards} part="records" />
        <Tallies stats={stats} rows={allSuggestions} />
      </Reference>

      {/* What the machinery did, newest first. */}
      <Reference title="Logs">
        <Collapsible title="Changelog archive" count={changelog.length}
          hint="Every monitor finding ever recorded, including the handled ones. Updates shows what is still open.">
          <ChangelogArchive rows={changelog} />
        </Collapsible>
        <Collapsible title="AI rewrites" count={rewriteLog.length}
          hint="Every description rewritten with AI, with the finding that prompted it, what the model proposed and what was saved. Newest first.">
          <RewriteLog rows={rewriteLog} />
        </Collapsible>
        <Collapsible title="Monitor accuracy" count={monitorErrors.length}
          hint="How often each kind of finding was marked wrong, over the findings still in the window. A finding marked wrong is the monitor misreading a page, not a finding that was merely not worth acting on.">
          <MonitorAccuracy rows={changelog} errors={monitorErrors} verified={verifiedChanges} />
        </Collapsible>
        <Collapsible title="Dedup decisions" count={dedupelog.length}
          hint="Every submission, what it was matched to, and what decided it.">
          <DedupeLog rows={dedupelog} />
        </Collapsible>
        <Collapsible title="Mail log" count={maillog.length}
          hint="Every send attempt, newest first. A send that leaves no row here never happened. Failures in the last day are counted in the status strip above.">
          <MailLog rows={maillog} />
        </Collapsible>
      </Reference>

      {/* Things you run by hand. */}
      <Reference title="Tools">
        <Housekeeping inventory={inventory} />
        <Collapsible title="Test an event" count=""
          hint="Fires a real send through the same dispatcher the routes use, with dummy data, to your address only.">
          <NotificationTest />
        </Collapsible>
      </Reference>
    </>
  );
}

/*
 * What is in the store, and the two ways to take something out of it.
 *
 * Every other panel here shows one slice of the store shaped for a decision.
 * None of them answers "what is actually in here", which is the question you
 * have after six months of building the thing, when your own test account,
 * your own test reviews and forty test emails to yourself are in the same rows
 * as the real ones and you cannot see the real state through them.
 *
 * Read first, delete second. The counts are always shown; the rows are shown
 * for any collection small enough to read, and each one you can delete has its
 * own ConfirmBtn. **Nothing here guesses what is test data**, because nothing
 * can: an address that looks like a test is somebody's address if it is not.
 * The panel lists them and a person marks them.
 *
 * The reset is the blunt one, and it names exactly what it will delete on the
 * confirmation rather than in a paragraph above it, because the click is the
 * approval and everything needed to judge it has to be on the thing being
 * clicked. That is invariant 23's rule about the monitor's Apply, and it is the
 * same rule: a destructive button that says "Reset" is a button nobody can
 * safely press.
 *
 * What it never touches is as much of the point as what it clears, and the
 * reasons are not interchangeable. The catalogue and vendor edits, because
 * deleting those is editing the directory. Claims, because a claim is a
 * relationship somebody verified by email and there is already a deliberate
 * two-button path for revoking one. The monitor snapshots, because a snapshot
 * is the baseline the next diff is taken against, and a run with nothing to
 * compare against reports every tool in the directory as changed, which is the
 * one output guaranteed not to be read. The counters, because invariant 27 has
 * them deliberately not derived from the rows so they survive the rows going.
 */
const DELETABLE = {
  "svt:accounts": "account",
  "svt:subscribers": "subscriber",
  "svt:reviews": "review",
  "svt:maillog": "mail",
};

const GROUPS = [
  ["community", "What people did"],
  ["queues", "Queues and leads"],
  ["mail", "What we sent"],
  ["protected", "Editorial and machinery, never cleared from here"],
];

function Housekeeping({ inventory = [] }) {
  const [rows, setRows] = useState(inventory);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [done, setDone] = useState("");

  async function post(payload, label) {
    setBusy(label); setErr("");
    try {
      const res = await fetch("/api/admin", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { setErr(await res.text()); return null; }
      const d = await res.json();
      if (Array.isArray(d.inventory)) setRows(d.inventory);
      return d;
    } catch {
      setErr("Could not reach the server.");
      return null;
    } finally { setBusy(""); }
  }

  async function reset() {
    const d = await post({ action: "reset-test-data" }, "reset");
    if (!d) return;
    const c = d.cleared || {};
    setDone(`Cleared ${c.votes} vote rows, ${c.reviews} reviews, ${c.subscribers} subscribers and ${c.maillog} mail log rows.`);
  }

  const total = rows.reduce((n, r) => n + Math.max(0, r.count), 0);
  const countOf = (label) => Math.max(0, rows.find((r) => r.label === label)?.count || 0);
  const resetCounts = `${countOf("Votes")} vote rows, ${countOf("Reviews")} reviews, ${countOf("Subscribers")} subscribers and ${countOf("Mail log")} mail log rows`;

  return (
    <Collapsible title="Store contents" count={total}
      hint="Every key this application writes, what it holds, and how many rows. Small collections are listed in full. Read it before deleting anything.">

      {GROUPS.map(([group, heading]) => {
        const inGroup = rows.filter((r) => r.group === group);
        if (!inGroup.length) return null;
        return (
          <div key={group} className="pb-2">
            <p style={{ fontSize: F.xs, color: C.dim, fontWeight: 700, margin: "12px 0 0" }}>{heading}</p>
            {inGroup.map((r) => (
              <Row key={r.key}
                title={r.label}
                badges={<>
                  <Pill>{r.count < 0 ? "unreadable" : `${r.count} ${r.count === 1 ? "row" : "rows"}`}</Pill>
                  {r.reset && <Pill>cleared by reset</Pill>}
                </>}
                meta={<code style={{ fontSize: F.xs, color: C.dim }}>{r.key}</code>}
                body={<>
                  <p style={{ margin: 0, lineHeight: 1.55 }}>{r.holds}</p>
                  {r.error && (
                    <p style={{ margin: "4px 0 0", color: C.badInk }}>Could not be read: {r.error}</p>
                  )}
                  {/* Rule E: nothing renders for an empty collection. A count of
                      zero on the badge has already said it. */}
                  {r.rows.length > 0 && (
                    <div className="mt-2">
                      {r.rows.map((item) => (
                        <div key={item.id} className="flex flex-wrap items-baseline"
                          style={{ gap: S.sm, padding: "3px 0" }}>
                          <span style={{ fontSize: F.sm, color: C.text }}>{item.label}</span>
                          <span style={{ fontSize: F.xs, color: C.dim }}>{item.detail}</span>
                          {item.test && <Pill>test send</Pill>}
                          {DELETABLE[r.key] && (
                            <ConfirmBtn confirm="Delete"
                              busy={busy === `${r.key}:${item.id}`}
                              onConfirm={() => post(
                                { action: "delete-store-row", target: DELETABLE[r.key], row: item.id },
                                `${r.key}:${item.id}`,
                              )}>
                              Delete
                            </ConfirmBtn>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {r.truncated && (
                    <p style={{ margin: "4px 0 0", color: C.dim, fontSize: F.xs }}>
                      Too many to list here. The panel for this on its own tab is where to read them.
                    </p>
                  )}
                </>}
              />
            ))}
          </div>
        );
      })}

      <div style={{ borderTop: `1px solid ${C.line}`, marginTop: S.lg, paddingTop: S.lg }}>
        <p style={{ fontSize: F.sm, color: C.muted, lineHeight: 1.6, maxWidth: "76ch", margin: 0 }}>
          <b style={{ color: C.text }}>Reset test data</b> deletes every vote, every review, every
          subscriber on the site-wide list and the whole mail log: everything, not only test rows,
          so reviews a real person wrote and the confirmations and exclusions on them go too. To
          keep the real ones, delete the test rows one at a time above instead. Follows of a
          newsletter or event are not part of it. It does not touch the catalogue, vendor edits, published
          entries, claims, suggestions, reports, the monitor snapshots or the counters. The snapshots
          especially: without them the next weekly run has nothing to compare against and reports
          every tool in the directory as changed.
        </p>
        <div className="flex flex-wrap items-center mt-3" style={{ gap: S.md }}>
          {/* The numbers are on the confirm, because this deletes every review,
              real ones included, along with every decision made about them. */}
          <ConfirmBtn onConfirm={reset} busy={busy === "reset"}
            confirm={`Delete ${resetCounts}`}>
            Reset test data
          </ConfirmBtn>
          {done && <span style={{ fontSize: F.xs, color: C.accentInk }}>{done}</span>}
        </div>
        {err && <p style={{ fontSize: F.xs, color: C.badInk, margin: "8px 0 0" }}>{err}</p>}
      </div>
    </Collapsible>
  );
}

/*
 * Green, or a number.
 *
 * Deliberately not a dashboard. Each line is a thing that can be wrong and the
 * consequence of it being wrong, because "RESEND_API_KEY missing" is a fact and
 * "no email is being sent, including sign-in links" is the thing to act on.
 */
function StatusStrip({ health, maillog = [], coverage = [], mentionSources = { lastRunAt: "", sources: {} } }) {
  const cov = coverageCounts(coverage);
  const notCovered = uncovered(coverage).length;
  if (!health) {
    return (
      <section className="pb-6">
        <p style={{ fontSize: F.sm, color: C.dim, lineHeight: 1.55 }}>
          Health could not be read. The store may be unreachable, which is itself the answer.
        </p>
      </section>
    );
  }

  const { store, env = [], mailFailures, monitor = {}, discovery = {}, cron = {} } = health;
  const stale = (iso, days) => !iso || (Date.now() - Date.parse(iso)) > days * 24 * 60 * 60 * 1000;

  const lines = [
    {
      label: "Store",
      bad: !store.ok,
      warn: store.store === "memory",
      value: store.ok
        ? (store.store === "memory" ? "in memory" : `redis, ${store.ms}ms`)
        : "unreachable",
      note: store.ok ? (store.note || "") : store.error,
    },
    {
      label: "Mail",
      bad: mailFailures > 0,
      value: mailFailures ? `${mailFailures} failed in 24h` : "no failures in 24h",
      note: mailFailures ? "Open the mail log below." : "",
    },
    {
      label: "Monitor",
      bad: stale(monitor.at, 9),
      value: monitor.at
        ? `${String(monitor.at).slice(0, 10)} · ${monitor.checked}/${monitor.total} checked · ${monitor.changes} found`
        : "never run",
      note: stale(monitor.at, 9) ? "More than nine days ago. The weekly cron may not be firing." : (monitor.stopped || ""),
    },
    {
      label: "Discovery",
      bad: false,
      warn: stale(discovery.at, 40),
      value: discovery.at ? `${String(discovery.at).slice(0, 10)} · ${discovery.found} names` : "never run",
      note: stale(discovery.at, 40) ? "Monthly, so this is only odd past about six weeks." : "",
    },
    {
      label: "Cron",
      bad: false,
      warn: !cron.monitor,
      value: cron.monitor
        ? `monitor ${String(cron.monitor.at).slice(0, 10)} by ${cron.monitor.by}`
        : "no recorded fire",
      note: cron.monitor ? "" : "Nothing has invoked it since this started recording.",
    },
    (() => {
      /* Blocked is not empty (invariant 58): a source refusing Vercel's
         servers would otherwise look exactly like a week nobody posted. */
      const src = Object.entries(mentionSources.sources || {});
      const unreadable = src.filter(([, v]) => v.state !== "ok");
      const blocked = unreadable.filter(([, v]) => v.state === "blocked" || v.state === "error");
      return {
        label: "Mentions",
        bad: blocked.length > 0,
        warn: !mentionSources.lastRunAt || unreadable.length > 0 || stale(mentionSources.lastRunAt, 3),
        value: mentionSources.lastRunAt
          ? `${String(mentionSources.lastRunAt).slice(0, 10)} · ${src.length - unreadable.length} of ${src.length} sources answering`
          : "never run",
        note: unreadable.length
          ? `${unreadable.map(([k, v]) => `${MENTION_SOURCE[k] || k} ${v.state}${v.last ? ` (${v.last})` : ""}`).join("; ")}. Mentions from these are not being collected, so an empty list is not evidence nobody posted.`
          : !mentionSources.lastRunAt ? "The daily collection has not run yet." : stale(mentionSources.lastRunAt, 3) ? "More than three days since the last run. The daily cron may not be firing." : "",
      };
    })(),
    {
      label: "Coverage",
      bad: false,
      warn: notCovered > 0,
      value: `${cov.monitored} of ${cov.total} monitored`,
      note: notCovered ? `${notCovered} not covered: ${uncovered(coverage).map((r) => r.name).join(", ")}. Updates, Monitor coverage, has each one.` : "",
    },
  ];

  const problems = lines.filter((l) => l.bad).length + env.length;

  return (
    <section className="pb-10">
      <div className="flex flex-wrap items-baseline" style={{ gap: S.sm }}>
        <h2 style={{ fontSize: F.xl, fontWeight: 700, margin: 0, letterSpacing: TRACK.tight }}>Status</h2>
        <span style={{ fontSize: F.sm, color: problems ? C.badInk : C.accentInk, fontWeight: 600 }}>
          {problems ? `${problems} thing${problems === 1 ? "" : "s"} to look at` : "nothing broken"}
        </span>
      </div>

      <div className="mt-3" style={{
        background: C.panel, border: `1px solid ${C.line}`, borderRadius: R.card, padding: "4px 16px",
      }}>
        {lines.map((l) => (
          <div key={l.label} style={{ borderTop: `1px solid ${C.line}`, padding: "10px 0" }}>
            <div className="flex flex-wrap items-baseline" style={{ gap: S.sm }}>
              <span aria-hidden="true" style={{
                width: 8, height: 8, borderRadius: 999, flexShrink: 0,
                background: l.bad ? C.badInk : l.warn ? C.warnInk : C.accent,
              }} />
              <span style={{ fontSize: F.sm, fontWeight: 600, width: 88 }}>{l.label}</span>
              <span className="tnum" style={{ fontSize: F.sm, color: l.bad ? C.badInk : C.muted }}>{l.value}</span>
            </div>
            {l.note && (
              <p style={{ fontSize: F.xs, color: C.dim, margin: "4px 0 0 20px", lineHeight: 1.5, maxWidth: "70ch" }}>{l.note}</p>
            )}
          </div>
        ))}

        <div style={{ borderTop: `1px solid ${C.line}`, padding: "10px 0" }}>
          <div className="flex flex-wrap items-baseline" style={{ gap: S.sm }}>
            <span aria-hidden="true" style={{
              width: 8, height: 8, borderRadius: 999, flexShrink: 0,
              background: env.length ? C.badInk : C.accent,
            }} />
            <span style={{ fontSize: F.sm, fontWeight: 600, width: 88 }}>Env</span>
            <span style={{ fontSize: F.sm, color: env.length ? C.badInk : C.muted }}>
              {env.length ? `${env.length} missing` : "everything set"}
            </span>
          </div>
          {env.map((e) => (
            <p key={e.name} style={{ fontSize: F.xs, color: C.muted, margin: "4px 0 0 20px", lineHeight: 1.5, maxWidth: "70ch" }}>
              <b style={{ color: C.badInk }}>{e.name}</b> {e.breaks}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}

/*
 * Audience, not health. What visitors are doing, kept away from what is
 * broken so neither has to be read through the other.
 */
function Audience({ stats = { fields: {}, queries: [] }, interest = {}, entries = {}, recommend = { runs: [], summary: null }, askLog = [], mentions = [], mentionSources = { lastRunAt: "", sources: {} }, accounts = {}, claims = {}, verified = [], subscribers = [], subscriberRows = [], reviews = [], comments = [], act, busy }) {
  const read = comments.filter((c) => c.reviewed);
  return (
    <>
      <QuestionsAsked rows={askLog} />
      <RecommenderRuns runs={recommend.runs || []} summary={recommend.summary} />
      <RecommenderFeedback feedback={recommend.feedback} />
      <Stats stats={stats} />
      <Interest interest={interest} entries={entries} />

      {/* The people, and everything already decided about what they wrote. */}
      <Reference>
        <AllMentions rows={mentions} sources={mentionSources} act={act} busy={busy} />
        <Accounts accounts={accounts} claims={claims} />
        <Subscribers list={subscribers} rows={subscriberRows} />
        <Collapsible title="Verified claims"
          count={verified.length}
          hint="These addresses can edit their listing. Revoke access drops the claim and leaves the published copy as the vendor left it; revoke and revert also restores the editorial original."
        >
          {verified.length === 0
            ? <Empty>No verified claims yet.</Empty>
            : verified.map(([toolId, c]) => <ClaimRow key={toolId} toolId={toolId} c={c} act={act} busy={busy} verified />)}
        </Collapsible>
        <ReviewsRecord groups={reviews} act={act} busy={busy} />
        <Collapsible title="Blog comments read" count={read.length}
          hint="Comments already read, including hidden ones. Unread comments are in the Inbox.">
          {read.length === 0 ? <Empty>No comments read yet.</Empty>
            : read.map((c) => <CommentRow key={c.slug + c.id} c={c} act={act} busy={busy} />)}
        </Collapsible>
      </Reference>
    </>
  );
}

/*
 * Mentions of a listed domain, from the weekly collection (lib/mentions.js).
 * Read is all most need. Remove is only for the three reasons, kept and
 * logged: disagreeing with what somebody said is not one of them.
 */
/* The feed's name on screen, in one place (the section was renamed 2026-10-24). */
const FEED_NAME = "What's moving";
const MENTION_SOURCE = { hackernews: "Hacker News", bluesky: "Bluesky", "shopify-community": "Shopify Community", "shopify-dev-community": "Shopify developer community", github: "GitHub" };
const MENTION_STATE = { ok: "answering", empty: "answering, but empty where results were expected", blocked: "blocked", error: "failing" };
const REMOVE_LABEL = { "wrong-listing": "Not about this listing", spam: "Spam", private: "Private data" };
function MentionRow({ m, act, busy, all = false }) {
  const [publishing, setPublishing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [reason, setReason] = useState("");
  const [interestOpen, setInterestOpen] = useState(false);
  const [note, setNote] = useState("");
  const b = busy === "mention" + m.id;
  const quiet = { background: "none", border: 0, padding: 0, cursor: "pointer", fontFamily: "inherit", fontSize: F.xs, color: C.muted, textDecoration: "underline", textUnderlineOffset: 2 };
  const done = m.status === "removed" || m.status === "published" || m.status === "dismissed";
  const tag = m.status === "removed" ? `removed: ${REMOVE_LABEL[m.reason] || m.reason}`
    : m.status === "published" ? "published" : m.status === "dismissed" ? "dismissed" : MENTION_SOURCE[m.source] || m.source;
  return (
    <Row title={m.listing?.name} tag={tag}
      tagColor={m.status === "removed" ? C.warnInk : undefined} dim={m.status === "removed" || m.status === "dismissed"}
      badges={<>
        {m.vendor && <Pill>from the vendor</Pill>}
        {m.interest && <Pill>has an interest</Pill>}
        {m.affiliate && <Pill>affiliate link</Pill>}
        {m.repeat && <Pill>same account, 3+ times</Pill>}
      </>}
      body={<>
        {m.summary || m.line}
        {m.interest && <span style={{ display: "block", fontSize: F.xs, color: C.muted, marginTop: S.xs }}>Interest: {m.interest.note}</span>}
      </>}
      meta={<>
        {contextLine(m)} · {m.at}
        {" \u00b7 "}<a href={m.url} target="_blank" rel="noopener noreferrer" style={{ color: C.muted }}>open the post</a>
        {" \u00b7 "}<a href={m.listing?.href} style={{ color: C.muted }}>listing</a>
        {m.alsoIn?.length ? ` · also linked in ${m.alsoIn.map((x) => (x.number ? `post ${x.number}` : "a later post") + (x.author ? ` by ${x.author}` : "")).join(", ")}` : ""}
        {!m.summary && m.summaryTried ? " · no summary (post unreadable or no model)" : ""}
        {m.decidedBy ? ` · ${m.status} by ${m.decidedBy} ${String(m.decidedAt).slice(0, 10)}` : ""}
      </>}
      footer={<>
        {publishing && !done && !m.vendor && <MentionPublisher m={m} act={act} busy={busy} onCancel={() => setPublishing(false)} />}
        {!done && (
          <div className="flex flex-wrap items-center" style={{ gap: S.md, marginTop: S.sm }}>
            {/* Secondary: whose words these are, and removal for one of three reasons. */}
            <button type="button" style={quiet} disabled={b} onClick={() => act("mention", m.id, { decision: m.vendor ? "unvendor" : "vendor" })}>
              {m.vendor ? "Not from the vendor" : "From the vendor"}
            </button>
            {m.interest
              ? <button type="button" style={quiet} disabled={b} onClick={() => act("mention", m.id, { decision: "uninterest" })}>No interest</button>
              : interestOpen
                ? <span className="inline-flex items-center" style={{ gap: S.xs }}>
                    <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What the interest is" style={{ ...FIELD, width: 220, padding: "4px 8px", fontSize: F.xs }} />
                    <Btn disabled={!note.trim()} busy={b} onClick={() => { act("mention", m.id, { decision: "interest", reason: note }); setInterestOpen(false); }}>Save</Btn>
                    <button type="button" style={quiet} onClick={() => setInterestOpen(false)}>Cancel</button>
                  </span>
                : <button type="button" style={quiet} onClick={() => setInterestOpen(true)}>Has an interest</button>}
            {removing
              ? <span className="inline-flex items-center" style={{ gap: S.xs }}>
                  <select value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Why remove it" style={{ ...FIELD, width: "auto", padding: "4px 8px", fontSize: F.xs }}>
                    <option value="">Why remove it?</option>
                    {Object.entries(REMOVE_LABEL).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                  </select>
                  <ConfirmBtn disabled={!reason} onConfirm={() => act("mention", m.id, { decision: "remove", reason })} busy={b}>Remove</ConfirmBtn>
                  <button type="button" style={quiet} onClick={() => { setRemoving(false); setReason(""); }}>Cancel</button>
                </span>
              : <button type="button" style={quiet} onClick={() => setRemoving(true)}>Remove…</button>}
          </div>
        )}
      </>}
      actions={m.status === "removed"
        ? <Btn onClick={() => act("mention", m.id, { decision: "restore" })} busy={b}>Restore</Btn>
        : done ? null : <>
          {!all && m.status === "new" && <Btn onClick={() => act("mention", m.id, { decision: "seen" })} busy={b}>Read</Btn>}
          {/* The ordinary end for a mention: kept, out of the Inbox. Quiet on purpose. */}
          <button type="button" style={{ ...quiet, fontSize: F.sm }} disabled={b} onClick={() => act("mention", m.id, { decision: "dismiss" })}>Dismiss</button>
          {!m.vendor && <Btn tone="go" onClick={() => setPublishing(true)} disabled={publishing}>Publish</Btn>}
        </>}
    />
  );
}

/*
 * Publishing a mention to the feed: the same editor as a monitor finding. A
 * drafted line, edited here, published on a second press. The draft is
 * attributed, one line, and never the post's text; the post is read on the
 * server for the draft and not kept (lib/mentionDraft.js, invariant 58).
 */
function MentionPublisher({ m, act, busy, onCancel }) {
  const [open, setOpen] = useState(true);
  const [headline, setHeadline] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [meta, setMeta] = useState(null);
  const [err, setErr] = useState("");
  async function start() {
    setOpen(true); setErr(""); setDrafting(true); setMeta(null);
    try {
      const res = await fetch("/api/admin/announce", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mentionId: m.id }) });
      if (!res.ok) { setErr(`${await res.text()} Write it yourself below.`); return; }
      const d = await res.json();
      setHeadline(d.draft || ""); setMeta(d);
    } catch { setErr("Could not reach the server. Write it yourself below."); }
    finally { setDrafting(false); }
  }
  /* Opened by the row's Publish: draft straight away. */
  useEffect(() => { if (!headline && !drafting && !meta && !err) start(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  if (!open) return null;
  return (
    <div style={{ background: C.raised, border: `1px solid ${C.accentEdge}`, borderRadius: R.card, padding: S.lg, marginTop: S.sm }}>
      <div className="flex flex-wrap" style={{ gap: S.lg }}>
        <div style={{ flex: "2 1 300px", minWidth: 0 }}>
          <label style={{ fontSize: F.xs, color: C.dim, fontWeight: 600, display: "block", marginBottom: 4 }}>
            The line{meta?.provider && <span style={{ fontWeight: 400 }}> · drafted by {meta.provider}</span>}
          </label>
          {drafting
            ? <p style={{ fontSize: F.sm, color: C.muted, margin: 0, padding: "12px 0" }}>Reading the post and writing a draft…</p>
            : <textarea value={headline} onChange={(e) => setHeadline(e.target.value)} rows={3}
                placeholder="Who said what, where. One line, attributed, never their text."
                style={{ ...FIELD, resize: "vertical", lineHeight: 1.55 }} />}
          {meta?.note && <p style={{ fontSize: F.xs, color: C.warnInk, margin: `${S.xs}px 0 0` }}>{meta.note}</p>}
          {err && <p style={{ fontSize: F.xs, color: C.warnInk, margin: `${S.xs}px 0 0` }}>{err}</p>}
        </div>
        <div style={{ flex: "1 1 200px", minWidth: 0, fontSize: F.xs, color: C.muted, lineHeight: 1.6 }}>
          <b style={{ color: C.text }}>What the page will say around it</b><br />
          Mentioned by {m.author || "someone"} on {MENTION_SOURCE[m.source] || m.source}, {m.at}. Their words, not the directory's.<br />
          <a href={m.url} target="_blank" rel="noopener noreferrer" style={{ color: C.muted }}>Read the post</a> before publishing.
        </div>
      </div>
      <div className="flex flex-wrap" style={{ gap: S.sm, marginTop: S.md }}>
        <Btn tone="go" disabled={!headline.trim() || drafting} busy={busy === "publish-mention" + m.id}
          onClick={async () => { const r = await act("publish-mention", m.id, { headline }); if (r?.error) setErr(r.error); }}>Publish</Btn>
        <Btn onClick={() => { setOpen(false); onCancel && onCancel(); }}>Cancel</Btn>
      </div>
    </div>
  );
}

/*
 * Mentions of a general brand that the relevance test judged not
 * Shopify-relevant, kept with the reason so an over-eager filter shows. Keep it
 * puts one in the Inbox and records that the filter was overruled.
 */
function FilteredMentions({ rows = [], act, busy }) {
  const by = {};
  for (const m of rows) by[m.listing?.name] = (by[m.listing?.name] || 0) + 1;
  return (
    <Collapsible title="Filtered as not Shopify-relevant" count={rows.length}
      hint={`Mentions of general brands posted outside the Shopify forums, judged by the model to have nothing to do with Shopify app vendors. Kept, with the reason, so the filter can be checked.${rows.length ? ` By listing: ${Object.entries(by).sort((a, b) => b[1] - a[1]).map(([n, c]) => `${n} (${c})`).join(", ")}.` : ""}`}>
      {rows.length === 0 ? <Empty>Nothing filtered.</Empty> : rows.slice(0, 200).map((m) => (
        <Row key={m.id} title={m.listing?.name} tag={m.relevance?.by === "pending" ? "not judged yet" : "filtered"} dim
          body={m.relevance?.reason || "No reason recorded."}
          meta={<>{contextLine(m)} · {m.at}{" \u00b7 "}<a href={m.url} target="_blank" rel="noopener noreferrer" style={{ color: C.muted }}>open the post</a></>}
          actions={<Btn onClick={() => act("mention", m.id, { decision: "keep" })} busy={busy === "mention" + m.id}>Keep it</Btn>} />
      ))}
    </Collapsible>
  );
}

function MentionsToRead({ rows = [], act, busy }) {
  return (
    <WorkList rows={rows.length} title="Mentions to read" count={rows.length} anchor="q-mentions"
      hint="Posts that link a listed domain, from Hacker News, Bluesky, the Shopify forums and GitHub, collected weekly. Not public: other people's words are not the directory's, and the public page waits until there is enough to show. Matched on the domain only, and never from the listing's own account. Read takes one out of here. Remove only when it is not about the listing, is spam, or exposes private data; it is kept with the reason.">
      {rows.map((m) => <MentionRow key={m.id} m={m} act={act} busy={busy} />)}
    </WorkList>
  );
}

function AllMentions({ rows = [], sources = { lastRunAt: "", sources: {} }, act, busy }) {
  const [run, setRun] = useState("");
  async function runNow() {
    setRun("running");
    try {
      const res = await fetch("/api/cron/mentions", { method: "POST" });
      const d = res.ok ? await res.json() : null;
      setRun(d ? `${d.checked} searches, ${d.found} new, ${d.passed ?? d.found} passed, ${d.filtered ?? 0} filtered${d.byListing ? ` (${Object.entries(d.byListing).map(([k, v]) => `${k} ${v.passed}/${v.in}`).join(", ")})` : ""}. ${Object.entries(d.sources || {}).map(([k, v]) => `${MENTION_SOURCE[k] || k}: ${MENTION_STATE[v.state] || v.state}${v.last ? ` (${v.last})` : ""}`).join(". ")}. Reload to see them.` : `Failed: HTTP ${res.status}`);
    } catch { setRun("Could not reach the server."); }
  }
  const by = {};
  for (const m of rows) if (m.status !== "removed") by[m.listing?.name] = (by[m.listing?.name] || 0) + 1;
  const top = Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([n, c]) => `${n} (${c})`).join(", ");
  return (
    <Collapsible title="Mentions" count={rows.length}
      hint={`Every mention collected, newest first, removed ones included with their reason.${top ? ` Most mentioned: ${top}.` : ""}`}>
      <p style={{ margin: `0 0 ${S.sm}px` }}>
        <Btn onClick={runNow} busy={run === "running"}>Run the collection now</Btn>
        {run && run !== "running" && <span style={{ fontSize: F.xs, color: C.muted, marginLeft: S.sm }}>{run}</span>}
      </p>
      {Object.entries(sources.sources || {}).map(([k, v]) => (
        <Row key={k} title={MENTION_SOURCE[k] || k} tag={MENTION_STATE[v.state] || v.state}
          tagColor={v.state === "ok" ? undefined : C.warnInk}
          meta={`${String(v.at).slice(0, 16).replace("T", " ")} · ${v.requests} searches · ${v.blocked} blocked · ${v.errors} failed · ${v.matched} new · canary ${v.canary < 0 ? "refused" : v.canary}${v.last ? ` · last: ${v.last}` : ""}${v.since && v.state !== "ok" ? ` · since ${String(v.since).slice(0, 10)}` : ""}`} />
      ))}
      {!Object.keys(sources.sources || {}).length && <Empty>The collection has not run yet, so no source has answered.</Empty>}
      {rows.filter((m) => m.status !== "filtered").length === 0 ? <Empty>Nothing collected yet.</Empty>
        : rows.filter((m) => m.status !== "filtered").slice(0, 300).map((m) => <MentionRow key={m.id} m={m} act={act} busy={busy} all />)}
      <FilteredMentions rows={rows.filter((m) => m.status === "filtered")} act={act} busy={busy} />
    </Collapsible>
  );
}

/*
 * What the monthly event refresh found (lib/eventRefresh.js). Nothing here
 * edits lib/events.js: Done means the editor made the change by hand, and
 * Dismiss is remembered by what the finding said, so the same reading is not
 * raised again. A cancelled or ended event is flagged for discard, never
 * removed.
 */
function EventFindings({ rows = [], act, busy }) {
  return (
    <WorkList rows={rows.length} title="Event changes" count={rows.length} anchor="q-events"
      hint="Read from each event's own page by the monthly refresh. Check the source, make the edit to lib/events.js by hand, then press Done. Confidence: 0.6 read once with its quote found on the page, 0.9 read the same on two runs, 0.75 a page unreachable on two runs.">
      {rows.map((f) => (
        <Row key={f.id} title={f.eventName}
          tag={f.label} tagColor={f.kind === "ended" || f.kind === "page-gone" ? C.warnInk : undefined}
          body={<>
            {f.old || f.new ? <>{f.old || "absent"} {"\u2192"} {f.new || "absent"}</> : null}
            {f.quote ? <span style={{ display: "block", color: C.muted, marginTop: S.xs }}>"{f.quote}"</span> : null}
          </>}
          meta={<>
            {Math.round(f.confidence * 100)}% · {f.why} · {String(f.at).slice(0, 10)}
            {" \u00b7 "}<a href={f.source} target="_blank" rel="noopener noreferrer" style={{ color: C.muted }}>source</a>
            {" \u00b7 "}<a href={`/events/${f.eventId}`} style={{ color: C.muted }}>listing</a>
          </>}
          actions={<>
            <Btn onClick={() => act("event-finding", f.id, { decision: "done" })} busy={busy === "event-finding" + f.id} tone="go">Done, edited by hand</Btn>
            <ConfirmBtn onConfirm={() => act("event-finding", f.id, { decision: "dismissed" })} busy={busy === "event-finding" + f.id}>Dismiss</ConfirmBtn>
          </>}
        />
      ))}
    </WorkList>
  );
}

/*
 * Which events the monthly refresh can actually see. An event it cannot read
 * produces no findings, which looks exactly like an event with nothing new.
 */
function EventCoverage({ rows = [], refresh = {} }) {
  const [state, setState] = useState("");
  const blind = rows.filter((r) => r.state !== "read");
  async function run() {
    setState("running");
    try {
      const res = await fetch("/api/cron/events", { method: "POST" });
      const d = res.ok ? await res.json() : null;
      setState(d ? `Checked ${d.checked} of ${d.total}, ${d.found} new finding${d.found === 1 ? "" : "s"}. Reload to see them.` : `Failed: HTTP ${res.status}`);
    } catch { setState("Could not reach the server."); }
  }
  return (
    <Collapsible title="Event refresh coverage" anchor="event-coverage" count={blind.length ? `${blind.length} not read` : rows.length}
      hint={`Every published event, and whether the monthly refresh (1st of the month, 06:00) can read its page. Calendar is the organizer's calendar page, when one is declared as calendarUrl. ${refresh.lastRunAt ? `Last run ${String(refresh.lastRunAt).slice(0, 16).replace("T", " ")}, ${refresh.lastChecked} of ${refresh.total} checked.` : "Not run yet."}`}>
      <p style={{ margin: `0 0 ${S.sm}px` }}>
        <Btn onClick={run} busy={state === "running"}>Run the refresh now</Btn>
        {state && state !== "running" && <span style={{ fontSize: F.xs, color: C.muted, marginLeft: S.sm }}>{state}</span>}
      </p>
      {rows.length === 0 ? <Empty>No events.</Empty> : rows.map((r) => (
        <Row key={r.id} title={r.name} tag={r.label} dim={r.state === "read"}
          meta={[r.status, r.calendar ? `calendar: ${r.calendar}` : "no calendar declared", r.checkedAt ? `checked ${String(r.checkedAt).slice(0, 10)}` : ""].filter(Boolean).join(" · ")} />
      ))}
    </Collapsible>
  );
}

/*
 * Every question asked of Ask the directory (lib/matchLog.js). The ones it
 * could not answer come first: an intent the directory cannot serve is the
 * clearest signal of what to list or build next. Then everything, newest
 * first. No identifier is stored, so none is shown.
 */
function QuestionsAsked({ rows = [] }) {
  const unanswered = rows.filter((r) => !r.answered);
  const fallback = rows.filter((r) => r.path !== "model").length;
  const when = (r) => String(r.at).slice(0, 16).replace("T", " ");
  const found = (r) => Object.entries(r.byKind || {}).map(([k, n]) => `${n} ${k}`).join(", ");
  return (
    <>
      <WorkList title="Questions it could not answer" count={unanswered.length} rows={unanswered.length} anchor="questions-unanswered"
        hint="Asked of Ask the directory and answered with nothing. Each is a candidate for a listing, a section or a post.">
        {unanswered.length === 0 && <Empty>Every question so far got at least one answer.</Empty>}
        {unanswered.map((r, i) => (
          <Row key={r.at + i} title={r.q}
            body={r.gap || ""}
            meta={`${when(r)}${r.path !== "model" ? ` · ${r.path}` : ""}${r.error ? ` · ${r.error}` : ""}`} />
        ))}
      </WorkList>
      <Collapsible title="Questions asked" count={rows.length}
        hint={`The last ${rows.length} questions, newest first.${fallback ? ` ${fallback} answered by keyword matching, without the model.` : ""}`}>
        {rows.length === 0 ? <Empty>Nobody has asked anything yet.</Empty>
          : rows.slice(0, 300).map((r, i) => (
            <Row key={r.at + i} title={r.q} dim={!r.answered}
              body={r.answered ? `Found ${found(r)}.${r.gap ? ` Gap: ${r.gap}` : ""}` : (r.gap || "Nothing found.")}
              meta={`${when(r)} · ${r.path}${r.provider ? ` · ${r.provider}` : ""}`} />
          ))}
      </Collapsible>
    </>
  );
}

/*
 * What app teams asked the growth recommender for. The summary first, because
 * it is the answer to "what do people need": objectives, budgets, stages and
 * App Store categories counted, and which tools came back most. The runs
 * themselves are collapsed underneath. No addresses: runs are stored without
 * them (lib/recommend.js).
 */
function RecommenderRuns({ runs = [], summary = null }) {
  if (!runs.length) {
    return <Section title="Growth recommender" count={0}><Empty>Nobody has run it yet.</Empty></Section>;
  }
  const top = (pairs, n = 5) => pairs.slice(0, n).map(([k, v]) => `${k} (${v})`).join(", ");
  return (
    <>
      <Collapsible title="Growth recommender" count={summary?.total ?? runs.length}
        hint="What app teams asked for, counted. The last 500 runs; the all-time total is under Counts.">
        <Row title="Wanted" body={top(summary?.objectives || [], 8) || "Nothing yet."} />
        <Row title="Budget" body={top(summary?.budgets || []) || "Nothing yet."} />
        <Row title="Stage" body={top(summary?.stages || []) || "Nothing yet."} />
        <Row title="Their App Store categories" body={top(summary?.categories || [], 8) || "No listing read yet."} />
        <Row title="Recommended most" body={top(summary?.picked || [], 8) || "Nothing yet."} />
        {summary?.fallback > 0 && (
          <Row title="Answered without the model" tag="check the provider chain" tagColor={C.warnInk}
            body={`${summary.fallback} of ${summary.total} runs fell back to category and budget ranking.`} />
        )}
      </Collapsible>
      <Collapsible title="Recommender runs" count={runs.length}>
        {runs.slice(0, 200).map((r) => (
          <Row key={r.id}
            title={r.app?.name || r.handle}
            tag={r.path === "model" ? "" : r.path}
            badges={<a href={r.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: F.xs, color: C.muted }}>{r.handle}</a>}
            body={r.answers
              /* Newer runs carry the person's own words; older ones a fixed objective id. */
              ? `${r.answers.problem ? `Not working: ${r.answers.problem.slice(0, 220)}${r.answers.problem.length > 220 ? "…" : ""} ` : ""}${r.answers.objective ? `Wants: ${r.answers.objective.slice(0, 160)}. ` : ""}${r.answers.installs != null ? `${Number(r.answers.installs).toLocaleString("en-US")} installs. ` : ""}${r.answers.budget ? `Budget ${r.answers.budget}. ` : ""}${(r.skipped || []).length ? `Skipped: ${r.skipped.join(", ")}. ` : ""}${r.noneFit ? "Nothing fit the budget." : `Got: ${(r.picks || []).map((p) => p.name).join(", ")}.`}`
              : `Wants: ${r.objective}. ${Number(r.installs).toLocaleString("en-US")} installs, ${r.stage}, budget ${r.budget}. Got: ${(r.picks || []).map((p) => p.name).join(", ")}.`}
            meta={`${String(r.at).slice(0, 16).replace("T", " ")}${r.app?.category ? ` · ${r.app.category}` : ""}${r.app?.rating !== undefined ? ` · ${r.app.rating} from ${r.app.reviews} reviews` : ""}${r.listingRead ? "" : " · listing unread"}${r.provider ? ` · ${r.provider}` : ""}`}
          />
        ))}
      </Collapsible>
    </>
  );
}

/*
 * What people said about the recommender's answers. The misfits lead: a tool
 * recommended often and rejected often means the matching is wrong for it,
 * which is the one finding here that asks for a change. Then the two counts
 * side by side, then every comment in full with the run that produced it, so
 * a bad pick is traceable to the answers behind it.
 */
const HELPED_LABEL = { yes: "Helped", partly: "Partly helped", no: "Did not help" };

function RecommenderFeedback({ feedback = null }) {
  const records = feedback?.records || [];
  if (!feedback || !records.length) {
    return <Section title="Recommender feedback" count={0}><Empty>No feedback on a run yet.</Empty></Section>;
  }
  const h = feedback.helped || {};
  const line = (rows, f) => rows.map(f).join(", ");
  return (
    <>
      <Collapsible title="Recommender feedback" count={records.length}
        hint={`Did it help: ${h.yes || 0} yes, ${h.partly || 0} partly, ${h.no || 0} no. A misfit is recommended at least three times with at least two thumbs down and half or more of its votes down.`}>
        {feedback.misfits.length > 0 && feedback.misfits.map((t) => (
          <Row key={t.id} title={t.name} tag="recommended often, rejected often" tagColor={C.warnInk}
            body={`Recommended ${t.recommended} times. ${t.up} up, ${t.down} down.${t.reasons.length ? ` Why: ${t.reasons.filter((r) => r.vote === -1).map((r) => `"${r.why}"`).join(" ")}` : ""}`}
            meta="The matching is wrong for this one: the prompt, the themes, or its own summary is pulling it into runs it does not fit." />
        ))}
        <Row title="Recommended most" body={line(feedback.mostRecommended, (t) => `${t.name} (${t.recommended}${t.votes ? `, ${t.up} up ${t.down} down` : ""})`) || "Nothing yet."} />
        <Row title="Rejected most" body={line(feedback.mostRejected, (t) => `${t.name} (${t.down} down of ${t.votes}, recommended ${t.recommended})`) || "No thumbs down yet."} />
      </Collapsible>
      <Collapsible title="Feedback in full" count={records.length}>
        {records.slice(0, 200).map((f) => {
          const run = f.run || {};
          const a = run.answers || {};
          return (
            <Row key={f.runId}
              title={run.app?.name || run.handle || f.runId}
              tag={f.helped ? HELPED_LABEL[f.helped] : ""}
              tagColor={f.helped === "no" ? C.warnInk : C.muted}
              badges={run.path && run.path !== "model" ? <Pill>{run.path}</Pill> : null}
              body={(
                <>
                  {f.text && <p style={{ margin: 0, color: C.text, whiteSpace: "pre-wrap" }}>{f.text}</p>}
                  <ul style={{ listStyle: "none", padding: 0, margin: f.text ? "8px 0 0" : 0 }}>
                    {(run.picks || []).map((p) => {
                      const v = (f.picks || {})[p.id];
                      return (
                        <li key={p.id} style={{ marginTop: 4 }}>
                          <b style={{ color: C.text }}>{p.name}</b>{" "}
                          {v?.vote === 1 ? "up" : v?.vote === -1 ? "down" : "no vote"}
                          {v?.why ? `: "${v.why}"` : ""}
                          <span style={{ color: C.dim }}> · model said: {p.why}</span>
                        </li>
                      );
                    })}
                  </ul>
                  <p style={{ margin: "8px 0 0", color: C.dim }}>
                    {a.problem ? `Not working: ${a.problem} ` : ""}{a.objective ? `Wants: ${a.objective}. ` : ""}
                    {a.installs != null ? `${Number(a.installs).toLocaleString("en-US")} installs. ` : ""}
                    {a.revenue ? `Revenue ${a.revenue}. ` : ""}{a.budget ? `Budget ${a.budget}. ` : ""}{a.timeframe ? `Timeframe ${a.timeframe}. ` : ""}
                    {(a.tried || []).length ? `Tried: ${a.tried.join(", ")}. ` : ""}
                    {(run.skipped || []).length ? `Skipped: ${run.skipped.join(", ")}.` : ""}
                  </p>
                </>
              )}
              meta={`${String(f.updatedAt || f.at).slice(0, 16).replace("T", " ")} · run ${String(run.at || "").slice(0, 16).replace("T", " ")}${run.app?.category ? ` · ${run.app.category}` : ""}${run.provider ? ` · ${run.provider}` : ""}${run.considered != null ? ` · ${run.considered} considered` : ""}`}
            />
          );
        })}
      </Collapsible>
    </>
  );
}

/*
 * Announcements: a LinkedIn post queued for something that shipped, so it is
 * not lost (lib/announcements.js). The Draft button is the trigger: nothing
 * queues itself, and nothing here posts. Each post shows its checks beside it,
 * in the warning colour when one fails: a figure that is in neither the
 * catalogue facts nor the description, a hype word, an em-dash. The editor
 * still decides whether the words are right.
 */
const ANN_STATUS = { draft: "Draft", ready: "Ready", posted: "Posted", dropped: "Dropped" };

/* ================================================================== */
/*  Structured data                                                    */
/*                                                                     */
/*  Attributes, pricing tiers and integrations per tool (lib/categories */
/*  .js), drafted from each entry's note (lib/structured.js) and shown  */
/*  beside that note. Nothing reaches a page until Confirm. Unknown is  */
/*  a value: an empty field here means "the note does not say".        */
/* ------------------------------------------------------------------ */

const blankStructured = () => ({ attrs: {}, integrations: [], pricing: { published: true, free: UNKNOWN, trialDays: UNKNOWN, tiers: [], note: "" } });

function StructuredData({ initial = {}, priceOverrides = {} }) {
  const [records, setRecords] = useState(initial);
  const tools = published(ALL_TOOLS).slice().sort((a, b) => a.cat.localeCompare(b.cat) || a.name.localeCompare(b.name));
  const stateOf = (t) => {
    const r = records[t.id];
    if (r?.confirmedAt && priceOverrides[t.id]?.priceAt > r.confirmedAt) return "price changed since";
    if (r?.confirmedAt) return "confirmed";
    return PROPOSED[t.id] ? "to confirm" : "no draft";
  };
  const open = tools.filter((t) => stateOf(t) !== "confirmed");
  const done = tools.filter((t) => stateOf(t) === "confirmed");
  return (
    <>
      <WorkList rows={open.length} title="Details to confirm" count={open.length} anchor="details-to-confirm"
        hint="Each tool's attributes, pricing and integrations, drafted from its note. Read the draft against the note on the left, fix anything wrong, and press Confirm. Only confirmed values are public. A blank value means unknown, and the site shows it as Unknown. A price edited by the vendor or the monitor after you confirm puts the tool back here.">
        {open.length === 0 ? <Empty>Everything is confirmed.</Empty>
          : open.map((t) => <StructuredRow key={t.id} tool={t} record={records[t.id]} state={stateOf(t)} override={priceOverrides[t.id]}
            onSaved={(id, rec) => setRecords((r) => ({ ...r, [id]: rec }))} />)}
      </WorkList>
      <Collapsible title="Confirmed" count={done.length}>
        {done.length === 0 ? <Empty>Nothing confirmed yet.</Empty>
          : done.map((t) => <StructuredRow key={t.id} tool={t} record={records[t.id]} state="confirmed" override={priceOverrides[t.id]}
            onSaved={(id, rec) => setRecords((r) => ({ ...r, [id]: rec }))} />)}
      </Collapsible>
    </>
  );
}

function StructuredRow({ tool, record, state, override, onSaved }) {
  const proposal = PROPOSED[tool.id];
  const start = record?.data || proposal || blankStructured();
  const [open, setOpen] = useState(false);
  const [d, setD] = useState(() => JSON.parse(JSON.stringify({ attrs: start.attrs || {}, integrations: start.integrations || [], pricing: start.pricing || blankStructured().pricing })));
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const attrs = attributesFor(tool.cat);
  const check = sanitiseStructured(tool.cat, d);
  const ev = proposal?.evidence || {};

  async function post(action) {
    setBusy(action); setMsg("");
    try {
      const res = await fetch("/api/admin", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, toolId: tool.id, data: d }),
      });
      if (!res.ok) { setMsg(await res.text()); return; }
      const r = await res.json();
      onSaved(tool.id, r.record);
      setMsg(action === "confirm-structured" ? "Confirmed. It is public now." : "Confirmation cleared. Nothing shows publicly.");
    } catch { setMsg("Could not reach the server."); } finally { setBusy(""); }
  }

  const setAttr = (k, v) => setD((x) => ({ ...x, attrs: { ...x.attrs, [k]: v } }));
  const setP = (k, v) => setD((x) => ({ ...x, pricing: { ...x.pricing, [k]: v } }));
  const setTier = (i, k, v) => setD((x) => ({ ...x, pricing: { ...x.pricing, tiers: x.pricing.tiers.map((t, j) => (j === i ? { ...t, [k]: v } : t)) } }));
  const small = { ...FIELD, width: "auto", padding: "3px 8px", fontSize: F.xs };
  const Ev = ({ k }) => ev[k] ? <span style={{ fontSize: F.xs, color: C.dim }}> “{ev[k]}”</span> : null;

  const field = (a) => {
    const v = d.attrs[a.key];
    if (a.type === "boolean") {
      return (
        <select value={v === true ? "yes" : v === false ? "no" : "unknown"} style={small}
          onChange={(e) => setAttr(a.key, e.target.value === "yes" ? true : e.target.value === "no" ? false : UNKNOWN)}>
          <option value="unknown">Unknown</option><option value="yes">Yes</option><option value="no">No</option>
        </select>
      );
    }
    if (a.type === "enum") {
      return (
        <select value={isUnknown(v) ? "unknown" : v} style={small} onChange={(e) => setAttr(a.key, e.target.value === "unknown" ? UNKNOWN : e.target.value)}>
          <option value="unknown">Unknown</option>
          {a.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }
    return (
      <input value={isUnknown(v) ? "" : v} placeholder="Unknown" style={{ ...small, width: a.type === "number" ? 120 : 260 }}
        onChange={(e) => setAttr(a.key, e.target.value.trim() === "" ? UNKNOWN : a.type === "number" ? e.target.value.replace(/[^0-9.]/g, "") : e.target.value)} />
    );
  };

  return (
    <Row
      title={<button onClick={() => setOpen((o) => !o)} aria-expanded={open} style={{ background: "none", border: 0, padding: 0, font: "inherit", color: C.text, cursor: "pointer" }}>{tool.name}</button>}
      tag={state}
      tagColor={state === "price changed since" ? C.warnInk : undefined}
      badges={<Pill>{catOf(tool.cat).label}</Pill>}
      meta={<>Draft from the note{proposal ? "" : ": none, start from blank"} · price now: {tool.price}{override?.price ? ` · vendor or monitor price: ${override.price}` : ""}</>}
      body={open ? (
        <div className="flex flex-wrap" style={{ gap: S.xl, marginTop: S.sm }}>
          <div style={{ flex: "1 1 320px", minWidth: 0 }}>
            <p style={{ margin: 0 }}><b style={{ color: C.text }}>Price.</b> {tool.price}</p>
            <p style={{ margin: `${S.sm}px 0 0` }}><b style={{ color: C.text }}>Note.</b> {tool.note}</p>
            <p style={{ margin: `${S.sm}px 0 0` }}><b style={{ color: C.text }}>Watch.</b> {tool.watch}</p>
            {proposal?.doubts?.length > 0 && (
              <ul style={{ margin: `${S.sm}px 0 0`, paddingLeft: 18, color: C.warnInk }}>
                {proposal.doubts.map((x, i) => <li key={i}>{x}</li>)}
              </ul>
            )}
          </div>
          <div style={{ flex: "1 1 380px", minWidth: 0, color: C.text }}>
            <b>Attributes</b>
            {attrs.map((a) => (
              <div key={a.key} style={{ marginTop: S.xs }}>
                <span style={{ display: "inline-block", width: 180 }}>{a.label}{a.from ? " *" : ""}</span>{field(a)}<Ev k={a.key} />
              </div>
            ))}
            {attrs.some((a) => a.from) && <p style={{ fontSize: F.xs, color: C.dim, margin: `${S.xs}px 0 0` }}>* Yes whenever the matching integration is ticked below.</p>}

            <div style={{ marginTop: S.md }}><b>Pricing</b><Ev k="pricing" /></div>
            <div className="flex flex-wrap items-center" style={{ gap: S.sm, marginTop: S.xs }}>
              <select value={d.pricing.published ? "yes" : "no"} style={small} onChange={(e) => setP("published", e.target.value === "yes")}>
                <option value="yes">Published</option><option value="no">Not published</option>
              </select>
              <select value={d.pricing.free === true ? "yes" : d.pricing.free === false ? "no" : "unknown"} style={small}
                onChange={(e) => setP("free", e.target.value === "yes" ? true : e.target.value === "no" ? false : UNKNOWN)}>
                <option value="unknown">Free tier: unknown</option><option value="yes">Free tier: yes</option><option value="no">Free tier: no</option>
              </select>
              <input value={isUnknown(d.pricing.trialDays) ? "" : d.pricing.trialDays} placeholder="Trial days: unknown" style={{ ...small, width: 150 }}
                onChange={(e) => setP("trialDays", e.target.value.trim() === "" ? UNKNOWN : e.target.value.replace(/[^0-9]/g, ""))} />
            </div>
            {d.pricing.published && d.pricing.tiers.map((t, i) => (
              <div key={i} className="flex flex-wrap items-center" style={{ gap: S.xs, marginTop: S.xs }}>
                <input value={t.name} placeholder="Tier name" style={{ ...small, width: 110 }} onChange={(e) => setTier(i, "name", e.target.value)} />
                <input value={t.amount} placeholder="Amount" style={{ ...small, width: 80 }} onChange={(e) => setTier(i, "amount", e.target.value.replace(/[^0-9.]/g, ""))} />
                <select value={t.currency} style={small} onChange={(e) => setTier(i, "currency", e.target.value)}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select>
                <select value={t.period} style={small} onChange={(e) => setTier(i, "period", e.target.value)}>{PERIODS.map((c) => <option key={c}>{c}</option>)}</select>
                <select value={t.unit} style={small} onChange={(e) => setTier(i, "unit", e.target.value)}>{UNITS.map((c) => <option key={c}>{c}</option>)}</select>
                <Btn onClick={() => setD((x) => ({ ...x, pricing: { ...x.pricing, tiers: x.pricing.tiers.filter((_, j) => j !== i) } }))}>Remove</Btn>
              </div>
            ))}
            {d.pricing.published && (
              <div style={{ marginTop: S.xs }}>
                <Btn onClick={() => setD((x) => ({ ...x, pricing: { ...x.pricing, tiers: [...x.pricing.tiers, { name: "", amount: "", currency: "USD", period: "month", unit: "flat" }] } }))}>Add a tier</Btn>
              </div>
            )}
            <input value={d.pricing.note} placeholder="Condition the tiers cannot hold (optional)" style={{ ...small, width: "100%", marginTop: S.xs }}
              onChange={(e) => setP("note", e.target.value)} />
            <p style={{ margin: `${S.xs}px 0 0` }}>Shows as: <b>{check.data ? pricingDisplay(check.data.pricing) : "…"}</b></p>

            <div style={{ marginTop: S.md }}><b>Integrations</b></div>
            <div className="flex flex-wrap" style={{ gap: S.sm, marginTop: S.xs }}>
              {INTEGRATIONS.map((i) => (
                <label key={i.id} style={{ fontSize: F.xs }} title={ev[i.id] || ""}>
                  <input type="checkbox" checked={d.integrations.includes(i.id)}
                    onChange={(e) => setD((x) => ({ ...x, integrations: e.target.checked ? [...x.integrations, i.id] : x.integrations.filter((y) => y !== i.id) }))} />{" "}
                  {i.label}{ev[i.id] ? " ·" : ""}
                </label>
              ))}
            </div>
            {check.error && <p style={{ color: C.warnInk, margin: `${S.sm}px 0 0` }}>{check.error}</p>}
            <div className="flex flex-wrap items-center" style={{ gap: S.sm, marginTop: S.md }}>
              <Btn tone="go" busy={busy === "confirm-structured"} disabled={Boolean(check.error)} onClick={() => post("confirm-structured")}>
                {record?.confirmedAt ? "Confirm again" : "Confirm"}
              </Btn>
              {record?.confirmedAt && <ConfirmBtn busy={busy === "clear-structured"} onConfirm={() => post("clear-structured")} confirm="Take it off the site?">Clear confirmation</ConfirmBtn>}
              {msg && <span style={{ fontSize: F.xs, color: C.muted }}>{msg}</span>}
            </div>
          </div>
        </div>
      ) : (proposal?.doubts?.length ? <p style={{ margin: 0, color: C.warnInk }}>{proposal.doubts.length} doubt{proposal.doubts.length > 1 ? "s" : ""} in the draft</p> : null)}
    />
  );
}

/* ================================================================== */
/*  Outreach (temporary)                                               */
/*                                                                     */
/*  Writing to a listed vendor about their listing. Copy and send from  */
/*  your own mailbox by default; Resend from watchfor.tools only when   */
/*  chosen, rationed, and acknowledged once. lib/outreach.js.           */
/* ------------------------------------------------------------------ */

function Outreach({ initial = { contacts: {}, state: {}, meta: {} }, claims = {} }) {
  const tools = published(ALL_TOOLS).slice().sort((a, b) => a.name.localeCompare(b.name));
  const [state, setState] = useState(initial.state || {});
  const [meta, setMeta] = useState(initial.meta || {});
  const [id, setId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [body, setBody] = useState(DEFAULT_BODY);
  const [path, setPath] = useState("copy");
  const [again, setAgain] = useState(false);
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [copied, setCopied] = useState("");
  const contacts = initial.contacts || {};
  const claimedOf = (tid) => claims[tid]?.status === "verified";
  const statusOf = (tid) => (claimedOf(tid) ? "claimed"
    : state[tid]?.status === "replied" ? `replied ${String(state[tid].repliedAt).slice(0, 10)}`
      : state[tid]?.status === "contacted" ? `contacted ${String(state[tid].contactedAt).slice(0, 10)}` : "not contacted");
  const tool = tools.find((t) => t.id === id);
  const contact = tool ? contacts[tool.id] : null;
  const values = tool ? valuesFor(tool, { firstName, categoryLabel: catOf(tool.cat).label, owner: ownershipLine(tool) }) : null;
  const filledSubject = tool ? fill(subject, values) : "";
  const filledBody = tool ? fill(body, values) : "";
  const left = tool ? [...unfilled(filledSubject), ...unfilled(filledBody)] : [];
  /*
   * The same voice checks the LinkedIn panel shows (lib/voice.js, the ali-voice
   * rules), on what you wrote. The listing's own summary and caveat are left out
   * of the check: they are quoted, not written for this email.
   */
  const v = voiceIssues(fill(subject + "\n\n" + body, { ...(values || {}), one: "", watch: "" }));
  const voiceFlags = [
    v.emDash ? "Has an em-dash" : "",
    v.semicolons ? `${v.semicolons} semicolon${v.semicolons === 1 ? "" : "s"}` : "",
    v.exclamations ? "Exclamation mark" : "",
    v.marketing.length ? `Marketing words: ${v.marketing.join(", ")}` : "",
    v.hedges.length ? `Hedges: ${v.hedges.join(", ")}` : "",
    v.long.length ? `Long sentence: ${v.long.join("; ")}` : "",
  ].filter(Boolean);

  async function post(payload, tag) {
    setBusy(tag); setMsg("");
    try {
      const res = await fetch("/api/admin/outreach", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (res.status === 428) { setMsg("first-send"); return null; }
      if (!res.ok) { setMsg(await res.text()); return null; }
      const d = await res.json();
      if (d.outreach) setState(d.outreach);
      if (d.meta) setMeta(d.meta);
      return d;
    } catch { setMsg("Could not reach the server."); return null; } finally { setBusy(""); }
  }
  const copy = async (text, what) => { try { await navigator.clipboard.writeText(text); setCopied(what); setTimeout(() => setCopied(""), 2000); } catch { setMsg("The browser refused the clipboard."); } };

  const counts = tools.reduce((n, t) => { const s = statusOf(t.id).split(" ")[0]; n[s] = (n[s] || 0) + 1; return n; }, {});
  const field = { ...FIELD, width: "100%" };
  return (
    <Collapsible title="Outreach" anchor="outreach" count={`${counts["not"] || 0} not contacted`}
      hint="Temporary. Write to a listed vendor about their listing. Pick a tool: the draft fills from the catalogue. By default you copy it and send it from your own mailbox, so a vendor replies to a person. Every send, either way, is logged.">
      <div style={{ padding: "12px 0" }}>
        <p style={{ margin: `0 0 ${S.sm}px`, fontSize: F.xs, color: C.dim }}>
          {Object.entries(counts).map(([k, v]) => `${v} ${k === "not" ? "not contacted" : k}`).join(" · ")}
        </p>
        <select value={id} onChange={(e) => { setId(e.target.value); setFirstName(""); setAgain(false); setMsg(""); }} aria-label="Tool to write to" style={field}>
          <option value="">Pick a tool</option>
          {tools.map((t) => (
            <option key={t.id} value={t.id}>{t.name} · {statusOf(t.id)}{contacts[t.id]?.email ? "" : " · no email"}</option>
          ))}
        </select>

        {tool && (
          <>
            <div style={{ marginTop: S.md, padding: S.md, border: `1px solid ${C.line}`, borderRadius: R.control, fontSize: F.sm, lineHeight: 1.6 }}>
              <p style={{ margin: 0 }}><b>{tool.name}</b> · {catOf(tool.cat).label} · <a href={`/tools/${tool.id}`} target="_blank" rel="noopener noreferrer" style={{ color: C.text }}>watchfor.tools/tools/{tool.id}</a></p>
              <p style={{ margin: "4px 0 0" }}><b>One line.</b> {tool.one}</p>
              <p style={{ margin: "4px 0 0" }}><b>Price.</b> {tool.price}</p>
              <p style={{ margin: "4px 0 0" }}><b>Watch.</b> {tool.watch}</p>
              <p style={{ margin: "4px 0 0" }}><b>Claimed.</b> {claimedOf(tool.id) ? `Yes, by ${claims[tool.id].email}` : "No"} · <b>Ownership.</b> {ownershipLine(tool) || "none recorded"}</p>
              <p style={{ margin: "4px 0 0" }}>
                <b>Contact.</b>{" "}
                {contact?.email ? <>{contact.email}, found at <a href={contact.source} target="_blank" rel="noopener noreferrer" style={{ color: C.text }}>{contact.source}</a> on {contact.checked}
                  {contact.caution && <span style={{ display: "block", color: C.warnInk }}>Caution: {contact.caution} Copy only.</span>}
                  {contact.others?.length > 0 && <span style={{ display: "block", color: C.dim, fontSize: F.xs }}>Also published: {contact.others.map((o) => o.email).join(", ")}</span>}</>
                  : <>No address published on their site{contact?.note ? ` (${contact.note})` : ""}.{" "}
                    {tool.social?.li ? <a href={tool.social.li} target="_blank" rel="noopener noreferrer" style={{ color: C.text }}>Write on LinkedIn instead</a> : "No LinkedIn profile recorded either."}</>}
              </p>
              {state[tool.id]?.history?.length > 0 && (
                <p style={{ margin: "4px 0 0", color: C.dim, fontSize: F.xs }}>
                  {state[tool.id].history.map((h) => `${String(h.at).slice(0, 10)} ${h.what}${h.via ? ` via ${h.via}` : ""}`).join(" · ")}
                </p>
              )}
              {claimedOf(tool.id) && <p style={{ margin: "4px 0 0", color: C.warnInk }}>Already claimed. They have the listing, so there is nothing to invite them to.</p>}
            </div>

            <div className="flex flex-wrap" style={{ gap: S.lg, marginTop: S.md }}>
              <div style={{ flex: "1 1 360px", minWidth: 0 }}>
                <label style={LABEL}>First name (optional)</label>
                <input value={firstName} onChange={(e) => setFirstName(e.target.value)} style={field} />
                <label style={{ ...LABEL, marginTop: S.sm }}>Subject</label>
                <input value={subject} onChange={(e) => setSubject(e.target.value)} style={field} />
                <label style={{ ...LABEL, marginTop: S.sm }}>Template</label>
                <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={22} style={{ ...field, resize: "vertical", lineHeight: 1.5, fontFamily: "inherit" }} />
                <p style={{ fontSize: F.xs, color: C.dim, margin: `${S.xs}px 0 0`, lineHeight: 1.6 }}>
                  {PLACEHOLDERS.map(([k, d]) => `{${k}}: ${d}`).join(" · ")}
                </p>
                <Btn onClick={() => { setSubject(DEFAULT_SUBJECT); setBody(DEFAULT_BODY); }}>Reset the template</Btn>
              </div>
              <div style={{ flex: "1 1 360px", minWidth: 0 }}>
                <label style={LABEL}>As it will be sent</label>
                <div style={{ border: `1px solid ${C.line}`, borderRadius: R.control, padding: S.md, background: C.panel }}>
                  <p style={{ margin: 0, fontWeight: 700 }}>{filledSubject}</p>
                  <p style={{ margin: `${S.sm}px 0 0`, whiteSpace: "pre-wrap", lineHeight: 1.55, fontSize: F.sm }}>{filledBody}</p>
                </div>
                {left.length > 0 && <p style={{ color: C.warnInk, fontSize: F.xs }}>Not filled: {left.join(", ")}</p>}
                {voiceFlags.map((f) => <p key={f} style={{ color: C.warnInk, fontSize: F.xs, margin: `${S.xs}px 0 0` }}>Voice: {f}</p>)}
              </div>
            </div>

            <div style={{ marginTop: S.md }}>
              <label style={{ fontSize: F.sm, marginRight: S.lg }}><input type="radio" checked={path === "copy"} onChange={() => setPath("copy")} /> Copy, and send from my own mailbox (default)</label>
              <label style={{ fontSize: F.sm }}><input type="radio" checked={path === "resend"} onChange={() => setPath("resend")} disabled={!contact?.email || Boolean(contact?.caution)} /> Send from watchfor.tools{!contact?.email ? " (no address)" : contact?.caution ? " (address marked for caution)" : ""}</label>
            </div>

            {path === "copy" ? (
              <div className="flex flex-wrap items-center" style={{ gap: S.sm, marginTop: S.sm }}>
                {contact?.email && <Btn onClick={() => copy(contact.email, "to")}>{copied === "to" ? "Copied" : "Copy address"}</Btn>}
                <Btn onClick={() => copy(filledSubject, "subject")}>{copied === "subject" ? "Copied" : "Copy subject"}</Btn>
                <Btn onClick={() => copy(filledBody, "body")}>{copied === "body" ? "Copied" : "Copy email"}</Btn>
                <Btn tone="go" busy={busy === "contacted"} onClick={() => post({ action: "contacted", toolId: tool.id, subject: filledSubject }, "contacted")}>I sent it</Btn>
              </div>
            ) : (
              <div style={{ marginTop: S.sm, padding: S.md, border: `1px solid ${C.edge}`, borderRadius: R.control }}>
                <p style={{ margin: 0, fontSize: F.sm, color: C.warnInk, lineHeight: 1.55 }}>
                  This sends cold email from watchfor.tools, the same domain the sign-in links come from. A bounce or a spam
                  report counts against that domain, and sign-in emails start landing in spam. Limited to {5} a day, only to an
                  address found on the vendor's own site, and replies go to you.
                </p>
                {!meta.resendAcknowledgedAt && (
                  <label style={{ display: "block", marginTop: S.sm, fontSize: F.sm }}>
                    <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} /> I understand, and I want to send through watchfor.tools
                  </label>
                )}
                {state[tool.id]?.contactedAt && (
                  <label style={{ display: "block", marginTop: S.sm, fontSize: F.sm }}>
                    <input type="checkbox" checked={again} onChange={(e) => setAgain(e.target.checked)} /> Send again: they were contacted on {String(state[tool.id].contactedAt).slice(0, 10)}
                  </label>
                )}
                <div className="flex flex-wrap items-center" style={{ gap: S.sm, marginTop: S.sm }}>
                  <Btn tone="go" busy={busy === "send"} disabled={left.length > 0 || (!meta.resendAcknowledgedAt && !ack)}
                    onClick={async () => {
                      if (!meta.resendAcknowledgedAt) { const a = await post({ action: "acknowledge" }, "send"); if (!a) return; }
                      const r = await post({ action: "send", toolId: tool.id, subject: filledSubject, body: filledBody, again }, "send");
                      if (r) setMsg(`Sent to ${contact.email}.`);
                    }}>Send to {contact?.email}</Btn>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center" style={{ gap: S.sm, marginTop: S.md }}>
              {state[tool.id]?.status === "contacted" && <Btn busy={busy === "replied"} onClick={() => post({ action: "replied", toolId: tool.id }, "replied")}>They replied</Btn>}
              {state[tool.id]?.status && <ConfirmBtn busy={busy === "clear"} onConfirm={() => post({ action: "clear", toolId: tool.id }, "clear")} confirm="Clear the record?">Clear</ConfirmBtn>}
              {msg && msg !== "first-send" && <span style={{ fontSize: F.xs, color: C.muted }}>{msg}</span>}
              {msg === "first-send" && <span style={{ fontSize: F.xs, color: C.warnInk }}>Tick the box above first.</span>}
            </div>
          </>
        )}
      </div>
    </Collapsible>
  );
}

/* ================================================================== */
/*  Ideas                                                              */
/*                                                                     */
/*  The backlog (lib/ideas.js). Capture in any form, an advisory AI    */
/*  review stored with the idea, statuses sorted then dated, and a     */
/*  prompt to paste into Claude Code. Nothing here starts a session.   */
/* ------------------------------------------------------------------ */

const REPO_URL = "https://github.com/ali-fastbundle/shopify-vendor-tools";

function Ideas({ initial = [] }) {
  const [rows, setRows] = useState(sortIdeas(initial));
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [form, setForm] = useState({ text: "", surface: "", size: "" });

  async function post(body, tag) {
    setBusy(tag); setErr("");
    try {
      const res = await fetch("/api/admin/ideas", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (!res.ok) { setErr(await res.text()); return false; }
      setRows(sortIdeas((await res.json()).ideas || []));
      return true;
    } catch { setErr("Could not reach the server."); return false; } finally { setBusy(""); }
  }

  const open = rows.filter((r) => !["shipped", "dropped"].includes(r.status));
  const shipped = rows.filter((r) => r.status === "shipped");
  const dropped = rows.filter((r) => r.status === "dropped");

  return (
    <>
      <WorkList rows={open.length} title="Ideas" count={open.length} anchor="ideas"
        hint="Write it in whatever form it arrived. Review this asks a model what it would take, what already covers it, which invariants it touches and what is wrong with it. The review is advice: it is kept with the idea, and approving against it is recorded. An approved idea can be copied as a prompt for Claude Code; paste the commit hash back when it ships.">
        <div style={{ padding: "12px 0" }}>
          <textarea value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })}
            rows={4} placeholder="The idea: a sentence, a paragraph, a pasted email" aria-label="The idea"
            style={{ ...FIELD, resize: "vertical", lineHeight: 1.5 }} />
          <div className="flex flex-wrap items-center mt-2" style={{ gap: S.sm }}>
            <select value={form.surface} onChange={(e) => setForm({ ...form, surface: e.target.value })}
              aria-label="Which surface it touches" style={{ ...FIELD, width: 200 }}>
              <option value="">Surface (optional)</option>
              {SURFACES.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
            <select value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })}
              aria-label="Rough size" style={{ ...FIELD, width: 180 }}>
              <option value="">Size guess (optional)</option>
              {SIZES.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
            <Btn tone="go" busy={busy === "add"} disabled={form.text.trim().length < 10}
              onClick={async () => { if (await post({ action: "add", ...form }, "add")) setForm({ text: "", surface: "", size: "" }); }}>
              Add idea
            </Btn>
          </div>
          {err && <p style={{ fontSize: F.sm, color: C.warnInk, margin: `${S.sm}px 0 0` }}>{err}</p>}
        </div>
        {open.length === 0
          ? <Empty>Nothing open. Everything is shipped or dropped.</Empty>
          : open.map((r) => <IdeaRow key={r.id} idea={r} post={post} busy={busy} />)}
      </WorkList>
      <Collapsible title="Shipped" count={shipped.length}>
        {shipped.length === 0 ? <Empty>Nothing shipped from here yet.</Empty>
          : shipped.map((r) => <IdeaRow key={r.id} idea={r} post={post} busy={busy} />)}
      </Collapsible>
      <Collapsible title="Dropped" count={dropped.length}
        hint="Kept with the reason, and shown to every review, so the same idea next month is met with when and why it was dropped.">
        {dropped.length === 0 ? <Empty>Nothing dropped.</Empty>
          : dropped.map((r) => <IdeaRow key={r.id} idea={r} post={post} busy={busy} />)}
      </Collapsible>
    </>
  );
}

function IdeaRow({ idea, post, busy }) {
  const [openRow, setOpenRow] = useState(false);
  const [status, setStatus] = useState(idea.status);
  const [reason, setReason] = useState("");
  const [hash, setHash] = useState("");
  const [copied, setCopied] = useState(false);
  const r = latestReview(idea);
  const handoff = idea.status === "approved" || idea.status === "in progress";

  async function copy() {
    const text = handoffPrompt(idea);
    try { await navigator.clipboard.writeText(text); } catch {
      const t = document.createElement("textarea"); t.value = text; document.body.appendChild(t); t.select();
      try { document.execCommand("copy"); } catch {} t.remove();
    }
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Row
      dim={idea.status === "dropped"}
      title={<button onClick={() => setOpenRow((o) => !o)} aria-expanded={openRow} style={{
        background: "none", border: 0, padding: 0, font: "inherit", color: C.text, cursor: "pointer", textAlign: "left",
      }}>{ideaTitle(idea)}</button>}
      tag={idea.status}
      badges={<>
        {idea.surface && <Pill>{idea.surface}</Pill>}
        {idea.size && <Pill>{idea.size}</Pill>}
        {r && <Pill tone={r.verdict === "against" ? "warn" : "neutral"}>{`Review: ${VERDICTS[r.verdict]}${r.size ? `, ${r.size}` : ""}`}</Pill>}
        {idea.overrode && <Pill>approved over the review</Pill>}
      </>}
      meta={<>
        Added {String(idea.createdAt).slice(0, 10)}
        {idea.seeded ? " · seeded" : ""}
        {idea.commits?.length ? <> · shipped in {idea.commits.map((c, i) => (
          <React.Fragment key={c}>{i ? ", " : ""}<a href={`${REPO_URL}/commit/${c}`} target="_blank" rel="noopener noreferrer" style={{ color: C.muted }}>{c.slice(0, 7)}</a></React.Fragment>
        ))}</> : ""}
        {idea.dropped ? ` · dropped ${String(idea.dropped.at).slice(0, 10)}: ${idea.dropped.reason}` : ""}
      </>}
      body={openRow ? (
        <>
          <p style={{ margin: 0, whiteSpace: "pre-wrap", color: C.text }}>{idea.text}</p>
          {idea.stateNote && <p style={{ margin: `${S.sm}px 0 0` }}><b>Where it stands.</b> {idea.stateNote}</p>}
          {idea.editorRecord && (
            <div style={{ margin: `${S.sm}px 0 0` }}>
              <p style={{ margin: 0 }}><b>Editor's ruling on the review</b> ({idea.editorRecord.at}). The next review starts from this.</p>
              <ul style={{ margin: `${S.xs}px 0 0`, paddingLeft: 18 }}>
                {idea.editorRecord.struck.map((x) => <li key={x.objection}><s>{x.objection}</s>. {x.why}</li>)}
                {idea.editorRecord.objections.map((x) => <li key={x}>{x}</li>)}
              </ul>
            </div>
          )}
          {r && <IdeaReview review={r} older={(idea.reviews || []).length - 1} />}
          {idea.log?.length > 0 && (
            <p style={{ margin: `${S.sm}px 0 0`, fontSize: F.xs, color: C.dim }}>
              {idea.log.slice(0, 6).map((l) => `${String(l.at).slice(0, 10)} ${l.from} to ${l.to}${l.reason ? ` (${l.reason})` : ""}`).join(" · ")}
            </p>
          )}
        </>
      ) : (r?.summary ? <p style={{ margin: 0 }}>{r.summary}</p> : null)}
      actions={<>
        <Btn busy={busy === `review${idea.id}`} onClick={() => { setOpenRow(true); post({ action: "review", id: idea.id }, `review${idea.id}`); }}
          title="Sends CLAUDE.md, the catalogue and the backlog to the model. Takes up to a couple of minutes.">
          {r ? "Review again" : "Review this"}
        </Btn>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status"
          style={{ ...FIELD, width: 140, padding: "3px 8px", fontSize: F.xs }}>
          {IDEA_STATUSES.map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
        {status !== idea.status && (
          <>
            <input value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder={status === "dropped" ? "Why (required)" : (status === "approved" || status === "in progress") && r && r.verdict !== "go" ? "Why, over the review (optional)" : "Note (optional)"}
              aria-label="Reason" style={{ ...FIELD, width: 260, padding: "3px 8px", fontSize: F.xs }} />
            <Btn tone={status === "dropped" ? "stop" : "go"} busy={busy === `status${idea.id}`}
              disabled={status === "dropped" && reason.trim().length < 5}
              onClick={async () => { if (await post({ action: "update", id: idea.id, status, reason }, `status${idea.id}`)) setReason(""); }}>
              Move to {status}
            </Btn>
          </>
        )}
        {handoff && <Btn onClick={copy}>{copied ? "Copied" : "Copy as prompt"}</Btn>}
        {(handoff || idea.status === "shipped") && (
          <span className="inline-flex" style={{ gap: S.xs }}>
            <input value={hash} onChange={(e) => setHash(e.target.value.trim())} placeholder="Commit hash"
              aria-label="Commit hash that shipped it" style={{ ...FIELD, width: 130, padding: "3px 8px", fontSize: F.xs }} />
            <Btn busy={busy === `commit${idea.id}`} disabled={!isCommitHash(hash)}
              onClick={async () => { if (await post({ action: "commit", id: idea.id, hash }, `commit${idea.id}`)) setHash(""); }}>
              Record commit
            </Btn>
          </span>
        )}
      </>}
    />
  );
}

function IdeaReview({ review: r, older = 0 }) {
  const List = ({ title, items }) => items?.length ? (
    <div style={{ marginTop: S.sm }}>
      <b style={{ color: C.text }}>{title}</b>
      <ul style={{ margin: "2px 0 0", paddingLeft: 18 }}>{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
    </div>
  ) : null;
  return (
    <div style={{ marginTop: S.md, borderLeft: `2px solid ${C.edge}`, paddingLeft: S.md }}>
      <p style={{ margin: 0, color: C.text }}>
        <b>Review, {String(r.at).slice(0, 10)}: {VERDICTS[r.verdict]}</b>{r.size ? `, ${r.size}` : ""}.
        {" "}{r.summary}
      </p>
      {r.decidedBefore && <p style={{ margin: `${S.sm}px 0 0`, color: C.warnInk }}>Decided before: {r.decidedBefore}</p>}
      <List title="Objections" items={r.objections} />
      <List title="Already built" items={r.covered} />
      <List title="Would require" items={r.requires} />
      {r.invariants?.length > 0 && (
        <List title="Invariants" items={r.invariants.map((x) => `${x.ref}. ${x.name}: ${x.how}${x.conflict ? " Conflicts." : ""}`)} />
      )}
      <List title="Repeats" items={(r.duplicates || []).map((d) => `${d.id}: ${d.why}`)} />
      <List title="Depends on, not built" items={r.dependsOn} />
      <p style={{ margin: `${S.sm}px 0 0`, fontSize: F.xs, color: C.dim }}>
        {r.provider ? `By ${r.provider}. ` : ""}Advisory.{older > 0 ? ` ${older} earlier review${older > 1 ? "s" : ""} kept.` : ""}
        {r.dropped?.length ? ` Dropped from the answer: ${r.dropped.join("; ")}.` : ""}
      </p>
    </div>
  );
}

function Announcements({ initial = [] }) {
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [form, setForm] = useState({ kind: "feature", what: "", url: "", since: "" });

  async function post(body, tag) {
    setBusy(tag); setErr("");
    try {
      const res = await fetch("/api/admin/announcements", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (!res.ok) { setErr(await res.text()); return false; }
      setRows((await res.json()).announcements || []);
      return true;
    } catch { setErr("Could not reach the server."); return false; } finally { setBusy(""); }
  }

  const open = rows.filter((r) => r.status === "draft" || r.status === "ready");
  const done = rows.filter((r) => r.status === "posted" || r.status === "dropped");

  return (
    <>
      <WorkList rows={open.length} title="Announcements" count={open.length} anchor="announcements"
        hint="A LinkedIn post for something that shipped, queued until it is posted or dropped. Drafting is a button you press; posting is you, pasting it into LinkedIn and marking it posted. Figures come from the published catalogue at the moment of drafting.">
        <div style={{ padding: "12px 0", borderTop: 0 }}>
          <div className="flex flex-wrap" style={{ gap: S.sm }}>
            <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} aria-label="What kind of thing shipped"
              style={{ ...FIELD, width: 200 }}>
              <option value="feature">A feature</option>
              <option value="section">A section</option>
              <option value="listings">A batch of listings</option>
            </select>
            <input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://watchfor.tools/... (optional)"
              aria-label="Where it lives" style={{ ...FIELD, flex: 1, minWidth: 220 }} />
            {form.kind === "listings" && (
              <input type="date" value={form.since} onChange={(e) => setForm({ ...form, since: e.target.value })}
                aria-label="Listings updated since" title="Listings with an updated date on or after this are given to the draft" style={{ ...FIELD, width: 170 }} />
            )}
          </div>
          <Grow value={form.what} onChange={(e) => setForm({ ...form, what: e.target.value })} rows={3}
            placeholder="What shipped, in your words. The draft can say only what this and the catalogue say."
            style={{ ...FIELD, marginTop: S.sm }} />
          <div className="flex flex-wrap items-center mt-2" style={{ gap: S.sm }}>
            <Btn tone="go" busy={busy === "draft"} disabled={form.what.trim().length < 20}
              onClick={async () => { if (await post({ action: "draft", ...form }, "draft")) setForm({ kind: "feature", what: "", url: "", since: "" }); }}>
              Draft a post
            </Btn>
            {err && <span style={{ fontSize: F.xs, color: C.badInk }}>{err}</span>}
          </div>
        </div>
        {open.length === 0
          ? <Empty>Nothing queued.</Empty>
          : open.map((r) => <AnnouncementRow key={r.id} r={r} busy={busy} post={post} />)}
      </WorkList>
      <Collapsible title="Posted and dropped" count={done.length}>
        {done.length === 0 ? <Empty>Nothing posted or dropped yet.</Empty>
          : done.map((r) => <AnnouncementRow key={r.id} r={r} busy={busy} post={post} />)}
      </Collapsible>
    </>
  );
}

function AnnouncementRow({ r, busy, post }) {
  /* One line per post until opened: nineteen open editors made the tab a wall. */
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(r.text);
  const [postedAt, setPostedAt] = useState(r.postedAt || new Date().toISOString().slice(0, 10));
  const [copied, setCopied] = useState(false);
  useEffect(() => { setText(r.text); }, [r.text]);
  const c = r.checks || { hype: [], numbers: [], emDash: false, words: 0 };
  const dirty = text !== r.text;
  const fails = [
    c.numbers.length ? `Figures not in the facts or the description: ${c.numbers.join(", ")}` : "",
    c.hype.length ? `Hype: ${c.hype.join(", ")}` : "",
    c.emDash ? "Has an em-dash" : "",
    c.semicolons ? "Has a semicolon" : "",
    c.long?.length ? `Long sentence: ${c.long.join("; ")}` : "",
  ].filter(Boolean);
  const tag = (s) => `${s}:${r.id}`;
  return (
    <Row
      title={<button onClick={() => setOpen((o) => !o)} aria-expanded={open} style={{ background: "none", border: 0, padding: 0, font: "inherit", color: C.text, cursor: "pointer", textAlign: "left" }}>
        {r.what.length > 90 ? `${r.what.slice(0, 90)}…` : r.what}
      </button>}
      tag={ANN_STATUS[r.status]}
      tagColor={r.status === "ready" ? C.accentInk : C.muted}
      badges={<>
        {r.rank && (r.status === "draft" || r.status === "ready") && <Pill>{`post #${r.rank}`}</Pill>}
        <Pill>{KIND_NAMES[r.kind] || r.kind}</Pill>
        {r.seeded && <Pill>seeded</Pill>}
        {r.hold && <Pill tone="warn">hold</Pill>}
      </>}
      dim={r.status === "dropped"}
      meta={`Shipped ${r.shipped || String(r.createdAt).slice(0, 10)}${r.status === "posted" ? ` · posted ${r.postedAt}` : ""} · ${c.words} words${r.provider ? ` · drafted by ${r.provider}` : r.seeded ? " · written in code, figures from today's catalogue" : ""}${r.note ? ` · model note: ${r.note}` : ""}`}
      body={!open ? (
        <p style={{ margin: 0, color: C.muted }}>
          {r.hold ? <span style={{ color: C.warnInk }}>{r.hold}. </span> : null}
          {fails.length ? <span style={{ color: C.warnInk }}>{fails.length} check{fails.length > 1 ? "s" : ""} failing. </span> : null}
          {String(text).split("\n").find((l) => l.trim()) || ""}
        </p>
      ) : (
        <>
          {r.hold && <p style={{ margin: "0 0 8px", color: C.warnInk, fontWeight: 600 }}>{r.hold}. It lifts by itself when the count is there.</p>}
          {fails.length > 0 && <p style={{ margin: "0 0 8px", color: C.warnInk, fontWeight: 600 }}>{fails.join(". ")}.</p>}
          <p style={{ margin: "0 0 8px", color: C.muted }}>{r.what}</p>
          {r.thin && <p style={{ margin: "0 0 8px", color: C.warnInk }}>The model said the description was thin.</p>}
          <Grow value={text} onChange={(e) => setText(e.target.value)} rows={8} style={{ ...FIELD, color: C.text }} aria-label="Post text" />
        </>
      )}
      actions={!open ? null : <>
        {dirty && <Btn tone="go" busy={busy === tag("save")} onClick={() => post({ action: "update", id: r.id, text }, tag("save"))}>Save edit</Btn>}
        <Btn onClick={async () => {
          try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
        }}>{copied ? "Copied" : "Copy text"}</Btn>
        {r.status !== "ready" && r.status !== "posted" && (
          <Btn busy={busy === tag("ready")} onClick={() => post({ action: "update", id: r.id, status: "ready", ...(dirty ? { text } : {}) }, tag("ready"))}>Mark ready</Btn>
        )}
        {r.status === "ready" && (
          <Btn busy={busy === tag("draft")} onClick={() => post({ action: "update", id: r.id, status: "draft" }, tag("draft"))}>Back to draft</Btn>
        )}
        {r.status !== "posted" && (
          <span className="inline-flex items-center" style={{ gap: S.xs }}>
            <input type="date" value={postedAt} onChange={(e) => setPostedAt(e.target.value)} aria-label="Date posted"
              style={{ ...FIELD, width: 150, padding: "2px 8px", fontSize: F.xs }} />
            <Btn busy={busy === tag("posted")} onClick={() => post({ action: "update", id: r.id, status: "posted", postedAt, ...(dirty ? { text } : {}) }, tag("posted"))}>Mark posted</Btn>
          </span>
        )}
        {r.status === "posted" && (
          <Btn busy={busy === tag("unpost")} onClick={() => post({ action: "update", id: r.id, status: "ready" }, tag("unpost"))}>Not posted after all</Btn>
        )}
        {r.status !== "dropped"
          ? <ConfirmBtn busy={busy === tag("drop")} onConfirm={() => post({ action: "update", id: r.id, status: "dropped" }, tag("drop"))}>Drop</ConfirmBtn>
          : <Btn busy={busy === tag("restore")} onClick={() => post({ action: "update", id: r.id, status: "draft" }, tag("restore"))}>Back to draft</Btn>}
      </>}
    />
  );
}

const KIND_NAMES = { feature: "feature", section: "section", listings: "listings" };

/* Every finding ever, for when the question is "did we already see this". */
function ChangelogArchive({ rows = [] }) {
  const [limit, setLimit] = useState(20);
  if (!rows.length) return <Empty>No findings recorded yet.</Empty>;
  return (
    <>
      {rows.slice(0, limit).map((r) => (
        <Row key={r.id}
          title={r.entryName}
          tag={KIND_LABEL[r.kind] || r.kind}
          tagColor={LOUD.has(r.kind) ? C.warnInk : C.muted}
          body={r.what}
          meta={`${String(r.at || "").slice(0, 10)} · confidence ${r.confidence}`}
        />
      ))}
      {rows.length > limit && (
        <button onClick={() => setLimit((n) => n + 40)} style={{
          background: "none", border: 0, padding: "12px 0", cursor: "pointer",
          fontFamily: "inherit", fontSize: F.sm, color: C.muted, textDecoration: "underline",
        }}>Show more ({rows.length - limit} left)</button>
      )}
    </>
  );
}

/* ================================================================== */
/*  The primitives every list uses                                     */
/* ================================================================== */

function Section({ title, count, hint, children }) {
  return (
    <section className="pb-10">
      <div className="flex flex-wrap items-baseline" style={{ gap: S.sm }}>
        <h2 style={{ fontSize: F.xl, fontWeight: 700, margin: 0, letterSpacing: TRACK.tight }}>{title}</h2>
        {count !== "" && count !== undefined && (
          <span className="tnum" style={{ fontSize: F.sm, color: C.dim }}>{count}</span>
        )}
      </div>
      {hint && <p style={{ fontSize: F.sm, color: C.muted, margin: "4px 0 0", maxWidth: "72ch", lineHeight: 1.55 }}>{hint}</p>}
      <div className="mt-3" style={{
        background: C.panel, border: `1px solid ${C.line}`, borderRadius: R.card, padding: "4px 16px 8px",
      }}>{children}</div>
    </section>
  );
}

/*
 * A section that starts shut.
 *
 * The house rule, and the reason this page stopped being readable twice: **any
 * list that can exceed about ten rows is collapsed by default, with a count in
 * its header.** The count is the part you read; the rows are the part you open
 * when the count says something. A page of open panels answers "what happened"
 * and buries "what needs me", which is the wrong way round for a console
 * somebody opens on a Monday.
 *
 * `openWhen` lets a section insist on being open when it actually matters, so
 * a thing with nothing in it stays shut and a thing on fire does not.
 */
function Collapsible({ title, count, hint, openWhen = false, anchor = "", children }) {
  /* Inside a Reference group the panel is the quieter kind, and always starts
     shut: reference is what you go looking for, never what greets you. */
  const quiet = useContext(QuietCtx);
  const [open, setOpen] = useState(quiet ? false : openWhen);
  /* A link to /admin?tab=...#<anchor>, or a summary link on this page to
     #<anchor>, opens this panel and scrolls to it. */
  useEffect(() => {
    if (!anchor) return undefined;
    const check = () => {
      try {
        if (window.location.hash === `#${anchor}`) {
          setOpen(true);
          setTimeout(() => document.getElementById(anchor)?.scrollIntoView(), 0);
        }
      } catch {}
    };
    check();
    window.addEventListener("hashchange", check);
    return () => window.removeEventListener("hashchange", check);
  }, [anchor]);
  return (
    <section className={quiet ? "pb-3" : "pb-6"} id={anchor || undefined} data-panel={quiet ? "reference" : "work"}>
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className="flex flex-wrap items-baseline" style={{
          gap: S.sm, background: "none", border: 0, padding: 0, width: "100%",
          cursor: "pointer", fontFamily: "inherit", textAlign: "left",
        }}>
        <span aria-hidden="true" style={{
          fontSize: F.xs, color: C.dim, width: 10, display: "inline-block",
        }}>{open ? "\u25be" : "\u25b8"}</span>
        <h2 style={quiet
          ? { fontSize: F.md, fontWeight: 600, margin: 0, color: C.muted }
          : { fontSize: F.xl, fontWeight: 700, margin: 0, letterSpacing: TRACK.tight }}>{title}</h2>
        {count !== "" && count !== undefined && (
          <span className="tnum" style={{ fontSize: quiet ? F.xs : F.sm, color: !quiet && Number(count) > 0 ? C.muted : C.dim }}>{count}</span>
        )}
      </button>
      {open && (
        <>
          {hint && <p style={{ fontSize: F.sm, color: C.muted, margin: "4px 0 0", maxWidth: "72ch", lineHeight: 1.55 }}>{hint}</p>}
          <div className="mt-3" style={{
            background: C.panel, border: `1px solid ${C.line}`, borderRadius: R.card, padding: "4px 16px 8px",
          }}>{children}</div>
        </>
      )}
    </section>
  );
}

/*
 * A list of things that need a decision: the Inbox's queues, drafts, reviews,
 * ideas, announcements, structured data. It opens on its own while it holds
 * ten or fewer, so a short to-do is on screen the moment the tab is, and an
 * empty one says so in one line. Past ten it is shut with its count in the
 * header, like every other long list: the count is the answer to "what needs
 * me", and a page of forty open rows buries the other queues under one.
 */
const ROW_LIMIT = 10;
function WorkList({ rows = 0, ...props }) {
  return <Collapsible {...props} openWhen={rows <= ROW_LIMIT} />;
}

/*
 * The second layer of every tab: what you go looking for, never what needs
 * you. A hairline and a small muted heading, then panels in the quieter style,
 * all shut. Nothing in here counts towards a tab's number, which is the rule
 * that keeps a count meaning "work waiting" (invariant 25). System uses it
 * three times, titled Records, Logs and Tools.
 */
const QuietCtx = createContext(false);
function Reference({ title = "Reference", children }) {
  return (
    <div data-layer="reference" style={{ borderTop: `1px solid ${C.line}`, marginTop: S.lg, paddingTop: S.lg }}>
      <p style={{ fontSize: F.xs, fontWeight: 700, color: C.dim, margin: `0 0 ${S.md}px`, letterSpacing: "0.02em" }}>{title}</p>
      <QuietCtx.Provider value={true}>{children}</QuietCtx.Provider>
    </div>
  );
}

/* Every section states its empty case in one line. */
function Empty({ children }) {
  return <p style={{ fontSize: F.sm, color: C.dim, lineHeight: 1.55, margin: "16px 0" }}>{children}</p>;
}

/*
 * The one row.
 *
 * title    what the thing is called
 * badges   short neutral labels, the Pill from the public site
 * tag      one coloured word: the category, the report kind, the change kind
 * meta     the grey line: dates, addresses, ids
 * body     prose the row is about
 * actions  buttons
 * footer   anything that expands underneath, like a draft editor
 * dim      closed, dismissed or resolved rows, which stay rather than vanish
 */
/*
 * Two more modes, so no list needs markup of its own (invariant 25):
 *
 * expandable  the row is one line until opened: the title line and `summary`
 *             show shut, and body, meta, actions and footer only open. Drafts,
 *             a tool's findings, announcements and ideas read this way, so a
 *             long list is a list of names, not a wall. `open` and `onToggle`
 *             make it controlled (one tool open at a time); without them it
 *             keeps its own state from `defaultOpen`.
 * children    group mode: rows under this one, indented, after its actions.
 *             A tool's findings under the tool, a burst's reviews under the
 *             listing. With `expandable` they show only when it is open.
 * inset       a raised box, for an editor that sits inside another row (the
 *             research draft under a suggestion).
 * headActions actions on the title line itself, for a group whose common
 *             verdict is reachable without opening it.
 */
function Row({ title, tag, tagColor, badges, meta, body, actions, footer, dim, expandable = false, summary, open: openProp, onToggle, defaultOpen = false, children, inset = false, headActions }) {
  const [ownOpen, setOwnOpen] = useState(defaultOpen);
  const controlled = typeof openProp === "boolean";
  const open = !expandable || (controlled ? openProp : ownOpen);
  const toggle = () => (controlled ? onToggle?.() : setOwnOpen((v) => !v));
  const head = (
    <span className="flex flex-wrap items-baseline" style={{ gap: S.sm }}>
      {expandable && <span aria-hidden="true" style={{ fontSize: F.xs, color: C.dim, width: 10, display: "inline-block" }}>{open ? "▾" : "▸"}</span>}
      <span style={{ fontSize: inset ? F.sm : F.lg, fontWeight: 700 }}>{title}</span>
      {tag && <span style={{ fontSize: F.xs, color: tagColor || C.muted }}>{tag}</span>}
      {badges}
    </span>
  );
  const indent = expandable ? 18 : 0;
  return (
    <div style={inset
      ? { marginTop: S.md, background: C.raised, border: `1px solid ${C.line}`, borderRadius: R.card, padding: S.lg, opacity: dim ? 0.55 : 1 }
      : { borderTop: `1px solid ${C.line}`, padding: "12px 0", opacity: dim ? 0.55 : 1 }}>
      <div className="flex flex-wrap items-center" style={{ gap: S.sm }}>
        {expandable
          ? <button onClick={toggle} aria-expanded={open} style={{
              flex: 1, minWidth: 0, textAlign: "left", background: "none", border: 0, padding: 0,
              cursor: "pointer", fontFamily: "inherit", color: C.text,
            }}>{head}</button>
          : <span style={{ flex: 1, minWidth: 0 }}>{head}</span>}
        {headActions}
      </div>
      {expandable && summary && (
        <div style={{ fontSize: F.sm, color: C.muted, lineHeight: 1.5, margin: `4px 0 0 ${indent}px`, maxWidth: "76ch" }}>{summary}</div>
      )}
      {open && (
        <div style={{ marginLeft: indent }}>
          {body && (
            <div style={{ fontSize: F.sm, color: C.muted, lineHeight: 1.55, margin: "4px 0 0", maxWidth: "76ch" }}>
              {body}
            </div>
          )}
          {meta && <p style={{ fontSize: F.xs, color: C.dim, margin: "4px 0 0", lineHeight: 1.5 }}>{meta}</p>}
          {actions && <div className="flex flex-wrap items-center mt-2" style={{ gap: S.sm }}>{actions}</div>}
          {footer}
          {children && <div style={{ paddingLeft: S.lg, marginTop: S.sm }}>{children}</div>}
        </div>
      )}
    </div>
  );
}

/*
 * `disabled` is separate from `busy` on purpose. Busy means this is happening;
 * disabled means it cannot, and the two should not look the same, because a
 * button that looks like it is working when it will never work is worse than
 * one that is plainly off. A disabled button always has a sentence next to it
 * saying why.
 */
function Btn({ onClick, busy, tone, disabled, children, title }) {
  /* go is the action colour, a CSS variable, so its tint and edge come from
     their own tokens rather than from alpha digits appended to a hex. */
  const t = tone === "go" ? { soft: C.accentSoft, ink: C.accentInk, edge: C.accentEdge }
    : tone === "stop" ? { soft: "#FF6B8A1E", ink: ink("#FF6B8A"), edge: "#FF6B8A44" } : null;
  const off = busy || disabled;
  return (
    <button onClick={onClick} disabled={off} title={title} className="ctl" style={{
      background: busy ? C.subtle : disabled ? "transparent" : t ? t.soft : C.panel,
      color: off ? C.dim : t ? t.ink : C.muted,
      border: `1px solid ${disabled ? C.line : t ? t.edge : C.edge}`, borderRadius: R.control,
      padding: "4px 12px", fontSize: F.xs, fontWeight: 600,
      cursor: off ? "default" : "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
      opacity: disabled ? 0.55 : 1,
    }}>{busy ? "…" : children}</button>
  );
}

/*
 * Destructive actions ask once.
 *
 * Revoking a claim, deleting a suggestion, unpublishing an entry and dismissing
 * a change are all one click from something you cannot get back, and they sat
 * next to ordinary buttons looking identical. Arming rather than a modal: the
 * row stays readable, and it disarms itself after four seconds so a half-press
 * left on screen is not a trap for the next click.
 */
/*
 * Every two-press action on this page is this component, so a confirmation
 * looks and behaves the same wherever it is (invariant 25).
 *
 * tone     "stop" (the default, for anything destructive), "go" (Publish,
 *          sending, confirming as genuine) or "plain" (Hold, Mark as wrong).
 * reason   a placeholder: arming shows a one-line field, and the second press
 *          is refused until it holds text. onConfirm receives the text.
 * choices  [[label, value]]: arming shows one second-press button per answer
 *          instead of one (discovery's three reasons that need no research).
 * note     what the second press will do, shown while armed. The click is the
 *          approval, so everything needed to judge it is beside the button.
 * startArmed, onCancel
 *          for a control reached from another one's choice (Dismiss, then
 *          "The monitor got it wrong"): it opens on its field, and Cancel
 *          hands back to the control it came from.
 *
 * It disarms itself after four seconds, unless it has a field, choices or a
 * note to read, which take longer than four seconds and must not vanish
 * under someone reading them.
 */
/* The armed second press: a solid fill, and type that reads on it. */
const TONE_FILL = { stop: "#FF6B8A", go: C.accent };
const TONE_ON = { stop: "#06110D", go: C.onAccent };
function ConfirmBtn({ onConfirm, busy, children, confirm = "Sure?", tone = "stop", reason = "", choices = null, note = null, disabled = false, title, stay, startArmed = false, onCancel }) {
  const [armed, setArmed] = useState(startArmed);
  const [text, setText] = useState("");
  const holds = stay ?? Boolean(reason || choices || note);
  useEffect(() => {
    if (!armed || holds) return undefined;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed, holds]);

  const first = tone === "plain" ? undefined : tone;
  if (busy) return <Btn busy tone={first}>{children}</Btn>;
  if (!armed) return <Btn onClick={() => setArmed(true)} tone={first} disabled={disabled} title={title}>{children}</Btn>;

  const fill = TONE_FILL[tone];
  const second = (label, value, off = false) => (
    <button key={label} disabled={off} onClick={() => { setArmed(false); const v = value ?? text.trim(); setText(""); onConfirm(v); }} style={{
      background: off ? C.subtle : fill || C.text, color: off ? C.dim : fill ? TONE_ON[tone] : C.bg,
      border: 0, borderRadius: R.control, padding: "4px 12px", fontSize: F.xs, fontWeight: 700,
      cursor: off ? "default" : "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
    }}>{label}</button>
  );
  return (
    <span className="inline-flex flex-wrap items-center" style={{ gap: S.xs, flexBasis: reason || note ? "100%" : undefined }}>
      {reason && (
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={reason} maxLength={200} autoFocus
          onKeyDown={(e) => { if (e.key === "Escape") setArmed(false); }}
          aria-label={reason}
          style={{ ...FIELD, flex: "1 1 280px", width: "auto", fontSize: F.sm, padding: "4px 8px" }} />
      )}
      {choices
        ? choices.map(([label, value]) => second(label, value))
        : second(confirm, undefined, Boolean(reason) && !text.trim())}
      <button onClick={() => { setArmed(false); setText(""); onCancel?.(); }} style={{
        background: "transparent", border: `1px solid ${C.edge}`, color: C.dim,
        borderRadius: R.control, padding: "4px 10px", fontSize: F.xs, fontWeight: 600,
        cursor: "pointer", fontFamily: "inherit",
      }}>{reason || choices || note ? "Cancel" : "No"}</button>
      {note && <span style={{ fontSize: F.xs, color: C.muted, flexBasis: "100%", lineHeight: 1.5 }}>{note}</span>}
    </span>
  );
}

/* ================================================================== */
/*  Rows shared by more than one tab                                   */
/* ================================================================== */

function ClaimRow({ toolId, c, act, busy, verified }) {
  const tool = ALL_TOOLS.find((t) => t.id === toolId);
  const method = c.method === "email-domain" ? "email domain"
    : c.method === "domain" ? "published token" : "not proved yet";
  return (
    <Row
      title={tool ? tool.name : toolId}
      tag={tool ? catOf(tool.cat).label : ""}
      tagColor={tool ? ink(catOf(tool.cat).color) : C.muted}
      meta={<>
        <a href={`mailto:${c.email}`} style={{ color: C.muted }}>{c.email}</a>
        {" · "}{method}
        {" · "}{(verified ? c.verifiedAt : c.startedAt) || "no date"}
      </>}
      actions={verified ? <>
        <ConfirmBtn onConfirm={() => act("revoke-claim", toolId, { revertContent: false }, "access")}
          busy={busy === "revoke-claimaccess" + toolId} confirm="Revoke">Revoke access</ConfirmBtn>
        <ConfirmBtn onConfirm={() => act("revoke-claim", toolId, { revertContent: true }, "revert")}
          busy={busy === "revoke-claimrevert" + toolId} confirm="Revoke and revert">Revoke and revert content</ConfirmBtn>
      </> : null}
    />
  );
}

function OpenReports({ rows = [], act, busy }) {
  const open = rows.filter((r) => r.status === "open");
  const closed = rows.filter((r) => r.status !== "open");
  return (
    <WorkList rows={open.length} title="Reports and corrections" count={open.length} anchor="q-reports"
      hint="Sent by visitors without signing in. Nothing is applied automatically: make the change yourself, then resolve. A submitted social profile only goes in once it is published on the company's own site.">
      {rows.length === 0 ? <Empty>Nothing reported.</Empty> : [...open, ...closed].map((r) => {
        const tool = ALL_TOOLS.find((t) => t.id === r.toolId);
        const kind = reportKindOf(r.kind);
        const isOpen = r.status === "open";
        return (
          <Row key={r.id}
            title={tool ? tool.name : r.toolName || r.toolId}
            tag={kind ? kind.label : r.kind}
            tagColor={ink("#FFB020")}
            badges={!isOpen && <Pill>{r.status}{r.closedAt ? ` ${r.closedAt}` : ""}</Pill>}
            body={r.value || null}
            meta={<>
              {r.date}
              {" · "}
              {r.email ? <a href={`mailto:${r.email}`} style={{ color: C.muted }}>{r.email}</a> : "no email given"}
            </>}
            dim={!isOpen}
            actions={isOpen ? <>
              <Btn onClick={() => act("resolve-report", r.id, {}, "res")}
                busy={busy === "resolve-reportres" + r.id} tone="go">Resolve</Btn>
              <ConfirmBtn onConfirm={() => act("dismiss-report", r.id, {}, "dis")}
                busy={busy === "dismiss-reportdis" + r.id}>Dismiss</ConfirmBtn>
            </> : null}
          />
        );
      })}
    </WorkList>
  );
}

/*
 * Who asked for something that is already listed, and why.
 *
 * Counted in lib/interest.js rather than in the file. The reasons are the point
 * as much as the number: somebody explaining why a listed tool matters to them
 * is editorial input, and it keeps arriving long after the entry is written.
 */
function Interest({ interest = {}, entries = {} }) {
  const rows = Object.entries(interest || {})
    .map(([id, v]) => ({ id, count: Number(v?.count) || 0, people: Array.isArray(v?.people) ? v.people : [] }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count);

  const nameOf = (id) =>
    ALL_TOOLS.find((t) => t.id === id)?.name || entries?.[id]?.name || id;

  return (
    <Collapsible title="Interest in listed tools" count={rows.length}
      hint="People who suggested something already in the catalogue. Nothing was filed, they were sent the link, and the asking was counted. Shown on the card from two upwards.">
      {rows.length === 0
        ? <Empty>Nobody has suggested a tool that is already listed.</Empty>
        : rows.map((r) => (
          <Row key={r.id}
            title={nameOf(r.id)}
            badges={<Pill>suggested by {r.count}</Pill>}
            meta={r.count >= 2 ? "Showing on the card." : "Not shown on the card: one person is not a signal."}
            body={r.people.length ? (
              <div className="flex flex-col" style={{ gap: 6 }}>
                {r.people.slice().reverse().map((p, i) => (
                  <p key={i} style={{ margin: 0, lineHeight: 1.55 }}>
                    <b style={{ color: C.text }}>{p.by || "Anonymous"}</b>
                    <span style={{ color: C.dim }}> · {p.date}{p.email ? ` · ${p.email}` : ""}</span>
                    {p.why ? <><br />{p.why}</> : null}
                  </p>
                ))}
              </div>
            ) : null}
          />
        ))}
    </Collapsible>
  );
}

/* ------------------------------------------------------------------ */
/*  Copy as entry stub                                                 */
/*                                                                     */
/*  The mechanical half of turning a suggestion into a listing: the id, */
/*  the domain, the URL and the date are all derivable, and retyping    */
/*  them is where a typo'd id comes from. The editorial half is left    */
/*  empty on purpose — a stub that guessed at `one`, `note` or `watch`  */
/*  would be a stub somebody ships without reading the vendor's site.   */
/* ------------------------------------------------------------------ */

/* Mirrors the id convention in the catalogue: lowercase, letters and digits. */
const idFrom = (name, url) => {
  const fromName = String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (fromName) return fromName.slice(0, 32);
  return String(url || "").replace(/^https?:\/\//, "").replace(/^www\./, "")
    .split(/[/?#]/)[0].split(".")[0].replace(/[^a-z0-9]+/g, "").slice(0, 32) || "unnamed";
};

const domainFrom = (url) => String(url || "")
  .replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0].toLowerCase();

const FILES = { tool: "lib/tools.js", newsletter: "lib/newsletters.js", group: "lib/communities.js", podcast: "lib/podcasts.js", youtube: "lib/youtube.js", award: "lib/awards.js" };

function entryStub(s) {
  const today = new Date().toISOString().slice(0, 10);
  const kind = s.kind || "tool";
  const id = idFrom(s.name, s.url);
  const domain = domainFrom(s.url);
  const asked = timesAsked(s);
  const head = [
    `/* Suggested by ${s.by || "Anonymous"} on ${s.date}${asked > 1 ? `, and by ${asked - 1} other${asked > 2 ? "s" : ""} since` : ""}.`,
    s.why ? `   They said: ${s.why}` : "",
    `   Read ${domain || "the site"} before filling in one, note and watch. Anything you cannot`,
    `   confirm there stays verified: false. Delete draft: true when it is ready. */`,
  ].filter(Boolean).join("\n");

  if (kind === "tool") {
    return `${head}
  {
    id: "${id}", name: "${s.name}", cat: "${s.cat || "aso"}", domain: "${domain}",
    url: "${s.url || ""}", price: "", free: false, verified: false,
    updated: "${today}",
    tags: [],
    one: "",
    note: "",
    watch: "",
    social: {},
    draft: true,
  },`;
  }

  if (kind === "newsletter") {
    return `${head}
  {
    id: "${id}",
    name: "${s.name}",
    url: "${s.url || ""}",
    publisher: "",
    cadence: "",
    platform: "",
    free: true,
    topics: [],
    one: "",
    note: "",
    watch: "",
    social: {},
    updated: "${today}",
    draft: true,
  },`;
  }

  if (kind === "group") {
    return `${head}
  {
    id: "${id}",
    name: "${s.name}",
    url: "${s.url || ""}",
    platform: "",
    price: "",
    free: false,
    entry: "",
    audience: "",
    topics: [],
    one: "",
    note: "",
    watch: "",
    social: {},
    updated: "${today}",
    draft: true,
  },`;
  }

  /*
   * A kind with no catalogue file yet. The shared editorial contract is the
   * same for every kind, so the stub is still worth having — it is the shape
   * the new file starts from.
   */
  return `${head}
  /* No catalogue file for "${kind}" yet. Write lib/<kind>s.js with its own shape,
     export the published list under the plain name, and register it in
     lib/sections.js and in SOURCES in components/Admin.jsx. */
  {
    id: "${id}",
    name: "${s.name}",
    url: "${s.url || ""}",
    one: "",
    note: "",
    watch: "",
    social: {},
    updated: "${today}",
    draft: true,
  },`;
}

function CopyStub({ s }) {
  const [state, setState] = useState("");
  const file = FILES[s.kind || "tool"] || "a new catalogue file";

  async function copy() {
    const text = entryStub(s);
    try {
      await navigator.clipboard.writeText(text);
      setState("Copied");
    } catch {
      /* No clipboard permission, or an insecure origin. The text is the point,
         so hand it over in a way they can still select. */
      window.prompt(`Copy this into ${file}`, text);
      setState("");
      return;
    }
    setTimeout(() => setState(""), 2000);
  }

  return (
    <button onClick={copy} title={`Paste into ${file}`} style={{
      background: "transparent", color: C.muted, border: `1px solid ${C.edge}`,
      borderRadius: R.control, padding: "4px 12px", fontSize: F.xs, fontWeight: 600,
      cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
    }}>{state || "Copy as entry stub"}</button>
  );
}


/* ------------------------------------------------------------------ */
/*  Needs verifying                                                    */
/* ================================================================== */

/*
 * Which published entries have not been read on the vendor's own site.
 *
 * `verified` used to render as an "unverified" badge on every public view. It
 * reports our research process, which is not a fact about the product and not
 * something a reader can act on: next to a competitor with no badge it reads as
 * a mark against the tool rather than as a note about how much work we have
 * done. So it comes off the public site entirely and stays in the data, and
 * this is the one place it shows.
 *
 * Published only. A draft is unverified nearly by definition and is already
 * listed one panel up, so including them here would bury the entries that are
 * live and thin under the ones nobody can see yet.
 */
function NeedsVerifying() {
  const rows = SOURCES.flatMap(({ kind, entries }) =>
    published(entries).filter((e) => e.verified !== true).map((entry) => ({ kind, entry })));

  return (
    <Collapsible
      title="Needs verifying"
      count={rows.length}
      hint="Live entries written from search results or a third party rather than the vendor's own site. Read the site, fix what it contradicts, then set verified: true in the source file."
    >
      {rows.length === 0
        ? <Empty>Every published entry was read on the vendor's own site.</Empty>
        : rows.map(({ kind, entry }) => (
          <Row key={`${kind}:${entry.id}`}
            title={entry.name}
            badges={<>
              <span style={{ fontSize: F.xs, color: C.dim }}>{entry.id}</span>
              <Pill>{kindOf(kind).label}</Pill>
              {entry.dying && <Pill tone="warn">winding down</Pill>}
            </>}
            meta={<>
              <a href={outbound(entry.url)} target="_blank" rel="noopener noreferrer" style={{ color: C.muted }}>
                {String(entry.url || "").replace(/^https?:\/\//, "")}
              </a>
              {entry.updated ? ` · last checked ${entry.updated}` : ""}
            </>}
            body={entry.one ? <p style={{ margin: 0, lineHeight: 1.55 }}>{entry.one}</p> : null}
          />
        ))}
    </Collapsible>
  );
}

/*
 * Editor use: using, used, tested or unset, per published tool
 * (lib/editorUse.js). Unset is the default and most rows stay that way. The
 * count in the header is how many are set, so the panel answers "what have I
 * recorded" without opening. Collapsed: it is every tool in the directory.
 */
function EditorUse({ editorUse = {}, entries = {} }) {
  const [vals, setVals] = useState(editorUse);
  const tools = [
    ...published(ALL_TOOLS),
    ...Object.values(entries || {}).filter((e) => e && e.id && e.name && !ALL_TOOLS.some((t) => t.id === e.id)),
  ].sort((a, b) => a.name.localeCompare(b.name));
  const set = tools.filter((t) => vals[t.id]?.value && t.noRecommend !== true).length;

  return (
    <Collapsible
      title="Editor use"
      count={`${set} set of ${tools.length}`}
      hint="Whether you use a tool, used it, or tested it and did not adopt it. Unset shows nothing publicly. It is a fact, not a rating: it feeds no average and no recommendation. Saved to Redis, so no commit, and every change is kept in the record."
    >
      {tools.map((t) => (
        <div key={t.id} id={`editor-use-${t.id}`}>
          <Row
            title={<a href={`/tools/${t.id}`} style={{ color: C.text }}>{t.name}</a>}
            badges={vals[t.id]?.value && t.noRecommend !== true
              ? <span style={{ fontSize: F.xs, color: C.muted }}>{editorUseLine(vals[t.id])}{vals[t.id].note ? ` ${vals[t.id].note}` : ""}</span>
              : null}
            body={<EditorUseControl tool={t} initial={vals[t.id] || null} compact
              onSaved={(id, eu) => setVals((v) => ({ ...v, [id]: eu }))} />}
          />
        </div>
      ))}
    </Collapsible>
  );
}

/*
 * The /about page (lib/aboutText.js): photo, name, role line, text and links.
 * Ali's own words, so nothing here checks voice or style. The one rule is his:
 * no email address and no phone number, checked as you type and again on the
 * server. Saving needs no commit and is live on the next load; Reset goes back
 * to the text in the file. Each save keeps the version it replaced.
 *
 * Formatting is **bold**, *italic* and [label](url), written by the buttons
 * around the selection, with a preview below. The page renders it as elements,
 * never as HTML.
 */
function AboutInline({ text, tokens }) {
  return (tokens || inlineTokens(text)).map((t, i) => {
    const kids = t.children ? <AboutInline tokens={t.children} /> : t.v;
    return t.t === "b" ? <strong key={i}>{kids}</strong>
      : t.t === "i" ? <em key={i}>{kids}</em>
        : t.t === "a" ? <a key={i} href={t.href} target="_blank" rel="noopener noreferrer" style={{ color: C.text }}>{kids}</a>
          : <React.Fragment key={i}>{t.v}</React.Fragment>;
  });
}

/* Resize to at most 640px on the long side and re-encode as JPEG. Re-encoding
   through a canvas also drops EXIF, so a phone photo's location never ships. */
function resizePhoto(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 640 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("That file is not an image this browser can read.")); };
    img.src = url;
  });
}

function AboutPage({ initial = null, photo = "" }) {
  const current = initial?.paragraphs?.length ? initial : ABOUT_DEFAULT;
  const [name, setName] = useState(current.name);
  const [role, setRole] = useState(current.role || "");
  const [body, setBody] = useState(bodyOf(current.paragraphs));
  const [links, setLinks] = useState(current.links || []);
  const [rec, setRec] = useState(initial);
  const [photoUrl, setPhotoUrl] = useState(photo);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const area = React.useRef(null);
  const issues = aboutIssues({ name, role, body, links });
  const saved = rec?.paragraphs?.length ? rec : ABOUT_DEFAULT;
  const dirty = name !== saved.name || role !== (saved.role || "") || body !== bodyOf(saved.paragraphs) ||
    JSON.stringify(links) !== JSON.stringify(saved.links || []);

  async function call(payload, tag) {
    setBusy(tag); setMsg("");
    try {
      const res = await fetch("/api/admin", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      if (!res.ok) { setMsg(await res.text()); return null; }
      return await res.json();
    } catch { setMsg("Could not reach the server."); return null; } finally { setBusy(""); }
  }

  async function save() {
    const d = await call({ action: "save-about", name, role, body, links }, "save");
    if (d) { setRec(d.about); setMsg("Saved. It is live on /about now."); }
  }
  async function reset() {
    const d = await call({ action: "reset-about" }, "reset");
    if (d) {
      setRec(d.about); setName(ABOUT_DEFAULT.name); setRole(ABOUT_DEFAULT.role);
      setBody(bodyOf(ABOUT_DEFAULT.paragraphs)); setLinks([]); setMsg("Back to the text in the file.");
    }
  }
  async function upload(file) {
    if (!file) return;
    let dataUrl;
    try { dataUrl = await resizePhoto(file); } catch (e) { setMsg(e.message); return; }
    const d = await call({ action: "save-about-photo", dataUrl }, "photo");
    if (d) { setPhotoUrl(d.photo); setMsg("Photo saved. It is live on /about now."); }
  }
  async function clearPhoto() {
    const d = await call({ action: "clear-about-photo" }, "photo-clear");
    if (d) { setPhotoUrl(d.photo); setMsg("Back to the photo in the repository."); }
  }

  /* Wrap the selection in the markers, or insert a placeholder to type over. */
  function wrap(before, after, placeholder) {
    const el = area.current;
    if (!el) return;
    const a = el.selectionStart, b = el.selectionEnd;
    const sel = body.slice(a, b) || placeholder;
    const next = body.slice(0, a) + before + sel + after + body.slice(b);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(a + before.length, a + before.length + sel.length);
    });
  }
  function link() {
    const url = window.prompt("Link to (https://... or a path like /contact)", "https://");
    if (!url || url === "https://") return;
    if (!isAllowedHref(url.trim())) { setMsg("A link needs an https:// address or a path on this site. Email and phone links are not allowed."); return; }
    wrap("[", `](${url.trim()})`, "link text");
  }

  const tool = { ...FIELD, width: "auto", padding: "2px 10px", cursor: "pointer" };

  return (
    <Collapsible title="About page" anchor="about-page"
      count={rec?.paragraphs?.length ? `edited ${String(rec.at).slice(0, 10)}` : "the file's text"}
      hint="Everything on /about. No email address or phone number anywhere: the contact form below the text handles email. Saving needs no commit. Reset goes back to the text in the file, and every save keeps the version it replaced.">
      <div style={{ padding: "12px 0" }}>
        <Field label="Photo">
          <div className="flex flex-wrap items-center" style={{ gap: S.md }}>
            {photoUrl
              ? <img src={photoUrl} alt="" width={72} height={72} style={{ width: 72, height: 72, objectFit: "cover", borderRadius: R.control, border: `1px solid ${C.line}` }} />
              : <span style={{ fontSize: F.xs, color: C.dim }}>No photo.</span>}
            <label className="ctl" style={{ ...tool, display: "inline-block", fontSize: F.xs }}>
              {busy === "photo" ? "Uploading" : "Change photo"}
              <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "none" }}
                onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
            {String(photoUrl).startsWith("/about/photo") && (
              <ConfirmBtn busy={busy === "photo-clear"} onConfirm={clearPhoto} confirm="Use the repository photo?">Remove upload</ConfirmBtn>
            )}
            <span style={{ fontSize: F.xs, color: C.dim }}>Resized to 640px. Location data is removed.</span>
          </div>
        </Field>
        <Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)} style={FIELD} /></Field>
        <Field label="Role line, the disclosure"><input value={role} onChange={(e) => setRole(e.target.value)} style={FIELD} /></Field>
        <Field label="Text">
          <div className="flex flex-wrap" style={{ gap: S.xs, marginBottom: S.xs }}>
            <button type="button" className="ctl" onClick={() => wrap("**", "**", "bold text")} style={{ ...tool, fontWeight: 800 }} title="Bold">B</button>
            <button type="button" className="ctl" onClick={() => wrap("*", "*", "italic text")} style={{ ...tool, fontStyle: "italic" }} title="Italic">I</button>
            <button type="button" className="ctl" onClick={link} style={tool} title="Link the selected text">Link</button>
            <span style={{ fontSize: F.xs, color: C.dim, alignSelf: "center" }}>Select words, then press a button. For bold and linked, press both. A blank line starts a new paragraph.</span>
          </div>
          <textarea ref={area} value={body} onChange={(e) => setBody(e.target.value)} rows={16}
            style={{ ...FIELD, resize: "vertical", lineHeight: 1.55 }} />
        </Field>
        <Field label="Preview">
          <div style={{ border: `1px solid ${C.line}`, borderRadius: R.control, padding: S.md, color: C.text, fontSize: F.md, lineHeight: 1.6 }}>
            {paragraphsOf(body).map((p, i) => <p key={i} style={{ margin: i ? `${S.sm}px 0 0` : 0 }}><AboutInline text={p} /></p>)}
          </div>
        </Field>
        <Field label="Links, shown after LinkedIn">
          {links.map((l, i) => (
            <div key={i} className="flex flex-wrap" style={{ gap: S.xs, marginBottom: S.xs }}>
              <input value={l.label} placeholder="Label" aria-label="Link label" style={{ ...FIELD, width: 180 }}
                onChange={(e) => setLinks(links.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
              <input value={l.url} placeholder="https://..." aria-label="Link address" style={{ ...FIELD, flex: 1, minWidth: 220, width: "auto" }}
                onChange={(e) => setLinks(links.map((x, j) => j === i ? { ...x, url: e.target.value.trim() } : x))} />
              <Btn onClick={() => setLinks(links.filter((_, j) => j !== i))}>Remove</Btn>
            </div>
          ))}
          {links.length < LINKS_MAX && <Btn onClick={() => setLinks([...links, { label: "", url: "https://" }])}>Add a link</Btn>}
        </Field>
        {issues.length > 0 && (
          <p style={{ fontSize: F.sm, color: C.warnInk, margin: `${S.sm}px 0 0`, lineHeight: 1.5 }}>{issues.join(" ")}</p>
        )}
        <div className="flex flex-wrap items-center mt-3" style={{ gap: S.sm }}>
          <Btn tone="go" busy={busy === "save"} disabled={!dirty || issues.length > 0} onClick={save}>Save</Btn>
          <a href="/about" target="_blank" rel="noopener noreferrer" style={{ fontSize: F.xs, color: C.muted }}>Open /about</a>
          {rec?.paragraphs?.length > 0 && (
            <ConfirmBtn busy={busy === "reset"} onConfirm={reset} confirm="Reset to the file's text?">Reset to the file</ConfirmBtn>
          )}
          {msg && <span style={{ fontSize: F.xs, color: C.muted }}>{msg}</span>}
          {rec?.history?.length > 0 && <span style={{ fontSize: F.xs, color: C.dim }}>{rec.history.length} earlier version{rec.history.length > 1 ? "s" : ""} kept</span>}
        </div>
      </div>
    </Collapsible>
  );
}

/* ================================================================== */
/*  Drafts                                                             */
/*                                                                     */
/*  Written, not published. Every catalogue contributes its own drafts  */
/*  here, so a new entry kind shows up in this panel by being added to  */
/*  SOURCES rather than by anyone remembering to render it.             */
/*                                                                     */
/*  Publish commits the removal of `draft: true` (and today's updated)  */
/*  to the entry's source file on GitHub, and Vercel deploys it. The    */
/*  file stays the only place published-ness lives (lib/publish.js).    */
/*  The button shows the readiness checklist and the note and watch in  */
/*  full, and asks twice, because whether they are right is still a     */
/*  person's call.                                                      */
/* ------------------------------------------------------------------ */

const SOURCES = [
  { kind: "tool", entries: ALL_TOOLS },
  { kind: "newsletter", entries: ALL_NEWSLETTERS },
  { kind: "group", entries: ALL_COMMUNITIES },
  { kind: "podcast", entries: ALL_PODCASTS },
  { kind: "youtube", entries: ALL_YOUTUBE },
  { kind: "award", entries: ALL_AWARDS },
  { kind: "event", entries: ALL_EVENTS },
];

/*
 * Long-form fields get their own block below, and anything with a rendering of
 * its own is skipped here rather than printed twice.
 */
const PROSE = ["one", "note", "watch"];
const SKIP = ["id", "name", "draft", "shopifySpecific", ...PROSE];

function factValue(v) {
  if (Array.isArray(v)) return v.length ? v.join(", ") : "";
  if (v && typeof v === "object") {
    const pairs = Object.entries(v).filter(([, x]) => x);
    return pairs.length ? pairs.map(([k, x]) => `${k}: ${x}`).join("  ") : "";
  }
  if (typeof v === "boolean") return v ? "yes" : "no";
  return v === 0 ? "0" : v ? String(v) : "";
}

/*
 * What one draft can become, from inside its expanded row: published,
 * discarded, or put on hold (or, when held, moved back). Every outcome asks
 * twice, the first press saying exactly what the second will do, which is the
 * confirmation Publish always had.
 *
 * Publish and Discard commit to the entry's source file on GitHub and need the
 * token; Hold is admin state and does not. All three are revertible: a
 * publish or a discard by reverting its commit, a hold by moving it back.
 *
 * The readiness checklist shows for every outcome. It gates Publish only:
 * discarding an entry that is not ready is the usual case.
 */
function DraftActions({ kind, entry, canCommit, build, hold, onHolds }) {
  const problems = readiness(entry, kind);
  const [state, setState] = useState({ status: "idle", msg: "", url: "", sha: "", what: "" });
  const sectionClosed = !kindOf(kind).live;
  const file = FILE_OF[kind] || "its source file";
  const reset = () => setState({ status: "idle", msg: "", url: "", sha: "", what: "" });

  async function send(action, extra, what) {
    setState({ status: "busy", msg: "", url: "", sha: "", what });
    try {
      const res = await fetch("/api/admin", {
        method: "POST", headers: { "Content-Type": "application/json" },
        /* The build and the name go with the id, so the server can refuse an
           action from a page older than the deploy it is answering from. */
        body: JSON.stringify({ action, kind, id: entry.id, name: entry.name, build, ...extra }),
      });
      if (!res.ok) { setState({ status: "error", msg: await res.text(), url: "", sha: "", what }); return; }
      const d = await res.json();
      if (d.holds) { onHolds(d.holds); reset(); return; }
      /* Done means a commit exists. A 200 without one is reported as what it
         is, never shown as success. */
      if (!d.sha) { setState({ status: "error", msg: "The server answered without a commit, so nothing is known to have been written. Check Committed from here, then reload.", url: "", sha: "", what }); return; }
      setState({ status: "done", msg: "", url: d.url, sha: d.sha, what });
    } catch {
      setState({ status: "error", msg: "Could not reach the server.", url: "", sha: "", what });
    }
  }

  if (state.status === "done") {
    return (
      <p style={{ fontSize: F.sm, color: C.accentInk, margin: `${S.sm}px 0 0`, lineHeight: 1.55 }}>
        {state.what === "discard" ? "Discarded" : "Committed"}{state.sha ? ` ${state.sha.slice(0, 7)}` : ""}.{" "}
        {state.url && <a href={state.url} target="_blank" rel="noopener noreferrer" style={{ color: C.accentInk }}>See the commit</a>}
        {" "}{state.what === "discard"
          ? "It leaves this list when Vercel finishes building, and the reason is kept in Discarded (System, Records)."
          : "It goes live when Vercel finishes building it, usually a minute or two, and stays in this list until then."}
      </p>
    );
  }

  const busy = state.status === "busy";

  return (
    <div style={{ marginTop: S.md }}>
      {problems.length > 0 && (
        <ul style={{ margin: `0 0 ${S.sm}px`, paddingLeft: S.lg, fontSize: F.xs, color: C.warnInk, lineHeight: 1.5 }}>
          {problems.map((p) => <li key={p}>{p}</li>)}
        </ul>
      )}

      <div className="flex flex-wrap items-center" style={{ gap: S.sm }}>
        <ConfirmBtn tone="go" confirm="Commit to main" busy={busy && state.what === "publish"}
          disabled={!canCommit || problems.length > 0}
          title={!canCommit ? "GITHUB_TOKEN is not set" : problems.length ? "Not ready yet" : "Publish this entry"}
          note={<>Removes <code>draft: true</code> from {entry.id} in {file} and sets <code>updated</code> to today. The note and watch above are what goes live.</>}
          onConfirm={() => send("publish-file-draft", {}, "publish")}>Publish</ConfirmBtn>
        {hold
          ? <ConfirmBtn tone="plain" confirm="Move back to drafts" busy={busy && state.what === "unhold"}
              note="Clears the hold note and returns it to the active drafts."
              onConfirm={() => send("unhold-draft", {}, "unhold")}>Move back to drafts</ConfirmBtn>
          : <ConfirmBtn tone="plain" confirm="Put on hold" reason="What it is waiting on" busy={busy && state.what === "hold"}
              note="Stays a draft and moves to On hold with this note. Nothing is committed and nothing a visitor sees changes."
              onConfirm={(note) => send("hold-draft", { note }, "hold")}>Hold</ConfirmBtn>}
        <ConfirmBtn confirm="Remove from file and commit" reason="Why it is not being listed, in one line"
          busy={busy && state.what === "discard"} disabled={!canCommit}
          title={!canCommit ? "GITHUB_TOKEN is not set" : "Remove this draft from the file"}
          note={<>Deletes the {entry.id} entry from {file}, with the reason in the commit message, and keeps the reason and the research in Discarded (System, Records). Revert the commit to bring it back as a draft.</>}
          onConfirm={(reason) => send("discard-file-draft", { reason }, "discard")}>Discard</ConfirmBtn>
        {!canCommit && (
          <span style={{ fontSize: F.xs, color: C.dim }}>
            Publish and Discard need a GITHUB_TOKEN in the Vercel environment to commit with. Until then they are hand edits to the file.
          </span>
        )}
        {canCommit && problems.length > 0 && (
          <span style={{ fontSize: F.xs, color: C.dim }}>Fix the items above in the file before publishing.</span>
        )}
      </div>

      {sectionClosed && (
        <p style={{ fontSize: F.xs, color: C.dim, margin: `${S.xs}px 0 0` }}>
          The {kindOf(kind).label.toLowerCase()} section is not open yet, so a published entry shows nowhere until its kind is set live.
        </p>
      )}
      {state.status === "error" && (
        <p style={{ fontSize: F.xs, color: C.badInk, margin: `${S.xs}px 0 0` }}>
          {state.msg}{/Reload/.test(state.msg) && <> <a href="" style={{ color: C.badInk }}>Reload now</a></>}
        </p>
      )}
    </div>
  );
}

const FILE_OF = { tool: "lib/tools.js", newsletter: "lib/newsletters.js", event: "lib/events.js", group: "lib/communities.js", podcast: "lib/podcasts.js", youtube: "lib/youtube.js", award: "lib/awards.js" };

/*
 * One draft, shut by default: name, type and the one-line summary. Eleven
 * drafts with every field open was a wall nobody read to the end of.
 *
 * The outcome buttons live only inside the expanded body, after the facts and
 * after the note and the watch in full, so nothing can be published, held or
 * discarded without the text a button cannot check having been on screen.
 */
function DraftRow({ kind, entry, canCommit, build, hold, onHolds, pending }) {
  const facts = Object.entries(entry).filter(([key, v]) => !SKIP.includes(key) && factValue(v) !== "");
  return (
    <Row expandable
      title={entry.name}
      badges={<>
        <Pill>{kindOf(kind).label}</Pill>
        {!entry.watch && <Pill tone="warn">no watch note</Pill>}
      </>}
      summary={<>
        {entry.one && <span style={{ display: "block" }}>{entry.one}</span>}
        {hold && (
          <span style={{ display: "block", fontSize: F.xs, color: C.dim, marginTop: 4 }}>
            On hold: {hold.note} · {hold.by} · {String(hold.at || "").slice(0, 10)}
          </span>
        )}
        {pending && (
          <span style={{ display: "block", fontSize: F.xs, color: C.accentInk, marginTop: 4 }}>
            {pending.outcome === "discarded" ? "Discarded" : "Published"} in {String(pending.sha).slice(0, 7)} at {String(pending.at).slice(11, 16)} UTC, waiting for Vercel to deploy it. Reload in a minute.
          </span>
        )}
      </>}
      body={<div style={{ marginTop: S.xs }}>
        <p style={{ fontSize: F.xs, color: C.dim, margin: 0 }}>
          {entry.id}
          {/* A positive tag; absent renders nothing. */}
          {entry.shopifySpecific ? " · Shopify-specific" : ""}
        </p>
        <dl className="drafts-facts" style={{ margin: `${S.md}px 0 0` }}>
          {facts.map(([key, v]) => (
            <React.Fragment key={key}>
              <dt style={{ fontSize: F.xs, color: C.dim, fontWeight: 600 }}>{key}</dt>
              <dd style={{ fontSize: F.xs, color: C.muted, margin: 0, wordBreak: "break-word" }}>{factValue(v)}</dd>
            </React.Fragment>
          ))}
        </dl>
        {entry.note && <p style={{ margin: `${S.md}px 0 0`, lineHeight: 1.6 }}>{entry.note}</p>}
        {entry.watch
          ? <p style={{ margin: "8px 0 0", lineHeight: 1.6 }}>
            <span style={{ color: C.warnInk, fontWeight: 700 }}>Watch for. </span>{entry.watch}
          </p>
          : <p style={{ color: C.badInk, margin: "8px 0 0" }}>No watch note. Not publishable without one.</p>}
      </div>}
      footer={pending
        ? <p style={{ fontSize: F.xs, color: C.muted, margin: `${S.md}px 0 0` }}>
          Already committed{pending.url ? <> (<a href={pending.url} target="_blank" rel="noopener noreferrer" style={{ color: C.muted }}>the commit</a>)</> : ""}. No action until the deploy that removes it from this list.
        </p>
        : <DraftActions kind={kind} entry={entry} canCommit={canCommit} build={build} hold={hold} onHolds={onHolds} />}
    />
  );
}

/*
 * The drafts, in three parts on two tabs, all from one list so they cannot
 * disagree: `work` is the Drafts list on Listings (what is waiting on Publish,
 * Hold or Discard, and the one number the Listings tab counts), `held` the On
 * hold reference panel under it, and `records` the Discarded and Committed
 * from here panels in System, Records. Holds are lifted to the page so a hold
 * moves a row from work to held without a reload.
 */
function Drafts({ publishing = { canPublish: false, log: [], build: "" }, holds = {}, onHolds, discards = [], part = "work" }) {
  const rows = SOURCES.flatMap(({ kind, entries }) => drafted(entries).map((entry) => ({ kind, entry })));
  const holdOf = ({ kind, entry }) => holds[`${kind}:${entry.id}`] || null;
  /* A draft this build still has, which the log says was committed away: the
     commit exists and the deploy has not landed. Without this a refresh in that
     minute looks exactly like a press that did nothing. */
  const pendingOf = ({ kind, entry }) => (publishing.log || []).find((r) =>
    r.kind === kind && r.id === entry.id && r.sha && (r.outcome === "discarded" || r.outcome === "published" || !r.outcome)) || null;
  const active = rows.filter((r) => !holdOf(r));
  const held = rows.filter((r) => holdOf(r));
  const row = (r) => (
    <DraftRow key={`${r.kind}:${r.entry.id}`} kind={r.kind} entry={r.entry}
      canCommit={publishing.canPublish} build={publishing.build} hold={holdOf(r)} onHolds={onHolds} pending={pendingOf(r)} />
  );

  if (part === "work") {
    return (
      <WorkList rows={active.length} title="Drafts" anchor="drafts"
        count={active.length}
        hint="Written but not published, and invisible everywhere a visitor looks. Open one, read the note and the watch in full, then decide. Publish removes draft: true in a commit to main and Vercel deploys it; Hold parks it with a note; Discard removes it from the file with a reason that is kept. Every one is two presses and a revert undoes it."
      >
        {active.length === 0
          ? <Empty>{held.length ? "Nothing active. Everything still in draft is on hold." : "Nothing in progress. An entry becomes a draft by carrying `draft: true`."}</Empty>
          : active.map(row)}
      </WorkList>
    );
  }

  if (part === "held") {
    return (
      <Collapsible title="On hold" count={held.length}
        hint="Still drafts, waiting on something named in the note. Move one back to drafts when it is unblocked.">
        {held.length === 0 ? <Empty>Nothing on hold.</Empty> : held.map(row)}
      </Collapsible>
    );
  }

  return (
    <>
      <Collapsible title="Discarded" count={discards.length}
        hint="Drafts removed from their file, with the reason. A suggestion or a discovery that names one is labelled previously discarded. Revert the commit to bring one back; it stops counting as discarded once it is in a file again.">
        {discards.length === 0 ? <Empty>Nothing discarded.</Empty> : discards.map((d) => (
          <Row key={d.key} title={d.name} tag={kindOf(d.kind).label} dim={!d.standing}
            badges={!d.standing ? <Pill>restored</Pill> : null}
            body={<p style={{ margin: 0, lineHeight: 1.55 }}>{d.reason}</p>}
            meta={`${String(d.at || "").slice(0, 10)} · ${d.by || ""}${d.domain ? ` · ${d.domain}` : ""}${d.sha ? ` · ${d.sha.slice(0, 7)}` : ""}`}
            actions={d.commitUrl ? <a href={d.commitUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: F.xs, color: C.muted }}>Commit</a> : null} />
        ))}
      </Collapsible>

      <Collapsible title="Committed from here" count={(publishing.log || []).length}
        hint="Every publish, discard, hold and caveat edit made from this console, newest first, and every one that failed, with the reason it gave. A recent failure also shows in the status strip.">
        {!(publishing.log || []).length ? <Empty>Nothing committed from here yet.</Empty> : publishing.log.map((r) => (
          <Row key={`${r.at}-${r.id}`} title={r.name || r.id}
            tag={`${r.kind}, ${r.outcome === "failed" ? `${String(r.action || "").replace(/-file-draft|-draft/, "")} failed` : r.outcome || "published"}`}
            tagColor={r.outcome === "failed" ? C.badInk : undefined}
            body={r.outcome === "failed" ? <p style={{ margin: 0, lineHeight: 1.5 }}>{r.error}</p> : null}
            meta={`${String(r.at).slice(0, 16).replace("T", " ")} · ${r.by}${r.sha ? ` · ${r.sha.slice(0, 7)}` : ""}${r.reason ? ` · ${r.reason}` : ""}`}
            actions={r.url ? <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: F.xs, color: C.muted }}>Commit</a> : null} />
        ))}
      </Collapsible>
    </>
  );
}



/*
 * Discards that still stand, for every row that might name one. A context
 * rather than a prop because SuggestionRow is rendered from two tabs and the
 * discovery list, and threading one list through all three is how one of them
 * ends up without it.
 */
const StandingDiscards = React.createContext([]);

/* The discard a suggestion or finding names, or null: lib/suggestions.js rule. */
function useDiscarded({ name, url, kind = "tool" }) {
  const standing = React.useContext(StandingDiscards);
  return findDiscarded({ name, url: url || "", domain: normaliseDomain(url || ""), kind }, standing);
}

/* "Previously discarded: <reason>", so a name researched once is not researched again by accident. */
function DiscardedNote({ d }) {
  if (!d) return null;
  return (
    <p style={{ fontSize: F.xs, color: C.text, margin: "0 0 6px", lineHeight: 1.5 }}>
      <b>Previously discarded:</b> {d.reason} <span style={{ color: C.dim }}>({String(d.at || "").slice(0, 10)}{d.name ? `, as ${d.name}` : ""})</span>
    </p>
  );
}

function SuggestionRow({ s, children, footer }) {
  const discarded = useDiscarded({ name: s.name, url: s.url, kind: s.kind || "tool" });
  const k = kindOf(s.kind);
  const asked = timesAsked(s);
  const also = Array.isArray(s.also) ? s.also : [];
  return (
    <Row
      title={s.name}
      tag={k.label}
      tagColor={ink(k.color)}
      badges={<>
        {(!s.kind || s.kind === "tool") && (
          <span style={{ fontSize: F.xs, color: ink(catOf(s.cat).color) }}>{catOf(s.cat).label}</span>
        )}
        {/* The reason duplicates are folded together rather than filed
            separately: one row, and a number on it you can sort by. */}
        {asked > 1 && <Pill>suggested by {asked} people</Pill>}
        {s.publishedId && <Pill>published as {s.publishedId}</Pill>}
        {discarded && <Pill tone="warn">previously discarded</Pill>}
      </>}
      body={<>
        <DiscardedNote d={discarded} />
        {s.why && <p style={{ margin: 0, lineHeight: 1.55 }}>{s.why}</p>}
        {also.length > 0 && (
          <div style={{ margin: "8px 0 0", paddingLeft: S.md, borderLeft: `2px solid ${C.line}` }}>
            {also.map((a, i) => (
              <p key={i} style={{ fontSize: F.xs, color: C.dim, margin: i ? "6px 0 0" : 0, lineHeight: 1.5 }}>
                <b style={{ color: C.muted }}>{a.by || "Anonymous"}</b> · {a.date}
                {a.email ? ` · ${a.email}` : ""}
                {a.why ? `: ${a.why}` : ""}
              </p>
            ))}
          </div>
        )}
      </>}
      meta={<>
        {s.by} · {s.date}
        {s.lastAsked && s.lastAsked !== s.date ? ` · last asked ${s.lastAsked}` : ""}
        {s.url && <> · <a href={outbound(s.url)} target="_blank" rel="noopener noreferrer" style={{ color: C.muted }}>{s.url.replace(/^https?:\/\//, "")}</a></>}
      </>}
      actions={children}
      footer={footer}
    />
  );
}


/*
 * The weekly email, and the reason there is anything to send.
 *
 * "Three changes this week" with links is a better reason to open an email
 * than "a new tool was listed", which happens rarely and which nobody
 * subscribed for. The feed is what moves weekly, so the draft is built from
 * it.
 *
 * Pre-filled, never sent automatically. The same rule the feed itself follows:
 * a machine assembles the list, a person writes the sentence around it and
 * presses send.
 *
 * Sending is a ConfirmBtn like every other two-press action here. The count on
 * it comes from the server render, so it is what the list held when the page
 * loaded; the send reads the list again, which is why the result reports its
 * own numbers rather than assuming this one.
 */
function Compose({ count, feed = [] }) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState("");
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");

  const ready = Boolean(subject.trim() && body.trim());

  /* The last seven days of the feed, which is what a weekly email is about. */
  const week = feed.filter((f) => {
    const t = Date.parse(f.at || "");
    return Number.isFinite(t) && Date.now() - t < 8 * 24 * 60 * 60 * 1000;
  });

  function draftFromFeed() {
    if (!week.length) return;
    const n = week.length;
    setSubject(`${n} change${n === 1 ? "" : "s"} across the directory this week`);
    setBody([
      `${n} thing${n === 1 ? "" : "s"} changed in the tools this directory tracks this week.`,
      "",
      ...week.map((f) => `${f.toolName}: ${f.headline}\n  https://watchfor.tools/tools/${f.toolId}`),
      "",
      "All of it, dated and in order: https://watchfor.tools/changes",
    ].join("\n"));
  }

  async function send(test) {
    setBusy(test ? "test" : "send"); setErr(""); setResult(null);
    try {
      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body, test }),
      });
      if (!res.ok) { setErr(await res.text()); return; }
      setResult(await res.json());
    } catch {
      setErr("Could not reach the server.");
    } finally {
      setBusy("");
    }
  }

  const field = {
    background: C.field, border: `1px solid ${C.line}`, borderRadius: R.control,
    padding: S.md, fontSize: F.md, color: C.text, fontFamily: "inherit", width: "100%",
  };
  return (
    <Collapsible title="Send to the list" anchor="send" count={`${count} on the list`}
      hint="Plain text. An unsubscribe link is appended to every copy automatically, and each recipient is sent their own message, so nobody sees another subscriber's address. Test it on yourself first.">
      <div className="flex flex-col" style={{ padding: "12px 0", gap: S.md }}>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" style={field} />
        <textarea value={body} onChange={(e) => setBody(e.target.value)}
          placeholder="Two new tools went into App Store data this week."
          style={{ ...field, minHeight: 170, resize: "vertical", lineHeight: 1.6 }} />

        <div className="flex flex-wrap items-center" style={{ gap: S.sm }}>
          <Btn onClick={draftFromFeed} disabled={!week.length}>
            {week.length ? `Draft from this week (${week.length})` : "Nothing on What's moving this week"}
          </Btn>
          <Btn onClick={() => send(true)} busy={busy === "test"} disabled={!ready || Boolean(busy)}>Send test to me</Btn>
          <ConfirmBtn tone="stop" busy={busy === "send"} disabled={!ready || Boolean(busy) || count === 0}
            confirm={`Yes, send to ${count}`}
            note={<>Sends <b>{subject}</b> to {count} {count === 1 ? "address" : "addresses"}. There is no recall once this goes out.</>}
            onConfirm={() => send(false)}>Send to the list</ConfirmBtn>
          {count === 0 && <span style={{ fontSize: F.xs, color: C.dim }}>Nobody on the list yet.</span>}
        </div>

        {err && <p style={{ fontSize: F.sm, color: C.badInk, margin: 0, lineHeight: 1.55 }}>{err}</p>}
        {result && (
          <p style={{ fontSize: F.sm, color: result.failed ? C.warnInk : C.accentInk, margin: 0, lineHeight: 1.55 }}>
            {result.test
              ? `Test sent to ${result.to}.`
              : `Sent ${result.sent} of ${result.total}.${result.failed ? ` ${result.failed} failed. The mail log in System has each one.` : ""}`}
          </p>
        )}
      </div>
    </Collapsible>
  );
}

const when = (iso) => {
  if (!iso) return "none";
  // Stored as a full ISO timestamp; the minute is enough to read at a glance.
  return String(iso).slice(0, 16).replace("T", " ");
};

/*
 * Who has ever signed in. Three fields, because that is all that is stored —
 * see lib/accounts.js. The claimed column is joined here from svt:claims rather
 * than duplicated onto the account record, so there is one source of truth for
 * who owns what.
 */
function Accounts({ accounts = {}, claims = {} }) {
  const [q, setQ] = useState("");
  const all = Object.values(accounts).sort((a, b) => String(b.lastSeen).localeCompare(String(a.lastSeen)));
  const rows = q.trim()
    ? all.filter((a) => a.email.toLowerCase().includes(q.trim().toLowerCase()))
    : all;
  const claimedBy = (email) => Object.entries(claims)
    .filter(([, c]) => c.email === email && c.status === "verified")
    .map(([toolId]) => (ALL_TOOLS.find((t) => t.id === toolId)?.name) || toolId);

  return (
    <Collapsible title="Accounts" count={all.length}
      hint="Created on first sign-in. Email, first seen and last seen, and nothing else: no IP, no user agent, no page history. The sign-in copy promises exactly this, so adding a field here means changing that copy in the same commit.">
      {all.length === 0 ? <Empty>Nobody has signed in yet.</Empty> : (
        <>
          {all.length > 8 && (
            <div style={{ padding: "12px 0 0" }}>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by address"
                style={{ ...FIELD, maxWidth: 320 }} />
            </div>
          )}
          {rows.length === 0 ? <Empty>No address matches “{q}”.</Empty> : rows.map((a) => {
            const owns = claimedBy(a.email);
            return (
              <Row key={a.email}
                title={<a href={`mailto:${a.email}`} style={{ color: C.text, textDecoration: "none" }}>{a.email}</a>}
                badges={owns.length ? <Pill>claims {owns.join(", ")}</Pill> : null}
                meta={`first seen ${when(a.firstSeen)} · last seen ${when(a.lastSeen)}`}
              />
            );
          })}
        </>
      )}
    </Collapsible>
  );
}

/*
 * Directory counters. Deliberately narrow: page traffic is Vercel Analytics'
 * job, and this holds only the two things it cannot see.
 */
function Stats({ stats = { fields: {}, queries: [] } }) {
  const fields = stats.fields || {};
  const queries = stats.queries || [];
  const opens = Object.entries(fields)
    .filter(([k]) => k.startsWith("tool:"))
    .map(([k, n]) => [k.slice(5), n])
    .sort((a, b) => b[1] - a[1]);
  const matcherUses = fields["matcher:uses"] || 0;
  const totalOpens = opens.reduce((n, [, v]) => n + v, 0);
  const top = Math.max(1, opens.length ? opens[0][1] : 1);

  return (
    <Collapsible title="Directory stats" count={totalOpens}
      hint="Tool opens, matcher use, section views and the recommender funnel. Referrers, devices and countries are in Vercel Analytics and not duplicated here. Counts only: no cookie, no identifier, nothing tied to a person.">
      <div className="flex flex-wrap" style={{ gap: S["2xl"], padding: "12px 0 4px" }}>
        <div>
          <p style={{ fontSize: F["2xl"], fontWeight: 800, margin: 0 }}>{totalOpens}</p>
          <p style={{ fontSize: F.xs, color: C.dim, margin: 0 }}>tool detail opens</p>
        </div>
        <div>
          <p style={{ fontSize: F["2xl"], fontWeight: 800, margin: 0 }}>{matcherUses}</p>
          <p style={{ fontSize: F.xs, color: C.dim, margin: 0 }}>matcher uses</p>
        </div>
      </div>

      {opens.length === 0 ? <Empty>Nothing counted yet.</Empty> : (
        <div className="flex flex-col" style={{ gap: S.sm, padding: "12px 0 8px" }}>
          {opens.slice(0, 15).map(([id, n]) => {
            const tool = ALL_TOOLS.find((t) => t.id === id);
            return (
              <div key={id} className="flex items-center" style={{ gap: S.md }}>
                <span style={{ fontSize: F.sm, width: 170, flexShrink: 0 }}>{tool ? tool.name : id}</span>
                <span style={{
                  height: 7, borderRadius: 4, flexShrink: 0,
                  width: `${Math.max(4, Math.round((n / top) * 100))}%`, maxWidth: 380,
                  background: tool ? catOf(tool.cat).color : C.muted,
                }} />
                <span style={{ fontSize: F.xs, color: C.dim }}>{n}</span>
              </div>
            );
          })}
        </div>
      )}

      <SectionViews fields={fields} />
      <RecommenderFunnel fields={fields} />

      <div style={{ borderTop: `1px solid ${C.line}`, marginTop: S.md, paddingTop: S.md }}>
        <p style={{ fontSize: F.sm, fontWeight: 600, margin: 0 }}>
          Last {Math.min(queries.length, 50)} matcher queries
        </p>
        {queries.length === 0
          ? <Empty>Nothing asked yet.</Empty>
          : (
            <div className="flex flex-col" style={{ gap: S.xs, marginTop: S.sm }}>
              {queries.slice(0, 50).map((q, i) => (
                <p key={`${i}-${q.slice(0, 12)}`} style={{ fontSize: F.sm, color: C.muted, margin: 0, lineHeight: 1.5 }}>
                  <span style={{ color: C.dim }}>{i + 1}.</span> {q}
                </p>
              ))}
            </div>
          )}
      </div>
    </Collapsible>
  );
}

const SECTION_LABEL = { directory: "Directory", newsletters: "Newsletters", events: "Events", updates: "What's moving", blog: "Blog", recommend: "Recommender", categories: "Categories index" };

/* One count per page load of each section. What's moving includes the
   in-place tab on the directory, which Vercel cannot see. */
function SectionViews({ fields = {} }) {
  const rows = STAT_SECTIONS.map((id) => [id, fields[`section:${id}`] || 0]).sort((a, b) => b[1] - a[1]);
  return (
    <div style={{ borderTop: `1px solid ${C.line}`, marginTop: S.md, paddingTop: S.md }}>
      <p style={{ fontSize: F.sm, fontWeight: 600, margin: 0 }}>Section views</p>
      {rows.every(([, n]) => !n) ? <Empty>No section views counted yet.</Empty> : (
        <table className="tnum" style={{ fontSize: F.sm, marginTop: S.sm, borderCollapse: "collapse" }}>
          <tbody>{rows.map(([id, n]) => (
            <tr key={id}><td style={{ padding: "2px 24px 2px 0", color: C.muted }}>{SECTION_LABEL[id] || id}</td><td style={{ textAlign: "right" }}>{n}</td></tr>
          ))}</tbody>
        </table>
      )}
    </div>
  );
}

/*
 * How far people get through the recommender. Each screen counts the page
 * loads that reached it; the loss column is the drop from the screen before,
 * which is where people stop. Completed is counted by the run route, not the
 * browser. A resumed draft enters at its saved screen, so a later screen can
 * read slightly higher than the one before it.
 */
function RecommenderFunnel({ fields = {} }) {
  const label = (id) => PRIMING.find((p) => p.id === id)?.ok ? `Intro: ${PRIMING.find((p) => p.id === id).ok}` : (questionOf(id)?.short || id);
  const steps = SCREENS.map((id) => ({ id, n: fields[`recommend:reached:${id}`] || 0 }));
  const done = fields["recommend:runs"] || 0;
  const first = steps[0]?.n || 0;
  if (!first && !done) {
    return (
      <div style={{ borderTop: `1px solid ${C.line}`, marginTop: S.md, paddingTop: S.md }}>
        <p style={{ fontSize: F.sm, fontWeight: 600, margin: 0 }}>Recommender funnel</p>
        <Empty>Nobody has started it yet.</Empty>
      </div>
    );
  }
  let worst = null;
  steps.forEach((st, i) => {
    const drop = i ? steps[i - 1].n - st.n : 0;
    if (drop > 0 && (!worst || drop > worst.drop)) worst = { id: st.id, drop };
  });
  const rows = [...steps, { id: "__done", n: done }];
  return (
    <div style={{ borderTop: `1px solid ${C.line}`, marginTop: S.md, paddingTop: S.md }}>
      <p style={{ fontSize: F.sm, fontWeight: 600, margin: 0 }}>Recommender funnel</p>
      <p style={{ fontSize: F.xs, color: C.dim, margin: "2px 0 0" }}>
        {first} started, {done} completed{first ? ` (${Math.round((done / first) * 100)}%)` : ""}.
        {worst ? ` Most lost before ${label(worst.id)}: ${worst.drop}.` : ""}
      </p>
      <table className="tnum" style={{ fontSize: F.sm, marginTop: S.sm, borderCollapse: "collapse" }}>
        <thead><tr style={{ color: C.dim, fontSize: F.xs }}>
          <th style={{ textAlign: "left", fontWeight: 600, padding: "2px 24px 2px 0" }}>Screen</th>
          <th style={{ textAlign: "right", fontWeight: 600, padding: "2px 16px 2px 0" }}>Reached</th>
          <th style={{ textAlign: "right", fontWeight: 600 }}>Lost here</th>
        </tr></thead>
        <tbody>{rows.map((r, i) => {
          const lost = i ? rows[i - 1].n - r.n : 0;
          return (
            <tr key={r.id} style={{ color: worst && worst.id === r.id ? C.warnInk : C.text }}>
              <td style={{ padding: "2px 24px 2px 0", color: r.id === "__done" ? C.text : undefined, fontWeight: r.id === "__done" ? 600 : 400 }}>{r.id === "__done" ? "Completed a run" : label(r.id)}</td>
              <td style={{ textAlign: "right", padding: "2px 16px 2px 0" }}>{r.n}</td>
              <td style={{ textAlign: "right", color: lost > 0 ? undefined : C.dim }}>{i ? (lost > 0 ? lost : "") : ""}</td>
            </tr>
          );
        })}</tbody>
      </table>
    </div>
  );
}

/*
 * A second copy of the matrix's keys, which is normally the thing this codebase
 * refuses to do. It is deliberate here: lib/mail.js exports EVENTS, but it also
 * holds the Resend transport and the API key, and importing it into a client
 * component would drag both into the browser bundle. The labels have to live
 * somewhere the client can read.
 *
 * The cost is that this list can fall behind MATRIX, which it has done at least
 * once. Adding a row to MATRIX means adding one here.
 */
const MAIL_EVENTS = [
  ["signin_new", "Sign-in (new)"],
  ["signin_return", "Sign-in (returning)"],
  ["signin_link", "Sign-in link"],
  ["subscribe", "Subscribe"],
  ["review", "Review / rating"],
  ["comment", "Blog comment"],
  ["claim_verified", "Claim verified"],
  ["suggestion", "Suggestion"],
  ["report", "Report"],
  ["listing_edited", "Listing edited"],
  ["monitor_digest", "Weekly change digest"],
];

/*
 * The audit trail. Every attempt lands here, so an empty panel after a real
 * event is itself the finding — it means nothing was even tried.
 */
function MailLog({ rows = [] }) {
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const failed24 = rows.filter((r) => !r.ok && Date.parse(r.at || "") >= dayAgo).length;
  const failedAll = rows.filter((r) => !r.ok).length;
  const [failsOnly, setFailsOnly] = useState(false);
  /* Twenty is enough to see a pattern. A hundred rows of "ok" is a wall. */
  const [limit, setLimit] = useState(20);
  const filtered = failsOnly ? rows.filter((r) => !r.ok) : rows;
  const shown = filtered.slice(0, limit);

  return (
    <>
      <div className="flex flex-wrap items-center" style={{ gap: S["2xl"], padding: "12px 0 8px" }}>
        <div>
          <p className="tnum" style={{ fontSize: F["2xl"], fontWeight: 800, margin: 0, color: failed24 ? C.badInk : C.text }}>{failed24}</p>
          <p style={{ fontSize: F.xs, color: C.dim, margin: 0 }}>failures in 24h</p>
        </div>
        <div>
          <p className="tnum" style={{ fontSize: F["2xl"], fontWeight: 800, margin: 0, color: failedAll ? ink("#FFB020") : C.text }}>{failedAll}</p>
          <p style={{ fontSize: F.xs, color: C.dim, margin: 0 }}>failures shown</p>
        </div>
        {failedAll > 0 && (
          <Btn onClick={() => setFailsOnly((v) => !v)}>{failsOnly ? "Show all" : "Failures only"}</Btn>
        )}
      </div>

      {shown.length === 0
        ? <Empty>{failsOnly ? "No failures in the last 100 sends." : "Nothing sent yet."}</Empty>
        : shown.map((r, i) => (
          <Row key={`${r.at}-${i}`}
            title={r.event}
            tag={r.cls}
            tagColor={ink(r.cls === "admin" ? "#4CC9F0" : "#B08CFF")}
            badges={r.ok ? null : <Pill tone="warn">failed</Pill>}
            body={r.ok ? null : <span style={{ color: C.badInk, wordBreak: "break-word" }}>{r.error || "unknown error"}</span>}
            meta={`${String(r.at || "").slice(0, 16).replace("T", " ")} · ${r.to}`}
            dim={r.ok && failsOnly === false && false}
          />
        ))}
      {filtered.length > limit && (
        <button onClick={() => setLimit((n) => n + 40)} style={{
          background: "none", border: 0, padding: "12px 0", cursor: "pointer",
          fontFamily: "inherit", fontSize: F.sm, color: C.muted, textDecoration: "underline",
        }}>Show more ({filtered.length - limit} left)</button>
      )}
    </>
  );
}

/*
 * Fires any event in the matrix with dummy data, addressed to the admin only —
 * testing "what a vendor gets when their claim verifies" must never reach a
 * vendor. Its own fetch rather than act(), because the answer is a diagnostic.
 */
function NotificationTest() {
  const [event, setEvent] = useState(MAIL_EVENTS[0][0]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  async function send() {
    setBusy(true); setResult(null);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test-notification", event }),
      });
      if (!res.ok) { setResult({ ok: false, sends: [], error: `${res.status} ${await res.text()}` }); return; }
      setResult((await res.json()).test);
    } catch {
      setResult({ ok: false, sends: [], error: "Could not reach the server." });
    } finally {
      setBusy(false);
    }
  }

  const field = {
    background: C.field, border: `1px solid ${C.line}`, borderRadius: R.control,
    padding: "8px 12px", fontSize: F.sm, color: C.text, fontFamily: "inherit",
  };

  return (
    <>
      <div className="flex flex-wrap items-center" style={{ gap: S.md, padding: "12px 0 4px" }}>
        <select value={event} onChange={(e) => { setEvent(e.target.value); setResult(null); }} style={{ ...field, width: 210 }}>
          {MAIL_EVENTS.map(([id, label]) => (
            <option key={id} value={id} style={{ background: C.panel }}>{label}</option>
          ))}
        </select>
        <Btn onClick={send} busy={busy} tone="go">Send test</Btn>
      </div>

      {result && (
        <div style={{ padding: "4px 0 12px" }}>
          {result.nothingToSend ? (
            <p style={{ fontSize: F.sm, color: C.muted, margin: 0 }}>
              Nothing sent. This event mails nobody by design.
            </p>
          ) : (
            (result.sends || []).map((sd, i) => (
              <p key={i} style={{ fontSize: F.sm, margin: "2px 0", color: sd.ok ? C.accentInk : C.badInk }}>
                {sd.cls} → {sd.to}: {sd.ok ? "ok" : `failed: ${sd.error}`}
              </p>
            ))
          )}
          {result.error && <p style={{ fontSize: F.sm, color: C.badInk, margin: "2px 0" }}>{result.error}</p>}
          {result.config && (
            <p style={{ fontSize: F.xs, color: C.dim, margin: "8px 0 0", lineHeight: 1.6 }}>
              RESEND_API_KEY {result.config.resendKey ? "set" : "missing"} · ADMIN_EMAILS{" "}
              {result.config.adminEmails || "none"} · from {result.config.from}
            </p>
          )}
        </div>
      )}
    </>
  );
}


/*
 * Everybody on a list, one row per address: the site-wide list and per-item
 * follows, newest first (lib/subscriberList.js, rendered on the server behind
 * the admin check and returned by no route).
 *
 * Addresses are blurred until Reveal is pressed, so a screenshot or a glance
 * over a shoulder does not carry the list away. Reveal lives in this
 * component's state only: a reload, a new tab or a new session starts blurred.
 *
 * "Confirmed" is stated per source because the two lists are not the same
 * consent. A follow is stored only after its confirm link is clicked. The
 * site-wide list adds on the first request, so an address there is confirmed
 * only when something else proved the inbox, a sign-in by magic link, and
 * otherwise says so.
 *
 * Remove takes the address off every list, for a bounce or somebody who asked
 * by reply. It is the one destructive control here, so it asks twice.
 */
function Subscribers({ list = [], rows = [] }) {
  const [copied, setCopied] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [people, setPeople] = useState(rows);
  const [siteList, setSiteList] = useState(list);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  async function copy() {
    const text = siteList.map((s) => s.email).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(`Copied ${siteList.length} to the clipboard. Send with the addresses hidden from each other (Bcc).`);
    } catch {
      setCopied("Could not reach the clipboard. This needs HTTPS or localhost.");
    }
    setTimeout(() => setCopied(""), 4000);
  }

  async function remove(email) {
    setBusy(email); setErr("");
    try {
      const res = await fetch("/api/admin", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove-subscriber", email }),
      });
      if (!res.ok) { setErr(await res.text()); return; }
      setPeople((p) => p.filter((r) => r.email !== email));
      setSiteList((l) => l.filter((s) => String(s.email).toLowerCase() !== email));
    } catch {
      setErr("Could not reach the server.");
    } finally {
      setBusy("");
    }
  }

  const hidden = { filter: "blur(5px)", userSelect: "none" };
  const confirmedLabel = (r) => r.confirmed === "follow" ? "confirmed by follow link"
    : r.confirmed === "sign-in" ? "confirmed by sign-in" : "not confirmed";

  return (
    <Collapsible title="Subscribers" count={people.length}
      hint="Everybody on the site-wide list or following a newsletter or event, newest first. Addresses are blurred until you reveal them, and stay revealed only until this page is reloaded.">
      <div className="flex flex-wrap items-center" style={{ gap: S.sm, padding: "12px 0" }}>
        <Btn onClick={() => setRevealed((v) => !v)}>{revealed ? "Hide addresses" : "Reveal addresses"}</Btn>
        <Btn onClick={copy} disabled={!siteList.length} tone="go"
          title="The site-wide list, one address per line">Copy all {siteList.length} site-wide</Btn>
        <span style={{ fontSize: F.xs, color: C.muted }}>
          When you send, put the addresses in Bcc so nobody on the list sees anybody else.
        </span>
      </div>
      {copied && <p style={{ fontSize: F.xs, color: C.accentInk, margin: "0 0 8px" }}>{copied}</p>}
      {err && <p style={{ fontSize: F.xs, color: C.badInk, margin: "0 0 8px" }}>{err}</p>}
      {people.length === 0
        ? <Empty>Nobody is subscribed or following anything yet.</Empty>
        : people.map((r) => (
          <Row key={r.email}
            title={<span style={{ fontSize: F.md, ...(revealed ? {} : hidden) }} aria-hidden={!revealed}>{r.email}</span>}
            badges={<>
              {r.site && <Pill>site-wide list</Pill>}
              {r.items.length > 0 && <Pill>follows {r.items.length}</Pill>}
              <Pill>{confirmedLabel(r)}</Pill>
            </>}
            body={r.items.length > 0
              ? <p style={{ margin: 0, lineHeight: 1.55 }}>
                {r.items.map((i) => `${i.name} (since ${i.since})`).join(" · ")}
              </p>
              : null}
            meta={`joined ${r.joined || "date not recorded"}${r.site ? ` · site-wide since ${r.site.since || "?"}` : ""}`}
            actions={<ConfirmBtn busy={busy === r.email} onConfirm={() => remove(r.email)}
              confirm="Remove from every list">Remove</ConfirmBtn>}
          />
        ))}
    </Collapsible>
  );
}

/* ------------------------------------------------------------------ */
/*  Research, review, publish                                          */
/*                                                                     */
/*  The model writes a first draft from the vendor's own pages. A      */
/*  person reads it, edits anything, and only then does it go live.    */
/*  That order is the whole design: a model reading a vendor's site    */
/*  writes the vendor's version of the truth, and the caveats are what */
/*  this directory is for. Nothing below publishes without the click.  */
/* ------------------------------------------------------------------ */

const FIELD = {
  background: C.field, border: `1px solid ${C.line}`, borderRadius: R.control,
  padding: "6px 10px", fontSize: F.sm, color: C.text, fontFamily: "inherit", width: "100%",
};

const LABEL = { fontSize: F.xs, color: C.dim, fontWeight: 600, display: "block", marginBottom: 4 };

function Field({ label, children, hint }) {
  return (
    <div style={{ marginTop: S.md }}>
      <label style={LABEL}>{label}</label>
      {children}
      {hint && <p style={{ fontSize: F.xs, color: C.dim, margin: "4px 0 0", lineHeight: 1.5 }}>{hint}</p>}
    </div>
  );
}

function Grow({ value, onChange, rows = 3, ...rest }) {
  return <textarea value={value} onChange={onChange} rows={rows}
    style={{ ...FIELD, resize: "vertical", lineHeight: 1.55 }} {...rest} />;
}

function DraftPanel({ s, onSuggestions, onEntries }) {
  const [draft, setDraft] = useState(s.draft || null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const published = Boolean(s.publishedId);

  const set = (k, v) => setDraft((d) => ({ ...(d || {}), [k]: v }));

  async function research() {
    setBusy("research"); setErr(""); setNote("");
    try {
      const res = await fetch("/api/admin/research", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: s.id }),
      });
      if (!res.ok) { setErr(await res.text()); return; }
      const d = await res.json();
      setDraft(d.draft);
      if (d.suggestions) onSuggestions(d.suggestions);
      setNote(`Drafted by ${d.provider}. Read it before you publish it.`);
    } catch {
      setErr("Could not reach the server.");
    } finally { setBusy(""); }
  }

  async function post(action, extra) {
    setBusy(action); setErr(""); setNote("");
    try {
      const res = await fetch("/api/admin", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, id: s.id, ...extra }),
      });
      if (!res.ok) { setErr(await res.text()); return null; }
      const d = await res.json();
      if (d.suggestions) onSuggestions(d.suggestions);
      if (d.entries) onEntries(d.entries);
      return d;
    } catch {
      setErr("Could not reach the server."); return null;
    } finally { setBusy(""); }
  }

  const tagText = Array.isArray(draft?.tags) ? draft.tags.join(", ") : "";

  if (!draft) {
    return (
      <div className="mt-2">
        <Btn onClick={research} busy={busy === "research"} tone="go">Research and draft</Btn>
        {err && <p style={{ fontSize: F.xs, color: C.badInk, margin: "8px 0 0", lineHeight: 1.5 }}>{err}</p>}
      </div>
    );
  }

  return (
    <Row inset
      title={published ? "Published" : "Draft, not published"}
      badges={<span style={{ fontSize: F.xs, color: C.dim }}>
        {draft.researchedBy ? `drafted by ${draft.researchedBy}` : "hand written"}
        {draft.researchedAt ? ` · ${String(draft.researchedAt).slice(0, 16).replace("T", " ")}` : ""}
      </span>}
      meta={(draft.pagesRead?.length || draft.pagesFailed?.length)
        ? <>Read: {draft.pagesRead?.join(", ") || "nothing"}
          {draft.pagesFailed?.length ? ` · could not read: ${draft.pagesFailed.join(", ")}` : ""}</>
        : null}
      footer={<>

      {/* The reason this screen exists. Anything the model repeated without
          being able to check it is listed before the fields, not after. */}
      {draft.unconfirmed?.length > 0 && (
        <div style={{
          marginTop: S.md, background: C.badSoft, border: `1px solid ${C.badEdge}`,
          borderRadius: R.control, padding: S.md,
        }}>
          <p style={{ fontSize: F.xs, color: C.badInk, fontWeight: 700, margin: 0 }}>
            Unverified, taken from the vendor's own pages
          </p>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
            {draft.unconfirmed.map((u, i) => (
              <li key={i} style={{ fontSize: F.xs, color: C.muted, lineHeight: 1.55 }}>{u}</li>
            ))}
          </ul>
        </div>
      )}

      {(draft.ownership || draft.sharedOwnerWith) && (
        <p style={{ fontSize: F.xs, color: C.muted, margin: `${S.md}px 0 0`, lineHeight: 1.55 }}>
          <b style={{ color: C.text }}>Ownership. </b>{draft.ownership || "not stated"}
          {draft.sharedOwnerWith ? ` · shares an owner with ${draft.sharedOwnerWith}` : ""}
          {typeof draft.confidence === "number" ? ` · model confidence ${draft.confidence}` : ""}
        </p>
      )}

      <div className="flex flex-wrap" style={{ gap: S.md }}>
        <div style={{ flex: "1 1 220px" }}>
          <Field label="name"><input style={FIELD} value={draft.name || ""} onChange={(e) => set("name", e.target.value)} /></Field>
        </div>
        <div style={{ flex: "1 1 160px" }}>
          <Field label="cat">
            <select style={FIELD} value={draft.cat || CATEGORIES[0].id} onChange={(e) => set("cat", e.target.value)}>
              {CATEGORIES.map((c) => <option key={c.id} value={c.id} style={{ background: C.panel }}>{c.id} · {c.label}</option>)}
            </select>
          </Field>
        </div>
      </div>

      <div className="flex flex-wrap" style={{ gap: S.md }}>
        <div style={{ flex: "1 1 240px" }}>
          <Field label="url"><input style={FIELD} value={draft.url || ""} onChange={(e) => set("url", e.target.value)} /></Field>
        </div>
        <div style={{ flex: "1 1 160px" }}>
          <Field label="domain"><input style={FIELD} value={draft.domain || ""} onChange={(e) => set("domain", e.target.value)} /></Field>
        </div>
      </div>

      <div className="flex flex-wrap items-end" style={{ gap: S.md }}>
        <div style={{ flex: "1 1 200px" }}>
          <Field label="price"><input style={FIELD} value={draft.price || ""} onChange={(e) => set("price", e.target.value)} /></Field>
        </div>
        <label className="flex items-center" style={{ gap: S.sm, fontSize: F.sm, color: C.muted, paddingBottom: 6 }}>
          <input type="checkbox" checked={Boolean(draft.free)} onChange={(e) => set("free", e.target.checked)} />
          free tier
        </label>
        <label className="flex items-center" style={{ gap: S.sm, fontSize: F.sm, color: C.muted, paddingBottom: 6 }}>
          <input type="checkbox" checked={draft.shopifyExclusive === false}
            onChange={(e) => set("shopifyExclusive", e.target.checked ? false : true)} />
          not Shopify-only
        </label>
      </div>

      <Field label="one"><input style={FIELD} value={draft.one || ""} onChange={(e) => set("one", e.target.value)} /></Field>
      <Field label="note"><Grow rows={5} value={draft.note || ""} onChange={(e) => set("note", e.target.value)} /></Field>
      <Field label="watch"
        hint="Required, and &quot;none&quot; is refused. If there is no caveat, say what was checked and not found.">
        <Grow rows={5} value={draft.watch || ""} onChange={(e) => set("watch", e.target.value)} />
      </Field>
      <Field label="tags" hint="Comma separated.">
        <input style={FIELD} value={tagText}
          onChange={(e) => set("tags", e.target.value.split(",").map((t) => t.trim()).filter(Boolean))} />
      </Field>

      <div className="flex flex-wrap" style={{ gap: S.md }}>
        {SOCIALS.map(({ key, label, placeholder }) => (
          <div key={key} style={{ flex: "1 1 200px" }}>
            <Field label={`social.${key} (${label})`}>
              <input style={FIELD} placeholder={placeholder} value={draft.social?.[key] || ""}
                onChange={(e) => set("social", { ...(draft.social || {}), [key]: e.target.value })} />
            </Field>
          </div>
        ))}
      </div>

      <p style={{ fontSize: F.xs, color: C.dim, margin: `${S.md}px 0 0`, lineHeight: 1.55, maxWidth: "76ch" }}>
        Publishing writes this to <code style={{ color: C.muted }}>svt:entries</code>, which the live
        site reads alongside <code style={{ color: C.muted }}>lib/tools.js</code>. It goes live
        immediately. It is set <code style={{ color: C.muted }}>verified: false</code> whatever the
        model said, because verified means a person read the vendor's site. External ratings are never
        drafted here: those are entered by hand in the file, from the platform's own page.
      </p>

      <div className="flex flex-wrap items-center mt-3" style={{ gap: S.sm }}>
        <Btn onClick={() => post("publish-entry", { entry: draft })} busy={busy === "publish-entry"} tone="go">
          {published ? "Republish with these edits" : "Approve and publish"}
        </Btn>
        <Btn onClick={() => post("save-draft", { entry: draft })} busy={busy === "save-draft"}>Save draft</Btn>
        <Btn onClick={research} busy={busy === "research"}>Research again</Btn>
        {published && (
          <ConfirmBtn onConfirm={() => post("unpublish-entry", { id: s.publishedId })}
            busy={busy === "unpublish-entry"} confirm="Take it off the site">Unpublish</ConfirmBtn>
        )}
        <CopyStub s={{ ...s, draft }} />
      </div>

      {err && <p style={{ fontSize: F.xs, color: C.badInk, margin: "8px 0 0", lineHeight: 1.5 }}>{err}</p>}
      {note && <p style={{ fontSize: F.xs, color: C.accentInk, margin: "8px 0 0" }}>{note}</p>}
      </>}
    />
  );
}

/* Published from the queue, and live right now. Separate from the file, which
   is what git reviews; this is what Redis holds. */
function PublishedEntries({ entries = {}, onEntries }) {
  const all = Object.values(entries || {});
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState("");

  const rows = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return all;
    return all.filter((e) => [e.name, e.id, e.domain, e.one, catOf(e.cat).label]
      .some((v) => String(v || "").toLowerCase().includes(n)));
  }, [all, q]);

  async function unpublish(id) {
    setBusy(id);
    try {
      const res = await fetch("/api/admin", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unpublish-entry", id }),
      });
      if (res.ok) { const d = await res.json(); if (d.entries) onEntries(d.entries); }
    } finally { setBusy(""); }
  }

  return (
    <Collapsible title="Published from the queue"
      count={all.length}
      hint="Live on the site now, stored in svt:entries rather than in lib/tools.js, because a Vercel filesystem is read only at runtime. Promote anything worth keeping into the file with Copy as entry stub: the file is what git reviews, this is not."
    >
      {all.length > 3 && (
        <div style={{ padding: "12px 0 0" }}>
          <input value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search published entries"
            style={{ ...FIELD, maxWidth: 320 }} />
        </div>
      )}

      {all.length === 0
        ? <Empty>Nothing published this way yet. Everything on the site comes from lib/tools.js.</Empty>
        : rows.length === 0
          ? <Empty>Nothing matches “{q}”.</Empty>
          : rows.map((e) => (
            <Row key={e.id}
              title={e.name}
              tag={catOf(e.cat).label}
              tagColor={ink(catOf(e.cat).color)}
              badges={<>
                <span style={{ fontSize: F.xs, color: C.dim }}>{e.id}</span>
                {e.suggestedBy > 1 && <Pill>suggested by {e.suggestedBy}</Pill>}
                {e.shopifyExclusive === false && <Pill>not Shopify-only</Pill>}
              </>}
              body={e.one}
              meta={<>
                published {e.publishedAt} by {e.publishedBy}
                {e.draftedBy ? ` · drafted by ${e.draftedBy}` : ""}
                {e.unconfirmed?.length ? ` · ${e.unconfirmed.length} unverified claim${e.unconfirmed.length === 1 ? "" : "s"}` : ""}
              </>}
              actions={<>
                <a href={`/?tool=${encodeURIComponent(e.id)}`} target="_blank" rel="noopener noreferrer"
                  style={{
                    background: "transparent", border: `1px solid ${C.edge}`, color: C.muted,
                    borderRadius: R.control, padding: "4px 12px", fontSize: F.xs, fontWeight: 600,
                    textDecoration: "none", whiteSpace: "nowrap",
                  }}>View on the site</a>
                <ConfirmBtn onConfirm={() => unpublish(e.id)} busy={busy === e.id}
                  confirm="Unpublish">Unpublish</ConfirmBtn>
              </>}
            />
          ))}
    </Collapsible>
  );
}

/* Why a submission was merged, or was not. The only destructive outcome in the
   suggestion pipeline is a merge, so it is the one that has to be answerable. */
/*
 * The monitor's error rate by finding type, stated rather than inferred. If
 * pricing findings are wrong half the time it says so here, in a number, next
 * to how many were confirmed by the following run. Then the mistakes
 * themselves, with the reason each was marked, because those are what the
 * compare prompt is now reading before it judges again.
 */
function MonitorAccuracy({ rows = [], errors = [], verified = {} }) {
  const rates = errorRates(rows, errors, verified);
  const pct = (x) => `${Math.round(x * 100)}%`;
  return (
    <>
      {rates.length === 0
        ? <Empty>No findings in the window yet.</Empty>
        : (
          <div style={{ overflowX: "auto" }}>
            <table className="tnum" style={{ borderCollapse: "collapse", fontSize: F.sm, minWidth: 420 }}>
              <thead>
                <tr style={{ color: C.dim, fontSize: F.xs, textAlign: "left" }}>
                  {["Finding type", "Findings", "Marked wrong", "Error rate", "Confirmed next run"].map((h) => (
                    <th key={h} style={{ padding: "6px 16px 6px 0", fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rates.map((g) => (
                  <tr key={g.kind} style={{ borderTop: `1px solid ${C.line}` }}>
                    <td style={{ padding: "6px 16px 6px 0", fontWeight: 600 }}>{KIND_LABEL[g.kind] || g.kind}</td>
                    <td style={{ padding: "6px 16px 6px 0" }}>{g.findings}</td>
                    <td style={{ padding: "6px 16px 6px 0" }}>{g.wrong}</td>
                    <td style={{
                      padding: "6px 16px 6px 0", fontWeight: 700,
                      color: g.wrong && g.rate >= 0.25 ? C.warnInk : C.text,
                    }}>{g.wrong ? pct(g.rate) : "0%"}</td>
                    <td style={{ padding: "6px 16px 6px 0", color: C.muted }}>{g.confirmed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ fontSize: F.xs, color: C.dim, margin: "8px 0 0", lineHeight: 1.5, maxWidth: "76ch" }}>
              Over the last {rows.length} findings. Confidence now means verification:{" "}
              {Object.entries(CAP).map(([k, v], i) => `${i ? ", " : ""}${v} ${VERIFICATION_LABEL[k]}`).join("")}.
            </p>
          </div>
        )}

      <div style={{ marginTop: S.md }}>
        {errors.length === 0
          ? <Empty>Nothing has been marked wrong.</Empty>
          : errors.slice(0, 30).map((e) => (
            <Row key={e.id}
              title={e.entryName || e.entryId}
              tag={`${KIND_LABEL[e.kind] || e.kind} marked wrong`}
              tagColor={C.warnInk}
              badges={<>
                {e.finding?.verification && <Pill>{e.finding.verification}</Pill>}
                {e.pairId && <Pill>pair {e.pairId.slice(0, 8)}</Pill>}
                {!e.pair && <Pill>no snapshot pair stored</Pill>}
              </>}
              body={<>
                <span style={{ color: C.muted }}>Reported: </span>{e.finding?.what}
                {(e.finding?.old || e.finding?.new) && <> (was {e.finding.old || "absent"}, now {e.finding.new || "absent"})</>}
                {" "}at {e.finding?.confidence}{typeof e.finding?.modelConfidence === "number" ? `, model said ${e.finding.modelConfidence}` : ""}.
                <br /><span style={{ color: C.muted }}>Why it was wrong: </span>{e.reason}
              </>}
              meta={`${String(e.at || "").slice(0, 16).replace("T", " ")} · ${e.by}`}
            />
          ))}
      </div>
    </>
  );
}

/*
 * The audit trail for AI rewrites. A bad description is traced from here back
 * to the finding, the source page and the person who accepted it, and the row
 * says whether they saved the model's text or their own edit of it.
 */
function RewriteLog({ rows = [] }) {
  if (!rows.length) return <Empty>No description has been rewritten with AI.</Empty>;
  return (
    <>
      {rows.map((r) => r.type === "undo" ? (
        <Row key={r.id}
          title={r.toolId}
          tag="undone"
          tagColor={C.dim}
          body={`Restored ${(r.fields || []).join(", ")} to what was there before rewrite ${r.undoes}.`}
          meta={`${String(r.at || "").slice(0, 16).replace("T", " ")} · ${r.by}`}
        />
      ) : (
        <Row key={r.id}
          title={r.toolName || r.toolId}
          tag={`rewrote ${(Object.keys(r.saved || {})).join(", ")}`}
          tagColor={C.accentInk}
          badges={<>
            {r.provider && <Pill>{r.provider}</Pill>}
            {r.edited && <Pill>edited before saving</Pill>}
            {r.dropped?.length > 0 && <Pill>dropped {r.dropped.map((d) => d.field).join(", ")}</Pill>}
          </>}
          body={<>
            <span style={{ color: C.muted }}>Finding ({r.finding?.kind}, {r.finding?.confidence}): </span>{r.finding?.what}
            {r.finding?.url && <> <a href={outbound(r.finding.url)} target="_blank" rel="noopener noreferrer" style={{ color: C.muted }}>source</a></>}
            {r.steer && <><br /><span style={{ color: C.muted }}>Steer: </span>{r.steer}</>}
            {Object.keys(r.saved || {}).map((f) => {
              const d = diffSentences(r.before?.[f] || "", r.saved[f]);
              return (
                <div key={f} style={{ marginTop: 6 }}>
                  <b>{f}</b>
                  <div style={{ marginTop: 2 }}><Sentences parts={d.before} side="before" /></div>
                  <div style={{ marginTop: 4 }}><Sentences parts={d.after} side="after" /></div>
                </div>
              );
            })}
          </>}
          meta={`${String(r.at || "").slice(0, 16).replace("T", " ")} · ${r.by} · change ${r.changeId}`}
        />
      ))}
    </>
  );
}

function DedupeLog({ rows = [] }) {
  if (!rows.length) return <Empty>No submissions since this log started.</Empty>;
  return (
    <>
      {rows.map((r, i) => (
        <Row key={i}
          title={r.submitted?.name || "(no name)"}
          tag={r.outcome === "none" ? "stored as new" : `merged into ${r.outcome} ${r.matchedId}`}
          tagColor={r.outcome === "none" ? C.dim : ink("#FFB020")}
          badges={<Pill>{r.decidedBy}</Pill>}
          body={r.model?.unavailable
            ? `Model unavailable: ${r.model.unavailable}`
            : `${r.model?.provider} said ${r.model?.said || "none"}${r.model?.id ? ` (${r.model.id})` : ""} at ${r.model?.confidence}${r.model?.reason ? `: ${r.model.reason}` : ""}${r.model?.dropped ? ` \u00b7 ignored, ${r.model.dropped}` : ""}`}
          meta={String(r.at || "").slice(0, 16).replace("T", " ")}
        />
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Weekly change monitor                                              */
/*                                                                     */
/*  Proposals, not edits. Nothing in this panel has changed a listing   */
/*  and nothing in it can: the monitor writes to svt:changelog and      */
/*  stops. "Update listing" opens the listing so a person makes the     */
/*  change, which is the same reason the suggestion pipeline ends in a  */
/*  human click.                                                       */
/* ------------------------------------------------------------------ */

const KIND_LABEL = {
  pricing: "Pricing", "free-tier": "Free tier", "wind-down": "Winding down",
  acquisition: "Acquired", "new-capability": "New capability", shipped: "From its changelog",
  "dead-page": "Page dead", scale: "Scale numbers", ownership: "Ownership",
};

/* Two hues only, and both already in the palette: the warning colour for the
   ones that change what the listing claims, neutral for the rest. A colour per
   kind is how eight unrelated hues end up next to a spine that means something. */
const LOUD = new Set(["wind-down", "acquisition", "dead-page", "free-tier", "pricing"]);

/*
 * A finding is handled once it is dismissed or resolved, and resolving is one
 * click after whatever destinations it needed. Publishing, applying and
 * rewriting are destinations, not verdicts: a new capability is usually news
 * and a description change, and the row has to stay put while somebody does
 * both. Records written before resolve-once existed carry no `awaitsResolve`
 * and count as handled, which is what they were when they were written.
 */
const isHandled = (id, seen = {}, published = {}, applied = {}) => Boolean(
  seen[id]
  || (published[id] && !published[id].awaitsResolve)
  || (applied[id] && !applied[id].awaitsResolve));

function ChangeMonitor({ rows = [], monitor = {}, seen = {}, coverage = [], appliedChanges = {}, publishedChanges = {}, rewrittenChanges = {}, editedChanges = {}, verifiedChanges = {}, autoResolved = [], onSeen }) {
  const [busy, setBusy] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState("");
  const [dismissed, setDismissed] = useState(seen || {});
  const [applied, setApplied] = useState(appliedChanges || {});
  const [published, setPublished] = useState(publishedChanges || {});
  const [rewritten, setRewritten] = useState(rewrittenChanges || {});
  const [edited, setEdited] = useState(editedChanges || {});
  const [openTool, setOpenTool] = useState("");
  const [showEarlier, setShowEarlier] = useState(false);
  const [showAll, setShowAll] = useState(false);

  /* Handled means dismissed or resolved. Handled ones leave Updates. */
  const handled = (r) => isHandled(r.id, dismissed, published, applied);

  async function mark(id, action, extra = {}) {
    setBusy(id); setResult("");
    try {
      const res = await fetch("/api/admin", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, id, ...extra }),
      });
      if (!res.ok) {
        const text = await res.text();
        setResult(text);
        return { error: text };
      }
      const d = await res.json();
      if (d.dismissed) { setDismissed(d.dismissed); onSeen?.(d.dismissed); }
      if (d.applied) setApplied(d.applied);
      if (d.published) setPublished(d.published);
      if (d.rewritten) setRewritten(d.rewritten);
      if (d.edited) setEdited(d.edited);
      return d;
    } catch {
      setResult("Could not reach the server.");
      return { error: "Could not reach the server." };
    } finally { setBusy(""); }
  }

  async function runNow() {
    setRunning(true); setResult("");
    try {
      const res = await fetch("/api/cron/monitor", { method: "POST" });
      if (!res.ok) { setResult(await res.text()); return; }
      const d = await res.json();
      setResult(`Checked ${d.checked} of ${d.total} in ${Math.round(d.tookMs / 1000)}s. ${d.changes} change${d.changes === 1 ? "" : "s"}.${d.emailed ? " Digest sent." : " Nothing emailed, which is the usual answer."} Reload to see them.`);
    } catch {
      setResult("Could not reach the server.");
    } finally { setRunning(false); }
  }

  /*
   * The Inbox holds this run. Anything older that was never handled is real
   * but is not this week's work, so it moves to Earlier rather than padding
   * the thing you opened the page to read.
   */
  /*
   * The latest run, exactly: every row from one sweep shares a single `at`,
   * stamped once in runMonitor.
   *
   * This was the run's *day* at first, which looks equivalent and is not: run
   * the monitor three times in an afternoon and every row from all three
   * collapses into "current", which put 90 changes in the panel instead of the
   * 8 the last sweep actually found. The whole point of the cap is that the
   * panel holds one run.
   */
  const latestRun = rows.length ? rows.reduce((a, r) => (r.at > a ? r.at : a), "") : "";

  const open = rows.filter((r) => !handled(r));
  const current = open.filter((r) => r.at === latestRun);
  const earlier = open.filter((r) => r.at !== latestRun);

  /* Grouped by tool, because a tool's weekly changes usually share a verdict
     and reading them together is how you notice that. */
  const group = (list) => {
    const by = new Map();
    for (const r of list) {
      const g = by.get(r.entryId) || { id: r.entryId, name: r.entryName, rows: [] };
      g.rows.push(r);
      by.set(r.entryId, g);
    }
    return [...by.values()].map((g) => ({
      ...g,
      newest: g.rows.reduce((a, r) => (r.at > a ? r.at : a), ""),
      /* A tool wanting a decision outranks one that is merely recent. */
      needsDecision: g.rows.some((r) => r.editListing),
    })).sort((a, b) =>
      Number(b.needsDecision) - Number(a.needsDecision) || String(b.newest).localeCompare(String(a.newest)));
  };

  const groups = group(current);
  const earlierGroups = group(earlier);
  const sinceVisitCount = current.length;

  return (
    <Section
      title="Listing changes"
      count={open.length}
      hint="Proposed by the weekly monitor, grouped by tool. Nothing here has been applied: most belong in What's moving, a few in the listing, the rest are noise."
    >
      <div className="flex flex-wrap items-center" style={{ gap: S.md, padding: "12px 0" }}>
        <Btn onClick={runNow} busy={running} tone="go">Run the monitor now</Btn>
        <span style={{ fontSize: F.xs, color: C.dim }}>
          {monitor?.lastRunAt
            ? `Last run ${String(monitor.lastRunAt).slice(0, 16).replace("T", " ")} · checked ${monitor.lastChecked || 0} of ${monitor.lastTotal || 0}`
            : "Never run. Weekly on Mondays."}
        </span>
      </div>

      {/*
        * The one line that is usually the whole answer. If it says nothing is
        * waiting, there is no reason to open anything below it.
        */}
      <p style={{
        fontSize: F.md, color: sinceVisitCount ? C.text : C.muted, margin: "0 0 12px",
        lineHeight: 1.6, fontWeight: sinceVisitCount ? 600 : 400,
      }}>
        {sinceVisitCount
          ? `${sinceVisitCount} change${sinceVisitCount === 1 ? "" : "s"} across ${groups.length} tool${groups.length === 1 ? "" : "s"} in the latest run.`
          : "Nothing from the latest run is waiting on you."}
        {earlier.length > 0 && (
          <span style={{ color: C.dim, fontWeight: 400 }}>
            {" "}{earlier.length} older {earlier.length === 1 ? "one is" : "ones are"} still unhandled.
          </span>
        )}
      </p>

      {/*
        * What this load resolved by itself, because the listing changed after
        * the finding (lib/handEdits.js). Said once, here, with the reason, so
        * a finding that left the list did not leave it silently. Each one is
        * also marked on its own row, and Reopen puts it back.
        */}
      {autoResolved.length > 0 && (
        <div style={{ fontSize: F.xs, color: C.muted, margin: "0 0 12px", lineHeight: 1.6 }}>
          <p style={{ margin: 0, color: C.text, fontWeight: 600 }}>
            Resolved {autoResolved.length} finding{autoResolved.length === 1 ? "" : "s"} automatically, because the listing changed after {autoResolved.length === 1 ? "it" : "them"}:
          </p>
          <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
            {autoResolved.map((f) => <li key={f.id}>{f.entryName}: {f.reason}</li>)}
          </ul>
        </div>
      )}

      <CoverageLine rows={coverage} />

      {result && <p style={{ fontSize: F.xs, color: C.accentInk, margin: "0 0 12px", lineHeight: 1.55 }}>{result}</p>}

      {groups.length === 0
        ? <Empty>Nothing from the latest run. Most weeks this is the correct answer.</Empty>
        : (
          <>
            {/* Past ten tools the list is shut behind its count, like every
                long list here. The summary sentence above already says what
                the run found; the rows are what you open to act on it. */}
            {groups.length > ROW_LIMIT && (
              <button onClick={() => setShowAll((v) => !v)} aria-expanded={showAll} style={{
                background: "none", border: 0, padding: "8px 0", cursor: "pointer", fontFamily: "inherit",
                fontSize: F.sm, fontWeight: 600, color: C.text,
              }}>
                {showAll ? "\u25be" : "\u25b8"} {groups.length} tools with changes
              </button>
            )}
            {(showAll || groups.length <= ROW_LIMIT) && groups.map((g) => (
              <ToolChanges key={g.id} group={g} openTool={openTool} setOpenTool={setOpenTool}
                applied={applied} published={published} rewritten={rewritten} edited={edited} dismissed={dismissed} verified={verifiedChanges} busy={busy} onAct={mark} />
            ))}
          </>
        )}

      {earlierGroups.length > 0 && (
        <div style={{ borderTop: `1px solid ${C.line}`, marginTop: S.md, paddingTop: S.md }}>
          <button onClick={() => setShowEarlier((v) => !v)} style={{
            background: "none", border: 0, padding: 0, cursor: "pointer", fontFamily: "inherit",
            fontSize: F.sm, color: C.muted, textDecoration: "underline",
          }}>
            {showEarlier ? "Hide" : `Earlier, still unhandled (${earlier.length} across ${earlierGroups.length} tools)`}
          </button>
          {showEarlier && earlierGroups.map((g) => (
            <ToolChanges key={g.id} group={g} openTool={openTool} setOpenTool={setOpenTool}
              applied={applied} published={published} rewritten={rewritten} edited={edited} dismissed={dismissed} verified={verifiedChanges} busy={busy} onAct={mark} />
          ))}
        </div>
      )}

      <p style={{ fontSize: F.xs, color: C.dim, margin: "14px 0 4px", lineHeight: 1.55, maxWidth: "76ch" }}>
        A tool disappears from here once every one of its changes is resolved or dismissed. Publishing
        puts a finding on the feed, applying or rewriting corrects the listing, and one finding can
        take more than one of those before you resolve it. Dismissing records that you looked. Most
        findings belong on the feed: a listing that grows a sentence every week has stopped being a
        listing.
      </p>
    </Section>
  );
}

/*
 * One tool's changes, collapsed to a line until you want them.
 *
 * The flat chronological list this replaces was the bulk of the Inbox and
 * buried everything else in it, which is the failure mode of every list that
 * outgrows its layout: it is not that the rows are wrong, it is that they
 * crowd out the two things that needed a decision.
 */
/* No edit in progress or done. A rejected detection is untouched again; an
   edit in progress is not, so Dismiss all leaves it for the person editing. */
const untouchedEdit = (e) => !e || e.via === "rejected";

function ToolChanges({ group, openTool, setOpenTool, applied, published, rewritten, edited = {}, dismissed, verified = {}, busy, onAct }) {
  const expanded = openTool === group.id;
  const [batch, setBatch] = useState("");
  const tool = ALL_TOOLS.find((t) => t.id === group.id);
  const n = group.rows.length;

  async function dismissAll() {
    setBatch("dismiss");
    for (const r of group.rows) {
      if (!dismissed[r.id] && !applied[r.id] && !published[r.id] && !rewritten[r.id] && untouchedEdit(edited[r.id])) await onAct(r.id, "dismiss-change");
    }
    setBatch("");
  }

  /* Findings that already went somewhere (the feed, the listing, a rewrite)
     and only wait for Resolve. Resolving each by hand was one click per
     finding for a decision already made. Untouched findings are left alone:
     those still need a look, and resolving refuses a finding with nowhere to go. */
  const ready = group.rows.filter((r) => !dismissed[r.id] && (published[r.id] || applied[r.id] || rewritten[r.id] || editDone(edited[r.id])));
  const untouched = group.rows.filter((r) => !dismissed[r.id] && !applied[r.id] && !published[r.id] && !rewritten[r.id] && untouchedEdit(edited[r.id]));
  async function resolveReady() {
    setBatch("resolve");
    for (const r of ready) await onAct(r.id, "resolve-change");
    setBatch("");
  }

  /* A tool's weekly changes usually share a verdict, so the common one is on
     the title line, available without opening anything. Publishing is per
     change because each needs a sentence written. */
  return (
    <Row expandable open={expanded} onToggle={() => setOpenTool(expanded ? "" : group.id)}
      title={<span className="inline-flex items-center" style={{ gap: S.sm }}>
        {tool && <AdminLogo tool={tool} />}{group.name}
      </span>}
      badges={<>
        <span style={{ fontSize: F.sm, color: C.muted }}>{n} change{n === 1 ? "" : "s"}</span>
        {group.needsDecision && <Pill tone="warn">listing may need editing</Pill>}
      </>}
      headActions={<>
        {ready.length > 0 && (
          <Btn tone="go" onClick={resolveReady} busy={batch === "resolve"}>
            Resolve {ready.length}
          </Btn>
        )}
        {untouched.length > 0 && (
          <ConfirmBtn onConfirm={dismissAll} busy={batch === "dismiss"} confirm={`Dismiss all ${untouched.length}`}>
            Dismiss all
          </ConfirmBtn>
        )}
      </>}
    >
      {group.rows.map((r) => (
        <Row key={r.id}
          title={<span style={{ fontSize: F.xs, color: LOUD.has(r.kind) ? C.warnInk : C.muted }}>{KIND_LABEL[r.kind] || r.kind}</span>}
          badges={<ConfidenceLine r={r} verified={verified} />}
          body={<>
            <p style={{ fontSize: F.sm, color: C.text, margin: "2px 0 0", lineHeight: 1.55 }}>{r.what}</p>
            {(r.old || r.new) && (
              <p className="tnum" style={{ margin: "6px 0 0", lineHeight: 1.55 }}>
                <span style={{ color: C.dim }}>was</span> {r.old || "absent"}
                {"  "}<span style={{ color: C.dim }}>now</span> <b style={{ color: C.text }}>{r.new || "absent"}</b>
              </p>
            )}
            {r.why && <p style={{ fontSize: F.xs, color: C.dim, margin: "6px 0 0", lineHeight: 1.5 }}>{r.why}</p>}
          </>}
          footer={<ChangeAction r={r} done={Boolean(dismissed[r.id])} seenRecord={dismissed[r.id]} applied={applied[r.id]}
            published={published[r.id]} rewritten={rewritten[r.id]} edited={edited[r.id]} busy={busy} onAct={onAct} />}
        />
      ))}
    </Row>
  );
}

/*
 * The number, and what it rests on. A confidence on its own reads as the
 * model's certainty; this says how much has actually been verified, and keeps
 * the model's own figure beside it for when the two disagree.
 */
function ConfidenceLine({ r, verified = {} }) {
  const c = effectiveConfidence(r, verified);
  const weak = c.value < CAP["single-run"];
  return (
    <span className="tnum" style={{ fontSize: F.xs, color: weak ? C.warnInk : C.dim }}>
      confidence {c.value} · {c.label}
      {typeof r.modelConfidence === "number" && r.modelConfidence !== c.value && (
        <span style={{ color: C.dim }}> · model said {r.modelConfidence}</span>
      )}
      {" · "}{String(r.at || "").slice(0, 10)}
    </span>
  );
}

/*
 * "The monitor was mistaken", as opposed to "not worth acting on". The reason
 * is required and one line: it is what the next compare call reads as a
 * negative example, and what the error rate on System is made of.
 */
function MarkWrong({ r, busy, onAct, hasDestinations, startArmed = false, onCancel }) {
  const [err, setErr] = useState("");
  const submit = async (reason) => {
    setErr("");
    const res = await onAct(r.id, "mark-wrong", { reason });
    if (res?.error) setErr(res.error);
  };
  return (
    <>
      <ConfirmBtn tone="plain" busy={busy === r.id} confirm="Mark wrong" onConfirm={submit} startArmed={startArmed} onCancel={onCancel}
        reason="What it got wrong, in one line. e.g. annual prices are behind a toggle"
        note={hasDestinations
          ? "This resolves the finding but does not undo what was already done with it. Remove it from updates or undo the listing change with their own buttons."
          : null}>Mark as wrong</ConfirmBtn>
      {err && <p style={{ fontSize: F.xs, color: C.badInk, margin: "6px 0 0", flexBasis: "100%" }}>{err}</p>}
    </>
  );
}

/* The same mark the public site uses, at the size this list wants. */
function AdminLogo({ tool, size = 22 }) {
  const [failed, setFailed] = useState(false);
  if (failed || !tool.domain) return null;
  return (
    <img referrerPolicy="no-referrer" src={tool.logo || `https://www.google.com/s2/favicons?domain=${tool.domain}&sz=64`}
      alt="" width={size} height={size} loading="lazy" decoding="async"
      onError={() => setFailed(true)}
      style={{
        width: size, height: size, borderRadius: R.control, flexShrink: 0,
        background: "#FFFFFF", objectFit: "contain", padding: 2,
      }} />
  );
}

/*
 * What you can do about a proposed change, which depends entirely on which
 * field it lands on.
 *
 *  appliable  one button that names the field, the old value and the new one,
 *             and writes it. The click is the approval: everything a person
 *             needs to judge it is on the button, so sending them to an editor
 *             to retype what the monitor already worked out is make-work.
 *  protected  no button, ever. watch, cat, verified and ratings are the fields
 *             this directory's independence rests on, and the reason is stated
 *             rather than left as a missing affordance.
 *  unmapped   the monitor could not turn this into one field and says so. A
 *             guess here would be a button claiming it will write something
 *             and then writing the wrong thing.
 */
function ChangeAction({ r, done, seenRecord, applied, published, rewritten, edited, busy, onAct }) {
  const wrong = seenRecord?.via === "wrong";
  const edit = r.edit || { state: "unmapped" };
  const [writing, setWriting] = useState(false);
  const [rewriting, setRewriting] = useState(false);
  const [headline, setHeadline] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [meta, setMeta] = useState(null);
  const [err, setErr] = useState("");

  /*
   * Straight to the edit form, in one click: the listing opens with the
   * editor already open (`edit=1`), and saving records the edit as this
   * finding's destination (`finding`), so Resolve is there when you come back.
   * It used to be the listing page, then Edit, then the directory's modal,
   * then Edit again. A newsletter's editor is on its own page.
   */
  const page = r.entryKind === "newsletter" ? `/newsletters/${encodeURIComponent(r.entryId)}` : `/tools/${encodeURIComponent(r.entryId)}`;
  const editHref = r.entryKind === "newsletter"
    ? `${page}?edit=1&finding=${encodeURIComponent(r.id)}`
    : `/?tool=${encodeURIComponent(r.entryId)}&edit=1&finding=${encodeURIComponent(r.id)}`;
  const quiet = { fontSize: F.xs, color: C.muted, whiteSpace: "nowrap", textDecoration: "underline" };
  const editState = editDone(edited) ? "done" : edited?.via === "editing" ? "editing" : "none";
  const [choosingWrong, setChoosingWrong] = useState(false);

  const source = r.url && (
    <a href={outbound(r.url)} target="_blank" rel="noopener noreferrer"
      style={quiet}>{r.url.replace(/^https?:\/\//, "")}</a>
  );

  const shown = (v) => (v === "" || v === null || v === undefined ? "absent" : String(v));

  /*
   * Draft first, then open the editor.
   *
   * The monitor's own summary used to be the pre-fill, and it is written in a
   * different register: it addresses an editor deciding whether something
   * matters, and the feed is read by somebody who uses the tool and wants to
   * know what it costs now. So the model writes for the reader and a person
   * cuts it down.
   *
   * A failed draft still opens the editor, empty. Nothing about the model
   * being unavailable should stop somebody writing two sentences themselves.
   */
  async function startDraft() {
    setWriting(true); setErr(""); setDrafting(true); setMeta(null);
    try {
      const res = await fetch("/api/admin/announce", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: r.id }),
      });
      if (!res.ok) {
        setErr(`${await res.text()} Write it yourself below.`);
        setHeadline("");
        return;
      }
      const d = await res.json();
      setHeadline(d.draft || "");
      setMeta(d);
    } catch {
      setErr("Could not reach the server. Write it yourself below.");
      setHeadline("");
    } finally { setDrafting(false); }
  }

  async function publish() {
    setErr("");
    const res = await onAct(r.id, "publish-to-feed", { headline, sourceUrl: r.url });
    if (res?.error) { setErr(res.error); return; }
    setWriting(false);
  }

  return (
    <div className="mt-2">
      {edit.state === "appliable" && (
        <div style={{
          background: C.subtle, border: `1px solid ${C.edge}`, borderRadius: R.control,
          padding: "8px 12px", marginBottom: S.sm,
        }}>
          <p className="tnum" style={{ fontSize: F.xs, color: C.muted, margin: 0, lineHeight: 1.6 }}>
            <b style={{ color: C.text }}>{edit.field}</b>
            {"  "}<span style={{ color: C.dim }}>from</span> {shown(edit.from)}
            {"  "}<span style={{ color: C.dim }}>to</span>{" "}
            <b style={{ color: C.text }}>{shown(edit.to)}</b>
          </p>
        </div>
      )}

      {edit.state === "protected" && (
        <p style={{ fontSize: F.xs, color: C.warnInk, margin: `0 0 ${S.sm}px`, lineHeight: 1.55, maxWidth: "72ch" }}>
          <b>Needs a hand edit.</b>{" "}
          <span style={{ color: C.muted }}>
            This proposes changing <b style={{ color: C.text }}>{edit.field}</b>, which the monitor is
            never allowed to write. {edit.field === "watch"
              ? "The caveat is the product, and a vendor quietly dropping the thing it warns about is not evidence the warning is wrong."
              : "It is editorial rather than factual, so it is a judgement somebody makes while editing the file."}
            {" "}Edit <code>lib/tools.js</code> and ship it.
          </span>
        </p>
      )}

      {edit.state === "unmapped" && (
        <p style={{ fontSize: F.xs, color: C.dim, margin: `0 0 ${S.sm}px`, lineHeight: 1.55, maxWidth: "72ch" }}>
          The monitor could not map this onto a single field{edit.field ? ` (it suggested "${edit.field}", which is not one we store)` : ""}.
          It may still be worth publishing to What's moving, rewriting the description, or both.
        </p>
      )}

      {/*
        * The feed editor: the draft on the left, the evidence for it on the
        * right. Both halves matter. A generated sentence reads as finished
        * whether or not it is true, so the figures it came from sit beside it
        * rather than a click away, and publishing stays a separate button.
        */}
      {writing && (
        <div style={{
          background: C.raised, border: `1px solid ${C.accentEdge}`, borderRadius: R.card,
          padding: S.lg, marginBottom: S.sm,
        }}>
          <div className="flex flex-wrap" style={{ gap: S.lg }}>
            <div style={{ flex: "2 1 300px", minWidth: 0 }}>
              <label style={{ fontSize: F.xs, color: C.dim, fontWeight: 600, display: "block", marginBottom: 4 }}>
                The announcement
                {meta?.provider && <span style={{ fontWeight: 400 }}> · drafted by {meta.provider}</span>}
              </label>
              {drafting ? (
                <p style={{ fontSize: F.sm, color: C.muted, margin: 0, lineHeight: 1.6, padding: "12px 0" }}>
                  Writing a draft from what the monitor saw…
                </p>
              ) : (
                <textarea value={headline} onChange={(e) => setHeadline(e.target.value)} rows={4}
                  placeholder="One to three sentences. What changed, and what it means for somebody using it."
                  style={{ ...FIELD, resize: "vertical", lineHeight: 1.55 }} />
              )}
              {meta?.thin && (
                <p style={{ fontSize: F.xs, color: C.warnInk, margin: "6px 0 0", lineHeight: 1.5 }}>
                  The model says the observation is thin. Check it is worth publishing at all.
                </p>
              )}
              {meta?.note && (
                <p style={{ fontSize: F.xs, color: C.dim, margin: "6px 0 0", lineHeight: 1.5 }}>
                  It could not stand up: {meta.note}
                </p>
              )}
              <p style={{ fontSize: F.xs, color: C.dim, margin: "8px 0 0", lineHeight: 1.5, maxWidth: "62ch" }}>
                Goes on <a href="/changes" target="_blank" rel="noopener noreferrer" style={{ color: C.muted }}>/changes</a>,
                the RSS feed and the tool&apos;s own page under today&apos;s date. A draft is something to
                cut down, not something to accept. No em-dash: the form refuses one.
              </p>
            </div>

            {/*
              * The claim, beside the draft rather than under it, so it can be
              * checked before publishing instead of afterwards. A generated
              * sentence is easy to read past; the figures it came from are not.
              */}
            <div style={{
              flex: "1 1 200px", minWidth: 0, background: C.panel,
              border: `1px solid ${C.line}`, borderRadius: R.control, padding: S.md,
            }}>
              <p style={{ fontSize: F.xs, color: C.dim, fontWeight: 600, margin: 0 }}>What the monitor saw</p>
              <p style={{ fontSize: F.xs, color: C.muted, margin: "6px 0 0", lineHeight: 1.55 }}>{r.what}</p>
              {(r.old || r.new) && (
                <p className="tnum" style={{ fontSize: F.xs, color: C.muted, margin: "6px 0 0", lineHeight: 1.55 }}>
                  <span style={{ color: C.dim }}>was</span> {r.old || "absent"}<br />
                  <span style={{ color: C.dim }}>now</span> <b style={{ color: C.text }}>{r.new || "absent"}</b>
                </p>
              )}
              <p style={{ fontSize: F.xs, color: C.dim, margin: "6px 0 0" }}>
                confidence {effectiveConfidence(r).value} · {effectiveConfidence(r).label}
              </p>
              {r.url && (
                <p style={{ margin: "8px 0 0" }}>
                  <a href={outbound(r.url)} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: F.xs, color: C.muted, wordBreak: "break-all" }}>
                    {r.url.replace(/^https?:\/\//, "")}
                  </a>
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center mt-3" style={{ gap: S.sm }}>
            <Btn onClick={publish} busy={busy === r.id || drafting} tone="go">Publish to What's moving</Btn>
            <Btn onClick={startDraft} busy={drafting}>Draft again</Btn>
            <Btn onClick={() => { setWriting(false); setErr(""); }}>Cancel</Btn>
          </div>
          {err && <p style={{ fontSize: F.xs, color: C.badInk, margin: "8px 0 0", lineHeight: 1.5 }}>{err}</p>}
        </div>
      )}

      {rewriting && !rewritten && (
        <RewriteEditor r={r} busy={busy} onAct={onAct} onClose={() => setRewriting(false)} />
      )}

      {/*
        * Three groups, left to right, and nothing else on the row.
        *
        *  primary   the destinations: What's moving first, because most
        *            findings belong there, then the listing change (Update
        *            listing where it maps to one field, Rewrite with AI where
        *            it does not). Neither excludes the other.
        *  editing   one button that changes with the state: Edit the listing,
        *            then "I have edited it" in the same place once clicked,
        *            then what was recorded. "I have edited it" is also a quiet
        *            link beside it for an edit made without clicking through.
        *            Open the listing and the source are links, not buttons.
        *  closing   at the end: Resolve once something was done, otherwise one
        *            Dismiss that asks whether it was not worth acting on or the
        *            monitor got it wrong.
        *
        * It was seven buttons in one row, and the one that marked an edit done
        * sat two along from the one that started it.
        */}
      <div className="flex flex-wrap items-center" style={{ gap: S.sm }}>
        {published ? (
          <>
            <span style={{ fontSize: F.xs, color: C.accentInk, fontWeight: 700 }}>
              On What's moving {String(published.at || "").slice(0, 10)}
            </span>
            <ConfirmBtn onConfirm={() => onAct(r.id, "unpublish-from-feed")} busy={busy === r.id}
              confirm="Remove">Remove from updates</ConfirmBtn>
          </>
        ) : !writing && (
          <Btn onClick={startDraft} busy={drafting} tone="go">
            Publish to What's moving
          </Btn>
        )}

        {applied ? (
          <>
            <span style={{ fontSize: F.xs, color: C.accentInk, fontWeight: 700 }}>
              Listing updated {String(applied.at || "").slice(0, 10)}
            </span>
            <Btn onClick={() => onAct(r.id, "undo-change")} busy={busy === r.id}>Undo</Btn>
          </>
        ) : edit.state === "appliable" ? (
          <Btn onClick={() => onAct(r.id, "apply-change")} busy={busy === r.id}>
            Update listing: {edit.field} → {shown(edit.to).slice(0, 34)}
          </Btn>
        ) : null}

        {rewritten ? (
          <>
            <span style={{ fontSize: F.xs, color: C.accentInk, fontWeight: 700 }}>
              Description rewritten {String(rewritten.at || "").slice(0, 10)} ({rewritten.fields.join(", ")})
            </span>
            <ConfirmBtn onConfirm={() => onAct(r.id, "undo-rewrite")} busy={busy === r.id}
              confirm="Restore the old text">Undo rewrite</ConfirmBtn>
          </>
        ) : edit.state !== "appliable" && !rewriting && (
          <Btn onClick={() => setRewriting(true)}>Rewrite with AI</Btn>
        )}

        <span aria-hidden="true" style={{ width: 1, alignSelf: "stretch", background: C.line, margin: "0 4px" }} />

        {editState === "done" ? (
          <>
            <span style={{ fontSize: F.xs, color: C.accentInk, fontWeight: 700 }}>
              Listing edited {String(edited.at || "").slice(0, 10)}
              {edited.via === "detected" ? <span style={{ fontWeight: 400, color: C.muted }}> (detected: {edited.reason})</span>
                : edited.fields?.length ? ` (${edited.fields.join(", ")})` : ""}
            </span>
            {(edited.via === "hand" || edited.via === "detected") && (
              <Btn onClick={() => onAct(r.id, "unmark-edited")} busy={busy === r.id}>Not edited</Btn>
            )}
          </>
        ) : editState === "editing" ? (
          <Btn tone="go" onClick={() => onAct(r.id, "mark-edited")} busy={busy === r.id}>I have edited it</Btn>
        ) : !done && (
          <a href={editHref} target="_blank" rel="noopener noreferrer" className="ctl press"
            onClick={() => { onAct(r.id, "start-editing"); }}
            style={{
              background: C.panel, border: `1px solid ${C.edge}`, color: C.text,
              borderRadius: R.control, padding: "4px 12px", fontSize: F.xs, fontWeight: 600,
              textDecoration: "none", whiteSpace: "nowrap",
            }}>Edit the listing</a>
        )}

        {/* Quiet links: an edit made without clicking through, the form again
            while editing, the public page, and what the monitor read. */}
        {editState === "none" && !done && (
          <button onClick={() => onAct(r.id, "mark-edited")} disabled={busy === r.id} style={{
            ...quiet, background: "none", border: 0, padding: 0, cursor: "pointer", fontFamily: "inherit",
          }}>I have edited it</button>
        )}
        {editState === "editing" && (
          <a href={editHref} target="_blank" rel="noopener noreferrer" style={quiet}>Open the form again</a>
        )}
        <a href={page} target="_blank" rel="noopener noreferrer" style={quiet}>Open the listing</a>
        {source}

        <span className="inline-flex flex-wrap items-center" style={{ gap: S.sm, marginLeft: "auto" }}>
          {wrong ? (
            <>
              <span style={{ fontSize: F.xs, color: C.warnInk, fontWeight: 700 }}>
                Marked wrong: <span style={{ fontWeight: 400, color: C.muted }}>{seenRecord.reason}</span>
              </span>
              <Btn onClick={() => onAct(r.id, "unmark-wrong")} busy={busy === r.id}>Unmark</Btn>
            </>
          ) : done ? (
            <>
              <span style={{ fontSize: F.xs, color: C.muted, fontWeight: 700 }}>
                {seenRecord?.auto
                  ? <>Resolved automatically: <span style={{ fontWeight: 400 }}>{seenRecord.auto}</span></>
                  : seenRecord?.via === "resolved" ? "Resolved" : "Dismissed"}
              </span>
              <Btn onClick={() => onAct(r.id, "reopen-change")} busy={busy === r.id}>Reopen</Btn>
            </>
          ) : (applied || published || rewritten || editDone(edited)) ? (
            <>
              <Btn onClick={() => onAct(r.id, "resolve-change")} busy={busy === r.id} tone="go">Resolve</Btn>
              <MarkWrong r={r} busy={busy} onAct={onAct} hasDestinations />
            </>
          ) : choosingWrong ? (
            <MarkWrong r={r} busy={busy} onAct={onAct} startArmed onCancel={() => setChoosingWrong(false)} />
          ) : (
            <ConfirmBtn tone="plain" busy={busy === r.id}
              choices={[["Not worth acting on", "dismiss"], ["The monitor got it wrong", "wrong"]]}
              onConfirm={(v) => (v === "wrong" ? setChoosingWrong(true) : onAct(r.id, "dismiss-change"))}>
              Dismiss
            </ConfirmBtn>
          )}
        </span>
      </div>
      {err && !writing && <p style={{ fontSize: F.xs, color: C.badInk, margin: "8px 0 0", lineHeight: 1.5 }}>{err}</p>}
    </div>
  );
}

/*
 * The AI rewrite editor.
 *
 * Proposes on open, then shows every proposed field as old against new, with
 * the sentences that changed marked on both sides, the length before and
 * after, and a textarea holding the proposal so it can be edited before it is
 * accepted. The diff re-renders from the textarea, so what is highlighted is
 * always what would be saved.
 *
 * The steer box goes to the model as the editor's instruction: "work this into
 * the second sentence", "this is minor, one clause only". It outranks the
 * model's own judgement about where the change goes, never the rules about
 * what it may touch.
 *
 * Nothing saves until "Accept and save", and the server re-checks whatever is
 * sent: only one, note and price, and only where they differ.
 */
const REWRITE_FIELDS = ["one", "note", "price"];
const DROP_WHY = {
  protected: "protected, so never written by a rewrite. A monitor-driven change to a caveat, a category or ownership is exactly what this arrangement exists to prevent",
  outside: "not part of a description rewrite",
};

function Sentences({ parts, side }) {
  return (
    <p style={{ fontSize: F.sm, lineHeight: 1.65, margin: 0, color: side === "before" ? C.muted : C.text }}>
      {parts.length === 0 && <span style={{ color: C.dim }}>(empty)</span>}
      {parts.map((p, i) => (p.changed
        ? (
          <span key={i} style={side === "before"
            ? { background: C.badSoft, textDecoration: "line-through", textDecorationColor: C.badInk, borderRadius: 3 }
            : { background: C.accentSoft, color: C.text, borderRadius: 3, boxShadow: `inset 0 -1px 0 ${C.accentEdge}` }}>
            {p.text}
          </span>
        )
        : <span key={i}>{p.text}</span>))}
    </p>
  );
}

function RewriteEditor({ r, busy, onAct, onClose }) {
  const [steer, setSteer] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [include, setInclude] = useState({});
  const [err, setErr] = useState("");

  async function propose(withSteer = steer) {
    setLoading(true); setErr("");
    try {
      const res = await fetch("/api/admin/rewrite", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: r.id, steer: withSteer }),
      });
      if (!res.ok) { setErr(await res.text()); return; }
      const d = await res.json();
      setResult(d);
      setDrafts({ ...d.fields });
      setInclude(Object.fromEntries(Object.keys(d.fields || {}).map((f) => [f, true])));
    } catch {
      setErr("Could not reach the server.");
    } finally { setLoading(false); }
  }

  useEffect(() => { propose(""); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fields = REWRITE_FIELDS.filter((f) => drafts[f] !== undefined);
  const chosen = Object.fromEntries(fields.filter((f) => include[f] && String(drafts[f] || "").trim()).map((f) => [f, drafts[f]]));
  const hasDash = Object.values(chosen).some((v) => /[—–]/.test(v));

  async function save() {
    setErr("");
    const res = await onAct(r.id, "apply-rewrite", {
      fields: chosen,
      proposal: result?.fields || {},
      dropped: result?.dropped || [],
      steer: result?.steer || "",
      provider: result?.provider || "",
      summary: result?.summary || "",
      flag: result?.flag || "",
    });
    if (res?.error) { setErr(res.error); return; }
    onClose();
  }

  return (
    <div style={{
      background: C.raised, border: `1px solid ${C.accentEdge}`, borderRadius: R.card,
      padding: S.lg, marginBottom: S.sm,
    }}>
      <div className="flex flex-wrap items-baseline" style={{ gap: S.sm }}>
        <b style={{ fontSize: F.sm }}>Rewrite the description</b>
        {result?.provider && <span style={{ fontSize: F.xs, color: C.dim }}>drafted by {result.provider}</span>}
        {result?.source && (
          <span style={{ fontSize: F.xs, color: C.dim }}>
            {result.source.read ? "· source page read" : `· ${result.source.note || "source page not read"}`}
          </span>
        )}
      </div>

      {loading && (
        <p style={{ fontSize: F.sm, color: C.muted, margin: "12px 0", lineHeight: 1.6 }}>
          Reading the source page and working the finding into the listing…
        </p>
      )}

      {!loading && result && (
        <>
          {result.summary && (
            <p style={{ fontSize: F.sm, color: C.text, margin: "8px 0 0", lineHeight: 1.55, maxWidth: "74ch" }}>
              {fields.length ? result.summary : <>No change proposed. {result.summary}</>}
            </p>
          )}
          {!fields.length && (
            <p style={{ fontSize: F.xs, color: C.dim, margin: "6px 0 0", lineHeight: 1.5 }}>
              If it is news rather than a change to what the tool is, Publish to What's moving is the right home.
            </p>
          )}

          {fields.map((f) => {
            const before = result.current?.[f] || "";
            const after = drafts[f] || "";
            const d = diffSentences(before, after);
            const g = growth(before, after);
            const grew = g.pct > GROWTH_WARN_PCT;
            return (
              <div key={f} style={{ borderTop: `1px solid ${C.line}`, marginTop: S.md, paddingTop: S.md, opacity: include[f] ? 1 : 0.55 }}>
                <div className="flex flex-wrap items-center" style={{ gap: S.sm }}>
                  <label className="flex items-center" style={{ gap: 6, fontSize: F.xs, fontWeight: 700 }}>
                    <input type="checkbox" checked={Boolean(include[f])}
                      onChange={(e) => setInclude((x) => ({ ...x, [f]: e.target.checked }))} />
                    {f}
                  </label>
                  <span className="tnum" style={{ fontSize: F.xs, color: grew ? C.warnInk : C.dim, fontWeight: grew ? 700 : 400 }}>
                    {g.from} → {g.to} chars ({g.pct >= 0 ? "+" : ""}{g.pct}%)
                    {grew && " · grows the listing"}
                  </span>
                  <span style={{ fontSize: F.xs, color: C.dim }}>
                    {d.changedCount} sentence{d.changedCount === 1 ? "" : "s"} changed
                  </span>
                </div>
                <div className="flex flex-wrap" style={{ gap: S.lg, marginTop: S.sm }}>
                  <div style={{ flex: "1 1 260px", minWidth: 0 }}>
                    <p style={{ fontSize: F.xs, color: C.dim, margin: "0 0 4px", fontWeight: 600 }}>Now</p>
                    <Sentences parts={d.before} side="before" />
                  </div>
                  <div style={{ flex: "1 1 260px", minWidth: 0 }}>
                    <p style={{ fontSize: F.xs, color: C.dim, margin: "0 0 4px", fontWeight: 600 }}>Proposed</p>
                    <Sentences parts={d.after} side="after" />
                  </div>
                </div>
                <textarea value={after} rows={f === "note" ? 5 : 2}
                  onChange={(e) => setDrafts((x) => ({ ...x, [f]: e.target.value }))}
                  aria-label={`Edit the proposed ${f}`}
                  style={{ ...FIELD, resize: "vertical", lineHeight: 1.55, marginTop: S.sm }} />
              </div>
            );
          })}

          {(result.dropped || []).length > 0 && (
            <p style={{ fontSize: F.xs, color: C.dim, margin: `${S.md}px 0 0`, lineHeight: 1.55, maxWidth: "74ch" }}>
              Dropped from the proposal:{" "}
              {result.dropped.map((d, i) => (
                <span key={d.field}>{i > 0 && "; "}<b style={{ color: C.muted }}>{d.field}</b>, {DROP_WHY[d.reason] || d.reason}</span>
              ))}.
            </p>
          )}
          {result.flag && (
            <p style={{ fontSize: F.xs, color: C.warnInk, margin: `${S.sm}px 0 0`, lineHeight: 1.55, maxWidth: "74ch" }}>
              <b>The model flagged the caveat or ownership:</b>{" "}
              <span style={{ color: C.muted }}>{result.flag} If it is right, that is a hand edit to <code>lib/tools.js</code>.</span>
            </p>
          )}
          {hasDash && (
            <p style={{ fontSize: F.xs, color: C.badInk, margin: `${S.sm}px 0 0` }}>
              There is an em-dash or en-dash in the text. Saving will turn it into a comma.
            </p>
          )}
        </>
      )}

      <div style={{ marginTop: S.md }}>
        <label style={{ fontSize: F.xs, color: C.dim, fontWeight: 600, display: "block", marginBottom: 4 }}>
          Steer it (optional)
        </label>
        <textarea value={steer} onChange={(e) => setSteer(e.target.value)} rows={2}
          placeholder="Work this into the second sentence. This is minor, one clause only."
          style={{ ...FIELD, resize: "vertical", lineHeight: 1.55 }} />
      </div>

      <div className="flex flex-wrap items-center mt-3" style={{ gap: S.sm }}>
        <Btn onClick={save} busy={busy === r.id} tone="go" disabled={loading || !Object.keys(chosen).length}>
          Accept and save
        </Btn>
        <Btn onClick={() => propose(steer)} busy={loading}>{steer.trim() ? "Propose again with this" : "Propose again"}</Btn>
        <Btn onClick={onClose}>Cancel</Btn>
      </div>
      <p style={{ fontSize: F.xs, color: C.dim, margin: "8px 0 0", lineHeight: 1.5, maxWidth: "74ch" }}>
        Saves as an override, like a vendor edit, so the file is untouched and Undo restores exactly what was
        there. Every save is logged with this finding in System, AI rewrites.
      </p>
      {err && <p style={{ fontSize: F.xs, color: C.badInk, margin: "8px 0 0", lineHeight: 1.5 }}>{err}</p>}
    </div>
  );
}

/*
 * Suggestions that are not what this directory is for.
 *
 * Collapsed, in System, Records, rather than the Inbox, because they need no decision:
 * the submitter has already been told, clearly and by name, that a merchant
 * app belongs in the Shopify App Store. They are kept because what people
 * arrive expecting to find is worth knowing, and a run of them would say the
 * front page is not being read the way it is written.
 */
function OutOfScope({ rows = [] }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible title="Out of scope" count={rows.length}
      hint="Merchant-facing Shopify apps, classified on whose budget they come out of. Stored, flagged, kept out of the public list, and answered at the time. No action needed.">
      {rows.length === 0
        ? <Empty>Nobody has suggested a merchant app.</Empty>
        : (
          <>
            <button onClick={() => setOpen((v) => !v)} style={{
              background: "none", border: 0, padding: "12px 0 0", cursor: "pointer",
              fontFamily: "inherit", fontSize: F.sm, color: C.muted, textDecoration: "underline",
            }}>{open ? "Hide" : `Show ${rows.length}`}</button>
            {open && rows.map((s) => (
              <Row key={s.id}
                title={s.name}
                tag={s.audience === "merchants" ? "merchant app" : s.audience || "out of scope"}
                tagColor={C.dim}
                body={<>
                  {s.outOfScopeReason && <p style={{ margin: 0, lineHeight: 1.55 }}>{s.outOfScopeReason}</p>}
                  {s.why && <p style={{ margin: "4px 0 0", lineHeight: 1.55, color: C.dim }}>They said: {s.why}</p>}
                </>}
                meta={<>
                  {s.by} · {s.date}
                  {s.url && <> · <a href={outbound(s.url)} target="_blank" rel="noopener noreferrer" style={{ color: C.muted }}>{s.url.replace(/^https?:\/\//, "")}</a></>}
                </>}
              />
            ))}
          </>
        )}
    </Collapsible>
  );
}

/*
 * The suggestion counts, in System, Records: what happened, not what to do.
 *
 * Every figure but one is a counter incremented when the thing happened, read
 * from svt:stats. None is derived from the current list, because the list is
 * where these go to die: a row deleted, capped off the end of 500 or folded
 * into a duplicate takes its own history with it, and a total computed from
 * what is left reads like a total while meaning "the survivors".
 *
 * Pending is the exception and is labelled as such. Received minus everything
 * since would drift the moment two counters got out of step, and it would go
 * negative rather than merely wrong.
 */
function Tallies({ stats = { fields: {} }, rows = [] }) {
  const fields = stats?.fields || {};
  const figures = TALLIES.map(([key, label]) => [label, Number(fields[key]) || 0]);
  const pending = pendingCount(rows || []);
  const anything = figures.some(([, n]) => n > 0);

  return (
    <Collapsible title="Counts" count=""
      hint="Incremented when each thing happened, never recounted from the list. They are allowed to disagree with what is on screen, and when they do these are the ones telling the truth.">
      <div style={{ padding: "12px 0" }}>
        {!anything && (
          <p style={{ fontSize: F.sm, color: C.dim, margin: "0 0 12px", lineHeight: 1.55 }}>
            Nothing counted yet. These start from zero rather than from the rows already stored, so
            anything that happened before this existed is not in them.
          </p>
        )}
        <div className="flex flex-wrap" style={{ gap: S["2xl"] }}>
          <div>
            <p className="tnum" style={{ fontSize: F["2xl"], fontWeight: 800, margin: 0, color: pending ? C.accentInk : C.text }}>{pending}</p>
            <p style={{ fontSize: F.xs, color: C.dim, margin: 0 }}>pending now</p>
          </div>
          {figures.map(([label, n]) => (
            <div key={label}>
              <p className="tnum" style={{ fontSize: F["2xl"], fontWeight: 800, margin: 0, color: n ? C.text : C.dim }}>{n}</p>
              <p style={{ fontSize: F.xs, color: C.dim, margin: 0 }}>{label}</p>
            </div>
          ))}
        </div>
      </div>
    </Collapsible>
  );
}

/*
 * Deleted, not gone.
 *
 * Deleting used to remove the row, which meant the only record that somebody
 * had ever asked for a thing went with it. These keep their text, their
 * submitter and their reasons, and Restore puts one back in the queue exactly
 * as it was.
 */
function Deleted({ rows = [], act, busy }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible title="Deleted" count={rows.length}
      hint="Marked deleted rather than removed. They are out of the queue, out of the public list and out of every count of what is waiting, and they are still here.">
      {rows.length === 0
        ? <Empty>Nothing has been deleted.</Empty>
        : (
          <>
            <button onClick={() => setOpen((v) => !v)} style={{
              background: "none", border: 0, padding: "12px 0 0", cursor: "pointer",
              fontFamily: "inherit", fontSize: F.sm, color: C.muted, textDecoration: "underline",
            }}>{open ? "Hide" : `Show ${rows.length}`}</button>
            {open && rows.map((s) => (
              <Row key={s.id}
                title={s.name}
                tag={kindOf(s.kind).label}
                tagColor={C.dim}
                dim
                body={<>
                  {s.why && <p style={{ margin: 0, lineHeight: 1.55 }}>{s.why}</p>}
                  {s.deletedReason && (
                    <p style={{ margin: "4px 0 0", lineHeight: 1.55, color: C.dim }}>
                      Deleted because: {s.deletedReason}
                    </p>
                  )}
                </>}
                meta={<>
                  suggested by {s.by} · {s.date}
                  {s.deletedAt && <> · deleted {String(s.deletedAt).slice(0, 10)}{s.deletedBy ? ` by ${s.deletedBy}` : ""}</>}
                </>}
                actions={
                  <Btn onClick={() => act("restore-suggestion", s.id)}
                    busy={busy === "restore-suggestion" + s.id} tone="go">Restore</Btn>
                }
              />
            ))}
          </>
        )}
    </Collapsible>
  );
}

/*
 * Competitors named on listed vendors' own comparison pages, that we do not
 * list.
 *
 * Separate from the change alerts above it, and deliberately so: a change alert
 * is a listing that may now be wrong and wants a decision this week. These are
 * leads. Each one needs somebody to open a website and read it, and half will
 * turn out to be dead, renamed, merchant-facing or not a product at all. There
 * is no Apply here and there never will be.
 *
 * Ranked by how many different vendors name the same product, because that is
 * the only signal on the page worth ranking by: one vendor naming a competitor
 * is marketing, three unrelated vendors all positioning against the same thing
 * is a gap in the catalogue.
 */
/*
 * A discovered competitor becomes a suggestion, and then it is a suggestion.
 *
 * The button promotes the finding into the queue and runs the existing research
 * pass on it, and what comes back is rendered by the same `DraftPanel` the
 * Suggestions section uses. There is deliberately no second research path, no
 * second draft editor and no second publish: a name off a comparison page and a
 * name somebody typed into the form differ only in how they arrived, and every
 * step after that is the same work.
 */
/*
 * The three answers that need no research.
 *
 * A name off a comparison page is usually declined for one of these, and the
 * reason is obvious from the name: Apollo.io is a general B2B contact platform,
 * and a product already assessed does not need assessing again. Making each one
 * a button means declining costs a click rather than a decision, which is what
 * keeps the list short enough to stay worth reading.
 */
const DISMISS_REASONS = [
  ["Out of scope", "Not a tool for Shopify app vendors"],
  ["Already listed", "Already in the directory under another name"],
  ["Defunct", "No longer trading"],
];

function Discovered({ discovery = { findings: [] }, onSuggestions, onEntries }) {
  const [state, setState] = useState(discovery);
  const findings = state?.findings || [];
  const dismissed = state?.dismissed || [];
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState("");

  async function runNow() {
    setRunning(true); setResult("");
    try {
      const res = await fetch("/api/cron/discovery", { method: "POST" });
      if (!res.ok) { setResult(await res.text()); return; }
      const d = await res.json();
      setResult(`Read ${d.checked} sites, ${d.withComparisonPages} had comparison pages, ${d.found} names not in the directory. Reload to see them.`);
    } catch {
      setResult("Could not reach the server.");
    } finally { setRunning(false); }
  }

  /*
   * Promoted rows, held here so the draft appears under the finding that
   * produced it. The server also stamps `promotedTo` on the stored finding, so
   * this survives a reload; this state is only what the current page has done.
   */
  const [promoted, setPromoted] = useState({});
  const [working, setWorking] = useState("");
  const [errors, setErrors] = useState({});

  async function decide(action, payload, label) {
    setWorking(label);
    try {
      const res = await fetch("/api/admin", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      if (!res.ok) {
        const msg = await res.text();
        setErrors((e) => ({ ...e, [label]: msg }));
        return;
      }
      setState(await res.json());
    } catch {
      setErrors((e) => ({ ...e, [label]: "Could not reach the server." }));
    } finally { setWorking(""); }
  }

  async function researchFinding(f) {
    setWorking(f.name);
    setErrors((e) => ({ ...e, [f.name]: "" }));
    try {
      const res = await fetch("/api/admin", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "promote-discovery",
          name: f.name, url: f.url, namedBy: f.namedBy, contexts: f.contexts,
        }),
      });
      if (!res.ok) {
        const msg = await res.text();
        setErrors((e) => ({ ...e, [f.name]: msg }));
        return;
      }
      const d = await res.json();
      if (d.suggestions) onSuggestions?.(d.suggestions);

      /* Straight on to the research, so one click does what it says. The row
         exists either way, so a failure here leaves something to retry rather
         than nothing. */
      const r = await fetch("/api/admin/research", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: d.suggestion.id }),
      });
      if (!r.ok) {
        const msg = await r.text();
        setErrors((e) => ({ ...e, [f.name]: `${msg} It is in the inbox as a suggestion either way.` }));
        setPromoted((m) => ({ ...m, [f.name]: d.suggestion }));
        return;
      }
      const researched = await r.json();
      if (researched.suggestions) onSuggestions?.(researched.suggestions);
      setPromoted((m) => ({ ...m, [f.name]: { ...d.suggestion, draft: researched.draft } }));
    } catch {
      setErrors((e) => ({ ...e, [f.name]: "Could not reach the server." }));
    } finally { setWorking(""); }
  }

  const shown = open ? findings : findings.slice(0, 8);

  return (
    <Collapsible title="Discovered competitors"
      count={findings.length}
      hint="Products named on listed vendors' own comparison pages that are not in the directory. Research and draft moves one into the suggestion queue and writes an entry for you to check. Nothing is published without your click."
    >
      <div className="flex flex-wrap items-center" style={{ gap: S.md, padding: "12px 0" }}>
        <Btn onClick={runNow} busy={running} tone="go">Run discovery now</Btn>
        {/* Destructive, so it arms first, like every other removal here. It
            throws away the findings and nothing else: the dismissed set is
            under its own key and those are decisions, not stale data. */}
        <ConfirmBtn onConfirm={() => decide("clear-discovery", {}, "clear")}
          busy={working === "clear"} confirm="Clear the list">
          Clear list
        </ConfirmBtn>
        <span style={{ fontSize: F.xs, color: C.dim }}>
          {state?.at
            ? `Last pass ${String(state.at).slice(0, 16).replace("T", " ")} · read ${state.checked} sites · ${state.withPages} publish comparisons`
            : "Never run. Monthly, on the 1st, once the cron is live."}
        </span>
      </div>

      {/*
        * Why the list is shorter than the pass found. A list that shrank
        * because the work got done reads exactly like one that shrank because
        * the pass found nothing, and those are opposite pieces of news. Only
        * above zero, so it is absent on the ordinary week.
        */}
      {(state?.listedSince > 0 || state?.queuedSince > 0) && (
        <p style={{ fontSize: F.xs, color: C.dim, margin: "0 0 12px", lineHeight: 1.55 }}>
          {[
            state.listedSince > 0 && `${state.listedSince} since listed in the directory`,
            state.queuedSince > 0 && `${state.queuedSince} now in the suggestion queue`,
          ].filter(Boolean).join(" · ")}
          {". Checked against the catalogue and the queue every time this page loads, so a name only "}
          appears here while it is still nobody&apos;s.
        </p>
      )}

      {result && <p style={{ fontSize: F.xs, color: C.accentInk, margin: "0 0 12px", lineHeight: 1.55 }}>{result}</p>}

      {findings.length === 0
        ? <Empty>Nothing found. Most vendors do not publish comparison pages at all.</Empty>
        : (
          <>
            {shown.map((f) => (
              <Row key={f.name}
                title={f.name}
                badges={<>
                  {f.count > 1 && <Pill>named by {f.count}</Pill>}
                  {f.discarded && <Pill tone="warn">previously discarded</Pill>}
                </>}
                body={<>
                  {/* Labelled on the server, against the same rule (lib/discovery.js). */}
                  <DiscardedNote d={f.discarded} />
                  <p style={{ margin: 0, lineHeight: 1.55 }}>
                    Named as a competitor by <b style={{ color: C.text }}>{f.namedBy.join(", ")}</b>, not in the directory.
                  </p>
                  {f.contexts?.length > 0 && (
                    <p style={{ margin: "4px 0 0", lineHeight: 1.5, color: C.dim, fontSize: F.xs }}>
                      {f.contexts.join(" · ")}
                    </p>
                  )}
                </>}
                meta={f.url
                  ? <>
                      <a href={outbound(f.url)} target="_blank" rel="noopener noreferrer" style={{ color: C.muted }}>
                        {f.url.replace(/^https?:\/\//, "")}
                      </a>
                      {/* Found means a link on the page pointed here. Resolved
                          means the model was asked for the domain by name and
                          nothing on the page confirmed it. Different amounts of
                          trust, so they are labelled differently. */}
                      {f.urlSource === "resolved" && (
                        <span style={{ color: C.warnInk }}> · domain resolved from the name, not linked</span>
                      )}
                    </>
                  : "no link on the page and no domain resolved"}
                footer={
                  /*
                   * Two states, not three. A finding that has reached the queue
                   * is gone from this list on the next render, so there is no
                   * "already queued" row to write an affordance for: the draft
                   * panel below is what the current page shows after the click,
                   * and after a reload the item lives in the Inbox and nowhere
                   * else.
                   *
                   * It used to be three, and the third one replaced the whole
                   * action row. So every promoted finding stayed on the list
                   * reading "Already in the suggestion queue" with no way to
                   * remove it, which is how a console ends up with a Dismiss
                   * button nobody can find: it was never missing, it was
                   * behind a branch that had swallowed the page.
                   */
                  promoted[f.name]
                    ? <DraftPanel s={promoted[f.name]} onSuggestions={onSuggestions} onEntries={onEntries} />
                    : <div className="mt-2">
                          <div className="flex flex-wrap items-center" style={{ gap: S.sm }}>
                            {/*
                              * Disabled rather than allowed to fail on click.
                              * Research fetches the vendor's own pages, so with
                              * no URL there is nothing to fetch and pressing it
                              * spent a model call to learn that.
                              */}
                            <Btn onClick={() => researchFinding(f)} busy={working === f.name}
                              tone={f.url ? "go" : undefined} disabled={!f.url}
                              title={f.url ? "" : "No URL to read"}>
                              Research and draft
                            </Btn>
                            {/* The three reasons that need no research are one
                                press each once armed; the value sent is the
                                reason's text, kept with the decision. */}
                            <ConfirmBtn tone="plain" busy={working === `d:${f.name}`}
                              choices={[...DISMISS_REASONS, ["No reason", ""]]}
                              onConfirm={(reason) => decide("dismiss-discovery",
                                { name: f.name, url: f.url, reason }, `d:${f.name}`)}>
                              Dismiss
                            </ConfirmBtn>
                          </div>
                          {!f.url && (
                            <p style={{ fontSize: F.xs, color: C.dim, margin: "8px 0 0", lineHeight: 1.5, maxWidth: "70ch" }}>
                              Nothing linked to it and the domain could not be resolved from the name,
                              so there is no site to read. Find the URL and add it as a suggestion by
                              hand, or dismiss it.
                            </p>
                          )}
                          {errors[f.name] && (
                            <p style={{ fontSize: F.xs, color: C.badInk, margin: "8px 0 0", lineHeight: 1.5 }}>
                              {errors[f.name]}
                            </p>
                          )}
                          {errors[`d:${f.name}`] && (
                            <p style={{ fontSize: F.xs, color: C.badInk, margin: "8px 0 0", lineHeight: 1.5 }}>
                              {errors[`d:${f.name}`]}
                            </p>
                          )}
                        </div>
                }
              />
            ))}
            {findings.length > 8 && (
              <button onClick={() => setOpen((v) => !v)} style={{
                background: "none", border: 0, padding: "12px 0", cursor: "pointer",
                fontFamily: "inherit", fontSize: F.sm, color: C.muted, textDecoration: "underline",
              }}>{open ? "Show fewer" : `Show all ${findings.length}`}</button>
            )}
          </>
        )}

      {/*
        * What was turned down, and why. Collapsed, because it only grows and
        * nothing in it needs a decision, but kept visible because the reason is
        * the part worth having: it is what stops the same name being researched
        * again in six months by somebody who was not here the first time.
        */}
      <Collapsible title="Dismissed" count={dismissed.length}
        hint="Names an editor turned down. They do not come back on later runs. Restore puts one back in the list above.">
        {dismissed.length === 0
          ? <Empty>Nothing turned down yet.</Empty>
          : dismissed.map((d) => (
            <Row key={d.key}
              title={d.name}
              dim
              badges={d.reason ? <Pill>{d.reason}</Pill> : null}
              meta={<>
                {d.url
                  ? <a href={outbound(d.url)} target="_blank" rel="noopener noreferrer" style={{ color: C.muted }}>
                      {d.url.replace(/^https?:\/\//, "")}
                    </a>
                  : "no URL"}
                {d.by ? ` · ${d.by}` : ""}
                {d.at ? ` · ${String(d.at).slice(0, 10)}` : ""}
              </>}
              actions={
                <Btn onClick={() => decide("restore-discovery", { key: d.key }, `r:${d.key}`)}
                  busy={working === `r:${d.key}`}>Restore</Btn>
              }
            />
          ))}
      </Collapsible>
    </Collapsible>
  );
}

/*
 * Posting a vendor's own announcement to What's moving.
 *
 * The feed's only door used to be a monitor finding, which left nothing to
 * publish from for a tool the monitor cannot read: SAMI emailed to say a
 * feature had shipped and there was no row to press Publish on. This is that
 * door, with the feed's rules intact. A person writes the line, the source
 * link is the vendor's page that shows it, the date is when the vendor said
 * it, and the row goes out marked as the vendor's announcement.
 *
 * Two presses, and the first shows exactly what will appear. "Shipped" means
 * seen on the vendor's own site, which is a check to make before pressing:
 * the form says so rather than trusting it to be remembered.
 */
function RecentUpdates({ feed = [], changes = [], sinceVisit = [], monitor = {}, seen = {}, coverage = [], appliedChanges = {}, publishedChanges = {}, rewrittenChanges = {}, editedChanges = {}, verifiedChanges = {}, autoResolved = [], onSeen, eventCoverage = [], eventRefresh = {} }) {
  const tools = useMemo(() => published(ALL_TOOLS).slice().sort((a, b) => a.name.localeCompare(b.name)), []);
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ toolId: "", headline: "", sourceUrl: "", kind: "new-capability", announcedOn: today, sourceNote: "" });
  const [rows, setRows] = useState(feed);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const tool = tools.find((t) => t.id === form.toolId);
  const ready = tool && form.headline.trim().length >= 12 && /^\d{4}-\d{2}-\d{2}$/.test(form.announcedOn);

  async function post(action, id, extra = {}) {
    setBusy(action + id); setErr("");
    try {
      const res = await fetch("/api/admin", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, id, ...extra }),
      });
      if (!res.ok) { setErr(await res.text()); return null; }
      return await res.json();
    } catch { setErr("Could not reach the server."); return null; }
    finally { setBusy(""); }
  }

  async function publish() {
    const d = await post("post-vendor-announcement", form.toolId, {
      headline: form.headline, sourceUrl: form.sourceUrl || tool.url, kind: form.kind,
      announcedOn: form.announcedOn, sourceNote: form.sourceNote,
    });
    if (d?.feedEntry) {
      setRows((r) => [d.feedEntry, ...r]);
      setForm({ toolId: "", headline: "", sourceUrl: "", kind: "new-capability", announcedOn: today, sourceNote: "" });
    }
  }

  /* A vendor row is removed by its own id. A monitor row goes back through the
     finding it came from, so the finding stops saying it is on the feed. */
  async function unpublish(r) {
    const d = r.source === "vendor"
      ? await post("unpublish-announcement", r.id)
      : await post("unpublish-from-feed", r.changeId);
    if (d) setRows((x) => x.filter((y) => y.id !== r.id));
  }

  return (
    <>
      {sinceVisit.length > 0 && (
        <p style={{ fontSize: F.sm, color: C.accentInk, margin: `0 0 ${S["2xl"]}px`, lineHeight: 1.6, fontWeight: 600 }}>
          {sinceVisit.length} monitor finding{sinceVisit.length === 1 ? "" : "s"} since your last visit.
        </p>
      )}
      <ChangeMonitor rows={changes} monitor={monitor} seen={seen} coverage={coverage}
        appliedChanges={appliedChanges} publishedChanges={publishedChanges}
        rewrittenChanges={rewrittenChanges} editedChanges={editedChanges} verifiedChanges={verifiedChanges} autoResolved={autoResolved} onSeen={onSeen} />
      <Section title="Post a vendor announcement"
        hint="News a vendor told us about, by email or on a call, for the listings the monitor cannot see. Published as the vendor's announcement, never as something we observed, and only what has shipped: something announced but not released is said to be in development or not said at all. News the monitor found is published from its finding above.">
      <div style={{ padding: "12px 0" }}>
        <div className="flex flex-wrap" style={{ gap: S.md }}>
          <div style={{ flex: "1 1 220px" }}>
            <Field label="Listing">
              <select value={form.toolId} onChange={(e) => {
                const t = tools.find((x) => x.id === e.target.value);
                setForm((f) => ({ ...f, toolId: e.target.value, sourceUrl: f.sourceUrl || t?.url || "" }));
              }} style={FIELD}>
                <option value="">Choose a tool</option>
                {tools.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </Field>
          </div>
          <div style={{ flex: "1 1 160px" }}>
            <Field label="Kind">
              <select value={form.kind} onChange={(e) => set("kind", e.target.value)} style={FIELD}>
                <option value="new-capability">New capability</option>
                <option value="pricing">Pricing</option>
                <option value="free-tier">Free tier</option>
                <option value="wind-down">Winding down</option>
                <option value="acquisition">Acquired</option>
                <option value="scale">Scale</option>
                <option value="ownership">Ownership</option>
              </select>
            </Field>
          </div>
          <div style={{ flex: "0 1 160px" }}>
            <Field label="Announced on">
              <input type="date" value={form.announcedOn} onChange={(e) => set("announcedOn", e.target.value)} style={FIELD} />
            </Field>
          </div>
        </div>
        <Field label="The update, as it will read on What's moving"
          hint="House voice: what shipped and what it does, no adjectives. Only what is live. Something announced and not released is said to be in development, or left out. No em-dash.">
          <Grow value={form.headline} onChange={(e) => set("headline", e.target.value)} rows={3} />
        </Field>
        <Field label="Source link" hint="The vendor's page that shows it. Shown under the update.">
          <input value={form.sourceUrl} onChange={(e) => set("sourceUrl", e.target.value)} style={FIELD} placeholder="https://" />
        </Field>
        <Field label="Where it came from (private)" hint="For the record, e.g. an email from the founder. Never shown on the site.">
          <input value={form.sourceNote} onChange={(e) => set("sourceNote", e.target.value)} style={FIELD} />
        </Field>
        <div className="flex flex-wrap items-center" style={{ gap: S.sm, marginTop: S.md }}>
          {/* The first press shows exactly what will appear; the second publishes it. */}
          <ConfirmBtn tone="go" onConfirm={publish} busy={busy === "post-vendor-announcement" + form.toolId}
            disabled={!ready} confirm="Publish to What's moving"
            note={tool ? <span style={{ display: "block", borderTop: `1px solid ${C.line}`, paddingTop: S.sm }}>
              <span style={{ display: "block", color: C.dim }}>Will appear on /changes today as {tool.name}, marked as a vendor announcement of {form.announcedOn}:</span>
              <span style={{ display: "block", fontSize: F.md, color: C.text, margin: "6px 0 0", lineHeight: 1.6, maxWidth: "64ch" }}>{form.headline.trim()}</span>
              <span style={{ display: "block", color: C.warnInk, marginTop: 6 }}>
                Anything it calls shipped, check on {(form.sourceUrl || tool.url).replace(/^https?:\/\//, "")} first.
              </span>
            </span> : null}>
            Review before publishing
          </ConfirmBtn>
          {!ready && <span style={{ fontSize: F.xs, color: C.dim }}>Needs a listing, a line of at least a sentence, and a date.</span>}
        </div>
        {err && <p style={{ fontSize: F.xs, color: C.warnInk, margin: "8px 0 0" }}>{err}</p>}
      </div>
      </Section>

      <Reference>
      <Collapsible title="On What's moving" count={rows.length}
        hint="Everything published to the feed, newest first, as visitors see it at /changes. Unpublishing is soft: the row is kept and marked removed.">
        {rows.length === 0
          ? <Empty>Nothing published yet.</Empty>
          : rows.map((r) => {
            const vendor = r.source === "vendor" || r.source === "mention";
            const canRemove = vendor || r.changeId;
            const action = vendor ? "unpublish-announcement" + r.id : "unpublish-from-feed" + r.changeId;
            return (
              <Row key={r.id} title={r.toolName}
                tag={r.source === "mention" ? `mentioned by ${r.mentionAuthor || "someone"} on ${MENTION_SOURCE[r.mentionSource] || r.mentionSource}` : vendor ? `vendor announcement ${r.announcedOn || ""}` : "from the monitor"}
                body={r.headline}
                meta={<>
                  published {String(r.date || "").slice(0, 10)}{r.publishedBy ? ` by ${r.publishedBy}` : ""}
                  {r.sourceNote ? ` \u00b7 ${r.sourceNote}` : ""}
                  {" \u00b7 "}<a href={`/changes#${r.id}`} style={{ color: C.muted }}>on the feed</a>
                </>}
                actions={canRemove
                  ? <ConfirmBtn onConfirm={() => unpublish(r)} busy={busy === action}>Unpublish</ConfirmBtn>
                  : null}
              />
            );
          })}
      </Collapsible>
      <Collapsible title="Monitor coverage" anchor="coverage" count={uncovered(coverage).length ? `${uncovered(coverage).length} not covered` : coverage.length}
        hint="Every published tool and newsletter, and whether the weekly monitor can actually read it. A listing it cannot see produces no findings, which looks exactly like a listing with nothing new, so silence only means something for the ones marked Monitored.">
        <CoverageList rows={coverage} />
      </Collapsible>
      <EventCoverage rows={eventCoverage} refresh={eventRefresh} />
      </Reference>
    </>
  );
}

/*
 * What the monitor can see, one row per published listing.
 *
 * SAMI shipped a feature while the monitor reported nothing about it, because
 * SAMI refuses our fetches, and an entry the monitor cannot read produces no
 * findings, which is exactly what an entry with nothing new produces. Every
 * listing says which of the two it is here. Rules and states: lib/coverage.js.
 *
 * Not an alert and not a queue. A blocked site is usually a WAF that dislikes
 * the datacentre range a serverless function runs in; the remedy is a page it
 * does let us read (a changelog, a blog, a feed) declared as `changelogUrl`,
 * or accepting the gap and leaving its news to vendor announcements. The flag
 * clears itself on the next good read.
 */
function CoverageList({ rows = [] }) {
  const [showAll, setShowAll] = useState(false);
  const [run, setRun] = useState("");
  if (!rows.length) return <Empty>No coverage recorded yet. It fills in after the next monitor run.</Empty>;
  const f = { active: rows.filter((r) => r.feed?.state === "active").length, stale: rows.filter((r) => r.feed?.state === "stale").length };
  const blockedCovered = rows.filter((r) => r.state === "blocked" && r.feed?.state === "active").map((r) => r.name);
  async function findFeeds() {
    setRun("running");
    try {
      const res = await fetch("/api/cron/monitor?only=feeds", { method: "POST" });
      const d = res.ok ? await res.json() : null;
      setRun(d ? `${d.feeds.checked} checked: ${d.feeds.active} active, ${d.feeds.stale} stale, ${d.feeds.undated} undated, ${d.feeds.none} none. Blocked and now covered: ${d.feeds.blockedCovered.join(", ") || "none"}. Reload to see them.` : `Failed: HTTP ${res.status}`);
    } catch { setRun("Could not reach the server."); }
  }
  const feedsLine = (
    <p style={{ fontSize: F.sm, color: C.muted, margin: `0 0 ${S.md}px`, lineHeight: 1.6 }}>
      Feeds and changelogs: {f.active} active, {f.stale} stale, {rows.length - f.active - f.stale} none.
      {blockedCovered.length ? ` Blocked homepages covered by a feed: ${blockedCovered.join(", ")}.` : ""}{" "}
      <Btn onClick={findFeeds} busy={run === "running"}>Find feeds now</Btn>
      {run && run !== "running" && <span style={{ fontSize: F.xs, marginLeft: S.sm }}>{run}</span>}
    </p>
  );
  const listingHref = (r) => (r.kind === "newsletter" ? `/newsletters/${r.id}` : `/tools/${r.id}`);
  const watched = rows.filter((r) => r.state === "monitored" && !r.partial && !r.stale);
  const rest = rows.filter((r) => !watched.includes(r));
  const row = (r) => {
    const bad = r.state !== "monitored";
    return (
      <Row key={r.kind + r.id}
        title={r.name}
        tag={COVERAGE_LABEL[r.state] + (r.partial ? ", in part" : "") + (r.stale ? ", stale" : "")}
        tagColor={bad || r.stale ? C.warnInk : C.muted}
        badges={r.kind !== "tool" ? <Pill>{r.kind}</Pill> : null}
        body={r.detail || null}
        meta={<>
          {r.lastRead ? `last read ${String(r.lastRead).slice(0, 10)}` : "never read"}
          {r.since ? ` \u00b7 blocked since ${String(r.since).slice(0, 10)}` : ""}
          {` \u00b7 watches ${r.declared.join(", ")}`}
          {` \u00b7 ${r.feed ? (r.feed.state === "active" ? `${r.feed.type || "feed"} active, newest ${r.feed.newest}` : r.feed.state === "stale" ? `${r.feed.type || "feed"} stale, newest ${r.feed.newest}` : r.feed.state === "undated" ? `${r.feed.type || "page"} found, undated` : "no feed found") : "feeds not checked yet"}`}
          {r.feed?.url ? <>{" \u00b7 "}<a href={r.feed.url} target="_blank" rel="noopener noreferrer" style={{ color: C.muted }}>{r.feed.how || "feed"}</a></> : null}
          {" \u00b7 "}<a href={listingHref(r)} style={{ color: C.muted }}>open the entry</a>
        </>}
      />
    );
  };
  return (
    <>
      {feedsLine}
      {rest.length === 0
        ? <Empty>Every listing was read in full on its last run.</Empty>
        : rest.map(row)}
      {watched.length > 0 && (
        <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: S.md }}>
          <button onClick={() => setShowAll((v) => !v)} style={{
            background: "none", border: 0, padding: 0, cursor: "pointer", fontFamily: "inherit",
            fontSize: F.sm, color: C.muted, textDecoration: "underline",
          }}>
            {showAll ? "Hide" : `${watched.length} read in full on the last run`}
          </button>
          {showAll && watched.map(row)}
        </div>
      )}
    </>
  );
}

/* The one sentence under the monitor's own summary, so a quiet run is never
   read as a clean bill for listings it could not see. */
function CoverageLine({ rows = [] }) {
  if (!rows.length) return null;
  const c = coverageCounts(rows);
  const out = uncovered(rows);
  return (
    <p style={{ fontSize: F.xs, color: out.length ? C.warnInk : C.dim, margin: "0 0 12px", lineHeight: 1.55, maxWidth: "76ch" }}>
      {`The monitor can read ${c.monitored} of ${c.total} listings`}
      {c.partial ? `, ${c.partial} of them only in part` : ""}
      {out.length
        ? `. Not covered, so silence about them means nothing: ${out.map((r) => `${r.name} (${COVERAGE_LABEL[r.state].toLowerCase()}${r.stale ? ", stale" : ""})`).join(", ")}. Monitor coverage, at the foot of this tab, has each one.`
        : "."}
    </p>
  );
}
