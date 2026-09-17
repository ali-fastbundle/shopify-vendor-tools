/*
 * Drafts.
 *
 * Any catalogue entry, of any kind, may carry `draft: true`. A draft is
 * written, stored in the source file and reviewable in /admin, and it is
 * invisible to a visitor: not in the grid, the search, the matcher, the
 * counts, the share card, or any API response.
 *
 * Publishing is deleting the flag in the source file. There is no button,
 * deliberately. `note` and `watch` are editorial work and the point at which
 * an entry is ready is a judgement, not a state transition. A publish button
 * would also mean storing published-ness outside the file, and then the file
 * would stop being the truth about what the directory says.
 *
 * The important half of this module is not the filter, it is the naming. Every
 * catalogue exports the *published* list under its plain name, so every
 * existing consumer is draft-safe without being changed and without knowing
 * drafts exist. Seeing a draft requires deliberately importing `ALL_TOOLS` or
 * `ALL_NEWSLETTERS`, which only /admin does. A leak has to be written on
 * purpose rather than forgotten into existence.
 */

export const isDraft = (entry) => Boolean(entry && entry.draft);

/** Everything a visitor may see. The default for every consumer. */
export const published = (list) =>
  Array.isArray(list) ? list.filter((e) => !isDraft(e)) : [];

/** Everything still being written. /admin only. */
export const drafted = (list) =>
  Array.isArray(list) ? list.filter(isDraft) : [];
