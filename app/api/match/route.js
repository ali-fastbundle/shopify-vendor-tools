import { catalogueTools } from "@/lib/entries";
import { getOverrides, mergedNewsletters, mergedEvents } from "@/lib/listings";
import { allow, ipOf } from "@/lib/ratelimit";
import { askJson, configured } from "@/lib/model";
import { VOICE_RULES } from "@/lib/voice";
import { directoryFor, directoryText, validate, keywordAnswer, buildPrompt, SYSTEM } from "@/lib/intentMatch";
import { logQuestion } from "@/lib/matchLog";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/*
 * Ask the directory (lib/intentMatch.js): an intent in the person's own words,
 * answered from every section, grouped by kind, each with a reason. The model
 * is never the only path (invariant 20): with no provider, or when every
 * provider fails, the same lists are matched by keyword and the answer says so.
 *
 * What may be returned is built before the model sees anything. Tools are
 * `catalogueTools()` filtered by `recommendable` (invariant 35) and by winding
 * down with the admin's override (setDying), so the model is never shown a
 * flagged tool and `validate` checks every key against the same list.
 *
 * Every question is logged, answered or not (lib/matchLog.js).
 */
export async function POST(request) {
  const ip = ipOf(request);
  if (!(await allow("match", ip, 20, 60 * 60_000))) {
    return new Response("Limit reached for this hour.", { status: 429 });
  }

  let body = {};
  try { body = await request.json(); } catch {}
  const q = String(body.problem || body.q || "").replace(/\s+/g, " ").trim().slice(0, 600);
  if (!q) return new Response("Ask something first", { status: 400 });

  const [all, newsletters, events, overrides] = await Promise.all([
    catalogueTools(), mergedNewsletters(), mergedEvents(), getOverrides().catch(() => ({})),
  ]);
  /* Winding down read with the admin's override over the file, as every page shows it. */
  const dying = (t) => (overrides[t.id] && "dying" in overrides[t.id] ? overrides[t.id].dying === true : t.dying === true);
  const items = directoryFor({ tools: all, newsletters, events }, { dying });

  if (configured()) {
    try {
      const { data, provider } = await askJson({
        system: SYSTEM,
        prompt: buildPrompt(directoryText(items), q, VOICE_RULES),
        maxTokens: 1400,
        timeoutMs: 25_000,
      });
      const answer = validate(data, items);
      await logQuestion({ q, ...answer, path: "model", provider });
      return Response.json({ ...answer, path: "model", provider });
    } catch (e) {
      console.error("[match] all providers failed:", e.message);
      const answer = keywordAnswer(q, items);
      await logQuestion({ q, ...answer, path: "keyword", error: e.message });
      return Response.json({ ...answer, path: "keyword" });
    }
  }
  const answer = keywordAnswer(q, items);
  await logQuestion({ q, ...answer, path: "keyword", error: "no provider" });
  return Response.json({ ...answer, path: "keyword" });
}
