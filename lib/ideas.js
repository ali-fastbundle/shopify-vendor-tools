/*
 * Ideas: the backlog on /admin, with an AI review step.
 *
 * An idea is the text it arrived as, plus an optional surface and size guess.
 * "Review this" asks a model what it would take, what already covers it,
 * which invariants it touches and what is wrong with it (lib/ideaReview.js).
 * The review is advisory: it is stored with the idea, every one of them, so
 * later you can see whether the objection was right, and moving an idea
 * against its review records that it was overridden.
 *
 * Statuses run new, reviewed, approved, in progress, shipped, dropped.
 * Dropped keeps the idea and its required reason, and the review prompt is
 * shown every dropped idea, so the same thing proposed a month later is met
 * with when and why it was turned down. Nothing is deleted (invariant 27).
 *
 * The page cannot start a Claude Code session and does not pretend to. An
 * approved idea gets "Copy as prompt", in the shape this project's prompts
 * take, and the commit hash that shipped it is pasted back and recorded.
 *
 * Pure and client-safe. Storage is lib/ideaStore.js; the model call is
 * lib/ideaReview.js.
 */

export const STATUSES = ["new", "reviewed", "approved", "in progress", "shipped", "dropped"];

export const SURFACES = [
  "Directory", "Tool pages", "Categories", "Newsletters", "Events", "Recent updates",
  "Blog", "Recommender", "Matcher", "Admin", "Email", "Monitor", "SEO and crawlers",
  "Marketing", "Catalogue content", "Other",
];

export const SIZES = ["an afternoon", "a few days", "a project"];

export const VERDICTS = {
  go: "Worth doing",
  doubtful: "Doubtful",
  against: "Do not do",
};

export const TEXT_MAX = 8000;
export const REASON_MAX = 600;

const tidy = (s, max) => String(s ?? "").replace(/\r/g, "").trim().slice(0, max);

