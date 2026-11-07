/*
 * The /admin tabs, and where the old ones went.
 *
 * Plain data in its own module because both sides read it: the server page
 * redirects a legacy ?tab= before rendering, and components/Admin.jsx (a
 * client component) draws the tabs. A constant exported from a "use client"
 * file reaches a server component as a reference, not the value.
 */
export const ADMIN_TABS = [
  ["inbox", "Inbox"],
  ["updates", "Updates"],
  ["listings", "Listings"],
  ["blog", "Blog"],
  ["write", "Write"],
  ["audience", "Audience"],
  ["system", "System"],
];

/*
 * The sidebar (2026-11-06): the sections grouped the way an operations console
 * groups them, with what each one is for. Every tab is in exactly one group.
 */
export const ADMIN_NAV = [
  { group: "Operate", items: ["inbox", "updates", "listings"] },
  { group: "Content", items: ["blog", "write"] },
  { group: "Insight", items: ["audience"] },
  { group: "Settings", items: ["system"] },
];
export const TAB_PURPOSE = {
  inbox: "Queues other people's actions created. Everything here waits on a decision.",
  updates: "What the monitor and vendors say changed, and what is on What's moving.",
  listings: "Drafts to publish, details to confirm, and the state of every entry.",
  blog: "Posts as files: the calendar, drafts to publish, ideas, Search Console, comments, and the LinkedIn posts announcing them.",
  write: "LinkedIn announcements (blog posts are on Blog), the email to the list, the About page, and the ideas backlog.",
  audience: "Who uses the site and what they asked for. Nothing here is work.",
  system: "Is anything broken: health, records, logs and tools.",
};

/* The tabs the 2026-10-23 restructure replaced: [new tab, panel anchor]. */
export const LEGACY_TABS = {
  catalogue: ["listings", ""],
  data: ["listings", "details-to-confirm"],
  announcements: ["write", "announcements"],
  ideas: ["write", "ideas"],
  outreach: ["write", "outreach"],
  people: ["audience", ""],
};

/** Where a ?tab= value lands: the tab, and the anchor of the panel it meant. */
export function resolveAdminTab(value) {
  const v = String(value || "");
  if (ADMIN_TABS.some(([id]) => id === v)) return { tab: v, anchor: "" };
  if (LEGACY_TABS[v]) return { tab: LEGACY_TABS[v][0], anchor: LEGACY_TABS[v][1] };
  return { tab: "inbox", anchor: "" };
}
