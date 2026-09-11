import { sessionFrom, isAdmin } from "@/lib/auth";
import { getSubscribers, unsubLink, canUnsubscribe } from "@/lib/subscribers";
import { sendBatch, BATCH_MAX } from "@/lib/email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/*
 * Re-derives the session and re-checks isAdmin on every request, like
 * /api/admin. The compose box on the admin page is a convenience, never the
 * permission. Same 404 as that route for anyone who is not an admin.
 */
const DENY = () => new Response("Not found", { status: 404 });

const clean = (s, max) => String(s || "").replace(/\r\n/g, "\n").trim().slice(0, max);

const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

export async function POST(request) {
  const session = sessionFrom(request);
  if (!session || !isAdmin(session.email)) return DENY();

  /*
   * Without AUTH_SECRET there is no valid unsubscribe token, so every link in
   * the mail would be dead — never send bulk email nobody can opt out of.
   *
   * Unreachable as things stand: sessions are signed with the same secret, so
   * with it unset nobody can be an admin and the check above already returned
   * 404. Kept because it is the condition that actually matters here, and the
   * day session auth stops sharing this secret it starts doing real work.
   */
  if (!canUnsubscribe) {
    return new Response("AUTH_SECRET is not set, so unsubscribe links cannot be signed. Refusing to send.", { status: 503 });
  }

  let body;
  try { body = await request.json(); } catch { body = {}; }
  const subject = clean(body.subject, 140);
  const text = clean(body.body, 20_000);
  if (!subject) return new Response("Subject required", { status: 400 });
  if (!text) return new Response("Body required", { status: 400 });

  const origin = new URL(request.url).origin;
  const compose = (to) => ({
    to,
    subject,
    text: `${text}\n\n—\nYou are getting this because you asked to hear when the directory changes.\nUnsubscribe: ${unsubLink(origin, to)}`,
  });

  // A test goes to the admin alone and never touches the list.
  if (body.test) {
    try {
      await sendBatch([compose(session.email)]);
      return Response.json({ test: true, sent: 1, failed: 0, to: session.email });
    } catch (e) {
      console.error("broadcast test:", e.message);
      return new Response(`Test send failed: ${e.message}`, { status: 502 });
    }
  }

  const list = await getSubscribers();
  const recipients = list.map((s) => s.email).filter(Boolean);
  if (!recipients.length) return Response.json({ sent: 0, failed: 0, total: 0 });

  let sent = 0;
  const failed = [];
  for (const group of chunk(recipients, BATCH_MAX)) {
    try {
      await sendBatch(group.map(compose));
      sent += group.length;
    } catch (e) {
      // One bad batch must not abandon the rest of the list.
      console.error("broadcast batch:", e.message);
      failed.push(...group);
    }
  }

  return Response.json({ sent, failed: failed.length, total: recipients.length });
}
