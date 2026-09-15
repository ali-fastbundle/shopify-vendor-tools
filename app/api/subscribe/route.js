import { allow, ipOf } from "@/lib/ratelimit";
import { isEmail, normaliseEmail } from "@/lib/auth";
import { addSubscriber } from "@/lib/subscribers";
import { sendEvent } from "@/lib/mail";

export const dynamic = "force-dynamic";

/*
 * The list is write-only from the outside. A known address and a new one get
 * the same response, so this endpoint cannot be used to test whether someone
 * is subscribed. Never return the list, a count, or an "already subscribed"
 * message — that is the whole point.
 */
export async function POST(request) {
  const ip = ipOf(request);
  if (!(await allow("subscribe", ip, 5, 60 * 60_000))) {
    return new Response("Too many sign-ups from here. Try again in an hour.", { status: 429 });
  }

  let body;
  try { body = await request.json(); } catch { body = {}; }
  const email = normaliseEmail(body.email);
  if (!isEmail(email)) return new Response("That email does not look right", { status: 400 });

  const { added } = await addSubscriber(email);

  /*
   * Only on a genuinely new address: re-posting a known one must not let
   * anyone mail-bomb a stranger's inbox through this endpoint. The HTTP
   * response is identical either way, so this leaks nothing.
   *
   * Not awaited, and it swallows its own failures — a dead Resend must not
   * turn a stored subscription into a 500 the visitor sees.
   */
  if (added) {
    // Awaited: delivery that actually happens is worth the latency. See lib/mail.js.
    await sendEvent("subscribe", { email, origin: new URL(request.url).origin });
  }

  return Response.json({ ok: true });
}
