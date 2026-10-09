import { createHash } from "crypto";
import { allow, ipOf } from "@/lib/ratelimit";
import { isEmail, normaliseEmail, sessionFrom, mintFollowToken, configured } from "@/lib/auth";
import { followable, addFollow } from "@/lib/follows";
import { sendEvent } from "@/lib/mail";
import { whatYouGet } from "@/lib/followCopy";

export const dynamic = "force-dynamic";

/*
 * Ask to follow a newsletter or an event.
 *
 * Signed in with the same address: followed at once, since signing in already
 * proved the inbox. Anyone else: a confirmation email with a signed link, and
 * nothing stored until it is clicked. That is the double opt-in, and it is why
 * this route never writes an address it has not seen confirmed.
 *
 * The answer is the same whether or not the address already follows this, or
 * anything (invariant 8): the list is write-only over HTTP. Two limits: per IP
 * against a flood, and per address, hashed, so the form cannot be used to send
 * one stranger a stack of confirmation emails. Past the per-address limit the
 * answer is still "check your inbox", and nothing is sent.
 *
 * Validation and the session read are pure; the limiters sit after them
 * (invariant 6). The mail is the request here, as with /api/auth/request:
 * nothing is stored, so a failed send is reported rather than thanked.
 */
const addrKey = (email) => createHash("sha256").update(`follow:${email}`).digest("base64url").slice(0, 24);

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { body = {}; }

  const item = followable(body.id);
  if (!item) return new Response("That cannot be followed.", { status: 400 });
  const email = normaliseEmail(body.email);
  if (!isEmail(email)) return new Response("That email does not look right.", { status: 400 });
  if (!configured) return new Response("Following is not set up yet.", { status: 503 });

  const session = sessionFrom(request);
  if (session && normaliseEmail(session.email) === email) {
    await addFollow(email, item.id);
    return Response.json({ ok: true, confirmed: true });
  }

  if (!(await allow("follow", ipOf(request), 10, 60 * 60_000))) {
    return new Response("A few too many of those from here. Try again in an hour.", { status: 429 });
  }
  if (!(await allow("follow-addr", addrKey(email), 3, 24 * 60 * 60_000))) {
    return Response.json({ ok: true, confirmed: false });
  }

  const origin = new URL(request.url).origin;
  const result = await sendEvent("follow_confirm", {
    email, name: item.name,
    what: whatYouGet(item.kind, item.hasFeed),
    confirmUrl: `${origin}/api/follow/confirm?token=${encodeURIComponent(mintFollowToken(email, item.id))}`,
  });
  if (!result.ok || !result.sends.length) {
    return new Response("The confirmation email did not send. Try again in a minute.", { status: 502 });
  }
  return Response.json({ ok: true, confirmed: false });
}

