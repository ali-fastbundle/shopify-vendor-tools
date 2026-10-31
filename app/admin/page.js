import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { LEGACY_TABS, resolveAdminTab } from "@/lib/adminTabs";
import { sessionFrom, isAdmin } from "@/lib/auth";
import { read, readStats, readMailLog, readCapped, KEYS } from "@/lib/store";
import { getClaims } from "@/lib/listings";
import { getSubscribers } from "@/lib/subscribers";
import { C, S, F } from "@/lib/tools";
import AdminPanel from "@/components/Admin";
import { getAccounts } from "@/lib/accounts";
import { getEntries } from "@/lib/entries";
import { readDedupeLog } from "@/lib/dedup";
import { readChangelog, getMonitorState, getSnapshots } from "@/lib/monitor";
import { getInterest } from "@/lib/interest";
import { getDiscovery } from "@/lib/discovery";
import { storeInventory } from "@/lib/inventory";
import { feedEntries } from "@/lib/feed";
import { health } from "@/lib/health";
import { readRuns, summariseRuns } from "@/lib/recommend";
import { canPublish, readPublishLog } from "@/lib/publish";
import { reviewSignals } from "@/lib/reviewSignals";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

/*
 * The gate comes first and returns early. Nothing below it runs — no Redis
 * read, no subscriber list, no claims — until the session has been checked
 * against ADMIN_EMAILS, so an unauthorised request cannot pull data into the
 * render tree at all. Do not move a read above the check for convenience.
 */
