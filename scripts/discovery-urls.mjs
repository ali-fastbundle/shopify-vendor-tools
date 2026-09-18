#!/usr/bin/env node
/*
 * Discovery: link capture, and the dismissed set.
 *
 *   node scripts/discovery-urls.mjs
 *
 * Every finding said "no URL given on the page" and Research and draft failed
 * on click. The cause was not the model: `textOf` strips tags before the page
 * is handed over, so the hrefs were gone before anything could read them. A
 * /vs page linking to the competitor is the single most reliable thing about
 * these pages, and it was the one thing the fetch destroyed.
 *
 * That is invisible from the outside, which is why it survived a whole run: the
 * output looked like a model being unhelpful. So the anchor extraction is
 * pinned here against real comparison-page markup.
 */

import { readFileSync, writeFileSync, mkdtempSync, readdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { pathToFileURL } from "url";

const ROOT = new URL("..", import.meta.url).pathname;
const shim = mkdtempSync(join(tmpdir(), "svt-disc-"));
for (const f of readdirSync(join(ROOT, "lib"))) {
  if (!f.endsWith(".js")) continue;
  writeFileSync(join(shim, f),
    readFileSync(join(ROOT, "lib", f), "utf8").replace(/(from\s+"\.\/[a-zA-Z]+)"/g, '$1.js"'));
}
const load = (f) => import(pathToFileURL(join(shim, f)).href);
const { discoveryKey, dismissFinding, restoreFinding, getDismissed, getDiscovery,
        anchorsOf, linkForName } = await load("discovery.js");
const store = await load("store.js");

let bad = 0;
const ok = (c, l, d = "") => {
  console.log(`  ${c ? "ok  " : "FAIL"}  ${l}${d ? `  ${d}` : ""}`);
  if (!c) bad += 1;
};

/* The shape a real /compare page has: the competitor as a link, plus the nav,
   the footer and a link to another of the publisher's own pages. */
const PAGE = `
<html><body>
  <nav><a href="/pricing">Pricing</a><a href="/compare">Compare</a></nav>
  <h1>Ranksy vs the alternatives</h1>
  <p>Teams switching from <a href="https://appjubilee.io/features">AppJubilee</a> usually cite price.</p>
  <p>See also <a href="https://www.storeleads.app">Store Leads</a> for store data.</p>
  <p>Some people use <a href="https://apollo.io?utm=x">Apollo.io</a> for contacts.</p>
  <a href="https://ranksyapp.com/self">our own other page</a>
  <footer><a href="https://twitter.com/ranksy">Twitter</a></footer>
</body></html>`;

console.log("anchor extraction, run against real markup:");
const links = anchorsOf(PAGE, "https://ranksyapp.com");
{
  const hrefs = links.map((l) => l.href);
  ok(hrefs.includes("https://appjubilee.io/features"), "captures the competitor link", hrefs.join(" "));
  ok(hrefs.includes("https://www.storeleads.app"), "and another one");
  ok(hrefs.some((h) => h.startsWith("https://apollo.io")), "and one with a query string, stripped");
  ok(!hrefs.some((h) => h.includes("ranksyapp.com")), "drops the publisher's own links");
  ok(!hrefs.some((h) => h.includes("twitter.com")), "drops social links, never a competitor's site");
  ok(anchorsOf('<a href="https://blog.ranksyapp.com/x">Blog</a>', "https://ranksyapp.com").length === 0,
    "drops the publisher's own subdomains, which an origin check would have kept");
  ok(anchorsOf('<a href="https://g2.com/products/x">Reviews</a>', "https://ranksyapp.com").length === 0,
    "and review sites");
  ok(!hrefs.some((h) => h.endsWith("/pricing")), "drops relative nav links, which resolve to its own origin");
  ok(links.find((l) => l.href === "https://appjubilee.io/features")?.text === "AppJubilee",
    "keeps the anchor text, which is how a name is matched to a link");

  const src = readFileSync(join(ROOT, "lib", "discovery.js"), "utf8");
  ok(src.indexOf("const html =") < src.indexOf("const text = textOf(html)"),
    "the raw html is kept before textOf strips it, which is the whole bug");
  ok(/outbound links on this page/.test(src), "and the links reach the prompt");
}

console.log("\nmatching a name to a link, with no model:");
{
  const pages = [{ url: "https://ranksyapp.com/compare", text: "", links }];
  ok(linkForName("AppJubilee", pages) === "https://appjubilee.io/features", "exact anchor text");
  ok(linkForName("Store Leads", pages) === "https://www.storeleads.app", "anchor text with a space");
  ok(linkForName("Apollo.io", pages).startsWith("https://apollo.io"), "a name with punctuation");
  ok(linkForName("Nothing Here", pages) === "", "and nothing invented when there is no match");
  const byHost = [{ url: "x", text: "", links: [{ href: "https://ranksy.com/x", text: "click here" }] }];
  ok(linkForName("Ranksy", byHost) === "https://ranksy.com/x",
    "falls back to the hostname when the anchor text is useless");
}

console.log("\nurl provenance:");
{
  const src = readFileSync(join(ROOT, "lib", "discovery.js"), "utf8");
  ok(/urlSource: url \? "found" : ""/.test(src), "a link off the page is marked found");
  ok(/f\.urlSource = "resolved"/.test(src), "a domain from the model is marked resolved");
  const ui = readFileSync(join(ROOT, "components", "Admin.jsx"), "utf8");
  ok(/urlSource === "resolved"/.test(ui), "and the admin shows the difference");
  ok(/disabled=\{!f\.url\}/.test(ui), "research is disabled with no url rather than failing on click");
}

console.log("\nthe dismissed set:");
{
  ok(discoveryKey("Apollo.io") === "apolloio", "keys match runDiscovery's grouping", discoveryKey("Apollo.io"));
  ok(discoveryKey("Apollo .io!") === discoveryKey("apollo.io"), "and ignore punctuation and case");

  await store.write("svt:discovery", {
    at: "2026-09-18T00:00:00.000Z", checked: 3, withPages: 2,
    findings: [
      { name: "Apollo.io", url: "https://apollo.io", count: 2, namedBy: ["A", "B"] },
      { name: "Affilitrak", url: "", count: 1, namedBy: ["A"] },
      { name: "Something Real", url: "https://real.invalid", count: 3, namedBy: ["A", "B", "C"] },
    ],
  });

  ok((await getDiscovery()).findings.length === 3, "all three show before any are dismissed");

  await dismissFinding({ name: "Apollo.io", url: "https://apollo.io",
    reason: "Not a tool for Shopify app vendors", by: "admin@test" });
  const after = await getDiscovery();
  ok(after.findings.length === 2, "dismissing removes it from the list without a re-run",
    "filtered on read, not only on write");
  ok(!after.findings.some((f) => f.name === "Apollo.io"), "and it is the right one");
  ok(after.dismissed.length === 1, "it appears in the dismissed list");
  ok(after.dismissed[0].reason === "Not a tool for Shopify app vendors", "with its reason");
  ok(after.dismissed[0].by === "admin@test", "and who did it");

  const raw = await store.read("svt:discovery", {});
  ok(raw.findings.length === 3, "the stored finding is kept, not destroyed");

  /* The point of the set: a later run must not hand the name back. */
  const src = readFileSync(join(ROOT, "lib", "discovery.js"), "utf8");
  ok(/if \(dismissed\[key\]\) continue;/.test(src), "and runDiscovery skips it on the next pass");

  await restoreFinding(discoveryKey("Apollo.io"));
  const back = await getDiscovery();
  ok(back.findings.length === 3, "restore puts it back");
  ok(back.dismissed.length === 0, "and clears the record");

  const gone = await restoreFinding("neverdismissed");
  ok(Boolean(gone.error), "restoring something never dismissed is an error, not a silent no-op");
  ok(Boolean((await dismissFinding({ name: "" })).error), "and a nameless finding cannot be dismissed");
}

console.log(`\n${bad ? `${bad} FAILED` : "all passed"}`);
process.exit(bad ? 1 : 0);
