import { readLoginToken, mintSession, sessionCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const token = new URL(request.url).searchParams.get("token");
  const email = readLoginToken(token);
  const origin = new URL(request.url).origin;
  if (!email) return Response.redirect(`${origin}/?signin=expired`, 302);
  return new Response(null, {
    status: 302,
    headers: {
      Location: `${origin}/?signin=ok`,
      "Set-Cookie": sessionCookie(mintSession(email)),
    },
  });
}
