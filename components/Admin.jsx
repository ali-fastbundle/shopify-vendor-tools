"use client";

import React, { useState, useEffect, useMemo } from "react";
import { outbound } from "@/lib/outbound";
import { C, S, R, F, TRACK, ink, ALL_TOOLS, CATEGORIES, SOCIALS, catOf, kindOf, reportKindOf } from "@/lib/tools";
import { ALL_NEWSLETTERS } from "@/lib/newsletters";
import { ALL_COMMUNITIES } from "@/lib/communities";
import { ALL_PODCASTS } from "@/lib/podcasts";
import { ALL_EVENTS } from "@/lib/events";
import { drafted, published, readiness } from "@/lib/drafts";
import { timesAsked, findDiscarded, normaliseDomain } from "@/lib/suggestions";
import { TALLIES, pendingCount } from "@/lib/tallies";
import { diffSentences, growth, GROWTH_WARN_PCT } from "@/lib/sentencediff";
import { effectiveConfidence, errorRates, CAP, VERIFICATION_LABEL } from "@/lib/findings";
import { Pill } from "./Pill";
import { EXCLUSION_REASONS } from "@/lib/reviews";
import { ThemeToggle } from "./Theme";

/*
 * Admin console.
 *
 * The server component above this has already checked ADMIN_EMAILS. This is the
 * view, not the gate, and every button posts to /api/admin which re-checks on
 * its own.
 *
 * ------------------------------------------------------------------
 *  Four tabs, ordered by whether there is anything to do
 * ------------------------------------------------------------------
 * This page grew one panel at a time until it was thirteen headings in a
 * column and the only way to find the two things that needed a decision was to
 * scroll past eleven that did not. The order now is: what is waiting on you,
 * what the directory contains, who the people are, and how the machinery is
 * doing.
 *
 * Inbox is first and is the default because it is the only tab with a deadline.
 * Its count is in the tab label so the answer to "is there anything for me" is
 * visible without clicking, and when it is zero it says so in one line rather
 * than rendering four empty panels.
 *
 * Every list on every tab is the same `Row`. Before this, each panel had
 * invented its own arrangement of a bold name, a coloured word and a grey date,
 * and no two were quite alike. Every destructive button is a `ConfirmBtn`,
 * because revoking a claim and dismissing a report are both one click from a
 * thing you cannot get back.
 *
 * The palette and the type scale are the public site's, from lib/tools.js.
 * There is no second design language here.
 */

