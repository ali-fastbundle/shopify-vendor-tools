/*
 * Consent for Google Analytics, kept in this browser only (2026-11-06).
 *
 * `svt:consent` in localStorage is "granted" or "denied". Absent means the
 * person has not chosen, and absent is treated exactly like denied: nothing
 * loads. Dismissing the banner stores "denied", so a reject is never harder
 * than an accept. Every access is wrapped, because blocked storage must cost
 * the remembered choice and nothing else: with no storage the banner shows on
 * every visit and GA never loads unless accepted on that page.
 *
 * Client-safe and pure apart from the browser globals it guards.
 */

export const CONSENT_KEY = "svt:consent";
export const CONSENT_EVENT = "watchfor:consent";       // the choice changed
export const CONSENT_OPEN = "watchfor:consent-open";   // show the banner again (footer link)

/** The measurement id, or "" when GA is not configured. Inlined at build. */
export const GA_ID = (process.env.NEXT_PUBLIC_GA_ID || "").trim();
export const gaConfigured = () => /^G-[A-Z0-9]+$/.test(GA_ID);

export function readConsent() {
  try {
    const v = window.localStorage.getItem(CONSENT_KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

export function writeConsent(value) {
  const v = value === "granted" ? "granted" : "denied";
  try { window.localStorage.setItem(CONSENT_KEY, v); } catch { /* blocked storage: the choice lasts this page only */ }
  try { window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: v })); } catch { /* ignore */ }
  return v;
}

/*
 * Withdrawing after GA has run: stop it on this page, remove the cookies it
 * set on this site (_ga and _ga_<id>), and reload so the script is gone. These
 * are Google's cookies, deleted, never set, by this code.
 */
export function withdrawGa(id = GA_ID) {
  try { window[`ga-disable-${id}`] = true; } catch { /* ignore */ }
  try {
    const host = window.location.hostname;
    const domains = ["", host, `.${host}`, `.${host.split(".").slice(-2).join(".")}`];
    for (const name of document.cookie.split(";").map((c) => c.split("=")[0].trim()).filter((n) => /^_ga(_|$)/.test(n))) {
      for (const d of domains) document.cookie = `${name}=; Max-Age=0; path=/${d ? `; domain=${d}` : ""}`;
    }
  } catch { /* ignore */ }
}
