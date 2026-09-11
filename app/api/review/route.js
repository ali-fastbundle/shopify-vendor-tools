import { read, write, KEYS } from "@/lib/store";
import { allow, ipOf } from "@/lib/ratelimit";
import { TOOLS } from "@/lib/tools";

export const dynamic = "force-dynamic";

const clean = (s, max) => String(s || "").replace(/\s+/g, " ").trim().slice(0, max);

export async function POST(request) {
  const ip = ipOf(request);
  if (!(await allow("review", ip, 5, 10 * 60_000))) {
    return new Response("You have posted a few reviews already. Try again later.", { status: 429 });
  }
  const body = await request.json();
  if (!TOOLS.some((t) => t.id === body.id)) return new Response("Unknown tool", { status: 400 });
  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return new Response("Rating must be 1 to 5", { status: 400 });
  }

  const reviews = await read(KEYS.reviews, {});
  const entry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    author: clean(body.author, 40) || "Anonymous",
    rating,
    text: clean(body.text, 600),
    date: new Date().toISOString().slice(0, 10),
  };
  reviews[body.id] = [entry, ...(reviews[body.id] || [])].slice(0, 200);
  await write(KEYS.reviews, reviews);
  return Response.json({ reviews });
}
