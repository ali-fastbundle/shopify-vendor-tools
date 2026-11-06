import React from "react";
import { C, S, R, F, formatDay } from "@/lib/tools";
import { outbound } from "@/lib/outbound";
import { screenOf } from "@/lib/toolScreens";

/*
 * The top of a tool's own page as the directory saw it on a day
 * (scripts/capture-screens.mjs). The way G2, SaaSHub and Product Hunt lead a
 * listing with the product, but labelled for what it is: our capture, dated,
 * not the vendor's material (that is VendorMedia, "From the vendor") and not a
 * claim that the page still looks like this.
 *
 * No client state: it renders in the tool page's first response and in the
 * listing modal alike. The box is sized before the image arrives, so nothing
 * moves when it loads. On the tool page, not on the card (rule J).
 */
export default function ToolScreen({ tool, eager = false }) {
  const shot = screenOf(tool.id);
  if (!shot) return null;
  const host = String(shot.page || tool.url || "").replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
  return (
    /* Capped at 720px: a picture of a page at the full column width is taller
       than the screen and pushes the listing below the fold. Text stays full width. */
    <figure style={{ margin: `${S.xl}px 0 0`, maxWidth: 720 }}>
      <a href={outbound(shot.page || tool.url)} target="_blank" rel="noopener noreferrer"
        style={{ display: "block", borderRadius: R.card, overflow: "hidden", border: `1px solid ${C.line}`, background: C.logoTile }}>
        <img src={shot.src} width={1280} height={800} loading={eager ? "eager" : "lazy"} decoding="async"
          alt={`The top of ${tool.name}'s homepage, ${host}, as it looked on ${formatDay(shot.taken)}`}
          style={{ display: "block", width: "100%", height: "auto", aspectRatio: "1280 / 800" }} />
      </a>
      <figcaption style={{ fontSize: F.xs, color: C.dim, marginTop: S.xs, lineHeight: 1.5 }}>
        {host} on {formatDay(shot.taken)}, captured by the directory. The site may have changed since.
      </figcaption>
    </figure>
  );
}