const TABS = [
  ["inbox", "Inbox"],
  ["catalogue", "Catalogue"],
  ["people", "People"],
  /* Audience is not system health. Tool opens, matcher queries and interest
     counts say what visitors are doing, which is a different question from
     whether anything is broken, and mixing them made both harder to read. */
  ["audience", "Audience"],
  ["system", "System"],
];

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
  publishing = { canPublish: false, log: [] },
  maillog = [],
  entries = {},
  dedupelog = [],
  changelog = [],
  monitor = {},
  changesSeen = {},
  interest = {},
  lastVisit = "",
  appliedChanges = {},
  discovery = { findings: [] },
  blocked = [],
  publishedChanges = {},
  rewrittenChanges = {},
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
   * Useful in itself: /admin?tab=people is a link somebody can send. It also
   * makes each tab reachable without a browser, which is how the whole page
   * shipped broken once. Only the default tab server-renders, so a bad
   * reference in Catalogue, People or System is invisible to any check that
   * loads /admin and reads the response.
   */
  const [tab, setTab] = useState(TABS.some(([id]) => id === initialTab) ? initialTab : "inbox");
  const [rows, setRows] = useState(suggestions || []);
  const [claimRows, setClaimRows] = useState(claims || {});
  const [reportRows, setReportRows] = useState(reports || []);
  const [entryRows, setEntryRows] = useState(entries || {});
  const [reviewRows, setReviewRows] = useState(reviewSignals);
  const [seen, setSeen] = useState(changesSeen || {});
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  /* Out of scope never enters the queue: it needs no decision, it was answered
     at submission time, and it would inflate the one count on this page that is
     supposed to mean "there is work here". */
  const deletedRows = rows.filter((s) => s.status === "deleted");
  const live = rows.filter((s) => s.status !== "deleted");
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

  const inboxCount = pending.length + openReports.length + pendingClaims.length + openChanges.length;
  const catalogueCount = Object.keys(entryRows || {}).length + outOfScopeRows.length + deletedRows.length
    + drafted(ALL_TOOLS).length + drafted(ALL_NEWSLETTERS).length + drafted(ALL_COMMUNITIES).length
    + drafted(ALL_PODCASTS).length + drafted(ALL_EVENTS).length;
  const counts = {
    inbox: inboxCount,
    catalogue: catalogueCount,
    people: Object.keys(accounts || {}).length,
    system: 0,
  };

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
              <button key={id} onClick={() => {
                setTab(id);
                /* Keep the URL honest without a navigation, so a reload and a
                   copied link both land where the person is looking. */
                try {
                  const u = new URL(window.location.href);
                  if (id === "inbox") u.searchParams.delete("tab");
                  else u.searchParams.set("tab", id);
                  window.history.replaceState(null, "", u);
                } catch { /* history is not essential to switching tabs */ }
              }} aria-current={on ? "page" : undefined}
                style={{
                  background: "none", border: 0, borderBottom: `2px solid ${on ? C.accent : "transparent"}`,
                  padding: "8px 14px", marginBottom: -1, cursor: "pointer", fontFamily: "inherit",
                  fontSize: F.md, fontWeight: on ? 700 : 500, color: on ? C.text : C.muted,
                }}>
                {label}
                {n > 0 && (
                  <span className="tnum" style={{
                    marginLeft: S.sm, fontSize: F.xs, fontWeight: 700,
                    color: id === "inbox" && n > 0 ? C.accentInk : C.dim,
                  }}>{n}</span>
                )}
              </button>
            );
          })}
        </nav>

        {tab === "inbox" && (
          <Inbox
            pending={[...pending].sort(byDemand)}
            reports={reportRows}
            claims={pendingClaims}
            changes={changelog || []}
            sinceVisit={sinceVisit}
            monitor={monitor}
            seen={seen}
            appliedChanges={appliedChanges || {}}
            publishedChanges={publishedChanges || {}}
            rewrittenChanges={rewrittenChanges || {}}
            verifiedChanges={verifiedChanges || {}}
            discovery={discovery}
            onSeen={setSeen}
            act={act}
            busy={busy}
            onSuggestions={setRows}
            onEntries={setEntryRows}
          />
        )}

        {tab === "catalogue" && (
          <Catalogue
            publishing={publishing}
            holds={holds}
            discards={discards}
            reviewed={[...reviewed].sort(byDemand)}
            entries={entryRows}
            onEntries={setEntryRows}
            onSuggestions={setRows}
            interest={interest || {}}
            outOfScope={outOfScopeRows}
            deleted={deletedRows}
            blocked={blocked || []}
            stats={stats}
            allSuggestions={rows}
            act={act}
            busy={busy}
          />
        )}

        {tab === "people" && (
          <People
            accounts={accounts || {}}
            claims={claimRows}
            verified={verifiedClaims}
            subscribers={subscribers || []}
            subscriberRows={subscriberRows}
            feed={feed}
            reviews={reviewRows}
            act={act}
            busy={busy}
          />
        )}

        {tab === "audience" && (
          <Audience stats={stats} interest={interest || {}} entries={entryRows} recommend={recommend} />
        )}

        {tab === "system" && (
          <System stats={stats} maillog={maillog || []} dedupelog={dedupelog || []} rewriteLog={rewriteLog || []}
            monitorErrors={monitorErrors || []} verifiedChanges={verifiedChanges || {}}
            health={health} blocked={blocked || []} changelog={changelog || []}
            inventory={inventory || []} />
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

function Inbox({ pending = [], reports = [], claims = [], changes = [], sinceVisit = [], monitor = {}, seen = {}, appliedChanges = {}, publishedChanges = {}, rewrittenChanges = {}, verifiedChanges = {}, discovery = { findings: [] }, onSeen, act, busy, onSuggestions, onEntries }) {
  const openReports = reports.filter((r) => r.status === "open");
  const openChanges = changes.filter((r) => !isHandled(r.id, seen, publishedChanges, appliedChanges));
  const nothing = !pending.length && !openReports.length && !claims.length && !openChanges.length;

  /*
   * `nothing` is about deadlines, and discovery findings are not one: they are
   * leads to work through whenever there is time, which is why they are absent
   * from this check and from the count in the tab label.
   *
   * They are not absent from the page, though. The early return used to end
   * before the Discovered panel, so on the ordinary day when nothing is
   * actually waiting, the one list with anything in it was the one you could
   * not reach. Either the panel belongs on this tab or it does not, and the
   * answer cannot depend on whether something else happens to be open.
   */
  if (nothing) {
    return (
      <>
        <section className="pb-10">
          <p style={{ fontSize: F.lg, color: C.muted, margin: 0, lineHeight: 1.6, maxWidth: "62ch" }}>
            Nothing is waiting on you. No suggestions to review, no open reports, no claims to check,
            and no listing changes since your last visit.
          </p>
          <p style={{ fontSize: F.sm, color: C.dim, margin: `${S.md}px 0 0`, lineHeight: 1.6, maxWidth: "62ch" }}>
            The Catalogue tab has the drafts and what is published. The monitor runs on Mondays.
          </p>
        </section>
        <Discovered discovery={discovery} onSuggestions={onSuggestions} onEntries={onEntries} />
      </>
    );
  }

  return (
    <>
      {sinceVisit.length > 0 && (
        <p style={{
          fontSize: F.sm, color: C.accentInk, margin: `0 0 ${S["2xl"]}px`,
          lineHeight: 1.6, fontWeight: 600,
        }}>
          {sinceVisit.length} listing change{sinceVisit.length === 1 ? "" : "s"} since your last visit.
        </p>
      )}

      <Section
        title="Suggestions to review"
        count={pending.length}
        hint="Sorted by how many people asked. Mark reviewed clears the moderation hold so the row is public; it does not create a listing. Research and draft writes one for you to check."
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
      </Section>

      <OpenReports rows={reports} act={act} busy={busy} />

      <Section
        title="Claims to check"
        count={claims.length}
        hint="Started but not proved. They have a token to publish on their own domain; nothing is editable until they do."
      >
        {claims.length === 0
          ? <Empty>No claims waiting.</Empty>
          : claims.map(([toolId, c]) => <ClaimRow key={toolId} toolId={toolId} c={c} act={act} busy={busy} />)}
      </Section>

      <ChangeMonitor rows={changes} monitor={monitor} seen={seen}
        appliedChanges={appliedChanges} publishedChanges={publishedChanges}
        rewrittenChanges={rewrittenChanges} verifiedChanges={verifiedChanges} onSeen={onSeen} />

      <Discovered discovery={discovery} onSuggestions={onSuggestions} onEntries={onEntries} />
    </>
  );
}

function Catalogue({ publishing = { canPublish: false, log: [] }, holds = {}, discards = [], reviewed = [], entries = {}, onEntries, onSuggestions, interest = {}, outOfScope = [], deleted = [], stats = {}, allSuggestions = [], blocked = [], act, busy }) {
  return (
    <>
      <Tallies stats={stats} rows={allSuggestions} />
      <PublishingNote />
      <Drafts publishing={publishing} holds={holds} discards={discards} />
      <NeedsVerifying />
      <PublishedEntries entries={entries} onEntries={onEntries} act={act} busy={busy} />
      <Interest interest={interest} entries={entries} />
      <Collapsible title="Cannot be monitored" count={blocked.length}
        hint="Live sites that refuse our fetches: a 403, a challenge page, or a 200 with nothing readable in it. The monitor has no coverage of these, so their entries only change when somebody edits them by hand.">
        <CannotMonitor rows={blocked} />
      </Collapsible>
      <OutOfScope rows={outOfScope} />
      <Deleted rows={deleted} act={act} busy={busy} />
      <Section title="Reviewed suggestions" count={reviewed.length}
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
      </Section>
    </>
  );
}

function People({ accounts = {}, claims = {}, verified = [], subscribers = [], subscriberRows = [], feed = [], reviews = [], act, busy }) {
  return (
    <>
      <Reviews groups={reviews} act={act} busy={busy} />
      <Section
        title="Verified claims"
        count={verified.length}
        hint="These addresses can edit their listing. Revoke access drops the claim and leaves the published copy as the vendor left it; revoke and revert also restores the editorial original."
      >
        {verified.length === 0
          ? <Empty>No verified claims yet.</Empty>
          : verified.map(([toolId, c]) => <ClaimRow key={toolId} toolId={toolId} c={c} act={act} busy={busy} verified />)}
      </Section>
      <Accounts accounts={accounts} claims={claims} />
      <Subscribers list={subscribers} rows={subscriberRows} />
      <Compose count={subscribers.length} feed={feed} />
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
const MARKER_LABEL = { burst: "in a burst", domain: "same domain as listing" };

function Reviews({ groups = [], act, busy }) {
  const all = groups.flatMap((g) => g.reviews.map((r) => ({ g, r })));
  const open = groups.filter((g) => g.needs > 0);
  const needs = open.reduce((n, g) => n + g.needs, 0);
  const excluded = all.filter(({ r }) => r.excluded);
  const confirmed = all.filter(({ r }) => !r.excluded && r.confirmed && !r.active.length);
  const rest = all.filter(({ r }) => !r.excluded && !r.confirmed && !r.active.length);
  const item = ({ g, r }) => <ReviewItem key={`${g.id}:${r.id}`} g={g} r={r} act={act} busy={busy} showListing />;
  return (
    <>
      <Section title="Reviews to decide" count={needs}
        hint="Reviews carrying a marker nobody has looked at. Markers say look, not exclude. Confirm keeps a review counted and clears what it was raised for; Exclude keeps it on the listing, labelled, and out of the average and the structured-data rating.">
        {open.length === 0
          ? <Empty>{all.length ? "Nothing needs a decision." : "No reviews yet."}</Empty>
          : open.map((g) => <ReviewGroup key={g.id} g={g} act={act} busy={busy} />)}
      </Section>
      {excluded.length > 0 && (
        <Collapsible title="Excluded" count={excluded.length}
          hint="Shown on the listing with the reason, counted nowhere. Unexclude if the call was wrong; the exclusion stays in the review's history.">
          {excluded.map(item)}
        </Collapsible>
      )}
      {confirmed.length > 0 && (
        <Collapsible title="Confirmed" count={confirmed.length}
          hint="Looked at and fine. Not raised again by the marker it was confirmed for; a marker of another kind, or an edit to the text, brings it back.">
          {confirmed.map(item)}
        </Collapsible>
      )}
      {rest.length > 0 && (
        <Collapsible title="Other reviews" count={rest.length} openWhen={false}
          hint="No marker and no decision. The same controls apply.">
          {rest.map(item)}
        </Collapsible>
      )}
    </>
  );
}

/* One listing's open reviews, and the bulk confirm when it has a burst. */
function ReviewGroup({ g, act, busy }) {
  const [armed, setArmed] = useState(false);
  const openReviews = g.reviews.filter((r) => r.active.length);
  const summary = g.average == null ? "no rating shown" : `${g.average} from ${g.counted} counted`;
  return (
    <div style={{ borderTop: `1px solid ${C.line}`, padding: "12px 0 4px" }}>
      <div className="flex flex-wrap items-baseline" style={{ gap: S.sm }}>
        <a href={`/${g.kind === "newsletter" ? "newsletters" : "tools"}/${g.id}`}
          style={{ fontSize: F.lg, fontWeight: 700, color: C.text, textDecoration: "none" }}>{g.name}</a>
        <span className="tnum" style={{ fontSize: F.xs, color: C.dim }}>
          {g.needs} of {g.reviews.length} to decide, {summary}{g.domain ? `, ${g.domain}` : ""}
        </span>
        {g.burst && g.burstOpen.length > 0 && (
          <Pill tone="warn">{g.burst.count} in {BURST_DAYS} days, {g.burst.from} to {g.burst.to}</Pill>
        )}
      </div>
      {g.burstOpen.length > 1 && (
        <div className="flex flex-wrap items-center mt-2" style={{ gap: S.sm }}>
          {armed ? (
            <>
              <Btn tone="go" busy={busy === `confirm-burst${g.id}`}
                onClick={() => { setArmed(false); act("confirm-burst", "", { toolId: g.id }, g.id); }}>
                Confirm {g.burstOpen.length} as genuine
              </Btn>
              <Btn onClick={() => setArmed(false)}>Cancel</Btn>
              <span style={{ fontSize: F.xs, color: C.muted }}>
                Clears the burst marker on each and keeps them counted. A same-domain marker stays.
              </span>
            </>
          ) : (
            <Btn onClick={() => setArmed(true)}>Confirm all {g.burstOpen.length} in this burst</Btn>
          )}
        </div>
      )}
      <div style={{ paddingLeft: S.lg }}>
        {openReviews.map((r) => <ReviewItem key={r.id} g={g} r={r} act={act} busy={busy} />)}
      </div>
    </div>
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
function System({ stats = { fields: {}, queries: [] }, maillog = [], dedupelog = [], rewriteLog = [], monitorErrors = [], verifiedChanges = {}, health, blocked = [], changelog = [], inventory = [] }) {
  return (
    <>
      <StatusStrip health={health} maillog={maillog} blocked={blocked} />

      <Housekeeping inventory={inventory} />

      <Collapsible title="Mail log" count={maillog.length}
        openWhen={maillog.some((r) => !r.ok)}
        hint="Every send attempt, newest first. A send that leaves no row here never happened.">
        <MailLog rows={maillog} />
      </Collapsible>

      <Collapsible title="Test an event" count=""
        hint="Fires a real send through the same dispatcher the routes use, with dummy data, to your address only.">
        <NotificationTest />
      </Collapsible>

      <Collapsible title="Cannot be monitored" count={blocked.length}
        hint="Live sites that refuse our fetches. The monitor has no coverage of these.">
        <CannotMonitor rows={blocked} />
      </Collapsible>

      <Collapsible title="Dedup decisions" count={dedupelog.length}
        hint="Every submission, what it was matched to, and what decided it.">
        <DedupeLog rows={dedupelog} />
      </Collapsible>

      <Section title="Monitor accuracy" count={monitorErrors.length}
        hint="How often each kind of finding was marked wrong, over the findings still in the window. A finding marked wrong is the monitor misreading a page, not a finding that was merely not worth acting on.">
        <MonitorAccuracy rows={changelog} errors={monitorErrors} verified={verifiedChanges} />
      </Section>

      <Collapsible title="AI rewrites" count={rewriteLog.length}
        hint="Every description rewritten with AI, with the finding that prompted it, what the model proposed and what was saved. Newest first.">
        <RewriteLog rows={rewriteLog} />
      </Collapsible>

      <Collapsible title="Changelog archive" count={changelog.length}
        hint="Every monitor finding ever recorded, including the handled ones. The Inbox shows what is still open.">
        <ChangelogArchive rows={changelog} />
      </Collapsible>
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
function StatusStrip({ health, maillog = [], blocked = [] }) {
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
    {
      label: "Coverage",
      bad: false,
      warn: blocked.length > 0,
      value: blocked.length ? `${blocked.length} site${blocked.length === 1 ? "" : "s"} block us` : "every site readable",
      note: "",
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
function Audience({ stats = { fields: {}, queries: [] }, interest = {}, entries = {}, recommend = { runs: [], summary: null } }) {
  return (
    <>
      <RecommenderRuns runs={recommend.runs || []} summary={recommend.summary} />
      <Stats stats={stats} />
      <Interest interest={interest} entries={entries} />
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
      <Section title="Growth recommender" count={summary?.total ?? runs.length}
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
      </Section>
      <Collapsible title="Recommender runs" count={runs.length}>
        {runs.slice(0, 200).map((r) => (
          <Row key={r.id}
            title={r.app?.name || r.handle}
            tag={r.path === "model" ? "" : r.path}
            badges={<a href={r.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: F.xs, color: C.muted }}>{r.handle}</a>}
            body={`Wants: ${r.objective}. ${Number(r.installs).toLocaleString("en-US")} installs, ${r.stage}, budget ${r.budget}. Got: ${(r.picks || []).map((p) => p.name).join(", ")}.`}
            meta={`${String(r.at).slice(0, 16).replace("T", " ")}${r.app?.category ? ` · ${r.app.category}` : ""}${r.app?.rating !== undefined ? ` · ${r.app.rating} from ${r.app.reviews} reviews` : ""}${r.listingRead ? "" : " · listing unread"}${r.provider ? ` · ${r.provider}` : ""}`}
          />
        ))}
      </Collapsible>
    </>
  );
}

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
function Collapsible({ title, count, hint, openWhen = false, children }) {
  const [open, setOpen] = useState(openWhen);
  return (
    <section className="pb-6">
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className="flex flex-wrap items-baseline" style={{
          gap: S.sm, background: "none", border: 0, padding: 0, width: "100%",
          cursor: "pointer", fontFamily: "inherit", textAlign: "left",
        }}>
        <span aria-hidden="true" style={{
          fontSize: F.xs, color: C.dim, width: 10, display: "inline-block",
        }}>{open ? "\u25be" : "\u25b8"}</span>
        <h2 style={{ fontSize: F.xl, fontWeight: 700, margin: 0, letterSpacing: TRACK.tight }}>{title}</h2>
        {count !== "" && count !== undefined && (
          <span className="tnum" style={{ fontSize: F.sm, color: Number(count) > 0 ? C.muted : C.dim }}>{count}</span>
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
function Row({ title, tag, tagColor, badges, meta, body, actions, footer, dim }) {
  return (
    <div style={{ borderTop: `1px solid ${C.line}`, padding: "12px 0", opacity: dim ? 0.55 : 1 }}>
      <div className="flex flex-wrap items-baseline" style={{ gap: S.sm }}>
        <span style={{ fontSize: F.lg, fontWeight: 700 }}>{title}</span>
        {tag && <span style={{ fontSize: F.xs, color: tagColor || C.muted }}>{tag}</span>}
        {badges}
      </div>
      {body && (
        <div style={{ fontSize: F.sm, color: C.muted, lineHeight: 1.55, margin: "4px 0 0", maxWidth: "76ch" }}>
          {body}
        </div>
      )}
      {meta && <p style={{ fontSize: F.xs, color: C.dim, margin: "4px 0 0", lineHeight: 1.5 }}>{meta}</p>}
      {actions && <div className="flex flex-wrap mt-2" style={{ gap: S.sm }}>{actions}</div>}
      {footer}
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
  const color = tone === "go" ? "#00E08A" : tone === "stop" ? "#FF6B8A" : "";
  const off = busy || disabled;
  return (
    <button onClick={onClick} disabled={off} title={title} className="ctl" style={{
      background: busy ? C.subtle : disabled ? "transparent" : color ? color + "1E" : C.panel,
      color: off ? C.dim : color ? ink(color) : C.muted,
      border: `1px solid ${disabled ? C.line : color ? color + "44" : C.edge}`, borderRadius: R.control,
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
function ConfirmBtn({ onConfirm, busy, children, confirm = "Sure?" }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return undefined;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);

  if (busy) return <Btn busy tone="stop">{children}</Btn>;

  return armed ? (
    <span className="inline-flex" style={{ gap: S.xs }}>
      <button onClick={() => { setArmed(false); onConfirm(); }} style={{
        background: "#FF6B8A", color: C.onAccent, border: 0, borderRadius: R.control,
        padding: "4px 12px", fontSize: F.xs, fontWeight: 700, cursor: "pointer",
        fontFamily: "inherit", whiteSpace: "nowrap",
      }}>{confirm}</button>
      <button onClick={() => setArmed(false)} style={{
        background: "transparent", border: `1px solid ${C.edge}`, color: C.dim,
        borderRadius: R.control, padding: "4px 10px", fontSize: F.xs, fontWeight: 600,
        cursor: "pointer", fontFamily: "inherit",
      }}>No</button>
    </span>
  ) : (
    <Btn onClick={() => setArmed(true)} tone="stop">{children}</Btn>
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
    <Section title="Reports and corrections" count={open.length}
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
    </Section>
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
    <Section title="Interest in listed tools" count={rows.length}
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
    </Section>
  );
}
/* ------------------------------------------------------------------ */
/*  What the buttons above actually do                                 */
/*                                                                     */
/*  The button used to say "Approve", which reads like the last step    */
/*  before something appears in the directory. It never was: it clears  */
/*  a moderation hold on a suggestion and nothing else, and people      */
/*  reasonably waited for a listing that was never coming. So the       */
/*  button says what it does, and this says what it does not.           */
/* ------------------------------------------------------------------ */
function PublishingNote() {
  return (
    <section className="pb-10">
      <div style={{
        background: C.raised, border: `1px solid ${C.line}`, borderLeft: `3px solid ${C.accent}`,
        borderRadius: R.card, padding: S.lg,
      }}>
        <h2 style={{ fontSize: F.lg, fontWeight: 700, margin: 0, letterSpacing: TRACK.tight }}>
          Marking a suggestion reviewed does not publish anything
        </h2>
        <p style={{ fontSize: F.sm, color: C.muted, margin: `${S.sm}px 0 0`, lineHeight: 1.6, maxWidth: "76ch" }}>
          It clears the moderation hold, so the suggestion shows in the public list on the site. That
          is all it does. It does not create a listing, and there is no button here that will, because
          a listing needs a <b style={{ color: C.text }}>note</b> and a <b style={{ color: C.text }}>watch</b>,
          and those are editorial writing rather than a state to flip from a web page.
        </p>
        <p style={{ fontSize: F.sm, color: C.muted, margin: `${S.sm}px 0 0`, lineHeight: 1.6, maxWidth: "76ch" }}>
          Publishing is: read the vendor's own site, write the entry in{" "}
          <code style={{ fontSize: F.xs, color: C.text }}>lib/tools.js</code> (or{" "}
          <code style={{ fontSize: F.xs, color: C.text }}>lib/newsletters.js</code>,{" "}
          <code style={{ fontSize: F.xs, color: C.text }}>lib/communities.js</code> for the other
          kinds), give it an <code style={{ fontSize: F.xs, color: C.text }}>updated</code> of the day
          it goes in, and ship. The site-wide date follows on its own. Anything you could not confirm
          on the vendor's own site is{" "}
          <code style={{ fontSize: F.xs, color: C.text }}>verified: false</code>, not a guess written
          as fact.
        </p>
        <p style={{ fontSize: F.sm, color: C.muted, margin: `${S.sm}px 0 0`, lineHeight: 1.6, maxWidth: "76ch" }}>
          <b style={{ color: C.text }}>Copy as entry stub</b> gives you that object with everything the
          suggestion already knows filled in, and the editorial fields left empty for you. Paste it
          into the right file and finish it. It carries{" "}
          <code style={{ fontSize: F.xs, color: C.text }}>draft: true</code>, so a half-written entry
          is invisible to visitors until you delete that line.
        </p>
      </div>
    </section>
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

const FILES = { tool: "lib/tools.js", newsletter: "lib/newsletters.js", group: "lib/communities.js", podcast: "lib/podcasts.js" };

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
  const [mode, setMode] = useState("idle");      // idle | publish | discard | hold | unhold
  const [text, setText] = useState("");
  const [state, setState] = useState({ status: "idle", msg: "", url: "", sha: "", what: "" });
  const sectionClosed = !kindOf(kind).live;
  const file = FILE_OF[kind] || "its source file";
  const reset = () => { setMode("idle"); setText(""); setState({ status: "idle", msg: "", url: "", sha: "", what: "" }); };

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
          ? "It leaves this list when Vercel finishes building, and the reason is kept in Discarded below."
          : "It goes live when Vercel finishes building it, usually a minute or two, and stays in this list until then."}
      </p>
    );
  }

  const busy = state.status === "busy";
  const field = (placeholder) => (
    <input value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} maxLength={200}
      autoFocus style={{
        flex: "1 1 280px", minWidth: 0, fontSize: F.sm, fontFamily: "inherit", color: C.text,
        background: C.bg, border: `1px solid ${C.edge}`, borderRadius: R.control, padding: "4px 8px",
      }} />
  );

  return (
    <div style={{ marginTop: S.md }}>
      {problems.length > 0 && (
        <ul style={{ margin: `0 0 ${S.sm}px`, paddingLeft: S.lg, fontSize: F.xs, color: C.warnInk, lineHeight: 1.5 }}>
          {problems.map((p) => <li key={p}>{p}</li>)}
        </ul>
      )}

      {mode === "idle" && (
        <div className="flex flex-wrap items-center" style={{ gap: S.sm }}>
          <Btn onClick={() => setMode("publish")} tone="go" disabled={!canCommit || problems.length > 0}
            title={!canCommit ? "GITHUB_TOKEN is not set" : problems.length ? "Not ready yet" : "Publish this entry"}>Publish</Btn>
          {hold
            ? <Btn onClick={() => setMode("unhold")}>Move back to drafts</Btn>
            : <Btn onClick={() => setMode("hold")}>Hold</Btn>}
          <Btn onClick={() => setMode("discard")} tone="stop" disabled={!canCommit}
            title={!canCommit ? "GITHUB_TOKEN is not set" : "Remove this draft from the file"}>Discard</Btn>
          {!canCommit && (
            <span style={{ fontSize: F.xs, color: C.dim }}>
              Publish and Discard need a GITHUB_TOKEN in the Vercel environment to commit with. Until then they are hand edits to the file.
            </span>
          )}
          {canCommit && problems.length > 0 && (
            <span style={{ fontSize: F.xs, color: C.dim }}>Fix the items above in the file before publishing.</span>
          )}
        </div>
      )}

      {mode === "publish" && (
        <div className="flex flex-wrap items-center" style={{ gap: S.sm }}>
          <Btn onClick={() => send("publish-file-draft", {}, "publish")} busy={busy} tone="go">Commit to main</Btn>
          <Btn onClick={reset}>Cancel</Btn>
          <span style={{ fontSize: F.xs, color: C.muted }}>
            Removes <code>draft: true</code> from {entry.id} in {file} and sets <code>updated</code> to today. The note and watch above are what goes live.
          </span>
        </div>
      )}

      {mode === "discard" && (
        <div className="flex flex-wrap items-center" style={{ gap: S.sm }}>
          {field("Why it is not being listed, in one line")}
          <Btn onClick={() => send("discard-file-draft", { reason: text }, "discard")} busy={busy} tone="stop"
            disabled={!text.trim()}>Remove from file and commit</Btn>
          <Btn onClick={reset}>Cancel</Btn>
          <span style={{ fontSize: F.xs, color: C.muted, flexBasis: "100%" }}>
            Deletes the {entry.id} entry from {file}, with the reason in the commit message, and keeps the reason and the research in Discarded below.
            Revert the commit to bring it back as a draft.
          </span>
        </div>
      )}

      {mode === "hold" && (
        <div className="flex flex-wrap items-center" style={{ gap: S.sm }}>
          {field("What it is waiting on")}
          <Btn onClick={() => send("hold-draft", { note: text }, "hold")} busy={busy} disabled={!text.trim()}>Put on hold</Btn>
          <Btn onClick={reset}>Cancel</Btn>
          <span style={{ fontSize: F.xs, color: C.muted, flexBasis: "100%" }}>
            Stays a draft and moves to On hold with this note. Nothing is committed and nothing a visitor sees changes.
          </span>
        </div>
      )}

      {mode === "unhold" && (
        <div className="flex flex-wrap items-center" style={{ gap: S.sm }}>
          <Btn onClick={() => send("unhold-draft", {}, "unhold")} busy={busy}>Move back to drafts</Btn>
          <Btn onClick={reset}>Cancel</Btn>
          <span style={{ fontSize: F.xs, color: C.muted }}>Clears the hold note and returns it to the active drafts.</span>
        </div>
      )}

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

const FILE_OF = { tool: "lib/tools.js", newsletter: "lib/newsletters.js", event: "lib/events.js", group: "lib/communities.js", podcast: "lib/podcasts.js" };

/*
 * One draft, shut by default: name, type and the one-line summary. Eleven
 * drafts with every field open was a wall nobody read to the end of.
 *
 * The outcome buttons live only inside the expanded body, after the facts and
 * after the note and the watch in full, so nothing can be published, held or
 * discarded without the text a button cannot check having been on screen.
 */
function DraftRow({ kind, entry, canCommit, build, hold, onHolds, pending }) {
  const [open, setOpen] = useState(false);
  const facts = Object.entries(entry).filter(([key, v]) => !SKIP.includes(key) && factValue(v) !== "");
  return (
    <div style={{ borderTop: `1px solid ${C.line}`, padding: "12px 0" }}>
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} style={{
        display: "block", width: "100%", textAlign: "left", background: "none", border: 0, padding: 0,
        cursor: "pointer", fontFamily: "inherit", color: C.text,
      }}>
        <span className="flex flex-wrap items-baseline" style={{ gap: S.sm }}>
          <span aria-hidden="true" style={{ fontSize: F.xs, color: C.dim, width: 10, display: "inline-block" }}>{open ? "▾" : "▸"}</span>
          <span style={{ fontSize: F.lg, fontWeight: 700 }}>{entry.name}</span>
          <Pill>{kindOf(kind).label}</Pill>
          {!entry.watch && <Pill tone="warn">no watch note</Pill>}
        </span>
        {entry.one && <span style={{ display: "block", fontSize: F.sm, color: C.muted, margin: "4px 0 0 18px", lineHeight: 1.5 }}>{entry.one}</span>}
        {hold && (
          <span style={{ display: "block", fontSize: F.xs, color: C.dim, margin: "4px 0 0 18px", lineHeight: 1.5 }}>
            On hold: {hold.note} · {hold.by} · {String(hold.at || "").slice(0, 10)}
          </span>
        )}
        {pending && (
          <span style={{ display: "block", fontSize: F.xs, color: C.accentInk, margin: "4px 0 0 18px", lineHeight: 1.5 }}>
            {pending.outcome === "discarded" ? "Discarded" : "Published"} in {String(pending.sha).slice(0, 7)} at {String(pending.at).slice(11, 16)} UTC, waiting for Vercel to deploy it. Reload in a minute.
          </span>
        )}
      </button>

      {open && (
        <div style={{ margin: "8px 0 0 18px", fontSize: F.sm, color: C.muted, maxWidth: "76ch" }}>
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
          {pending
            ? <p style={{ fontSize: F.xs, color: C.muted, margin: `${S.md}px 0 0` }}>
              Already committed{pending.url ? <> (<a href={pending.url} target="_blank" rel="noopener noreferrer" style={{ color: C.muted }}>the commit</a>)</> : ""}. No action until the deploy that removes it from this list.
            </p>
            : <DraftActions kind={kind} entry={entry} canCommit={canCommit} build={build} hold={hold} onHolds={onHolds} />}
        </div>
      )}
    </div>
  );
}

function Drafts({ publishing = { canPublish: false, log: [], build: "" }, holds = {}, discards = [] }) {
  const [holdMap, setHoldMap] = useState(holds);
  const rows = SOURCES.flatMap(({ kind, entries }) => drafted(entries).map((entry) => ({ kind, entry })));
  const holdOf = ({ kind, entry }) => holdMap[`${kind}:${entry.id}`] || null;
  /* A draft this build still has, which the log says was committed away: the
     commit exists and the deploy has not landed. Without this a refresh in that
     minute looks exactly like a press that did nothing. */
  const pendingOf = ({ kind, entry }) => (publishing.log || []).find((r) =>
    r.kind === kind && r.id === entry.id && r.sha && (r.outcome === "discarded" || r.outcome === "published" || !r.outcome)) || null;
  const active = rows.filter((r) => !holdOf(r));
  const held = rows.filter((r) => holdOf(r));
  const row = (r) => (
    <DraftRow key={`${r.kind}:${r.entry.id}`} kind={r.kind} entry={r.entry}
      canCommit={publishing.canPublish} build={publishing.build} hold={holdOf(r)} onHolds={setHoldMap} pending={pendingOf(r)} />
  );

  return (
    <>
      <Section
        title="Drafts"
        count={active.length}
        hint="Written but not published, and invisible everywhere a visitor looks. Open one to read it in full and decide: Publish commits it live, Hold parks it below with a note, Discard removes it from the file with a reason that is kept. Read the note and the watch first: that is the part a button cannot check."
      >
        {active.length === 0
          ? <Empty>{held.length ? "Nothing active. Everything still in draft is on hold." : "Nothing in progress. An entry becomes a draft by carrying `draft: true`."}</Empty>
          : active.map(row)}
      </Section>

      {held.length > 0 && (
        <Collapsible title="On hold" count={held.length}
          hint="Still drafts, waiting on something named in the note. Move one back to drafts when it is unblocked.">
          {held.map(row)}
        </Collapsible>
      )}

      {discards.length > 0 && (
        <Collapsible title="Discarded" count={discards.length}
          hint="Drafts removed from their file, with the reason. A suggestion or a discovery that names one is labelled previously discarded. Revert the commit to bring one back; it stops counting as discarded once it is in a file again.">
          {discards.map((d) => (
            <Row key={d.key} title={d.name} tag={kindOf(d.kind).label} dim={!d.standing}
              badges={!d.standing ? <Pill>restored</Pill> : null}
              body={<p style={{ margin: 0, lineHeight: 1.55 }}>{d.reason}</p>}
              meta={`${String(d.at || "").slice(0, 10)} · ${d.by || ""}${d.domain ? ` · ${d.domain}` : ""}${d.sha ? ` · ${d.sha.slice(0, 7)}` : ""}`}
              actions={d.commitUrl ? <a href={d.commitUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: F.xs, color: C.muted }}>Commit</a> : null} />
          ))}
        </Collapsible>
      )}

      {publishing.log?.length > 0 && (
        <Collapsible title="Committed from here" count={publishing.log.length}
          openWhen={publishing.log.slice(0, 5).some((r) => r.outcome === "failed")}
          hint="Every publish, discard and hold made from this panel, newest first, and every one that failed, with the reason it gave.">
          {publishing.log.map((r) => (
            <Row key={`${r.at}-${r.id}`} title={r.name || r.id}
              tag={`${r.kind}, ${r.outcome === "failed" ? `${String(r.action || "").replace(/-file-draft|-draft/, "")} failed` : r.outcome || "published"}`}
              tagColor={r.outcome === "failed" ? C.badInk : undefined}
              body={r.outcome === "failed" ? <p style={{ margin: 0, lineHeight: 1.5 }}>{r.error}</p> : null}
              meta={`${String(r.at).slice(0, 16).replace("T", " ")} · ${r.by}${r.sha ? ` · ${r.sha.slice(0, 7)}` : ""}${r.reason ? ` · ${r.reason}` : ""}`}
              actions={r.url ? <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: F.xs, color: C.muted }}>Commit</a> : null} />
          ))}
        </Collapsible>
      )}
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
                {a.why ? ` — ${a.why}` : ""}
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
 * Compose and send. The count in the confirmation comes from the server render,
 * so it is what the list held when the page loaded — the send itself reads the
 * list again, which is why the result reports its own numbers rather than
 * assuming this one.
 */
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
 */
function Compose({ count, feed = [] }) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState("");
  const [confirming, setConfirming] = useState(false);
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
    setConfirming(false);
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
      setConfirming(false);
    } catch {
      setErr("Could not reach the server.");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="pb-10">
      <h2 style={{ fontSize: F.xl, fontWeight: 700, margin: 0, letterSpacing: TRACK.tight }}>Send to the list</h2>
      <p style={{ fontSize: F.sm, color: C.muted, margin: "4px 0 0", maxWidth: "72ch", lineHeight: 1.55 }}>
        Plain text. An unsubscribe link is appended to every copy automatically, and each
        recipient is sent their own message — nobody sees another subscriber's address.
        Test it on yourself first.
      </p>

      <div className="mt-3 flex flex-col" style={{
        background: C.panel, border: `1px solid ${C.line}`, borderRadius: R.card, padding: S.lg, gap: S.md,
      }}>
        <input
          value={subject}
          onChange={(e) => { setSubject(e.target.value); setConfirming(false); }}
          placeholder="Subject"
          style={{
            background: C.field, border: `1px solid ${C.line}`, borderRadius: R.control,
            padding: S.md, fontSize: F.md, color: C.text, fontFamily: "inherit", width: "100%",
          }}
        />
        <textarea
          value={body}
          onChange={(e) => { setBody(e.target.value); setConfirming(false); }}
          placeholder="Two new tools went into App Store data this week…"
          style={{
            background: C.field, border: `1px solid ${C.line}`, borderRadius: R.control,
            padding: S.md, fontSize: F.md, color: C.text, fontFamily: "inherit",
            width: "100%", minHeight: 170, resize: "vertical", lineHeight: 1.6,
          }}
        />

        {!confirming ? (
          <div className="flex flex-wrap items-center" style={{ gap: S.sm }}>
            <button onClick={draftFromFeed} disabled={!week.length} style={{
              background: C.subtle, border: `1px solid ${C.line}`,
              color: week.length ? C.text : C.dim, borderRadius: R.control, padding: "8px 16px",
              fontSize: F.sm, fontWeight: 600, cursor: week.length ? "pointer" : "default",
              fontFamily: "inherit",
            }}>
              {week.length ? `Draft from this week (${week.length})` : "No recent updates this week"}
            </button>

            <button onClick={() => send(true)} disabled={!ready || Boolean(busy)} style={{
              background: C.subtle, border: `1px solid ${C.line}`,
              color: ready ? C.text : C.dim, borderRadius: R.control, padding: "8px 16px",
              fontSize: F.sm, fontWeight: 600, cursor: ready && !busy ? "pointer" : "default",
              fontFamily: "inherit",
            }}>{busy === "test" ? "Sending…" : "Send test to me"}</button>

            <button onClick={() => { setResult(null); setErr(""); setConfirming(true); }}
              disabled={!ready || Boolean(busy) || count === 0} style={{
                background: ready && count ? C.accent : C.subtle,
                color: ready && count ? C.onAccent : C.dim, border: 0, borderRadius: R.control,
                padding: "8px 16px", fontSize: F.sm, fontWeight: 700,
                cursor: ready && count && !busy ? "pointer" : "default", fontFamily: "inherit",
              }}>Send to the list</button>

            {count === 0 && <span style={{ fontSize: F.xs, color: C.dim }}>Nobody on the list yet.</span>}
          </div>
        ) : (
          <div style={{
            border: `1px solid ${C.badEdge}`, background: C.badSoft,
            borderRadius: R.control, padding: S.lg,
          }}>
            <p style={{ fontSize: F.md, margin: 0, lineHeight: 1.55 }}>
              Send <b>{subject}</b> to <b>{count}</b> {count === 1 ? "address" : "addresses"}?
            </p>
            <p style={{ fontSize: F.xs, color: C.muted, margin: "8px 0 0", lineHeight: 1.55 }}>
              There is no recall once this goes out.
            </p>
            <div className="flex flex-wrap mt-3" style={{ gap: S.sm }}>
              <button onClick={() => send(false)} disabled={Boolean(busy)} style={{
                background: "#FF6B8A", color: C.onAccent, border: 0, borderRadius: R.control,
                padding: "8px 16px", fontSize: F.sm, fontWeight: 700,
                cursor: busy ? "default" : "pointer", fontFamily: "inherit",
              }}>{busy === "send" ? "Sending…" : `Yes, send to ${count}`}</button>
              <button onClick={() => setConfirming(false)} disabled={Boolean(busy)} style={{
                background: "transparent", border: `1px solid ${C.line}`, color: C.muted,
                borderRadius: R.control, padding: "8px 16px", fontSize: F.sm, fontWeight: 600,
                cursor: busy ? "default" : "pointer", fontFamily: "inherit",
              }}>Cancel</button>
            </div>
          </div>
        )}

        {err && <p style={{ fontSize: F.sm, color: C.badInk, margin: 0, lineHeight: 1.55 }}>{err}</p>}
        {result && (
          <p style={{ fontSize: F.sm, color: result.failed ? C.warnInk : C.accentInk, margin: 0, lineHeight: 1.55 }}>
            {result.test
              ? `Test sent to ${result.to}.`
              : `Sent ${result.sent} of ${result.total}.${result.failed ? ` ${result.failed} failed — check the server log.` : ""}`}
          </p>
        )}
      </div>
    </section>
  );
}

/*
 * Corrections sent in from the site. Nothing here has touched the catalogue —
 * /api/report only ever writes to svt:reports — so resolving one means "I have
 * made the change by hand", not "apply this". Dismissed rows stay, because a
 * dismissal is evidence somebody read it.
 */
/*
 * Corrections sent in from the site. Nothing here has touched the catalogue —
 * /api/report only ever writes to svt:reports — so resolving one means "I have
 * made the change by hand", not "apply this". Dismissed rows stay, because a
 * dismissal is evidence somebody read it.
 */
/*
 * Sends a real notification and reports what came back. Its own fetch rather
 * than act(), because the useful answer here is a diagnostic string, not a
 * refreshed list of rows.
 */

const when = (iso) => {
  if (!iso) return "—";
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
    <Section title="Accounts" count={all.length}
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
    </Section>
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
    <Section title="Directory stats" count={totalOpens}
      hint="Tool opens and matcher use only. Page views, referrers and paths are in Vercel Analytics and deliberately not duplicated here. Nothing is tied to a person.">
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
    </Section>
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
              Nothing sent — this event mails nobody by design.
            </p>
          ) : (
            (result.sends || []).map((sd, i) => (
              <p key={i} style={{ fontSize: F.sm, margin: "2px 0", color: sd.ok ? C.accentInk : C.badInk }}>
                {sd.cls} → {sd.to}: {sd.ok ? "ok" : `failed — ${sd.error}`}
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
    <div style={{
      marginTop: S.md, background: C.raised, border: `1px solid ${C.line}`,
      borderLeft: `3px solid ${published ? C.accent : C.edge}`,
      borderRadius: R.card, padding: S.lg,
    }}>
      <div className="flex flex-wrap items-baseline justify-between" style={{ gap: S.sm }}>
        <span style={{ fontSize: F.sm, fontWeight: 700 }}>
          {published ? "Published" : "Draft, not published"}
        </span>
        <span style={{ fontSize: F.xs, color: C.dim }}>
          {draft.researchedBy ? `drafted by ${draft.researchedBy}` : "hand written"}
          {draft.researchedAt ? ` · ${String(draft.researchedAt).slice(0, 16).replace("T", " ")}` : ""}
        </span>
      </div>

      {(draft.pagesRead?.length || draft.pagesFailed?.length) && (
        <p style={{ fontSize: F.xs, color: C.dim, margin: "6px 0 0", lineHeight: 1.5 }}>
          Read: {draft.pagesRead?.join(", ") || "nothing"}
          {draft.pagesFailed?.length ? ` · could not read: ${draft.pagesFailed.join(", ")}` : ""}
        </p>
      )}

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
          <Btn onClick={() => post("unpublish-entry", { id: s.publishedId })}
            busy={busy === "unpublish-entry"} tone="stop">Unpublish</Btn>
        )}
        <CopyStub s={{ ...s, draft }} />
      </div>

      {err && <p style={{ fontSize: F.xs, color: C.badInk, margin: "8px 0 0", lineHeight: 1.5 }}>{err}</p>}
      {note && <p style={{ fontSize: F.xs, color: C.accentInk, margin: "8px 0 0" }}>{note}</p>}
    </div>
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
    <Section
      title="Published from the queue"
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
    </Section>
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
  acquisition: "Acquired", "new-capability": "New capability",
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

function ChangeMonitor({ rows = [], monitor = {}, seen = {}, appliedChanges = {}, publishedChanges = {}, rewrittenChanges = {}, verifiedChanges = {}, onSeen }) {
  const [busy, setBusy] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState("");
  const [dismissed, setDismissed] = useState(seen || {});
  const [applied, setApplied] = useState(appliedChanges || {});
  const [published, setPublished] = useState(publishedChanges || {});
  const [rewritten, setRewritten] = useState(rewrittenChanges || {});
  const [openTool, setOpenTool] = useState("");
  const [showEarlier, setShowEarlier] = useState(false);

  /* Handled means dismissed or resolved. Handled ones leave the Inbox. */
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
   * collapses into "current", which put 90 changes in the Inbox instead of the
   * 8 the last sweep actually found. The whole point of the cap is that the
   * Inbox holds one run.
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
      hint="Proposed by the weekly monitor, grouped by tool. Nothing here has been applied: most belong in Recent updates, a few in the listing, the rest are noise."
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

      {result && <p style={{ fontSize: F.xs, color: C.accentInk, margin: "0 0 12px", lineHeight: 1.55 }}>{result}</p>}

      {groups.length === 0
        ? <Empty>Nothing from the latest run. Most weeks this is the correct answer.</Empty>
        : groups.map((g) => (
          <ToolChanges key={g.id} group={g} openTool={openTool} setOpenTool={setOpenTool}
            applied={applied} published={published} rewritten={rewritten} dismissed={dismissed} verified={verifiedChanges} busy={busy} onAct={mark} />
        ))}

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
              applied={applied} published={published} rewritten={rewritten} dismissed={dismissed} verified={verifiedChanges} busy={busy} onAct={mark} />
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
function ToolChanges({ group, openTool, setOpenTool, applied, published, rewritten, dismissed, verified = {}, busy, onAct }) {
  const expanded = openTool === group.id;
  const [batch, setBatch] = useState("");
  const tool = ALL_TOOLS.find((t) => t.id === group.id);
  const n = group.rows.length;

  async function dismissAll() {
    setBatch("dismiss");
    for (const r of group.rows) {
      if (!dismissed[r.id] && !applied[r.id] && !published[r.id] && !rewritten[r.id]) await onAct(r.id, "dismiss-change");
    }
    setBatch("");
  }

  return (
    <div style={{ borderTop: `1px solid ${C.line}` }}>
      <div className="flex flex-wrap items-center" style={{ gap: S.sm, padding: "12px 0" }}>
        <button onClick={() => setOpenTool(expanded ? "" : group.id)} aria-expanded={expanded}
          className="flex items-center" style={{
            gap: S.sm, background: "none", border: 0, padding: 0, cursor: "pointer",
            fontFamily: "inherit", flex: 1, minWidth: 0, textAlign: "left",
          }}>
          <span aria-hidden="true" style={{ fontSize: F.xs, color: C.dim, width: 10 }}>{expanded ? "\u25be" : "\u25b8"}</span>
          {tool && <AdminLogo tool={tool} />}
          <span style={{ fontSize: F.lg, fontWeight: 700 }}>{group.name}</span>
          <span style={{ fontSize: F.sm, color: C.muted }}>
            {n} change{n === 1 ? "" : "s"}
          </span>
          {group.needsDecision && <Pill tone="warn">listing may need editing</Pill>}
        </button>

        {/* A tool's weekly changes usually share a verdict, so the common one
            is available without opening anything. Publishing is per change
            because each needs a sentence written. */}
        <ConfirmBtn onConfirm={dismissAll} busy={batch === "dismiss"} confirm={`Dismiss all ${n}`}>
          Dismiss all
        </ConfirmBtn>
      </div>

      {expanded && (
        <div style={{ paddingBottom: S.md }}>
          {group.rows.map((r) => (
            <div key={r.id} style={{ borderTop: `1px solid ${C.line}`, padding: "12px 0 4px", paddingLeft: S.lg }}>
              <div className="flex flex-wrap items-baseline" style={{ gap: S.sm }}>
                <span style={{ fontSize: F.xs, fontWeight: 700, color: LOUD.has(r.kind) ? C.warnInk : C.muted }}>
                  {KIND_LABEL[r.kind] || r.kind}
                </span>
                <ConfidenceLine r={r} verified={verified} />
              </div>
              <p style={{ fontSize: F.sm, color: C.text, margin: "6px 0 0", lineHeight: 1.55, maxWidth: "74ch" }}>{r.what}</p>
              {(r.old || r.new) && (
                <p className="tnum" style={{ fontSize: F.sm, color: C.muted, margin: "6px 0 0", lineHeight: 1.55 }}>
                  <span style={{ color: C.dim }}>was</span> {r.old || "absent"}
                  {"  "}<span style={{ color: C.dim }}>now</span> <b style={{ color: C.text }}>{r.new || "absent"}</b>
                </p>
              )}
              {r.why && <p style={{ fontSize: F.xs, color: C.dim, margin: "6px 0 0", lineHeight: 1.5, maxWidth: "74ch" }}>{r.why}</p>}
              <ChangeAction r={r} done={Boolean(dismissed[r.id])} seenRecord={dismissed[r.id]} applied={applied[r.id]}
                published={published[r.id]} rewritten={rewritten[r.id]} busy={busy} onAct={onAct} />
            </div>
          ))}
        </div>
      )}
    </div>
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
function MarkWrong({ r, busy, onAct, hasDestinations }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  if (!open) return <Btn onClick={() => setOpen(true)}>Mark as wrong</Btn>;
  const submit = async () => {
    setErr("");
    const res = await onAct(r.id, "mark-wrong", { reason });
    if (res?.error) setErr(res.error);
  };
  return (
    <div style={{ flexBasis: "100%", marginTop: S.sm }}>
      <div className="flex flex-wrap items-center" style={{ gap: S.sm }}>
        <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} autoFocus
          onKeyDown={(e) => { if (e.key === "Enter" && reason.trim()) submit(); if (e.key === "Escape") setOpen(false); }}
          aria-label="What the monitor got wrong"
          placeholder="What it got wrong, in one line. e.g. annual prices are behind a toggle"
          style={{ ...FIELD, flex: "1 1 320px", width: "auto" }} />
        <Btn onClick={submit} busy={busy === r.id} tone="go" disabled={!reason.trim()}>Mark wrong</Btn>
        <Btn onClick={() => { setOpen(false); setReason(""); }}>Cancel</Btn>
      </div>
      {hasDestinations && (
        <p style={{ fontSize: F.xs, color: C.dim, margin: "6px 0 0", lineHeight: 1.5 }}>
          This resolves the finding but does not undo what was already done with it. Remove it from
          updates or undo the listing change with their own buttons.
        </p>
      )}
      {err && <p style={{ fontSize: F.xs, color: C.badInk, margin: "6px 0 0" }}>{err}</p>}
    </div>
  );
}

/* The same mark the public site uses, at the size this list wants. */
function AdminLogo({ tool, size = 22 }) {
  const [failed, setFailed] = useState(false);
  if (failed || !tool.domain) return null;
  return (
    <img src={tool.logo || `https://www.google.com/s2/favicons?domain=${tool.domain}&sz=64`}
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
function ChangeAction({ r, done, seenRecord, applied, published, rewritten, busy, onAct }) {
  const wrong = seenRecord?.via === "wrong";
  const edit = r.edit || { state: "unmapped" };
  const [writing, setWriting] = useState(false);
  const [rewriting, setRewriting] = useState(false);
  const [headline, setHeadline] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [meta, setMeta] = useState(null);
  const [err, setErr] = useState("");

  const openListing = (
    <a href={`/tools/${encodeURIComponent(r.entryId)}`} target="_blank" rel="noopener noreferrer"
      style={{
        background: "transparent", border: `1px solid ${C.edge}`, color: C.muted,
        borderRadius: R.control, padding: "4px 12px", fontSize: F.xs, fontWeight: 600,
        textDecoration: "none", whiteSpace: "nowrap",
      }}>Open the listing</a>
  );

  const source = r.url && (
    <a href={outbound(r.url)} target="_blank" rel="noopener noreferrer"
      style={{ fontSize: F.xs, color: C.muted }}>{r.url.replace(/^https?:\/\//, "")}</a>
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
          It may still be worth publishing to Recent updates, rewriting the description, or both.
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
            <Btn onClick={publish} busy={busy === r.id || drafting} tone="go">Publish to Recent updates</Btn>
            <Btn onClick={startDraft} busy={drafting}>Draft again</Btn>
            <Btn onClick={() => { setWriting(false); setErr(""); }}>Cancel</Btn>
          </div>
          {err && <p style={{ fontSize: F.xs, color: C.badInk, margin: "8px 0 0", lineHeight: 1.5 }}>{err}</p>}
        </div>
      )}

      {rewriting && !rewritten && (
        <RewriteEditor r={r} busy={busy} onAct={onAct} onClose={() => setRewriting(false)} />
      )}

      <div className="flex flex-wrap items-center" style={{ gap: S.sm }}>
        {/*
          * Three destinations, and the feed is first because it is where most
          * findings belong. A new integration is news; it is not a change to
          * what the tool is, and forcing it into the listing is how a
          * description turns into an undated changelog.
          */}
        {published ? (
          <>
            <span style={{ fontSize: F.xs, color: C.accentInk, fontWeight: 700 }}>
              In Recent updates {String(published.at || "").slice(0, 10)}
            </span>
            <ConfirmBtn onConfirm={() => onAct(r.id, "unpublish-from-feed")} busy={busy === r.id}
              confirm="Remove">Remove from updates</ConfirmBtn>
          </>
        ) : !writing && (
          <Btn onClick={startDraft} busy={drafting} tone="go">
            Publish to Recent updates
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

        {/*
          * Rewrite with AI, for the findings that do not land on one field. A
          * destination like the other two and not exclusive with either: a new
          * capability is usually news and a description change.
          */}
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

        {openListing}
        {source}

        {/*
          * Resolved once, after every destination it needed. Dismiss stays for
          * the findings that needed none, and is not offered once one was used,
          * because "looked and did nothing" and "did something" should not be
          * indistinguishable afterwards.
          */}
        {wrong ? (
          <>
            <span style={{ fontSize: F.xs, color: C.warnInk, fontWeight: 700 }}>
              Marked wrong: <span style={{ fontWeight: 400, color: C.muted }}>{seenRecord.reason}</span>
            </span>
            <Btn onClick={() => onAct(r.id, "unmark-wrong")} busy={busy === r.id}>Unmark</Btn>
          </>
        ) : (applied || published || rewritten)
          ? (done
            ? (
              <>
                <span style={{ fontSize: F.xs, color: C.muted, fontWeight: 700 }}>Resolved</span>
                <Btn onClick={() => onAct(r.id, "reopen-change")} busy={busy === r.id}>Reopen</Btn>
              </>
            )
            : <Btn onClick={() => onAct(r.id, "resolve-change")} busy={busy === r.id} tone="go">Resolve</Btn>)
          : (done
            ? <Btn onClick={() => onAct(r.id, "reopen-change")} busy={busy === r.id}>Reopen</Btn>
            : <ConfirmBtn onConfirm={() => onAct(r.id, "dismiss-change")} busy={busy === r.id}>Dismiss</ConfirmBtn>)}

        {/* On every finding that is not already marked: being wrong is
            independent of what was done with it. */}
        {!wrong && <MarkWrong r={r} busy={busy} onAct={onAct} hasDestinations={Boolean(applied || published || rewritten)} />}
      </div>
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
              If it is news rather than a change to what the tool is, Publish to Recent updates is the right home.
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
 * Collapsed, in Catalogue rather than Inbox, because they need no decision:
 * the submitter has already been told, clearly and by name, that a merchant
 * app belongs in the Shopify App Store. They are kept because what people
 * arrive expecting to find is worth knowing, and a run of them would say the
 * front page is not being read the way it is written.
 */
function OutOfScope({ rows = [] }) {
  const [open, setOpen] = useState(false);
  return (
    <Section title="Out of scope" count={rows.length}
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
    </Section>
  );
}

/*
 * The counts, at the top of the tab that is about what the directory holds.
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
    <section className="pb-10">
      <div className="flex flex-wrap items-baseline" style={{ gap: S.sm }}>
        <h2 style={{ fontSize: F.xl, fontWeight: 700, margin: 0, letterSpacing: TRACK.tight }}>Counts</h2>
      </div>
      <p style={{ fontSize: F.sm, color: C.muted, margin: "4px 0 0", maxWidth: "72ch", lineHeight: 1.55 }}>
        Incremented when each thing happened, never recounted from the list. They are allowed to
        disagree with what is on screen, and when they do these are the ones telling the truth.
      </p>
      <div className="mt-3" style={{
        background: C.panel, border: `1px solid ${C.line}`, borderRadius: R.card, padding: S.lg,
      }}>
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
    </section>
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
    <Section title="Deleted" count={rows.length}
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
    </Section>
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
  const [arming, setArming] = useState("");
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
      setArming("");
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
    <Section
      title="Discovered competitors"
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
                            {arming === f.name ? (
                              <>
                                <span style={{ fontSize: F.xs, color: C.dim }}>Why?</span>
                                {DISMISS_REASONS.map(([label, reason]) => (
                                  <Btn key={label} busy={working === `d:${f.name}`}
                                    onClick={() => decide("dismiss-discovery",
                                      { name: f.name, url: f.url, reason }, `d:${f.name}`)}>
                                    {label}
                                  </Btn>
                                ))}
                                <Btn onClick={() => decide("dismiss-discovery",
                                  { name: f.name, url: f.url, reason: "" }, `d:${f.name}`)}>
                                  No reason
                                </Btn>
                                <Btn onClick={() => setArming("")}>Cancel</Btn>
                              </>
                            ) : (
                              <Btn onClick={() => setArming(f.name)}>Dismiss</Btn>
                            )}
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
    </Section>
  );
}

/*
 * Entries the monitor has no coverage of.
 *
 * Not an alert and not a queue. A blocked site is live, healthy and refusing
 * our requests, usually because a WAF does not like the datacentre range a
 * serverless function runs in, and no user agent changes that. Reported once
 * here rather than every Monday as "unreachable", because the useful sentence
 * is "we are not watching these three" and it only needs saying when the list
 * changes.
 *
 * The flag clears itself: one successful read and the entry drops off this
 * list without anybody tidying up.
 */
function CannotMonitor({ rows = [] }) {
  if (!rows.length) return <Empty>Every listed site lets the monitor read it.</Empty>;
  return (
    <>
      {rows.map((b) => {
        const tool = ALL_TOOLS.find((t) => t.id === b.id);
        return (
          <Row key={b.id}
            title={tool ? tool.name : b.id}
            tag={tool ? catOf(tool.cat).label : ""}
            tagColor={tool ? ink(catOf(tool.cat).color) : C.muted}
            badges={<Pill tone="warn">no coverage</Pill>}
            body={b.why}
            meta={<>
              {b.since ? `blocked since ${String(b.since).slice(0, 10)}` : "blocked"}
              {tool && <> {"\u00b7"} <a href={`/tools/${tool.id}`} style={{ color: C.muted }}>open the entry</a></>}
            </>}
          />
        );
      })}
    </>
  );
}
