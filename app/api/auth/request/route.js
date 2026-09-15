import { configured, isEmail, mintLoginToken, normaliseEmail } from "@/lib/auth";
import { isSendingRestricted } from "@/lib/email";
import { sendEvent } from "@/lib/mail";
import { allow, ipOf } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

export async function POST(request) {
  if (!configured) return new Response("Accounts are not configured", { status: 503 });
  if (process.env.NODE_ENV === "production" && !process.env.RESEND_API_KEY) {
    return new Response("Email sending is not configured", { status: 503 });
  }
  const ip = ipOf(request);
  if (!(await allow("login", ip, 5, 15 * 60_000))) {
    return new Response("Too many sign-in attempts. Wait a few minutes.", { status: 429 });
  }

  const { email } = await request.json();
  const addr = normaliseEmail(email);
  if (!isEmail(addr)) return new Response("That email does not look right", { status: 400 });

  const origin = new URL(request.url).origin;
  const link = `${origin}/api/auth/callback?token=${encodeURIComponent(mintLoginToken(addr))}`;
  /*
   * sendEvent never throws, so the failure arrives as a result rather than an
   * exception — but this is the one caller that must act on it. Everywhere else
   * a mail failure is logged and swallowed; here it is the whole request.
   */
  const r = await sendEvent("signin_link", { email: addr, link });
  if (r.ok) return Response.json({ ok: true, dev: !process.env.RESEND_API_KEY });

  const error = r.sends.find((x) => !x.ok)?.error || "unknown";
  return new Response(
    isSendingRestricted(error)
      ? "Email sending is restricted to the account owner until a sending domain is verified in Resend."
      : "Could not send the email",
    { status: 502 },
  );
}
