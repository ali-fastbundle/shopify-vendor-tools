/*
 * The changes feed.
 *
 * ------------------------------------------------------------------
 *  Why this exists at all
 * ------------------------------------------------------------------
 * A listing describes what a tool *is*. The feed records what *changed*. They
 * are different jobs and they were being done by one field.
 *
 * Before this, every monitor finding had two destinations: write it into the
 * listing, or throw it away. So "added a Slack integration" and "added GA4"
 * and "now supports Shopify Plus" all had to be crammed into `note`, and a
 * `note` that grows every week stops being a description and becomes a
 * changelog nobody reads to the end of. The alternative was dismissing real
 * news because there was nowhere to put it.
 *
 * Most findings are news. A new feature, a new integration, a rebrand, a
 * pricing move: those belong on a dated page, in order, where somebody can see
 * the shape of a product's year. Only the handful that change what a tool
 * fundamentally is or costs belong in the listing.
 *
 * ------------------------------------------------------------------
 *  Shape
 * ------------------------------------------------------------------
 *   id           permanent, referenced from the changelog row it came from
 *   toolId       which listing this is about
 *   toolName     denormalised, so the feed renders without the catalogue
 *   cat          likewise, for filtering
 *   date         YYYY-MM-DD, the day it was published
 *   at           full ISO, for ordering within a day
 *   headline     one or two sentences IN THE HOUSE VOICE. Not the monitor's
 *                output. See below.
 *   kind         the monitor's classification, for a neutral label
 *   sourceUrl    the vendor page that shows it
 *   changeId     the finding it came from, so a publish can be traced
 *   source       "observed": the monitor read it on the vendor's site (the
 *                default, and every row written before this field existed).
 *                "vendor": the vendor told us, by email or a post, and it is
 *                published as their announcement rather than as something we
 *                saw. Shown on the row, because "SAMI says it shipped X" and
 *                "SAMI's site now shows X" are different strengths of claim.
 *                "mention": somebody else's words, found by the mentions
 *                collection (lib/mentions.js) and published by an editor. The
 *                row is attributed on the page and links the post; the post's
 *                text is never stored (invariant 58).
 *   announcedOn  YYYY-MM-DD, when the vendor said it. Vendor rows only.
 *   mentionAuthor, mentionSource, mentionedOn, mentionId
 *                who posted it, where, when, and the mention it came from.
 *                Mention rows only.
 *   href         the listing's page, for a row about something that is not a
 *                tool (a newsletter, an event, an owner). Absent means
 *                /tools/<toolId>.
 *   sourceNote   where it came from, for the record ("email from the founder").
 *                Private, like publishedBy: never leaves through publicRow.
 *   publishedBy  the admin who wrote it. Private.
 *
 * `headline` is written by a person every time. The admin UI drafts a line with
 * lib/announce.js, shows it beside the finding it came from, and publishes only
 * on a second click. A model's sentence is serviceable and it is not the voice
 * the rest of the site is written in, and a feed that reads like machine output
 * teaches people the site is machine output. The draft is there to be cut down.
 */

import { read, write } from "./store";

const KEY = "svt:feed";
const MAX = 1000;

const clean = (s, max) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/*
 * What a visitor may see of a row. publishedBy is an admin address and
 * sourceNote can name the person who emailed us; neither belongs in a public
 * page, its RSC payload or the RSS. Every public read goes through this.
 */
const PRIVATE = ["publishedBy", "sourceNote", "deletedBy"];
export function publicRow(r) {
  const out = { ...r };
  for (const k of PRIVATE) delete out[k];
  return out;
}

export async function getFeed() {
  const rows = await read(KEY, []);
  return Array.isArray(rows) ? rows : [];
}

