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
  ["write", "Write"],
  ["audience", "Audience"],
  ["system", "System"],
];

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
