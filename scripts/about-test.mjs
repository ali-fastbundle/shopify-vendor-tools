#!/usr/bin/env node
/*
 * /about: the text is editable from /admin, and no email address or phone
 * number can be saved into it.
 *
 *   node scripts/about-test.mjs
 *
 * Shims lib/ and the admin route into a temp directory, in-memory store, no
 * server and no keys.
 */
import { readFileSync, writeFileSync, mkdtempSync, readdirSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { pathToFileURL } from "url";
import { createHmac } from "crypto";

const ROOT = new URL("..", import.meta.url).pathname;
const SECRET = "about-secret";
process.env.AUTH_SECRET = SECRET;
process.env.ADMIN_EMAILS = "admin@test.invalid";

const dir = mkdtempSync(join(tmpdir(), "svt-about-"));
mkdirSync(join(dir, "lib"));
for (const f of readdirSync(join(ROOT, "lib"))) {
  if (!f.endsWith(".js")) continue;
  writeFileSync(join(dir, "lib", f),
    readFileSync(join(ROOT, "lib", f), "utf8").replace(/(from\s+"\.\/[a-zA-Z]+)"/g, '$1.js"')
      .replace(/import\("\.\/([a-zA-Z]+)"\)/g, 'import("./$1.js")'));
}
writeFileSync(join(dir, "admin.js"),
  readFileSync(join(ROOT, "app/api/admin/route.js"), "utf8")
    .replace(/from\s+"@\/lib\/([a-zA-Z]+)"/g, 'from "./lib/$1.js"')
    .replace(/import\("@\/lib\/([a-zA-Z]+)"\)/g, 'import("./lib/$1.js")'));

const load = (f) => import(pathToFileURL(join(dir, f)).href);
const T = await load("lib/aboutText.js");
const store = await load("lib/aboutStore.js");
const admin = await load("admin.js");

let bad = 0;
const ok = (c, l, d = "") => { console.log(`  ${c ? "ok  " : "FAIL"}  ${l}${d ? `  ${d}` : ""}`); if (!c) bad += 1; };
const cookie = (email) => {
  const b = Buffer.from(JSON.stringify({ t: "session", email, exp: Date.now() + 864e5 })).toString("base64url");
  return `svt_session=${b}.${createHmac("sha256", SECRET).update(b).digest("base64url")}`;
};
const post = (email, body) => admin.POST(new Request("http://localhost/api/admin", {
  method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie(email), "x-forwarded-for": "10.0.0.3" },
  body: JSON.stringify(body),
}));
const base = { name: T.DEFAULT.name, role: T.DEFAULT.role, body: T.bodyOf(T.DEFAULT.paragraphs) };

console.log("the rule:");
ok(T.aboutIssues(base).length === 0, "the text in the file passes, figures and all", T.aboutIssues(base).join(" "));
ok(T.aboutIssues({ ...base, body: base.body + "\n\nWrite to someone@example.com." }).some((x) => /email/.test(x)), "an email address is refused");
ok(T.aboutIssues({ ...base, body: base.body + "\n\nCall +374 91 234567." }).some((x) => /phone/.test(x)), "a phone number is refused");
ok(T.aboutIssues({ ...base, role: "Reach me: first.last@example.org" }).some((x) => /email/.test(x)), "in the role line too");
ok(T.paragraphsOf("One.\nstill one.\n\nTwo.").length === 2, "paragraphs split on a blank line");

console.log("\nthe store and the route:");
ok((await store.getAbout()).paragraphs.join() === T.DEFAULT.paragraphs.join(), "with nothing saved the page shows the file's text");
ok((await post("someone@test.invalid", { action: "save-about", ...base })).status === 404, "a non-admin gets 404");
{
  const r = await post("admin@test.invalid", { action: "save-about", ...base, body: base.body + "\n\nmail me at x@example.com" });
  ok(r.status === 400, "the server refuses an address whatever the browser checked");
}
{
  const r = await post("admin@test.invalid", { action: "save-about", ...base, body: "A new first paragraph.\n\nA second one." });
  ok(r.status === 200, "an admin saves new text");
  const a = await store.getAbout();
  ok(a.paragraphs.length === 2 && a.paragraphs[0] === "A new first paragraph.", "the page reads it");
  const rec = await store.getAboutRecord();
  ok(rec.history[0].paragraphs.join() === T.DEFAULT.paragraphs.join(), "and the file's version is kept in history");
  ok((await post("admin@test.invalid", { action: "reset-about" })).status === 200, "reset");
  ok((await store.getAbout()).paragraphs.join() === T.DEFAULT.paragraphs.join(), "puts the file's text back");
  ok((await store.getAboutRecord()).history.length === 2, "keeping the replaced version");
}

console.log("\nthe page:");
const page = readFileSync(join(ROOT, "app/about/page.js"), "utf8");
ok(/getAbout\(\)/.test(page), "/about renders the stored text");
ok(!/[A-Z0-9._%+-]+@[A-Z0-9-]+\.[A-Z]{2,}/i.test(page + readFileSync(join(ROOT, "lib/aboutText.js"), "utf8")), "no address in the page or its text module");

console.log(bad ? `\n${bad} failed` : "\nall passed");
process.exit(bad ? 1 : 0);