/** Newest first, never the deleted ones, and public fields only unless asked. */
export async function feedEntries({ limit = 200, toolId = "", withPrivate = false } = {}) {
  const rows = (await getFeed()).filter((r) => r && !r.deletedAt);
  const scoped = toolId ? rows.filter((r) => r.toolId === toolId) : rows;
  return scoped
    .sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")))
    .slice(0, limit)
    .map((r) => (withPrivate ? r : publicRow(r)));
}

/** Group by tool id, for handing a whole page's worth to the client at once. */
export async function feedByTool(limit = 6) {
  const rows = await feedEntries({ limit: 600 });
  const out = {};
  for (const r of rows) {
    if (!out[r.toolId]) out[r.toolId] = [];
    if (out[r.toolId].length < limit) out[r.toolId].push(r);
  }
  return out;
}

/** Everything published since a date, for the weekly email. */
export async function feedSince(iso) {
  const rows = await feedEntries({ limit: 400 });
  if (!iso) return rows;
  return rows.filter((r) => String(r.at || "") >= iso);
}

export function sanitiseEntry(input = {}) {
  const headline = clean(input.headline, 400);
  if (!headline) return { error: "Write a line saying what changed." };
  if (headline.length < 12) return { error: "That is too short to be a sentence." };
  /*
   * The house rule, enforced rather than remembered. No em-dash in anything a
   * visitor reads, and this is the one place text goes from an admin form
   * straight onto a public page.
   */
  if (headline.includes("—")) {
    return { error: "No em-dash. Use a comma, a colon, or two sentences." };
  }
  const sourceUrl = clean(input.sourceUrl, 300);
  if (sourceUrl && !/^https?:\/\//i.test(sourceUrl)) return { error: "The source has to be an http or https link." };

  if (input.source === "mention") {
    const mentionedOn = clean(input.mentionedOn, 10);
    if (!/^https:\/\//i.test(sourceUrl)) return { error: "A mention needs the link to the post." };
    if (!clean(input.mentionSource, 40) || !/^\d{4}-\d{2}-\d{2}$/.test(mentionedOn)) return { error: "A mention needs where and when it was posted." };
    return {
      entry: {
        headline, sourceUrl, kind: "mention", source: "mention",
        mentionAuthor: clean(input.mentionAuthor, 80), mentionSource: clean(input.mentionSource, 40),
        mentionedOn, mentionId: clean(input.mentionId, 40),
        ...(input.href ? { href: clean(input.href, 120) } : {}),
      },
    };
  }
  const vendor = input.source === "vendor";
  const announcedOn = clean(input.announcedOn, 10);
  if (vendor && !/^\d{4}-\d{2}-\d{2}$/.test(announcedOn)) {
    return { error: "Say when the vendor announced it, as a date." };
  }
  return {
    entry: {
      headline,
      sourceUrl,
      kind: clean(input.kind, 30),
      ...(vendor ? { source: "vendor", announcedOn, sourceNote: clean(input.sourceNote, 200) } : {}),
    },
  };
}

export async function addEntry(entry, { tool, changeId = "", publishedBy = "" } = {}) {
  const rows = await getFeed();
  const now = new Date();
  const row = {
    id: `${now.getTime().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    toolId: tool.id,
    toolName: tool.name,
    cat: tool.cat,
    at: now.toISOString(),
    date: now.toISOString().slice(0, 10),
    ...entry,
    changeId,
    publishedBy,
  };
  await write(KEY, [row, ...rows].slice(0, MAX));
  return row;
}

/*
 * Soft, like everything else in this codebase that removes something. A feed
 * entry that turned out to be wrong is a thing somebody may have linked to, and
 * the record of having published it is worth more than a tidy list.
 */
export async function removeEntry(id, { by = "" } = {}) {
  const rows = await getFeed();
  if (!rows.some((r) => r.id === id)) return { removed: false };
  const next = rows.map((r) => (r.id === id
    ? { ...r, deletedAt: new Date().toISOString(), deletedBy: by }
    : r));
  await write(KEY, next);
  return { removed: true };
}
