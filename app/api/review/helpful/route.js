import { read, write, KEYS } from "@/lib/store";
import { allow, ipOf } from "@/lib/ratelimit";
import { TOOLS } from "@/lib/tools";
import { sessionFrom } from "@/lib/auth";
import { publicReviews, toggleHelpful } from "@/lib/reviews";

export const dynamic = "force-dynamic";

/*
 * Marking a review helpful.
 *
 * Gated exactly like posting one, and for the reason the rating gate exists:
 * this decides which review a visitor reads first, which is at least as worth
 * buying as a star. An anonymous version would be one click repeated until the
 * review somebody wanted at the top was at the top.
 *
 * Nothing is emailed, either side. It is a vote, and votes send nothing.
 */
export async function POST(request) {
  /*
   * Above the limiter. Reading the session is a signature compare with no I/O,
   * so a signed-out request costs nothing; allow() costs a read and a write.
   * See the rate-limit note in CLAUDE.md.
   */
  const session = sessionFrom(request);
  if (!session) {
    return new Response("Sign in to mark a review helpful.", { status: 401 });
  }

  /*
   * Looser than posting a review, because reading a listing and marking three
   * of its reviews useful is normal behaviour, and tighter than the tool vote
   * limiter, because this one writes to the review store rather than a counter.
   */
  if (!(await allow("helpful", ipOf(request), 40, 10 * 60_000))) {
    return new Response("Too many of those just now. Try again shortly.", { status: 429 });
  }

  let body;
  try { body = await request.json(); } catch { body = {}; }

  if (!TOOLS.some((t) => t.id === body.toolId)) {
    return new Response("Unknown tool", { status: 400 });
  }
  if (!body.reviewId || typeof body.reviewId !== "string") {
    return new Response("Missing review", { status: 400 });
  }

  const stored = await read(KEYS.reviews, {});
  const result = toggleHelpful(stored, body.toolId, body.reviewId, session.email);

  if (result.error === "unknown") return new Response("Unknown review", { status: 400 });
  if (result.error === "own") {
    return new Response("You cannot mark your own review helpful.", { status: 403 });
  }

  await write(KEYS.reviews, result.reviews);
  return Response.json({
    reviews: publicReviews(result.reviews, session.email),
    marked: result.marked,
  });
}
