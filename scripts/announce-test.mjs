#!/usr/bin/env node
/*
 * The announcement drafter, and the RSS feed's escaping.
 *
 *   node scripts/announce-test.mjs
 *
 * Two things here are only checkable by running the code.
 *
 * The first is the house-voice examples. `houseVoice()` looks up five tool ids
 * and silently skips any it cannot find, so renaming a tool would quietly leave
 * the prompt with no examples in it and nothing would fail. The drafts would
 * just get worse, which is the kind of regression nobody traces back.
 *
 * The second is the em-dash scrub. The feed form rejects one, so a draft
 * containing one is a draft the admin has to fix by hand every time. The model
 * is told not to and told twice, and a rule stated in a prompt is a request
 * rather than a guarantee, so the code strips it too. This asserts the code
 * does, by feeding it a model that returns one.
 *
 * Like scripts/feed-test.mjs, lib/ is copied to a temp directory with import
 * extensions added. Here the copy of model.js is replaced with a stub, which is
 * how the drafter can be run at all without a provider key and a live call.
 */

import { readFileSync, writeFileSync, mkdtempSync, readdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { pathToFileURL } from "url";

const ROOT = new URL("..", import.meta.url).pathname;

function shimWith(stub) {
  const dir = mkdtempSync(join(tmpdir(), "svt-ann-"));
  for (const f of readdirSync(join(ROOT, "lib"))) {
    if (!f.endsWith(".js")) continue;
    const src = readFileSync(join(ROOT, "lib", f), "utf8").replace(/(from\s+"\.\/[a-zA-Z]+)"/g, '$1.js"');
    writeFileSync(join(dir, f), f === "model.js" ? stub : src);
  }
  return (f) => import(pathToFileURL(join(dir, f)).href);
}

/* Records the prompt it was handed, so the test can assert what the model is told. */
const seen = {};
const stub = (answer, ok = true) => `
export const configured = () => ${ok};
export const providers = () => [];
export async function askModel() { throw new Error("not used"); }
export async function askJson({ prompt, system }) {
  globalThis.__seen = { prompt, system };
  return { data: ${JSON.stringify(answer)}, provider: "stub" };
}`;

let bad = 0;
const ok = (c, l, d = "") => {
  console.log(`  ${c ? "ok  " : "FAIL"}  ${l}${d ? `  ${d}` : ""}`);
  if (!c) bad += 1;
};

const CHANGE = {
  kind: "pricing", what: "Starter tier went from $49 to $79 a month.",
  old: "$49/mo", new: "$79/mo", url: "https://ranksyapp.com/pricing", confidence: 0.9,
  edit: { field: "price", from: "from $49/mo", to: "from $79/mo" },
};

console.log("no provider configured:");
{
  const load = shimWith(stub({ announcement: "x" }, false));
  const { draftAnnouncement } = await load("announce.js");
  const { TOOLS } = await load("tools.js");
  const tool = TOOLS.find((t) => t.id === "ranksy");
  const r = await draftAnnouncement({ change: CHANGE, tool });
  ok(Boolean(r.error) && !r.draft, "returns an error and no draft", r.error || "");
}

console.log("\ndrafting:");
const load = shimWith(stub({
  announcement: "The Starter tier went from $49  to $79 a month — the free tier is unchanged.\n",
  thin: false, note: "",
}));
const { draftAnnouncement } = await load("announce.js");
const { TOOLS } = await load("tools.js");
const tool = TOOLS.find((t) => t.id === "ranksy");
const out = await draftAnnouncement({ change: CHANGE, tool, priorEntries: [], elsewhere: [] });

ok(!out.error && Boolean(out.draft), "returns a draft", out.error || "");
ok(!out.draft.includes("—"), "the em-dash is stripped even when the model returns one", out.draft);
ok(!/\s{2,}|\n/.test(out.draft), "whitespace is collapsed");
ok(!/\s[,.;:]/.test(out.draft), "and it does not leave a space before the comma it replaced it with", out.draft);
ok(out.provider === "stub", "reports which provider wrote it");

console.log("\nwhat the model is told:");
const { prompt, system } = globalThis.__seen;
ok(prompt.includes("$49/mo") && prompt.includes("$79/mo"), "the observed values are in the prompt");
ok(prompt.includes("https://ranksyapp.com/pricing"), "and the source page");
ok(/never.*em-dash|NEVER an em-dash/i.test(prompt), "it is told not to use an em-dash");
ok(/motive|invent/i.test(prompt), "and told not to infer motive");
ok(/never why|only what was observed/i.test(system), "the system prompt pins it to what was observed");

/*
 * The examples are real catalogue lines rather than lines written for the
 * prompt, so that they cannot drift from the site. That only holds while the
 * ids resolve.
 */
const examples = prompt.slice(prompt.indexOf("THE VOICE"), prompt.indexOf("Notice:")).split("\n").filter((l) => l.startsWith("- "));
ok(prompt.includes("first reading") && /semicolons/i.test(prompt), "and the voice rules follow the examples");
ok(examples.length >= 6, `the voice section has examples in it`, `${examples.length} lines`);
const catalogue = readFileSync(join(ROOT, "lib", "tools.js"), "utf8");
const strays = examples.filter((l) => !catalogue.includes(l.slice(2).replace(/\.$/, "")));
ok(strays.length === 0, "and every one is lifted from the catalogue",
  strays.length ? `invented: ${strays[0].slice(0, 60)}` : "");

console.log("\nvoice checks:");
const { voiceIssues, VOICE_RULES } = await import(join(ROOT, "lib", "voice.js"));
const off = voiceIssues("We are excited to unlock a seamless journey; it is powerful \u2014 truly! " +
  "This sentence keeps going and going with many more words than anybody reading it on a phone in a second language would want to hold in their head at once.");
ok(off.emDash && off.semicolons === 1 && off.exclamations === 1, "em dash, semicolon and exclamation are caught");
ok(["excited", "unlock", "seamless", "journey", "powerful"].every((w) => off.marketing.includes(w)), "marketing words are caught", off.marketing.join(", "));
ok(off.long.length === 1, "a sentence past 25 words is flagged", off.long[0] || "");
const good = voiceIssues("Added Category Comparisons. It sets App Store categories side by side on pricing, ratings and reviews. The $1.4M figure is the vendor's own.");
ok(!good.emDash && !good.semicolons && !good.marketing.length && !good.long.length, "plain text passes clean");
ok(!/\u2014/.test(VOICE_RULES) && !/;/.test(VOICE_RULES), "the rules break none of their own punctuation rules");

console.log("\nRSS escaping:");
const rss = readFileSync(join(ROOT, "app", "changes", "rss", "route.js"), "utf8");
for (const [ch, ent] of [["&", "&amp;"], ["<", "&lt;"], [">", "&gt;"]]) {
  ok(rss.includes(ent), `escapes ${ch} as ${ent}`);
}
ok(/&amp;/.test(rss) && rss.indexOf("&amp;") < rss.indexOf("&lt;"),
  "and escapes the ampersand first, or the others get double-escaped");

console.log(`\n${bad ? `${bad} FAILED` : "all passed"}`);
process.exit(bad ? 1 : 0);
