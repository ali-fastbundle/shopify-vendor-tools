import { readLoginToken, mintSession, sessionCookie } from "@/lib/auth";
import { allow, ipOf } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const token = new URL(request.url).searchParams.get("token");
  const email = readLoginToken(token);
  const origin = new URL(request.url).origin;
  if (!email) return Response.redirect(`${origin}/?signin=expired`, 302);

  /*
   * After the token check, which is a pure HMAC compare with no I/O — a forged
   * or expired token costs nothing and never reaches Redis, while allow() costs
   * a read and a write. Limiting first would make the cheapest rejection the
   * most expensive one.
   *
   * What this bounds is session minting from a *valid* token. A login link is
   * replayable until it expires, so one leaked link can currently mint sessions
   * repeatedly; 30 an hour is far above one human clicking a link and well
   * below useful abuse.
   */
  if (!(await allow("callback", ipOf(request), 30, 60 * 60_000))) {
    return Response.redirect(`${origin}/?signin=throttled`, 302);
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: `${origin}/?signin=ok`,
      "Set-Cookie": sessionCookie(mintSession(email)),
    },
  });
}
