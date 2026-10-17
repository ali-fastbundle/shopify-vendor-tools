import React from "react";
import { LinkedinLogo, UserCircle, ChatCircleText, ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import { C, S, F, AUTHOR, AUTHOR_URL } from "@/lib/tools";
import { outbound } from "@/lib/outbound";

/*
 * The two ways to reach the person behind the directory, on every page's
 * footer: their LinkedIn and the contact form. And /privacy, which says what
 * is stored, because a footer is where people look for it. Defined once, like Pill and
 * CopyLink, so it looks the same wherever it is.
 *
 * Contact is a page with a form, never a mailto. An address in the page
 * source is harvested within days; the form posts to /api/contact, which
 * reads the address from the environment.
 *
 * The SSR build of the icon, because most footers are in server components.
 * It renders the same SVG in a client one.
 */
/*
 * Each link carries a small icon naming what the label already says, so the
 * four read as one set: LinkedIn had a mark and the other three did not. The
 * icons are muted, the size of the text, and hidden from screen readers, so
 * they add no second reading and no colour. Contact is a speech bubble, not an
 * envelope: it is a form, and an envelope promises an address.
 */
const LINKS = [
  { href: null, label: "LinkedIn", Icon: LinkedinLogo },
  { href: "/about", label: "About", Icon: UserCircle },
  { href: "/contact", label: "Contact", Icon: ChatCircleText },
  { href: "/privacy", label: "Privacy", Icon: ShieldCheck },
];

export default function FooterLinks() {
  return (
    <nav aria-label="About this site" style={{
      display: "grid", gridTemplateColumns: "repeat(2, minmax(0, max-content))", columnGap: S.lg, rowGap: S.sm,
      fontSize: F.sm, margin: `0 0 ${S.md}px`,
    }}>
      {LINKS.map(({ href, label, Icon }) => {
        if (!href && !AUTHOR_URL) return null;
        const external = !href;
        return (
          <a key={label} href={external ? outbound(AUTHOR_URL) : href}
            {...(external ? { target: "_blank", rel: "noopener noreferrer", title: `${AUTHOR} on LinkedIn` } : {})}
            className="press inline-flex items-center" style={{ color: C.muted, gap: S.xs, textDecoration: "none" }}>
            <Icon size={16} weight="regular" aria-hidden="true" />
            <span>{label}</span>
          </a>
        );
      })}
    </nav>
  );
}
