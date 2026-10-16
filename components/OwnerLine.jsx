import React from "react";
import { C, S, F } from "@/lib/tools";

/*
 * Ownership on a listing (lib/owners.js, lib/ownerIndex.js). Two pieces, both
 * from one `ctx` that ownerContext() builds on the server:
 *
 *   OwnerFact  "by Dark Ecommerce Labs", a link to /owners/<id> when the owner
 *              has a page, plain text when it does not, and nothing at all
 *              when the owner is the entry itself (invariant 32)
 *   AlsoFrom   "Also from Dark Ecommerce Labs: AppJubilee", every sibling as a
 *              link to its own page, across tools, newsletters and events
 *
 * No state, so it renders in the server HTML on the tool, newsletter and event
 * pages, and inside the directory's modal from the same data.
 */
export function OwnerFact({ ctx }) {
  if (!ctx?.line) return null;
  return (
    <>
      {ctx.verb}{" "}
      {ctx.href
        ? <a href={ctx.href} style={{ color: "inherit", textDecoration: "underline", textDecorationColor: C.edge, textUnderlineOffset: 2 }}>{ctx.display}</a>
        : ctx.display}
    </>
  );
}

export function AlsoFrom({ ctx, style }) {
  if (!ctx?.siblings?.length) return null;
  return (
    <p style={{ fontSize: F.sm, color: C.muted, lineHeight: 1.55, margin: `${S.sm}px 0 0`, ...style }}>
      Also from{" "}
      {ctx.href ? <a href={ctx.href} style={{ color: C.text }}>{ctx.name}</a> : ctx.name}:{" "}
      {ctx.siblings.map((s, i) => (
        <React.Fragment key={s.href}>
          {i > 0 && ", "}
          <a href={s.href} style={{ color: C.text }}>{s.name}</a>
        </React.Fragment>
      ))}
    </p>
  );
}
