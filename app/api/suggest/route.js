import { read, write, KEYS } from "@/lib/store";
import { allow, ipOf } from "@/lib/ratelimit";
import { CATEGORIES, RESOURCE_KINDS, kindOf } from "@/lib/tools";
import { entriesOf } from "@/lib/sections";
import { catalogueTools } from "@/lib/entries";
import { resolveSubmission } from "@/lib/dedup";
import { mergeDuplicate, timesAsked } from "@/lib/suggestions";
import { addInterest } from "@/lib/interest";
import { tally, tallyMany } from "@/lib/tallies";
import { sendEvent } from "@/lib/mail";
import { isEmail, normaliseEmail } from "@/lib/auth";

export const dynamic = "force-dynamic";
/* The model call is bounded at 20s inside lib/dedup, and this has to outlast
   it plus two store round trips. */
export const maxDuration = 60;

const clean = (s, max) => String(s || "").replace(/\s+/g, " ").trim().slice(0, max);

/*
 * What a visitor may see of a suggestion.
 *
 * `email` is the submitter's. `also` carries the addresses of everyone who
 * asked for the same thing after them. `draft` is the research entry a model
 * wrote and nobody has approved: unreviewed editorial prose about a named
 * company, including a `watch` note and a list of things it could not verify.
 * Publishing that is the one thing invariant 21 exists to prevent, and it was
 * going out to anyone who called this route.
 */
const publicOf = ({ email, also, draft, ...rest }) => rest;
/*
 * Out of scope rows are stored but not shown. They are a record of what people
 * expect to find here, which is useful to an editor and confusing to a visitor:
 * a list of merchant apps under a heading that says these are tools for app
 * vendors reads as though we could not tell the difference.
 *
 * Discovery rows are dropped for a different reason. This list is captioned as
 * what people have asked for, and a name we lifted off a competitor's own
 * comparison page is not that. It is held by `approved: false` as well; this is
 * the half that does not depend on MODERATE_SUGGESTIONS being set.
 */
const publicList = (list) => list
  .filter((s) => s.approved !== false && !s.outOfScope && !s.status && s.via !== "discovery")
  .map(publicOf);

/*
 * MODERATE_SUGGESTIONS=true holds new entries back with approved:false, so they
 * are stored but not served by /api/data. Flip an entry by hand in Redis, or
 * leave the flag off and accept that you will prune.
 */
