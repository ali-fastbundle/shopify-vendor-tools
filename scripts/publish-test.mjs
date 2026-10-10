#!/usr/bin/env node
/*
 * Publishing a drafted file entry from /admin: the edit, and the commit.
 *
 *   node scripts/publish-test.mjs
 *
 * No server, no keys, no network. The edit is run against every real draft in
 * every catalogue file and must change exactly two things. Discard is run against
 * every draft too and must remove that one entry and nothing else. GitHub is a stub
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
let putBody = null; // set to override what a successful-looking PUT returns
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (!u.startsWith("https://api.github.com/repos/")) throw new Error(`unexpected network call: ${u}`);
  const path = decodeURIComponent(u.split("/contents/")[1].split("?")[0]);
  if (!init.method || init.method === "GET") {
    return Response.json({ sha: "abc123", content: Buffer.from(readFileSync(join(root, path), "utf8")).toString("base64") });
  }
  const body = JSON.parse(init.body);
  puts.push({ path, ...body, source: Buffer.from(body.content, "base64").toString("utf8") });
  if (putStatus !== 200) return Response.json({ message: putStatus === 409 ? "conflict" : "Resource not accessible by personal access token" }, { status: putStatus });
  if (putBody) return Response.json(putBody);
  return Response.json({ commit: { sha: "def4567890", html_url: "https://github.com/x/y/commit/def456" } });
};

const L = (p) => import(pathToFileURL(join(root, p)).href);
const { publishInSource, discardInSource, commitPublish, commitDiscard, FILES, readPublishLog } = await L("lib/publish.js");
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

console.log("\ndiscard, on every real draft:");
const { parse } = await import("acorn");
const idsIn = (src) => [...src.matchAll(/^\s*id: "([^"]+)"/gm)].map((m) => m[1]);
let dtotal = 0;
for (const [kind, list] of Object.entries(catalogues)) {
  const src = readFileSync(join(root, FILES[kind]), "utf8");
  for (const entry of drafted(list)) {
    dtotal++;
    const r = discardInSource(src, entry.id);
    if (r.error) { ok(false, `discard ${kind} ${entry.id}`, r.error); continue; }
    const before = idsIn(src), after = idsIn(r.source);
    const sameOthers = JSON.stringify(before.filter((x) => x !== entry.id)) === JSON.stringify(after);
    let parses = true; try { parse(r.source, { ecmaVersion: "latest", sourceType: "module" }); } catch { parses = false; }
    const { added } = changed(src, r.source);
    ok(parses && sameOthers && !after.includes(entry.id) && added.length === 0 && !/\n\s*\n\s*\n/.test(r.source.replace(src.match(/\n\s*\n\s*\n/g)?.join("") || "\u0000", "")),
      `${kind} ${entry.id}: that entry gone, every other id intact, nothing added`);
  }
}
ok(dtotal > 0, `${dtotal} discards checked`);
ok(/not a draft/.test(discardInSource(readFileSync(join(root, "lib/tools.js"), "utf8"), "kollectify").error || ""), "a published entry cannot be discarded");

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
/* Whichever draft exists today. This named one entry once, and publishing that
   entry broke the test, which is the button working rather than failing. */
const [K, mp] = Object.entries(catalogues).flatMap(([kind, list]) => drafted(list).map((e) => [kind, e]))
  .find(([kind, e]) => readiness(e, kind).length === 0) || [];
if (!mp) { console.log("  skip  no publishable draft in any catalogue to commit"); }
let r = await commitPublish({ kind: K, id: mp.id, entry: mp, today: TODAY });
ok(/GITHUB_TOKEN/.test(r.error || "") && puts.length === 0, "no token: refused, nothing sent");
process.env.GITHUB_TOKEN = "github_pat_test";
r = await commitPublish({ kind: K, id: mp.id, entry: { ...mp, watch: "" }, today: TODAY });
ok(/Not ready/.test(r.error || "") && puts.length === 0, "an entry that fails readiness is refused before GitHub is asked");
ok(readiness({ one: "x", note: "y", watch: "none", url: "https://a.b" }).some((p) => /nothing to watch/.test(p)), "readiness refuses a watch of \"none\"");
r = await commitPublish({ kind: K, id: mp.id, entry: mp, today: TODAY });
const put = puts[0] || {};
ok(r.sha === "def4567890" && put.path === FILES[K] && put.sha === "abc123" && put.branch === "main", `commits to ${FILES[K]} on main, against the sha it read`);
ok(put.source && publishInSource(put.source, mp.id, TODAY).error?.includes("no draft flag") && put.source.includes(`updated: "${TODAY}"`), "the committed file has the flag gone and today's date");
ok(put.message?.startsWith(`Publish ${mp.name} (${K})`) && !/@/.test(put.message || ""), "the commit message names the entry and carries no email address");
putStatus = 409;
r = await commitPublish({ kind: K, id: mp.id, entry: mp, today: TODAY });
ok(/changed on GitHub/.test(r.error || ""), "a file that moved between read and write is reported, not overwritten");
putStatus = 200;

