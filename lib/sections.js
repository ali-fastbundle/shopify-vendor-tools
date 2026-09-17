/*
 * Which sections of the directory are actually open.
 *
 * `RESOURCE_KINDS` in lib/tools.js names every section the site plans to have
 * and carries a `live` flag. That flag alone is not enough to open one: a
 * section is live when somebody has switched it on AND there is something
 * published in it.
 *
 * Two conditions because they fail in different directions. `live: true` on an
 * empty catalogue ships a section header over nothing, which reads as a broken
 * page rather than an early one. A full catalogue with `live: false` is just
 * work in progress, which is the normal state of a section being written. The
 * flag is the intent and the count is the readiness, and a section needs both.
 *
 * `entriesOf` returns published entries, so a catalogue of nothing but drafts
 * cannot open a section by accident.
 *
 * Opening a section means: write its entries, drop their `draft` flags, and
 * set `live: true` on its kind. Its roadmap card disappears on its own.
 */

import { RESOURCE_KINDS, kindOf, TOOLS } from "./tools";
import { NEWSLETTERS } from "./newsletters";

/*
 * Every kind that has a catalogue behind it. A kind absent from here has
 * nothing written yet, which is most of them, and `entriesOf` says so with an
 * empty list rather than undefined.
 */
const CATALOGUES = {
  tool: TOOLS,
  newsletter: NEWSLETTERS,
};

/** Published entries for a kind. Never undefined. */
export const entriesOf = (kindId) => CATALOGUES[kindId] || [];

/** Switched on, and with something in it. */
export const isLive = (kindId) =>
  Boolean(kindOf(kindId).live && entriesOf(kindId).length > 0);

/** The sections still to come. These render as roadmap cards. */
export const pendingKinds = () => RESOURCE_KINDS.filter((k) => !isLive(k.id));
