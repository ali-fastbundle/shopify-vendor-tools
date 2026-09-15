import { cookies, headers } from "next/headers";
import { sessionFrom, isAdmin } from "@/lib/auth";
import { read, KEYS } from "@/lib/store";
import { getClaims } from "@/lib/listings";
import { getSubscribers } from "@/lib/subscribers";
import { C } from "@/lib/tools";
import AdminPanel from "@/components/Admin";

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
  const [suggestions, claims, subscribers, reports] = await Promise.all([
    read(KEYS.suggestions, []),
    getClaims(),
    getSubscribers(),
    read(KEYS.reports, []),
  ]);

  return (
    <AdminPanel
      email={session.email}
      suggestions={suggestions}
      claims={claims}
      subscribers={subscribers}
      reports={reports}
    />
  );
}
