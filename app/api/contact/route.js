import { readFormToken, isEmail, normaliseEmail, configured } from "@/lib/auth";
import { allow, ipOf } from "@/lib/ratelimit";
import { sendEvent } from "@/lib/mail";

export const dynamic = "force-dynamic";

/*
 * The contact form. It sends one email to CONTACT_EMAIL and stores nothing.
 *
 * Bots are turned away without a captcha, by two checks that cost a person
 * nothing:
 *
 *  - a honeypot field, `company`, hidden from people and from assistive tech,
 *    which a form-filling script fills in because it is there;
 *  - time to submit, read from a signed token minted when the page rendered,
 *    so a script cannot backdate it. Under MIN_MS is faster than anybody
 *    types a message.
 *
 * Both answer exactly what success answers. Telling a bot which check it
 * failed is telling it what to change.
 *
 * Order, per invariant 6: the honeypot, the token and validation are pure
 * checks with no I/O, so a rejected request costs nothing; the limiter is a
 * Redis read and write, so it sits directly above the send, where real work
 * starts.
 *
 * The mail is the request here, as with /api/auth/request: nothing is stored,
 * so a failed send is a lost message, and the person is told so rather than
 * thanked for a message nobody will read.
 */
const MIN_MS = 3000;
const ok = () => Response.json({ ok: true });

const clean = (s, max) => String(s ?? "").replace(/\r\n?/g, "\n").trim().slice(0, max);
const oneLine = (s, max) => clean(s, max).replace(/\s+/g, " ");

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { body = {}; }

  if (clean(body.company, 200)) return ok();

  if (!configured) return new Response("The contact form is not set up yet.", { status: 503 });
  const renderedAt = readFormToken(body.token, "contact");
  if (renderedAt === null) {
    return new Response("This form has expired. Reload the page and send it again; what you wrote is kept.", { status: 400 });
  }
  if (Date.now() - renderedAt < MIN_MS) return ok();

  const email = normaliseEmail(body.email);
  if (!isEmail(email)) return new Response("That email does not look right.", { status: 400 });
  const name = oneLine(body.name, 80);
  const message = clean(body.message, 4000);
  if (message.length < 10) return new Response("Write a little more, so there is something to answer.", { status: 400 });

  if (!(await allow("contact", ipOf(request), 5, 60 * 60_000))) {
    return new Response("You have sent a few messages already. Try again in an hour.", { status: 429 });
  }

  const result = await sendEvent("contact", { name, email, message });
  if (!result.ok || !result.sends.length) {
    return new Response("That did not send. Try again in a minute.", { status: 502 });
  }
  return ok();
}
