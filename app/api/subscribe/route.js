import { allow, ipOf } from "@/lib/ratelimit";
import { isEmail, normaliseEmail } from "@/lib/auth";
import { addSubscriber, unsubLink } from "@/lib/subscribers";
import { sendMail } from "@/lib/email";

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
    const origin = new URL(request.url).origin;
    sendMail({
      to: email,
      subject: "You're on the list",
      text: [
        "You're on the list.",
        "",
        "You will get one email when new tools go into the directory or a new",
        "section opens. That is the whole thing — no newsletter, no weekly digest,",
        "no pitch at the bottom. If neither happens, you hear nothing.",
        "",
        "Your address is not shared or sold, and it is not passed to any tool",
        "listed in the directory.",
        "",
        "Unsubscribe at any time:",
        unsubLink(origin, email),
      ].join("\n"),
    }).catch((e) => console.error("subscribe confirmation:", e.message));
  }

  return Response.json({ ok: true });
}