export default async function AdminPage({ searchParams }) {
  const session = sessionFrom({ cookies: cookies(), headers: headers() });

  if (!session || !isAdmin(session.email)) {
    return (
      <main style={{
        background: C.bg, color: C.text, minHeight: "100vh",
        display: "flex", alignItems: "center", justifyContent: "center", padding: S["2xl"],
      }}>
        <p style={{ fontSize: F.lg, color: C.muted, margin: 0 }}>Not authorised</p>
      </main>
    );
  }

  // Past the gate, and only now.

  /* A ?tab= from before the six-tab layout (a bookmark, a link in an email or
     in CLAUDE.md) lands on the tab that holds its panel now, scrolled to it.
     After the check, so the redirect confirms nothing to a stranger, and
     before any read, so it costs nothing. */
  const asked = typeof searchParams?.tab === "string" ? searchParams.tab : "";
  if (LEGACY_TABS[asked]) {
    const { tab, anchor } = resolveAdminTab(asked);
    redirect(`/admin?tab=${tab}${anchor ? `#${anchor}` : ""}`);
  }

  /*
   * Every read defaults to empty, and every one is settled rather than raced.
   *
   * On a new deployment none of these keys exist yet, which is normal and not an
   * error: the panels render their empty states. Promise.allSettled means one
   * store hiccup degrades a single panel instead of turning the whole console
   * into a 500 — which is precisely the failure that made this page useless
   * once already.
   */
  /*
   * Every source, named once.
   *
   * This was three parallel lists: the reads, the destructured names, and a
   * positional array of fallbacks. Keeping three lists in lockstep by counting
   * positions is a thing that works until somebody appends to two of them,
   * and then a panel silently receives the wrong default or undefined. One
   * list of { key, load, empty } cannot drift, and adding a source is one
   * entry rather than three edits in three places.
   *
   * `empty` matters more than it looks. Most of these keys postdate the first
   * deployment, so on any store that has not seen the feature yet the read
   * returns the fallback and the panel renders its empty state. A missing key
   * is the normal early state, not an error.
   */
  const SOURCES = [
    /* Suggestions, after matching any against what is now published, so one
       published by hand into a file leaves the queue too (lib/suggestionPublished.js). */
    { key: "suggestions", load: async () => {
      const [{ settlePublished }, { catalogueTools }, { NEWSLETTERS }, { EVENTS }] = await Promise.all([
        import("@/lib/suggestionPublished"), import("@/lib/entries"), import("@/lib/newsletters"), import("@/lib/events"),
      ]);
      const catalogue = [
        ...(await catalogueTools()).map((t) => ({ ...t, kind: "tool" })),
        ...NEWSLETTERS.map((n) => ({ ...n, kind: "newsletter" })),
        ...EVENTS.map((e) => ({ ...e, kind: "event" })),
      ];
      return (await settlePublished(catalogue)).suggestions;
    }, empty: [] },
    { key: "claims", load: () => getClaims(), empty: {} },
    { key: "subscribers", load: () => getSubscribers(), empty: [] },
    /* One row per address across the site-wide list and per-item follows.
       Rendered here, behind the check above, and returned by no route. */
    { key: "subscriberRows", load: async () => (await import("@/lib/subscriberList")).subscriberRows(), empty: [] },
    { key: "reports", load: () => read(KEYS.reports, []), empty: [] },
    { key: "accounts", load: () => getAccounts(), empty: {} },
    { key: "stats", load: () => readStats(), empty: { fields: {}, queries: [] } },
    { key: "maillog", load: () => readMailLog(100), empty: [] },
    { key: "entries", load: () => getEntries(), empty: {} },
    { key: "dedupelog", load: () => readDedupeLog(60), empty: [] },
    { key: "changelog", load: () => readChangelog(120), empty: [] },
    { key: "monitor", load: () => getMonitorState(), empty: {} },
    { key: "changesSeen", load: () => read(KEYS.changesSeen, {}), empty: {} },
    { key: "interest", load: () => getInterest(), empty: {} },
    { key: "aboutPhoto", load: async () => (await import("@/lib/aboutStore")).aboutPhotoUrl(), empty: "" },
    { key: "about", load: async () => (await import("@/lib/aboutStore")).getAboutRecord(), empty: null },
    /* Price strings a vendor or the monitor wrote, and when, so a confirmed
       structure older than one goes back on the to-confirm list. */
    { key: "priceOverrides", load: async () => {
      const { getOverrides } = await import("@/lib/listings");
      const o = await getOverrides();
      return Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v?.price !== undefined).map(([id, v]) => [id, { price: v.price, priceAt: v.priceAt || "" }]));
    }, empty: {} },
    { key: "structured", load: async () => (await import("@/lib/structuredStore")).getStructured(), empty: {} },
    { key: "ideas", load: async () => (await import("@/lib/ideaStore")).getIdeas(), empty: [] },
    { key: "editorUse", load: async () => (await import("@/lib/editorUseStore")).getEditorUse(), empty: {} },
    { key: "adminSeen", load: () => read(KEYS.adminSeen, {}), empty: {} },
    { key: "appliedChanges", load: () => read(KEYS.changesApplied, {}), empty: {} },
    { key: "discovery", load: () => getDiscovery(), empty: { findings: [], dismissed: [] } },
    /* Every published tool and newsletter against what the monitor last read,
       which is the same list the cron sweeps (app/api/cron/monitor). */
    { key: "coverage", load: async () => {
      const [{ coverageOf }, { catalogueTools }, { NEWSLETTERS }, snapshots] = await Promise.all([
        import("@/lib/coverage"), import("@/lib/entries"), import("@/lib/newsletters"), getSnapshots(),
      ]);
      const entries = [
        ...(await catalogueTools()).map((t) => ({ ...t, kind: "tool" })),
        ...NEWSLETTERS.map((n) => ({ ...n, kind: "newsletter" })),
      ];
      const feeds = await (await import("@/lib/feedDiscovery")).getFeeds();
      return coverageOf(entries, snapshots, { feeds });
    }, empty: [] },
    { key: "publishedChanges", load: () => read(KEYS.changesPublished, {}), empty: {} },
    { key: "rewrittenChanges", load: () => read(KEYS.changesRewritten, {}), empty: {} },
    { key: "editedChanges", load: () => read(KEYS.changesEdited, {}), empty: {} },
    { key: "rewriteLog", load: () => readCapped(KEYS.rewriteLog, 100), empty: [] },
    { key: "monitorErrors", load: () => readCapped(KEYS.monitorErrors, 200), empty: [] },
    /* Ask the directory: every question, answered or not (lib/matchLog.js). */
    { key: "askLog", load: () => readCapped(KEYS.matchLog, 500), empty: [] },
    /* The monthly event refresh (lib/eventRefresh.js): findings for the Inbox,
       and what it can see of each event for Updates. */
    /* Mentions of listed domains (lib/mentions.js), every status. */
    { key: "mentions", load: async () => {
      const m = await import("@/lib/mentions");
      return m.mentionList(await m.getMentions(), { includeRemoved: true });
    }, empty: [] },
    /* What each mentions source did on its last run: blocked must not read as empty. */
    { key: "mentionSources", load: async () => {
      const m = await import("@/lib/mentions");
      const st = await m.getMentions();
      return { lastRunAt: st.lastRunAt || "", sources: st.sources || {} };
    }, empty: { lastRunAt: "", sources: {} } },
    { key: "eventFindings", load: async () => (await import("@/lib/eventRefresh")).getEventFindings(), empty: [] },
    { key: "eventRefresh", load: async () => {
      const r = await (await import("@/lib/eventRefresh")).getEventRefresh();
      return { lastRunAt: r.lastRunAt || "", lastChecked: r.lastChecked || 0, total: r.total || 0 };
    }, empty: {} },
    { key: "eventCoverage", load: async () => {
      const m = await import("@/lib/eventRefresh");
      return m.coverageOf((await import("@/lib/events")).EVENTS, await m.getEventRefresh());
    }, empty: [] },
    { key: "verifiedChanges", load: () => read(KEYS.changesVerified, {}), empty: {} },
    { key: "feed", load: () => feedEntries({ limit: 60, withPrivate: true }), empty: [] },
    { key: "health", load: () => health(), empty: null },
    { key: "inventory", load: () => storeInventory(), empty: [] },
    /* Server side because the domain marker reads reviewer addresses. */
    { key: "reviewSignals", load: () => reviewSignals(), empty: [] },
    /* Draft outcomes. Discards are every record, for the Discarded panel;
       which still stand is worked out against the files on the server. */
    { key: "discards", load: async () => {
      const { getDiscards, liveDiscards, fileKeys } = await import("@/lib/draftOutcomes");
      const all = await getDiscards();
      const live = new Set(liveDiscards(all, fileKeys()).map((d) => d.key));
      return all.map((d) => ({ ...d, standing: live.has(d.key) }));
    }, empty: [] },
    { key: "holds", load: async () => (await import("@/lib/draftOutcomes")).getHolds(), empty: {} },
    /* Summarised here, on the server: lib/recommend imports the model chain,
       which no client component may import (invariant 20). */
    /* Whether the Publish button can commit (GITHUB_TOKEN is set), and what it
       has published. The token itself never leaves the server. */
    /* `build` goes back with every draft action, so an action from a page
       rendered before the latest deploy is refused rather than misread. */
    { key: "publishing", load: async () => ({ canPublish: canPublish(), log: await readPublishLog(20), build: (await import("@/lib/draftOutcomes")).BUILD }), empty: { canPublish: false, log: [], build: "" } },
    /* The LinkedIn announcement queue, seeds merged in, each with its checks:
       hype, figures not in the facts, an em-dash. */
    /* Blog comments with their addresses: rendered here, behind the check. */
    /* Questions on tools with their addresses: rendered here, behind the check. */
    /* Outreach (temporary): the vendors' published contact addresses, read
       here on the server after the admin check so they never ship in a
       public bundle, and who has been written to. */
    { key: "outreach", load: async () => {
      const [{ CONTACTS }, { readOutreach, readMeta }] = await Promise.all([import("@/lib/vendorContacts"), import("@/lib/outreach")]);
      const [state, meta] = await Promise.all([readOutreach(), readMeta()]);
      return { contacts: CONTACTS, state, meta };
    }, empty: { contacts: {}, state: {}, meta: {} } },
    /* Vendor media: what is live, and what is waiting with its image data. */
    { key: "media", load: async () => {
      const { readMedia, readPending } = await import("@/lib/media");
      const [live, pending] = await Promise.all([readMedia(), readPending()]);
      return { live, pending };
    }, empty: { live: {}, pending: {} } },
    /* Published lists with their owners' addresses, behind the check. */
    { key: "lists", load: async () => Object.values((await (await import("@/lib/lists")).readLists()) || {}).filter((l) => l?.public), empty: [] },
    { key: "questions", load: async () => {
      const { readQA, adminQA } = await import("@/lib/qa");
      const { catalogueTools } = await import("@/lib/entries");
      const names = Object.fromEntries((await catalogueTools()).map((t) => [t.id, t.name]));
      return adminQA(await readQA(), (id) => names[id] || id);
    }, empty: [] },
    { key: "comments", load: async () => {
      const { readComments, adminComments } = await import("@/lib/comments");
      const { POSTS } = await import("@/lib/blog");
      return adminComments(await readComments(), (s) => POSTS.find((p) => p.slug === s)?.title || s);
    }, empty: [] },
    { key: "announcements", load: async () => {
      const { getAnnouncements } = await import("@/lib/announcements");
      return getAnnouncements();
    }, empty: [] },
    { key: "recommend", load: async () => {
      const { readFeedback, summariseFeedback } = await import("@/lib/recommendFeedback");
      const [runs, fb] = await Promise.all([readRuns(500), readFeedback()]);
      return { runs, summary: summariseRuns(runs), feedback: summariseFeedback(runs, fb) };
    }, empty: { runs: [], summary: null, feedback: null } },
  ];

  /*
   * Findings answered by an edit the store can see are resolved before
   * anything below reads the findings, so the panels and their counts agree
   * (lib/handEdits.js). A failure here costs the detection, never the page.
   */
  let autoResolved = [];
  try {
    autoResolved = await (await import("@/lib/handEdits")).settleHandEdits();
  } catch (e) {
    console.error("[admin] hand-edit detection failed:", e?.message || e);
  }

  /*
   * Settled rather than raced, so one store hiccup degrades a single panel
   * instead of turning the whole console into a 500, which is precisely the
   * failure that made this page useless once already.
   */
  const settled = await Promise.allSettled(SOURCES.map((s) => s.load()));
  const data = Object.fromEntries(settled.map((r, i) => {
    const { key, empty } = SOURCES[i];
    if (r.status === "rejected") {
      console.error(`[admin] read failed — ${key}:`, r.reason?.message || r.reason);
      return [key, empty];
    }
    return [key, r.value ?? empty];
  }));

  return (
    <AdminPanel
      {...data}
      autoResolved={autoResolved}
      email={session.email}
      lastVisit={data.adminSeen?.[session.email] || ""}
      initialTab={typeof searchParams?.tab === "string" ? searchParams.tab : "inbox"}
    />
  );
}
