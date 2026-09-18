import { cookies, headers } from "next/headers";
import { sessionFrom, isAdmin } from "@/lib/auth";
import { read, readStats, readMailLog, KEYS } from "@/lib/store";
import { getClaims } from "@/lib/listings";
import { getSubscribers } from "@/lib/subscribers";
import { C, S, F } from "@/lib/tools";
import AdminPanel from "@/components/Admin";
import { getAccounts } from "@/lib/accounts";
import { getEntries } from "@/lib/entries";
import { readDedupeLog } from "@/lib/dedup";
import { readChangelog, getMonitorState, blockedEntries } from "@/lib/monitor";
import { getInterest } from "@/lib/interest";
import { getDiscovery } from "@/lib/discovery";
import { feedEntries } from "@/lib/feed";
import { health } from "@/lib/health";

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
    { key: "suggestions", load: () => read(KEYS.suggestions, []), empty: [] },
    { key: "claims", load: () => getClaims(), empty: {} },
    { key: "subscribers", load: () => getSubscribers(), empty: [] },
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
    { key: "adminSeen", load: () => read(KEYS.adminSeen, {}), empty: {} },
    { key: "appliedChanges", load: () => read(KEYS.changesApplied, {}), empty: {} },
    { key: "discovery", load: () => getDiscovery(), empty: { findings: [], dismissed: [] } },
    { key: "blocked", load: () => blockedEntries(), empty: [] },
    { key: "publishedChanges", load: () => read(KEYS.changesPublished, {}), empty: {} },
    { key: "feed", load: () => feedEntries({ limit: 60 }), empty: [] },
    { key: "health", load: () => health(), empty: null },
  ];

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
      email={session.email}
      lastVisit={data.adminSeen?.[session.email] || ""}
      initialTab={typeof searchParams?.tab === "string" ? searchParams.tab : "inbox"}
    />
  );
}
