/*
 * The podcast section's grouping and its intro, counted from the catalogue.
 * Pure and shared: the page (components/Podcasts.jsx), its Markdown version
 * (lib/markdown.js) and llms.txt all say the same thing, in the same order,
 * and a show added or stopped changes every one of them by itself.
 */

const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
const word = (n) => WORDS[n] || String(n);
const Word = (n) => { const w = word(n); return w[0].toUpperCase() + w.slice(1); };

/* The three groups, in the order the intro names them. */
export function podcastGroups(podcasts) {
  return {
    builders: podcasts.filter((p) => p.forAppBuilders && !p.discontinued),
    merchants: podcasts.filter((p) => !p.forAppBuilders && !p.discontinued),
    stopped: podcasts.filter((p) => p.discontinued),
  };
}

export function podcastIntro(podcasts) {
  const { stopped } = podcastGroups(podcasts);
  const forBuilders = podcasts.filter((p) => p.forAppBuilders);
  const paid = podcasts.filter((p) => p.paidGuests).length;
  const others = podcasts.length - forBuilders.length;
  return [
    `${Word(forBuilders.length)} of ${word(podcasts.length)} ${forBuilders.length === 1 ? "is" : "are"} made for people who build Shopify apps${forBuilders.length ? `: ${forBuilders.map((p) => p.name).join(", ")}` : ""}.`,
    `The other ${word(others)} are for merchants and DTC brands. You listen to those sideways, the same as the newsletters: they show what merchants are being told to buy.`,
    stopped.length ? `${Word(stopped.length)} ${stopped.length === 1 ? "has" : "have"} stopped publishing. ${stopped.length === 1 ? "It is" : "They are"} listed as a record of who said what, not as a recommendation.` : "",
    paid ? `At least ${word(paid)} take paid guest slots, and each of those listings says so in its watch note. Read every interview here knowing the guest may have paid to be on it.` : "",
  ].filter(Boolean);
}

