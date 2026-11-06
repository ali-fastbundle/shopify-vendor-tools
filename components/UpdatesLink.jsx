import React from "react";
import { C, S, F } from "@/lib/tools";

/*
 * "4 updates since September", linking to /changes filtered to this listing.
 * A pointer, not content: no entry text, no list, and nothing at all when the
 * listing has no published entry (lib/feedSource.js updatesLink, invariant 31).
 * It takes the computed link, never the entries. No client state.
 */
export default function UpdatesLink({ link }) {
  if (!link) return null;
  return (
    <p style={{ fontSize: F.sm, margin: `${S.md}px 0 0` }}>
      <a href={link.href} style={{ color: C.text, textDecorationColor: C.edge, textUnderlineOffset: 3 }}>
        {link.label}
      </a>
      <span style={{ color: C.dim }}> on What&apos;s moving</span>
    </p>
  );
}
