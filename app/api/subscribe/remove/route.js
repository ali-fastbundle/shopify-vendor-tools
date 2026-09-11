import { normaliseEmail } from "@/lib/auth";
import { removeSubscriber, validUnsubToken } from "@/lib/subscribers";
import { C } from "@/lib/tools";

export const dynamic = "force-dynamic";

/*
 * Reached by clicking a link in an email, so it has to be a GET and has to
 * answer with a page rather than JSON.
 *
 * The token is an HMAC of the address, so a valid link proves it came from us
 * and cannot be edited to unsubscribe somebody else. Removal is idempotent and
 * the page is identical whether or not the address was on the list, so this is
 * not a membership oracle either.
 */
const page = (title, detail) =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<meta name="robots" content="noindex">` +
    `<title>${title}</title></head>` +
    `<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;` +
    `background:${C.bg};color:${C.text};font-family:Archivo,Inter,system-ui,sans-serif;padding:24px">` +
    `<div style="max-width:46ch">` +
    `<h1 style="font-size:24px;font-weight:800;letter-spacing:-0.03em;margin:0">${title}</h1>` +
    `<p style="font-size:15px;color:${C.muted};line-height:1.6;margin:10px 0 0">${detail}</p>` +
    `<p style="margin:18px 0 0"><a href="/" style="color:#00E08A;font-size:14px">Back to the directory</a></p>` +
    `</div></body></html>`,
    { status: 200, headers: { "content-type": "text/html; charset=utf-8" } },
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

  await removeSubscriber(email);
  return page(
    "Removed",
    "That address is off the list and will not get another email. Nothing else was " +
    "changed — any listing claims or reviews are untouched.",
  );
}
