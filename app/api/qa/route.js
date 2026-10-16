import { sessionFrom } from "@/lib/auth";
import { allow, ipOf } from "@/lib/ratelimit";
import { catalogueTools } from "@/lib/entries";
import { ownsListing } from "@/lib/listings";
import { readQA, saveQA, addQuestion, addAnswer, publicQA } from "@/lib/qa";
import { sendEvent } from "@/lib/mail";

export const dynamic = "force-dynamic";

/*
 * Questions and answers on a tool (lib/qa.js).
 *
 * GET is the public read, with `mine` for whoever is looking. POST needs an
 * account, checked above the limiter (invariant 6), and the limit is a
 * review's: fifteen in ten minutes per IP. Whether an answer is the vendor's
 * is decided here from the claims store, never taken from the request.
 */
async function toolOf(id) {
  return (await catalogueTools()).find((t) => t.id === id) || null;
}

export async function GET(request) {
  const tool = await toolOf(new URL(request.url).searchParams.get("tool") || "");
  if (!tool) return new Response("Unknown tool", { status: 400 });
  const session = sessionFrom(request);
  const all = await readQA();
  return Response.json({ questions: publicQA(all[tool.id], session?.email || "") });
}

export async function POST(request) {
  const session = sessionFrom(request);
  if (!session) return new Response("Sign in to ask or answer.", { status: 401 });

  let body;
  try { body = await request.json(); } catch { body = {}; }
  const tool = await toolOf(String(body.toolId || ""));
  if (!tool) return new Response("Unknown tool", { status: 400 });

  if (!(await allow("qa", ipOf(request), 15, 10 * 60_000))) {
    return new Response("You have posted a few already. Try again later.", { status: 429 });
  }

  const origin = new URL(request.url).origin;
  const all = await readQA();

  if (body.action === "answer") {
    const vendor = await ownsListing(tool.id, session.email);
    const r = addAnswer(all, tool.id, String(body.questionId || ""), { author: body.author, text: body.text, email: session.email, vendor });
    if (r.error) return new Response(r.error, { status: 400 });
    await saveQA(r.qa);
    await sendEvent("answer", {
      origin, toolId: tool.id, toolName: tool.name, question: r.question.text, askerEmail: r.question.email,
      author: r.answer.author, text: r.answer.text, email: session.email, vendor,
    });
    return Response.json({ questions: publicQA(r.qa[tool.id], session.email) });
  }

  const r = addQuestion(all, tool.id, { author: body.author, text: body.text, email: session.email });
  if (r.error) return new Response(r.error, { status: 400 });
  await saveQA(r.qa);
  await sendEvent("question", { origin, toolName: tool.name, author: r.question.author, text: r.question.text, email: session.email });
  return Response.json({ questions: publicQA(r.qa[tool.id], session.email) });
}