/** Status, then newest first inside each status. */
export function sortIdeas(rows = []) {
  const rank = (s) => { const i = STATUSES.indexOf(s); return i < 0 ? STATUSES.length : i; };
  return [...rows].sort((a, b) =>
    rank(a.status) - rank(b.status) ||
    String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

export const latestReview = (idea) => (idea?.reviews || [])[0] || null;

/** First line of the text, for a title. */
export const ideaTitle = (idea) => {
  const first = String(idea?.title || idea?.text || "").split("\n").map((l) => l.trim()).find(Boolean) || "Untitled";
  return first.length > 90 ? `${first.slice(0, 87)}...` : first;
};

export function sanitiseIdea({ text, surface, size } = {}) {
  const t = tidy(text, TEXT_MAX + 1);
  if (t.length < 10) return { error: "Write the idea first. A sentence is enough." };
  if (t.length > TEXT_MAX) return { error: `That is over ${TEXT_MAX} characters.` };
  if (surface && !SURFACES.includes(surface)) return { error: "Unknown surface." };
  if (size && !SIZES.includes(size)) return { error: "Unknown size." };
  return { text: t, surface: surface || "", size: size || "" };
}

/* A commit hash as git prints it, short or full. */
export const isCommitHash = (s) => /^[0-9a-f]{7,40}$/i.test(String(s || "").trim());

/**
 * The prompt an approved idea is handed to Claude Code with: what it is, the
 * numbered changes, the invariants that apply, the objections on record, and
 * the build-commit-push-verify ending every task here ends with. Built from
 * the latest review where there is one, and says so where there is not.
 */
export function handoffPrompt(idea) {
  const r = latestReview(idea);
  const lines = [];
  lines.push(ideaTitle(idea));
  lines.push("");
  lines.push(String(idea.text || "").trim());
  if (idea.surface || idea.size) {
    lines.push("");
    lines.push([idea.surface && `Surface: ${idea.surface}.`, idea.size && `Expected size: ${idea.size}.`].filter(Boolean).join(" "));
  }
  lines.push("");
  lines.push("Read CLAUDE.md before changing anything.");

  if (r) {
    if (r.requires?.length) {
      lines.push("", "CHANGES");
      r.requires.forEach((x, i) => lines.push(`${i + 1}. ${x}`));
    }
    if (r.covered?.length) {
      lines.push("", "ALREADY BUILT, REUSE RATHER THAN DUPLICATE");
      r.covered.forEach((x) => lines.push(`- ${x}`));
    }
    if (r.invariants?.length) {
      lines.push("", "INVARIANTS THAT APPLY");
      r.invariants.forEach((x) => lines.push(`- ${x.ref}${x.name ? ` (${x.name})` : ""}: ${x.how}${x.conflict ? " This conflicts. Resolve it before building, or stop and ask." : ""}`));
    }
    if (r.objections?.length) {
      lines.push("", "OBJECTIONS RAISED IN REVIEW");
      r.objections.forEach((x) => lines.push(`- ${x}`));
      if (idea.overrode) lines.push(`Approved over the review on ${String(idea.overrode.at).slice(0, 10)}${idea.overrode.reason ? `: ${idea.overrode.reason}` : "."}`);
    }
    if (r.dependsOn?.length) {
      lines.push("", "DEPENDS ON, NOT BUILT YET");
      r.dependsOn.forEach((x) => lines.push(`- ${x}`));
    }
  } else {
    lines.push("", "This idea has not been reviewed. Work out the changes and the invariants it touches from CLAUDE.md first, and report them before building.");
  }

  lines.push("", "Report findings before fixing anything that turns out to be different from what is described here.");
  lines.push("", "DONE MEANS");
  lines.push("1. npm run build, and every script in \"Before committing\" in CLAUDE.md that this touches.");
  lines.push("2. Update CLAUDE.md where an invariant or the layout table changes.");
  lines.push("3. Commit, push to origin/main, and verify with git rev-parse HEAD origin/main.");
  lines.push("4. Check the live site, and say plainly where the live check cannot close the loop.");
  lines.push("5. Report the deployed commit hash.");
  return lines.join("\n");
}

/*
 * What was open on 2026-10-16, each with what is actually true about it,
 * checked against the code and the git history that day. Merged into the
 * queue until first touched, then stored like any other idea.
 */
export const SEEDS = [
  {
    id: "seed-social-discussion",
    createdAt: "2026-10-16T00:00:00.000Z",
    status: "new",
    surface: "Recent updates",
    text: "A social discussion feed: what people say about listed tools on Bluesky and Hacker News, shown next to the listing or the feed.",
    stateNote: "Nothing built. No code reads Bluesky or Hacker News.",
  },
  {
    id: "seed-gated-recommender",
    createdAt: "2026-10-16T00:00:00.000Z",
    status: "shipped",
    surface: "Recommender",
    text: "The gated growth recommender: sign in, answer about your app, get up to three tools with reasons.",
    stateNote: "Shipped 2026-10-10 at /recommend, behind sign-in (invariant 42), with feedback per pick. If \"gated\" means something more, such as a paid tier or an invite list, that part is not built: move this back to new and say what it is.",
    commits: ["407eb92", "66f9670", "d27219c"],
  },
  {
    id: "seed-vendor-changelog-rss",
    createdAt: "2026-10-16T00:00:00.000Z",
    status: "new",
    surface: "Monitor",
    text: "Vendor changelog RSS feeds: read each vendor's changelog or RSS feed to see what shipped, instead of diffing their homepage.",
    stateNote: "Partly built 2026-10-13 (77eea2e). The monitor reads a declared changelogUrl, including an RSS feed as dated titles. Only Ranksy and Retail Insider declare one. Nothing finds feeds by itself, and there is no per-vendor RSS output; /changes/rss is one feed for everything.",
  },
  {
    id: "seed-brag-video",
    createdAt: "2026-10-16T00:00:00.000Z",
    status: "in progress",
    surface: "Marketing",
    text: "The brag launch video for watchfor.tools.",
    stateNote: "Rendered, not in the repository: brag-output/ (2 Oct), brag-output-2026-10-13-182143/ (site promo, 13 Oct) and brag-output-2026-10-16-events/ (Events, 16 Oct), each with brag.mp4 and share copy. Whether any of them was posted is not recorded here.",
  },
  {
    id: "seed-homepage-reorg",
    createdAt: "2026-10-16T00:00:00.000Z",
    status: "new",
    surface: "Directory",
    text: "Reorganise the homepage.",
    stateNote: "One pass shipped 2026-10-10: one top bar, stats in a sentence, a category rail (5f72536, f1cbf8b). What the next reorganisation should change is not written down anywhere in the repository. Add it to this idea before reviewing.",
  },
  {
    id: "seed-retail-insider",
    createdAt: "2026-10-16T00:00:00.000Z",
    status: "new",
    surface: "Newsletters",
    text: "Decide whether Retail Insider stays in the Newsletters section.",
    stateNote: "Live since the section opened on 2026-10-02 (drafted 2026-09-17, 1220895). Its own watch note says it is the furthest from this audience: Canadian physical retail, no Shopify coverage. The monitor reads it through its feed because the homepage answers 403.",
  },
];
