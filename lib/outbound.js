/*
 * Attribution on links that leave the site.
 *
 * Every outbound href goes through `outbound()` at render time. The parameter
 * is never written into `lib/tools.js` and never into a stored suggestion:
 * the catalogue is editorial source and a vendor's submitted URL is theirs,
 * so neither carries our tracking around. A tagged URL exists for exactly as
 * long as the page it was rendered into.
 *
 * That also means changing or dropping the tag is a one-line change here
 * rather than a migration over stored data.
 */

const PARAM = "utm_source";
const VALUE = "watchfor.tools";

/* Our own host, and any subdomain of it. An internal link is not outbound. */
const SELF = /(^|\.)watchfor\.tools$/i;

/*
 * Returns the URL with `utm_source` appended, or the URL exactly as given when
 * it is not ours to tag. Left alone:
 *
 *   - anything that is not absolute http or https, which covers `mailto:`,
 *     `tel:`, `#anchor` and relative paths like `/admin`
 *   - links back to watchfor.tools
 *   - a URL that already carries a utm_source, in any letter case, whether the
 *     vendor set it themselves or we are looking at one twice
 *   - anything that will not parse, because a bad URL is the caller's problem
 *     and silently rewriting it would make it a harder one
 *
 * The append is a string splice rather than a re-serialised URL, so a vendor's
 * existing query string comes back byte for byte. Re-serialising would rewrite
 * their encoding — a space stored as %20 coming back as +, say — and a link
 * that stops working because we tagged it is worse than an untagged link.
 */
export function outbound(url) {
  if (typeof url !== "string") return url;
  const raw = url.trim();
  if (!raw) return url;

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return url;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return url;
  if (SELF.test(parsed.hostname)) return url;
  /* parsed.search, not the whole string: a `?utm_source=` sitting inside a
     fragment is not a query parameter and should not stop us tagging. */
  if (new RegExp(`[?&]${PARAM}=`, "i").test(parsed.search)) return url;

  /* The fragment stays last. Appending to the end of the raw string would put
     the parameter inside the fragment, where it is not a parameter at all. */
  const cut = raw.indexOf("#");
  const base = cut === -1 ? raw : raw.slice(0, cut);
  const frag = cut === -1 ? "" : raw.slice(cut);
  const join = !base.includes("?") ? "?" : base.endsWith("?") ? "" : "&";

  return `${base}${join}${PARAM}=${VALUE}${frag}`;
}
