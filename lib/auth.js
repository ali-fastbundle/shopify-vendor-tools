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

export const mintLoginToken = (email) =>
  sign({ t: "login", email, exp: Date.now() + LOGIN_TTL, n: randomUUID() });

export const readLoginToken = (token) => {
  const p = verify(token);
  return p && p.t === "login" ? p.email : null;
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
  return list.includes(String(email).toLowerCase());
}
