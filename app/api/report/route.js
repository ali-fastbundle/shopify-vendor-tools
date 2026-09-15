import { read, write, KEYS } from "@/lib/store";
import { allow, ipOf } from "@/lib/ratelimit";
import { TOOLS, reportKindOf } from "@/lib/tools";
import { isEmail, normaliseEmail } from "@/lib/auth";
import { notifyAdmin } from "@/lib/notify";

export const dynamic = "force-dynamic";

const clean = (s, max) => String(s || "").replace(/\s+/g, " ").trim().slice(0, max);

/*
 * A correction is a message to the editor, never an edit.
 *
 * This route writes to svt:reports and nowhere else. It does not touch the
 * catalogue and it does not touch svt:overrides, so no unauthenticated caller
 * can move a listing by filing a report — the worst case is a queue item
 * somebody has to read and dismiss. That separation is the whole design; if a
 * future version applies a report automatically, it stops being safe to leave
 * open to anyone.
 *
 * No sign-in required, on purpose: the person who spots a dead link is usually
 * not the person who owns the listing.
 */
export async function POST(request) {
  const ip = ipOf(request);
  if (!(await allow("report", ip, 5, 60 * 60_000))) {
    return new Response("Too many reports from here. Try again in an hour.", { status: 429 });
  }

  let body;
  try { body = await request.json(); } catch { body = {}; }

  const tool = TOOLS.find((t) => t.id === body.toolId);
  if (!tool) return new Response("Unknown tool", { status: 400 });

  const kind = reportKindOf(body.kind);
  if (!kind) return new Response("Pick what is wrong", { status: 400 });

  const value = clean(body.value, 500);
  if (kind.needsValue && !value) {
    return new Response(`Add the detail: ${kind.hint}`, { status: 400 });
  }

  // A URL, when they give one, has to look like one. Anything else is free text.
  if (value && /^[a-z][a-z0-9+.-]*:/i.test(value) && !/^https?:\/\/[^\s]+\.[^\s]+$/i.test(value)) {
    return new Response("That link does not look right. Use a full https:// URL.", { status: 400 });
  }

  const email = normaliseEmail(body.email);
  if (body.email && !isEmail(email)) {
    return new Response("That email does not look right", { status: 400 });
  }

  const entry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    toolId: tool.id,
    toolName: tool.name,
    kind: kind.id,
    value,
    email: email || "",
    date: new Date().toISOString().slice(0, 10),
    status: "open",
  };

  const reports = await read(KEYS.reports, []);
  await write(KEYS.reports, [entry, ...reports].slice(0, 500));

  const origin = new URL(request.url).origin;
  // Deliberately not awaited. See lib/notify.js.
  notifyAdmin(`Report on ${tool.name}: ${kind.label}`, [
    `Tool: ${tool.name} (${tool.domain})`,
    `Problem: ${kind.label}`,
    value ? `They say: ${value}` : "No detail given.",
    entry.email ? `From: ${entry.email}` : "No email given.",
    "\nNothing has changed on the listing. Reports are a queue, not an edit.",
  ], { origin, event: "report" });

  return Response.json({ ok: true });
}
