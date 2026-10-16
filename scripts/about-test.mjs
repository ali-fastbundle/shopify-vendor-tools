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

console.log("\nformatting and links:");
{
  const t = T.inlineTokens("Plain **bold** *it* [site](https://example.com) [here](/contact) [bad](mailto:x@example.com) [js](javascript:alert(1))");
  ok(t.some((x) => x.t === "b" && x.v === "bold") && t.some((x) => x.t === "i"), "bold and italic become tokens");
  ok(t.filter((x) => x.t === "a").map((x) => x.href).join() === "https://example.com,/contact", "https and site paths link; mailto and javascript stay text");
  for (const src of ["**[Fast Bundle](https://example.com)**", "[**Fast Bundle**](https://example.com)"]) {
    const [tok] = T.inlineTokens(src);
    const bold = tok.t === "b" ? tok : tok.children?.[0];
    const link = tok.t === "a" ? tok : tok.children?.[0];
    ok(bold?.t === "b" && link?.t === "a" && link.href === "https://example.com", `bold and linked: ${src}`);
  }
  ok(!JSON.stringify(T.inlineTokens("[a [b](https://x.com) c](https://y.com)")).includes('"t":"a","v":"b"'), "no link inside a link");
  ok(T.aboutIssues({ ...base, body: base.body + "\n\n[mail](mailto:someone)" }).some((x) => /email address or a phone/.test(x)), "a mailto link in the text is refused");
  ok(T.aboutIssues({ ...base, links: [{ label: "Call", url: "tel:+37491234567" }] }).length > 0, "a tel link in the links is refused");
  ok(T.aboutIssues({ ...base, links: [{ label: "", url: "https://example.com" }] }).some((x) => /no label/.test(x)), "a link needs a label");
  ok(T.aboutIssues({ ...base, links: [{ label: "Site", url: "https://example.com/a" }] }).length === 0, "a labelled https link is fine");
  const r = await post("admin@test.invalid", { action: "save-about", ...base, links: [{ label: "Site", url: "https://example.com/a" }] });
  ok(r.status === 200 && (await store.getAbout()).links[0].label === "Site", "links are saved and read back");
  await post("admin@test.invalid", { action: "reset-about" });
}

console.log("\nthe photo:");
{
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 1)]);
  ok((await store.aboutPhotoUrl()) === (process.env.ABOUT_PHOTO || ""), "with no upload the page uses the file in public/");
  const notImage = await post("admin@test.invalid", { action: "save-about-photo", dataUrl: `data:image/jpeg;base64,${Buffer.from("hello").toString("base64")}` });
  ok(notImage.status === 400, "bytes that are not the type they claim are refused");
  ok((await post("admin@test.invalid", { action: "save-about-photo", dataUrl: "data:image/svg+xml;base64,PHN2Zz4=" })).status === 400, "SVG is refused");
  ok((await post("admin@test.invalid", { action: "save-about-photo", dataUrl: `data:image/jpeg;base64,${Buffer.alloc(T.PHOTO_MAX_BYTES + 10, 0xff).toString("base64")}` })).status === 400, "an oversized image is refused");
  ok((await post("someone@test.invalid", { action: "save-about-photo", dataUrl: `data:image/jpeg;base64,${jpeg.toString("base64")}` })).status === 404, "a non-admin gets 404");
  const r = await post("admin@test.invalid", { action: "save-about-photo", dataUrl: `data:image/jpeg;base64,${jpeg.toString("base64")}` });
  const { photo } = await r.json();
  ok(r.status === 200 && /^\/about\/photo\?v=[0-9a-f]{12}$/.test(photo), "an admin uploads one, served at a versioned URL", photo);
  ok((await store.aboutPhotoUrl()) === photo, "and the page uses it");
  await post("admin@test.invalid", { action: "clear-about-photo" });
  ok((await store.aboutPhotoUrl()) === (process.env.ABOUT_PHOTO || ""), "removing it goes back to the file");
}

console.log("\nthe page:");
const page = readFileSync(join(ROOT, "app/about/page.js"), "utf8");
ok(/getAbout\(\)/.test(page), "/about renders the stored text");
ok(!/[A-Z0-9._%+-]+@[A-Z0-9-]+\.[A-Z]{2,}/i.test(page + readFileSync(join(ROOT, "lib/aboutText.js"), "utf8")), "no address in the page or its text module");

console.log(bad ? `\n${bad} failed` : "\nall passed");
process.exit(bad ? 1 : 0);