console.log("\ndiscard, the commit:");
const [DK, dd] = Object.entries(catalogues).flatMap(([kind, list]) => drafted(list).map((e) => [kind, e]))[0];
r = await commitDiscard({ kind: DK, id: dd.id, entry: dd, reason: "" });
ok(/one line/.test(r.error || ""), "no reason: refused before GitHub is asked");
const putsBefore = puts.length;
r = await commitDiscard({ kind: DK, id: dd.id, entry: { ...dd, watch: "" }, reason: "Out of scope: merchant-facing" });
const dput = puts[putsBefore] || {};
ok(r.sha && dput.path === FILES[DK] && !idsIn(dput.source || "").includes(dd.id), "an unready draft can still be discarded, and the commit removes it");
ok(dput.message?.startsWith(`Discard ${dd.name} (${DK}): Out of scope: merchant-facing`) && !/@/.test(dput.message || ""), "the commit message carries the reason and no address");

console.log("\nthe admin route:");
const route = await L("app/api/admin/route.js");
const sess = (email) => { const b = Buffer.from(JSON.stringify({ t: "session", email, exp: Date.now() + 3600e3 })).toString("base64url"); return `svt_session=${b}.${createHmac("sha256", process.env.AUTH_SECRET).update(b).digest("base64url")}`; };
/* Every draft action carries the build the page was rendered by and the name
   it showed, as the panel sends them. Locally the build is "dev". */
const nameOf = (kind, id) => (catalogues[kind] || []).find((e) => e.id === id)?.name;
const call = (raw, cookie) => { const body = /-draft$/.test(raw.action || "") && !("build" in raw) ? { build: "dev", name: nameOf(raw.kind, raw.id), ...raw } : raw; return route.POST(new Request("http://localhost:3000/api/admin", {
  method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": "10.2.0.1", ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body),
})); };
ok((await call({ action: "publish-file-draft", kind: K, id: mp.id })).status === 404, "signed out: 404, as every admin route");
ok((await call({ action: "publish-file-draft", kind: K, id: mp.id }, sess("someone@example.com"))).status === 404, "signed in but not an admin: 404");
const pub = await call({ action: "publish-file-draft", kind: "newsletter", id: "marketplacepulse" }, sess("admin@example.com"));
const pubMsg = await pub.text();
ok(pub.status === 409 && /is not a draft in build dev: it is published/.test(pubMsg), "a published entry cannot be published again, and the answer says it is published", pubMsg);

console.log("\nan action from a page older than the deploy:");
const putsAtStale = puts.length;
const stale = await call({ action: "discard-file-draft", kind: K, id: mp.id, build: "0123456789abcdef", name: mp.name, reason: "x" }, sess("admin@example.com"));
const staleMsg = await stale.text();
ok(stale.status === 409 && /rendered by build 0123456 and the server is now dev/.test(staleMsg), "is refused with both builds named", staleMsg);
const noBuild = await call({ action: "hold-draft", kind: K, id: mp.id, build: undefined, name: mp.name, note: "x" }, sess("admin@example.com"));
ok(noBuild.status === 409, "a page that sends no build at all is refused the same way");
const renamed = await call({ action: "publish-file-draft", kind: K, id: mp.id, build: "dev", name: "Something Else" }, sess("admin@example.com"));
ok(renamed.status === 409 && /named this "Something Else"/.test(await renamed.text()), "a name that does not match the id in this build is refused");
const typo = await call({ action: "discard-file-draft", kind: K, id: mp.id.replace(/-/g, "_") + "_", build: "dev", name: mp.name, reason: "x" }, sess("admin@example.com"));
ok(typo.status === 400 && /No .* with id/.test(await typo.text()), "an id that is not in the file is refused by name, never matched loosely");
ok(puts.length === putsAtStale, "none of those reached GitHub");
const res = await call({ action: "publish-file-draft", kind: K, id: mp.id }, sess("admin@example.com"));
ok(res.status === 200 && (await res.json()).sha === "def4567890", "an admin publish returns the commit");
const log = await readPublishLog(5);
ok(log[0]?.id === mp.id && log[0]?.by === "admin@example.com" && log[0]?.sha, "and it is logged with who and which commit");

