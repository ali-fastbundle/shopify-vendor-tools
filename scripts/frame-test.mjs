#!/usr/bin/env node
/*
 * The sidebar frame (2026-10-18): one persistent sidebar beside a content
 * column on every public page, a drawer below 1200px, the URL as the state.
 *
 *   node scripts/frame-test.mjs [baseUrl]
 *
 * Source checks always run. With a running server (default
 * http://localhost:3000) it also checks the server HTML, which is what a
 * crawler and a keyboard user meet first.
 */
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = new URL("..", import.meta.url).pathname;
const BASE = process.argv[2] || "http://localhost:3000";
const src = (f) => readFileSync(join(ROOT, f), "utf8");
let bad = 0;
const ok = (c, l, d = "") => { console.log(`  ${c ? "ok  " : "FAIL"}  ${l}${d ? `  ${d}` : ""}`); if (!c) bad += 1; };
const order = (s, parts) => parts.every((p, i) => i === 0 || (s.indexOf(parts[i - 1]) > -1 && s.indexOf(p) > s.indexOf(parts[i - 1])));

const frame = src("components/SiteFrame.jsx");
const layout = src("app/layout.js");
const css = src("app/globals.css");
const dir = src("components/Directory.jsx");
const shell = frame.slice(frame.indexOf("export function SiteShell"), frame.indexOf("function Sidebar("));
const sidebar = frame.slice(frame.indexOf("function Sidebar("), frame.indexOf("function SearchBox("));

console.log("one frame:");
ok(/<SiteShell \{\.\.\.frame\}>/.test(layout) && /const fd = frameData\(tools\);/.test(layout) && !/SiteHeader/.test(layout), "the layout renders the shell around every page");
const fd = src("lib/frameData.js");
/* The tool figures are the public count (invariant 53), which includes the
   queue, so they need the store: one cached read through lib/toolCountStore.js,
   never a direct catalogue or store read in the layout. */
ok(!/from "(@\/lib\/|\.\/)(store|listings|entries)"|mergedTools|catalogueTools/.test(layout + fd) && /toolCounts\(\)/.test(layout),
  "its tool counts are the one public count, through one cached read");
ok(/directory: tools\.total, newsletters: NEWSLETTERS\.length, events: upcoming, blog: POSTS\.length/.test(fd), "a count for each section");
ok(/at\.mode !== "inferred"/.test(fd), "events counts dated ones ahead, not guessed dates");
ok(/if \(outsideFrame\(path\)\) return children;/.test(shell), "/admin keeps its own frame");

console.log("\nkeyboard order and the drawer:");
ok(order(shell, ['className="skip-link"', 'className="shell-top"', 'id="site-sidebar"', 'id="content"']),
  "skip link, top bar, sidebar, then content: the sidebar is reachable before the grid");
ok(/setAttribute\("inert", ""\)/.test(shell) && /e\.key === "Escape"/.test(shell) && /menuRef\.current\?\.focus\(\)/.test(shell),
  "the open drawer makes the content inert, closes on Escape and hands focus back");
ok(/e\.key !== "Tab"/.test(shell) && /last\.focus\(\)/.test(shell) && /first\.focus\(\)/.test(shell), "and keeps Tab inside itself");
ok(/<nav aria-label="Sections" className="shell-tabs">/.test(shell), "below 1200px the sections are a bar, never behind the button");

console.log("\nthe sidebar, top to bottom:");
ok(order(sidebar, ["<Wordmark />", 'className="side-nav"', "<GrowthPicks", "<SidebarSearch", "<MatcherPrompt", "<DirectoryRefine", "flex: 1", "<AccountBar", "<ThemeToggle />", "<FooterLinks />"]),
  "wordmark, sections, search, matcher, categories and filters, spacer, account, theme, links");
const inSuspense = (name) => new RegExp(`<Suspense fallback=\\{[\\s\\S]{0,160}?\\}>\\s*<${name}`).test(sidebar);
ok(inSuspense("SidebarSearch") && inSuspense("DirectoryRefine") && inSuspense("FeedRefine"),
  "every part that reads the URL is inside Suspense, so the rest is in the server HTML on every page");
