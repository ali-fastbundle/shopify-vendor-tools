import { read, KEYS } from "@/lib/store";
import { sessionFrom } from "@/lib/auth";
import { publicReviews } from "@/lib/reviews";

export const dynamic = "force-dynamic";

/*
 * Reviews carry the reviewer's email so one account cannot rate the same tool
 * twice. It is the only private field in here, and it is stripped by
 * publicReviews() rather than by anything on this route — a consumer that
 * forgets the helper ships nothing rather than shipping addresses.
 *
 * Reading the session is a signature compare with no I/O. It buys the caller a
 * `mine` flag on their own review, which is how the form knows to open on it
 * and edit in place instead of writing a second one.
 *
 * Suggestions hide the submitter's address the same way, and `also` (the people
 * who asked for a duplicate) carries addresses too, so it does not go out here.
 * Nor does `draft`: that is a model's unreviewed entry about a named company,
 * caveat and all, and nobody has approved it. See invariant 21.
 */
const publicSuggestion = ({ email, also, draft, ...rest }) => rest;

export async function GET(request) {
  const session = sessionFrom(request);
  const [votes, reviews, suggestions] = await Promise.all([
    read(KEYS.votes, {}),
    read(KEYS.reviews, {}),
    read(KEYS.suggestions, []),
  ]);
  const visible = (suggestions || []).filter((s) => s.approved !== false).map(publicSuggestion);
  return Response.json({
    votes,
    reviews: publicReviews(reviews, session?.email || ""),
    suggestions: visible,
  });
}
