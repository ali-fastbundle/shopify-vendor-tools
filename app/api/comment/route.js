import { sessionFrom } from "@/lib/auth";
import { allow, ipOf } from "@/lib/ratelimit";
import { postBySlug } from "@/lib/blog";
import { readComments, saveComments, addComment, publicComments } from "@/lib/comments";
import { sendEvent } from "@/lib/mail";

export const dynamic = "force-dynamic";

/*
 * Comments on a blog post (lib/comments.js).
 *
 * GET is the public read, with `mine` for whoever is looking. POST needs an
 * account, checked above the limiter because reading the session is a
 * signature compare with no I/O (invariant 6), and the limit is a review's:
 * fifteen in ten minutes per IP. A comment is live at once and lands in the
 * admin Inbox to be read.
 */
export async function GET(request) {
  const slug = new URL(request.url).searchParams.get("post") || "";
  if (!postBySlug(slug)) return new Response("Unknown post", { status: 400 });
  const session = sessionFrom(request);
  const all = await readComments();
  return Response.json({ comments: publicComments(all[slug], session?.email || "") });
}

export async function POST(request) {
  const session = sessionFrom(request);
  if (!session) return new Response("Sign in to comment.", { status: 401 });

  let body;
  try { body = await request.json(); } catch { body = {}; }
  const post = postBySlug(String(body.post || ""));
  if (!post) return new Response("Unknown post", { status: 400 });

  if (!(await allow("comment", ipOf(request), 15, 10 * 60_000))) {
    return new Response("You have posted a few comments already. Try again later.", { status: 429 });
  }

  const all = await readComments();
  const r = addComment(all, post.slug, { author: body.author, text: body.text, email: session.email });
  if (r.error) return new Response(r.error, { status: 400 });
  await saveComments(r.comments);

  await sendEvent("comment", {
    origin: new URL(request.url).origin,
    postTitle: post.title, slug: post.slug, author: r.comment.author, text: r.comment.text, email: session.email,
  });

  return Response.json({ comments: publicComments(r.comments[post.slug], session.email) });
}