ok((await call({ action: "discard-file-draft", kind: DK, id: dd.id, reason: "x" })).status === 404, "discard signed out: 404");
const dres = await call({ action: "discard-file-draft", kind: DK, id: dd.id, reason: "  Out of scope:\n merchant-facing  " }, sess("admin@example.com"));
ok(dres.status === 200, "an admin discard commits");
const { getDiscards, liveDiscards, fileKeys, getHolds } = await L("lib/draftOutcomes.js");
const disc = await getDiscards();
ok(disc[0]?.id === dd.id && disc[0]?.reason === "Out of scope: merchant-facing" && disc[0]?.entry?.watch === dd.watch && disc[0]?.sha,
  "the reason, collapsed to one line, and the entry as it stood are kept in svt:discarded");
ok(liveDiscards(disc, fileKeys()).length === 0, "while the entry is still in the deployed file, the discard does not stand yet");
ok(liveDiscards(disc, new Set()).length === 1, "once it is gone from the file, it stands");
ok((await readPublishLog(5))[0]?.outcome === "discarded", "the discard is in the publish log");

console.log("\na write that cannot complete says so:");
{
  const lines = [];
  const orig = console.log;
  console.log = (...a) => { lines.push(a.join(" ")); };
  const pick = Object.entries(catalogues).flatMap(([kind, list]) => drafted(list).map((e) => [kind, e])).find(([k]) => k === "event") || [DK, dd];
  const [FK, fe] = pick;
  putBody = { content: {} }; // 2xx, no commit
  const a = await call({ action: "discard-file-draft", kind: FK, id: fe.id, reason: "test" }, sess("admin@example.com"));
  const aMsg = await a.text();
  putBody = null; putStatus = 403;
  const b = await call({ action: "publish-file-draft", kind: K, id: mp.id }, sess("admin@example.com"));
  const bMsg = await b.text();
  putStatus = 200;
  console.log = orig;
  ok(a.status === 502 && /returned no commit/.test(aMsg), "GitHub answering 2xx with no commit is a failure, not a success", `${a.status} ${aMsg}`);
  ok(b.status === 502 && /GitHub answered 403: Resource not accessible/.test(bMsg), "GitHub refusing comes back with its own status and words", `${b.status} ${bMsg}`);
  const log = await readPublishLog(10);
  ok(log.some((r) => r.outcome === "failed" && r.action === "discard-file-draft" && r.id === fe.id && /no commit/.test(r.error)), "the failed discard is in the publish log, with why");
  ok(log.some((r) => r.outcome === "failed" && r.action === "publish-file-draft" && /403/.test(r.error)), "and so is the failed publish");
  ok(lines.some((l) => l.startsWith(`[drafts] discard-file-draft ${FK}:${fe.id} -> 502`)), "each outcome is one log line naming the action, the entry and the status", lines.join(" | ").slice(0, 160));
  ok(!lines.some((l) => /@/.test(l)), "and no log line carries an address");
  const { getDiscards: gd } = await L("lib/draftOutcomes.js");
  ok(!(await gd()).some((d) => d.id === fe.id), "a failed discard records nothing as discarded");
}

console.log("\nhold:");
const putsAtHold = puts.length;
ok((await call({ action: "hold-draft", kind: DK, id: dd.id, note: "" }, sess("admin@example.com"))).status === 400, "a hold without a note is refused");
const hres = await call({ action: "hold-draft", kind: DK, id: dd.id, note: "waiting on the pricing page" }, sess("admin@example.com"));
ok(hres.status === 200 && (await getHolds())[`${DK}:${dd.id}`]?.note === "waiting on the pricing page", "a hold stores the note");
ok(puts.length === putsAtHold, "and commits nothing");
await call({ action: "unhold-draft", kind: DK, id: dd.id }, sess("admin@example.com"));
ok(!(await getHolds())[`${DK}:${dd.id}`], "moving it back clears the hold");
ok((await call({ action: "hold-draft", kind: "tool", id: "kollectify", note: "x" }, sess("admin@example.com"))).status === 409, "a published entry cannot be held");

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
