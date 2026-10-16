#!/usr/bin/env node
/*
 * Vendor media: only the verified claimant submits, every screenshot needs
 * alt text, nothing shows until approved, approval commits the images to the
 * repository, the video is a link, and no listing field moves.
 *
 *   node scripts/media-test.mjs
 *
 * Shims lib/ and the routes into a temp directory: in-memory store, no
 * server, no GitHub (the commit is injected where it is called directly).
 */
import { readFileSync, writeFileSync, mkdtempSync, readdirSync, mkdirSync, symlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { pathToFileURL } from "url";
import { createHmac } from "crypto";

const ROOT = new URL("..", import.meta.url).pathname;
const SECRET = "media-secret";
process.env.AUTH_SECRET = SECRET;
process.env.ADMIN_EMAILS = "admin@test.invalid";
delete process.env.GITHUB_TOKEN;
const dir = mkdtempSync(join(tmpdir(), "svt-media-"));
mkdirSync(join(dir, "lib"));
symlinkSync(join(ROOT, "node_modules"), join(dir, "node_modules"));
for (const f of readdirSync(join(ROOT, "lib"))) {
  if (!f.endsWith(".js")) continue;
  writeFileSync(join(dir, "lib", f),
    readFileSync(join(ROOT, "lib", f), "utf8").replace(/(from\s+"\.\/[a-zA-Z_-]+)"/g, '$1.js"')
      .replace(/import\("\.\/([a-zA-Z]+)"\)/g, 'import("./$1.js")'));
}
const route = (from, to) => writeFileSync(join(dir, to), readFileSync(join(ROOT, from), "utf8")
  .replace(/from\s+"@\/lib\/([a-zA-Z]+)"/g, 'from "./lib/$1.js"').replace(/import\("@\/lib\/([a-zA-Z]+)"\)/g, 'import("./lib/$1.js")'));
route("app/api/media/route.js", "media.js");
route("app/api/admin/route.js", "admin.js");

const load = (f) => import(pathToFileURL(join(dir, f)).href);
const M = await load("lib/media.js");
const store = await load("lib/store.js");
const listings = await load("lib/listings.js");
const media = await load("media.js");
const admin = await load("admin.js");

let bad = 0;
const ok = (c, l, d = "") => { console.log(`  ${c ? "ok  " : "FAIL"}  ${l}${d ? `  ${d}` : ""}`); if (!c) bad += 1; };
const src = (f) => readFileSync(join(ROOT, f), "utf8");
const cookie = (email) => {
  const b = Buffer.from(JSON.stringify({ t: "session", email, exp: Date.now() + 864e5 })).toString("base64url");
  return `svt_session=${b}.${createHmac("sha256", SECRET).update(b).digest("base64url")}`;
};
let n = 1;
const req = (url, email, body) => new Request(`http://localhost${url}`, {
  method: "POST", headers: { "Content-Type": "application/json", ...(email ? { Cookie: cookie(email) } : {}), "x-forwarded-for": `10.3.0.${n++}` },
  body: JSON.stringify(body),
});
const jpeg = (fill) => `data:image/jpeg;base64,${Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(300, fill)]).toString("base64")}`;
const shot = (fill, alt = "The keyword ranking dashboard") => ({ data: jpeg(fill), width: 1600, height: 900, alt });

await store.write("svt:claims", { ranksy: { status: "verified", email: "owner@ranksy.test" } });
const before = (await listings.mergedTools()).find((t) => t.id === "ranksy");

console.log("who can submit:");
ok((await media.POST(req("/api/media", null, { toolId: "ranksy", video: "https://youtube.com/watch?v=x" }))).status === 401, "signed out cannot");
ok((await media.POST(req("/api/media", "someone@test.invalid", { toolId: "ranksy", video: "https://youtube.com/watch?v=x" }))).status === 403, "only the verified claimant (or an admin) can");

console.log("\nwhat a submission must be:");
const sub = (body) => media.POST(req("/api/media", "owner@ranksy.test", { toolId: "ranksy", ...body }));
ok((await sub({ screenshots: [shot(1, "")] })).status === 400, "a screenshot without alt text is refused");
ok((await sub({ screenshots: [1, 2, 3, 4, 5].map((i) => shot(i)) })).status === 400, "a fifth screenshot is refused");
ok((await sub({ screenshots: [{ data: `data:image/jpeg;base64,${Buffer.from("not an image").toString("base64")}`, width: 10, height: 10, alt: "Something here" }] })).status === 400, "bytes that are not an image are refused");
ok((await sub({ video: "https://evil.example/video" })).status === 400, "a video on an unknown host is refused");
ok((await sub({ video: "http://youtube.com/watch?v=x" })).status === 400, "and so is plain http");
ok((await sub({ screenshots: [{ path: "/media/ranksy/elsewhere.jpg", alt: "Something here" }] })).status === 400, "a kept screenshot must already be on the listing");
let r = await sub({ screenshots: [shot(1), shot(2, "The attribution report for one keyword")], video: "https://www.loom.com/share/abc" });
ok(r.status === 200, "two screenshots and a Loom link are accepted");
ok(!(await listings.mergedTools()).find((t) => t.id === "ranksy").vendorMedia, "and nothing shows yet");

console.log("\napproval:");
const act = (action, extra = {}) => admin.POST(req("/api/admin", "admin@test.invalid", { action, id: "ranksy", toolId: "ranksy", ...extra }));
ok((await admin.POST(req("/api/admin", "x@test.invalid", { action: "media-approve", toolId: "ranksy" }))).status === 404, "a non-admin gets 404");
r = await act("media-approve");
ok(r.status === 400 && /GITHUB_TOKEN/.test(await r.text()), "with no token the new images cannot be committed, and it says why");
const commits = [];
const fakeCommit = async ({ files, message }) => { commits.push({ files, message }); return { sha: "abc1234def" }; };
r = await M.approveMedia("ranksy", { by: "admin@test.invalid", commit: fakeCommit });
ok(!r.error && commits.length === 1 && commits[0].files.length === 2, "approving makes one commit with both images", r.error || "");
ok(commits[0].files.every((f) => /^public\/media\/ranksy\/[0-9a-f]{16}\.jpg$/.test(f.path)), "named by a hash of the bytes, under public/media/<tool>/");
let after = (await listings.mergedTools()).find((t) => t.id === "ranksy");
ok(after.vendorMedia?.screenshots.length === 2 && after.vendorMedia.screenshots.every((s) => s.path.startsWith("/media/ranksy/") && s.alt && s.width), "the listing shows them, with alt text and sizes");
ok(after.vendorMedia.video.url === "https://www.loom.com/share/abc", "and the video link");
ok(!JSON.stringify(after.vendorMedia).includes("@"), "with no submitter or approver address");
ok(after.watch === before.watch && after.price === before.price && after.note === before.note && after.cat === before.cat, "no listing field moved");

console.log("\nkeeping, rejecting, removing:");
const live = after.vendorMedia.screenshots;
r = await sub({ screenshots: [{ path: live[1].path, alt: live[1].alt }], video: "" });
ok(r.status === 200, "a later set can keep an existing screenshot");
r = await act("media-approve");
ok(r.status === 200, "a set with no new image approves without a commit");
after = (await listings.mergedTools()).find((t) => t.id === "ranksy");
ok(after.vendorMedia.screenshots.length === 1 && !after.vendorMedia.video, "and replaces what was live");
await sub({ video: "https://vimeo.com/123" });
ok((await act("media-reject", { reason: "" })).status === 400, "rejecting needs a reason");
ok((await act("media-reject", { reason: "Not a demo of the product" })).status === 200, "rejecting removes the submission");
ok(!(await store.read("svt:media:pending", {})).ranksy, "and nothing waits any more");
ok((await act("media-remove")).status === 200 && !(await listings.mergedTools()).find((t) => t.id === "ranksy").vendorMedia, "remove takes media off the listing");

console.log("\nwhere it shows:");
const vm = src("components/VendorMedia.jsx");
ok(/From the vendor/.test(vm) && /Supplied by \{tool\.name\}/.test(vm), "labelled as the vendor's");
ok(!/<iframe|<video|<script/.test(vm), "the video is a link, no embed and no player script");
ok(/listings\.PROTECTED|"vendorMedia"/.test(src("lib/listings.js")) && listings.PROTECTED.includes("vendorMedia") && !listings.EDITABLE.includes("vendorMedia"), "media cannot be written through a listing edit");
ok(/<VendorMedia tool=\{tool\} \/>/.test(src("components/ToolPage.jsx")) && /<VendorMedia tool=\{tool\} \/>/.test(src("components/Directory.jsx")), "on the tool page and in the modal");
ok(/Media to approve/.test(src("components/Admin.jsx")), "submissions are in the admin Inbox");

console.log(bad ? `\n${bad} failed` : "\nall passed");
process.exit(bad ? 1 : 0);
