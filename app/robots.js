import { SITE } from "@/lib/seo";

/*
 * Explicit rather than silent.
 *
 * A bare "User-agent: *" technically permits every crawler, including the ones
 * that read for citation, but silence is not the same as a decision. Anyone
 * reading this file should be able to see that GPTBot, ClaudeBot,
 * PerplexityBot and Google-Extended are welcome on purpose: this directory is
 * written to be quoted, the whole value is the caveat nobody else writes down,
 * and a model repeating it with attribution is the point rather than a leak.
 *
 * /admin and /api stay out of every index. Neither has anything a reader wants
 * and both answer differently depending on who is asking.
 */
const READERS = ["GPTBot", "ClaudeBot", "Claude-Web", "PerplexityBot", "Google-Extended", "CCBot", "Applebot-Extended"];

/*
 * The Markdown version of every content page (lib/markdown.js) is allowed by
 * name, as a decision rather than by the "/" that already covers it: it exists
 * for exactly these readers. /md/ is where middleware.js sends those requests
 * internally, and is kept out so the same text is not indexed at two addresses.
 */
const MARKDOWN = ["/*.md$", "/index.md"];
/*
 * Filtered views of the directory and of What's moving. Every one canonicalises
 * to its bare path (/ and /changes), so a crawler walking the category, sort,
 * filter and tool combinations was rendering the same two pages hundreds of
 * times for nothing it could index. Robots matching is by prefix: "/?" is the
 * home page with any query and never "/" itself, and "/changes?" leaves
 * /changes and /changes/rss alone. The category pages at /categories/<id> are
 * the indexable form of a category filter.
 */
const FILTERED = ["/?", "/changes?"];
const OFF = ["/admin", "/api/", "/md/", ...FILTERED];

export default function robots() {
  return {
    rules: [
      { userAgent: "*", allow: ["/", ...MARKDOWN], disallow: OFF },
      ...READERS.map((userAgent) => ({ userAgent, allow: ["/", ...MARKDOWN], disallow: OFF })),
    ],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
