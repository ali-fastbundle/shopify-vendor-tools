/*
 * The outreach email to a listed vendor (Outreach tab on /admin, temporary).
 * Pure and client-safe: the template, its placeholders, and filling it from
 * a tool. Written to the ali-voice rules for email: "Hi [First name]," on its
 * own line, introduce yourself by name and title, lead with the substance, no
 * pitch, and say the limitation before they find it (the caveat stays ours).
 */
export const PLACEHOLDERS = [
  ["firstName", "The person's first name, from the field above. Empty gives \"Hi,\""],
  ["name", "Tool name"], ["category", "Category"], ["url", "The listing on watchfor.tools"],
  ["one", "The one-line summary"], ["price", "The price line"], ["watch", "The caveat, in full"],
  ["domain", "The domain they prove control of"], ["owner", "The ownership line, or nothing"],
];

export const DEFAULT_SUBJECT = "{name} is listed on watchfor.tools";

export const DEFAULT_BODY = `Hi {firstName},

I'm Ali. I maintain watchfor.tools, an independent directory of tools for people who build Shopify apps. My day job is partnerships at Fast Bundle, a Shopify app.

{name} is listed in {category}:
{url}

Today the listing describes it as:
{one}
Price: {price}

You can claim the listing by proving you control {domain}. Once it is claimed, you can correct the description, the pricing and the links yourself.

One thing to know first. Each listing has a "watch for" note, and it stays editorial. Claiming does not let you edit it. For {name} it currently says:
{watch}

If anything in it is wrong, reply and tell me what. I will check it against your site and fix it.

Ali`;

/** The values a tool fills the placeholders with. */
export function valuesFor(tool, { firstName = "", categoryLabel = "", owner = "", site = "https://watchfor.tools" } = {}) {
  return {
    firstName: String(firstName || "").trim(),
    name: tool.name, category: categoryLabel, url: `${site}/tools/${tool.id}`,
    one: tool.one, price: tool.price, watch: tool.watch, domain: tool.domain, owner,
  };
}

/** Fill {placeholders}. "Hi {firstName}," with no name becomes "Hi,". Unknown ones stay visible. */
export function fill(template, values) {
  return String(template || "")
    .replace(/Hi \{firstName\},/g, values.firstName ? `Hi ${values.firstName},` : "Hi,")
    .replace(/\{(\w+)\}/g, (m, k) => (values[k] !== undefined && values[k] !== null ? String(values[k]) : m));
}

/** Placeholders left unfilled, so nothing goes out with "{watch}" in it. */
export const unfilled = (text) => [...new Set((String(text).match(/\{\w+\}/g) || []))];
