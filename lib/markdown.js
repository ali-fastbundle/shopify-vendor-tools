/*
 * Markdown versions of the content pages: append .md to a page's path.
 *
 * An agent or a model reading a page wants the facts in order, not a layout.
 * So every content page has a plain twin at the same path plus .md
 * (/tools/sasi.md, /events.md, and /index.md for the home page), built here
 * from the same loaders the HTML page uses, never maintained separately.
 *
 * Two rules, and both are the point:
 *
 *  - Nothing appears here that is not on the page. This is another format
 *    for the same page, not a hidden surface. Fields the page never shows
 *    (`verified`, research `notes`, private review data, addresses) are not
 *    read at all. A builder that wants a new line asks first whether the page
 *    shows it.
 *  - The caveat is always there, labelled "Watch for", on every entry that
 *    has one. It is what makes citing this directory worth more than citing
 *    a vendor's own page. What the page marks as not checked is marked the
 *    same way: "Unknown" in the details, "Date not confirmed" on an event,
 *    "by the organizer's count", "From the vendor, not tested", and the
 *    blog's dagger.
 *
 * The route is app/md/[[...path]]/route.js, reached by middleware.js, which
 * rewrites any path ending in .md to it. Each builder returns null for
 * something that does not exist, which the route answers with a 404.
 */
import {
  CATEGORIES, HEADLINE, LAST_UPDATED, catOf, findCat, secondaryCats, priceLine, categoryTerm,
  SOCIALS, socialLabel, formatDay,
} from "./tools";
import { countTools } from "./toolCount";
import { SITE, relatedTools, categoryMembers, relatedCategories, ratingOf, relationOf, isForVendors } from "./seo";
import { ownerContext, ownersWithPages, allOwners } from "./ownerIndex";
import { editorUseBadge } from "./editorUse";
import { attributesFor, attributeValue, formatValue, integrationLabel } from "./categories";
import { rivalPairs, alternativesOf, pairSlug } from "./rivals";
import { placed, agenda, RELEVANCE_LABEL, dayLabel } from "./events";
import { POSTS, postBySlug, postText, minutesToRead, postsForTool } from "./blog";
import { launchDate, launchedOf } from "./launched";

