import { configured, isEmail, mintLoginToken, normaliseEmail } from "@/lib/auth";
import { sendLoginLink } from "@/lib/email";
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
  try {
    const r = await sendLoginLink(addr, link);
    return Response.json({ ok: true, dev: Boolean(r.dev) });
  } catch (e) {
    console.error("login email", e.message);
    return new Response("Could not send the email", { status: 502 });
  }
}
