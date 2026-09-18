import { sessionFrom, isAdmin } from "@/lib/auth";
import { allow, ipOf } from "@/lib/ratelimit";
import { read, write, KEYS } from "@/lib/store";
import { researchSuggestion } from "@/lib/research";
import { configured } from "@/lib/model";
import { timesAsked } from "@/lib/suggestions";

export const dynamic = "force-dynamic";
/* Up to seven page fetches at 12s each, then a model call bounded at 90s. */
export const maxDuration = 180;

/*
 * Research a suggestion into a draft entry.
 *
 * Admin only, re-checked here rather than trusted from the page, and 404 for
 * anyone else so the endpoint does not confirm it exists. This one matters
 * more than the others in the admin surface: it spends money on a model call
 * and it fetches an arbitrary URL from our own servers, so it is not somewhere
 * to rely on the page having checked already.
 *
 * The draft is stored on the suggestion, not in the catalogue. Nothing here
 * reaches the public site. Publishing is a separate, deliberate click, because
 * a model reading a vendor's own site writes the vendor's version of the
 * truth and the caveats are the product.
 */
const DENY = () => new Response("Not found", { status: 404 });

export async function POST(request) {
  const session = sessionFrom(request);
  if (!session || !isAdmin(session.email)) return DENY();

  /* After the admin check, so a stranger's request costs nothing. Low, because
     each one of these is a model call and several page fetches. */
  if (!(await allow("research", ipOf(request), 40, 60 * 60_000))) {
    return new Response("Too much research this hour. Try again later.", { status: 429 });
  }

  if (!configured()) {
    return new Response("No model provider is configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY.", { status: 503 });
  }

  let body;
  try { body = await request.json(); } catch { body = {}; }
  const { id } = body;
  if (!id || typeof id !== "string") return new Response("Missing id", { status: 400 });

  const suggestions = await read(KEYS.suggestions, []);
  const suggestion = suggestions.find((s) => s.id === id);
  if (!suggestion) return new Response("Unknown suggestion", { status: 400 });

  const result = await researchSuggestion(suggestion);
  if (result.error) return new Response(result.error, { status: 502 });

  /*
   * Stored on the row so it survives a page reload and so two admins are
   * looking at the same draft. `researchedAt` is what the UI shows to say how
   * old the reading is, since a site can change under it.
   */
  const draft = {
    ...result.draft,
    suggestedBy: timesAsked(suggestion),
    researchedAt: new Date().toISOString(),
    researchedBy: result.provider,
    pagesRead: result.site.read,
    pagesFailed: result.site.failed,
  };
  const next = suggestions.map((s) => (s.id === id ? { ...s, draft } : s));
  await write(KEYS.suggestions, next);

  return Response.json({ suggestions: next, draft, provider: result.provider });
}
