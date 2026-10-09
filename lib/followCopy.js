/*
 * What following something gets you, in one sentence. Shared by the follow
 * box on the page and the confirmation email, so the promise made before
 * somebody types their address and the one in their inbox are the same
 * words. Pure and client-safe.
 */
export function whatYouGet(kind, hasFeed) {
  if (kind === "event") return "You will hear when its dates are confirmed, and again 30 and 7 days before it starts.";
  if (hasFeed) return "You will get the title and a link whenever it publishes a new issue, and a line if its listing here changes.";
  return "It has no public feed, so new issues cannot be seen. You will hear when its listing here changes.";
}
