/*
 * YouTube channels.
 *
 * The fifth catalogue, and its own shape for the same reason as the others. A
 * channel is not a podcast with pictures: it has no feed a listener subscribes
 * to by episode, it is usually run by a company rather than a host, and what
 * decides whether it is worth an app vendor's time is who it is made for and
 * what it is selling around the videos. A show that is a podcast published on
 * YouTube belongs in lib/podcasts.js (The Shopify App Show is one); this file is
 * for channels that are only channels.
 *
 * Like a podcast, a merchant-facing channel earns its row on two counts: it is
 * where an app vendor sees how merchants are taught to run a store, and which
 * apps they are shown, and it can be a channel for getting in front of them.
 *
 * Shared with every other kind: `id`, `name`, `url`, `one`, `note`, `watch`,
 * `social`, `logo`, `ratings`, `updated`, `draft`. `watch` especially, and it is
 * no more the publisher's to edit than a tool's is.
 *
 * ------------------------------------------------------------------
 *  Shape
 * ------------------------------------------------------------------
 *  id          permanent. Votes, reviews and any future claim key on it.
 *  name        as the channel calls itself.
 *  url         the channel's own address, https://www.youtube.com/@handle.
 *  handle      the @handle, which survives a change of display name.
 *  publisher   who runs it: a company, or a person where it is one person's.
 *  host        optional. The person on camera, where one person mostly is.
 *  cadence     optional. Omit where it is not on a schedule, and say so in
 *              `watch` rather than guessing a rhythm from the uploads.
 *  launched    is `started` for this kind (lib/launched.js reads it); set
 *              `launched: "unknown"` when it was looked for and not published.
 *  started     optional. YYYY, YYYY-MM or YYYY-MM-DD, whichever is knowable.
 *  subscribers optional. Only a figure read on the channel itself, next to
 *              `updated`. Third-party trackers disagree with each other and
 *              with YouTube, so their numbers never go here.
 *  topics      what it actually covers, in the channel's terms.
 *  shopifySpecific
 *              optional. True when the channel is about Shopify itself.
 *              Renders a neutral badge; absent renders nothing.
 *  reach       optional prose. How an app vendor gets in front of its audience:
 *              sponsorship, a guest slot, a creator programme, with prices where
 *              published. Omit where there is no way in, rather than "none".
 *  one, note, watch, social, logo, ratings, updated, draft
 *              as everywhere else.
 *
 * The section is not open. RESOURCE_KINDS.youtube is still `live: false`, and
 * lib/sections.js will not open it on a catalogue of drafts alone, so nothing
 * below renders anywhere yet.
 */

import { published } from "./drafts";

export const ALL_YOUTUBE = [
  {
    id: "learnwithshopify",
    name: "Learn with Shopify",
    url: "https://www.youtube.com/@learnwithshopify",
    handle: "@learnwithshopify",
    publisher: "Shopify",
    shopifySpecific: true,
    topics: ["starting a store", "product ideas", "dropshipping", "marketing", "small business"],
    one: "shopify's own youtube channel teaching new merchants how to start and grow a store.",
    note: "Shopify's channel for people starting a small business. It covers business ideas, finding products to sell, dropshipping and marketing, with long playlists of free lessons. For an app vendor it shows how Shopify teaches beginners to run a store, which is the problem framing your future customers arrive with.",
    watch: "Made by Shopify for new merchants, not for app developers. Shopify is its only sponsor, so it is not a channel an app vendor can buy into. Its subscriber count could not be read on YouTube itself, and third-party trackers give figures from 611K to 846K. Upload frequency is not stated, and the trackers disagree on it too.",
    social: {},
    updated: "2026-10-17",
    draft: true,
  },
];

/* The published list, under the plain name. Every consumer imports this one and
   is draft-safe without knowing drafts exist; /admin imports ALL_ above on
   purpose. See lib/drafts.js. */
export const YOUTUBE = published(ALL_YOUTUBE);

export const channelOf = (id) => YOUTUBE.find((c) => c.id === id) || null;
