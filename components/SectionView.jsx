"use client";

import { useEffect } from "react";
import { beacon } from "@/lib/beacon";

/*
 * Counts one view of a section, once per page load, into svt:stats. Renders
 * nothing. No cookie, no storage, no identifier: the count is all that is
 * kept (see /privacy and the analytics section of CLAUDE.md).
 */
export default function SectionView({ id }) {
  useEffect(() => { beacon({ sections: [id] }); }, [id]);
  return null;
}
