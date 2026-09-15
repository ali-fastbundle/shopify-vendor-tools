import { readLoginToken, mintSession, sessionCookie } from "@/lib/auth";
import { allow, ipOf } from "@/lib/ratelimit";
import { recordSignIn } from "@/lib/accounts";

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

  /*
   * Awaited, unlike the mail sends: it is one read and one write against the
   * store we are already talking to, and the record is the thing that makes the
   * account list true. Wrapped so a store outage costs someone their record but
   * never their sign-in — being unable to log the visit is not a reason to
   * refuse entry.
   */
  try {
    await recordSignIn(email);
  } catch (e) {
    console.error("[accounts] recordSignIn failed —", e.message);
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: `${origin}/?signin=ok`,
      "Set-Cookie": sessionCookie(mintSession(email)),
    },
  });
}
