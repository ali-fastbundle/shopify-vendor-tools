/*
 * What following something gets you, in one sentence. Shared by the follow
 * box on the page and the confirmation email, so the promise made before
 * somebody types their address and the one in their inbox are the same
 * words. Pure and client-safe.
 */
export function whatYouGet(kind, hasFeed, { feedKind = "issues", feedItem = "issue" } = {}) {
  if (kind === "events-month") return "On the 1st of each month: the events starting that month, with the place and whether each date is confirmed. Nothing is sent in a month with no events.";
  if (kind === "event") return "You will hear when its dates are confirmed, and again 30 and 7 days before it starts.";
  if (kind === "podcast") return "You will get the title and a link whenever it publishes a new episode.";
  /* A news site's feed carries every article, so the follower is told before
     subscribing that they get a daily count, not each article (2026-11-04). */
  if (hasFeed && feedKind === "articles") return "Its feed carries every article on the site, not a newsletter issue. On a day it publishes, you will get one line saying how many articles went up, with a link to them, and a line if its listing here changes.";
  if (hasFeed) return `You will get the title and a link whenever it publishes a new ${feedItem || "issue"}, and a line if its listing here changes.`;
  return "It has no public feed, so new issues cannot be seen. You will hear when its listing here changes.";
}
