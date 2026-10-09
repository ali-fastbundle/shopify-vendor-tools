import { DARK } from "./tools";

/*
 * A one-screen answer for a link clicked in an email: confirm, stop updates.
 * Rendered as a string with no stylesheet behind it, so it reads the literal
 * DARK palette, the same as /api/subscribe/remove. `link` is an optional
 * { label, href } on our own origin.
 */
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export function noticePage(title, detail, { status = 200, link = { label: "Back to the directory", href: "/" } } = {}) {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<meta name="robots" content="noindex">` +
    `<title>${esc(title)}</title></head>` +
    `<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;` +
    `background:${DARK.bg};color:${DARK.text};font-family:Inter,system-ui,-apple-system,sans-serif;padding:24px">` +
    `<div style="max-width:46ch">` +
    `<h1 style="font-size:24px;font-weight:800;letter-spacing:-0.03em;margin:0">${esc(title)}</h1>` +
    `<p style="font-size:15px;color:${DARK.muted};line-height:1.6;margin:10px 0 0">${esc(detail)}</p>` +
    `<p style="margin:18px 0 0"><a href="${esc(link.href)}" style="color:#00E08A;font-size:14px">${esc(link.label)}</a></p>` +
    `</div></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}