ok(/<CategoryList categories=\{categories\} active="all"/.test(sidebar), "and the categories' fallback is the list itself, not nothing");
ok(/unread > 0 && current !== "updates" \? unread : null/.test(sidebar), "Recent updates counts what is new to this browser, nothing at zero");

ok(/<AccountBar session=\{session\[0\]\} refresh=\{session\[1\]\} placement="up" trailing=\{<ThemeToggle \/>\} \/>/.test(sidebar)
  && /if \(session\.signedIn && placement === "up"\)/.test(src("components/Account.jsx")),
  "the account is two lines, who you are and one row of Admin, Sign out and the theme, with nothing orphaned");

console.log("\nthe content column:");
ok(!/masthead|hero-title|className="rail"|dir-body/.test(dir), "no hero, no masthead, no rail");
ok(order(dir, ['className="content-head"', "<h1", 'aria-label="Sort tools by"', "<ViewToggle", 'className="cards"']),
  "heading, description, sort and the view toggle, then the cards");
ok(/\{matcherOpen && \(/.test(dir) && /<Matcher [^>]*onClose=/.test(dir), "the matcher appears only when asked for, with its own way out");
ok(/\.cards \{ display: grid;[^}]*minmax\(0, 1fr\)/.test(css) && /min-width: 768px\) \{ \.cards \{ grid-template-columns: repeat\(2/.test(css)
  && /min-width: 1200px\) \{ \.cards \{ grid-template-columns: repeat\(3/.test(css), "three cards from 1200px, two from 768px, one below");
ok(/@media \(min-width: 1200px\) \{\s*\.shell \{[\s\S]*?grid-template-columns: 248px/.test(css) && /\.sidebar \{\s*position: sticky;\s*top: 0;\s*height: 100vh;/.test(css),
  "from 1200px a sticky sidebar the height of the window, scrolling on its own");
ok(/@media \(max-width: 1199px\) \{\s*\.sidebar \{\s*position: fixed;/.test(css), "below it, a drawer");

console.log("\ncolour and motion:");
/* The wordmark's bars are the palette shown as a legend, which invariant A
   allows; every other use must be the category list. */
const wordmark = frame.slice(frame.indexOf("export function Wordmark"), frame.indexOf("export function SiteShell"));
const outside = frame.replace(wordmark, "");
const colourUses = (outside.match(/c\.color/g) || []).length;
ok(colourUses === 1 && /background: c\.color/.test(frame.slice(frame.indexOf("function CategoryList("))), "category colour only on the category list's mark (and the wordmark legend)", `${colourUses} use(s)`);
const shellCss = css.slice(css.indexOf("The site frame: a sidebar"), css.indexOf("/* Every page wraps its body"));
ok(!/transition|animation/.test(shellCss), "the drawer appears; it does not slide");

console.log("\nserver HTML:");
try {
  const home = await (await fetch(`${BASE}/`)).text();
  const about = await (await fetch(`${BASE}/about`)).text();
  const filtered = await (await fetch(`${BASE}/?cat=support`)).text();
  ok(/class="side-nav"/.test(home) && /class="side-cats"/.test(home), "the homepage sidebar is in the first response");
  ok((home.match(/class="card-link"/g) || []).length >= 40, "and so are the cards");
  ok(/class="side-nav"/.test(about), "the sections are in the server HTML on a page that reads no URL");
  ok((filtered.match(/class="card-link"/g) || []).length < (home.match(/class="card-link"/g) || []).length, "a filtered link renders filtered on the server");
  ok(home.indexOf('class="skip-link"') < home.indexOf('id="site-sidebar"') && home.indexOf('id="site-sidebar"') < home.indexOf('class="card-link"'),
    "skip link, sidebar, then cards, in the HTML too");
} catch (e) {
  console.log(`  skip  no server at ${BASE} (${e.message})`);
}

console.log(bad ? `\n${bad} failed` : "\nall passed");
process.exit(bad ? 1 : 0);
