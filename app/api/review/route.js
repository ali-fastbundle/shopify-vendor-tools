import { read, write, KEYS } from "@/lib/store";
import { allow, ipOf } from "@/lib/ratelimit";
import { TOOLS } from "@/lib/tools";
import { sessionFrom } from "@/lib/auth";
import { notifyAdmin } from "@/lib/notify";
import { renderEmail, sendMail } from "@/lib/email";
import { background } from "@/lib/background";

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

  const tool = TOOLS.find((t) => t.id === body.id);
  const origin = new URL(request.url).origin;

  // Deliberately not awaited. See lib/notify.js.
  notifyAdmin(`${entry.rating}\u2605 review of ${tool.name}`, [
    `Tool: ${tool.name}`,
    `Rating: ${entry.rating} out of 5`,
    `By: ${entry.author}`,
    entry.text ? `\nWrote:\n${entry.text}` : "No text, rating only.",
  ], { origin, event: "review" });

  /*
   * Thanking someone needs an address, and the review form never asks for one —
   * so this only fires for a signed-in visitor, whose address we already hold
   * from the magic link. An anonymous review gets no email, by construction.
   */
  const session = sessionFrom(request);
  if (session?.email) {
    const { html, text } = renderEmail({
      heading: `Thanks for reviewing ${tool.name}`,
      paragraphs: [
        `Your ${entry.rating}-star review is live on the ${tool.name} listing.`,
        "Reviews from people who have actually used a tool are the part of this directory we cannot write ourselves, so thank you.",
        "They are shown separately from any external scores on the listing, and the two are never averaged together.",
      ],
      button: { label: `See the ${tool.name} listing`, url: `${origin}/?tool=${encodeURIComponent(tool.id)}` },
    });
    background(sendMail({ to: session.email, subject: `Thanks for reviewing ${tool.name}`, text, html }), "review-thank-you");
  }

  return Response.json({ reviews });
}
