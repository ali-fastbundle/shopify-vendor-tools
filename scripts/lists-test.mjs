#!/usr/bin/env node
/*
 * Saved lists: yours only, private until published, published under a name
 * that is not an address, indexed only after a person read it.
 *
 *   node scripts/lists-test.mjs
 *
 * Shims lib/ and the routes into a temp directory: in-memory store, no server.
 */
import { readFileSync, writeFileSync, mkdtempSync, readdirSync, mkdirSync, symlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { pathToFileURL } from "url";
import { createHmac } from "crypto";

const ROOT = new URL("..", import.meta.url).pathname;
const SECRET = "lists-secret";
process.env.AUTH_SECRET = SECRET;
process.env.ADMIN_EMAILS = "admin@test.invalid";
const dir = mkdtempSync(join(tmpdir(), "svt-lists-"));
mkdirSync(join(dir, "lib"));
for (const f of readdirSync(join(ROOT, "lib"))) {
  if (!f.endsWith(".js")) continue;
  writeFileSync(join(dir, "lib", f),
    readFileSync(join(ROOT, "lib", f), "utf8").replace(/(from\s+"\.\/[a-zA-Z_-]+)"/g, '$1.js"')
      .replace(/import\("\.\/([a-zA-Z]+)"\)/g, 'import("./$1.js")')
      /* Node's ESM loader needs the file name that Next's bundler does not. */
      .replace(/from "next\/cache"/g, 'from "next/cache.js"'));
}
const route = (from, to) => writeFileSync(join(dir, to), readFileSync(join(ROOT, from), "utf8")
  .replace(/from\s+"@\/lib\/([a-zA-Z]+)"/g, 'from "./lib/$1.js"').replace(/import\("@\/lib\/([a-zA-Z]+)"\)/g, 'import("./lib/$1.js")'));
route("app/api/lists/route.js", "lists.js");
route("app/api/admin/route.js", "admin.js");

/* lib/listsSection.js imports next/cache, so the temp copy needs the packages. */
symlinkSync(join(ROOT, "node_modules"), join(dir, "node_modules"));
const load = (f) => import(pathToFileURL(join(dir, f)).href);
const L = await load("lib/lists.js");
const store = await load("lib/store.js");
const lists = await load("lists.js");
const admin = await load("admin.js");

let bad = 0;
const ok = (c, l, d = "") => { console.log(`  ${c ? "ok  " : "FAIL"}  ${l}${d ? `  ${d}` : ""}`); if (!c) bad += 1; };
const src = (f) => readFileSync(join(ROOT, f), "utf8");
const cookie = (email) => {
  const b = Buffer.from(JSON.stringify({ t: "session", email, exp: Date.now() + 864e5 })).toString("base64url");
  return `svt_session=${b}.${createHmac("sha256", SECRET).update(b).digest("base64url")}`;
};
let n = 1;
const req = (url, email, body, method = "POST") => new Request(`http://localhost${url}`, {
  method, headers: { "Content-Type": "application/json", ...(email ? { Cookie: cookie(email) } : {}), "x-forwarded-for": `10.2.0.${n++}` },
  ...(body ? { body: JSON.stringify(body) } : {}),
});
const post = async (email, body) => { const r = await lists.POST(req("/api/lists", email, body)); return { status: r.status, body: r.ok ? await r.json() : await r.text() }; };

console.log("yours, and private:");
ok((await post(null, { action: "create", name: "ASO picks" })).status === 401, "signed out cannot make a list");
let r = await post("me@test.invalid", { action: "create", name: "ASO picks", toolId: "ranksy" });
ok(r.status === 200 && r.body.list.items[0].toolId === "ranksy" && r.body.list.public === false, "a new list starts private, with the tool saved");
ok(!("owner" in r.body.list), "the response does not echo the owner's address");
const id = r.body.list.id;
ok((await post("me@test.invalid", { action: "add", id, toolId: "not-a-tool" })).status === 400, "an unknown tool is refused");
await post("me@test.invalid", { action: "add", id, toolId: "rankbase" });
ok((await post("other@test.invalid", { action: "add", id, toolId: "applora" })).status === 400, "nobody else can change it");
ok((await (await lists.GET(req("/api/lists", "other@test.invalid", null, "GET"))).json()).lists.length === 0, "or see it");

console.log("\norder, notes, publishing:");
r = await post("me@test.invalid", { action: "save", id, name: "ASO picks", items: [{ toolId: "rankbase", note: "Cheaper per app" }, { toolId: "ranksy" }] });
ok(r.body.list.items.map((x) => x.toolId).join() === "rankbase,ranksy" && r.body.list.items[0].note === "Cheaper per app", "reordering and notes are saved");
ok((await post("me@test.invalid", { action: "save", id, items: [{ toolId: "ranksy", note: "see https://spam.example/x" }] })).status === 400, "a link in a note is refused");
ok((await post("me@test.invalid", { action: "save", id, public: true, byName: "" })).status === 400, "publishing needs a name to show");
ok((await post("me@test.invalid", { action: "save", id, public: true, byName: "me@test.invalid" })).status === 400, "and the name cannot be an address");
r = await post("me@test.invalid", { action: "save", id, public: true, byName: "Ali" });
ok(r.status === 200 && r.body.list.public && r.body.list.reviewed === false, "published under a name, waiting to be read");
ok(L.isShown((await store.read("svt:lists", {}))[id]) && !L.isIndexable((await store.read("svt:lists", {}))[id]), "shown at once, not indexed yet");
ok(!JSON.stringify(L.publicList((await store.read("svt:lists", {}))[id])).includes("@"), "the public view carries no address");

console.log("\nmoderation:");
const act = (action, extra = {}) => admin.POST(req("/api/admin", "admin@test.invalid", { action, id, ...extra }));
ok((await admin.POST(req("/api/admin", "x@test.invalid", { action: "list-fine", id }))).status === 404, "a non-admin gets 404");
await act("list-fine");
ok(L.isIndexable((await store.read("svt:lists", {}))[id]), "marked fine, it is indexable");
await post("me@test.invalid", { action: "save", id, name: "ASO picks, revised" });
ok(!L.isIndexable((await store.read("svt:lists", {}))[id]), "a change after that sends it back to be read");
ok((await act("list-hide", { reason: "" })).status === 400, "hiding needs a reason");
await act("list-hide", { reason: "Spam" });
ok(!L.isShown((await store.read("svt:lists", {}))[id]), "a hidden list is not shown");
await act("list-unhide");
ok(L.isShown((await store.read("svt:lists", {}))[id]), "and unhiding brings it back");

console.log("\nthe rest:");
ok((await post("me@test.invalid", { action: "delete", id })).status === 200 && !(await store.read("svt:lists", {}))[id], "the owner can delete it");
ok(/isShown\(l\)/.test(src("app/lists/[id]/page.js")) && /notFound\(\)/.test(src("app/lists/[id]/page.js")), "a private or hidden list is a 404");
ok(/indexable \? undefined : \{ index: false, follow: true \}/.test(src("app/lists/[id]/page.js")), "and unread ones are noindex");
ok(/filter\(isIndexable\)/.test(src("app/sitemap.js")), "only indexable lists are in the sitemap");
ok(/any lists you save/.test(src("components/Account.jsx")), "the sign-in copy says lists are stored");
ok(/saved list/i.test(src("app/privacy/page.js")), "and so does /privacy");
ok(!/lib\/(lists|qa|store)"/.test(src("components/ListsManager.jsx") + src("components/SaveToList.jsx") + src("components/QA.jsx")), "no client component imports a server library");

console.log("\ntwo uses, two places:");
{
  const src = (f) => readFileSync(join(ROOT, f), "utf8");
  const frame = src("components/SiteFrame.jsx"), yours = src("components/YourLists.jsx"), save = src("components/SaveToList.jsx");
  ok(/robots: \{ index: false, follow: false \}/.test(src("app/lists/mine/page.js")) && /<ListsManager/.test(src("app/lists/mine/page.js")),
    "your own lists are a tool at /lists/mine, never indexed");
  ok(/filter\(isIndexable\)/.test(src("app/lists/page.js")) && /robots: lists\.length \? undefined : \{ index: false/.test(src("app/lists/page.js")),
    "/lists is the section: only lists an editor read, and noindex while there are none");
  ok(/id: "lists", label: "Lists", href: "\/lists", when: \(c\) => c\.lists > 0/.test(frame) && /\.filter\(\(v\) => !v\.when \|\| v\.when\(counts\)\)/.test(frame),
    "the section is in the nav only once it has a list worth showing");
  ok(/publishedListCount/.test(src("app/layout.js")) && /revalidate: 300, tags: \[LISTS_TAG\]/.test(src("lib/listsSection.js")),
    "that count is one cached store read, not one per page");
  ok(/listsChanged\(\)/.test(src("app/api/lists/route.js")) && /listsChanged\(\)/.test(src("app/api/admin/route.js")),
    "and is refreshed by every write that can open or close the section");
  ok(/if \(!signedIn \|\| lists === null\) return null;/.test(yours) && /<SidebarLists \/>/.test(frame),
    "Your lists is in the sidebar, and signed out it is nothing at all");
  ok(/if \(compact && !signedIn\) return null;/.test(save) && /<SaveToList toolId=\{tool\.id\} toolName=\{tool\.name\} compact \/>/.test(src("components/Directory.jsx")),
    "the card's bookmark appears only to someone signed in");
  ok(/<SaveToList toolId=\{tool\.id\} toolName=\{tool\.name\} \/>/.test(src("components/ToolPage.jsx")) && !/fetch\("\/api\/lists"\)/.test(save + src("components/ListsManager.jsx")),
    "one control everywhere, reading one shared copy of your lists");
  ok(!/href="\/lists" style=\{\{ fontSize: F\.sm, color: C\.muted, whiteSpace/.test(src("components/Account.jsx")), "no second Lists link in the account bar");
  ok(/url: `\$\{SITE\}\/lists`,/.test(src("app/sitemap.js")), "the section's index is in the sitemap once it has a list");
}

console.log(bad ? `\n${bad} failed` : "\nall passed");
process.exit(bad ? 1 : 0);
