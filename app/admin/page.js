import { cookies, headers } from "next/headers";
import { sessionFrom, isAdmin } from "@/lib/auth";
import { read, readStats, readMailLog, KEYS } from "@/lib/store";
import { getClaims } from "@/lib/listings";
import { getSubscribers } from "@/lib/subscribers";
import { C } from "@/lib/tools";
import AdminPanel from "@/components/Admin";
import { getAccounts } from "@/lib/accounts";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

/*
 * The gate comes first and returns early. Nothing below it runs — no Redis
 * read, no subscriber list, no claims — until the session has been checked
 * against ADMIN_EMAILS, so an unauthorised request cannot pull data into the
 * render tree at all. Do not move a read above the check for convenience.
 */
export default async function AdminPage() {
  const session = sessionFrom({ cookies: cookies(), headers: headers() });

  if (!session || !isAdmin(session.email)) {
    return (
      <main style={{
        background: C.bg, color: C.text, minHeight: "100vh",
        fontFamily: "Archivo, Inter, system-ui, sans-serif",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
      }}>
        <p style={{ fontSize: 17, color: C.muted, margin: 0 }}>Not authorised</p>
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
  const settled = await Promise.allSettled([
    read(KEYS.suggestions, []),
    getClaims(),
    getSubscribers(),
    read(KEYS.reports, []),
    getAccounts(),
    readStats(),
    readMailLog(100),
  ]);
  const [suggestions, claims, subscribers, reports, accounts, stats, maillog] =
    settled.map((r, i) => {
      if (r.status === "fulfilled" && r.value != null) return r.value;
      if (r.status === "rejected") console.error("[admin] read failed —", r.reason?.message || r.reason);
      return [[], {}, [], [], {}, { fields: {}, queries: [] }, []][i];
    });

  return (
    <AdminPanel
      email={session.email}
      suggestions={suggestions}
      claims={claims}
      subscribers={subscribers}
      reports={reports}
      accounts={accounts}
      stats={stats}
      maillog={maillog}
    />
  );
}
