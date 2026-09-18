"use client";

import React, { useState, useEffect, useMemo } from "react";
import { outbound } from "@/lib/outbound";
import { C, S, R, F, TRACK, ink, ALL_TOOLS, CATEGORIES, SOCIALS, catOf, kindOf, reportKindOf } from "@/lib/tools";
import { ALL_NEWSLETTERS } from "@/lib/newsletters";
import { ALL_COMMUNITIES } from "@/lib/communities";
import { drafted } from "@/lib/drafts";
import { timesAsked } from "@/lib/suggestions";
import { TALLIES, pendingCount } from "@/lib/tallies";
import { Pill } from "./Pill";
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
  ["system", "System"],
];

export default function AdminPanel({
  email, suggestions, claims, subscribers, reports, accounts, stats, maillog,
  entries, dedupelog, changelog, monitor, changesSeen, interest, lastVisit, appliedChanges,
}) {
  const [tab, setTab] = useState("inbox");
  const [rows, setRows] = useState(suggestions || []);
  const [claimRows, setClaimRows] = useState(claims || {});
  const [reportRows, setReportRows] = useState(reports || []);
  const [entryRows, setEntryRows] = useState(entries || {});
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

  const openChanges = (changelog || []).filter((r) => !seen[r.id]);
  /* "Since your last visit" is computed against the value the server rendered
     with, which is the visit before this one: the stamp below updates after. */
  const sinceVisit = lastVisit
    ? openChanges.filter((r) => String(r.at || "") > String(lastVisit))
    : openChanges;

  /* Most asked first, everywhere a queue is shown. Demand decides order. */
  const byDemand = (a, b) => timesAsked(b) - timesAsked(a);

  const inboxCount = pending.length + openReports.length + pendingClaims.length + openChanges.length;
  const catalogueCount = Object.keys(entryRows || {}).length + outOfScopeRows.length + deletedRows.length
    + drafted(ALL_TOOLS).length + drafted(ALL_NEWSLETTERS).length + drafted(ALL_COMMUNITIES).length;
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
    } catch {
      setErr("Could not reach the server.");
    } finally {
      setBusy("");
    }
  }

  return (
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
              <button key={id} onClick={() => setTab(id)} aria-current={on ? "page" : undefined}
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
            onSeen={setSeen}
            act={act}
            busy={busy}
            onSuggestions={setRows}
            onEntries={setEntryRows}
          />
        )}

        {tab === "catalogue" && (
          <Catalogue
            reviewed={[...reviewed].sort(byDemand)}
            entries={entryRows}
            onEntries={setEntryRows}
            onSuggestions={setRows}
            interest={interest || {}}
            outOfScope={outOfScopeRows}
            deleted={deletedRows}
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
            act={act}
            busy={busy}
          />
        )}

        {tab === "system" && (
          <System stats={stats} maillog={maillog || []} dedupelog={dedupelog || []} />
        )}

        <div style={{ height: 60 }} />
      </div>
    </main>
  );
}

/* ================================================================== */
/*  Tabs                                                               */
/* ================================================================== */

