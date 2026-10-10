"use client";

import React from "react";
import { C, R, F } from "@/lib/tools";

/*
 * An attribute badge, and deliberately colourless.
 *
 * Price, free plan, suite membership, ownership, claimed and unverified are
 * attributes of a tool, not categories of one. Giving each its own hue put
 * five unrelated colours next to a spine whose colour means something, and
 * the meaning drains out of all of them. They are all one neutral grey tag now.
 *
 * `tone="warn"` is the single exception: "winding down" is a status warning
 * about the product, not a label on it, and it is allowed to be seen.
 *
 * It lives in its own file because the rule is that this badge looks like this
 * everywhere. A second copy of these eight lines in another component is how a
 * neutral badge ends up neutral in one place and not in another.
 */
export function Pill({ children, tone = "neutral" }) {
  const warn = tone === "warn";
  return (
    <span style={{
      fontSize: F.xs, lineHeight: 1.6, padding: "2px 8px", borderRadius: R.badge,
      /* A filled grey tag rather than an outline: neutral, and quieter than a
         border, which drew more attention than the word inside it. */
      color: warn ? C.badInk : C.text,
      background: warn ? C.badSoft : C.subtle,
      border: `1px solid ${warn ? C.badEdge : "transparent"}`,
      whiteSpace: "nowrap", fontWeight: warn ? 700 : 500,
    }}>{children}</span>
  );
}