const abs = (p) => (String(p || "").startsWith("/") ? `${SITE}${p}` : String(p || ""));
const line = (label, value) => (value === undefined || value === null || value === "" || value === false ? null : `${label}: ${value}`);
const join = (parts) => parts.filter((p) => p !== null && p !== undefined && p !== false).join("\n");
const block = (...sections) => sections.filter(Boolean).join("\n\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";

/* Where every file says what it is, so a reader handed only this text still
   knows the source, the page and the date. */
function header(title, path, extra = []) {
  return join([
    `# ${title}`,
    "",
    line("Source", "watchfor.tools, an independent directory for people who build Shopify apps. No paid placement, no affiliate links. Not affiliated with Shopify."),
    line("Canonical", `${SITE}${path === "/" ? "" : path}`),
    ...extra,
  ]);
}

const watchBlock = (watch) => (watch ? `## Watch for\n\n${watch}` : null);

/* The community rating as the page states it: counted reviews only, nothing
   when there is none (invariant 29). */
function ratingLine(id, reviews) {
  const r = ratingOf(id, reviews);
  return r ? `${r.ratingValue} from ${r.ratingCount} counted review${r.ratingCount === 1 ? "" : "s"}` : null;
}

function socialLines(social = {}) {
  return SOCIALS.map(({ key }) => (social?.[key] ? `- ${socialLabel(key)}: ${social[key]}` : null)).filter(Boolean);
}

function externalRatings(ratings = []) {
  if (!ratings?.length) return null;
  return join([
    "## External ratings",
    "",
    ...ratings.map((r) => `- ${r.source}${r.score != null ? `: ${r.score}${r.outOf && r.outOf !== 5 ? `/${r.outOf}` : ""}` : ""}${r.count != null ? ` from ${r.count}` : ""}${r.captured ? `, read ${formatDay(r.captured)}` : ""}${r.url ? ` (${r.url})` : ""}`),
    "",
    "Collected on other platforms, from a different set of people than the reviews here, and never averaged with them.",
  ]);
}

/* ------------------------------------------------------------------ */
/*  One tool: /tools/<id>.md                                           */
/* ------------------------------------------------------------------ */

export function toolMarkdown(id, { tools, reviews = {}, discovery = {} }) {
  const tool = tools.find((t) => t.id === id);
  if (!tool) return null;
  const owner = ownerContext(tool, "tool", { tools });
  const also = secondaryCats(tool).map((c) => catOf(c).label);
  const badge = editorUseBadge(tool.editorUse);
  const s = tool.structured;
  const rivals = alternativesOf(tool, tools, rivalPairs(tools, discovery));
  const related = relatedTools(tool, tools);
  const posts = postsForTool(tool.id);

  const facts = join([
    line("Category", `${catOf(tool.cat).label} (${SITE}/categories/${tool.cat})`),
    line("Also in", also.join(", ")),
    line("Summary", tool.one),
    line("Status", tool.dying && "winding down"),
    line("Price", tool.price),
    line("Free plan", tool.free && "yes"),
    line("Owner", owner?.line ? `${owner.line}${owner.href ? ` (${abs(owner.href)})` : ""}` : null),
    line(`Also from ${owner?.name}`, owner?.siblings?.length ? owner.siblings.map((x) => `${x.name} (${abs(x.href)})`).join(", ") : null),
    line("Editor use", badge),
    line("Scope", tool.shopifyExclusive === false && "not Shopify-only"),
    /* Unknown is said, as in the tables: age is a caveat here (lib/launched.js). */
    line("Launched", launchDate(launchedOf(tool)) || "unknown, not published on its own site"),
    line("Suggested by", tool.suggestedBy >= 2 && `${tool.suggestedBy} people`),
    line("Claimed by the vendor", tool.claimed && "yes"),
    line("Community rating", ratingLine(tool.id, reviews)),
    line("Website", tool.url),
    line("Entry last checked", tool.updated && formatDay(tool.updated)),
  ]);

  const details = s ? join([
    "## Details",
    "",
    ...attributesFor(tool.cat).map((a) => `- ${a.label}: ${formatValue(a, attributeValue(a, s))}`),
    `- Integrations: ${s.integrations?.length ? s.integrations.map(integrationLabel).join(", ") : "None stated"}`,
    "",
    `From the vendor's own site, confirmed ${String(s.confirmedAt).slice(0, 10)}. Unknown means the site does not say.`,
  ]) : null;

  const media = tool.vendorMedia ? join([
    "## From the vendor",
    "",
    `Supplied by ${tool.name}. The directory has not tested what these show.`,
    ...(tool.vendorMedia.screenshots || []).map((x) => `- Screenshot: ${x.alt} (${abs(x.path)})`),
    tool.vendorMedia.video?.url ? `- Demo video: ${tool.vendorMedia.video.url}` : null,
  ]) : null;

  const socials = socialLines(tool.social);

  return block(
    header(tool.name, `/tools/${tool.id}`),
    facts,
    `## Description\n\n${tool.note}`,
    watchBlock(tool.watch),
    badge && tool.editorUse?.note ? `## Editor's note\n\n${tool.editorUse.note}` : null,
    details,
    media,
    externalRatings(tool.ratings),
    socials.length ? join(["## Profiles", "", ...socials]) : null,
    posts.length ? join(["## Compared in", "", ...posts.map((p) => `- ${p.title} (${SITE}/blog/${p.slug})`)]) : null,
    rivals.length ? join([
      "## Compare",
      "",
      `- All alternatives to ${tool.name}: ${SITE}/alternatives/${tool.id}`,
      ...rivals.map((x) => `- ${tool.name} against ${x.tool.name}: ${SITE}/compare/${pairSlug(tool.id, x.tool.id)}`),
    ]) : null,
    related.length ? join([
      "## Related tools",
      "",
      ...related.map(({ tool: t, why }) => `- ${t.name} (${catOf(t.cat).label}${why ? `, ${why}` : ""}): ${t.one} ${SITE}/tools/${t.id}`),
    ]) : null,
  );
}

/* ------------------------------------------------------------------ */
/*  The directory: /index.md                                           */
/* ------------------------------------------------------------------ */

export function indexMarkdown({ tools, reviews = {} }) {
  const n = countTools(tools);
  const byPrimary = n.order.map((id) => ({
    cat: findCat(id),
    items: tools.filter((t) => t.cat === id).sort((a, b) => Number(Boolean(a.dying)) - Number(Boolean(b.dying)) || a.name.localeCompare(b.name)),
  })).filter((g) => g.items.length);

  return block(
    header(HEADLINE, "/"),
    `${n.total} tools for Shopify app builders in ${CATEGORIES.length} categories, updated ${LAST_UPDATED}. Each tool's page has its full description and its "Watch for" caveat: append .md to any page for this format.`,
    ...byPrimary.map(({ cat, items }) => join([
      `## ${cat.label}`,
      "",
      `${cat.blurb} ${SITE}/categories/${cat.id}`,
      "",
      ...items.map((t) => {
        const r = ratingLine(t.id, reviews);
        return `- ${t.name}${t.dying ? " (winding down)" : ""}: ${t.one} ${priceLine(t)}.${r ? ` Community rating ${r}.` : ""} ${SITE}/tools/${t.id}`;
      }),
    ])),
  );
}

/* ------------------------------------------------------------------ */
/*  A category: /categories/<id>.md                                    */
/* ------------------------------------------------------------------ */

export function categoryMarkdown(id, { tools }) {
  const cat = findCat(id);
  if (!cat) return null;
  const members = categoryMembers(id, tools);
  const related = relatedCategories(id, tools);
  const primary = members.filter((m) => m.primary).length;
  const also = members.length - primary;
  return block(
    header(`${categoryTerm(cat)} for Shopify app vendors`, `/categories/${cat.id}`),
    cat.blurb,
    members.length ? `${primary} listed here${also ? `, and ${also} more that also belong in it` : ""}.` : "Nothing is listed in this category yet.",
    members.length ? join([
      "## Tools",
      "",
      ...members.map(({ tool: t, primary: p }) => join([
        `### ${t.name}${t.dying ? " (winding down)" : ""}`,
        "",
        line("Page", `${SITE}/tools/${t.id}`),
        p ? null : line("Listed under", `${catOf(t.cat).label} (${SITE}/categories/${t.cat}), and also in this category`),
        line("Summary", t.one),
        line("Price", priceLine(t)),
        line("Scope", t.shopifyExclusive === false && "not Shopify-only"),
        line("Watch for", t.watch),
        "",
      ])),
    ]) : null,
    related.length ? join(["## Related categories", "", ...related.map(({ cat: c, why }) => `- ${c.label}${why ? ` (${why})` : ""}: ${SITE}/categories/${c.id}`)]) : null,
  );
}

/* ------------------------------------------------------------------ */
/*  Newsletters: /newsletters.md and /newsletters/<id>.md              */
/* ------------------------------------------------------------------ */


function newsletterFacts(n, owner, reviews) {
  return join([
    line("Summary", n.one),
    line("Shopify-specific", n.shopifySpecific && "yes"),
    line("Shelf", isForVendors(n) ? "About the Shopify platform" : "Merchant-side, read sideways for demand signal"),
    line("Cadence", n.cadence),
    line("Issues", n.issueCount && n.issueCount.toLocaleString("en-US")),
    line("First issue", launchDate(launchedOf(n)) || "unknown, not published"),
    line("Free", n.free && "yes"),
    line("Author", n.author),
    line("Publisher", n.publisher && n.publisher !== n.author ? `${n.publisher}${owner?.href ? ` (${abs(owner.href)})` : ""}` : null),
    line(`Also from ${owner?.name}`, owner?.siblings?.length ? owner.siblings.map((x) => `${x.name} (${abs(x.href)})`).join(", ") : null),
    line("Platform", n.platform),
    line("Claimed by the publisher", n.claimed && "yes"),
    line("Community rating", ratingLine(n.id, reviews)),
    line("Subscribe", n.url),
    line("Entry last checked", n.updated && formatDay(n.updated)),
  ]);
}

export function newsletterMarkdown(id, { newsletters, tools = [], events = [], reviews = {} }) {
  const n = newsletters.find((x) => x.id === id);
  if (!n) return null;
  const owner = ownerContext(n, "newsletter", { tools, newsletters, events });
  const socials = socialLines(n.social);
  return block(
    header(n.name, `/newsletters/${n.id}`),
    newsletterFacts(n, owner, reviews),
    `## Description\n\n${n.note}`,
    watchBlock(n.watch),
    externalRatings(n.ratings),
    socials.length ? join(["## Profiles", "", ...socials]) : null,
  );
}

export function newslettersMarkdown({ newsletters, reviews = {} }) {
  const group = (title, list) => list.length ? join([
    `## ${title}`,
    "",
    ...list.map((n) => join([
      `### ${n.name}`,
      "",
      line("Page", `${SITE}/newsletters/${n.id}`),
      line("Summary", n.one),
      line("Cadence", n.cadence),
      line("Watch for", n.watch),
      "",
    ])),
  ]) : null;
  return block(
    header("Newsletters for Shopify app vendors", "/newsletters"),
    "Every entry keeps its watch note, and it is no more the publisher's to edit than a tool's is.",
    group("About the Shopify platform", newsletters.filter(isForVendors)),
    group("Merchant-side media, read sideways", newsletters.filter((n) => !isForVendors(n))),
  );
}

/* ------------------------------------------------------------------ */
/*  Events: /events.md and /events/<id>.md                             */
/* ------------------------------------------------------------------ */

/* The date in the page's own words, including what is not confirmed. */
function whenOf(at) {
  if (at.mode === "exact") return at.label;
  if (at.mode === "approx") return `${at.label}. No exact date was published.`;
  if (at.mode === "year") return `${at.label}.`;
  if (at.mode === "inferred") return `Date not confirmed. Last held ${dayLabel(at.lastHeld)}, so placed around ${dayLabel(at.date)} until the organizer announces the next one.`;
  return at.label ? `Dates not announced. ${at.label}.` : "Dates not announced.";
}
const statusOf = (at) => (at.discontinued ? "Discontinued"
  : at.mode === "inferred" ? "Not confirmed"
    : { past: "Past", upcoming: "Upcoming", imminent: "Upcoming" }[at.status] || "");
const whereOf = (e) => [e.venue && !/^(tbd|n\/a)$/i.test(e.venue) ? e.venue : "",
  ...[e.city, e.country].filter((x) => x && !/^n\/a$/i.test(x)).filter((x, i, a) => a.indexOf(x) === i)].filter(Boolean).join(", ");

function eventFacts(e, owner, reviews) {
  return join([
    line("Status", statusOf(e.at)),
    line("When", whenOf(e.at)),
    line("Where", whereOf(e)),
    line("Organizer", e.organizer ? `${e.organizer}${owner?.href ? ` (${abs(owner.href)})` : ""}` : null),
    line(`Also from ${owner?.name}`, owner?.siblings?.length ? owner.siblings.map((x) => `${x.name} (${abs(x.href)})`).join(", ") : null),
    line("Attendees", e.attendees && `${e.attendees}, by the organizer's count`),
    line("First held", launchDate(launchedOf(e)) || "unknown, not published by the organizer"),
    line("Focus", e.focus),
    line("Summary", e.one),
    line("Who it is for", e.audience),
    line("For an app vendor", e.relevance && RELEVANCE_LABEL[e.relevance]),
    line("Community rating", reviews ? ratingLine(e.id, reviews) : null),
    line("Event site", e.url),
    line("Dates last checked against the organizer's site", e.updated && formatDay(e.updated)),
  ]);
}

export function eventMarkdown(id, { events, tools = [], newsletters = [], reviews = {} }, today) {
  const e = placed(events, today).find((x) => x.id === id);
  if (!e) return null;
  const owner = ownerContext(e, "event", { tools, newsletters, events });
  const socials = socialLines(e.social);
  return block(
    header(e.name, `/events/${e.id}`),
    eventFacts(e, owner, reviews),
    watchBlock(e.watch),
    socials.length ? join(["## Profiles", "", ...socials]) : null,
  );
}

export function eventsMarkdown({ events }, today) {
  const plan = agenda(events, today);
  const dated = plan.timeline.flatMap((g) => g.items);
  const row = (e) => join([
    `### ${e.name}`,
    "",
    line("Page", `${SITE}/events/${e.id}`),
    line("Status", statusOf(e.at)),
    line("When", whenOf(e.at)),
    line("Where", whereOf(e)),
    line("Summary", e.one),
    line("For an app vendor", e.relevance && RELEVANCE_LABEL[e.relevance]),
    line("Watch for", e.watch),
    "",
  ]);
  const ahead = dated.filter((e) => e.at.status !== "past");
  const past = dated.filter((e) => e.at.status === "past").reverse();
  return block(
    header("Events for Shopify app vendors", "/events"),
    "Past events stay listed, so this is also a record of what the ecosystem has held. A date the organizer has not confirmed says so.",
    ahead.length ? join(["## Coming up", "", ...ahead.map(row)]) : null,
    plan.unscheduled.length ? join(["## Dates not announced", "", ...plan.unscheduled.map(row)]) : null,
    past.length ? join(["## Past", "", ...past.map(row)]) : null,
  );
}

/* ------------------------------------------------------------------ */
/*  An owner: /owners/<id>.md                                          */
/* ------------------------------------------------------------------ */

export function ownerMarkdown(id, lists) {
  const owner = ownersWithPages(lists).find((o) => o.id === id);
  if (!owner) return null;
  return block(
    header(owner.name, `/owners/${owner.id}`),
    `${owner.type === "Person" ? "A person" : "A company"} behind ${owner.entries.length} listings here.${owner.url ? ` ${owner.url}` : ""}`,
    owner.notes || null,
    join([
      "## Listings",
      "",
      ...owner.entries.map((m) => join([
        `### ${m.name}${m.dying ? " (winding down)" : ""}`,
        "",
        line("Page", abs(m.href)),
        line("Kind", m.kindLabel),
        line("Relationship", relationOf(m, owner)),
        line("Summary", m.one),
        "",
      ])),
    ]),
    "Shared ownership is recorded where a listing's own site, or the owner's, states it. Each listing's caveat is on its own page.",
  );
}

export function ownersMarkdown(lists) {
  const owners = allOwners(lists);
  return block(
    header("Owners", "/owners"),
    `The companies and people behind the tools, newsletters and events listed here, ${owners.length} in all. When two listings share an owner, read them as one source, not two. An owner is listed only where the listing's own site, or the owner's, says who it is.`,
    ...owners.map((o) => join([
      `## ${o.name}`,
      "",
      line("Kind", o.type === "Person" ? "A person" : o.type ? "A company" : null),
      line("Owner page", o.page && abs(o.page)),
      line("Site", o.url),
      o.notes || null,
      "",
      ...o.entries.map((m) => `- ${m.name} (${m.kindLabel.toLowerCase()}${m.dying ? ", winding down" : ""}): ${m.relation} ${abs(m.href)}`),
    ])),
  );
}

/* ------------------------------------------------------------------ */
/*  The blog: /blog.md and /blog/<slug>.md                             */
/* ------------------------------------------------------------------ */

export function postMarkdown(slug) {
  const post = postBySlug(slug);
  if (!post) return null;
  /* postText is the blog's own plain rendering (llms.txt reads it): every
     link written out, every unchecked vendor figure carrying its dagger, and
     the legend that says what the dagger means. */
  const body = postText(post, SITE).replace(/^# .*\n\n/, "");
  return block(
    header(post.title, `/blog/${post.slug}`, [
      line("Published", formatDay(post.date)),
      line("Updated", post.updated && post.updated !== post.date && formatDay(post.updated)),
      line("Reading time", `${minutesToRead(post)} minutes`),
    ]),
    body,
  );
}

export function blogMarkdown() {
  return block(
    header("Blog", "/blog"),
    POSTS.length ? join(POSTS.map((p) => join([
      `## ${p.title}`,
      "",
      line("Page", `${SITE}/blog/${p.slug}`),
      line("Published", formatDay(p.date)),
      p.description,
      "",
    ]))) : "No posts yet.",
  );
}

/* ------------------------------------------------------------------ */
/*  Recent updates: /changes.md                                        */
/* ------------------------------------------------------------------ */

const KIND_LABEL = {
  pricing: "Pricing", "free-tier": "Free tier", "wind-down": "Winding down",
  acquisition: "Acquired", "new-capability": "New capability",
  "dead-page": "Availability", scale: "Scale", ownership: "Ownership",
};

export function changesMarkdown({ entries }) {
  return block(
    header("Recent updates", "/changes"),
    "What changed at the tools in the directory, newest first. Each entry is written by a person.",
    entries.length ? join(entries.map((e) => join([
      `## ${e.toolName}: ${formatDay(e.date)}`,
      "",
      line("Entry", `${SITE}/changes#${e.id}`),
      line("Tool", `${SITE}/tools/${e.toolId}`),
      line("Kind", e.kind && (KIND_LABEL[e.kind] || e.kind)),
      line("Source", e.source === "vendor" ? `Vendor announcement${e.announcedOn ? `, ${formatDay(e.announcedOn)}` : ""}` : null),
      e.headline,
      line("Read at", e.sourceUrl),
      "",
    ]))) : "Nothing yet.",
  );
}

/* ------------------------------------------------------------------ */
/*  About: /about.md                                                   */
/* ------------------------------------------------------------------ */

export function aboutMarkdown(about, { authorUrl = "" } = {}) {
  /* The text is stored in the editor's own Markdown (**bold**, *italic*,
     [label](url)), so it is already this format. No phone or address is in
     it: aboutIssues refuses both before it is saved. */
  return block(
    header(about.name, "/about", [line("Role", about.role)]),
    about.paragraphs.join("\n\n"),
    join([
      "## Links",
      "",
      authorUrl ? `- LinkedIn: ${authorUrl}` : null,
      ...(about.links || []).map((l) => `- ${l.label}: ${abs(l.url)}`),
      `- Contact form: ${SITE}/contact`,
    ]),
  );
}
