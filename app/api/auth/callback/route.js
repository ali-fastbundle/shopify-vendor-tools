import { readLoginToken, mintSession, sessionCookie } from "@/lib/auth";
import { allow, ipOf } from "@/lib/ratelimit";
import { recordSignIn } from "@/lib/accounts";
import { sendEvent } from "@/lib/mail";
import { NEWSLETTERS } from "@/lib/newsletters";
import { EVENTS } from "@/lib/events";

export const dynamic = "force-dynamic";

/*
 * A newsletter or an event has its own page, and the directory only knows how
 * to reopen a tool, so sending those back to `/?tool=` landed people on the
 * homepage with the listing they were reviewing gone. Each kind goes back to
 * where it lives. The lookups are the static catalogues, so this costs no I/O.
 */
function returnPath(id) {
  if (!id) return "/?signin=ok";
  if (id === "@recommend") return "/recommend?signin=ok";
  const safe = encodeURIComponent(id);
  if (NEWSLETTERS.some((n) => n.id === id)) return `/newsletters/${safe}?signin=ok`;
  if (EVENTS.some((e) => e.id === id)) return `/events/${safe}?signin=ok`;
  return `/?signin=ok&tool=${safe}`;
}

export async function GET(request) {
  const token = new URL(request.url).searchParams.get("token");
  const claims = readLoginToken(token);
  const origin = new URL(request.url).origin;
  if (!claims) return Response.redirect(`${origin}/?signin=expired`, 302);
  const { email, tool } = claims;

  /*
   * Where to put them back. The id came out of the signed token, so it is one
   * we minted and validated against the catalogue, not something a link can be
   * edited to say. It becomes a parameter on our own origin either way, so
   * there is no destination here for anyone to control.
   */
  const back = returnPath(tool);

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
  let isNew = false;
  try {
    ({ isNew } = await recordSignIn(email));
  } catch (e) {
    console.error("[accounts] recordSignIn failed —", e.message);
  }

  /*
   * A first sign-in is news; a returning one is not. Both go through the same
   * dispatcher so the matrix stays in one file — signin_return simply sends
   * nothing, which is easier to verify than a branch that skips the call.
   */
  await sendEvent(isNew ? "signin_new" : "signin_return", { email, origin });

  return new Response(null, {
    status: 302,
    headers: {
      Location: `${origin}${back}`,
      "Set-Cookie": sessionCookie(mintSession(email)),
    },
  });
}
