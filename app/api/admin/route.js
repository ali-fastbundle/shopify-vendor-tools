import { sessionFrom, isAdmin } from "@/lib/auth";
import { allow, ipOf } from "@/lib/ratelimit";
import { read, write, KEYS } from "@/lib/store";
import { getClaims, revokeClaim } from "@/lib/listings";
import { sendEvent, EVENTS, adminList } from "@/lib/mail";
import { sanitiseEntry, saveEntry, removeEntry, getEntries } from "@/lib/entries";
import { TOOLS } from "@/lib/tools";
import { timesAsked } from "@/lib/suggestions";

export const dynamic = "force-dynamic";

/*
 * Every request re-derives the session from the cookie and re-checks isAdmin.
 * The admin page performing the same check is a convenience for the person
 * looking at it, not a permission — this route is reachable directly with curl
 * and has to defend itself. Same 404 for signed-out and non-admin, so the
 * endpoint does not confirm it exists to someone without access.
 */
const DENY = () => new Response("Not found", { status: 404 });

export async function POST(request) {
  const session = sessionFrom(request);
  if (!session || !isAdmin(session.email)) return DENY();

  /*
   * After the admin check, so a stranger's requests neither consume the bucket
   * nor cost a Redis write. Generous enough to clear a large moderation
   * backlog by hand; low enough that a runaway client or a stolen session
   * cannot churn the store indefinitely.
   */
  if (!(await allow("admin", ipOf(request), 300, 60 * 60_000))) {
    return new Response("Too many admin actions this hour.", { status: 429 });
  }

  let body;
  try { body = await request.json(); } catch { body = {}; }
  const { action, id } = body;

  /*
   * Fires a real notification through the real sender and reports what actually
   * happened, so a misconfigured deployment can be diagnosed without waiting for
   * somebody to submit a suggestion and then guessing at the silence.
   *
   * Placed above the id check because a test has nothing to act on.
   */
  /*
   * Fire any event in the matrix with dummy data, to the admin address only.
   *
   * `adminOverride` forces the user-side copy to the admin too, so a test of
   * "what does a vendor get when their claim verifies" never reaches a vendor.
   * Awaited, because the result is the entire point of the button.
   *
   * Above the id check, because a test has nothing to act on.
   */
  if (action === "test-notification") {
    const origin = new URL(request.url).origin;
    const event = EVENTS.includes(body.event) ? body.event : "signin_new";
    const me = session.email;

    const dummy = {
      signin_new:     { email: me },
      signin_return:  { email: me },
      signin_link:    { email: me, link: `${origin}/api/auth/callback?token=TEST` },
      subscribe:      { email: me },
      review:         { email: me, toolName: "Applora", toolId: "applora", rating: 5, author: "Test", text: "A test review." },
      claim_verified: { email: me, toolName: "Applora", domain: "applora.ai", method: "email-domain" },
      suggestion:     { email: me, name: "Test Tool", url: "https://example.com", why: "A test suggestion.", by: "Test", approved: true, kindLabel: "Tools", catLabel: "App Store ASO" },
      report:         { email: me, toolName: "Applora", domain: "applora.ai", kindLabel: "Broken link", value: "A test report." },
      listing_edited: { email: me, toolName: "Applora", changed: ["price"], values: ["price: $0 (test)"], byAdmin: true },
    }[event] || { email: me };

    const result = await sendEvent(event, { ...dummy, origin, adminOverride: me });
    return Response.json({
      test: {
        event,
        ok: result.ok,
        sends: result.sends,
        nothingToSend: result.sends.length === 0,
        config: {
          resendKey: Boolean(process.env.RESEND_API_KEY),
          adminEmails: adminList().length,
          from: process.env.EMAIL_FROM || "(default onboarding@resend.dev)",
        },
      },
    });
  }

  if (!id || typeof id !== "string") return new Response("Missing id", { status: 400 });

  /*
   * Only a literal `true` reverts content. A missing or malformed flag leaves
   * the vendor's published edits alone, so the destructive reading is never the
   * one a garbled request falls back to.
   */
  const revertContent = body.revertContent === true;

  /*
   * "Mark reviewed", not "approve", and the difference is the whole point.
   *
   * This clears the moderation hold so the suggestion is served by /api/data
   * and visible in the public list. It does not create a listing and it never
   * will: a listing needs a `note` and a `watch`, which are editorial writing,
   * and publishing one is a hand edit to lib/tools.js. The button used to say
   * Approve, which reads like the last step before something appears in the
   * directory, and people reasonably assumed it was.
   *
   * The stored field is still `approved`, because rows written before this
   * rename carry it and renaming it would orphan them. `approve-suggestion` is
   * still accepted for the same reason — a client on an older page load should
   * not get an error for pressing the same button.
   */
  if (action === "mark-reviewed" || action === "approve-suggestion" || action === "delete-suggestion") {
    const suggestions = await read(KEYS.suggestions, []);
    if (!suggestions.some((s) => s.id === id)) {
      return new Response("Unknown suggestion", { status: 400 });
    }
    const next = action === "delete-suggestion"
      ? suggestions.filter((s) => s.id !== id)
      : suggestions.map((s) => (s.id === id ? { ...s, approved: true, reviewedAt: new Date().toISOString().slice(0, 10) } : s));
    await write(KEYS.suggestions, next);
    return Response.json({ suggestions: next });
  }

  /*
   * Approve, and it is live.
   *
   * The one place in this console where a click changes the public site. It
   * takes the draft as the admin edited it rather than as the model wrote it,
   * runs it through sanitiseEntry, and refuses rather than publishing a blank
   * caveat or a colliding id. `watch` is required and "none" is rejected: an
   * entry without a caveat is the vendor's own page with our name on it.
   *
   * The entry goes to svt:entries, which mergedTools() reads alongside
   * lib/tools.js. Nothing is written into the source file, which is both
   * invariant 4 and the only thing that works: a Vercel filesystem is read
   * only at runtime. See lib/entries.js.
   */
  if (action === "publish-entry") {
    const suggestions = await read(KEYS.suggestions, []);
    const suggestion = suggestions.find((s) => s.id === id);
    if (!suggestion) return new Response("Unknown suggestion", { status: 400 });

    const existing = await getEntries();
    const taken = [...TOOLS.map((t) => t.id), ...Object.keys(existing || {})];
    const incoming = body.entry && typeof body.entry === "object" ? body.entry : suggestion.draft;
    if (!incoming) return new Response("Nothing to publish. Research it first.", { status: 400 });

    /* An id already published from this same suggestion is a re-publish, not a
       collision, so it is allowed to overwrite itself. */
    const selfId = suggestion.publishedId || "";
    const { entry, error } = sanitiseEntry(incoming, {
      existingIds: taken.filter((t) => t !== selfId),
    });
    if (error) return new Response(error, { status: 400 });

    const saved = await saveEntry(entry, {
      publishedBy: session.email,
      suggestionId: suggestion.id,
      suggestedBy: timesAsked(suggestion),
      draftedBy: incoming.researchedBy || "",
    });

    const nextSuggestions = suggestions.map((s) => (s.id === id
      ? { ...s, approved: true, publishedId: saved.id, publishedAt: saved.publishedAt, draft: incoming }
      : s));
    await write(KEYS.suggestions, nextSuggestions);

    return Response.json({ suggestions: nextSuggestions, entry: saved, entries: await getEntries() });
  }

  /* Unpublish. The entry leaves the live site; the suggestion stays in the
     queue so the demand it represents is not lost with it. */
  if (action === "unpublish-entry") {
    const { removed, entries } = await removeEntry(id);
    if (!removed) return new Response("Unknown entry", { status: 400 });
    const suggestions = await read(KEYS.suggestions, []);
    const next = suggestions.map((s) => (s.publishedId === id ? { ...s, publishedId: "" } : s));
    await write(KEYS.suggestions, next);
    return Response.json({ entries, suggestions: next });
  }

  /* Editing a draft without publishing it, so a half-finished entry survives a
     page reload and two admins see the same thing. */
  if (action === "save-draft") {
    const suggestions = await read(KEYS.suggestions, []);
    if (!suggestions.some((s) => s.id === id)) {
      return new Response("Unknown suggestion", { status: 400 });
    }
    const draft = body.entry && typeof body.entry === "object" ? body.entry : null;
    if (!draft) return new Response("Nothing to save", { status: 400 });
    const next = suggestions.map((s) => (s.id === id ? { ...s, draft: { ...(s.draft || {}), ...draft } } : s));
    await write(KEYS.suggestions, next);
    return Response.json({ suggestions: next });
  }

  if (action === "resolve-report" || action === "dismiss-report") {
    const reports = await read(KEYS.reports, []);
    if (!reports.some((r) => r.id === id)) {
      return new Response("Unknown report", { status: 400 });
    }
    /*
     * Both outcomes keep the row and stamp it. A dismissed report is evidence
     * that somebody looked, which a deleted one is not — and the queue is small
     * enough that keeping them costs nothing.
     */
    const status = action === "resolve-report" ? "resolved" : "dismissed";
    const next = reports.map((r) => (r.id === id ? { ...r, status, closedAt: new Date().toISOString().slice(0, 10) } : r));
    await write(KEYS.reports, next);
    return Response.json({ reports: next });
  }

  if (action === "revoke-claim") {
    const claims = await getClaims();
    if (!claims[id]) return new Response("Unknown claim", { status: 400 });
    const { claims: next, reverted } = await revokeClaim(id, { revertContent });
    return Response.json({ claims: next, reverted });
  }

  return new Response("Unknown action", { status: 400 });
}
