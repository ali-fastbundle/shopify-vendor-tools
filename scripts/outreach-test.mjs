#!/usr/bin/env node
/*
 * Outreach (temporary): the template fills from the catalogue, addresses come
 * only from the vendor's own site and never ship to a browser, copy is the
 * default, Resend is guarded, every send is logged, nobody is written to twice.
 *
 *   node scripts/outreach-test.mjs
 */
import { readFileSync, writeFileSync, mkdtempSync, readdirSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { pathToFileURL } from "url";
import { createHmac } from "crypto";

const ROOT = new URL("..", import.meta.url).pathname;
const SECRET = "outreach-secret";
process.env.AUTH_SECRET = SECRET;
process.env.ADMIN_EMAILS = "admin@test.invalid";
const dir = mkdtempSync(join(tmpdir(), "svt-outreach-"));
mkdirSync(join(dir, "lib"));
for (const f of readdirSync(join(ROOT, "lib"))) {
  if (!f.endsWith(".js")) continue;
  writeFileSync(join(dir, "lib", f), readFileSync(join(ROOT, "lib", f), "utf8").replace(/(from\s+"\.\/[a-zA-Z_-]+)"/g, '$1.js"').replace(/import\("\.\/([a-zA-Z]+)"\)/g, 'import("./$1.js")'));
}
writeFileSync(join(dir, "route.js"), readFileSync(join(ROOT, "app/api/admin/outreach/route.js"), "utf8").replace(/from\s+"@\/lib\/([a-zA-Z]+)"/g, 'from "./lib/$1.js"'));
const load = (f) => import(pathToFileURL(join(dir, f)).href);
const T = await load("lib/outreachTemplate.js");
const { TOOLS } = await load("lib/tools.js");
const { CONTACTS } = await load("lib/vendorContacts.js");
const store = await load("lib/store.js");
const route = await load("route.js");
const { voiceIssues } = await load("lib/voice.js");

let bad = 0;
const ok = (c, l, d = "") => { console.log(`  ${c ? "ok  " : "FAIL"}  ${l}${d ? `  ${d}` : ""}`); if (!c) bad += 1; };
const src = (f) => readFileSync(join(ROOT, f), "utf8");
const cookie = (email) => { const b = Buffer.from(JSON.stringify({ t: "session", email, exp: Date.now() + 864e5 })).toString("base64url"); return `svt_session=${b}.${createHmac("sha256", SECRET).update(b).digest("base64url")}`; };
let n = 1;
const post = async (body, email = "admin@test.invalid") => { const r = await route.POST(new Request("http://localhost/api/admin/outreach", { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie(email), "x-forwarded-for": `10.4.0.${n++}` }, body: JSON.stringify(body) })); return { status: r.status, text: r.ok ? "" : await r.text() }; };

console.log("the template:");
const tool = TOOLS.find((t) => t.id === "ranksy");
const v = T.valuesFor(tool, { categoryLabel: "App Store ASO" });
const body = T.fill(T.DEFAULT_BODY, v), subject = T.fill(T.DEFAULT_SUBJECT, v);
ok(body.startsWith("Hi,\n") && T.fill(T.DEFAULT_BODY, { ...v, firstName: "Goran" }).startsWith("Hi Goran,"), "the greeting is Hi, or Hi and a name, never a placeholder");
ok(T.unfilled(body).length === 0 && T.unfilled(subject).length === 0, "every placeholder fills from the catalogue");
ok(body.includes("https://watchfor.tools/tools/ranksy") && body.includes(tool.one) && body.includes(tool.price) && body.includes(tool.watch), "it carries the link, the summary, the price and the caveat in full");
ok(/stays editorial/.test(body) && /claim the listing by proving you control/.test(body), "it says how to claim, and that the caveat stays editorial");
const vi = voiceIssues(body);
ok(!vi.emDash && !vi.semicolons && !vi.marketing.length && !vi.long.length, "the filled email passes the voice checks", JSON.stringify(vi));

console.log("\naddresses:");
ok(TOOLS.every((t) => CONTACTS[t.id]), "every listed tool has a contact record");
ok(Object.values(CONTACTS).every((c) => !c.email || (/^https?:\/\//.test(c.source) && c.checked)), "every address says where and when it was found");
ok(Object.values(CONTACTS).every((c) => c.email || c.note), "and every missing one says why");
const clientFiles = readdirSync(join(ROOT, "components")).map((f) => src(`components/${f}`));
ok(!clientFiles.some((s) => /vendorContacts/.test(s)), "no component imports the addresses, so none ships in a bundle");

console.log("\nsending:");
ok((await post({ action: "contacted", toolId: "ranksy" }, "x@test.invalid")).status === 404, "a non-admin gets 404");
let r = await post({ action: "send", toolId: "becketto", subject, body });
ok(r.status === 400 && /No address/.test(r.text), "no published address, nothing to send to");
r = await post({ action: "send", toolId: "partnerstack", subject: "Hello there", body });
ok(r.status === 400 && /caution/.test(r.text), "an address marked for caution is copy only");
r = await post({ action: "send", toolId: "ranksy", subject, body: T.DEFAULT_BODY });
ok(r.status === 400 && /Fill or remove/.test(r.text), "an unfilled placeholder is refused");
r = await post({ action: "send", toolId: "ranksy", subject, body: body + "\n\nOne more thing — sorry." });
ok(r.status === 400 && /em dash/.test(r.text), "an em dash is refused");
r = await post({ action: "send", toolId: "ranksy", subject, body });
ok(r.status === 428, "the first send through watchfor.tools needs an acknowledgement");
await post({ action: "acknowledge" });
r = await post({ action: "send", toolId: "ranksy", subject, body });
ok(r.status === 200, "acknowledged, it sends");
const st = await store.read("svt:outreach", {});
ok(st.ranksy?.status === "contacted" && /Resend/.test(st.ranksy.via) && st.ranksy.to === CONTACTS.ranksy.email, "recorded as contacted, how and to whom");
r = await post({ action: "send", toolId: "ranksy", subject, body });
ok(r.status === 409, "a second send to the same vendor is refused without send again");
for (const id of ["storeleads", "rankbase", "applora", "krutva"]) await post({ action: "send", toolId: id, subject: T.fill(T.DEFAULT_SUBJECT, T.valuesFor(TOOLS.find((t) => t.id === id), {})), body: T.fill(T.DEFAULT_BODY, T.valuesFor(TOOLS.find((t) => t.id === id), {})) });
r = await post({ action: "send", toolId: "shopscan", subject: "ShopScan is listed on watchfor.tools", body: T.fill(T.DEFAULT_BODY, T.valuesFor(TOOLS.find((t) => t.id === "shopscan"), {})) });
ok(r.status === 429, "five a day through watchfor.tools, then it says to use your own mailbox");

console.log("\nthe copy path and tracking:");
await post({ action: "contacted", toolId: "storecensus", subject: "StoreCensus is listed" });
const log = ((await store.read("svt:maillog", [])) || []).map((x) => (typeof x === "string" ? JSON.parse(x) : x)).filter((x) => x.event === "outreach");
ok(log.some((x) => /own mailbox/.test(x.via || "")) && log.some((x) => x.ok && !x.via), "both paths are in the mail log", `${log.length} outreach rows`);
ok((await post({ action: "replied", toolId: "storecensus" })).status === 200 && (await store.read("svt:outreach", {})).storecensus.status === "replied", "a reply is recorded");
ok((await post({ action: "replied", toolId: "welookup" })).status === 400, "but not for a vendor never contacted");
ok(/claimedOf\(tid\) \? "claimed"/.test(src("components/Admin.jsx")) && /statusOf\(t\.id\)/.test(src("components/Admin.jsx")), "the picker shows each vendor's status, claimed read from the claims store");
ok(src("components/Admin.jsx").includes('useState("copy")'), "copy is the default path");

console.log(bad ? `\n${bad} failed` : "\nall passed");
process.exit(bad ? 1 : 0);
