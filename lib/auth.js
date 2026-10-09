/*
 * Minimal session auth. No NextAuth, no OAuth app registration.
 *
 *  1. Someone submits their email.
 *  2. We mint a short-lived, HMAC-signed login token and email them a link.
 *  3. Hitting that link exchanges the token for a 30-day signed session cookie.
 *
 * The cookie holds the email and nothing else. Owning an email address proves
 * nothing about owning a tool — that is what the separate domain-verification
 * step in lib/listings.js is for.
 */
import { createHmac, timingSafeEqual, randomUUID } from "crypto";

const SECRET = process.env.AUTH_SECRET || "";
export const COOKIE = "svt_session";
const LOGIN_TTL = 15 * 60 * 1000;          // 15 minutes
const SESSION_TTL = 30 * 24 * 60 * 60;     // 30 days, in seconds

export const configured = Boolean(SECRET);

const b64 = (s) => Buffer.from(s).toString("base64url");
const unb64 = (s) => Buffer.from(s, "base64url").toString();

function sign(payload) {
  const body = b64(JSON.stringify(payload));
  const mac = createHmac("sha256", SECRET).update(body).digest("base64url");
  return `${body}.${mac}`;
}

function verify(token) {
  if (!SECRET || typeof token !== "string" || !token.includes(".")) return null;
  const [body, mac] = token.split(".");
  const expected = createHmac("sha256", SECRET).update(body).digest("base64url");
  const a = Buffer.from(mac || ""), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(unb64(body));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch { return null; }
}

export const normaliseEmail = (e) =>
  String(e || "").trim().toLowerCase().slice(0, 160);

export const isEmail = (e) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);

export const domainOf = (email) => String(email).split("@")[1] || "";

/*
 * `tool` is where the person was when they asked for the link, so the callback
 * can put them back rather than on the homepage. It rides inside the signed
 * payload rather than as a query parameter on the callback URL, which is what
 * keeps this from being an open redirect: the only thing it can ever say is a
 * tool id we put there ourselves, and the callback turns it into a parameter on
 * our own origin rather than into a destination. Callers validate the id
 * against the catalogue before minting; this just carries it.
 */
export const mintLoginToken = (email, tool = "") =>
  sign({ t: "login", email, tool: tool || undefined, exp: Date.now() + LOGIN_TTL, n: randomUUID() });

/** The claims in a login token, or null. `{ email, tool }`. */
export const readLoginToken = (token) => {
  const p = verify(token);
  if (!p || p.t !== "login") return null;
  return { email: p.email, tool: typeof p.tool === "string" ? p.tool : "" };
};

export const mintSession = (email) =>
  sign({ t: "session", email, exp: Date.now() + SESSION_TTL * 1000 });

export function sessionFrom(request) {
  const raw = request.cookies?.get?.(COOKIE)?.value
    || (request.headers.get("cookie") || "")
       .split(";").map((c) => c.trim()).find((c) => c.startsWith(COOKIE + "="))?.slice(COOKIE.length + 1);
  const p = verify(raw);
  return p && p.t === "session" ? { email: p.email } : null;
}

export const sessionCookie = (value, maxAge = SESSION_TTL) =>
  `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}` +
  (process.env.NODE_ENV === "production" ? "; Secure" : "");

export function isAdmin(email) {
  const list = (process.env.ADMIN_EMAILS || "")
    .split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return list.includes(String(email).trim().toLowerCase());
}

/*
 * A signed timestamp for a public form, minted when the page renders and read
 * back when the form posts. It is what makes a time-to-submit check worth
 * anything: a timestamp the browser supplied could be backdated by the same
 * script that fills the form, and this one cannot be edited without breaking
 * the signature. Valid for a day, so a tab left open overnight gets a clear
 * "reload" rather than a silent drop.
 */
const FORM_TTL = 24 * 60 * 60 * 1000;
export const mintFormToken = (form) => sign({ t: "form", form, at: Date.now(), exp: Date.now() + FORM_TTL });

/** When the form was rendered, in ms, or null if the token is not ours. */
export const readFormToken = (token, form) => {
  const p = verify(token);
  return p && p.t === "form" && p.form === form && Number.isFinite(p.at) ? p.at : null;
};

/*
 * The double opt-in for following a newsletter or an event. The link carries
 * the address and the item, signed, so nothing is stored until the person
 * clicks it: an unconfirmed address typed into a public form never reaches
 * the store at all. A week to click.
 */
const FOLLOW_TTL = 7 * 24 * 60 * 60 * 1000;
export const mintFollowToken = (email, id) => sign({ t: "follow", email, id, exp: Date.now() + FOLLOW_TTL });

/** `{ email, id }` from a confirm link, or null. */
export const readFollowToken = (token) => {
  const p = verify(token);
  return p && p.t === "follow" && typeof p.email === "string" && typeof p.id === "string"
    ? { email: p.email, id: p.id } : null;
};
