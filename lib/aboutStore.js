/*
 * The /about text, stored. Server only. What it is and the one rule on it are
 * in lib/aboutText.js.
 *
 *   svt:about       = { name, role, paragraphs, links, at, by, history: [earlier versions] }
 *   svt:about:photo = { data (base64), type, v, at, by }
 *
 * The photo has its own key so the text, which every page load reads, does
 * not carry an image with it. It is served by app/about/photo. No photo key
 * means the file in public/ (ABOUT_PHOTO in next.config.mjs).
 *
 * No key means the text in the file (DEFAULT). Reset deletes the current
 * version back to that, and keeps what it replaced in history.
 */
import { read, write } from "./store";
import { createHash } from "crypto";
import { DEFAULT, aboutIssues, paragraphsOf, sanitiseLinks, PHOTO_MAX_BYTES, PHOTO_TYPES } from "./aboutText";

export const KEY = "svt:about";
const MAX_HISTORY = 10;

/** What the page shows: the saved version, or the file's. Never throws. */
export async function getAbout() {
  try {
    const r = await read(KEY, null);
    if (r?.name && r?.paragraphs?.length) return { name: r.name, role: r.role || "", paragraphs: r.paragraphs, links: r.links || [], at: r.at || "" };
  } catch {}
  return { ...DEFAULT, at: "" };
}

/** The admin's view: the current text and the history. */
export async function getAboutRecord() {
  return (await read(KEY, null)) || null;
}

export async function saveAbout({ name, role, body, links } = {}, by = "") {
  const issues = aboutIssues({ name, role, body, links });
  if (issues.length) return { error: issues.join(" ") };
  const prev = (await read(KEY, null)) || null;
  const current = prev?.paragraphs?.length ? prev : { ...DEFAULT, at: "", by: "file" };
  const next = {
    name: String(name).trim(), role: String(role || "").trim(), paragraphs: paragraphsOf(body),
    links: sanitiseLinks(links).links || [],
    at: new Date().toISOString(), by,
    history: [{ name: current.name, role: current.role, paragraphs: current.paragraphs, links: current.links || [], at: current.at, by: current.by }, ...(prev?.history || [])].slice(0, MAX_HISTORY),
  };
  await write(KEY, next);
  return { record: next };
}

/** Back to the text in the file, keeping the replaced version in history. */
export async function resetAbout(by = "") {
  const prev = (await read(KEY, null)) || null;
  if (!prev?.paragraphs?.length) return { error: "The page already shows the text in the file." };
  const next = {
    history: [{ name: prev.name, role: prev.role, paragraphs: prev.paragraphs, links: prev.links || [], at: prev.at, by: prev.by }, ...(prev.history || [])].slice(0, MAX_HISTORY),
    resetAt: new Date().toISOString(), resetBy: by,
  };
  await write(KEY, next);
  return { record: next };
}

/* ---------------- the photo ---------------- */

export const PHOTO_KEY = "svt:about:photo";

/** The stored photo, or null. `data` is base64. */
export async function getAboutPhoto() {
  try {
    const p = await read(PHOTO_KEY, null);
    return p?.data && PHOTO_TYPES.includes(p.type) ? p : null;
  } catch { return null; }
}

/** The page's photo URL: the uploaded one, versioned, or the file in public/. */
export async function aboutPhotoUrl() {
  const p = await getAboutPhoto();
  if (p) return `/about/photo?v=${p.v}`;
  return process.env.ABOUT_PHOTO || "";
}

/**
 * Save an uploaded photo from a data URL. The browser has already resized and
 * re-encoded it, which also drops any location data in the original; the
 * server checks the type, the size and that the bytes are the image type they
 * say they are.
 */
export async function saveAboutPhoto(dataUrl, by = "") {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ""));
  if (!m) return { error: "That is not a JPEG, PNG or WebP image." };
  const bytes = Buffer.from(m[2], "base64");
  if (bytes.length > PHOTO_MAX_BYTES) return { error: `The image is over ${Math.round(PHOTO_MAX_BYTES / 1000)} KB after resizing.` };
  const magic = { "image/jpeg": [0xff, 0xd8, 0xff], "image/png": [0x89, 0x50, 0x4e, 0x47], "image/webp": [0x52, 0x49, 0x46, 0x46] }[m[1]];
  if (!magic.every((b, i) => bytes[i] === b)) return { error: "The file's contents do not match its type." };
  const v = createHash("sha256").update(bytes).digest("hex").slice(0, 12);
  await write(PHOTO_KEY, { data: m[2], type: m[1], v, at: new Date().toISOString(), by });
  return { url: `/about/photo?v=${v}` };
}

/** Back to the photo in public/. */
export async function clearAboutPhoto() {
  await write(PHOTO_KEY, null);
  return { url: process.env.ABOUT_PHOTO || "" };
}
