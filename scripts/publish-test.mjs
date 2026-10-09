#!/usr/bin/env node
/*
 * Publishing a drafted file entry from /admin: the edit, and the commit.
 *
 *   node scripts/publish-test.mjs
 *
 * No server, no keys, no network. The edit is run against every real draft in
 * every catalogue file and must change exactly two things. GitHub is a stub
 * that serves the real file and records what would have been committed.
 */
import { register } from "node:module";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHmac } from "node:crypto";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const k of Object.keys(process.env)) if (/^(UPSTASH|KV)_|^GITHUB_/.test(k)) delete process.env[k];
process.env.AUTH_SECRET = "publish-test-secret";
process.env.ADMIN_EMAILS = "admin@example.com";

const hook = `
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
const ROOT = ${JSON.stringify(pathToFileURL(root + "/").href)};
export async function resolve(spec, ctx, next) {
  let target = null;
  if (spec.startsWith("@/")) target = new URL(spec.slice(2), ROOT).href;
  else if ((spec.startsWith("./") || spec.startsWith("../")) && ctx.parentURL) target = new URL(spec, ctx.parentURL).href;
  if (target && !/\\.[mc]?jsx?$/.test(target)) {
    for (const ext of [".js", ".jsx"]) if (existsSync(fileURLToPath(target + ext))) return next(target + ext, ctx);
  }
  return next(spec, ctx);
}`;
register("data:text/javascript," + encodeURIComponent(hook));

/* GitHub, stubbed: serves the real file, records the PUT. */
const puts = [];
let putStatus = 200;
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (!u.startsWith("https://api.github.com/repos/")) throw new Error(`unexpected network call: ${u}`);
  const path = decodeURIComponent(u.split("/contents/")[1].split("?")[0]);
  if (!init.method || init.method === "GET") {
    return Response.json({ sha: "abc123", content: Buffer.from(readFileSync(join(root, path), "utf8")).toString("base64") });
  }
  const body = JSON.parse(init.body);
  puts.push({ path, ...body, source: Buffer.from(body.content, "base64").toString("utf8") });
  if (putStatus !== 200) return Response.json({ message: "conflict" }, { status: putStatus });
  return Response.json({ commit: { sha: "def4567890", html_url: "https://github.com/x/y/commit/def456" } });
};

const L = (p) => import(pathToFileURL(join(root, p)).href);
const { publishInSource, commitPublish, FILES, readPublishLog } = await L("lib/publish.js");
const { readiness, drafted } = await L("lib/drafts.js");
const catalogues = {
  tool: (await L("lib/tools.js")).ALL_TOOLS, newsletter: (await L("lib/newsletters.js")).ALL_NEWSLETTERS,
  event: (await L("lib/events.js")).ALL_EVENTS, group: (await L("lib/communities.js")).ALL_COMMUNITIES,
  podcast: (await L("lib/podcasts.js")).ALL_PODCASTS,
};

let failed = 0;
const ok = (cond, what, extra = "") => { console.log(`  ${cond ? "ok  " : "FAIL"}  ${what}${extra ? `  ${extra}` : ""}`); if (!cond) failed++; };
const TODAY = "2031-02-03";
const changed = (a, b) => {
  const x = a.split("\n"), y = b.split("\n");
  // Lines in a not in b, and in b not in a, by position-insensitive multiset.
  const count = (arr) => arr.reduce((m, l) => m.set(l, (m.get(l) || 0) + 1), new Map());
  const cx = count(x), cy = count(y);
  const gone = [...cx].flatMap(([l, n]) => Array(Math.max(0, n - (cy.get(l) || 0))).fill(l));
  const added = [...cy].flatMap(([l, n]) => Array(Math.max(0, n - (cx.get(l) || 0))).fill(l));
  return { gone, added };
};

