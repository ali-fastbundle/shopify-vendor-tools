import { sessionFrom, sessionCookie, isAdmin, configured } from "@/lib/auth";
import { getClaims } from "@/lib/listings";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const s = sessionFrom(request);
  if (!s) return Response.json({ signedIn: false, configured });
  const claims = await getClaims();
  const owned = Object.entries(claims)
    .filter(([, c]) => c.status === "verified" && c.email === s.email)
    .map(([id]) => id);
  return Response.json({ signedIn: true, configured, email: s.email, admin: isAdmin(s.email), owned });
}

export async function DELETE() {
  return new Response(null, { status: 200, headers: { "Set-Cookie": sessionCookie("", 0) } });
}
