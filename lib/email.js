/*
 * Sends the sign-in link through Resend. With no RESEND_API_KEY the link is
 * written to the server log instead, which is fine locally and useless in
 * production — so /api/auth/request refuses to run in production without it.
 */
export async function sendLoginLink(to, link) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`\n[dev] sign-in link for ${to}:\n${link}\n`);
    return { dev: true };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || "Directory <onboarding@resend.dev>",
      to,
      subject: "Your sign-in link",
      text: `Sign in to the Shopify app vendor's toolkit:\n\n${link}\n\nThe link works once and expires in 15 minutes. If you did not ask for it, ignore this email.`,
    }),
  });
  if (!res.ok) throw new Error(`resend ${res.status}: ${await res.text()}`);
  return { sent: true };
}
