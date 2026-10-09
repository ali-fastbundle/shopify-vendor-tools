import React from "react";
import { LinkedinLogo } from "@phosphor-icons/react/dist/ssr";
import { C, S, F, AUTHOR, AUTHOR_URL } from "@/lib/tools";
import { outbound } from "@/lib/outbound";

/*
 * The two ways to reach the person behind the directory, on every page's
 * footer: their LinkedIn and the contact form. Defined once, like Pill and
 * CopyLink, so it looks the same wherever it is.
 *
 * Contact is a page with a form, never a mailto. An address in the page
 * source is harvested within days; the form posts to /api/contact, which
 * reads the address from the environment.
 *
 * The SSR build of the icon, because most footers are in server components.
 * It renders the same SVG in a client one.
 */
export default function FooterLinks() {
  return (
    <p className="flex flex-wrap items-center" style={{ gap: S.lg, fontSize: F.sm, margin: `0 0 ${S.md}px` }}>
      {AUTHOR_URL && (
        <a href={outbound(AUTHOR_URL)} target="_blank" rel="noopener noreferrer"
          aria-label={`${AUTHOR} on LinkedIn`} title={`${AUTHOR} on LinkedIn`}
          className="press inline-flex items-center" style={{ color: C.muted, gap: S.xs, textDecoration: "none" }}>
          <LinkedinLogo size={18} weight="regular" />
          <span>LinkedIn</span>
        </a>
      )}
      <a href="/contact" style={{ color: C.muted }}>Contact</a>
    </p>
  );
}
