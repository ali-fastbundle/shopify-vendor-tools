import { read, write, KEYS } from "@/lib/store";
import { allow, ipOf } from "@/lib/ratelimit";
import { isEmail, normaliseEmail } from "@/lib/auth";

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

  const subscribers = await read(KEYS.subscribers, []);
  if (!subscribers.some((s) => s.email === email)) {
    const next = [...subscribers, { email, date: new Date().toISOString().slice(0, 10) }];
    await write(KEYS.subscribers, next);
  }
  return Response.json({ ok: true });
}
