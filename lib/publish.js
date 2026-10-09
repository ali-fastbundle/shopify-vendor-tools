/*
 * Publishing a drafted file entry from /admin, by committing to the file.
 *
 * Invariant 12 says publishing is deleting `draft: true` from the entry in its
 * source file, and that published-ness must never live anywhere but the file.
 * A Vercel function cannot write its own filesystem, so the only way a web
 * page can do that edit is to make it where the file actually lives: on
 * GitHub, as a commit to main, which Vercel then builds and deploys like any
 * other push. Nothing about the rule changes. The file is still the truth,
 * the change is reviewable in git, and undoing a publish is reverting one
 * commit.
 *
 * The edit is two things and nothing else, located by parsing the file rather
 * than by matching text: the entry's `draft: true` property is removed, and
 * its `updated` is set to today (added if absent), because invariant 12 says
 * a draft is dated the day it goes live, not the day it was written. The
 * result is parsed again before anything is sent, so a commit that would
 * break the build is refused here rather than discovered by Vercel.
 *
 * Needs GITHUB_TOKEN: a fine-grained token with Contents read and write on
 * this one repository and nothing else. Without it the button explains what
 * is missing and does nothing.
 */
import { parse } from "acorn";
import { readiness } from "./drafts";
import { pushCapped, readCapped } from "./store";

export const FILES = {
  tool: "lib/tools.js",
  newsletter: "lib/newsletters.js",
  event: "lib/events.js",
  group: "lib/communities.js",
  podcast: "lib/podcasts.js",
};

const REPO = () => process.env.GITHUB_REPO || "ali-fastbundle/shopify-vendor-tools";
const BRANCH = () => process.env.GITHUB_BRANCH || "main";
export const canPublish = () => Boolean(process.env.GITHUB_TOKEN);

const PARSE = { ecmaVersion: "latest", sourceType: "module", locations: false };

const keyName = (p) => (p.key && (p.key.name ?? p.key.value));

/* Every object literal in the tree, without a dependency for walking it. */
function objects(node, out = []) {
  if (!node || typeof node !== "object") return out;
  if (node.type === "ObjectExpression") out.push(node);
  for (const k of Object.keys(node)) {
    const v = node[k];
    if (Array.isArray(v)) v.forEach((c) => objects(c, out));
    else if (v && typeof v === "object" && typeof v.type === "string") objects(v, out);
  }
  return out;
}

/* The start of the line a position is on, and the end including its newline. */
const lineStart = (src, i) => src.lastIndexOf("\n", i - 1) + 1;
const lineEnd = (src, i) => { const n = src.indexOf("\n", i); return n === -1 ? src.length : n + 1; };

/**
 * The source with one entry published, or `{ error }`. Pure; tested directly
 * against every draft in the repository.
 */
