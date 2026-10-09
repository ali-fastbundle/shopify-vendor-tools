/*
 * The blog: long-form editorial that a listing cannot hold, such as a whole
 * category side by side.
 *
 * Posts are data, not JSX, so one source renders three ways without drifting:
 * the page (components/BlogPost.jsx), the RSS item (full HTML, /blog/rss) and
 * plain text (llms.txt). A post is a list of blocks:
 *
 *   { h2 }  { h3 }  { p }  { ul: [...] }  { table: { head: [...], rows: [[...]] } }
 *   { note }   a set-apart paragraph, for the frame or a correction
 *
 * and every string in a block may carry two inline marks:
 *
 *   [label](tool:id)     a link to a listing. `tool:`, `newsletter:`,
 *                        `event:` and `category:` resolve to our own pages;
 *                        anything else must be absolute https. A post links a
 *                        listing rather than repeating it, so a tool's price
 *                        and caveat live in one place and a post cannot go
 *                        stale on them separately.
 *   {†text}              a claim we have not checked: the vendor's own figure,
 *                        or anything repeated rather than verified. Rendered
 *                        with a dagger and a legend, so the reader can always
 *                        tell what was read on a vendor's own site from what
 *                        the vendor says about itself.
 *
 * `scripts/blog-test.mjs` resolves every link against the catalogue, so a
 * renamed id or a typo fails the test rather than shipping a 404.
 *
 * Drafts follow invariant 12: `ALL_POSTS` as written, `POSTS` published, and
 * every route imports the plain name.
 */
import { published } from "./drafts";
import { TOOLS, CATEGORIES } from "./tools";
import { NEWSLETTERS } from "./newsletters";
import { EVENTS } from "./events";
import asoToolsCompared from "./posts/aso-tools-compared";

export const ALL_POSTS = [asoToolsCompared];
export const POSTS = published(ALL_POSTS).sort((a, b) => b.date.localeCompare(a.date));

export const postBySlug = (slug) => POSTS.find((p) => p.slug === slug) || null;

export const UNVERIFIED_LEGEND = "Marked † means the vendor's own claim, not checked independently.";

/* ---------------- inline marks ---------------- */

const INLINE = /\[([^\]]+)\]\(([^)\s]+)\)|\{†([^}]+)\}/g;

/** Split a string into text, link and claim tokens. Pure. */
export function inline(str) {
  const out = [];
  let last = 0;
  for (const m of String(str).matchAll(INLINE)) {
    if (m.index > last) out.push({ t: "text", text: str.slice(last, m.index) });
    if (m[3] !== undefined) out.push({ t: "claim", text: m[3] });
    else out.push({ t: "link", text: m[1], ref: m[2] });
    last = m.index + m[0].length;
  }
  if (last < String(str).length) out.push({ t: "text", text: String(str).slice(last) });
  return out;
}

/** A link reference to a path on this site or an absolute URL, or null if it points at nothing. */
export function resolveRef(ref) {
  const [kind, id] = String(ref).split(":");
  if (kind === "tool") return TOOLS.some((t) => t.id === id) ? `/tools/${id}` : null;
  if (kind === "newsletter") return NEWSLETTERS.some((n) => n.id === id) ? `/newsletters/${id}` : null;
  if (kind === "event") return EVENTS.some((e) => e.id === id) ? `/events/${id}` : null;
  if (kind === "category") return CATEGORIES.some((c) => c.id === id) ? `/categories/${id}` : null;
  if (/^https:\/\//.test(ref)) return ref;
  if (ref.startsWith("/")) return ref;
  return null;
}

/** Every string a post contains, for the test and the plain-text forms. */
export function strings(post) {
  const out = [post.title, post.description];
  for (const b of post.body) {
    for (const k of ["h2", "h3", "p", "note"]) if (b[k]) out.push(b[k]);
    if (b.ul) out.push(...b.ul);
    if (b.table) out.push(...b.table.head, ...b.table.rows.flat());
  }
  return out;
}

/* ---------------- plain text and HTML ---------------- */

const plainInline = (s, abs) => inline(s).map((tk) =>
  tk.t === "text" ? tk.text
    : tk.t === "claim" ? `${tk.text}†`
    : `${tk.text} (${abs(resolveRef(tk.ref) || "")})`).join("");

/** The post as plain text, links written out. For llms.txt and anything else that reads text. */
export function postText(post, site) {
  const abs = (h) => (h.startsWith("/") ? `${site}${h}` : h);
  const lines = [`# ${post.title}`, "", post.description, ""];
  for (const b of post.body) {
    if (b.h2) lines.push(`## ${plainInline(b.h2, abs)}`, "");
    else if (b.h3) lines.push(`### ${plainInline(b.h3, abs)}`, "");
    else if (b.p || b.note) lines.push(plainInline(b.p || b.note, abs), "");
    else if (b.ul) lines.push(...b.ul.map((i) => `- ${plainInline(i, abs)}`), "");
    else if (b.table) {
      lines.push(b.table.head.join(" | "));
      for (const r of b.table.rows) lines.push(r.map((c) => plainInline(c, abs)).join(" | "));
      lines.push("");
    }
  }
  lines.push(UNVERIFIED_LEGEND);
  return lines.join("\n");
}

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const htmlInline = (s, abs) => inline(s).map((tk) =>
  tk.t === "text" ? esc(tk.text)
    : tk.t === "claim" ? `${esc(tk.text)}<sup title="The vendor's own claim, not checked independently">†</sup>`
    : `<a href="${esc(abs(resolveRef(tk.ref) || ""))}">${esc(tk.text)}</a>`).join("");

/** The post as an HTML fragment with absolute links, for the RSS item. */
export function postHtml(post, site) {
  const abs = (h) => (h.startsWith("/") ? `${site}${h}` : h);
  const parts = [];
  for (const b of post.body) {
    if (b.h2) parts.push(`<h2>${htmlInline(b.h2, abs)}</h2>`);
    else if (b.h3) parts.push(`<h3>${htmlInline(b.h3, abs)}</h3>`);
    else if (b.p) parts.push(`<p>${htmlInline(b.p, abs)}</p>`);
    else if (b.note) parts.push(`<blockquote><p>${htmlInline(b.note, abs)}</p></blockquote>`);
    else if (b.ul) parts.push(`<ul>${b.ul.map((i) => `<li>${htmlInline(i, abs)}</li>`).join("")}</ul>`);
    else if (b.table) {
      parts.push(`<table><thead><tr>${b.table.head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${
        b.table.rows.map((r) => `<tr>${r.map((c) => `<td>${htmlInline(c, abs)}</td>`).join("")}</tr>`).join("")}</tbody></table>`);
    }
  }
  parts.push(`<p><small>${esc(UNVERIFIED_LEGEND)}</small></p>`);
  return parts.join("\n");
}

/** Every listing a post links to, as `{ kind, id }`, for the graph's `mentions`. */
export function mentionsOf(post) {
  const seen = new Map();
  for (const s of strings(post)) {
    for (const tk of inline(s)) {
      if (tk.t !== "link") continue;
      const [kind, id] = tk.ref.split(":");
      if (["tool", "newsletter", "event"].includes(kind) && !seen.has(tk.ref)) seen.set(tk.ref, { kind, id });
    }
  }
  return [...seen.values()];
}

/** Rough reading time, which the index shows so a long post says so. */
export const minutesToRead = (post) =>
  Math.max(1, Math.round(strings(post).join(" ").replace(INLINE, "$1$3").split(/\s+/).length / 220));
