#!/usr/bin/env node
/*
 * Questions and answers per tool: signed in to ask or answer, the vendor's
 * answers marked from the claims store, addresses never served, moderation in
 * the Inbox, kept apart from reviews.
 *
 *   node scripts/qa-test.mjs
 *
 * Shims lib/ and the routes into a temp directory: in-memory store, no server.
 */
import { readFileSync, writeFileSync, mkdtempSync, readdirSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { pathToFileURL } from "url";
import { createHmac } from "crypto";

const ROOT = new URL("..", import.meta.url).pathname;
const SECRET = "qa-secret";
process.env.AUTH_SECRET = SECRET;
process.env.ADMIN_EMAILS = "admin@test.invalid";
const dir = mkdtempSync(join(tmpdir(), "svt-qa-"));
mkdirSync(join(dir, "lib"));
for (const f of readdirSync(join(ROOT, "lib"))) {
  if (!f.endsWith(".js")) continue;
  writeFileSync(join(dir, "lib", f),
    readFileSync(join(ROOT, "lib", f), "utf8").replace(/(from\s+"\.\/[a-zA-Z_-]+)"/g, '$1.js"')
      .replace(/import\("\.\/([a-zA-Z]+)"\)/g, 'import("./$1.js")'));
}
const route = (from, to) => writeFileSync(join(dir, to), readFileSync(join(ROOT, from), "utf8")
  .replace(/from\s+"@\/lib\/([a-zA-Z]+)"/g, 'from "./lib/$1.js"').replace(/import\("@\/lib\/([a-zA-Z]+)"\)/g, 'import("./lib/$1.js")'));
route("app/api/qa/route.js", "qa.js");
route("app/api/admin/route.js", "admin.js");

const load = (f) => import(pathToFileURL(join(dir, f)).href);
const Q = await load("lib/qa.js");
const store = await load("lib/store.js");
const qa = await load("qa.js");
const admin = await load("admin.js");

let bad = 0;
const ok = (c, l, d = "") => { console.log(`  ${c ? "ok  " : "FAIL"}  ${l}${d ? `  ${d}` : ""}`); if (!c) bad += 1; };
const src = (f) => readFileSync(join(ROOT, f), "utf8");
const cookie = (email) => {
  const b = Buffer.from(JSON.stringify({ t: "session", email, exp: Date.now() + 864e5 })).toString("base64url");
  return `svt_session=${b}.${createHmac("sha256", SECRET).update(b).digest("base64url")}`;
};
let ip = 1;
const req = (url, { email, body, method = "POST" } = {}) => new Request(`http://localhost${url}`, {
  method, headers: { "Content-Type": "application/json", ...(email ? { Cookie: cookie(email) } : {}), "x-forwarded-for": `10.1.0.${ip++}` },
  ...(body ? { body: JSON.stringify(body) } : {}),
});
const ask = (email, body) => qa.POST(req("/api/qa", { email, body: { toolId: "ranksy", ...body } }));
const get = async (email) => (await (await qa.GET(req("/api/qa?tool=ranksy", { email, method: "GET" }))).json()).questions;

console.log("asking and answering:");
ok((await ask(null, { action: "ask", text: "Does it track Shopify Plus stores?" })).status === 401, "signed out cannot ask");
ok((await ask("a@test.invalid", { action: "ask", text: "Hi" })).status === 400, "a question needs a sentence");
ok((await qa.POST(req("/api/qa", { email: "a@test.invalid", body: { toolId: "nope", action: "ask", text: "Does it work at all?" } }))).status === 400, "an unknown tool is refused");
let r = await ask("asker@test.invalid", { action: "ask", author: "Asker", text: "Does it import keyword history from another tracker?" });
ok(r.status === 200, "a signed-in visitor asks");
let list = (await r.json()).questions;
const qid = list[0].id;
ok(list[0].mine && !("email" in list[0]) && !("reviewed" in list[0]), "the asker sees it as theirs, with no address or moderation fields");
ok(!(await get("other@test.invalid"))[0].mine, "and nobody else does");

await store.write("svt:claims", { ranksy: { status: "verified", email: "owner@ranksy.test" } });
r = await ask("owner@ranksy.test", { action: "answer", questionId: qid, author: "Ranksy team", text: "Not yet. It starts tracking from the day you connect." });
list = (await r.json()).questions;
ok(r.status === 200 && list[0].answers[0].vendor === true, "the verified claimant's answer is marked from the vendor");
r = await ask("random@test.invalid", { action: "answer", questionId: qid, author: "User", text: "I asked support, same answer.", vendor: true });
list = (await r.json()).questions;
ok(list[0].answers.find((a) => a.author === "User")?.vendor === false, "anyone else's is not, whatever the request says");
ok(list[0].answers[0].vendor, "the vendor's answer is listed first");
ok(JSON.stringify(list).indexOf("@") === -1, "no address anywhere in the public list");

console.log("\nmail:");
{
  const log = await store.read("svt:maillog", []) || [];
  const events = (Array.isArray(log) ? log : []).map((x) => (typeof x === "string" ? JSON.parse(x) : x)).map((x) => `${x.event}:${x.cls || x.side || ""}`);
  ok(events.some((e) => e.startsWith("question")), "a question is mailed to the admin", events.join(" "));
  ok(events.some((e) => e.startsWith("answer")), "an answer is mailed to the asker");
}

console.log("\nmoderation:");
const act = (action, extra = {}) => admin.POST(req("/api/admin", { email: "admin@test.invalid", body: { action, id: qid, toolId: "ranksy", ...extra } }));
ok((await admin.POST(req("/api/admin", { email: "someone@test.invalid", body: { action: "qa-fine", id: qid, toolId: "ranksy" } }))).status === 404, "a non-admin gets 404");
let a = await (await act("qa-fine")).json();
ok(a.questions[0].reviewed === true && a.questions[0].email === "asker@test.invalid", "Looks fine marks it read, and the admin sees the address");
ok((await act("qa-hide", { reason: "" })).status === 400, "hiding needs a reason");
const vendorAnswer = a.questions[0].answers.find((x) => x.vendor).id;
await act("qa-hide", { answerId: vendorAnswer, reason: "Off topic" });
ok(!(await get("x@test.invalid"))[0].answers.some((x) => x.vendor), "a hidden answer is not served");
await act("qa-unhide", { answerId: vendorAnswer });
ok((await get("x@test.invalid"))[0].answers.some((x) => x.vendor), "and unhiding puts it back");
await act("qa-hide", { reason: "Spam" });
ok((await get("x@test.invalid")).length === 0, "a hidden question is not served");
ok((await store.read("svt:qa", {})).ranksy.length === 1, "and is kept");
await act("qa-delete");
ok(((await store.read("svt:qa", {})).ranksy || []).length === 0, "delete removes it");

console.log("\nwhere it shows:");
ok(/<QA toolId=\{tool\.id\}/.test(src("components/ToolPage.jsx")) && /<QA toolId=\{tool\.id\}/.test(src("components/Directory.jsx")), "on the tool page and in the modal");
{
  const page = src("components/ToolPage.jsx");
  ok(page.indexOf("What people say") < page.indexOf("<QA "), "below the reviews");
}
ok(!/Stars|rating/.test(src("components/QA.jsx").replace(/do not change the rating/, "")), "no stars and no rating in it, so it reads apart from reviews");
ok(/Questions to read/.test(src("components/Admin.jsx")), "new questions are in the admin Inbox");
ok(/question/.test(src("app/privacy/page.js")), "/privacy says what a question stores");

console.log(bad ? `\n${bad} failed` : "\nall passed");
process.exit(bad ? 1 : 0);
