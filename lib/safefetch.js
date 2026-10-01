/*
 * SSRF guard for the two places that fetch a URL we did not write.
 *
 * `research.js` fetches a suggestion URL, which a stranger submitted through
 * /api/suggest; `monitor.js` fetches catalogue domains, which are editorial but
 * can redirect anywhere a vendor points them. Both followed redirects with no
 * check on where they landed, so a submitted (or redirected-to) host could be
 * loopback, a private range, or the cloud metadata address. `/api/suggest`
 * only required a dotted host, which `169.254.169.254` and `10.0.0.1` satisfy.
 *
 * This resolves the host before connecting, refuses any address that is not
 * publicly routable, and follows redirects by hand so every hop is checked the
 * same way. It is not a full answer to DNS rebinding (the name could resolve
 * differently between this check and the socket), but it closes the submitted
 * literal, the private redirect target and the metadata endpoint, which is the
 * reachable part of the vector here.
 */
import { lookup } from "node:dns/promises";

/* IPv4 blocks that must never be fetched: this host, private, link-local
   (incl. the cloud metadata 169.254.169.254), CGNAT, benchmarking, TEST-NET,
   multicast and reserved. */
function blockedV4(ip) {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = p;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;            // link-local + metadata
  if (a === 172 && b >= 16 && b <= 31) return true;   // private
  if (a === 192 && b === 168) return true;            // private
  if (a === 192 && b === 0) return true;              // 192.0.0.0/24 + 192.0.2.0/24
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a === 198 && b === 51) return true;             // TEST-NET-2
  if (a === 203 && b === 0) return true;              // TEST-NET-3
  if (a === 100 && b >= 64 && b <= 127) return true;  // CGNAT
  if (a >= 224) return true;                          // multicast + reserved
  return false;
}

function blockedV6(ip) {
  const s = ip.toLowerCase().split("%")[0];           // drop zone id
  if (s === "::1" || s === "::" || s === "0:0:0:0:0:0:0:1") return true;
  if (s.startsWith("fe8") || s.startsWith("fe9") || s.startsWith("fea") || s.startsWith("feb")) return true; // link-local fe80::/10
  if (s.startsWith("fc") || s.startsWith("fd")) return true; // unique-local fc00::/7
  // IPv4-mapped, dotted form (::ffff:10.0.0.1): decode and re-check.
  const dotted = s.match(/(?:::ffff:|::)(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) return blockedV4(dotted[1]);
  // IPv4-mapped, hex form — the one the URL parser normalises to
  // (::ffff:a9fe:a9fe == 169.254.169.254). Decode the two trailing hextets.
  const hex = s.match(/::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hex) {
    const hi = parseInt(hex[1], 16), lo = parseInt(hex[2], 16);
    return blockedV4(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
  }
  return false;
}

function blockedHostname(host) {
  const h = String(host).toLowerCase().replace(/\.$/, "");
  if (!h) return true;
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  if (h === "metadata.google.internal" || h.endsWith(".internal")) return true;
  return false;
}

/**
 * Resolve `url` and throw unless it is an absolute http(s) URL whose host is
 * publicly routable. Returns the parsed URL on success.
 */
export async function assertPublicUrl(url) {
  let u;
  try { u = new URL(url); } catch { throw new Error("blocked: unparseable URL"); }
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error(`blocked: ${u.protocol} scheme`);
  const host = u.hostname.replace(/^\[|\]$/g, "");    // strip IPv6 brackets
  if (blockedHostname(host)) throw new Error(`blocked: ${host}`);

  // A literal address never touches DNS; a name is resolved to all its records.
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    if (blockedV4(host)) throw new Error(`blocked: ${host}`);
  } else if (host.includes(":")) {
    if (blockedV6(host)) throw new Error(`blocked: ${host}`);
  } else {
    let addrs;
    try { addrs = await lookup(host, { all: true }); }
    catch { throw new Error(`blocked: ${host} does not resolve`); }
    if (!addrs.length) throw new Error(`blocked: ${host} does not resolve`);
    for (const { address, family } of addrs) {
      const bad = family === 6 ? blockedV6(address) : blockedV4(address);
      if (bad) throw new Error(`blocked: ${host} resolves to ${address}`);
    }
  }
  return u;
}

/**
 * fetch(), but every hop is checked by `assertPublicUrl` and redirects are
 * followed by hand so the target of a 3xx cannot slip past the guard. Drop-in
 * for `fetch(url, { redirect: "follow", ... })`; pass the same options minus
 * `redirect`.
 */
export async function safeFetch(url, opts = {}, { maxRedirects = 4 } = {}) {
  let current = url;
  for (let i = 0; i <= maxRedirects; i++) {
    await assertPublicUrl(current);
    const res = await fetch(current, { ...opts, redirect: "manual" });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return res;                            // 3xx with no target: hand it back as-is
      current = new URL(loc, current).href;            // resolve relative redirects, then re-check
      continue;
    }
    return res;
  }
  throw new Error("blocked: too many redirects");
}
