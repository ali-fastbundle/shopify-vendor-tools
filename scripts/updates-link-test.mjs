#!/usr/bin/env node
/*
 * A listing may link to its changes but never contain them (invariant 31).
 *
 *   node scripts/updates-link-test.mjs
 *
 *  - updatesLink counts published rows by the listing's own path, so an owner
 *    and a tool sharing an id (Mantle) are kept apart; deleted rows do not
 *    count; nothing when there is nothing (rule E); "N updates since <month>"
 *    with the year only when it is not this one; the link is /changes?on=
 *  - /changes filters on ?on= by the same path
 *  - the tool, newsletter, event and owner pages and the modal receive the
 *    computed link only, never feed entries, and render UpdatesLink
 *  - UpdatesLink renders a count and a link and no entry text
 */
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readFileSync } from "node:fs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { updatesLink, entryHref } = await import(pathToFileURL(join(root, "lib/feedSource.js")).href);
const src = (f) => readFileSync(join(root, f), "utf8");
let failed = 0;
const ok = (c, what, extra = "") => { console.log(`  ${c ? "ok  " : "FAIL"}  ${what}${extra ? `  ${extra}` : ""}`); if (!c) failed++; };

const rows = [
  { toolId: "mantle", date: "2026-09-21", headline: "a" },
  { toolId: "mantle", date: "2026-10-02", headline: "b" },
  { toolId: "mantle", date: "2026-10-30", headline: "c" },
  { toolId: "mantle", date: "2026-10-31", headline: "d", deletedAt: "2026-11-01" },
  { toolId: "mantle", href: "/owners/mantle", date: "2026-10-10", headline: "owner row" },
  { toolId: "shopifreaks", href: "/newsletters/shopifreaks", date: "2025-12-01", headline: "e" },
];
const t = updatesLink(rows, "/tools/mantle", "2026-11-06");
ok(t && t.count === 3 && t.label === "3 updates since September" && t.href === "/changes?on=tools%2Fmantle", "a tool: counts its own published rows", JSON.stringify(t));
const o = updatesLink(rows, "/owners/mantle", "2026-11-06");
ok(o && o.count === 1 && o.label === "1 update in October", "an owner with the same id is counted apart", JSON.stringify(o));
const n = updatesLink(rows, "/newsletters/shopifreaks", "2026-11-06");
ok(n && n.label === "1 update in December 2025", "the year is said when it is not this one", n?.label);
ok(updatesLink(rows, "/events/dotdev", "2026-11-06") === null && updatesLink([], "/tools/x") === null, "nothing published, nothing returned");
ok(entryHref({ toolId: "x" }) === "/tools/x" && entryHref({ toolId: "x", href: "/events/x" }) === "/events/x", "a row's listing is its href, or the tool page");

const feed = src("components/ChangesFeed.jsx");
ok(/useParam\("on"\)/.test(feed) && /entryHref\(e\) === `\/\$\{on/.test(feed), "/changes filters on ?on= by the listing's path");

const pages = { "components/ToolPage.jsx": "app/tools/[id]/page.js", "components/NewsletterPage.jsx": "app/newsletters/[id]/page.js", "components/EventPage.jsx": "app/events/[id]/page.js", "components/Owners.jsx": "app/owners/[id]/page.js" };
for (const [comp, route] of Object.entries(pages)) {
  const c = src(comp), r = src(route);
  ok(/<UpdatesLink link=\{updates\} \/>/.test(c) && /updates=\{updatesLink\(await feedEntries/.test(r) && !/feedEntries|lib\/feed"/.test(c),
    `${comp}: gets the computed link from its route, never feed entries`);
}
const dir = src("components/Directory.jsx"), home = src("app/page.js");
ok(/<UpdatesLink link=\{updates\} \/>/.test(dir) && /updatesLink\(allFeed, `\/tools\/\$\{t\.id\}`\)/.test(home), "the listing modal gets a per-tool link map from the server");
const ul = src("components/UpdatesLink.jsx");
ok(/link\.label/.test(ul) && /link\.href/.test(ul) && !/headline|entries|\.map\(/.test(ul.replace(/\/\*[\s\S]*?\*\//g, "")), "UpdatesLink renders a count and a link, never an entry");

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
