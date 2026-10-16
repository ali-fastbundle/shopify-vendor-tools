/*
 * Vendor-supplied media on a claimed tool: up to four screenshots, each with
 * alt text, and one demo video link.
 *
 * It is vendor content and is labelled as such wherever it shows. It is a
 * separate record from the listing and touches no listing field: not `watch`,
 * not anything in PROTECTED, not the price.
 *
 *   svt:media:pending = { [toolId]: { screenshots: [{ path } | { data, type, width, height }, + alt],
 *                                     video, submittedBy, submittedAt } }
 *   svt:media         = { [toolId]: { screenshots: [{ path, alt, width, height }],
 *                                     video: { url } | null, approvedAt, approvedBy, commit } }
 *
 * Screenshots live in the repository, under public/media/<toolId>/, never
 * hotlinked. A Vercel function cannot write its own files, so the only way an
 * upload reaches the repository is a commit, made when an editor approves the
 * submission (commitFiles in lib/publish.js). That also means nothing a vendor
 * uploads is published without a person looking at it. The file name is a
 * hash of the bytes, so the same image is never stored twice.
 *
 * The video is a link, never an embed: no third-party player script runs on
 * the page (see "Privacy and consent" in CLAUDE.md).
 */
import { createHash } from "crypto";
import { read, write } from "./store";
import { MEDIA_LIMITS } from "./limits";

export const MEDIA_KEY = "svt:media";
export const PENDING_KEY = "svt:media:pending";

const VIDEO_HOSTS = ["youtube.com", "youtu.be", "vimeo.com", "loom.com", "wistia.com", "wistia.net"];
const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
const clean = (s, max) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/** A demo link on a known video host or the tool's own domain, https only. */
export function videoAllowed(url, tool) {
  if (!/^https:\/\//i.test(String(url || ""))) return false;
  const h = hostOf(url);
  const own = String(tool?.domain || "").replace(/^www\./, "");
  return VIDEO_HOSTS.some((v) => h === v || h.endsWith(`.${v}`)) || (own && (h === own || h.endsWith(`.${own}`)));
}

const MAGIC = { "image/jpeg": [0xff, 0xd8, 0xff], "image/png": [0x89, 0x50, 0x4e, 0x47], "image/webp": [0x52, 0x49, 0x46, 0x46] };
const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/**
 * Check a submission. `current` is the live record, so a kept screenshot can
 * only be one that is already published for this tool. Returns { pending } or
 * { error }.
 */
export function sanitiseSubmission(tool, input = {}, current = null) {
  const shots = Array.isArray(input.screenshots) ? input.screenshots : [];
  if (shots.length > MEDIA_LIMITS.screenshots) return { error: `At most ${MEDIA_LIMITS.screenshots} screenshots.` };
  const live = new Set((current?.screenshots || []).map((s) => s.path));
  const out = [];
  for (const s of shots) {
    const alt = clean(s?.alt, MEDIA_LIMITS.alt);
    if (alt.length < MEDIA_LIMITS.altMin) return { error: "Every screenshot needs alt text that says what it shows." };
    if (s.path) {
      if (!live.has(s.path)) return { error: "A kept screenshot has to be one already on the listing." };
      const was = current.screenshots.find((x) => x.path === s.path);
      out.push({ path: s.path, alt, width: was.width, height: was.height });
      continue;
    }
    const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(s?.data || ""));
    if (!m) return { error: "A screenshot has to be a JPEG, PNG or WebP image." };
    const bytes = Buffer.from(m[2], "base64");
    if (bytes.length > MEDIA_LIMITS.bytes) return { error: `A screenshot is over ${Math.round(MEDIA_LIMITS.bytes / 1000)} KB after resizing.` };
    if (!MAGIC[m[1]].every((b, i) => bytes[i] === b)) return { error: "A file's contents do not match its type." };
    const width = Math.round(Number(s.width) || 0), height = Math.round(Number(s.height) || 0);
    if (!width || !height) return { error: "A screenshot is missing its size." };
    out.push({ data: m[2], type: m[1], alt, width, height });
  }
  const video = clean(input.video, 300);
  if (video && !videoAllowed(video, tool)) {
    return { error: "The video has to be an https link on YouTube, Vimeo, Loom, Wistia or your own domain." };
  }
  if (!out.length && !video) return { error: "Add a screenshot or a video link." };
  return { pending: { screenshots: out, video: video || "" } };
}

export const readMedia = () => read(MEDIA_KEY, {});
export const readPending = () => read(PENDING_KEY, {});

export async function submitMedia(tool, input, email) {
  const [live, pending] = await Promise.all([readMedia(), readPending()]);
  const r = sanitiseSubmission(tool, input, live[tool.id]);
  if (r.error) return r;
  pending[tool.id] = { ...r.pending, submittedBy: email, submittedAt: new Date().toISOString() };
  await write(PENDING_KEY, pending);
  return { pending: pending[tool.id] };
}

/** The files a pending submission adds, named by a hash of their bytes. */
export function filesFor(toolId, pending) {
  return pending.screenshots.filter((s) => s.data).map((s) => {
    const hash = createHash("sha256").update(Buffer.from(s.data, "base64")).digest("hex").slice(0, 16);
    return { path: `public/media/${toolId}/${hash}.${EXT[s.type]}`, url: `/media/${toolId}/${hash}.${EXT[s.type]}`, base64: s.data, shot: s };
  });
}

/**
 * Approve: commit the new screenshots, then make the submission live.
 * `commit` is injected so a test can approve without GitHub.
 */
export async function approveMedia(toolId, { by = "", commit }) {
  const pending = await readPending();
  const p = pending[toolId];
  if (!p) return { error: "Nothing waiting for that tool." };
  const files = filesFor(toolId, p);
  let sha = "";
  if (files.length) {
    const c = await commit({ files: files.map((f) => ({ path: f.path, base64: f.base64 })), message: `Vendor screenshots for ${toolId}\n\nApproved on /admin. ${files.length} image${files.length === 1 ? "" : "s"} under public/media/${toolId}/.` });
    if (c.error) return c;
    sha = c.sha;
  }
  const urlOf = new Map(files.map((f) => [f.shot, f.url]));
  const live = await readMedia();
  live[toolId] = {
    screenshots: p.screenshots.map((s) => (s.data ? { path: urlOf.get(s), alt: s.alt, width: s.width, height: s.height } : s)),
    video: p.video ? { url: p.video } : null,
    approvedAt: new Date().toISOString(), approvedBy: by, commit: sha,
  };
  delete pending[toolId];
  await Promise.all([write(MEDIA_KEY, live), write(PENDING_KEY, pending)]);
  return { media: live[toolId], sha };
}

export async function rejectMedia(toolId, reason) {
  const why = clean(reason, 300);
  if (why.length < 3) return { error: "Say why, so the vendor can fix it." };
  const pending = await readPending();
  const p = pending[toolId];
  if (!p) return { error: "Nothing waiting for that tool." };
  delete pending[toolId];
  await write(PENDING_KEY, pending);
  return { rejected: p, reason: why };
}

/** Remove a tool's live media (the files stay in the repository's history). */
export async function removeMedia(toolId) {
  const live = await readMedia();
  if (!live[toolId]) return { error: "No media on that tool." };
  delete live[toolId];
  await write(MEDIA_KEY, live);
  return { removed: true };
}

/** What a page may show: no submitter, no approver. */
export const publicMedia = (m) => (m ? { screenshots: m.screenshots || [], video: m.video || null } : null);