export async function POST(request) {
  const ip = ipOf(request);

  /*
   * The flood guard, and the only limit that applies to every submission.
   *
   * It is here rather than lower down because the dedup below costs a model
   * call, and that is the thing worth protecting from a loop. It is generous
   * on purpose: a person reading the directory and suggesting half a dozen
   * things, most of which turn out to be listed already, must never meet it.
   *
   * The tight budget is further down, on the one outcome that actually creates
   * work. See the note above it.
   */
  if (!(await allow("suggest-burst", ip, 30, 60 * 60_000))) {
    return new Response("That is a lot of submissions from one place. Try again a bit later.", { status: 429 });
  }
  const body = await request.json();
  const name = clean(body.name, 60);
  if (!name) return new Response("Name required", { status: 400 });

  const url = clean(body.url, 200);
  if (url && !/^https?:\/\/[^\s]+\.[^\s]+$/.test(url)) {
    return new Response("That URL does not look right", { status: 400 });
  }

  const moderate = process.env.MODERATE_SUGGESTIONS === "true";
  const suggestions = await read(KEYS.suggestions, []);
  const kind = RESOURCE_KINDS.some((k) => k.id === body.kind) ? body.kind : "tool";
  const submission = {
    name,
    url,
    kind,
    cat: CATEGORIES.some((c) => c.id === body.cat) ? body.cat : CATEGORIES[0].id,
    why: clean(body.why, 600),
    by: clean(body.by, 40) || "Anonymous",
    // Optional. Only used to thank them and to ask a follow-up if the entry is thin.
    email: isEmail(normaliseEmail(body.email)) ? normaliseEmail(body.email) : "",
    date: new Date().toISOString().slice(0, 10),
  };

  /*
   * What this is compared against.
   *
   * Tools get the file plus anything published from the admin queue, because
   * an entry approved yesterday is as listed as one written a year ago. Other
   * kinds get their own published catalogue. Published, in both cases: a draft
   * is not listed, so answering "already listed" about one would be a lie, and
   * somebody asking for something already in draft is the demand signal that
   * makes it worth finishing.
   *
   * Only same-kind suggestions are candidates for a merge. A podcast called
   * Shoptalk and a tool called Shoptalk are not the same request.
   */
  const catalogue = kind === "tool" ? await catalogueTools() : entriesOf(kind);
  const sameKind = suggestions.filter((s) => (s.kind || "tool") === kind);

  const { kind: outcome, id: matchedId, decidedBy, audience, audienceReason, outOfScope } =
    await resolveSubmission(submission, { catalogue, suggestions: sameKind });

  /*
   * Already in the directory. No queue row is created, because the useful
   * answer is the link rather than a task for an editor. But the asking is
   * recorded: somebody went looking for this and did not find it, and the
   * fourth person to do that is saying something about the tool and something
   * about our own navigation. See lib/interest.js.
   */
  if (outcome === "tool") {
    const listed = catalogue.find((t) => t.id === matchedId);
    if (listed) {
      await tallyMany(["suggestions:received", "suggestions:listed"]);
      const count = await addInterest(listed.id, submission);
      return Response.json({
        alreadyListed: { id: listed.id, name: listed.name, url: listed.url, kind, count },
        decidedBy,
        suggestions: publicList(suggestions),
      });
    }
  }

  /*
   * Somebody has already asked for this. Increment the row that exists rather
   * than writing a second one, so the queue shows demand instead of hiding it
   * across duplicate entries. Every submitted URL and reason is kept on the
   * row: the second person's reason is usually not the first person's.
   */
  if (outcome === "suggestion") {
    const duplicate = suggestions.find((s) => s.id === matchedId);
    if (duplicate) {
      await tallyMany(["suggestions:received", "suggestions:duplicate"]);
      const merged = mergeDuplicate(duplicate, submission);
      const next = suggestions.map((s) => (s.id === duplicate.id ? merged : s));
      await write(KEYS.suggestions, next);

      await sendEvent("suggestion", {
        origin: new URL(request.url).origin,
        name: merged.name, url: merged.url, why: submission.why, by: submission.by,
        email: submission.email, approved: merged.approved,
        alsoAsked: timesAsked(merged),
        kindLabel: kindOf(kind).label,
        catLabel: kind === "tool" ? (CATEGORIES.find((c) => c.id === merged.cat)?.label || merged.cat) : "",
      });

      return Response.json({
        duplicate: { name: merged.name, count: timesAsked(merged) },
        decidedBy,
        suggestions: publicList(next),
      });
    }
  }

  /*
   * A new row in the queue, and the only outcome that makes work for anybody.
   *
   * The tight budget lives here rather than at the top of the route, which is
   * the bug this comment exists to prevent coming back. It used to gate every
   * submission, so the fourth person in an hour to suggest a tool that was
   * already listed got "Suggestion limit reached" instead of a link to the
   * thing they were looking for. Nothing had been created on any of the three
   * before it either: they were all answered from the catalogue.
   *
   * Being told something is already listed must never be rate limited. It
   * creates nothing, it is the answer the person wanted, and refusing it
   * teaches them the form is broken. Same for a merge into an existing row.
   * Only this branch spends anybody's attention, so only this branch is
   * capped.
   */
  if (!(await allow("suggest", ip, 3, 60 * 60_000))) {
    return new Response("Suggestion limit reached for this hour.", { status: 429 });
  }

  const entry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    ...submission,
    count: 1,
    approved: moderate ? false : true,
    /*
     * Recorded rather than refused. What people expect to find here is worth
     * knowing: a run of merchant apps says the front page is not being read
     * the way it is written.
     */
    ...(outOfScope ? { outOfScope: true, outOfScopeReason: audienceReason || "", audience } : {}),
  };
  const next = [entry, ...suggestions].slice(0, 500);
  await write(KEYS.suggestions, next);
  await tallyMany(outOfScope
    ? ["suggestions:received", "suggestions:outofscope"]
    : ["suggestions:received"]);

  /*
   * The same event either way, carrying the verdict. The admin copy says no
   * action is needed and the submitter's thank-you tells them the truth about
   * where it will and will not appear, rather than the default "it goes in
   * after a check", which would be a promise we are not going to keep.
   */
  await sendEvent("suggestion", {
    origin: new URL(request.url).origin,
    name: entry.name, url: entry.url, why: entry.why, by: entry.by,
    email: entry.email, approved: entry.approved,
    kindLabel: kindOf(entry.kind).label,
    catLabel: entry.kind === "tool" ? (CATEGORIES.find((c) => c.id === entry.cat)?.label || entry.cat) : "",
    outOfScope, outOfScopeReason: audienceReason || "",
  });

  /*
   * Out of scope still succeeds. They took the trouble to send it, the answer
   * is a clear one, and an error would tell them the form is broken rather
   * than that the directory is narrower than they thought.
   */
  if (outOfScope) {
    return Response.json({
      outOfScope: { name: entry.name, reason: audienceReason || "" },
      decidedBy,
      suggestions: publicList(next),
    });
  }

  return Response.json({ suggestions: publicList(next), decidedBy });
}
