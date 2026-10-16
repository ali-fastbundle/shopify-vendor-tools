import { sessionFrom, isAdmin } from "@/lib/auth";
import { allow, ipOf } from "@/lib/ratelimit";
import { catalogueTools } from "@/lib/entries";
import { CONTACTS } from "@/lib/vendorContacts";
import { readOutreach, readMeta, markContacted, markReplied, clearOutreach, acknowledgeResend, recordOutreach, RESEND_PER_DAY } from "@/lib/outreach";
import { unfilled } from "@/lib/outreachTemplate";
import { sendEvent } from "@/lib/mail";

export const dynamic = "force-dynamic";

/*
 * Outreach to listed vendors (lib/outreach.js). Admin only, 404 to anyone
 * else (invariant 7).
 *
 *   contacted  the admin sent it from their own mailbox (the default path)
 *   replied    the vendor wrote back
 *   clear      undo a mistaken mark
 *   send       through Resend, from watchfor.tools, reply_to the admin
 *
 * Send is the guarded one. It only ever goes to the address recorded in
 * lib/vendorContacts.js from the vendor's own site, never to one typed in,
 * because a guessed address bounces and the bounce lands on the domain the
 * sign-in links come from. It refuses a vendor already contacted, it is
 * rationed per day across everyone, and the first send needs an explicit
 * acknowledgement of that cost.
 */
const DENY = () => new Response("Not found", { status: 404 });

export async function POST(request) {
  const session = sessionFrom(request);
  if (!session || !isAdmin(session.email)) return DENY();
  let body;
  try { body = await request.json(); } catch { body = {}; }
  const tool = (await catalogueTools()).find((t) => t.id === String(body.toolId || ""));
  if (!tool && body.action !== "acknowledge") return new Response("Unknown tool", { status: 400 });
  const contact = tool ? CONTACTS[tool.id] : null;
  const done = async (r) => (r.error ? new Response(r.error, { status: 400 }) : Response.json({ outreach: await readOutreach(), meta: await readMeta() }));

  if (body.action === "acknowledge") return Response.json({ meta: await acknowledgeResend(session.email) });
  if (body.action === "contacted") return done(await markContacted(tool.id, { to: contact?.email || "", via: "own mailbox", subject: String(body.subject || "").slice(0, 200), by: session.email }));
  if (body.action === "replied") return done(await markReplied(tool.id, session.email));
  if (body.action === "clear") return done(await clearOutreach(tool.id, session.email));

  if (body.action === "send") {
    if (!contact?.email) return new Response("No address is published on their site, so there is nothing to send to. Use LinkedIn.", { status: 400 });
    if (contact.caution) return new Response(`This address is marked for caution: ${contact.caution} Copy it and send from your own mailbox, where a bounce costs nothing.`, { status: 400 });
    const subject = String(body.subject || "").replace(/\s+/g, " ").trim().slice(0, 200);
    const text = String(body.body || "").replace(/\r/g, "").trim();
    if (subject.length < 5 || text.length < 40) return new Response("Write the subject and the email first.", { status: 400 });
    const left = [...unfilled(subject), ...unfilled(text)];
    if (left.length) return new Response(`Fill or remove ${left.join(", ")} before sending.`, { status: 400 });
    if (/—/.test(subject + text)) return new Response("It has an em dash. Use a comma or two sentences.", { status: 400 });
    const state = (await readOutreach())[tool.id];
    if (state?.contactedAt && body.again !== true) return new Response(`${tool.name} was already contacted on ${String(state.contactedAt).slice(0, 10)}. Tick "send again" if that is on purpose.`, { status: 409 });
    const meta = await readMeta();
    if (!meta.resendAcknowledgedAt) return new Response("first-send", { status: 428 });
    if (!(await allow("outreach-send", "all", RESEND_PER_DAY, 24 * 60 * 60_000))) {
      return new Response(`That is ${RESEND_PER_DAY} through watchfor.tools today. Send the rest from your own mailbox.`, { status: 429 });
    }
    const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    const r = await sendEvent("outreach", { to: contact.email, subject, paragraphs, replyTo: session.email });
    if (!r.ok) return new Response(`Resend did not send it: ${r.sends.map((x) => x.error).filter(Boolean).join("; ") || "no detail"}`, { status: 502 });
    await recordOutreach(tool.id, { status: "contacted", contactedAt: new Date().toISOString(), via: "watchfor.tools (Resend)", to: contact.email },
      { what: "contacted", via: "watchfor.tools (Resend)", to: contact.email, by: session.email });
    return Response.json({ outreach: await readOutreach(), meta });
  }
  return new Response("Unknown action.", { status: 400 });
}
