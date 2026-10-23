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
const OFF = ["/admin", "/api/", "/md/"];

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