export function publishInSource(source, id, today) {
  let tree;
  try { tree = parse(source, PARSE); } catch (e) { return { error: `The file does not parse as it is: ${e.message}` }; }

  const hits = objects(tree).filter((o) => o.properties.some((p) =>
    p.type === "Property" && keyName(p) === "id" && p.value.type === "Literal" && p.value.value === id));
  if (hits.length === 0) return { error: `No entry with id "${id}" in the file on ${BRANCH()}.` };
  if (hits.length > 1) return { error: `More than one entry has id "${id}". Fix that by hand first.` };
  const entry = hits[0];
  const props = entry.properties.filter((p) => p.type === "Property");

  const draft = props.find((p) => keyName(p) === "draft");
  if (!draft) return { error: "That entry has no draft flag on main. It may already be published." };
  if (!(draft.value.type === "Literal" && draft.value.value === true)) {
    return { error: "The draft flag is not a plain `true`. Change it by hand." };
  }

  const edits = [];

  // Remove `draft: true` with its comma. A line holding nothing else goes
  // whole, so no blank line is left behind.
  let end = draft.end;
  const after = source.slice(end).match(/^\s*,/);
  if (after) end += after[0].length;
  const ls = lineStart(source, draft.start);
  const le = lineEnd(source, end);
  const alone = source.slice(ls, draft.start).trim() === "" && source.slice(end, le).trim().replace(/^\/\/.*$/, "") === "";
  edits.push(alone ? [ls, le, ""] : [draft.start, end + (source.slice(end).match(/^[ \t]*/)[0].length), ""]);

  const updated = props.find((p) => keyName(p) === "updated");
  if (updated) {
    if (updated.value.type !== "Literal" || typeof updated.value.value !== "string") {
      return { error: "`updated` is not a plain date string. Change it by hand." };
    }
    edits.push([updated.value.start, updated.value.end, `"${today}"`]);
  } else {
    const closeLine = lineStart(source, entry.end - 1);
    const indent = (source.slice(lineStart(source, props[0].start), props[0].start).match(/^[ \t]*/) || [""])[0];
    edits.push([closeLine, closeLine, `${indent}updated: "${today}",\n`]);
  }

  let out = source;
  for (const [s, e, text] of edits.sort((a, b) => b[0] - a[0])) out = out.slice(0, s) + text + out.slice(e);

  // Prove it before anything leaves: still parses, the entry is still there,
  // it is no longer a draft, and it carries today's date.
  let again;
  try { again = parse(out, PARSE); } catch (e) { return { error: `The edit would not parse: ${e.message}` }; }
  const after2 = objects(again).find((o) => o.properties.some((p) => keyName(p) === "id" && p.value.value === id));
  const ps = after2 ? after2.properties.filter((p) => p.type === "Property") : [];
  if (!after2 || ps.some((p) => keyName(p) === "draft") || !ps.some((p) => keyName(p) === "updated" && p.value.value === today)) {
    return { error: "The edit did not come out as expected, so nothing was sent." };
  }
  return { source: out };
}

/* ---------------- GitHub ---------------- */

async function gh(path, init = {}) {
  const res = await fetch(`https://api.github.com/repos/${REPO()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "watchfor.tools admin",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

/**
 * Publish one drafted file entry: read the file from GitHub, edit it, commit.
 * `entry` is the deployed copy, for the readiness check; the edit is made to
 * what is on main, which is the file that will be deployed.
 *
 * Returns `{ sha, url }` or `{ error }`. Never throws.
 */
export async function commitPublish({ kind, id, entry, today = new Date().toISOString().slice(0, 10) }) {
  const path = FILES[kind];
  if (!path) return { error: "That kind of entry is not published from a file." };
  if (!canPublish()) return { error: "GITHUB_TOKEN is not set, so there is nothing to commit with." };
  const problems = readiness(entry, kind);
  if (problems.length) return { error: `Not ready: ${problems.join(" ")}` };

  try {
    const file = await gh(`/contents/${path}?ref=${encodeURIComponent(BRANCH())}`);
    if (file.status !== 200) return { error: `GitHub answered ${file.status} reading ${path}: ${file.body.message || ""}`.trim() };
    const source = Buffer.from(file.body.content || "", "base64").toString("utf8");

    const edited = publishInSource(source, id, today);
    if (edited.error) return { error: edited.error };

    const put = await gh(`/contents/${path}`, {
      method: "PUT",
      body: JSON.stringify({
        message: `Publish ${entry.name || id} (${kind})\n\nRemoved draft: true and set updated to ${today}, from /admin.`,
        content: Buffer.from(edited.source, "utf8").toString("base64"),
        sha: file.body.sha,
        branch: BRANCH(),
      }),
    });
    // 409 is GitHub saying the file moved under us: somebody pushed between
    // the read and the write. Nothing was changed; reading again is safe.
    if (put.status === 409) return { error: "The file changed on GitHub a moment ago. Press Publish again." };
    if (put.status !== 200 && put.status !== 201) {
      return { error: `GitHub answered ${put.status}: ${put.body.message || "no detail"}` };
    }
    return { sha: put.body.commit?.sha || "", url: put.body.commit?.html_url || "" };
  } catch (e) {
    return { error: `Could not reach GitHub: ${e.message}` };
  }
}

export const PUBLISH_LOG = "svt:publishlog";
export const logPublish = (row) => pushCapped(PUBLISH_LOG, [row], 200);
export const readPublishLog = (n = 50) => readCapped(PUBLISH_LOG, n);
