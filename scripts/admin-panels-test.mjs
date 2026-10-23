#!/usr/bin/env node
/*
 * /admin: six tabs, each work first and reference second (invariant 25).
 *
 *   node scripts/admin-panels-test.mjs
 *
 * What this holds, all by reading the source, so it needs no server:
 *
 *   the tabs        six, in order, and every old ?tab= lands on its panel
 *   the layers      each tab's work panels come before its one Reference
 *                   group, and System's references are Records, Logs, Tools
 *   the counts      a tab's number is work waiting, read from the same
 *                   figures as the Inbox's summary line, and nothing in a
 *                   Reference group feeds any of them
 *   long lists      any list that can pass about ten rows is collapsed with
 *                   its count, and nothing opens itself into a full list
 *   one row         every list draws Row, including drafts, a tool's
 *                   findings, a burst of reviews and the research draft
 *   one confirm     every two-press action is ConfirmBtn; Publish, Discard
 *                   and the caveat editor take exactly two presses
 */
import { readFileSync } from "fs";
const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const src = read("components/Admin.jsx");
const page = read("app/admin/page.js");
const tabsSrc = read("lib/adminTabs.js");
let bad = 0;
const ok = (c, l) => { console.log(`  ${c ? "ok  " : "FAIL"}  ${l}`); if (!c) bad += 1; };

/* The body of a top-level function, up to the next one. */
const fn = (name) => {
  const at = Math.max(src.indexOf(`\nfunction ${name}(`), src.indexOf(`\nexport default function ${name}(`));
  if (at < 0) return "";
  const next = src.slice(at + 1).search(/\nfunction [A-Z]/);
  return next < 0 ? src.slice(at) : src.slice(at, at + 1 + next);
};

