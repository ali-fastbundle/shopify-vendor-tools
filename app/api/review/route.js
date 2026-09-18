import { read, write, KEYS } from "@/lib/store";
import { allow, ipOf } from "@/lib/ratelimit";
import { catalogueTools, isListedId } from "@/lib/entries";
import { sessionFrom } from "@/lib/auth";
import { publicReviews, upsertReview } from "@/lib/reviews";
import { sendEvent } from "@/lib/mail";

export const dynamic = "force-dynamic";

const clean = (s, max) => String(s || "").replace(/\s+/g, " ").trim().slice(0, max);

export async function POST(request) {
  /*
   * Sign-in first, and before the limiter on purpose. Reading the session is a
   * signature compare with no I/O, so a signed-out request costs nothing;
   * limiting first would turn the cheapest rejection on this route into a
   * Redis read and a Redis write. See the rate-limit note in CLAUDE.md.
   *
   * This is the credibility layer. An anonymous rating is one click repeated
   * as often as somebody likes, which makes the directory's own signal the
   * easiest number on the page to fake.
   */
  const session = sessionFrom(request);
  if (!session) {
    return new Response("Sign in to rate or review. One rating per account per tool.", { status: 401 });
  }

  if (!(await allow("review", ipOf(request), 15, 10 * 60_000))) {
    return new Response("You have posted a few reviews already. Try again later.", { status: 429 });
  }
  const body = await request.json();
  if (!(await isListedId(body.id))) return new Response("Unknown tool", { status: 400 });
  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return new Response("Rating must be 1 to 5", { status: 400 });
  }

  const stored = await read(KEYS.reviews, {});
  const entry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    author: clean(body.author, 40) || "Anonymous",
    rating,
    text: clean(body.text, 600),
    date: new Date().toISOString().slice(0, 10),
    // The key the one-per-account rule turns on. Never served; see lib/reviews.js.
    email: session.email,
  };
  const { reviews, replaced } = upsertReview(stored, body.id, entry);
  await write(KEYS.reviews, reviews);

  const tool = (await catalogueTools()).find((t) => t.id === body.id);
  await sendEvent("review", {
    origin: new URL(request.url).origin,
    toolName: tool.name, toolId: tool.id,
    rating: entry.rating, author: entry.author, text: entry.text,
    email: session.email, edited: replaced,
  });

  return Response.json({ reviews: publicReviews(reviews, session.email), replaced });
}
