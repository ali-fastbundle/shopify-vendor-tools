import { normaliseEmail } from "@/lib/auth";
import { allow, ipOf } from "@/lib/ratelimit";
import { removeSubscriber, validUnsubToken } from "@/lib/subscribers";
import { DARK } from "@/lib/tools";

export const dynamic = "force-dynamic";

/*
 * Reached by clicking a link in an email, so it has to be a GET and has to
 * answer with a page rather than JSON.
 *
 * It is one page rendered as a string, with no stylesheet behind it, so it
 * reads the literal DARK palette — a CSS variable would resolve to nothing
 * here — and stays dark whatever the visitor's theme is. There is no session
 * and nothing to carry a preference in.
 *
 * The token is an HMAC of the address, so a valid link proves it came from us
 * and cannot be edited to unsubscribe somebody else. Removal is idempotent and
 * the page is identical whether or not the address was on the list, so this is
 * not a membership oracle either.
 */
const page = (title, detail, status = 200) =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<meta name="robots" content="noindex">` +
    `<title>${title}</title></head>` +
    `<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;` +
    `background:${DARK.bg};color:${DARK.text};font-family:Inter,system-ui,-apple-system,sans-serif;padding:24px">` +
    `<div style="max-width:46ch">` +
    `<h1 style="font-size:24px;font-weight:800;letter-spacing:-0.03em;margin:0">${title}</h1>` +
    `<p style="font-size:15px;color:${DARK.muted};line-height:1.6;margin:10px 0 0">${detail}</p>` +
    `<p style="margin:18px 0 0"><a href="/" style="color:#00E08A;font-size:14px">Back to the directory</a></p>` +
    `</div></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8" } },
  );

export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const email = normaliseEmail(params.get("email"));
  const token = params.get("token");

  if (!email || !validUnsubToken(email, token)) {
    return page(
      "That link is not valid",
      "It may have been trimmed by your email client. Copy the whole link from the " +
      "message, or reply to any email from the directory and the address will be " +
      "removed by hand.",
    );
  }

  /*
   * Deliberately after the token check, which does no I/O — a bad token is
   * rejected on an HMAC compare alone and never reaches Redis. allow() costs a
   * read and a write, so limiting first would turn the cheapest rejection into
   * the most expensive one and hand an attacker amplification. Past the token
   * check the request is doing real work, which is what is worth bounding.
   */
  const ip = ipOf(request);
  if (!(await allow("unsubscribe", ip, 20, 60 * 60_000))) {
    return page(
      "Try that again shortly",
      "Too many requests from this address in the last hour. The link is still good — " +
      "open it again in a few minutes.",
      429,
    );
  }

  await removeSubscriber(email);
  return page(
    "Removed",
    "That address is off the list and will not get another email. Nothing else was " +
    "changed — any listing claims or reviews are untouched.",
  );
}