console.log("the tabs:");
const { ADMIN_TABS, LEGACY_TABS, resolveAdminTab } = await import(new URL("../lib/adminTabs.js", import.meta.url));
ok(ADMIN_TABS.map(([id]) => id).join(",") === "inbox,updates,listings,write,audience,system", "six tabs: Inbox, Updates, Listings, Write, Audience, System");
for (const [old, [tab, anchor]] of Object.entries({
  catalogue: ["listings", ""], data: ["listings", "details-to-confirm"], announcements: ["write", "announcements"],
  ideas: ["write", "ideas"], outreach: ["write", "outreach"], people: ["audience", ""],
})) {
  const r = resolveAdminTab(old);
  ok(r.tab === tab && r.anchor === anchor && LEGACY_TABS[old], `?tab=${old} lands on ${tab}${anchor ? `#${anchor}` : ""}`);
  if (anchor) ok(new RegExp(`anchor="${anchor}"`).test(src), `  and the panel it names carries anchor="${anchor}"`);
}
ok(resolveAdminTab("nonsense").tab === "inbox" && resolveAdminTab("").tab === "inbox", "anything else is the Inbox");
ok(!/^"use client"/m.test(tabsSrc), "the tab list is plain data the server page can read");
{
  const gate = page.indexOf("!isAdmin(session.email)");
  const redir = page.indexOf("redirect(`/admin?tab=");
  const firstRead = page.search(/await (read|getClaims|getSubscribers|Promise\.allSettled)/);
  ok(gate > 0 && redir > gate, "the legacy redirect is after the admin check, so it confirms nothing to a stranger");
  ok(firstRead < 0 || redir < firstRead, "and before any store read, so it costs nothing");
}
ok(/\/admin\?tab=write#about-page/.test(read("app/about/page.js")), "the About page's Edit link names the new tab");

console.log("\nwork first, then one Reference group:");
const LAYERS = {
  Inbox: { work: ["Suggestions to review", "OpenReports", "ReviewsToDecide", "Claims to check"], ref: [] },
  RecentUpdates: { work: ["ChangeMonitor", "Post a vendor announcement"], ref: ["On Recent updates", "Monitor coverage"] },
  Listings: { work: ['part="work"', "StructuredData"], ref: ['part="held"', "NeedsVerifying", "EditorUse", "PublishedEntries", "Vendor media", "Discovered"] },
  Write: { work: ["Announcements", "Compose", "AboutPage"], ref: ["Ideas", "Outreach"] },
  Audience: { work: ["RecommenderRuns", "Stats", "Interest"], ref: ["Accounts", "Subscribers", "Verified claims", "ReviewsRecord", "Blog comments read"] },
};
for (const [tab, { work, ref }] of Object.entries(LAYERS)) {
  const body = fn(tab);
  const refAt = body.indexOf("<Reference");
  ok(body.length > 0, `${tab} exists`);
  if (!ref.length) { ok(refAt < 0, `${tab} is all work: every panel on it is a queue`); continue; }
  ok(body.split("<Reference").length === 2, `${tab} has exactly one Reference group`);
  for (const w of work) ok(body.indexOf(w) >= 0 && body.indexOf(w) < refAt, `${tab}: ${w} is work, above the reference`);
  for (const r of ref) ok(body.indexOf(r, refAt) > refAt, `${tab}: ${r} is reference`);
}
{
  const sys = fn("System");
  const groups = [...sys.matchAll(/<Reference title="([^"]+)"/g)].map((m) => m[1]);
  ok(groups.join(",") === "Records,Logs,Tools", "System is the status strip, then Records, Logs and Tools");
  ok(sys.indexOf("<StatusStrip") < sys.indexOf("<Reference"), "with the strip above all three");
  const at = (t) => sys.indexOf(t);
  const [rec, logs, tools] = ['title="Records"', 'title="Logs"', 'title="Tools"'].map(at);
  for (const t of ["Reviewed suggestions", "Published suggestions", "<OutOfScope", "<Deleted", 'part="records"', "<Tallies"]) ok(at(t) > rec && at(t) < logs, `Records holds ${t.replace(/[<"]/g, "")}`);
  for (const t of ["Changelog archive", "AI rewrites", "Monitor accuracy", "Dedup decisions", "Mail log"]) ok(at(t) > logs && at(t) < tools, `Logs holds ${t}`);
  for (const t of ["<Housekeeping", "Test an event"]) ok(at(t) > tools, `Tools holds ${t.replace("<", "")}`);
}
ok(/const QuietCtx = createContext\(false\)/.test(src) && /<QuietCtx\.Provider value=\{true\}>/.test(fn("Reference")),
  "Reference marks everything inside it as quiet");
ok(/useState\(quiet \? false : openWhen\)/.test(fn("Collapsible")), "and a quiet panel always starts shut, whatever it would open on");
ok(/data-panel=\{quiet \? "reference" : "work"\}/.test(fn("Collapsible")) && /data-layer="reference"/.test(fn("Reference")),
  "the two layers are marked in the HTML, so a render can be checked too");
ok(!/function Catalogue\(|function People\(|function PublishingNote\(/.test(src), "Catalogue, People and How publishing works are gone");
ok((src.match(/<Interest interest=/g) || []).length === 1, "Interest in listed tools is shown once, on Audience");
ok((src.match(/<CoverageList rows=/g) || []).length === 1, "the coverage list is shown once, on Updates; System's strip counts it");
ok(!/<Discovered /.test(fn("Inbox")) && !/<CoverageLine/.test(fn("Inbox")), "the Inbox carries no leads and no coverage, only queues");

console.log("\nwhat a tab's count means:");
const panel = fn("AdminPanel");
const countsBlock = panel.slice(panel.indexOf("const counts = {"), panel.indexOf("};", panel.indexOf("const counts = {")));
ok(/inbox: inboxCount/.test(countsBlock) && /const inboxCount = Object\.values\(waiting\)/.test(panel), "Inbox counts the queues in `waiting`");
ok(/updates: openChanges\.length/.test(countsBlock), "Updates counts the open monitor findings");
ok(/listings: backlog\.drafts \+ backlog\.details/.test(countsBlock), "Listings counts drafts waiting and details to confirm");
ok(/write: backlog\.announcements/.test(countsBlock), "Write counts announcements in draft or ready");
ok(/audience: 0/.test(countsBlock) && /system: 0/.test(countsBlock), "Audience and System carry no count");
ok(/reviews: reviewsToDecide/.test(panel) && /reviewsToDecide = \(reviewRows \|\| \[\]\)\.reduce\(\(n, g\) => n \+ \(g\.needs/.test(panel),
  "reviews count what is still to decide, not reviews");
ok(/drafted\(list\)\.filter\(\(e\) => !holdMap\[/.test(panel), "drafts count what is not on hold");
for (const ref of ["discovery", "coverage", "verifiedClaims", "accounts", "subscribers", "interest", "entryRows", "publishedRows", "deletedRows"]) {
  const waitingBlock = panel.slice(panel.indexOf("const waiting = {"), panel.indexOf("const inboxCount"));
  ok(!new RegExp(`\\b${ref}\\b`).test(waitingBlock + countsBlock), `nothing in reference (${ref}) feeds a count`);
}
ok(/<Summary waiting=\{waiting\} backlog=\{backlog\}/.test(fn("Inbox")) && /waiting=\{waiting\}\s+backlog=\{backlog\}/.test(panel),
  "the Inbox's summary line reads the same figures the tab labels read");
ok(/Waiting on you/.test(fn("Summary")) && /Your backlog/.test(fn("Summary")), "it says what is waiting, then your own backlog, quieter");
for (const [key, anchor] of Object.entries({ suggestions: "q-suggestions", reports: "q-reports", claims: "q-claims", comments: "q-comments",
  questions: "q-questions", lists: "q-lists", media: "q-media", reviews: "q-reviews" })) {
  ok(new RegExp(`${key}: \\[[^\\]]*"${anchor}"\\]`).test(src) && new RegExp(`anchor="${anchor}"`).test(src), `the summary's ${key} links to its list`);
}

console.log("\nlong lists are shut:");
for (const t of ["Reviewed suggestions", "Interest in listed tools", "Accounts", "Out of scope", "Deleted", "On Recent updates",
  "Monitor coverage", "Needs verifying", "Editor use", "Vendor media", "Published suggestions", "Mail log", "Store contents", "Subscribers",
  "Verified claims", "Published from the queue", "Discovered competitors", "Directory stats", "Growth recommender", "Recommender feedback",
  "On hold", "Discarded", "Committed from here", "Counts", "Excluded reviews", "Confirmed reviews", "Other reviews", "Blog comments read", "Outreach",
  "Send to the list", "Changelog archive", "AI rewrites", "Monitor accuracy", "Dedup decisions"]) {
  ok(new RegExp(`<Collapsible\\s+title="${t}"`).test(src) || (t === "Needs verifying" && /title="Needs verifying"/.test(src)), `${t} is collapsed`);
}
ok(!/title="Monitor coverage"[^>]*\n\s*openWhen=/.test(src), "Monitor coverage does not open itself");
for (const t of ["Suggestions to review", "Claims to check", "Comments to read", "Questions to read", "Lists published", "Media to approve",
  "Reports and corrections", "Reviews to decide", "Drafts", "Ideas", "Announcements", "Details to confirm"]) {
  ok(new RegExp(`<WorkList rows=\\{[^}]+\\} title="${t}"`).test(src), `${t} is a work list: open while ten or fewer, shut with its count past ten`);
}
ok(/function WorkList\(\{ rows = 0, \.\.\.props \}\) \{\s*return <Collapsible \{\.\.\.props\} openWhen=\{rows <= ROW_LIMIT\} \/>/.test(src) && /const ROW_LIMIT = 10;/.test(src), "WorkList opens only at ten rows or fewer");
const SHORT = ["Post a vendor announcement", "Growth recommender", "Recommender feedback", "Listing changes"];
for (const m of src.matchAll(/<Section\s+title="([^"]+)"[\s\S]*?<\/Section>/g)) {
  if (SHORT.includes(m[1])) continue;
  ok(!/\.map\(/.test(m[0]), `${m[1]} draws no open list`);
}
ok(/groups\.length > ROW_LIMIT/.test(src) && /tools with changes/.test(src), "past ten tools the monitor's groups are shut behind a count");
const ann = fn("AnnouncementRow");
ok(/const \[open, setOpen\] = useState\(false\)/.test(ann) && /body=\{!open \?/.test(ann), "each announcement is one line until opened");
for (const f of ["IdeaRow", "StructuredRow"]) ok(/useState\(false\)/.test(fn(f)), `${f} starts closed`);

console.log("\none row:");
ok(/expandable = false/.test(fn("Row")) && /headActions/.test(fn("Row")) && /inset = false/.test(fn("Row")) && /\{children &&/.test(fn("Row")),
  "Row has the expandable, group (children), inset and title-line action modes");
ok(/<Row expandable/.test(fn("DraftRow")), "a draft is an expandable Row");
ok(/<Row expandable open=\{expanded\}/.test(fn("ToolChanges")) && /headActions=/.test(fn("ToolChanges")) && /<Row key=\{r\.id\}/.test(fn("ToolChanges")),
  "a tool's findings are a group Row with its batch actions on the title line, and each finding is a Row");
ok(/<Row\b/.test(fn("ReviewGroup")) && /<ReviewItem/.test(fn("ReviewGroup")), "a listing's reviews are a group Row");
ok(/<Row inset/.test(fn("DraftPanel")), "the research draft under a suggestion is an inset Row");
for (const f of ["DraftRow", "ToolChanges", "ReviewGroup", "DraftPanel", "Drafts"]) {
  ok(!/borderTop: `1px solid \$\{C\.line\}`, padding/.test(fn(f)), `${f} draws no row markup of its own`);
}

console.log("\none confirm:");
const confirm = fn("ConfirmBtn");
ok(/reason = ""/.test(confirm) && /choices = null/.test(confirm) && /note = null/.test(confirm), "ConfirmBtn takes a required reason, choices and a note");
ok(/Boolean\(reason\) && !text\.trim\(\)/.test(confirm), "and refuses the second press until the reason has text");
const homeGrown = ["setArmed", "setConfirming", "setArming", "setMode("];
for (const h of homeGrown) {
  const outside = src.replace(confirm, "");
  ok(!outside.includes(h), `no two-press flow of its own outside ConfirmBtn (${h.replace("(", "")})`);
}
ok(!/<Btn[^>]*>\s*(Delete|Dismiss|Unpublish|Revoke|Discard|Remove)\b/.test(src), "every destructive action is a ConfirmBtn, never a bare Btn");
const da = fn("DraftActions");
ok(/<ConfirmBtn tone="go" confirm="Commit to main"[\s\S]*?>Publish<\/ConfirmBtn>/.test(da), "Publish is two presses: Publish, then Commit to main");
ok(/<ConfirmBtn confirm="Remove from file and commit" reason=[\s\S]*?>Discard<\/ConfirmBtn>/.test(da), "Discard is two presses with a required reason");
ok(/reason="What it is waiting on"[\s\S]*?>Hold<\/ConfirmBtn>/.test(da), "Hold takes a required note");
ok(/<ConfirmBtn[\s\S]*?confirm="Take it off the site">Unpublish<\/ConfirmBtn>/.test(fn("DraftPanel")), "Unpublish from the research draft is two presses");
ok(/<ConfirmBtn tone="go"[\s\S]*?confirm=\{`Confirm \$\{g\.burstOpen\.length\} as genuine`\}/.test(fn("ReviewGroup")), "confirming a burst is two presses");
ok(/<ConfirmBtn tone="go"[\s\S]*?confirm="Publish to Recent updates"/.test(fn("RecentUpdates")), "a vendor announcement is two presses, with what will appear shown between them");
ok(/<ConfirmBtn tone="stop"[\s\S]*?confirm=\{`Yes, send to \$\{count\}`\}/.test(fn("Compose")), "sending to the list is two presses");
ok(/choices=\{\[\.\.\.DISMISS_REASONS, \["No reason", ""\]\]\}/.test(fn("Discovered")), "dismissing a discovered name is one press to arm, one per reason");
ok(/reason="What it got wrong/.test(fn("MarkWrong")), "marking a finding wrong takes a required reason");
{
  const watch = read("components/WatchEditor.jsx");
  ok(/armed \? commit\(\) : setArmed\(true\)/.test(watch) && /Yes, commit it/.test(watch), "the caveat editor still takes exactly two presses");
}

console.log("\nno em dash on screen:");
{
  const visible = src.split("\n").filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l) && !/\/\*.*—.*\*\//.test(l) && !/\/\[—–\]\//.test(l));
  ok(!visible.some((l) => l.includes("—")), "no em dash in any string the console renders");
}

console.log(bad ? `\n${bad} failed` : "\nall passed");
process.exit(bad ? 1 : 0);
