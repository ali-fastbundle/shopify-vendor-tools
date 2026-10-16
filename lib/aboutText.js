/*
 * The /about text. Ali's own words, edited by Ali from /admin (Catalogue,
 * About page) and never rewritten to house style: it is a person's account of
 * themselves, and the role line is the disclosure.
 *
 * The one rule enforced on it is the one he set: no phone number and no email
 * address in the page source. The contact form handles email (invariant 38).
 * `aboutIssues` refuses both on the page and again on the server.
 *
 * DEFAULT is what ships in the file, and what the page shows until an edit is
 * saved and again after Reset. Pure and client-safe; storage is
 * lib/aboutStore.js.
 */

export const NAME_MAX = 80;
export const ROLE_MAX = 160;
export const BODY_MAX = 6000;

const DEFAULT_ROLE = "Head of Partnerships & Strategic Accounts, Fast Bundle";
const DEFAULT_PARAGRAPHS = [
  "I work on the vendor side of the Shopify ecosystem. At Fast Bundle, a bundling app with more than 2,000 merchant reviews, I run partnerships and strategic accounts. Before that I led key account management there, with a portfolio of around 1,200 accounts and $250K in monthly recurring revenue.",
  "Most of the job is conversations. With merchants about what they are trying to sell. With agencies about whether a partnership is real or just polite. With other app vendors about where our products meet. I built the company’s first affiliate program and its partner channel, and I set up the offshore support operation in Yerevan.",
  "I did not come to this from software. Most of my career was in publishing and international rights. I co-founded a literary agency in Tehran, ran one in Dubai, and sold books across 31 countries. I have been writing and translating for eighteen years, five books and more than thirty articles. I studied law before I studied trade.",
  "That background explains this directory better than my job title does. Rights work teaches you to ask who owns what, and to read a claim carefully before repeating it. When I started keeping a list of tools built for Shopify app vendors, those two habits turned into the “watch for” note on every entry.",
  "I am based in Yerevan. If you build something in this ecosystem, or you think something belongs in the directory, get in touch.",
];

export const DEFAULT = { name: "Ali A.", role: DEFAULT_ROLE, paragraphs: DEFAULT_PARAGRAPHS, links: [] };

export const LINKS_MAX = 8;
export const PHOTO_MAX_BYTES = 400_000;
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

/*
 * Formatting in the text, written by the editor's buttons:
 *   **bold**   *italic*   [label](https://example.com) or [label](/contact)
 * Parsed into tokens here and rendered as elements, never as HTML, so nothing
 * typed can become markup. A link is http(s) or a path on this site, and
 * nothing else: no mailto and no tel, which is the rule again.
 */
export const isAllowedHref = (u) => /^https?:\/\/[^\s<>"]+\.[^\s<>"]+$/i.test(u) || /^\/[^\s<>"]*$/.test(u);

export function inlineTokens(text = "") {
  const out = [];
  const re = /\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0, m;
  const s = String(text);
  while ((m = re.exec(s))) {
    if (m.index > last) out.push({ t: "text", v: s.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ t: "b", v: m[1] });
    else if (m[2] !== undefined) out.push({ t: "i", v: m[2] });
    else if (isAllowedHref(m[4])) out.push({ t: "a", v: m[3], href: m[4] });
    else out.push({ t: "text", v: m[0] });
    last = re.lastIndex;
  }
  if (last < s.length) out.push({ t: "text", v: s.slice(last) });
  return out;
}

/** The links under the text: [{ label, url }]. Returns { links } or { error }. */
export function sanitiseLinks(input = []) {
  const rows = (Array.isArray(input) ? input : [])
    .map((l) => ({ label: String(l?.label || "").replace(/\s+/g, " ").trim().slice(0, 60), url: String(l?.url || "").trim() }))
    .filter((l) => l.label || l.url);
  if (rows.length > LINKS_MAX) return { error: `At most ${LINKS_MAX} links.` };
  for (const l of rows) {
    if (!l.label) return { error: `The link to ${l.url} has no label.` };
    if (!isAllowedHref(l.url)) return { error: `"${l.label}" needs an https:// address or a path on this site. Email and phone links are not allowed.` };
  }
  return { links: rows };
}

/* The editor is one textarea: paragraphs are separated by a blank line. */
export const bodyOf = (paragraphs = []) => paragraphs.join("\n\n");
export const paragraphsOf = (body = "") =>
  String(body).replace(/\r/g, "").split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, " ").trim()).filter(Boolean);

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9-]+(\.[A-Z0-9-]+)+/i;
/* Seven or more digits with only phone punctuation between them. A year, a
   count like 2,000 or $250K does not reach seven digits in one run. */
const PHONE = /\+?\d[\d\s().-]{6,}\d/;
const digits = (s) => (s.match(/\d/g) || []).length;

/** What would break the rule, as sentences. Empty when it is fine. */
export function aboutIssues({ name = "", role = "", body = "", links = [] } = {}) {
  const out = [];
  const all = `${name}\n${role}\n${body}\n${(links || []).map((l) => `${l?.label || ""} ${l?.url || ""}`).join("\n")}`;
  if (!String(name).trim()) out.push("The name is empty.");
  if (String(name).length > NAME_MAX) out.push(`The name is over ${NAME_MAX} characters.`);
  if (String(role).length > ROLE_MAX) out.push(`The role line is over ${ROLE_MAX} characters.`);
  if (!paragraphsOf(body).length) out.push("The text is empty.");
  if (String(body).length > BODY_MAX) out.push(`The text is over ${BODY_MAX} characters.`);
  if (EMAIL.test(all)) out.push("It contains an email address. The contact form handles email, so no address goes on the page.");
  if (/\]\(\s*(mailto|tel):/i.test(body)) out.push("It links to an email address or a phone number. Those are not allowed on the page.");
  const lk = sanitiseLinks(links);
  if (lk.error) out.push(lk.error);
  const m = all.match(new RegExp(PHONE, "g")) || [];
  if (m.some((x) => digits(x) >= 7)) out.push("It contains what looks like a phone number. No phone number goes on the page.");
  return out;
}