function Inbox({ pending, reports, claims, changes, sinceVisit, monitor, seen, appliedChanges, onSeen, act, busy, onSuggestions, onEntries }) {
  const openReports = reports.filter((r) => r.status === "open");
  const openChanges = changes.filter((r) => !seen[r.id]);
  const nothing = !pending.length && !openReports.length && !claims.length && !openChanges.length;

  if (nothing) {
    return (
      <section className="pb-10">
        <p style={{ fontSize: F.lg, color: C.muted, margin: 0, lineHeight: 1.6, maxWidth: "62ch" }}>
          Nothing is waiting on you. No suggestions to review, no open reports, no claims to check,
          and no listing changes since your last visit.
        </p>
        <p style={{ fontSize: F.sm, color: C.dim, margin: `${S.md}px 0 0`, lineHeight: 1.6, maxWidth: "62ch" }}>
          The Catalogue tab has the drafts and what is published. The monitor runs on Mondays.
        </p>
      </section>
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
        appliedChanges={appliedChanges} onSeen={onSeen} />
    </>
  );
}

function Catalogue({ reviewed, entries, onEntries, onSuggestions, interest, outOfScope, deleted, stats, allSuggestions, act, busy }) {
  return (
    <>
      <Tallies stats={stats} rows={allSuggestions} />
      <PublishingNote />
      <Drafts />
      <PublishedEntries entries={entries} onEntries={onEntries} act={act} busy={busy} />
      <Interest interest={interest} entries={entries} />
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

function People({ accounts, claims, verified, subscribers, act, busy }) {
  return (
    <>
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
      <Subscribers list={subscribers} />
      <Compose count={subscribers.length} />
    </>
  );
}

function System({ stats, maillog, dedupelog }) {
  return (
    <>
      <MailLog rows={maillog} />
      <NotificationTest />
      <Stats stats={stats || { fields: {}, queries: [] }} />
      <DedupeLog rows={dedupelog} />
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

function Btn({ onClick, busy, tone, children }) {
  const color = tone === "go" ? "#00E08A" : tone === "stop" ? "#FF6B8A" : "";
  return (
    <button onClick={onClick} disabled={busy} style={{
      background: busy ? C.subtle : color ? color + "1E" : "transparent",
      color: busy ? C.dim : color ? ink(color) : C.muted,
      border: `1px solid ${color ? color + "44" : C.edge}`, borderRadius: R.control,
      padding: "4px 12px", fontSize: F.xs, fontWeight: 600,
      cursor: busy ? "default" : "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
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

function OpenReports({ rows, act, busy }) {
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
function Interest({ interest, entries }) {
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

const FILES = { tool: "lib/tools.js", newsletter: "lib/newsletters.js", group: "lib/communities.js" };

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
/*  Drafts                                                             */
/*                                                                     */
/*  Written, not published. Every catalogue contributes its own drafts  */
/*  here, so a new entry kind shows up in this panel by being added to  */
/*  SOURCES rather than by anyone remembering to render it.             */
/*                                                                     */
/*  There is no Publish button. Publishing is deleting `draft: true` in */
/*  the source file, because the thing that makes an entry ready is the */
/*  note and the watch being right, and that is a judgement made while  */
/*  editing the file rather than a state to flip from a web page.       */
/* ------------------------------------------------------------------ */

const SOURCES = [
  { kind: "tool", entries: ALL_TOOLS },
  { kind: "newsletter", entries: ALL_NEWSLETTERS },
  { kind: "group", entries: ALL_COMMUNITIES },
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

function Drafts() {
  const rows = SOURCES.flatMap(({ kind, entries }) =>
    drafted(entries).map((entry) => ({ kind, entry })));

  /* Grouped by type, because "what is half written" is usually asked about one
     kind at a time: the newsletters are a batch, the communities are a batch. */
  const byKind = SOURCES.map(({ kind }) => ({
    kind,
    label: kindOf(kind).label,
    items: rows.filter((r) => r.kind === kind),
  })).filter((g) => g.items.length);

  return (
    <Section
      title="Drafts"
      count={rows.length}
      hint="Written but not published: absent from the grid, the search, the matcher, every count, the share card and every API response. Publish by deleting `draft: true` from the entry in its source file, and give it an `updated` of the day it goes live."
    >
      {rows.length === 0
        ? <Empty>Nothing in progress. An entry becomes a draft by carrying `draft: true`.</Empty>
        : byKind.map((group) => (
          <div key={group.kind}>
            <p style={{
              fontSize: F.xs, color: ink(kindOf(group.kind).color), fontWeight: 700,
              margin: `${S.lg}px 0 0`, textTransform: "uppercase", letterSpacing: "0.04em",
            }}>{group.label} · {group.items.length}</p>
            {group.items.map(({ kind, entry }) => {
              const facts = Object.entries(entry)
                .filter(([key, v]) => !SKIP.includes(key) && factValue(v) !== "");
              return (
                <Row key={`${kind}:${entry.id}`}
                  title={entry.name}
                  badges={<>
                    <span style={{ fontSize: F.xs, color: C.dim }}>{entry.id}</span>
                    {/* A positive tag. Absent means nothing is rendered: a
                        publication that is not about Shopify is not thereby
                        worse, and a "not Shopify-specific" note would read as
                        one. */}
                    {entry.shopifySpecific && <Pill>Shopify-specific</Pill>}
                    {!entry.watch && <Pill tone="warn">no watch note</Pill>}
                  </>}
                  body={<>
                    {entry.one && <p style={{ color: C.text, margin: 0, lineHeight: 1.5 }}>{entry.one}</p>}
                    <dl className="drafts-facts" style={{ margin: `${S.md}px 0 0` }}>
                      {facts.map(([key, v]) => (
                        <React.Fragment key={key}>
                          <dt style={{ fontSize: F.xs, color: C.dim, fontWeight: 600 }}>{key}</dt>
                          <dd style={{ fontSize: F.xs, color: C.muted, margin: 0, wordBreak: "break-word" }}>
                            {factValue(v)}
                          </dd>
                        </React.Fragment>
                      ))}
                    </dl>
                    {entry.note && (
                      <p style={{ margin: `${S.md}px 0 0`, lineHeight: 1.6 }}>{entry.note}</p>
                    )}
                    {entry.watch
                      ? <p style={{ margin: "8px 0 0", lineHeight: 1.6 }}>
                        <span style={{ color: C.warnInk, fontWeight: 700 }}>Watch for. </span>{entry.watch}
                      </p>
                      : <p style={{ color: C.badInk, margin: "8px 0 0" }}>
                        No watch note. Not publishable without one.
                      </p>}
                  </>}
                />
              );
            })}
          </div>
        ))}
    </Section>
  );
}



function SuggestionRow({ s, children, footer }) {
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
      </>}
      body={<>
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
function Compose({ count }) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");

  const ready = Boolean(subject.trim() && body.trim());

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
function Accounts({ accounts, claims }) {
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
function Stats({ stats }) {
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
function MailLog({ rows }) {
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const failed24 = rows.filter((r) => !r.ok && Date.parse(r.at || "") >= dayAgo).length;
  const failedAll = rows.filter((r) => !r.ok).length;
  const [failsOnly, setFailsOnly] = useState(false);
  const shown = failsOnly ? rows.filter((r) => !r.ok) : rows;

  return (
    <Section title="Mail log" count={rows.length}
      hint="Last 100 sends, newest first, from svt:maillog. Every attempt is recorded whether it worked or not: a send that leaves no row here never happened.">
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
    </Section>
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
    <Section title="Test an event" count=""
      hint="Fires a real send through the same dispatcher the routes use, with dummy data, to your address only — including the copy a user would get, so nothing reaches a real vendor.">
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
    </Section>
  );
}


function Subscribers({ list }) {
  const [copied, setCopied] = useState("");

  async function copy() {
    const text = list.map((s) => s.email).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied("Copied " + list.length + " to the clipboard.");
    } catch {
      setCopied("Could not reach the clipboard. This needs HTTPS or localhost.");
    }
    setTimeout(() => setCopied(""), 3000);
  }

  return (
    <section className="pb-10">
      <h2 style={{ fontSize: F.xl, fontWeight: 700, margin: 0, letterSpacing: TRACK.tight }}>Subscribers</h2>
      <p style={{ fontSize: F.sm, color: C.muted, margin: "4px 0 0", maxWidth: "72ch", lineHeight: 1.55 }}>
        Addresses are not listed here on purpose. Copy them when you are actually sending,
        and send with the addresses hidden from each other.
      </p>
      <div className="mt-3 flex flex-wrap items-center" style={{
        background: C.panel, border: `1px solid ${C.line}`, borderRadius: R.card,
        padding: "16px 20px", gap: S.lg,
      }}>
        <span style={{ fontSize: F.display, fontWeight: 800, letterSpacing: TRACK.tighter, lineHeight: 1 }}>{list.length}</span>
        <span style={{ fontSize: F.sm, color: C.muted, flex: 1, minWidth: 140 }}>
          {list.length === 1 ? "address" : "addresses"} on the list
        </span>
        <button onClick={copy} disabled={!list.length} style={{
          background: list.length ? C.accent : C.subtle,
          color: list.length ? C.onAccent : C.dim, border: 0, borderRadius: R.control,
          padding: "8px 16px", fontSize: F.sm, fontWeight: 700,
          cursor: list.length ? "pointer" : "default", fontFamily: "inherit",
        }}>Copy all</button>
      </div>
      {copied && <p style={{ fontSize: F.xs, color: C.accentInk, margin: "8px 0 0" }}>{copied}</p>}
    </section>
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
function PublishedEntries({ entries, onEntries }) {
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
function DedupeLog({ rows }) {
  return (
    <Section
      title="Dedup decisions"
      count={rows.length}
      hint="Every submission, what it was matched to, and what decided it. `model` means the model was confident enough; `strings` means it was unavailable or unsure and name and domain matching decided instead."
    >
      {rows.length === 0
        ? <Empty>No submissions since this log started.</Empty>
        : rows.map((r, i) => (
          <Row key={i}
            title={r.submitted?.name || "(no name)"}
            tag={r.outcome === "none" ? "stored as new" : `merged into ${r.outcome} ${r.matchedId}`}
            tagColor={r.outcome === "none" ? C.dim : ink("#FFB020")}
            badges={<Pill>{r.decidedBy}</Pill>}
            body={r.model?.unavailable
              ? `Model unavailable: ${r.model.unavailable}`
              : `${r.model?.provider} said ${r.model?.said || "none"}${r.model?.id ? ` (${r.model.id})` : ""} at ${r.model?.confidence}${r.model?.reason ? `: ${r.model.reason}` : ""}${r.model?.dropped ? ` · ignored, ${r.model.dropped}` : ""}`}
            meta={String(r.at || "").slice(0, 16).replace("T", " ")}
          />
        ))}
    </Section>
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

function ChangeMonitor({ rows, monitor, seen, appliedChanges, onSeen }) {
  const [busy, setBusy] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState("");
  const [dismissed, setDismissed] = useState(seen || {});
  const [applied, setApplied] = useState(appliedChanges || {});
  const [showDone, setShowDone] = useState(false);

  const open = rows.filter((r) => !dismissed[r.id]);
  const closed = rows.filter((r) => dismissed[r.id]);
  const shown = showDone ? [...open, ...closed] : open;

  async function mark(id, action) {
    setBusy(id); setResult("");
    try {
      const res = await fetch("/api/admin", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, id }),
      });
      if (!res.ok) { setResult(await res.text()); return; }
      const d = await res.json();
      if (d.dismissed) { setDismissed(d.dismissed); onSeen?.(d.dismissed); }
      if (d.applied) setApplied(d.applied);
    } finally { setBusy(""); }
  }

  async function runNow() {
    setRunning(true); setResult("");
    try {
      const res = await fetch("/api/cron/monitor", { method: "POST" });
      if (!res.ok) { setResult(await res.text()); return; }
      const d = await res.json();
      setResult(`Checked ${d.checked} of ${d.total} in ${Math.round(d.tookMs / 1000)}s. ${d.changes} change${d.changes === 1 ? "" : "s"}.${d.emailed ? " Digest sent." : " Nothing emailed, which is the usual answer."}${d.stopped ? ` Stopped early: ${d.stopped}.` : ""} Reload to see them.`);
    } catch {
      setResult("Could not reach the server.");
    } finally { setRunning(false); }
  }

  return (
    <Section
      title="Listing changes"
      count={open.length}
      hint="Proposed by the weekly monitor, newest first. Nothing here has been applied: the monitor reads the vendor's pages and reports, it never edits a listing. Update listing opens the entry so you make the change yourself."
    >
      <div className="flex flex-wrap items-center" style={{ gap: S.md, padding: "12px 0" }}>
        <Btn onClick={runNow} busy={running} tone="go">Run the monitor now</Btn>
        <span style={{ fontSize: F.xs, color: C.dim }}>
          {monitor?.lastRunAt
            ? `Last run ${String(monitor.lastRunAt).slice(0, 16).replace("T", " ")} · checked ${monitor.lastChecked || 0} of ${monitor.lastTotal || 0} · ${monitor.lastCount || 0} change${monitor.lastCount === 1 ? "" : "s"}`
            : "Never run. Weekly on Mondays once the cron is live."}
        </span>
        {closed.length > 0 && (
          <button onClick={() => setShowDone((v) => !v)} style={{
            background: "none", border: 0, padding: 0, cursor: "pointer", fontFamily: "inherit",
            fontSize: F.xs, color: C.dim, textDecoration: "underline",
          }}>{showDone ? "hide" : "show"} {closed.length} dismissed</button>
        )}
      </div>

      {result && <p style={{ fontSize: F.xs, color: C.accentInk, margin: "0 0 12px", lineHeight: 1.55 }}>{result}</p>}

      {monitor?.notes?.length > 0 && (
        <p style={{ fontSize: F.xs, color: C.dim, margin: "0 0 12px", lineHeight: 1.55, maxWidth: "76ch" }}>
          Last run also noted: {monitor.notes.join(" · ")}
        </p>
      )}

      {shown.length === 0
        ? <Empty>Nothing proposed. Most weeks this is the correct answer, and an empty digest is not emailed.</Empty>
        : shown.map((r) => {
          const done = Boolean(dismissed[r.id]);
          return (
            <div key={r.id} style={{ borderTop: `1px solid ${C.line}`, padding: "14px 0", opacity: done ? 0.55 : 1 }}>
              <div className="flex flex-wrap items-baseline" style={{ gap: S.sm }}>
                <span style={{ fontSize: F.lg, fontWeight: 700 }}>{r.entryName}</span>
                <span style={{
                  fontSize: F.xs, fontWeight: 700,
                  color: LOUD.has(r.kind) ? C.warnInk : C.muted,
                }}>{KIND_LABEL[r.kind] || r.kind}</span>
                {r.editListing && <Pill tone="warn">listing needs editing</Pill>}
                <span style={{ fontSize: F.xs, color: C.dim }}>
                  confidence {r.confidence} · {String(r.at || "").slice(0, 10)}
                </span>
              </div>

              <p style={{ fontSize: F.sm, color: C.text, margin: "6px 0 0", lineHeight: 1.55, maxWidth: "76ch" }}>{r.what}</p>

              {(r.old || r.new) && (
                <p className="tnum" style={{ fontSize: F.sm, color: C.muted, margin: "6px 0 0", lineHeight: 1.55 }}>
                  <span style={{ color: C.dim }}>was</span> {r.old || "absent"}
                  {"  "}<span style={{ color: C.dim }}>now</span>{" "}
                  <b style={{ color: C.text }}>{r.new || "absent"}</b>
                </p>
              )}

              {r.why && <p style={{ fontSize: F.xs, color: C.dim, margin: "6px 0 0", lineHeight: 1.5, maxWidth: "76ch" }}>{r.why}</p>}

              <ChangeAction r={r} done={done} applied={applied[r.id]} busy={busy} onAct={mark} />
            </div>
          );
        })}

      <p style={{ fontSize: F.xs, color: C.dim, margin: "14px 0 4px", lineHeight: 1.55, maxWidth: "76ch" }}>
        Apply writes the field named on the button and nothing else, as an override, and Undo puts
        back exactly what was there. The <b style={{ color: C.muted }}>watch</b> note, the category,
        the verified flag and the external ratings never get a button: a monitor that could rewrite a
        caveat because a vendor stopped mentioning it is the exact failure this arrangement exists to
        prevent. Those, and anything the monitor could not map onto one field, open the entry instead.
      </p>
    </Section>
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
function ChangeAction({ r, done, applied, busy, onAct }) {
  const edit = r.edit || { state: "unmapped" };
  const openListing = (
    <a href={`/?tool=${encodeURIComponent(r.entryId)}`} target="_blank" rel="noopener noreferrer"
      style={{
        background: C.subtle, border: `1px solid ${C.line}`, color: C.text,
        borderRadius: R.control, padding: "4px 12px", fontSize: F.xs, fontWeight: 600,
        textDecoration: "none", whiteSpace: "nowrap",
      }}>Open the listing</a>
  );

  const source = r.url && (
    <a href={outbound(r.url)} target="_blank" rel="noopener noreferrer"
      style={{ fontSize: F.xs, color: C.muted }}>{r.url.replace(/^https?:\/\//, "")}</a>
  );

  const shown = (v) => (v === "" || v === null || v === undefined ? "absent" : String(v));

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
          Read it and decide.
        </p>
      )}

      <div className="flex flex-wrap items-center" style={{ gap: S.sm }}>
        {applied ? (
          <>
            <span style={{ fontSize: F.xs, color: C.accentInk, fontWeight: 700 }}>
              Applied {String(applied.at || "").slice(0, 10)}
            </span>
            <Btn onClick={() => onAct(r.id, "undo-change")} busy={busy === r.id}>Undo</Btn>
          </>
        ) : edit.state === "appliable" ? (
          <Btn onClick={() => onAct(r.id, "apply-change")} busy={busy === r.id} tone="go">
            Apply: {edit.field} → {shown(edit.to).slice(0, 40)}
          </Btn>
        ) : null}

        {openListing}
        {source}

        {!applied && (done
          ? <Btn onClick={() => onAct(r.id, "reopen-change")} busy={busy === r.id}>Reopen</Btn>
          : <ConfirmBtn onConfirm={() => onAct(r.id, "dismiss-change")} busy={busy === r.id}>Dismiss</ConfirmBtn>)}
      </div>
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
function OutOfScope({ rows }) {
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
function Tallies({ stats, rows }) {
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
function Deleted({ rows, act, busy }) {
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
