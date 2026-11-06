/*
 * The communities section's grouping and its intro, counted from the
 * catalogue. Pure and shared: the page (components/Communities.jsx), its
 * Markdown version (lib/markdown.js) and llms.txt say the same thing, and an
 * entry added changes every one of them by itself.
 */

const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
const word = (n) => WORDS[n] || String(n);
const Word = (n) => { const w = word(n); return w[0].toUpperCase() + w.slice(1); };

export const COMMUNITY_GROUPS = [
  { key: "builders", title: "For people who build on Shopify",
    blurb: "Developers, agencies and app teams asking each other how to build things." },
  { key: "merchants", title: "For merchants, read sideways",
    blurb: "Built for store owners. Useful to hear how merchants describe their problems, not to sell to them." },
];

export function communityGroups(communities) {
  return {
    builders: communities.filter((c) => c.forBuilders),
    merchants: communities.filter((c) => !c.forBuilders),
  };
}

export function communityIntro(communities) {
  const { builders, merchants } = communityGroups(communities);
  const paid = communities.filter((c) => !c.free);
  const closed = communities.filter((c) => /referral|invite|application|waitlist/i.test(c.entry || ""));
  return [
    `${Word(communities.length)} ${communities.length === 1 ? "place" : "places"} where people who work on Shopify talk to each other, and who is actually in each one.`,
    `${Word(builders.length)} ${builders.length === 1 ? "is" : "are"} for people who build on Shopify. ${merchants.length ? `${Word(merchants.length)} ${merchants.length === 1 ? "is" : "are"} for merchants.` : ""}`.trim(),
    paid.length ? `${Word(paid.length)} ${paid.length === 1 ? "costs" : "cost"} money to join${closed.length ? `, and ${word(closed.length)} ${closed.length === 1 ? "does" : "do"} not take open applications` : ""}.` : "",
    "Each listing's watch note says who is really in it and what its rules let a vendor do.",
  ].filter(Boolean);
}
