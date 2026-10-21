#!/usr/bin/env node
/*
 * Fewer decisions before content (2026-10-17). Each of these was a control
 * that came back one reasonable commit at a time, so each is held here.
 *
 *   node scripts/decisions-test.mjs
 */
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = new URL("..", import.meta.url).pathname;
const src = (f) => readFileSync(join(ROOT, f), "utf8");
let bad = 0;
const ok = (c, l) => { console.log(`  ${c ? "ok  " : "FAIL"}  ${l}`); if (!c) bad += 1; };

const dir = src("components/Directory.jsx");
const theme = src("components/Theme.jsx");
const frame = src("components/SiteFrame.jsx");
const vote = src("components/Vote.jsx");
const fn = (name) => dir.slice(dir.indexOf(`function ${name}(`), dir.indexOf("\nfunction ", dir.indexOf(`function ${name}(`) + 10));

console.log("theme:");
const toggle = theme.slice(theme.indexOf("export function ThemeToggle"));
ok((toggle.match(/<button/g) || []).length === 1, "one button that cycles, not a group of three");
ok((frame.match(/<ThemeToggle \/>/g) || []).length === 1, "rendered once by the frame");
ok(!/footer[\s\S]*ThemeToggle/.test(frame.slice(frame.indexOf("export function SiteFooter"))), "and not in the footer");

console.log("\nthe hero:");
const matcher = fn("Matcher");
const form = matcher.slice(0, matcher.indexOf("{result && ("));
ok(!/\/recommend/.test(form), "the recommender is not a second call to action beside Find tools");
ok(/\/recommend/.test(matcher.slice(matcher.indexOf("{result && ("))), "it is offered after an answer");
ok(/href="\/recommend"/.test(src("components/ToolPage.jsx")), "and on every tool page");
/* 2026-10-18: the recommender is the one place a visitor gives an email for
   something built for their app, so it is in the spotlight, not a footnote. */
const frameSrc = src("components/SiteFrame.jsx");
ok(/\{!path\.startsWith\("\/recommend"\) && <GrowthPicks \/>\}/.test(frameSrc) && /href="\/recommend"/.test(frameSrc.slice(frameSrc.indexOf("function GrowthPicks"))),
  "it has its own block in the sidebar on every page but its own");
ok(/\{i === 0 && <PicksCard where="picks-narrow" \/>\}/.test(dir) && /\{i === Math\.min\(2, rows\.length - 1\) && <PicksCard where="picks-wide" \/>\}/.test(dir)
  && /\.picks-wide \{ display: none !important; \}/.test(src("app/globals.css")),
  "and a card in the grid: after the first card on a phone, opening the second row wider, never above the first card");
ok(/Sign in with your email/.test(frameSrc) && /Sign in with your email/.test(dir), "both say it needs an email before anyone clicks");
ok(!/<details/.test(form), "examples are not behind a disclosure");
const examples = dir.slice(dir.indexOf("const EXAMPLES = ["), dir.indexOf("];", dir.indexOf("const EXAMPLES = [")));
ok((examples.match(/label:/g) || []).length === 3, "three examples, each a chip");
ok(/`\$\{toolTotal\} tools for Shopify app builders in \$\{CATEGORIES\.length\} categories, updated \$\{LAST_UPDATED\}\.`/.test(dir), "the stats are one short sentence");

console.log("\nthe card and the bar:");
const card = fn("Card");
ok(!/<span>Compare<\/span>/.test(card) && !/onClick=\{onPick\}/.test(card), "no Compare control on a card");
ok(/function ViewToggle[\s\S]*?Compare\s*\n?\s*<\/button>/.test(dir) && !/\["grid", "Grid"\], \["list", "List"\]/.test(dir), "one Compare toggle opens the table, where rows are picked");
ok(!/>Add a tool \{suggestions/.test(dir), "Add a tool is not on the bar");
ok(/\{n > 0 && <span>\{n\}<\/span>\}/.test(vote) && /title=\{tip\}/.test(vote), "a vote count shows only above zero, with a tooltip saying what it counts");

console.log("\nbelow the grid:");
const road = fn("Roadmap");
ok(road.indexOf("<Subscribe />") > -1 && road.indexOf("<Subscribe />") < road.indexOf("pending.map"), "the roadmap comes after the subscribe block");
ok(!/<h2/.test(road) && !/className="roadmap"/.test(road), "as one line of names, not a section");

console.log(bad ? `\n${bad} failed` : "\nall passed");
process.exit(bad ? 1 : 0);
