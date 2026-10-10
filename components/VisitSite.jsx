import React from "react";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { C, S, R, F } from "@/lib/tools";
import { outbound } from "@/lib/outbound";

/*
 * The one treatment a link leaving the site gets on a card (colour rule D):
 * solid, high contrast, bold, on every card in every section. It used to take
 * the category colour, which made the most important link on the card a
 * different weight and colour nine times over.
 *
 * Above a card's whole-card link (globals.css raises every control inside a
 * `.card`), so clicking it never opens the card. The SSR icon build, because
 * the newsletter and event cards are server components.
 */
export default function VisitSite({ url, children = "Visit site", size = F.xs }) {
  return (
    <a href={outbound(url)} target="_blank" rel="noopener noreferrer"
      className="ctl press inline-flex items-center"
      style={{
        gap: S.xs, background: C.text, color: C.bg, borderRadius: R.control,
        padding: "5px 12px", fontSize: size, fontWeight: 700, textDecoration: "none",
        whiteSpace: "nowrap",
      }}>{children}<ArrowUpRight size={size} weight="bold" /></a>
  );
}