console.log("\nthe edit, on every real draft:");
let total = 0;
for (const [kind, list] of Object.entries(catalogues)) {
  const src = readFileSync(join(root, FILES[kind]), "utf8");
  for (const entry of drafted(list)) {
    total++;
    const r = publishInSource(src, entry.id, TODAY);
    if (r.error) { ok(false, `${kind} ${entry.id}`, r.error); continue; }
    const { gone, added } = changed(src, r.source);
    const draftGone = gone.length >= 1 && gone.some((l) => /^\s*draft: true,?\s*$/.test(l));
    const onlyDate = added.every((l) => l.includes(`updated: "${TODAY}"`)) && gone.every((l) => /draft: true|updated: "/.test(l));
    ok(draftGone && onlyDate && added.length === 1, `${kind} ${entry.id}: draft removed, updated set, nothing else`,
      draftGone && onlyDate ? "" : JSON.stringify({ gone, added }));
  }
}
ok(total > 0, `${total} drafts checked`);

console.log("\nedge cases:");
const tools = readFileSync(join(root, "lib/tools.js"), "utf8");
ok(/already be published/.test(publishInSource(tools, "kollectify", TODAY).error || ""), "an entry with no draft flag is refused");
ok(/No entry/.test(publishInSource(tools, "no-such-id", TODAY).error || ""), "an unknown id is refused");
const fixture = `export const X = [\n  {\n    id: "a",\n    // draft: true in a comment stays\n    name: "A", draft: true, url: "https://a.example",\n    note: "has a { brace } and \\"draft: true\\" in text",\n  },\n  {\n    id: "b",\n    draft: true,\n  },\n];\n`;
const fa = publishInSource(fixture, "a", TODAY);
ok(!fa.error && fa.source.includes("// draft: true in a comment stays") && fa.source.includes('\\"draft: true\\" in text'), "a comment or a string that says draft: true is left alone");
ok(!fa.error && /name: "A", url:/.test(fa.source), "a flag sharing a line with other properties is cut out cleanly");
ok(!fa.error && fa.source.includes(`    updated: "${TODAY}",\n  },`), "an entry with no updated gets one, at the entry's own indent");
ok(/does not parse/.test(publishInSource("export const = [", "a", TODAY).error || ""), "a file that does not parse is refused before any edit");

console.log("\nthe commit:");
const mp = catalogues.newsletter.find((n) => n.id === "marketplacepulse");
let r = await commitPublish({ kind: "newsletter", id: "marketplacepulse", entry: mp, today: TODAY });
ok(/GITHUB_TOKEN/.test(r.error || "") && puts.length === 0, "no token: refused, nothing sent");
process.env.GITHUB_TOKEN = "github_pat_test";
r = await commitPublish({ kind: "newsletter", id: "marketplacepulse", entry: { ...mp, watch: "" }, today: TODAY });
ok(/Not ready/.test(r.error || "") && puts.length === 0, "an entry that fails readiness is refused before GitHub is asked");
ok(readiness({ one: "x", note: "y", watch: "none", url: "https://a.b" }).some((p) => /nothing to watch/.test(p)), "readiness refuses a watch of \"none\"");
r = await commitPublish({ kind: "newsletter", id: "marketplacepulse", entry: mp, today: TODAY });
const put = puts[0] || {};
ok(r.sha === "def4567890" && put.path === "lib/newsletters.js" && put.sha === "abc123" && put.branch === "main", "commits to the right file on main, against the sha it read");
ok(put.source && !/id: "marketplacepulse"[\s\S]{0,4000}?draft: true[\s\S]*?\n  \},\n\];/.test(put.source) && put.source.includes(`updated: "${TODAY}"`), "the committed file has the flag gone and today's date");
ok(/^Publish Marketplace Pulse \(newsletter\)/.test(put.message || "") && !/@/.test(put.message || ""), "the commit message names the entry and carries no email address");
putStatus = 409;
r = await commitPublish({ kind: "newsletter", id: "marketplacepulse", entry: mp, today: TODAY });
ok(/changed on GitHub/.test(r.error || ""), "a file that moved between read and write is reported, not overwritten");
putStatus = 200;

console.log("\nthe admin route:");
const route = await L("app/api/admin/route.js");
const sess = (email) => { const b = Buffer.from(JSON.stringify({ t: "session", email, exp: Date.now() + 3600e3 })).toString("base64url"); return `svt_session=${b}.${createHmac("sha256", process.env.AUTH_SECRET).update(b).digest("base64url")}`; };
const call = (body, cookie) => route.POST(new Request("http://localhost:3000/api/admin", {
  method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": "10.2.0.1", ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body),
}));
ok((await call({ action: "publish-file-draft", kind: "newsletter", id: "marketplacepulse" })).status === 404, "signed out: 404, as every admin route");
ok((await call({ action: "publish-file-draft", kind: "newsletter", id: "marketplacepulse" }, sess("someone@example.com"))).status === 404, "signed in but not an admin: 404");
ok((await call({ action: "publish-file-draft", kind: "newsletter", id: "cpgd" }, sess("admin@example.com"))).status === 400, "a published entry cannot be published again");
const res = await call({ action: "publish-file-draft", kind: "newsletter", id: "marketplacepulse" }, sess("admin@example.com"));
ok(res.status === 200 && (await res.json()).sha === "def4567890", "an admin publish returns the commit");
const log = await readPublishLog(5);
ok(log[0]?.id === "marketplacepulse" && log[0]?.by === "admin@example.com" && log[0]?.sha, "and it is logged with who and which commit");

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
